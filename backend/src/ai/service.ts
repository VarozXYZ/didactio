import { createGateway, generateObject, streamObject, streamText } from 'ai'
import { z } from 'zod'
import { getAppEnv } from '../config/env.js'
import type { DidacticUnitGeneratedChapter } from '../didactic-unit/didactic-unit-chapter.js'
import type {
    DidacticUnitDepth,
    DidacticUnitLength,
    DidacticUnitQuestionAnswer,
    DidacticUnitQuestionnaire,
    DidacticUnitQuestion,
    DidacticUnitQuestionOption,
    DidacticUnitSyllabus,
} from '../didactic-unit/planning.js'
import type { AiConfig, AiModelConfig, AiModelTier } from './config.js'
import { resolveGatewayModelId } from './config.js'
import {
    buildChapterMarkdownPrompt,
    buildChapterRepairPrompt,
    buildContinuitySummaryPrompt,
    buildGatewaySystemPrompt,
    buildLearnerSummaryPrompt,
    buildModerationPrompt,
    buildQuestionnairePrompt,
    resolveTargetChapterCount,
    buildSyllabusMarkdownPrompt,
    buildSyllabusRepairPrompt,
} from './prompt-builders.js'
import {
    chapterSchema,
    moderationSchema,
    questionnaireSchema,
    syllabusSchema,
} from './schemas.js'
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
    improvedTopicBrief: string
    reasoningNotes: string
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
    moderateTopic(input: {
        topic: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<ModerationResult>
    streamModeration(
        input: {
            topic: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<ModerationResult>
    ): Promise<ModerationResult>
    generateQuestionnaire(input: {
        topic: string
        improvedTopicBrief?: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<QuestionnaireResult>
    streamQuestionnaire(
        input: {
            topic: string
            improvedTopicBrief?: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<QuestionnaireResult>
    ): Promise<QuestionnaireResult>
    generateSyllabus(input: {
        topic: string
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
            improvedTopicBrief?: string
            syllabusPrompt: string
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            depth: DidacticUnitDepth
            length: DidacticUnitLength
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<SyllabusResult>
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
        syllabus: DidacticUnitSyllabus
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
            syllabus: DidacticUnitSyllabus
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

function buildQuestionnaireSchema() {
    return questionnaireSchema
}

function validateSyllabusChapterCount(
    syllabus: DidacticUnitSyllabus,
    length: DidacticUnitLength
): DidacticUnitSyllabus | null {
    return syllabus.chapters.length === resolveTargetChapterCount(length) ? syllabus : null
}

const CONTENT_LENGTH_TOKENS: Record<DidacticUnitLength, number> = {
    intro: 1000,
    short: 6000,
    long: 15000,
    textbook: 32000,
}

function resolveStageMaxOutputTokens(
    stage:
        | 'moderation'
        | 'questionnaire'
        | 'syllabus'
        | 'summary'
        | 'chapter'
        | 'repair_syllabus'
        | 'repair_chapter',
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
        case 'repair_syllabus':
        case 'repair_chapter':
            if (!length) {
                throw new Error(`A didactic unit length is required for the ${stage} token budget.`)
            }

            return CONTENT_LENGTH_TOKENS[length]
    }
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

    if (normalizedQuestions.length !== 3) {
        throw new Error(
            `Questionnaire generation returned ${normalizedQuestions.length} questions; expected exactly 3.`
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

function validateOrRepairParsedObject<T>(
    parsedObject: unknown,
    schema: z.ZodType<T>
): T | null {
    const result = schema.safeParse(parsedObject)
    return result.success ? result.data : null
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
        const tierConfig = config[tier]
        const normalized = this.requireTierConfig(tier, tierConfig)
        return {
            provider: normalized.provider,
            model: normalized.model,
            modelId: resolveGatewayModelId(normalized),
        }
    }

    private requireTierConfig(
        tier: AiModelTier,
        config: AiModelConfig | undefined
    ): AiModelConfig {
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

    private async repairSyllabusFromMarkdown(input: {
        selection: ModelSelection
        topic: string
        markdown: string
        improvedTopicBrief?: string
        length: DidacticUnitLength
        config: AiConfig
        abortSignal?: AbortSignal
    }): Promise<DidacticUnitSyllabus> {
        const parsed = validateOrRepairParsedObject(
            (() => {
                try {
                    return parseSyllabusMarkdown(input.markdown)
                } catch {
                    return null
                }
            })(),
            syllabusSchema
        )

        const validatedParsed = parsed
            ? validateSyllabusChapterCount(parsed, input.length)
            : null

        if (validatedParsed) {
            return validatedParsed
        }

        const repaired = await generateObject({
            model: this.gateway(input.selection.modelId),
            system: buildGatewaySystemPrompt('syllabus'),
            prompt: buildSyllabusRepairPrompt({
                topic: input.topic,
                markdown: input.markdown,
                improvedTopicBrief: input.improvedTopicBrief,
                authoring: input.config.authoring,
                length: input.length,
            }),
            schema: syllabusSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('repair_syllabus', input.length),
            abortSignal: input.abortSignal,
        })

        const validatedRepaired = validateSyllabusChapterCount(repaired.object, input.length)

        if (validatedRepaired) {
            return validatedRepaired
        }

        throw new Error(
            `Syllabus generation returned ${repaired.object.chapters.length} chapters; expected exactly ${resolveTargetChapterCount(input.length)}.`
        )
    }

    private async repairChapterFromMarkdown(input: {
        selection: ModelSelection
        topic: string
        chapterIndex: number
        syllabus: DidacticUnitSyllabus
        markdown: string
        length: DidacticUnitLength
        abortSignal?: AbortSignal
    }): Promise<z.infer<typeof chapterSchema>> {
        const parsed = validateOrRepairParsedObject(
            (() => {
                try {
                    return parseChapterMarkdown(input.markdown, input.chapterIndex)
                } catch {
                    return null
                }
            })(),
            chapterSchema
        )

        if (parsed) {
            return parsed
        }

        const repaired = await generateObject({
            model: this.gateway(input.selection.modelId),
            system: buildGatewaySystemPrompt('chapter'),
            prompt: buildChapterRepairPrompt({
                topic: input.topic,
                chapterIndex: input.chapterIndex,
                syllabus: input.syllabus,
                markdown: input.markdown,
            }),
            schema: chapterSchema,
            maxOutputTokens: resolveStageMaxOutputTokens('repair_chapter', input.length),
            abortSignal: input.abortSignal,
        })

        return repaired.object
    }

    async moderateTopic(input: {
        topic: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<ModerationResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildModerationPrompt({
            topic: input.topic,
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
        }
    }

    async streamModeration(
        input: {
            topic: string
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: StructuredStreamCallbacks<ModerationResult>
    ): Promise<ModerationResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildModerationPrompt({
            topic: input.topic,
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
        }
        await callbacks.onComplete?.(finalResult)
        return finalResult
    }

    async generateQuestionnaire(input: {
        topic: string
        improvedTopicBrief?: string
        config: AiConfig
        tier: AiModelTier
        abortSignal?: AbortSignal
    }): Promise<QuestionnaireResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildQuestionnairePrompt({
            topic: input.topic,
            improvedTopicBrief: input.improvedTopicBrief,
            authoring: input.config.authoring,
        })
        const result = await generateObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('questionnaire'),
            prompt,
            schema: buildQuestionnaireSchema(),
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
            improvedTopicBrief: input.improvedTopicBrief,
            authoring: input.config.authoring,
        })

        await callbacks.onStart?.(selection)

        const result = streamObject({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('questionnaire'),
            prompt,
            schema: buildQuestionnaireSchema(),
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
            improvedTopicBrief?: string
            syllabusPrompt: string
            questionnaireAnswers?: DidacticUnitQuestionAnswer[]
            depth: DidacticUnitDepth
            length: DidacticUnitLength
            config: AiConfig
            tier: AiModelTier
            abortSignal?: AbortSignal
        },
        callbacks: MarkdownStreamCallbacks<SyllabusResult>
    ): Promise<SyllabusResult> {
        const selection = this.selectModel(input.tier, input.config)
        const prompt = buildSyllabusMarkdownPrompt({
            topic: input.topic,
            improvedTopicBrief: input.improvedTopicBrief,
            syllabusPrompt: input.syllabusPrompt,
            questionnaireAnswers: input.questionnaireAnswers,
            authoring: input.config.authoring,
            depth: input.depth,
            length: input.length,
        })
        let markdown = ''

        await callbacks.onStart?.(selection)

        const result = streamText({
            model: this.gateway(selection.modelId),
            system: buildGatewaySystemPrompt('syllabus'),
            prompt,
            maxOutputTokens: resolveStageMaxOutputTokens('syllabus', input.length),
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
        const syllabus = await this.repairSyllabusFromMarkdown({
            selection,
            topic: input.topic,
            markdown: finalMarkdown,
            improvedTopicBrief: input.improvedTopicBrief,
            length: input.length,
            config: input.config,
            abortSignal: input.abortSignal,
        })
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
                  })
                : buildLearnerSummaryPrompt({
                      topic: input.topic,
                      chapterTitle: input.chapterTitle,
                      chapterMarkdown: input.chapterMarkdown,
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
        syllabus: DidacticUnitSyllabus
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
            syllabus: DidacticUnitSyllabus
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
        const parsedChapter = await this.repairChapterFromMarkdown({
            selection,
            topic: input.topic,
            chapterIndex: input.chapterIndex,
            syllabus: input.syllabus,
            markdown: finalMarkdown,
            length: input.length,
            abortSignal: input.abortSignal,
        })
        const continuitySummary = await this.generateSummary({
            topic: input.topic,
            chapterTitle: parsedChapter.title,
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
