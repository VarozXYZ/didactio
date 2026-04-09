import type {
    AiService,
    ChapterResult,
    FolderClassificationResult,
    MarkdownStreamCallbacks,
    ModerationResult,
    QuestionnaireResult,
    StructuredStreamCallbacks,
    SummaryResult,
    SyllabusResult,
} from '../../src/ai/service.js'
import {
    buildQuestionnaireForDidacticUnit,
    type DidacticUnitQuestionAnswer,
} from '../../src/didactic-unit/planning.js'
import { resolveTargetChapterCount } from '../../src/ai/prompt-builders.js'

function findAnswerValue(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    questionId: string
): string {
    return answers?.find((answer) => answer.questionId === questionId)?.value ?? 'not provided'
}

function referenceSyllabusForLength(
    topic: string,
    length: 'intro' | 'short' | 'long' | 'textbook'
) {
    const targetModuleCount = resolveTargetChapterCount(length)

    return {
        topic,
        title: `${topic} Learning Path`,
        description: `A guided syllabus for ${topic}.`,
        keywords: 'foundations, workflow, application',
        modules: Array.from({ length: targetModuleCount }, (_, index) => {
            const moduleNumber = index + 1
            const moduleTitle =
                index === 0
                    ? 'Foundations'
                    : index === targetModuleCount - 1
                      ? 'Application'
                      : `Workflow ${moduleNumber - 1}`

            return {
                title: moduleTitle,
                overview:
                    index === 0
                        ? 'Learn the core ideas and shared vocabulary.'
                        : index === targetModuleCount - 1
                          ? 'Apply the topic in realistic scenarios.'
                          : `Move through workflow stage ${moduleNumber - 1}.`,
                lessons: [
                    {
                        title: 'Guided lesson',
                        contentOutline: ['Explain the main concept', 'Apply it in context'],
                    },
                    {
                        title: 'Practice lesson',
                        contentOutline: ['Reinforce the concept', 'Reflect on the outcome'],
                    },
                ],
            }
        }),
    }
}

function chapterMarkdown(input: {
    topic: string
    chapterTitle: string
    chapterOverview: string
    answers?: DidacticUnitQuestionAnswer[]
}): string {
    const learningGoal = findAnswerValue(input.answers, 'learning_goal')

    return [
        '## Core Ideas',
        `This module explores ${input.chapterTitle} in the context of ${input.topic}.`,
        `It keeps the learner goal in view: ${learningGoal}.`,
        'Use the concepts, examples, and checkpoints to build confidence progressively.',
        '## Practice in context',
        `Work through a realistic example related to ${input.chapterOverview.toLowerCase()}.`,
        '## Why it works',
        'Connect each step back to the underlying principles so the learner can transfer the skill.',
    ].join('\n')
}

function classifyFolderName(topic: string, availableFolderNames: string[]): string {
    const normalizedTopic = topic.toLowerCase()
    const keywordMatchers: Array<{ folderName: string; keywords: string[] }> = [
        { folderName: 'Computer Science', keywords: ['javascript', 'typescript', 'react', 'next.js', 'python', 'programming', 'software'] },
        { folderName: 'Physics', keywords: ['quantum', 'computing'] },
        { folderName: 'Mathematics', keywords: ['math', 'algebra', 'calculus', 'statistics'] },
        { folderName: 'Biology', keywords: ['biology', 'cell', 'genetics'] },
        { folderName: 'History', keywords: ['history', 'war', 'ancient', 'civilization'] },
        { folderName: 'Literature', keywords: ['literature', 'english', 'writing', 'shakespeare'] },
        { folderName: 'Physics', keywords: ['physics', 'thermodynamics', 'mechanics'] },
        { folderName: 'Chemistry', keywords: ['chemistry', 'chemical'] },
        { folderName: 'Geography', keywords: ['geography', 'earth', 'climate'] },
    ]

    const matchedFolderName =
        keywordMatchers.find(({ keywords }) =>
            keywords.some((keyword) => normalizedTopic.includes(keyword))
        )?.folderName ?? 'General'

    return availableFolderNames.includes(matchedFolderName) ? matchedFolderName : 'General'
}

export function createMockAiService(): AiService {
    const provider = 'mock-provider'
    const model = 'mock-model'

    return {
        async classifyFolder(input): Promise<FolderClassificationResult> {
            const folderName = classifyFolderName(
                input.topic,
                input.folders.map((folder) => folder.name)
            )

            return {
                provider,
                model,
                prompt: `Classify folder for ${input.topic}`,
                folderName,
                reasoning: `Matched ${folderName} from the provided folder list.`,
            }
        },
        async moderateTopic(input): Promise<ModerationResult> {
            const folderName = input.folders
                ? classifyFolderName(
                      input.topic,
                      input.folders.map((folder) => folder.name)
                  )
                : undefined

            return {
                provider,
                model,
                prompt: `Moderate ${input.topic}`,
                approved: true,
                notes: 'Approved.',
                normalizedTopic: input.topic.trim(),
                improvedTopicBrief: `Create a practical didactic unit about ${input.topic.trim()} with clear progression from fundamentals to real application.`,
                reasoningNotes: 'Topic is safe, coherent, and appropriate for educational generation.',
                folderName,
                folderReasoning: folderName
                    ? `Matched ${folderName} from the provided folder list.`
                    : undefined,
            }
        },
        async streamModeration(input, callbacks): Promise<ModerationResult> {
            const folderName = input.folders
                ? classifyFolderName(
                      input.topic,
                      input.folders.map((folder) => folder.name)
                  )
                : undefined

            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            await callbacks.onPartial?.({
                approved: true,
                notes: 'Approved.',
                normalizedTopic: input.topic.trim(),
                improvedTopicBrief: `Create a practical didactic unit about ${input.topic.trim()} with clear progression from fundamentals to real application.`,
                reasoningNotes: 'Topic is safe, coherent, and appropriate for educational generation.',
                folderName,
                folderReasoning: folderName
                    ? `Matched ${folderName} from the provided folder list.`
                    : undefined,
            })
            const result = await this.moderateTopic(input)
            await callbacks.onComplete?.(result)
            return result
        },
        async generateQuestionnaire(input): Promise<QuestionnaireResult> {
            return {
                provider,
                model,
                prompt: `Questionnaire ${input.topic}`,
                questionnaire: buildQuestionnaireForDidacticUnit(input.topic),
            }
        },
        async streamQuestionnaire(input, callbacks): Promise<QuestionnaireResult> {
            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            const result = await this.generateQuestionnaire(input)
            await callbacks.onPartial?.({ questionnaire: result.questionnaire })
            await callbacks.onComplete?.(result)
            return result
        },
        async generateSyllabus(input): Promise<SyllabusResult> {
            return {
                provider,
                model,
                prompt: input.syllabusPrompt,
                syllabus: referenceSyllabusForLength(input.topic, input.length),
            }
        },
        async streamSyllabus(input, callbacks): Promise<SyllabusResult> {
            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            const result = await this.generateSyllabus(input)
            await callbacks.onPartial?.({ syllabus: result.syllabus })
            await callbacks.onComplete?.(result)
            return result
        },
        async generateSummary(input): Promise<SummaryResult> {
            return {
                provider,
                model,
                prompt: `Summary ${input.chapterTitle}`,
                markdown:
                    input.kind === 'continuity'
                        ? '- Concepts introduced\n- Workflow explained\n- Safe to assume the learner knows the basics'
                        : '## Recap\nA short recap.\n\n## What To Practice\n- Practice one\n- Practice two',
            }
        },
        async streamSummary(input, callbacks): Promise<SummaryResult> {
            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            const result = await this.generateSummary(input)
            await callbacks.onMarkdown?.(result.markdown, result.markdown)
            await callbacks.onComplete?.(result)
            return result
        },
        async generateChapter(input): Promise<ChapterResult> {
            const markdown = chapterMarkdown({
                topic: input.topic,
                chapterTitle: input.syllabus.modules[input.chapterIndex].title,
                chapterOverview: input.syllabus.modules[input.chapterIndex].overview,
                answers: input.questionnaireAnswers,
            })
            const chapter = input.syllabus.modules[input.chapterIndex]

            return {
                provider,
                model,
                prompt: `Chapter ${chapter.title}`,
                markdown,
                continuitySummary:
                    '- Concepts introduced\n- Workflow explained\n- Safe to assume the learner knows the basics',
                chapter: {
                    chapterIndex: input.chapterIndex,
                    title: chapter.title,
                    markdown,
                    generatedAt: new Date().toISOString(),
                },
            }
        },
        async streamChapter(
            input,
            callbacks: MarkdownStreamCallbacks<ChapterResult>
        ): Promise<ChapterResult> {
            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            const result = await this.generateChapter(input)
            await callbacks.onMarkdown?.(result.markdown, result.markdown)
            await callbacks.onComplete?.(result)
            return result
        },
    }
}
