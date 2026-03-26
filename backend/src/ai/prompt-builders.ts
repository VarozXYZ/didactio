import type {
    AuthoringConfig,
    AuthoringTone,
} from './config.js'
import type {
    DidacticUnitDepth,
    DidacticUnitLength,
    DidacticUnitQuestionAnswer,
    DidacticUnitSyllabus,
    DidacticUnitSyllabusChapter,
} from '../didactic-unit/planning.js'

function findAnswerValue(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    questionId: string
): string {
    return answers?.find((answer) => answer.questionId === questionId)?.value ?? 'not provided'
}

function deriveLearnerLevel(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    depth: DidacticUnitDepth
): 'beginner' | 'intermediate' | 'advanced' {
    const topicKnowledge = findAnswerValue(answers, 'topic_knowledge_level')

    if (depth === 'technical' || topicKnowledge === 'advanced') {
        return 'advanced'
    }

    if (depth === 'intermediate' || topicKnowledge === 'intermediate') {
        return 'intermediate'
    }

    return 'beginner'
}

function toneInstruction(tone: AuthoringTone): string {
    switch (tone) {
        case 'friendly':
            return 'Use a warm, encouraging, teacherly voice with concrete examples and approachable language.'
        case 'professional':
            return 'Use a polished, authoritative instructional voice with precise wording and disciplined structure.'
        case 'neutral':
        default:
            return 'Use clear, balanced educational language focused on clarity and steady progression.'
    }
}

function depthInstruction(depth: DidacticUnitDepth): string {
    switch (depth) {
        case 'basic':
            return 'Avoid unnecessary jargon, explain new terms immediately, and prefer simple examples.'
        case 'technical':
            return 'Use accurate technical vocabulary, deeper detail, and rigorous explanations when helpful.'
        case 'intermediate':
        default:
            return 'Use technical terms when useful, but keep explanations accessible and grounded in examples.'
    }
}

function contentLengthInstruction(contentLength: DidacticUnitLength): string {
    switch (contentLength) {
        case 'intro':
            return 'Keep the scope compact and introductory.'
        case 'long':
            return 'Provide substantial coverage with room for explanation, examples, and practice.'
        case 'textbook':
            return 'Aim for comprehensive, textbook-like coverage with careful progression and robust examples.'
        case 'short':
        default:
            return 'Keep the material focused but sufficiently detailed to be genuinely useful.'
    }
}

function buildAuthoringContext(authoring: AuthoringConfig): string[] {
    return [
        `Language: ${authoring.language}`,
        `Tone: ${authoring.tone}`,
        toneInstruction(authoring.tone),
    ]
}

function formatSyllabusOutline(
    syllabus: DidacticUnitSyllabus,
    currentChapterIndex?: number
): string {
    return syllabus.chapters
        .map((chapter, index) => {
            const status =
                currentChapterIndex === undefined
                    ? ''
                    : index === currentChapterIndex
                      ? ' (CURRENT CHAPTER)'
                      : index < currentChapterIndex
                        ? ' (PREVIOUS)'
                        : ' (UPCOMING)'

            return [
                `${index + 1}. ${chapter.title}${status}`,
                `- Overview: ${chapter.overview}`,
                `- Estimated duration: ${chapter.estimatedDurationMinutes} minutes`,
                `- Key points: ${chapter.keyPoints.join(', ')}`,
                `- Lessons: ${chapter.lessons.map((lesson) => lesson.title).join(', ')}`,
            ].join('\n')
        })
        .join('\n\n')
}

function formatChapterLessonPlan(chapter: DidacticUnitSyllabusChapter): string {
    return chapter.lessons
        .map((lesson, index) =>
            [
                `${index + 1}. ${lesson.title}`,
                ...lesson.contentOutline.map((item) => `   - ${item}`),
            ].join('\n')
        )
        .join('\n')
}

function formatContinuityContext(
    continuitySummaries: string[] | undefined,
    chapterIndex: number
): string {
    const previousSummaries = (continuitySummaries ?? []).slice(0, chapterIndex)

    if (previousSummaries.length === 0) {
        return [
            'Continuity context:',
            'This is the first generated chapter. Assume no previous chapter has introduced any unit-specific terminology yet.',
        ].join('\n')
    }

    return [
        'Continuity context:',
        'The learner has already covered these previous chapters. Build on them and do not re-explain their core concepts from scratch.',
        previousSummaries
            .map((summary, index) => `Chapter ${index + 1} continuity summary:\n${summary}`)
            .join('\n\n'),
    ].join('\n')
}

function buildSection(title: string, lines: string[]): string {
    return [`[${title}]`, ...lines.filter(Boolean)].join('\n')
}

export function buildGatewaySystemPrompt(
    stage: 'moderation' | 'questionnaire' | 'syllabus' | 'summary' | 'chapter'
): string {
    switch (stage) {
        case 'moderation':
            return 'You are an educational request reviewer. Produce safe, useful, structured moderation results for course generation.'
        case 'questionnaire':
            return 'You design concise learner-discovery questionnaires for instructional planning. Return only the requested structured object.'
        case 'syllabus':
            return 'You are a senior curriculum designer. Produce high-quality syllabus markdown that follows the requested structure exactly.'
        case 'summary':
            return 'You write concise internal continuity summaries or learner-facing recaps depending on the prompt.'
        case 'chapter':
            return 'You are a senior educational author. Produce cohesive didactic chapter markdown that builds on prior chapters and preserves course progression.'
    }
}

export function buildModerationPrompt(input: {
    topic: string
    authoring: AuthoringConfig
}): string {
    return [
        buildSection('Role / Contract', [
            'Review the requested teaching topic for an educational content generator.',
            'Approve ordinary educational topics and reject only requests that are clearly unsafe, incoherent, or unusable.',
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Requested Topic', [`Topic: ${input.topic}`]),
        buildSection('Output Contract', [
            'Return whether the request is approved, a normalized topic title, a high-quality improved topic brief for downstream generation, and short reasoning notes.',
        ]),
    ].join('\n\n')
}

export function buildQuestionnairePrompt(input: {
    topic: string
    improvedTopicBrief?: string
    authoring: AuthoringConfig
}): string {
    return [
        buildSection('Role / Contract', [
            'Create a learner questionnaire that helps plan a didactic unit.',
            'Return exactly 3 questions in the canonical order and ids required by the schema.',
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Generation Brief', [
            `Topic: ${input.topic}`,
            input.improvedTopicBrief ? `Improved topic brief: ${input.improvedTopicBrief}` : '',
        ]),
        buildSection('Output Contract', [
            'Use these exact ids in this exact order: topic_knowledge_level, related_knowledge_level, learning_goal.',
            'Use single_select for fixed choices and long_text for open responses.',
            'Keep prompts learner-facing, concise, and useful for planning.',
        ]),
    ].join('\n\n')
}

export function buildSyllabusMarkdownPrompt(input: {
    topic: string
    improvedTopicBrief?: string
    syllabusPrompt: string
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
    authoring: AuthoringConfig
    depth: DidacticUnitDepth
    length: DidacticUnitLength
}): string {
    const learnerLevel = deriveLearnerLevel(input.questionnaireAnswers, input.depth)

    return [
        buildSection('Role / Contract', [
            'Create a high-quality didactic syllabus in markdown.',
            'The markdown must follow the requested structure exactly because it will be validated and converted into a structured syllabus object.',
        ]),
        buildSection('Learner / Profile Context', [
            `Derived learner level: ${learnerLevel}`,
            `Topic knowledge: ${findAnswerValue(input.questionnaireAnswers, 'topic_knowledge_level')}`,
            `Related knowledge: ${findAnswerValue(input.questionnaireAnswers, 'related_knowledge_level')}`,
            `Learning goal: ${findAnswerValue(input.questionnaireAnswers, 'learning_goal')}`,
            `Requested depth: ${input.depth}`,
            `Requested length: ${input.length}`,
            depthInstruction(input.depth),
            contentLengthInstruction(input.length),
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Unit Context', [
            `Normalized topic: ${input.topic}`,
            input.improvedTopicBrief ? `Improved topic brief: ${input.improvedTopicBrief}` : '',
            'Deterministic syllabus planning prompt:',
            input.syllabusPrompt,
        ]),
        buildSection('Output Contract', [
            'Return markdown only.',
            'Use this exact structure:',
            '# <Unit Title>',
            '## Overview',
            '<one strong paragraph>',
            '## Learning Goals',
            '- goal',
            '- goal',
            '- goal',
            '## Keywords',
            '- keyword',
            '- keyword',
            '- keyword',
            '## Estimated Duration',
            '<positive integer number of minutes>',
            '## Chapters',
            '### 1. <Chapter Title>',
            '#### Overview',
            '<one strong paragraph>',
            '#### Estimated Duration',
            '<positive integer number of minutes>',
            '#### Key Points',
            '- point',
            '- point',
            '- point',
            '#### Lessons',
            '##### 1. <Lesson Title>',
            '- outline item',
            '- outline item',
            'Repeat the chapter structure for at least 3 chapters.',
            'Make the chapters progress from foundations to application to independent execution.',
        ]),
    ].join('\n\n')
}

export function buildSyllabusRepairPrompt(input: {
    topic: string
    markdown: string
    improvedTopicBrief?: string
    authoring: AuthoringConfig
}): string {
    return [
        buildSection('Role / Contract', [
            'Convert syllabus markdown into a strict structured syllabus object that satisfies the requested schema.',
        ]),
        buildSection('Context', [
            `Topic: ${input.topic}`,
            input.improvedTopicBrief ? `Improved topic brief: ${input.improvedTopicBrief}` : '',
            ...buildAuthoringContext(input.authoring),
        ]),
        buildSection('Source Markdown', [input.markdown]),
        buildSection('Output Contract', [
            'Return the best faithful structured syllabus object you can infer from the markdown.',
            'Do not invent unrelated chapters. If a field is implied but missing, fill it conservatively.',
        ]),
    ].join('\n\n')
}

export function buildChapterMarkdownPrompt(input: {
    topic: string
    syllabus: DidacticUnitSyllabus
    chapterIndex: number
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
    continuitySummaries?: string[]
    authoring: AuthoringConfig
    depth: DidacticUnitDepth
    length: DidacticUnitLength
    additionalContext?: string
    instruction?: string
}): string {
    const chapter = input.syllabus.chapters[input.chapterIndex]
    const learnerLevel = deriveLearnerLevel(input.questionnaireAnswers, input.depth)

    return [
        buildSection('Role / Contract', [
            'Write one didactic chapter in markdown.',
            'The chapter must feel like part of a coherent course, not an isolated article.',
        ]),
        buildSection('Learner / Profile Context', [
            `Derived learner level: ${learnerLevel}`,
            `Topic knowledge: ${findAnswerValue(input.questionnaireAnswers, 'topic_knowledge_level')}`,
            `Related knowledge: ${findAnswerValue(input.questionnaireAnswers, 'related_knowledge_level')}`,
            `Learning goal: ${findAnswerValue(input.questionnaireAnswers, 'learning_goal')}`,
            `Requested depth: ${input.depth}`,
            `Requested length: ${input.length}`,
            depthInstruction(input.depth),
            contentLengthInstruction(input.length),
        ]),
        buildSection('Authoring Profile', buildAuthoringContext(input.authoring)),
        buildSection('Unit Context', [
            `Unit title: ${input.syllabus.title}`,
            `Unit overview: ${input.syllabus.overview}`,
            `Unit keywords: ${input.syllabus.keywords.join(', ')}`,
            `Unit estimated duration: ${input.syllabus.estimatedDurationMinutes} minutes`,
            'Full chapter outline:',
            formatSyllabusOutline(input.syllabus, input.chapterIndex),
            input.additionalContext ? `Additional context: ${input.additionalContext}` : '',
        ]),
        buildSection('Current Artifact Target', [
            `Topic: ${input.topic}`,
            `Current chapter: ${chapter.title}`,
            `Chapter overview: ${chapter.overview}`,
            `Chapter estimated duration: ${chapter.estimatedDurationMinutes} minutes`,
            `Chapter key points: ${chapter.keyPoints.join(', ')}`,
            'Lesson plan:',
            formatChapterLessonPlan(chapter),
        ]),
        buildSection('Continuity Context', [
            formatContinuityContext(input.continuitySummaries, input.chapterIndex),
            input.instruction
                ? `Regeneration instruction from the user: ${input.instruction}`
                : 'No extra regeneration instruction was provided.',
            'Respect what previous chapters already taught, and avoid spending space on topics reserved for upcoming chapters.',
        ]),
        buildSection('Output Contract', [
            'Return markdown only.',
            'Follow this exact structure:',
            `# ${chapter.title}`,
            '## Overview',
            '<one compact paragraph>',
            '## Lesson',
            '<cohesive markdown body with topic-specific headings>',
            '## Key Takeaways',
            '- takeaway',
            '- takeaway',
            '- takeaway',
            'Do not output commentary, JSON, code fences, or meta-explanations.',
        ]),
    ].join('\n\n')
}

export function buildChapterRepairPrompt(input: {
    topic: string
    chapterIndex: number
    syllabus: DidacticUnitSyllabus
    markdown: string
}): string {
    const chapter = input.syllabus.chapters[input.chapterIndex]

    return [
        buildSection('Role / Contract', [
            'Convert the chapter markdown into a strict structured chapter object that matches the expected shape.',
        ]),
        buildSection('Current Artifact Target', [
            `Topic: ${input.topic}`,
            `Chapter title: ${chapter.title}`,
            `Chapter overview: ${chapter.overview}`,
            `Chapter key points: ${chapter.keyPoints.join(', ')}`,
        ]),
        buildSection('Source Markdown', [input.markdown]),
        buildSection('Output Contract', [
            'Infer title, overview, lesson content, and key takeaways faithfully from the source markdown.',
        ]),
    ].join('\n\n')
}

export function buildContinuitySummaryPrompt(input: {
    topic: string
    chapterTitle: string
    chapterMarkdown: string
}): string {
    return [
        buildSection('Role / Contract', [
            'Produce an internal continuity summary for future chapter generation.',
            'The output must be compact, factual, and optimized to prevent repetition in later chapters.',
        ]),
        buildSection('Current Artifact Target', [
            `Topic: ${input.topic}`,
            `Chapter title: ${input.chapterTitle}`,
        ]),
        buildSection('Output Contract', [
            'Return a markdown bullet list with at most 10 items.',
            'Capture concepts explicitly taught, definitions introduced, techniques covered, and what can be assumed next.',
            'Do not write full paragraphs.',
        ]),
        buildSection('Source Markdown', [input.chapterMarkdown]),
    ].join('\n\n')
}

export function buildLearnerSummaryPrompt(input: {
    topic: string
    chapterTitle: string
    chapterMarkdown: string
}): string {
    return [
        buildSection('Role / Contract', [
            'Write a concise learner-facing summary for teaching content.',
        ]),
        buildSection('Current Artifact Target', [
            `Topic: ${input.topic}`,
            `Chapter or unit title: ${input.chapterTitle}`,
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
