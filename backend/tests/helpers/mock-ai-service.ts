import type {
    AiService,
    ChapterResult,
    MarkdownStreamCallbacks,
    ModerationResult,
    QuestionnaireResult,
    StructuredStreamCallbacks,
    SummaryResult,
    SyllabusResult,
} from '../../src/ai/service.js'
import { buildQuestionnaireForDidacticUnit, type DidacticUnitQuestionAnswer } from '../../src/didactic-unit/planning.js'
import { resolveTargetChapterCount } from '../../src/ai/prompt-builders.js'

function findAnswerValue(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    questionId: string
): string {
    return answers?.find((answer) => answer.questionId === questionId)?.value ?? 'not provided'
}

function syllabusMarkdownForLength(
    topic: string,
    length: 'intro' | 'short' | 'long' | 'textbook'
): string {
    const targetChapterCount = resolveTargetChapterCount(length)
    const chapterBlocks = Array.from({ length: targetChapterCount }, (_, index) => {
        const chapterNumber = index + 1
        const chapterTitle =
            index === 0
                ? 'Foundations'
                : index === targetChapterCount - 1
                  ? 'Application'
                  : `Workflow ${chapterNumber - 1}`

        return [
            `### ${chapterNumber}. ${chapterTitle}`,
            '#### Overview',
            `Learn the core ideas for ${chapterTitle.toLowerCase()}.`,
            '#### Estimated Duration',
            '60',
            '#### Key Points',
            '- Concepts',
            '- Practice',
            '- Application',
            '#### Lessons',
            '##### 1. Guided lesson',
            '- Explain the main concept',
            '- Apply it in context',
            '##### 2. Practice lesson',
            '- Reinforce the concept',
            '- Reflect on the outcome',
        ].join('\n')
    })

    return [
        `# ${topic} Learning Path`,
        '## Overview',
        `A guided syllabus for ${topic}.`,
        '## Learning Goals',
        '- Build topic confidence',
        '- Practice real decision making',
        '- Ship a working outcome',
        '## Keywords',
        '- foundations',
        '- workflow',
        '- application',
        '## Estimated Duration',
        `${targetChapterCount * 60}`,
        '## Chapters',
        ...chapterBlocks,
    ].join('\n')
}

function chapterMarkdown(input: {
    topic: string
    chapterTitle: string
    chapterOverview: string
    answers?: DidacticUnitQuestionAnswer[]
}): string {
    const learningGoal = findAnswerValue(input.answers, 'learning_goal')

    return [
        `# ${input.chapterTitle}`,
        '## Overview',
        input.chapterOverview,
        '## Lesson',
        `This chapter explores ${input.chapterTitle} in the context of ${input.topic}.`,
        `It keeps the learner goal in view: ${learningGoal}.`,
        'Use the concepts, examples, and checkpoints to build confidence progressively.',
        '## Key Takeaways',
        '- Understand the core scope of the chapter',
        '- Connect the topic to the learner goal',
        '- Practice the main ideas deliberately',
    ].join('\n')
}

export function createMockAiService(): AiService {
    const provider = 'mock-provider'
    const model = 'mock-model'

    return {
        async moderateTopic(input): Promise<ModerationResult> {
            return {
                provider,
                model,
                prompt: `Moderate ${input.topic}`,
                approved: true,
                notes: 'Approved.',
                normalizedTopic: input.topic.trim(),
                improvedTopicBrief: `Create a practical didactic unit about ${input.topic.trim()} with clear progression from fundamentals to real application.`,
                reasoningNotes: 'Topic is safe, coherent, and appropriate for educational generation.',
            }
        },
        async streamModeration(input, callbacks): Promise<ModerationResult> {
            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            await callbacks.onPartial?.({
                approved: true,
                notes: 'Approved.',
                normalizedTopic: input.topic.trim(),
                improvedTopicBrief: `Create a practical didactic unit about ${input.topic.trim()} with clear progression from fundamentals to real application.`,
                reasoningNotes: 'Topic is safe, coherent, and appropriate for educational generation.',
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
            const targetChapterCount = resolveTargetChapterCount(input.length)
            const chapters = Array.from({ length: targetChapterCount }, (_, index) => {
                const chapterNumber = index + 1
                return {
                    title:
                        index === 0
                            ? 'Foundations'
                            : index === targetChapterCount - 1
                              ? 'Application'
                              : `Workflow ${chapterNumber - 1}`,
                    overview:
                        index === 0
                            ? 'Learn the core ideas and shared vocabulary.'
                            : index === targetChapterCount - 1
                              ? 'Apply the topic in realistic scenarios.'
                              : `Move through workflow stage ${chapterNumber - 1}.`,
                    keyPoints: ['Concepts', 'Practice', 'Application'],
                    estimatedDurationMinutes: 60,
                    lessons: [
                        {
                            title: 'Guided lesson',
                            contentOutline: [
                                'Explain the main concept',
                                'Apply it in context',
                            ],
                        },
                        {
                            title: 'Practice lesson',
                            contentOutline: [
                                'Reinforce the concept',
                                'Reflect on the outcome',
                            ],
                        },
                    ],
                }
            })

            return {
                provider,
                model,
                prompt: input.syllabusPrompt,
                markdown: syllabusMarkdownForLength(input.topic, input.length),
                syllabus: {
                    title: `${input.topic} Learning Path`,
                    overview: `A guided syllabus for ${input.topic}.`,
                    learningGoals: [
                        'Build topic confidence',
                        'Practice real decision making',
                        'Ship a working outcome',
                    ],
                    keywords: ['foundations', 'workflow', 'application'],
                    estimatedDurationMinutes: targetChapterCount * 60,
                    chapters,
                },
            }
        },
        async streamSyllabus(input, callbacks): Promise<SyllabusResult> {
            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            const result = await this.generateSyllabus(input)
            await callbacks.onMarkdown?.(result.markdown, result.markdown)
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
                chapterTitle: input.syllabus.chapters[input.chapterIndex].title,
                chapterOverview: input.syllabus.chapters[input.chapterIndex].overview,
                answers: input.questionnaireAnswers,
            })
            const chapter = input.syllabus.chapters[input.chapterIndex]

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
                    overview: chapter.overview,
                    content: [
                        `This chapter explores ${chapter.title} in the context of ${input.topic}.`,
                        `It keeps the learner goal in view: ${findAnswerValue(input.questionnaireAnswers, 'learning_goal')}.`,
                        'Use the concepts, examples, and checkpoints to build confidence progressively.',
                    ].join(' '),
                    keyTakeaways: [
                        'Understand the core scope of the chapter',
                        'Connect the topic to the learner goal',
                        'Practice the main ideas deliberately',
                    ],
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
