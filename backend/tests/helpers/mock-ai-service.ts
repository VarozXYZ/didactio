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

function findAnswerValue(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    questionId: string
): string {
    return answers?.find((answer) => answer.questionId === questionId)?.value ?? 'not provided'
}

function syllabusMarkdown(topic: string): string {
    return [
        `# ${topic} Learning Path`,
        '## Overview',
        `A guided syllabus for ${topic}.`,
        '## Learning Goals',
        '- Build topic confidence',
        '- Practice real decision making',
        '- Ship a working outcome',
        '## Chapters',
        '### 1. Foundations',
        '#### Overview',
        'Learn the core ideas and shared vocabulary.',
        '#### Key Points',
        '- Concepts',
        '- Terminology',
        '- Mental model',
        '### 2. Workflow',
        '#### Overview',
        'Move through a practical workflow.',
        '#### Key Points',
        '- Setup',
        '- Execution',
        '- Iteration',
        '### 3. Application',
        '#### Overview',
        'Apply the topic in realistic scenarios.',
        '#### Key Points',
        '- Tradeoffs',
        '- Examples',
        '- Next steps',
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
            }
        },
        async streamModeration(input, callbacks): Promise<ModerationResult> {
            await callbacks.onStart?.({ provider, model, modelId: `${provider}/${model}` })
            await callbacks.onPartial?.({
                approved: true,
                notes: 'Approved.',
                normalizedTopic: input.topic.trim(),
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
                markdown: syllabusMarkdown(input.topic),
                syllabus: {
                    title: `${input.topic} Learning Path`,
                    overview: `A guided syllabus for ${input.topic}.`,
                    learningGoals: [
                        'Build topic confidence',
                        'Practice real decision making',
                        'Ship a working outcome',
                    ],
                    chapters: [
                        {
                            title: 'Foundations',
                            overview: 'Learn the core ideas and shared vocabulary.',
                            keyPoints: ['Concepts', 'Terminology', 'Mental model'],
                        },
                        {
                            title: 'Workflow',
                            overview: 'Move through a practical workflow.',
                            keyPoints: ['Setup', 'Execution', 'Iteration'],
                        },
                        {
                            title: 'Application',
                            overview: 'Apply the topic in realistic scenarios.',
                            keyPoints: ['Tradeoffs', 'Examples', 'Next steps'],
                        },
                    ],
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
                markdown: '## Recap\nA short recap.\n\n## What To Practice\n- Practice one\n- Practice two',
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
                chapterTitle: input.chapterTitle,
                chapterOverview: input.chapterOverview,
                answers: input.questionnaireAnswers,
            })

            return {
                provider,
                model,
                prompt: `Chapter ${input.chapterTitle}`,
                markdown,
                chapter: {
                    chapterIndex: input.chapterIndex,
                    title: input.chapterTitle,
                    overview: input.chapterOverview,
                    content: [
                        `This chapter explores ${input.chapterTitle} in the context of ${input.topic}.`,
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
