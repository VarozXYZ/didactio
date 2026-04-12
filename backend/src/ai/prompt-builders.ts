import type {
    AuthoringConfig,
    AuthoringLearnerLevel,
    AuthoringTone,
} from './config.js'
import type {
    DidacticUnitDepth,
    DidacticUnitLength,
    DidacticUnitLevel,
    DidacticUnitQuestionAnswer,
    DidacticUnitReferenceSyllabus,
    DidacticUnitModule,
} from '../didactic-unit/planning.js'

export const TARGET_CHAPTER_COUNT_BY_LENGTH: Record<DidacticUnitLength, number> = {
    intro: 3,
    short: 6,
    long: 9,
    textbook: 12,
}

export function resolveTargetChapterCount(length: DidacticUnitLength): number {
    return TARGET_CHAPTER_COUNT_BY_LENGTH[length]
}

function findAnswerValue(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    questionId: string
): string {
    return answers?.find((answer) => answer.questionId === questionId)?.value ?? 'not provided'
}

function toneInstruction(tone: AuthoringTone): string {
    switch (tone) {
        case 'friendly':
            return 'Use a warm, conversational tone with approachable language and concrete examples.'
        case 'professional':
            return 'Use formal academic language that is precise, authoritative, and polished.'
        case 'neutral':
        default:
            return 'Use standard educational language that is clear, balanced, and effective.'
    }
}

function learnerLevelInstruction(level: AuthoringLearnerLevel): string {
    switch (level) {
        case 'advanced':
            return 'Assume the user is comfortable with abstraction, independent synthesis, and dense technical explanations.'
        case 'intermediate':
            return 'Assume the user is comfortable with guided technical explanations but still benefits from scaffolding and worked examples.'
        case 'beginner':
        default:
            return 'Assume the user benefits from explicit scaffolding, gentle pacing, and concrete examples before abstraction.'
    }
}

function depthInstruction(depth: DidacticUnitDepth): string {
    switch (depth) {
        case 'basic':
            return 'Avoid technical jargon when possible, explain unavoidable terminology immediately, and break complex concepts into simple parts.'
        case 'technical':
            return 'Use full technical vocabulary and deeper explanations, prioritizing precision and completeness.'
        case 'intermediate':
        default:
            return 'Use technical terms when useful, but keep explanations accessible and grounded in examples.'
    }
}

function contentLengthInstruction(length: DidacticUnitLength): string {
    switch (length) {
        case 'intro':
            return 'Keep the scope compact and introductory.'
        case 'long':
            return 'Provide substantial coverage with room for explanation, examples, and guided practice.'
        case 'textbook':
            return 'Aim for comprehensive, textbook-like coverage with robust progression and substantial examples.'
        case 'short':
        default:
            return 'Keep the material focused but genuinely useful.'
    }
}

function buildAuthoringContext(authoring: AuthoringConfig): string[] {
    return [
        `Language: ${authoring.language}`,
        `Tone: ${authoring.tone}`,
        `Profile learner level: ${authoring.learnerLevel}`,
        toneInstruction(authoring.tone),
        learnerLevelInstruction(authoring.learnerLevel),
    ]
}

function formatModuleOutline(
    module: DidacticUnitModule,
    index: number,
    moduleStatus?: 'current' | 'completed' | 'upcoming'
): string {
    const status =
        moduleStatus === 'current'
            ? ' (CURRENT MODULE)'
            : moduleStatus === 'completed'
              ? ' (COMPLETED)'
              : moduleStatus === 'upcoming'
                ? ' (UPCOMING)'
                : ''

    return [
        `${index + 1}. ${module.title}${status}`,
        `- Overview: ${module.overview}`,
        `- Lessons: ${module.lessons.map((lesson) => lesson.title).join(', ')}`,
    ].join('\n')
}

function formatFullCourseContext(
    syllabus: DidacticUnitReferenceSyllabus,
    currentModuleIndex?: number
): string {
    return syllabus.modules
        .map((module, index) =>
            formatModuleOutline(
                module,
                index,
                currentModuleIndex === undefined
                    ? undefined
                    : index === currentModuleIndex
                      ? 'current'
                      : index < currentModuleIndex
                        ? 'completed'
                        : 'upcoming'
            )
        )
        .join('\n\n')
}

function formatContinuityContext(
    syllabus: DidacticUnitReferenceSyllabus,
    continuitySummaries: string[] | undefined,
    moduleIndex: number
): string {
    const previousModules = syllabus.modules.slice(0, moduleIndex)
    const previousSummaries = (continuitySummaries ?? []).slice(0, moduleIndex)

    if (previousModules.length === 0) {
        return [
            '**Prerequisites:**',
            'This is the first module, so assume students are starting fresh with the topic.',
        ].join('\n')
    }

    const prerequisites = previousModules
        .map((module, index) => `${index + 1}. ${module.title}: ${module.overview}`)
        .join('\n')

    const summaryContext =
        previousSummaries.length > 0
            ? previousSummaries
                  .map(
                      (summary, index) =>
                          `### Module ${index + 1} Concepts:\n${summary}`
                  )
                  .join('\n\n')
            : 'Students have completed the earlier modules and already know their foundational concepts.'

    return [
        '**Prerequisites (from previous modules):**',
        prerequisites,
        '',
        '**Key concepts ALREADY covered (DO NOT RE-EXPLAIN THESE):**',
        summaryContext,
        '',
        'Instructions:',
        '- Assume the student has mastered the concepts listed above.',
        '- Do not define terms that were already defined in previous modules.',
        '- Build upon this existing knowledge foundation.',
    ].join('\n')
}

function formatForwardContext(
    syllabus: DidacticUnitReferenceSyllabus,
    moduleIndex: number
): string {
    const upcomingModules = syllabus.modules.slice(moduleIndex + 1)

    if (upcomingModules.length === 0) {
        return [
            '**Course completion:**',
            'This is the final module. Focus on synthesis, application, and mastery of the entire topic.',
        ].join('\n')
    }

    return [
        '**Upcoming modules (to prepare students for):**',
        upcomingModules
            .map(
                (module, index) =>
                    `${moduleIndex + index + 2}. ${module.title}: ${module.overview}`
            )
            .join('\n'),
        '',
        'Introduce concepts that will be expanded in later modules. Avoid covering topics that will be deeply explored in upcoming modules.',
    ].join('\n')
}

function buildSection(title: string, lines: string[]): string {
    return [`[${title}]`, ...lines.filter(Boolean)].join('\n')
}

export function buildGatewaySystemPrompt(
    stage:
        | 'folder_classification'
        | 'moderation'
        | 'questionnaire'
        | 'syllabus'
        | 'summary'
        | 'chapter'
): string {
    switch (stage) {
        case 'folder_classification':
            return 'You classify educational units into an existing folder. Return only the requested structured object.'
        case 'moderation':
            return 'You are a prompt filter and improver for an educational course creation platform. Return only the requested structured object.'
        case 'questionnaire':
            return 'You design concise learner-discovery questionnaires for instructional planning. Return only the requested structured object.'
        case 'syllabus':
            return 'You are a curriculum designer. Return only a single valid structured syllabus object that exactly matches the requested schema.'
        case 'summary':
            return 'You write concise internal continuity summaries or learner-facing recaps depending on the prompt.'
        case 'chapter':
            return 'You are an expert curriculum designer and instructional design specialist. Return only markdown educational content.'
    }
}

export function buildModerationPrompt(input: {
    topic: string
    level: DidacticUnitLevel
    additionalContext?: string
    folders?: Array<{
        name: string
        description: string
    }>
    authoring: AuthoringConfig
}): string {
    const shouldClassifyFolder = (input.folders?.length ?? 0) > 0

    return [
        buildSection('Role / Contract', [
            'Validate that the topic is appropriate for educational content.',
            'Reject only harmful, illegal, clearly non-educational, or unusable requests.',
            'Improve vague prompts into clear, structured learning objectives.',
            shouldClassifyFolder
                ? 'Also classify the unit into exactly one of the provided folders.'
                : '',
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Learner Context', [`Course level: ${input.level}`]),
        buildSection('Requested Topic', [
            `Evaluate and improve this course topic request for a ${input.level} level course: "${input.topic}"`,
            input.additionalContext ? `Additional context: ${input.additionalContext}` : '',
        ]),
        shouldClassifyFolder
            ? buildSection(
                  'Available folders',
                  [
                      input.folders!
                          .map(
                              (folder, index) =>
                                  `${index + 1}. ${folder.name}: ${folder.description}`
                          )
                          .join('\n'),
                  ]
              )
            : '',
        buildSection('Output Contract', [
            'Return whether the prompt is approved, a normalized topic title, an improved topic brief targeting the requested level, and concise reasoning notes.',
            'Use these exact JSON keys: approved, notes, normalizedTopic, improvedTopicBrief, reasoningNotes.',
            'Preserve the authoring context in the improved brief so downstream generations inherit it.',
            shouldClassifyFolder
                ? 'Return folderName exactly as written in the available folder list. If uncertain, use General.'
                : '',
            shouldClassifyFolder
                ? 'Return folderReasoning with a short explanation for the folder choice.'
                : '',
        ]),
    ].join('\n\n')
}

export function buildQuestionnairePrompt(input: {
    topic: string
    level: DidacticUnitLevel
    improvedTopicBrief?: string
    authoring: AuthoringConfig
}): string {
    return [
        buildSection('Role / Contract', [
            'Create a learner questionnaire that helps refine a didactic unit plan.',
            'Return exactly 3 questions in the canonical order and ids required by the schema.',
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Learner Context', [`Declared learner level: ${input.level}`]),
        buildSection('Generation Brief', [
            `Topic: ${input.topic}`,
            input.improvedTopicBrief ? `Improved topic brief: ${input.improvedTopicBrief}` : '',
        ]),
        buildSection('Output Contract', [
            'Return a single JSON object with a top-level questions array.',
            'Use these exact ids in this exact order: topic_knowledge_level, related_knowledge_level, learning_goal.',
            'For each question, use these exact keys: id, prompt, type, options.',
            'Use single_select for fixed choices and long_text for open responses.',
            'Do not use question ids as top-level object keys.',
            'Keep prompts concise, learner-facing, and useful for planning.',
            'Keep the questionnaire aligned with the authoring profile.',
        ]),
    ].join('\n\n')
}

export function buildFolderClassificationPrompt(input: {
    topic: string
    additionalContext?: string
    folders: Array<{
        name: string
        description: string
    }>
    authoring: AuthoringConfig
}): string {
    return [
        buildSection('Role / Contract', [
            'Classify the requested didactic unit into exactly one existing folder.',
            'Choose the closest folder from the provided list only.',
            'Prefer General when the topic is broad, ambiguous, or does not clearly fit a more specific folder.',
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Unit Context', [
            `Topic: ${input.topic}`,
            input.additionalContext ? `Additional context: ${input.additionalContext}` : '',
        ]),
        buildSection('Available folders', [
            input.folders
                .map(
                    (folder, index) =>
                        `${index + 1}. ${folder.name}: ${folder.description}`
                )
                .join('\n'),
        ]),
        buildSection('Output Contract', [
            'Return the chosen folderName exactly as written in the available folder list.',
            'Include a concise reasoning string explaining the match.',
        ]),
    ].join('\n\n')
}

export function buildSyllabusMarkdownPrompt(input: {
    topic: string
    level: DidacticUnitLevel
    improvedTopicBrief?: string
    syllabusPrompt: string
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
    authoring: AuthoringConfig
    depth: DidacticUnitDepth
    length: DidacticUnitLength
}): string {
    const targetModuleCount = resolveTargetChapterCount(input.length)

    return [
        buildSection('Role / Contract', [
            'Create a complete syllabus object for the requested topic.',
            'The syllabus must use modules that progress from conceptual understanding to practical application to independent creation.',
        ]),
        buildSection('Learner / Profile Context', [
            `Declared learner level: ${input.level}`,
            `Topic knowledge: ${findAnswerValue(input.questionnaireAnswers, 'topic_knowledge_level')}`,
            `Related knowledge: ${findAnswerValue(input.questionnaireAnswers, 'related_knowledge_level')}`,
            `Learning goal: ${findAnswerValue(input.questionnaireAnswers, 'learning_goal')}`,
            `Requested depth: ${input.depth}`,
            `Requested length: ${input.length}`,
            `Target module count: ${targetModuleCount}`,
            depthInstruction(input.depth),
            contentLengthInstruction(input.length),
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Generation Brief', [
            `Topic: ${input.topic}`,
            input.improvedTopicBrief ? `Improved topic brief: ${input.improvedTopicBrief}` : '',
            'Deterministic syllabus planning prompt:',
            input.syllabusPrompt,
        ]),
        buildSection('Output Contract', [
            'Return a strict structured syllabus object.',
            'Use these exact top-level keys: topic, title, keywords, description, modules.',
            'For each module, use these exact keys: title, overview, lessons.',
            'For each lesson, use these exact keys: title, contentOutline.',
            `Create exactly ${targetModuleCount} modules.`,
            'Do not include durations or time estimates anywhere.',
            'Use a keywords string, not a keywords array.',
            'Each module must include lessons with action-oriented content outlines.',
            'Ensure modules build logically on one another and the final module emphasizes synthesis or independent creation.',
            'Make titles and section phrasing natural, specific, and human. Avoid generic educational boilerplate.',
            'Use sentence case for titles and headings, not title case. Capitalize only the first word and proper nouns.',
        ]),
    ].join('\n\n')
}

export function buildChapterMarkdownPrompt(input: {
    topic: string
    level: DidacticUnitLevel
    syllabus: DidacticUnitReferenceSyllabus
    chapterIndex: number
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
    continuitySummaries?: string[]
    authoring: AuthoringConfig
    depth: DidacticUnitDepth
    length: DidacticUnitLength
    additionalContext?: string
    instruction?: string
}): string {
    const module = input.syllabus.modules[input.chapterIndex]
    const previousBridge =
        input.chapterIndex > 0
            ? `Begin with a short bridge from the previous module, ${input.syllabus.modules[input.chapterIndex - 1]?.title ?? 'the previous module'}.`
            : 'This is the first module, so begin by orienting the learner clearly.'

    return [
        buildSection('Course Overview', [
            `Main Topic: ${input.syllabus.topic}`,
            `Student Level: ${input.level}`,
            `Course Description: ${input.syllabus.description}`,
            `Requested depth: ${input.depth}`,
            `Requested length: ${input.length}`,
            depthInstruction(input.depth),
            contentLengthInstruction(input.length),
            `Topic knowledge: ${findAnswerValue(input.questionnaireAnswers, 'topic_knowledge_level')}`,
            `Related knowledge: ${findAnswerValue(input.questionnaireAnswers, 'related_knowledge_level')}`,
            `Learning goal: ${findAnswerValue(input.questionnaireAnswers, 'learning_goal')}`,
            input.additionalContext
                ? `Additional learner or context notes: ${input.additionalContext}`
                : '',
        ]),
        buildSection('Complete Course Structure', [
            formatFullCourseContext(input.syllabus, input.chapterIndex),
        ]),
        buildSection('Current Module Details', [
            `Module Title: ${module.title}`,
            `Module Overview: ${module.overview}`,
            `Position in Course: Module ${input.chapterIndex + 1} of ${input.syllabus.modules.length}`,
            `Current Module Lessons to Cover:\n${module.lessons.map((lesson, index) => `${index + 1}. ${lesson.title}`).join('\n')}`,
            `Lesson content outlines:\n${module.lessons
                .map(
                    (lesson, lessonIndex) =>
                        `${lessonIndex + 1}. ${lesson.title}\n${lesson.contentOutline
                            .map((item) => `   - ${item}`)
                            .join('\n')}`
                )
                .join('\n')}`,
        ]),
        buildSection('Prerequisite Context', [
            formatContinuityContext(input.syllabus, input.continuitySummaries, input.chapterIndex),
        ]),
        buildSection('Forward Context', [formatForwardContext(input.syllabus, input.chapterIndex)]),
        buildSection('Writing Style Requirements', [
            `Tone: ${toneInstruction(input.authoring.tone)}`,
            `Technical Level: ${depthInstruction(input.depth)}`,
            `Language: ${input.authoring.language}`,
            `Persistent profile learner level: ${input.authoring.learnerLevel}`,
            learnerLevelInstruction(input.authoring.learnerLevel),
            input.authoring.extraInstructions
                ? `Extra instructions for this educational content: ${input.authoring.extraInstructions}`
                : '',
            'Use sentence case for headings and subheadings, not title case.',
            'Capitalize only the first word and proper nouns in headings.',
            'Prefer "Common pitfalls with variables" over "Common Pitfalls with Variables".',
        ]),
        buildSection('Pedagogical Requirements', [
            previousBridge,
            'Each lesson must be written as a cohesive mini-module section, not a list of tips.',
            'Use a 70/30 balance of conceptual depth and applied practice.',
            'Include all of these organically, not as a repetitive checklist:',
            '1. A detailed conceptual explanation',
            '2. A realistic example drawn from relevant domains and real-world applications',
            '3. A contrastive analysis showing ineffective vs effective approaches',
            '4. Common mistakes or pitfalls',
            '5. A short, meaningful activity or reflection task',
            '6. A final "Why it works" section explaining the underlying principles',
            '7. One short knowledge check quiz with 3 questions for the module',
            '8. A short "Meta-connection" section explaining how these skills prepare for the next module',
            'Do not use generic headings like "Concept Explanation" or "Practical Example" repeatedly. Use topic-specific headings.',
            input.instruction
                ? `Regeneration instruction from the user: ${input.instruction}`
                : '',
        ]),
        buildSection('Output Contract', [
            'Return ONLY markdown educational content.',
            'Do not include the module title as a top-level heading because the UI already presents it separately.',
            'Do not include a standalone overview section at the beginning.',
            'Start directly with the instructional body.',
            'Do not include JSON, code fences, or commentary outside markdown.',
            'Use natural, topic-specific markdown headings throughout the module body.',
        ]),
    ].join('\n\n')
}

export function buildContinuitySummaryPrompt(input: {
    topic: string
    chapterTitle: string
    chapterMarkdown: string
    authoring: AuthoringConfig
}): string {
    return [
        buildSection('Role / Contract', [
            'Analyze the content and extract a concise, schematic list of key concepts, definitions, and techniques covered.',
            'Return a markdown bullet list with at most 10 items.',
            'Do not use full paragraphs. Focus on what was explicitly taught.',
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Current Artifact Target', [
            `Topic: ${input.topic}`,
            `Module title: ${input.chapterTitle}`,
        ]),
        buildSection('Source Markdown', [input.chapterMarkdown]),
    ].join('\n\n')
}

export function buildLearnerSummaryPrompt(input: {
    topic: string
    chapterTitle: string
    chapterMarkdown: string
    authoring: AuthoringConfig
}): string {
    return [
        buildSection('Role / Contract', [
            'Write a concise learner-facing summary for teaching content.',
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Current Artifact Target', [
            `Topic: ${input.topic}`,
            `Module or unit title: ${input.chapterTitle}`,
        ]),
        buildSection('Output Contract', [
            'Return markdown with exactly 2 sections:',
            '## Recap',
            '<short paragraph>',
            '## What To Practice',
            '- item',
            '- item',
        ]),
        buildSection('Source Markdown', [input.chapterMarkdown]),
    ].join('\n\n')
}
