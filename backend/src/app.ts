import express from 'express'
import {
    type AiConfig,
    type AiConfigStore,
    type AiModelConfig,
    type AiModelTier,
    AiConfigValidationError,
    InMemoryAiConfigStore,
    parseAiConfigPatch,
} from './ai/config.js'
import { openNdjsonStream, writeNdjsonEvent } from './ai/ndjson.js'
import {
    AiGatewayConfigurationError,
    GatewayAiService,
    type AiService,
    type ChapterResult,
    type SyllabusResult,
} from './ai/service.js'
import { completeDidacticUnitChapter } from './didactic-unit/complete-didactic-unit-chapter.js'
import {
    createDidacticUnit,
    type DidacticUnit,
} from './didactic-unit/create-didactic-unit.js'
import {
    parseUpdateDidacticUnitChapterInput,
    resolveDidacticUnitChapterPresentationSettings,
} from './didactic-unit/didactic-unit-chapter.js'
import {
    applyGeneratedDidacticUnitChapter,
    createChapterGenerationSourceFromDidacticUnit,
    hasGeneratedDidacticUnitChapter,
} from './didactic-unit/generate-didactic-unit-chapter.js'
import { listDidacticUnitChapters } from './didactic-unit/list-didactic-unit-chapters.js'
import {
    answerDidacticUnitQuestionnaire,
    applyGeneratedDidacticUnitQuestionnaire,
    applyGeneratedDidacticUnitSyllabus,
    approveDidacticUnitSyllabus,
    generateDidacticUnitSyllabusPrompt,
    moderateDidacticUnitPlanning,
    prepareDidacticUnitSyllabusGeneration,
    updateDidacticUnitSyllabus,
} from './didactic-unit/planning-lifecycle.js'
import {
    parseCreateDidacticUnitInput,
    parseQuestionnaireAnswersInput,
    parseUpdateDidacticUnitSyllabusInput,
} from './didactic-unit/planning.js'
import {
    summarizeDidacticUnit,
    summarizeDidacticUnitStudyProgress,
} from './didactic-unit/summarize-didactic-unit.js'
import { updateDidacticUnitChapter } from './didactic-unit/update-didactic-unit-chapter.js'
import type { DidacticUnitStore } from './didactic-unit/didactic-unit-store.js'
import {
    createCompletedChapterGenerationRunRecord,
    createCompletedSyllabusGenerationRunRecord,
    createFailedChapterGenerationRunRecord,
    createFailedSyllabusGenerationRunRecord,
    type ChapterGenerationRunRecord,
    type GenerationRunStore,
    type SyllabusGenerationRunRecord,
} from './generation-runs/generation-run-store.js'
import { attachMockOwner, type RequestWithMockOwner } from './middleware/mock-owner.js'
import {
    disconnectedMongoHealthStatus,
    type MongoHealthStatus,
} from './mongo/mongo-connection.js'
import { buildChapterGenerationPrompt } from './providers/chapter-generator.js'

export interface CreateAppOptions {
    didacticUnitStore: DidacticUnitStore
    generationRunStore: GenerationRunStore
    aiConfigStore?: AiConfigStore
    aiService?: AiService
    mongoHealth?: MongoHealthStatus
}

function asRequestWithMockOwner(request: express.Request): RequestWithMockOwner {
    return request as unknown as RequestWithMockOwner
}

function parseChapterIndex(value: string): number {
    const chapterIndex = Number.parseInt(value, 10)

    if (!Number.isInteger(chapterIndex) || chapterIndex < 0) {
        throw new Error('chapterIndex must be a non-negative integer.')
    }

    return chapterIndex
}

function parseChapterGenerationInstruction(body: unknown): string | undefined {
    if (body === undefined || body === null) {
        return undefined
    }

    if (typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { instruction?: unknown }
    if (payload.instruction === undefined) {
        return undefined
    }

    if (typeof payload.instruction !== 'string') {
        throw new Error('instruction must be a string.')
    }

    const normalized = payload.instruction.trim()
    return normalized || undefined
}

function parseAiModelTier(body: unknown): AiModelTier {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { tier?: unknown }

    if (payload.tier !== 'cheap' && payload.tier !== 'premium') {
        throw new Error('tier must be either "cheap" or "premium".')
    }

    return payload.tier
}

function parseOptionalAiModelTier(body: unknown): AiModelTier | undefined {
    if (body === undefined || body === null) {
        return undefined
    }

    if (typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { tier?: unknown }
    if (payload.tier === undefined) {
        return undefined
    }

    if (payload.tier !== 'cheap' && payload.tier !== 'premium') {
        throw new Error('tier must be either "cheap" or "premium".')
    }

    return payload.tier
}

function parseOptionalSyllabusContext(body: unknown): string | undefined {
    if (body === undefined || body === null) {
        return undefined
    }

    if (typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { context?: unknown }
    if (payload.context === undefined) {
        return undefined
    }

    if (typeof payload.context !== 'string') {
        throw new Error('context must be a string.')
    }

    const normalized = payload.context.trim()
    return normalized || undefined
}

function compareRunsByCreatedAtDesc(
    left: SyllabusGenerationRunRecord | ChapterGenerationRunRecord,
    right: SyllabusGenerationRunRecord | ChapterGenerationRunRecord
): number {
    return right.createdAt.localeCompare(left.createdAt)
}

function buildDidacticUnitResponse(didacticUnit: DidacticUnit) {
    return {
        ...didacticUnit,
        studyProgress: summarizeDidacticUnitStudyProgress(didacticUnit),
    }
}

type DidacticUnitChapterState = 'pending' | 'ready' | 'failed'

function resolveDidacticUnitChapterState(input: {
    didacticUnit: DidacticUnit
    chapterIndex: number
    chapterRuns: ChapterGenerationRunRecord[]
}): DidacticUnitChapterState {
    const generatedChapter = input.didacticUnit.generatedChapters?.find(
        (chapter) => chapter.chapterIndex === input.chapterIndex
    )

    if (generatedChapter) {
        return 'ready'
    }

    const latestRun = input.chapterRuns
        .filter((run) => run.chapterIndex === input.chapterIndex)
        .sort(compareRunsByCreatedAtDesc)[0]

    if (latestRun?.status === 'failed') {
        return 'failed'
    }

    return 'pending'
}

function resolveCompatibilityProvider(config: AiConfig, requestedProvider: string): string {
    return requestedProvider === 'profile-config' ? config.cheap.provider : requestedProvider
}

function resolveStageConfigError(
    error: unknown,
    fallbackMessage: string
): { status: number; message: string } {
    if (error instanceof AiGatewayConfigurationError || error instanceof AiConfigValidationError) {
        return { status: 500, message: error.message }
    }

    return {
        status: 409,
        message: error instanceof Error ? error.message : fallbackMessage,
    }
}

function createAbortSignal(request: express.Request): AbortSignal {
    const controller = new AbortController()
    request.on('close', () => controller.abort())
    return controller.signal
}

async function recordCompletedSyllabusRun(
    generationRunStore: GenerationRunStore,
    didacticUnit: DidacticUnit,
    result: SyllabusResult
): Promise<void> {
    await generationRunStore.save(
        createCompletedSyllabusGenerationRunRecord({
            didacticUnitId: didacticUnit.id,
            ownerId: didacticUnit.ownerId,
            provider: result.provider,
            model: result.model,
            prompt: result.prompt,
            syllabus: didacticUnit.syllabus!,
            createdAt: didacticUnit.syllabusGeneratedAt ?? new Date().toISOString(),
        })
    )
}

async function recordFailedSyllabusRun(
    generationRunStore: GenerationRunStore,
    didacticUnit: DidacticUnit,
    prompt: string,
    modelConfig: AiModelConfig,
    error: unknown
): Promise<void> {
    if (!prompt.trim()) {
        return
    }

    await generationRunStore.save(
        createFailedSyllabusGenerationRunRecord({
            didacticUnitId: didacticUnit.id,
            ownerId: didacticUnit.ownerId,
            provider: modelConfig.provider,
            model: modelConfig.model,
            prompt,
            error:
                error instanceof Error
                    ? error.message
                    : 'Didactic unit syllabus generation failed.',
            createdAt: new Date().toISOString(),
        })
    )
}

async function recordCompletedChapterRun(
    generationRunStore: GenerationRunStore,
    didacticUnit: DidacticUnit,
    chapterIndex: number,
    result: ChapterResult
): Promise<void> {
    const generatedChapter = didacticUnit.generatedChapters?.find(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (!generatedChapter) {
        return
    }

    await generationRunStore.save(
        createCompletedChapterGenerationRunRecord({
            didacticUnitId: didacticUnit.id,
            ownerId: didacticUnit.ownerId,
            chapterIndex,
            provider: result.provider,
            model: result.model,
            prompt: result.prompt,
            chapter: generatedChapter,
            createdAt: generatedChapter.generatedAt,
        })
    )
}

async function recordFailedChapterRun(
    generationRunStore: GenerationRunStore,
    didacticUnit: DidacticUnit,
    chapterIndex: number,
    modelConfig: AiModelConfig,
    error: unknown
): Promise<void> {
    const promptSource = createChapterGenerationSourceFromDidacticUnit(didacticUnit)

    if (!promptSource.syllabus?.chapters?.[chapterIndex]) {
        return
    }

    await generationRunStore.save(
        createFailedChapterGenerationRunRecord({
            didacticUnitId: didacticUnit.id,
            ownerId: didacticUnit.ownerId,
            chapterIndex,
            provider: modelConfig.provider,
            model: modelConfig.model,
            prompt: buildChapterGenerationPrompt(promptSource, chapterIndex),
            error:
                error instanceof Error
                    ? error.message
                    : 'Didactic unit chapter generation failed.',
            createdAt: new Date().toISOString(),
        })
    )
}

export function createApp(options: CreateAppOptions) {
    const app = express()
    const didacticUnitStore = options.didacticUnitStore
    const generationRunStore = options.generationRunStore
    const aiConfigStore = options.aiConfigStore ?? new InMemoryAiConfigStore()
    const aiService = options.aiService ?? new GatewayAiService()
    const mongoHealth = options.mongoHealth ?? disconnectedMongoHealthStatus

    app.use(express.json())
    app.use(attachMockOwner)

    app.get('/api/health', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        response.json({
            status: 'ok',
            service: 'didactio-backend',
            mockOwnerId: requestWithMockOwner.mockOwner.id,
            mongo: mongoHealth,
        })
    })

    app.get('/api/ai-config', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        response.json(await aiConfigStore.get(requestWithMockOwner.mockOwner.id))
    })

    app.patch('/api/ai-config', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        try {
            const patch = parseAiConfigPatch(request.body)
            response.json(await aiConfigStore.update(requestWithMockOwner.mockOwner.id, patch))
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid AI config update request.',
            })
        }
    })

    app.post('/api/didactic-unit', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        try {
            const input = parseCreateDidacticUnitInput(request.body)
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const didacticUnit = createDidacticUnit(
                {
                    ...input,
                    provider: resolveCompatibilityProvider(config, input.provider),
                },
                requestWithMockOwner.mockOwner.id
            )

            await didacticUnitStore.save(didacticUnit)
            response.status(201).json(buildDidacticUnitResponse(didacticUnit))
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid didactic unit request.',
            })
        }
    })

    app.get('/api/didactic-unit', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        response.json({
            didacticUnits: (
                await didacticUnitStore.listByOwner(requestWithMockOwner.mockOwner.id)
            ).map(summarizeDidacticUnit),
        })
    })

    app.get('/api/didactic-unit/:id', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        response.json(buildDidacticUnitResponse(didacticUnit))
    })

    app.post('/api/didactic-unit/:id/moderate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        if (didacticUnit.status !== 'submitted') {
            response.json(buildDidacticUnitResponse(didacticUnit))
            return
        }

        try {
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const moderation = await aiService.moderateTopic({
                topic: didacticUnit.topic,
                config,
                tier: 'cheap',
                abortSignal: createAbortSignal(request),
            })

            if (!moderation.approved) {
                response.status(409).json({ error: moderation.notes })
                return
            }

            const moderatedDidacticUnit = moderateDidacticUnitPlanning(didacticUnit, {
                normalizedTopic: moderation.normalizedTopic,
                improvedTopicBrief: moderation.improvedTopicBrief,
                reasoningNotes: moderation.reasoningNotes,
            })
            await didacticUnitStore.save(moderatedDidacticUnit)
            response.json(buildDidacticUnitResponse(moderatedDidacticUnit))
        } catch (error) {
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit moderation failed.'
            )
            response.status(resolved.status).json({ error: resolved.message })
        }
    })

    app.post('/api/didactic-unit/:id/moderate/stream', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        if (didacticUnit.status !== 'submitted') {
            openNdjsonStream(response)
            writeNdjsonEvent(response, {
                type: 'complete',
                data: buildDidacticUnitResponse(didacticUnit),
            })
            response.end()
            return
        }

        openNdjsonStream(response)

        try {
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const moderation = await aiService.streamModeration(
                {
                    topic: didacticUnit.topic,
                    config,
                    tier: 'cheap',
                    abortSignal: createAbortSignal(request),
                },
                {
                    onStart: async (selection) => {
                        writeNdjsonEvent(response, {
                            type: 'start',
                            stage: 'moderation',
                            provider: selection.provider,
                            model: selection.model,
                        })
                    },
                    onPartial: async (partial) => {
                        writeNdjsonEvent(response, {
                            type: 'partial_structured',
                            data: partial,
                        })
                    },
                }
            )

            if (!moderation.approved) {
                writeNdjsonEvent(response, {
                    type: 'error',
                    message: moderation.notes,
                })
                response.end()
                return
            }

            const moderatedDidacticUnit = moderateDidacticUnitPlanning(didacticUnit, {
                normalizedTopic: moderation.normalizedTopic,
                improvedTopicBrief: moderation.improvedTopicBrief,
                reasoningNotes: moderation.reasoningNotes,
            })
            await didacticUnitStore.save(moderatedDidacticUnit)
            writeNdjsonEvent(response, {
                type: 'complete',
                data: buildDidacticUnitResponse(moderatedDidacticUnit),
            })
        } catch (error) {
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit moderation failed.'
            )
            writeNdjsonEvent(response, { type: 'error', message: resolved.message })
        }

        response.end()
    })

    app.post('/api/didactic-unit/:id/questionnaire/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let tier: AiModelTier
        try {
            tier = parseAiModelTier(request.body)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit questionnaire generation request.',
            })
            return
        }

        try {
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const result = await aiService.generateQuestionnaire({
                topic: didacticUnit.topic,
                improvedTopicBrief: didacticUnit.improvedTopicBrief,
                config,
                tier,
                abortSignal: createAbortSignal(request),
            })
            const updatedDidacticUnit = applyGeneratedDidacticUnitQuestionnaire(
                didacticUnit,
                result.questionnaire
            )
            updatedDidacticUnit.provider = result.provider
            await didacticUnitStore.save(updatedDidacticUnit)
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit questionnaire generation failed.'
            )
            response.status(resolved.status).json({ error: resolved.message })
        }
    })

    app.post('/api/didactic-unit/:id/questionnaire/generate/stream', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        openNdjsonStream(response)

        let tier: AiModelTier
        try {
            tier = parseAiModelTier(request.body)
        } catch (error) {
            writeNdjsonEvent(response, {
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit questionnaire generation request.',
            })
            response.end()
            return
        }

        try {
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const result = await aiService.streamQuestionnaire(
                {
                    topic: didacticUnit.topic,
                    improvedTopicBrief: didacticUnit.improvedTopicBrief,
                    config,
                    tier,
                    abortSignal: createAbortSignal(request),
                },
                {
                    onStart: async (selection) => {
                        writeNdjsonEvent(response, {
                            type: 'start',
                            stage: 'questionnaire',
                            provider: selection.provider,
                            model: selection.model,
                        })
                    },
                    onPartial: async (partial) => {
                        writeNdjsonEvent(response, {
                            type: 'partial_structured',
                            data: partial,
                        })
                    },
                }
            )

            const updatedDidacticUnit = applyGeneratedDidacticUnitQuestionnaire(
                didacticUnit,
                result.questionnaire
            )
            updatedDidacticUnit.provider = result.provider
            await didacticUnitStore.save(updatedDidacticUnit)
            writeNdjsonEvent(response, {
                type: 'complete',
                data: buildDidacticUnitResponse(updatedDidacticUnit),
            })
        } catch (error) {
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit questionnaire generation failed.'
            )
            writeNdjsonEvent(response, { type: 'error', message: resolved.message })
        }

        response.end()
    })

    app.patch('/api/didactic-unit/:id/questionnaire/answers', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let parsedInput
        try {
            parsedInput = parseQuestionnaireAnswersInput(request.body)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid questionnaire answers request.',
            })
            return
        }

        try {
            const updatedDidacticUnit = answerDidacticUnitQuestionnaire(
                didacticUnit,
                parsedInput
            )
            await didacticUnitStore.save(updatedDidacticUnit)
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Didactic unit questionnaire answer submission failed.',
            })
        }
    })

    app.post('/api/didactic-unit/:id/syllabus-prompt/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        try {
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const updatedDidacticUnit = generateDidacticUnitSyllabusPrompt(
                didacticUnit,
                config.authoring
            )
            await didacticUnitStore.save(updatedDidacticUnit)
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Didactic unit syllabus prompt generation failed.',
            })
        }
    })

    app.post('/api/didactic-unit/:id/syllabus/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let tier: AiModelTier
        try {
            tier = parseAiModelTier(request.body)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit syllabus generation request.',
            })
            return
        }

        const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
        let preparedDidacticUnit: DidacticUnit | null = null

        let syllabusContext: string | undefined
        try {
            syllabusContext = parseOptionalSyllabusContext(request.body)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit syllabus generation request.',
            })
            return
        }

        try {
            preparedDidacticUnit = prepareDidacticUnitSyllabusGeneration(
                didacticUnit,
                config.authoring,
                syllabusContext
            )
            const result = await aiService.generateSyllabus({
                topic: preparedDidacticUnit.topic,
                improvedTopicBrief: preparedDidacticUnit.improvedTopicBrief,
                syllabusPrompt: preparedDidacticUnit.syllabusPrompt ?? '',
                questionnaireAnswers: preparedDidacticUnit.questionnaireAnswers,
                depth: preparedDidacticUnit.depth,
                length: preparedDidacticUnit.length,
                config,
                tier,
                abortSignal: createAbortSignal(request),
            })
            const updatedDidacticUnit = applyGeneratedDidacticUnitSyllabus(
                preparedDidacticUnit,
                result.syllabus
            )
            updatedDidacticUnit.provider = result.provider
            await didacticUnitStore.save(updatedDidacticUnit)
            await recordCompletedSyllabusRun(
                generationRunStore,
                updatedDidacticUnit,
                result
            )
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            await recordFailedSyllabusRun(
                generationRunStore,
                didacticUnit,
                preparedDidacticUnit?.syllabusPrompt ?? didacticUnit.syllabusPrompt ?? '',
                config[tier],
                error
            )
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit syllabus generation failed.'
            )
            response.status(resolved.status).json({ error: resolved.message })
        }
    })

    app.post('/api/didactic-unit/:id/syllabus/generate/stream', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        openNdjsonStream(response)

        let tier: AiModelTier
        try {
            tier = parseAiModelTier(request.body)
        } catch (error) {
            writeNdjsonEvent(response, {
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit syllabus generation request.',
            })
            response.end()
            return
        }

        const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
        let preparedDidacticUnit: DidacticUnit | null = null

        let syllabusContext: string | undefined
        try {
            syllabusContext = parseOptionalSyllabusContext(request.body)
        } catch (error) {
            writeNdjsonEvent(response, {
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit syllabus generation request.',
            })
            response.end()
            return
        }

        try {
            preparedDidacticUnit = prepareDidacticUnitSyllabusGeneration(
                didacticUnit,
                config.authoring,
                syllabusContext
            )
            const result = await aiService.streamSyllabus(
                {
                    topic: preparedDidacticUnit.topic,
                    improvedTopicBrief: preparedDidacticUnit.improvedTopicBrief,
                    syllabusPrompt: preparedDidacticUnit.syllabusPrompt ?? '',
                    questionnaireAnswers: preparedDidacticUnit.questionnaireAnswers,
                    depth: preparedDidacticUnit.depth,
                    length: preparedDidacticUnit.length,
                    config,
                    tier,
                    abortSignal: createAbortSignal(request),
                },
                {
                    onStart: async (selection) => {
                        writeNdjsonEvent(response, {
                            type: 'start',
                            stage: 'syllabus',
                            provider: selection.provider,
                            model: selection.model,
                        })
                    },
                    onMarkdown: async (delta, markdown) => {
                        writeNdjsonEvent(response, {
                            type: 'partial_markdown',
                            delta,
                            markdown,
                        })
                    },
                }
            )

            const updatedDidacticUnit = applyGeneratedDidacticUnitSyllabus(
                preparedDidacticUnit,
                result.syllabus
            )
            updatedDidacticUnit.provider = result.provider
            await didacticUnitStore.save(updatedDidacticUnit)
            await recordCompletedSyllabusRun(
                generationRunStore,
                updatedDidacticUnit,
                result
            )
            writeNdjsonEvent(response, {
                type: 'complete',
                data: buildDidacticUnitResponse(updatedDidacticUnit),
            })
        } catch (error) {
            await recordFailedSyllabusRun(
                generationRunStore,
                didacticUnit,
                preparedDidacticUnit?.syllabusPrompt ?? didacticUnit.syllabusPrompt ?? '',
                config[tier],
                error
            )
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit syllabus generation failed.'
            )
            writeNdjsonEvent(response, { type: 'error', message: resolved.message })
        }

        response.end()
    })

    app.patch('/api/didactic-unit/:id/syllabus', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let parsedInput
        try {
            parsedInput = parseUpdateDidacticUnitSyllabusInput(request.body)
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid syllabus update request.',
            })
            return
        }

        try {
            const updatedDidacticUnit = updateDidacticUnitSyllabus(didacticUnit, parsedInput)
            await didacticUnitStore.save(updatedDidacticUnit)
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Didactic unit syllabus update failed.',
            })
        }
    })

    app.post('/api/didactic-unit/:id/approve-syllabus', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        try {
            const generationTier = parseOptionalAiModelTier(request.body)
            const approvedDidacticUnit = approveDidacticUnitSyllabus(
                didacticUnit,
                generationTier
            )
            await didacticUnitStore.save(approvedDidacticUnit)
            response.json(buildDidacticUnitResponse(approvedDidacticUnit))
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Didactic unit syllabus approval failed.',
            })
        }
    })

    app.post('/api/didactic-unit/:id/summary/generate/stream', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        const sourceMarkdown = (didacticUnit.generatedChapters ?? [])
            .map((chapter) => `# ${chapter.title}\n\n${chapter.content}`)
            .join('\n\n')

        openNdjsonStream(response)

        let tier: AiModelTier
        try {
            tier = parseAiModelTier(request.body)
        } catch (error) {
            writeNdjsonEvent(response, {
                type: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit summary generation request.',
            })
            response.end()
            return
        }

        try {
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const result = await aiService.streamSummary(
                {
                    topic: didacticUnit.topic,
                    chapterTitle: didacticUnit.title,
                    chapterMarkdown: sourceMarkdown || didacticUnit.overview,
                    config,
                    tier,
                    abortSignal: createAbortSignal(request),
                },
                {
                    onStart: async (selection) => {
                        writeNdjsonEvent(response, {
                            type: 'start',
                            stage: 'summary',
                            provider: selection.provider,
                            model: selection.model,
                        })
                    },
                    onMarkdown: async (delta, markdown) => {
                        writeNdjsonEvent(response, {
                            type: 'partial_markdown',
                            delta,
                            markdown,
                        })
                    },
                }
            )

            writeNdjsonEvent(response, { type: 'complete', data: result })
        } catch (error) {
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit summary generation failed.'
            )
            writeNdjsonEvent(response, { type: 'error', message: resolved.message })
        }

        response.end()
    })

    app.get('/api/didactic-unit/:id/chapters', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        const chapterRuns = (
            await generationRunStore.listByDidacticUnit(
                requestWithMockOwner.mockOwner.id,
                didacticUnit.id
            )
        ).filter((run): run is ChapterGenerationRunRecord => run.stage === 'chapter')

        response.json({
            chapters: listDidacticUnitChapters(didacticUnit).map((chapter) => ({
                ...chapter,
                state: resolveDidacticUnitChapterState({
                    didacticUnit,
                    chapterIndex: chapter.chapterIndex,
                    chapterRuns,
                }),
            })),
        })
    })

    app.get('/api/didactic-unit/:id/chapters/:chapterIndex', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(request.params.chapterIndex)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit chapter lookup request.',
            })
            return
        }

        const plannedChapter = didacticUnit.chapters[chapterIndex]
        if (!plannedChapter) {
            response.status(404).json({ error: 'Didactic unit chapter not found.' })
            return
        }

        const generatedChapter = didacticUnit.generatedChapters?.find(
            (chapter) => chapter.chapterIndex === chapterIndex
        )
        const chapterRuns = (
            await generationRunStore.listByDidacticUnit(
                requestWithMockOwner.mockOwner.id,
                didacticUnit.id
            )
        ).filter((run): run is ChapterGenerationRunRecord => run.stage === 'chapter')
        const completedChapter = didacticUnit.completedChapters?.find(
            (chapter) => chapter.chapterIndex === chapterIndex
        )

        response.json({
            chapterIndex,
            title: generatedChapter?.title ?? plannedChapter.title,
            overview: generatedChapter?.overview ?? plannedChapter.overview,
            content: generatedChapter?.content ?? null,
            keyTakeaways: generatedChapter?.keyTakeaways ?? [],
            presentationSettings: resolveDidacticUnitChapterPresentationSettings(
                generatedChapter?.presentationSettings
            ),
            generatedAt: generatedChapter?.generatedAt,
            updatedAt: generatedChapter?.updatedAt,
            state: resolveDidacticUnitChapterState({
                didacticUnit,
                chapterIndex,
                chapterRuns,
            }),
            isCompleted: completedChapter !== undefined,
            completedAt: completedChapter?.completedAt,
        })
    })

    app.get('/api/didactic-unit/:id/chapters/:chapterIndex/revisions', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(request.params.chapterIndex)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit chapter revision lookup request.',
            })
            return
        }

        const revisions = (didacticUnit.chapterRevisions ?? [])
            .filter((revision) => revision.chapterIndex === chapterIndex)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))

        if (revisions.length === 0) {
            response.status(404).json({ error: 'Didactic unit chapter revisions not found.' })
            return
        }

        response.json({ revisions })
    })

    app.get('/api/didactic-unit/:id/runs', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        response.json({
            runs: (
                await generationRunStore.listByDidacticUnit(
                    requestWithMockOwner.mockOwner.id,
                    didacticUnit.id
                )
            ).sort(compareRunsByCreatedAtDesc),
        })
    })

    app.post('/api/didactic-unit/:id/chapters/:chapterIndex/complete', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(request.params.chapterIndex)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit chapter completion request.',
            })
            return
        }

        try {
            const updatedDidacticUnit = completeDidacticUnitChapter(
                didacticUnit,
                chapterIndex
            )
            await didacticUnitStore.save(updatedDidacticUnit)
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Didactic unit chapter completion failed.'
            response.status(
                message === 'Generated didactic unit chapter not found.' ? 404 : 409
            ).json({ error: message })
        }
    })

    app.patch('/api/didactic-unit/:id/chapters/:chapterIndex', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(request.params.chapterIndex)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit chapter update request.',
            })
            return
        }

        let parsedInput
        try {
            parsedInput = parseUpdateDidacticUnitChapterInput(request.body)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit chapter update request.',
            })
            return
        }

        try {
            const updatedDidacticUnit = updateDidacticUnitChapter(
                didacticUnit,
                chapterIndex,
                parsedInput
            )
            await didacticUnitStore.save(updatedDidacticUnit)
            const updatedChapter = updatedDidacticUnit.generatedChapters?.find(
                (chapter) => chapter.chapterIndex === chapterIndex
            )

            response.json(updatedChapter)
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Didactic unit chapter update failed.'
            response.status(
                message === 'Generated didactic unit chapter not found.' ? 404 : 409
            ).json({ error: message })
        }
    })

    const runChapterGeneration = async (
        request: express.Request,
        response: express.Response,
        revisionSource: 'ai_generation' | 'ai_regeneration',
        isStreaming: boolean
    ) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnitId = String(request.params.id)
        const chapterIndexParam = String(request.params.chapterIndex)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            didacticUnitId
        )

        if (!didacticUnit) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(chapterIndexParam)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : `Invalid didactic unit chapter ${revisionSource} request.`,
            })
            return
        }

        if (
            revisionSource === 'ai_regeneration' &&
            !hasGeneratedDidacticUnitChapter(didacticUnit, chapterIndex)
        ) {
            response.status(404).json({ error: 'Generated didactic unit chapter not found.' })
            return
        }

        const plannedChapter = didacticUnit.chapters[chapterIndex]
        if (!plannedChapter) {
            response.status(400).json({
                error: 'Chapter index is out of range for the approved syllabus.',
            })
            return
        }

        const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
        let tier: AiModelTier
        let instruction: string | undefined

        try {
            tier = parseAiModelTier(request.body)
            instruction = parseChapterGenerationInstruction(request.body)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : `Invalid didactic unit chapter ${revisionSource} request.`,
            })
            return
        }

        if (isStreaming) {
            openNdjsonStream(response)
        }

        try {
            const result = isStreaming
                ? await aiService.streamChapter(
                      {
                          topic: didacticUnit.topic,
                          syllabus: didacticUnit.syllabus ?? {
                              title: didacticUnit.title,
                              overview: didacticUnit.overview,
                              learningGoals: didacticUnit.learningGoals,
                              keywords: didacticUnit.keywords,
                              estimatedDurationMinutes:
                                  didacticUnit.estimatedDurationMinutes ?? 60,
                              chapters: didacticUnit.chapters,
                          },
                          chapterIndex,
                          questionnaireAnswers: didacticUnit.questionnaireAnswers,
                          continuitySummaries: didacticUnit.continuitySummaries,
                          depth: didacticUnit.depth,
                          length: didacticUnit.length,
                          additionalContext: didacticUnit.additionalContext,
                          instruction,
                          config,
                          tier,
                          abortSignal: createAbortSignal(request),
                      },
                      {
                          onStart: async (selection) => {
                              writeNdjsonEvent(response, {
                                  type: 'start',
                                  stage: 'chapter',
                                  provider: selection.provider,
                                  model: selection.model,
                              })
                          },
                          onMarkdown: async (delta, markdown) => {
                              writeNdjsonEvent(response, {
                                  type: 'partial_markdown',
                                  delta,
                                  markdown,
                              })
                          },
                      }
                  )
                  : await aiService.generateChapter({
                      topic: didacticUnit.topic,
                      syllabus: didacticUnit.syllabus ?? {
                          title: didacticUnit.title,
                          overview: didacticUnit.overview,
                          learningGoals: didacticUnit.learningGoals,
                          keywords: didacticUnit.keywords,
                          estimatedDurationMinutes: didacticUnit.estimatedDurationMinutes ?? 60,
                          chapters: didacticUnit.chapters,
                      },
                      chapterIndex,
                      questionnaireAnswers: didacticUnit.questionnaireAnswers,
                      continuitySummaries: didacticUnit.continuitySummaries,
                      depth: didacticUnit.depth,
                      length: didacticUnit.length,
                      additionalContext: didacticUnit.additionalContext,
                      instruction,
                      config,
                      tier,
                      abortSignal: createAbortSignal(request),
                  })

            const updatedDidacticUnit = applyGeneratedDidacticUnitChapter(
                didacticUnit,
                chapterIndex,
                result.chapter,
                revisionSource,
                result.continuitySummary
            )
            updatedDidacticUnit.provider = result.provider
            await didacticUnitStore.save(updatedDidacticUnit)
            await recordCompletedChapterRun(
                generationRunStore,
                updatedDidacticUnit,
                chapterIndex,
                result
            )

            if (isStreaming) {
                writeNdjsonEvent(response, {
                    type: 'complete',
                    data: buildDidacticUnitResponse(updatedDidacticUnit),
                })
                response.end()
                return
            }

            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            await recordFailedChapterRun(
                generationRunStore,
                didacticUnit,
                chapterIndex,
                config[tier],
                error
            )
            const resolved = resolveStageConfigError(
                error,
                'Didactic unit chapter generation failed.'
            )

            if (isStreaming) {
                writeNdjsonEvent(response, { type: 'error', message: resolved.message })
                response.end()
                return
            }

            response.status(
                resolved.message === 'Chapter index is out of range for the approved syllabus.'
                    ? 400
                    : resolved.status
            ).json({ error: resolved.message })
        }
    }

    app.post('/api/didactic-unit/:id/chapters/:chapterIndex/generate', async (request, response) =>
        runChapterGeneration(request, response, 'ai_generation', false)
    )

    app.post(
        '/api/didactic-unit/:id/chapters/:chapterIndex/generate/stream',
        async (request, response) =>
            runChapterGeneration(request, response, 'ai_generation', true)
    )

    app.post(
        '/api/didactic-unit/:id/chapters/:chapterIndex/regenerate',
        async (request, response) =>
            runChapterGeneration(request, response, 'ai_regeneration', false)
    )

    app.post(
        '/api/didactic-unit/:id/chapters/:chapterIndex/regenerate/stream',
        async (request, response) =>
            runChapterGeneration(request, response, 'ai_regeneration', true)
    )

    return app
}
