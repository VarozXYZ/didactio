import { createGateway, generateObject, streamObject, streamText } from 'ai'
import { z } from 'zod'
import { getAppEnv } from '../config/env.js'
import type { DidacticUnitGeneratedChapter } from '../didactic-unit/didactic-unit-chapter.js'
import type {
    DidacticUnitQuestionAnswer,
    DidacticUnitQuestionnaire,
    DidacticUnitQuestion,
    DidacticUnitQuestionOption,
    DidacticUnitSyllabus,
} from '../didactic-unit/planning.js'
import type { AiConfig, AiStage, AiStageConfig } from './config.js'
import { resolveGatewayModelId } from './config.js'
import { parseChapterMarkdown, parseSyllabusMarkdown } from './markdown-parsers.js'

export class AiGatewayConfigurationError extends Error {}

interface ModelSelection {
    provider: string
    model: string
    modelId: string
}

interface BaseStageResult {
    provider: string
    model: string
    prompt: string
}

export interface ModerationResult extends BaseStageResult {
    approved: boolean
    notes: string
    normalizedTopic: string
}

export interface QuestionnaireResult extends BaseStageResult {
    questionnaire: DidacticUnitQuestionnaire
}

export interface SyllabusResult extends BaseStageResult {
    markdown: string
    syllabus: DidacticUnitSyllabus
}

export interface SummaryResult extends BaseStageResult {
    markdown: string
}

export interface ChapterResult extends BaseStageResult {
    markdown: string
    chapter: DidacticUnitGeneratedChapter
}

export interface MarkdownStreamCallbacks<T> {
    onStart?: (selection: ModelSelection) => Promise<void> | void
    onMarkdown?: (delta: string, markdown: string) => Promise<void> | void
    onComplete?: (result: T) => Promise<void> | void
}

export interface StructuredStreamCallbacks<T> {
    onStart?: (selection: ModelSelection) => Promise<void> | void
    onPartial?: (partial: Partial<T>) => Promise<void> | void
    onComplete?: (result: T) => Promise<void> | void
}

export interface AiService {
    moderateTopic(input: {
        topic: string
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<ModerationResult>
    streamModeration(
        input: { topic: string; config: AiConfig; abortSignal?: AbortSignal },
        callbacks: StructuredStreamCallbacks<ModerationResult>
    ): Promise<ModerationResult>
    generateQuestionnaire(input: {
        topic: string
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<QuestionnaireResult>
    streamQuestionnaire(
        input: { topic: string; config: AiConfig; abortSignal?: AbortSignal },
        callbacks: StructuredStreamCallbacks<QuestionnaireResult>
    ): Promise<QuestionnaireResult>
    generateSyllabus(input: {
        topic: string
        syllabusPrompt: string
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<SyllabusResult>
    streamSyllabus(
        input: {
            topic: string
            syllabusPrompt: string
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            config: AiConfig
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<SyllabusResult>
    ): Promise<SyllabusResult>
    generateSummary(input: {
        topic: string
        chapterTitle: string
        chapterMarkdown: string
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<SummaryResult>
    streamSummary(
        input: {
            topic: string
            chapterTitle: string
            chapterMarkdown: string
            config: AiConfig
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<SummaryResult>
    ): Promise<SummaryResult>
    generateChapter(input: {
        topic: string
        chapterIndex: number
        chapterTitle: string
        chapterOverview: string
        chapterKeyPoints: string[]
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<ChapterResult>
    streamChapter(
        input: {
            topic: string
            chapterIndex: number
            chapterTitle: string
            chapterOverview: string
            chapterKeyPoints: string[]
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            config: AiConfig
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<ChapterResult>
    ): Promise<ChapterResult>
}

function findAnswerValue(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    questionId: string
): string {
    return answers?.find((answer) => answer.questionId === questionId)?.value ?? 'not provided'
}

function buildGatewaySystemPrompt(stage: AiStage): string {
    switch (stage) {
        case 'moderation':
            return 'You validate requested learning topics for a didactic-unit generator. Be concise, practical, and strict about malformed or unsafe requests.'
        case 'questionnaire':
            return 'You create short, learner-focused planning questionnaires for didactic units. Return only the structured questionnaire.'
        case 'syllabus':
            return 'You create clear didactic syllabi as clean markdown following the requested structure exactly.'
        case 'summary':
            return 'You write concise markdown summaries for generated teaching content. Use direct, readable language.'
        case 'chapter':
            return 'You write polished didactic lesson chapters as markdown following the requested structure exactly.'
    }
}

function buildQuestionnaireSchema() {
    return z.object({
        questions: z
            .array(
                z.object({
                    id: z.string().min(1),
                    prompt: z.string().min(1),
                    type: z.string().min(1),
                    options: z
                        .array(
                            z.object({
                                value: z.string().min(1),
                                label: z.string().min(1),
                            })
                        )
                        .nullish(),
                })
            )
            .min(1),
    })
}

function normalizeQuestionType(rawType: string): DidacticUnitQuestion['type'] {
    const normalized = rawType.trim().toLowerCase().replace(/[\s-]+/g, '_')

    if (
        normalized === 'single_select' ||
        normalized === 'single' ||
        normalized === 'select'
    ) {
        return 'single_select'
    }

    if (
        normalized === 'long_text' ||
        normalized === 'text' ||
        normalized === 'free_text' ||
        normalized === 'open_text'
    ) {
        return 'long_text'
    }

    throw new Error(`Unsupported questionnaire question type "${rawType}".`)
}

function normalizeQuestionOptions(
    options: Array<{ value: string; label: string }> | null | undefined
): DidacticUnitQuestionOption[] | undefined {
    if (!options || options.length === 0) {
        return undefined
    }

    const normalizedOptions = options
        .map((option) => ({
            value: option.value.trim(),
            label: option.label.trim(),
        }))
        .filter((option) => option.value && option.label)

    return normalizedOptions.length > 0 ? normalizedOptions : undefined
}

function normalizeQuestionnaire(questionnaire: {
    questions: Array<{
        id: string
        prompt: string
        type: string
        options?: Array<{ value: string; label: string }> | null
    }>
}): DidacticUnitQuestionnaire {
    const normalizedQuestions = questionnaire.questions.map((question) => {
        const normalizedType = normalizeQuestionType(question.type)
        const normalizedOptions = normalizeQuestionOptions(question.options)

        return {
            id: question.id.trim(),
            prompt: question.prompt.trim(),
            type: normalizedType,
            options: normalizedType === 'single_select' ? normalizedOptions : undefined,
        }
    })

    if (normalizedQuestions.length !== 5) {
        throw new Error(
            `Questionnaire generation returned ${normalizedQuestions.length} questions; expected exactly 5.`
        )
    }

    const ids = normalizedQuestions.map((question) => question.id)
    const uniqueIds = new Set(ids)

    if (uniqueIds.size !== ids.length) {
        throw new Error('Questionnaire generation returned duplicate question ids.')
    }

    for (const question of normalizedQuestions) {
        if (question.type === 'single_select' && (!question.options || question.options.length < 2)) {
            throw new Error(
                `Question "${question.id}" must include at least 2 options for single_select.`
            )
        }
    }

    return {
        questions: normalizedQuestions,
    }
}

function buildModerationSchema() {
    return z.object({
        approved: z.boolean(),
        notes: z.string().min(1),
        normalizedTopic: z.string().min(1),
    })
}

function questionnairePrompt(topic: string): string {
    return [
        `Create a learner questionnaire for a didactic unit about "${topic}".`,
        'Requirements:',
        '- Always return exactly 5 questions.',
        '- Use these exact ids in this exact order: topic_knowledge_level, related_knowledge_level, learning_goal, preferred_depth, preferred_length.',
        '- Cover current topic knowledge, related knowledge, learning goal, preferred depth, and preferred length.',
        '- Use single_select for fixed choices and long_text for open responses.',
        '- Include 3-4 helpful options for each single_select question.',
        '- Do not include options for long_text questions.',
        '- Keep prompts concise and learner-facing.',
    ].join('\n')
}

function moderationPrompt(topic: string): string {
    return [
        `Review this requested didactic unit topic: "${topic}".`,
        'Approve ordinary educational topics and normalize the wording when helpful.',
        'Reject only if the topic is empty, incoherent, or clearly unsafe for an educational content generator.',
        'Always explain the decision briefly.',
    ].join('\n')
}

function syllabusPromptToMarkdownPrompt(input: {
    topic: string
    syllabusPrompt: string
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
}): string {
    const topicKnowledge = findAnswerValue(
        input.questionnaireAnswers,
        'topic_knowledge_level'
    )
    const relatedKnowledge = findAnswerValue(
        input.questionnaireAnswers,
        'related_knowledge_level'
    )
    const learningGoal = findAnswerValue(input.questionnaireAnswers, 'learning_goal')
    const preferredDepth = findAnswerValue(input.questionnaireAnswers, 'preferred_depth')
    const preferredLength = findAnswerValue(input.questionnaireAnswers, 'preferred_length')

    return [
        `Create a didactic syllabus in markdown for "${input.topic}".`,
        'Follow this structure exactly:',
        '# <Syllabus Title>',
        '## Overview',
        '<one compact paragraph>',
        '## Learning Goals',
        '- goal 1',
        '- goal 2',
        '- goal 3',
        '## Chapters',
        '### 1. <Chapter Title>',
        '#### Overview',
        '<one compact paragraph>',
        '#### Key Points',
        '- point 1',
        '- point 2',
        '- point 3',
        'Repeat the chapter structure for at least 3 chapters.',
        '',
        'Learner profile:',
        `- Topic knowledge: ${topicKnowledge}`,
        `- Related knowledge: ${relatedKnowledge}`,
        `- Learning goal: ${learningGoal}`,
        `- Preferred depth: ${preferredDepth}`,
        `- Preferred length: ${preferredLength}`,
        '',
        'Planning prompt:',
        input.syllabusPrompt,
    ].join('\n')
}

function chapterPrompt(input: {
    topic: string
    chapterTitle: string
    chapterOverview: string
    chapterKeyPoints: string[]
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
}): string {
    const topicKnowledge = findAnswerValue(
        input.questionnaireAnswers,
        'topic_knowledge_level'
    )
    const relatedKnowledge = findAnswerValue(
        input.questionnaireAnswers,
        'related_knowledge_level'
    )
    const learningGoal = findAnswerValue(input.questionnaireAnswers, 'learning_goal')
    const preferredDepth = findAnswerValue(input.questionnaireAnswers, 'preferred_depth')

    return [
        `Write a didactic chapter in markdown for "${input.topic}".`,
        'Follow this structure exactly:',
        `# ${input.chapterTitle}`,
        '## Overview',
        '<one compact paragraph>',
        '## Lesson',
        '<markdown lesson body with headings, paragraphs, and lists as needed>',
        '## Key Takeaways',
        '- takeaway 1',
        '- takeaway 2',
        '- takeaway 3',
        '',
        `Chapter overview: ${input.chapterOverview}`,
        `Chapter key points: ${input.chapterKeyPoints.join(', ')}`,
        `Learner topic knowledge: ${topicKnowledge}`,
        `Learner related knowledge: ${relatedKnowledge}`,
        `Learner goal: ${learningGoal}`,
        `Preferred depth: ${preferredDepth}`,
        'Keep the markdown clean and readable.',
    ].join('\n')
}

function summaryPrompt(input: {
    topic: string
    chapterTitle: string
    chapterMarkdown: string
}): string {
    return [
        `Write a concise markdown summary for a didactic chapter about "${input.topic}".`,
        `Chapter title: ${input.chapterTitle}`,
        'Return 2 short sections:',
        '## Recap',
        '<short paragraph>',
        '## What To Practice',
        '- item 1',
        '- item 2',
        '',
        'Chapter markdown:',
        input.chapterMarkdown,
    ].join('\n')
}

export class GatewayAiService implements AiService {
    private readonly gateway

    constructor() {
        const env = getAppEnv()

        if (!env.aiGatewayApiKey?.trim()) {
            throw new AiGatewayConfigurationError(
                'AI_GATEWAY_API_KEY must be configured before using AI generation.'
            )
        }

        this.gateway = createGateway({
            apiKey: env.aiGatewayApiKey,
            baseURL: env.aiGatewayBaseUrl,
        })
    }

    private selectModel(stage: AiStage, config: AiConfig): ModelSelection {
        const stageConfig = config[stage]
        const normalized = this.requireStageConfig(stage, stageConfig)
        return {
            provider: normalized.provider,
            model: normalized.model,
            modelId: resolveGatewayModelId(normalized),
        }
    }

    private requireStageConfig(stage: AiStage, config: AiStageConfig | undefined): AiStageConfig {
        if (!config?.provider?.trim() || !config.model?.trim()) {
            throw new AiGatewayConfigurationError(
                `AI config for ${stage} must include non-empty provider and model values.`
            )
        }

        return {
            provider: config.provider.trim(),
            model: config.model.trim(),
        }
    }

    async moderateTopic(input: {
        topic: string
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<ModerationResult> {
        const selection = this.selectModel('moderation', input.config)
        const prompt = moderationPrompt(input.topic)
        const result = await generateObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('moderation'),
            prompt,
            schema: buildModerationSchema(),
            abortSignal: input.abortSignal,
        })

        return {
            provider: selection.provider,
            model: selection.model,
            prompt,
            approved: result.object.approved,
            notes: result.object.notes,
            normalizedTopic: result.object.normalizedTopic,
        }
    }

    async streamModeration(
        input: { topic: string; config: AiConfig; abortSignal?: AbortSignal },
        callbacks: StructuredStreamCallbacks<ModerationResult>
    ): Promise<ModerationResult> {
        const selection = this.selectModel('moderation', input.config)
        const prompt = moderationPrompt(input.topic)

        await callbacks.onStart?.(selection)

        const result = streamObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('moderation'),
            prompt,
            schema: buildModerationSchema(),
            abortSignal: input.abortSignal,
        })

        for await (const partial of result.partialObjectStream) {
            await callbacks.onPartial?.({
                provider: selection.provider,
                model: selection.model,
                prompt,
                approved: partial.approved,
                notes: partial.notes,
                normalizedTopic: partial.normalizedTopic,
            })
        }

        const object = await result.object
        const finalResult: ModerationResult = {
            provider: selection.provider,
            model: selection.model,
            prompt,
            approved: object.approved,
            notes: object.notes,
            normalizedTopic: object.normalizedTopic,
        }
        await callbacks.onComplete?.(finalResult)
        return finalResult
    }

    async generateQuestionnaire(input: {
        topic: string
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<QuestionnaireResult> {
        const selection = this.selectModel('questionnaire', input.config)
        const prompt = questionnairePrompt(input.topic)
        const result = await generateObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('questionnaire'),
            prompt,
            schema: buildQuestionnaireSchema(),
            abortSignal: input.abortSignal,
        })

        return {
            provider: selection.provider,
            model: selection.model,
            prompt,
            questionnaire: normalizeQuestionnaire(result.object),
        }
    }

    async streamQuestionnaire(
        input: { topic: string; config: AiConfig; abortSignal?: AbortSignal },
        callbacks: StructuredStreamCallbacks<QuestionnaireResult>
    ): Promise<QuestionnaireResult> {
        const selection = this.selectModel('questionnaire', input.config)
        const prompt = questionnairePrompt(input.topic)

        await callbacks.onStart?.(selection)

        const result = streamObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('questionnaire'),
            prompt,
            schema: buildQuestionnaireSchema(),
            abortSignal: input.abortSignal,
        })

        for await (const partial of result.partialObjectStream) {
            await callbacks.onPartial?.({
                provider: selection.provider,
                model: selection.model,
                prompt,
                questionnaire: partial as DidacticUnitQuestionnaire,
            })
        }

        const object = await result.object
        const finalResult: QuestionnaireResult = {
            provider: selection.provider,
            model: selection.model,
            prompt,
            questionnaire: normalizeQuestionnaire(object),
        }
        await callbacks.onComplete?.(finalResult)
        return finalResult
    }
    async generateSyllabus(input: {
        topic: string
        syllabusPrompt: string
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<SyllabusResult> {
        return this.streamSyllabus(input, {})
    }

    async streamSyllabus(
        input: {
            topic: string
            syllabusPrompt: string
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            config: AiConfig
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<SyllabusResult>
    ): Promise<SyllabusResult> {
        const selection = this.selectModel('syllabus', input.config)
        const prompt = syllabusPromptToMarkdownPrompt(input)
        let markdown = ''

        await callbacks.onStart?.(selection)

        const result = streamText({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('syllabus'),
            prompt,
            abortSignal: input.abortSignal,
            onChunk: async ({ chunk }) => {
                if (chunk.type !== 'text-delta') {
                    return
                }

                markdown += chunk.text
                await callbacks.onMarkdown?.(chunk.text, markdown)
            },
        })

        const finalMarkdown = await result.text
        const syllabus = parseSyllabusMarkdown(finalMarkdown)
        const finalResult: SyllabusResult = {
            provider: selection.provider,
            model: selection.model,
            prompt,
            markdown: finalMarkdown,
            syllabus,
        }

        await callbacks.onComplete?.(finalResult)
        return finalResult
    }

    async generateSummary(input: {
        topic: string
        chapterTitle: string
        chapterMarkdown: string
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<SummaryResult> {
        return this.streamSummary(input, {})
    }

    async streamSummary(
        input: {
            topic: string
            chapterTitle: string
            chapterMarkdown: string
            config: AiConfig
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<SummaryResult>
    ): Promise<SummaryResult> {
        const selection = this.selectModel('summary', input.config)
        const prompt = summaryPrompt(input)
        let markdown = ''

        await callbacks.onStart?.(selection)

        const result = streamText({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('summary'),
            prompt,
            abortSignal: input.abortSignal,
            onChunk: async ({ chunk }) => {
                if (chunk.type !== 'text-delta') {
                    return
                }

                markdown += chunk.text
                await callbacks.onMarkdown?.(chunk.text, markdown)
            },
        })

        const finalMarkdown = await result.text
        const finalResult: SummaryResult = {
            provider: selection.provider,
            model: selection.model,
            prompt,
            markdown: finalMarkdown,
        }
        await callbacks.onComplete?.(finalResult)
        return finalResult
    }

    async generateChapter(input: {
        topic: string
        chapterIndex: number
        chapterTitle: string
        chapterOverview: string
        chapterKeyPoints: string[]
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<ChapterResult> {
        return this.streamChapter(input, {})
    }

    async streamChapter(
        input: {
            topic: string
            chapterIndex: number
            chapterTitle: string
            chapterOverview: string
            chapterKeyPoints: string[]
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            config: AiConfig
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<ChapterResult>
    ): Promise<ChapterResult> {
        const selection = this.selectModel('chapter', input.config)
        const prompt = chapterPrompt(input)
        let markdown = ''

        await callbacks.onStart?.(selection)

        const result = streamText({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('chapter'),
            prompt,
            abortSignal: input.abortSignal,
            onChunk: async ({ chunk }) => {
                if (chunk.type !== 'text-delta') {
                    return
                }

                markdown += chunk.text
                await callbacks.onMarkdown?.(chunk.text, markdown)
            },
        })

        const finalMarkdown = await result.text
        const parsedChapter = parseChapterMarkdown(finalMarkdown, input.chapterIndex)
        const finalResult: ChapterResult = {
            provider: selection.provider,
            model: selection.model,
            prompt,
            markdown: finalMarkdown,
            chapter: {
                chapterIndex: input.chapterIndex,
                title: parsedChapter.title,
                overview: parsedChapter.overview,
                content: parsedChapter.content,
                keyTakeaways: parsedChapter.keyTakeaways,
                generatedAt: new Date().toISOString(),
            },
        }

        await callbacks.onComplete?.(finalResult)
        return finalResult
    }
}
