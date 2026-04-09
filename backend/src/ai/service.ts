import { createGateway, generateObject, streamObject, streamText } from 'ai'
import { z } from 'zod'
import { getAppEnv } from '../config/env.js'
import type { DidacticUnitGeneratedChapter } from '../didactic-unit/didactic-unit-chapter.js'
import type {
    DidacticUnitDepth,
    DidacticUnitLength,
    DidacticUnitLevel,
    DidacticUnitQuestion,
    DidacticUnitQuestionAnswer,
    DidacticUnitQuestionnaire,
    DidacticUnitQuestionOption,
    DidacticUnitReferenceSyllabus,
} from '../didactic-unit/planning.js'
import type { AiConfig, AiModelConfig, AiModelTier } from './config.js'
import { resolveGatewayModelId } from './config.js'
import {
    buildFolderClassificationPrompt,
    buildChapterMarkdownPrompt,
    buildContinuitySummaryPrompt,
    buildGatewaySystemPrompt,
    buildLearnerSummaryPrompt,
    buildModerationPrompt,
    buildQuestionnairePrompt,
    resolveTargetChapterCount,
    buildSyllabusMarkdownPrompt,
} from './prompt-builders.js'
import {
    folderClassificationSchema,
    moderationSchema,
    questionnaireSchema,
    syllabusSchema,
} from './schemas.js'
import { normalizeGeneratedChapterMarkdown } from './markdown-parsers.js'

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
    improvedTopicBrief: string
    reasoningNotes: string
    folderName?: string
    folderReasoning?: string
}

export interface FolderClassificationResult extends BaseStageResult {
    folderName: string
    reasoning: string
}

export interface QuestionnaireResult extends BaseStageResult {
    questionnaire: DidacticUnitQuestionnaire
}

export interface SyllabusResult extends BaseStageResult {
    syllabus: DidacticUnitReferenceSyllabus
}

export interface SummaryResult extends BaseStageResult {
    markdown: string
}

export interface ChapterResult extends BaseStageResult {
    markdown: string
    chapter: DidacticUnitGeneratedChapter
    continuitySummary: string
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
    classifyFolder(input: {
        topic: string
        additionalContext?: string
        folders: Array<{
            name: string
            description: string
        }>
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<FolderClassificationResult>
    moderateTopic(input: {
        topic: string
        level: DidacticUnitLevel
        additionalContext?: string
        folders?: Array<{
            name: string
            description: string
        }>
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<ModerationResult>
    streamModeration(
        input: {
            topic: string
            level: DidacticUnitLevel
            additionalContext?: string
            folders?: Array<{
                name: string
                description: string
            }>
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<ModerationResult>
    ): Promise<ModerationResult>
    generateQuestionnaire(input: {
        topic: string
        level: DidacticUnitLevel
        improvedTopicBrief?: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<QuestionnaireResult>
    streamQuestionnaire(
        input: {
            topic: string
            level: DidacticUnitLevel
            improvedTopicBrief?: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<QuestionnaireResult>
    ): Promise<QuestionnaireResult>
    generateSyllabus(input: {
        topic: string
        level: DidacticUnitLevel
        improvedTopicBrief?: string
        syllabusPrompt: string
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        depth: DidacticUnitDepth
        length: DidacticUnitLength
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<SyllabusResult>
    streamSyllabus(
        input: {
            topic: string
            level: DidacticUnitLevel
            improvedTopicBrief?: string
            syllabusPrompt: string
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            depth: DidacticUnitDepth
            length: DidacticUnitLength
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<SyllabusResult>
    ): Promise<SyllabusResult>
    generateSummary(input: {
        topic: string
        chapterTitle: string
        chapterMarkdown: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
        kind?: 'continuity' | 'learner'
    }): Promise<SummaryResult>
    streamSummary(
        input: {
            topic: string
            chapterTitle: string
            chapterMarkdown: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
            kind?: 'continuity' | 'learner'
        },
        callbacks: MarkdownStreamCallbacks<SummaryResult>
    ): Promise<SummaryResult>
    generateChapter(input: {
        topic: string
        level: DidacticUnitLevel
        syllabus: DidacticUnitReferenceSyllabus
        chapterIndex: number
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        continuitySummaries?: string[]
        depth: DidacticUnitDepth
        length: DidacticUnitLength
        additionalContext?: string
        instruction?: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<ChapterResult>
    streamChapter(
        input: {
            topic: string
            level: DidacticUnitLevel
            syllabus: DidacticUnitReferenceSyllabus
            chapterIndex: number
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            continuitySummaries?: string[]
            depth: DidacticUnitDepth
            length: DidacticUnitLength
            additionalContext?: string
            instruction?: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<ChapterResult>
    ): Promise<ChapterResult>
}

const CONTENT_LENGTH_TOKENS: Record<DidacticUnitLength, number> = {
    intro: 1000,
    short: 6000,
    long: 15000,
    textbook: 32000,
}

function resolveStageMaxOutputTokens(
    stage: 'moderation' | 'questionnaire' | 'syllabus' | 'summary' | 'chapter',
    length?: DidacticUnitLength
): number {
    switch (stage) {
        case 'moderation':
            return 1200
        case 'questionnaire':
            return 1800
        case 'summary':
            return 1000
        case 'syllabus':
        case 'chapter':
            if (!length) {
                throw new Error(`A didactic unit length is required for the ${stage} token budget.`)
            }
            return CONTENT_LENGTH_TOKENS[length]
    }
}

function normalizeQuestionType(rawType: string): DidacticUnitQuestion['type'] {
    const normalized = rawType.trim().toLowerCase().replace(/[\s-]+/g, '_')

    if (normalized === 'single_select' || normalized === 'single' || normalized === 'select') {
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

    if (normalizedQuestions.length !== 3) {
        throw new Error(
            `Questionnaire generation returned ${normalizedQuestions.length} questions; expected exactly 3.`
        )
    }

    const ids = normalizedQuestions.map((question) => question.id)
    if (new Set(ids).size !== ids.length) {
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

function validateReferenceSyllabusLength(
    syllabus: DidacticUnitReferenceSyllabus,
    length: DidacticUnitLength
): DidacticUnitReferenceSyllabus {
    const expectedModuleCount = resolveTargetChapterCount(length)

    if (syllabus.modules.length !== expectedModuleCount) {
        throw new Error(
            `Syllabus generation returned ${syllabus.modules.length} modules; expected exactly ${expectedModuleCount}.`
        )
    }

    return syllabus
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

    private selectModel(tier: AiModelTier, config: AiConfig): ModelSelection {
        const tierConfig = this.requireTierConfig(tier, config[tier])
        return {
            provider: tierConfig.provider,
            model: tierConfig.model,
            modelId: resolveGatewayModelId(tierConfig),
        }
    }

    private requireTierConfig(tier: AiModelTier, config: AiModelConfig | undefined): AiModelConfig {
        if (!config?.provider?.trim() || !config.model?.trim()) {
            throw new AiGatewayConfigurationError(
                `AI config for ${tier} must include non-empty provider and model values.`
            )
        }

        return {
            provider: config.provider.trim(),
            model: config.model.trim(),
        }
    }

    async classifyFolder(input: {
        topic: string
        additionalContext?: string
        folders: Array<{
            name: string
            description: string
        }>
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<FolderClassificationResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildFolderClassificationPrompt({
            topic: input.topic,
            additionalContext: input.additionalContext,
            folders: input.folders,
            authoring: input.config.authoring,
        })

        const result = await generateObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('moderation'),
            prompt,
            schema: folderClassificationSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('moderation'),
            abortSignal: input.abortSignal,
        })

        return {
            provider: selection.provider,
            model: selection.model,
            prompt,
            folderName: result.object.folderName,
            reasoning: result.object.reasoning,
        }
    }

    async moderateTopic(input: {
        topic: string
        level: DidacticUnitLevel
        additionalContext?: string
        folders?: Array<{
            name: string
            description: string
        }>
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<ModerationResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildModerationPrompt({
            topic: input.topic,
            level: input.level,
            additionalContext: input.additionalContext,
            folders: input.folders,
            authoring: input.config.authoring,
        })

        const result = await generateObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('moderation'),
            prompt,
            schema: moderationSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('moderation'),
            abortSignal: input.abortSignal,
        })

        return {
            provider: selection.provider,
            model: selection.model,
            prompt,
            approved: result.object.approved,
            notes: result.object.notes,
            normalizedTopic: result.object.normalizedTopic,
            improvedTopicBrief: result.object.improvedTopicBrief,
            reasoningNotes: result.object.reasoningNotes,
            folderName: result.object.folderName,
            folderReasoning: result.object.folderReasoning,
        }
    }

    async streamModeration(
        input: {
            topic: string
            level: DidacticUnitLevel
            additionalContext?: string
            folders?: Array<{
                name: string
                description: string
            }>
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<ModerationResult>
    ): Promise<ModerationResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildModerationPrompt({
            topic: input.topic,
            level: input.level,
            additionalContext: input.additionalContext,
            folders: input.folders,
            authoring: input.config.authoring,
        })

        await callbacks.onStart?.(selection)

        const result = streamObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('moderation'),
            prompt,
            schema: moderationSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('moderation'),
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
                improvedTopicBrief: partial.improvedTopicBrief,
                reasoningNotes: partial.reasoningNotes,
                folderName: partial.folderName,
                folderReasoning: partial.folderReasoning,
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
            improvedTopicBrief: object.improvedTopicBrief,
            reasoningNotes: object.reasoningNotes,
            folderName: object.folderName,
            folderReasoning: object.folderReasoning,
        }

        await callbacks.onComplete?.(finalResult)
        return finalResult
    }

    async generateQuestionnaire(input: {
        topic: string
        level: DidacticUnitLevel
        improvedTopicBrief?: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<QuestionnaireResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildQuestionnairePrompt({
            topic: input.topic,
            level: input.level,
            improvedTopicBrief: input.improvedTopicBrief,
            authoring: input.config.authoring,
        })

        const result = await generateObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('questionnaire'),
            prompt,
            schema: questionnaireSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('questionnaire'),
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
        input: {
            topic: string
            level: DidacticUnitLevel
            improvedTopicBrief?: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<QuestionnaireResult>
    ): Promise<QuestionnaireResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildQuestionnairePrompt({
            topic: input.topic,
            level: input.level,
            improvedTopicBrief: input.improvedTopicBrief,
            authoring: input.config.authoring,
        })

        await callbacks.onStart?.(selection)

        const result = streamObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('questionnaire'),
            prompt,
            schema: questionnaireSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('questionnaire'),
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
        level: DidacticUnitLevel
        improvedTopicBrief?: string
        syllabusPrompt: string
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        depth: DidacticUnitDepth
        length: DidacticUnitLength
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<SyllabusResult> {
        return this.streamSyllabus(input, {})
    }

    async streamSyllabus(
        input: {
            topic: string
            level: DidacticUnitLevel
            improvedTopicBrief?: string
            syllabusPrompt: string
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            depth: DidacticUnitDepth
            length: DidacticUnitLength
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<SyllabusResult>
    ): Promise<SyllabusResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildSyllabusMarkdownPrompt({
            topic: input.topic,
            level: input.level,
            improvedTopicBrief: input.improvedTopicBrief,
            syllabusPrompt: input.syllabusPrompt,
            questionnaireAnswers: input.questionnaireAnswers,
            authoring: input.config.authoring,
            depth: input.depth,
            length: input.length,
        })

        await callbacks.onStart?.(selection)

        const result = streamObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('syllabus'),
            prompt,
            schema: syllabusSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('syllabus', input.length),
            abortSignal: input.abortSignal,
        })

        for await (const partial of result.partialObjectStream) {
            await callbacks.onPartial?.({
                provider: selection.provider,
                model: selection.model,
                prompt,
                syllabus: partial as DidacticUnitReferenceSyllabus,
            })
        }

        const object = await result.object
        const finalResult: SyllabusResult = {
            provider: selection.provider,
            model: selection.model,
            prompt,
            syllabus: validateReferenceSyllabusLength(object, input.length),
        }

        await callbacks.onComplete?.(finalResult)
        return finalResult
    }

    async generateSummary(input: {
        topic: string
        chapterTitle: string
        chapterMarkdown: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
        kind?: 'continuity' | 'learner'
    }): Promise<SummaryResult> {
        return this.streamSummary(input, {})
    }

    async streamSummary(
        input: {
            topic: string
            chapterTitle: string
            chapterMarkdown: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
            kind?: 'continuity' | 'learner'
        },
        callbacks: MarkdownStreamCallbacks<SummaryResult>
    ): Promise<SummaryResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt =
            input.kind === 'continuity'
                ? buildContinuitySummaryPrompt({
                      topic: input.topic,
                      chapterTitle: input.chapterTitle,
                      chapterMarkdown: input.chapterMarkdown,
                      authoring: input.config.authoring,
                  })
                : buildLearnerSummaryPrompt({
                      topic: input.topic,
                      chapterTitle: input.chapterTitle,
                      chapterMarkdown: input.chapterMarkdown,
                      authoring: input.config.authoring,
                  })
        let markdown = ''

        await callbacks.onStart?.(selection)

        const result = streamText({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('summary'),
            prompt,
            maxOutputTokens: resolveStageMaxOutputTokens('summary'),
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
        level: DidacticUnitLevel
        syllabus: DidacticUnitReferenceSyllabus
        chapterIndex: number
        questionnaireAnswers?: DidacticUnitQuestionAnswer[]
        continuitySummaries?: string[]
        depth: DidacticUnitDepth
        length: DidacticUnitLength
        additionalContext?: string
        instruction?: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<ChapterResult> {
        return this.streamChapter(input, {})
    }

    async streamChapter(
        input: {
            topic: string
            level: DidacticUnitLevel
            syllabus: DidacticUnitReferenceSyllabus
            chapterIndex: number
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            continuitySummaries?: string[]
            depth: DidacticUnitDepth
            length: DidacticUnitLength
            additionalContext?: string
            instruction?: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<ChapterResult>
    ): Promise<ChapterResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildChapterMarkdownPrompt({
            topic: input.topic,
            level: input.level,
            syllabus: input.syllabus,
            chapterIndex: input.chapterIndex,
            questionnaireAnswers: input.questionnaireAnswers,
            continuitySummaries: input.continuitySummaries,
            additionalContext: input.additionalContext,
            instruction: input.instruction,
            authoring: input.config.authoring,
            depth: input.depth,
            length: input.length,
        })
        let markdown = ''

        await callbacks.onStart?.(selection)

        const result = streamText({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('chapter'),
            prompt,
            maxOutputTokens: resolveStageMaxOutputTokens('chapter', input.length),
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
        const normalizedChapter = normalizeGeneratedChapterMarkdown(finalMarkdown, input.chapterIndex, {
            fallbackTitle: input.syllabus.modules[input.chapterIndex]?.title,
        })
        const continuitySummary = await this.generateSummary({
            topic: input.topic,
            chapterTitle: normalizedChapter.title,
            chapterMarkdown: finalMarkdown,
            config: input.config,
            tier: input.tier,
            abortSignal: input.abortSignal,
            kind: 'continuity',
        })

        const finalResult: ChapterResult = {
            provider: selection.provider,
            model: selection.model,
            prompt,
            markdown: finalMarkdown,
            continuitySummary: continuitySummary.markdown,
            chapter: {
                chapterIndex: input.chapterIndex,
                title: normalizedChapter.title,
                markdown: normalizedChapter.markdown,
                generatedAt: new Date().toISOString(),
            },
        }

        await callbacks.onComplete?.(finalResult)
        return finalResult
    }
}
