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
    type FolderClassificationResult,
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
    adaptDidacticUnitSyllabusToReferenceSyllabus,
    parseCreateDidacticUnitInput,
    parseFolderSelectionInput,
    parseQuestionnaireAnswersInput,
    parseUpdateDidacticUnitFolderInput,
    parseUpdateDidacticUnitSyllabusInput,
} from './didactic-unit/planning.js'
import {
    summarizeDidacticUnit,
    summarizeDidacticUnitStudyProgress,
} from './didactic-unit/summarize-didactic-unit.js'
import { updateDidacticUnitChapter } from './didactic-unit/update-didactic-unit-chapter.js'
import { updateDidacticUnitFolder } from './didactic-unit/update-didactic-unit-folder.js'
import type { DidacticUnitStore } from './didactic-unit/didactic-unit-store.js'
import {
    CUSTOM_FOLDER_COLOR,
    CUSTOM_FOLDER_ICON,
    ensureDefaultFolders,
    getGeneralFolder,
    normalizeFolderName,
    slugifyFolderName,
} from './folders/folder-defaults.js'
import type { Folder, FolderStore } from './folders/folder-store.js'
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
    folderStore: FolderStore
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

function buildFolderResponse(folder: Folder) {
    return {
        id: folder.id,
        name: folder.name,
        icon: folder.icon,
        color: folder.color,
        kind: folder.kind,
    }
}

function buildFolderDescription(folder: Folder): string {
    if (folder.slug === 'general') {
        return 'Use for broad topics, mixed subjects, or units that do not clearly fit a specialized folder.'
    }

    return `Use for units primarily focused on ${folder.name.toLowerCase()}.`
}

function resolveFolderOrFallback(
    didacticUnit: Pick<DidacticUnit, 'folderId'>,
    foldersById: Map<string, Folder>
): Folder {
    const assignedFolder = foldersById.get(didacticUnit.folderId)
    if (assignedFolder) {
        return assignedFolder
    }

    const generalFolder = [...foldersById.values()].find((folder) => folder.slug === 'general')
    if (generalFolder) {
        return generalFolder
    }

    throw new Error('No folder metadata was available for the didactic unit response.')
}

function buildDidacticUnitResponseFromFolders(
    didacticUnit: DidacticUnit,
    foldersById: Map<string, Folder>
) {
    const folder = resolveFolderOrFallback(didacticUnit, foldersById)

    return {
        id: didacticUnit.id,
        ownerId: didacticUnit.ownerId,
        topic: didacticUnit.topic,
        title: didacticUnit.title,
        folderId: folder.id,
        folderAssignmentMode: didacticUnit.folderAssignmentMode,
        folder: buildFolderResponse(folder),
        provider: didacticUnit.provider,
        status: didacticUnit.status,
        nextAction: didacticUnit.nextAction,
        createdAt: didacticUnit.createdAt,
        updatedAt: didacticUnit.updatedAt,
        moderatedAt: didacticUnit.moderatedAt,
        questionnaireGeneratedAt: didacticUnit.questionnaireGeneratedAt,
        questionnaireAnsweredAt: didacticUnit.questionnaireAnsweredAt,
        improvedTopicBrief: didacticUnit.improvedTopicBrief,
        reasoningNotes: didacticUnit.reasoningNotes,
        additionalContext: didacticUnit.additionalContext,
        depth: didacticUnit.depth,
        length: didacticUnit.length,
        level: didacticUnit.level,
        generationTier: didacticUnit.generationTier,
        questionnaireEnabled: didacticUnit.questionnaireEnabled,
        questionnaire: didacticUnit.questionnaire,
        questionnaireAnswers: didacticUnit.questionnaireAnswers,
        syllabusPrompt: didacticUnit.syllabusPrompt,
        syllabusPromptGeneratedAt: didacticUnit.syllabusPromptGeneratedAt,
        syllabus: didacticUnit.syllabus,
        syllabusGeneratedAt: didacticUnit.syllabusGeneratedAt,
        syllabusUpdatedAt: didacticUnit.syllabusUpdatedAt,
        syllabusApprovedAt: didacticUnit.syllabusApprovedAt,
        overview: didacticUnit.overview,
        learningGoals: didacticUnit.learningGoals,
        keywords: didacticUnit.keywords,
        chapters: didacticUnit.chapters.map((chapter) => ({
            title: chapter.title,
            overview: chapter.overview,
            keyPoints: [...chapter.keyPoints],
            lessons: chapter.lessons.map((lesson) => ({
                title: lesson.title,
                contentOutline: [...lesson.contentOutline],
            })),
        })),
        studyProgress: summarizeDidacticUnitStudyProgress(didacticUnit),
    }
}

async function loadFoldersById(folderStore: FolderStore, ownerId: string): Promise<Map<string, Folder>> {
    const folders = await ensureDefaultFolders(folderStore, ownerId)
    return new Map(folders.map((folder) => [folder.id, folder] as const))
}

async function buildDidacticUnitResponse(
    didacticUnit: DidacticUnit,
    folderStore: FolderStore
) {
    return buildDidacticUnitResponseFromFolders(
        didacticUnit,
        await loadFoldersById(folderStore, didacticUnit.ownerId)
    )
}

async function buildDidacticUnitSummaryResponses(
    didacticUnits: DidacticUnit[],
    folderStore: FolderStore,
    ownerId: string
) {
    const foldersById = await loadFoldersById(folderStore, ownerId)

    return didacticUnits.map((didacticUnit) => {
        const summary = summarizeDidacticUnit(didacticUnit)
        const folder = resolveFolderOrFallback(didacticUnit, foldersById)

        return {
            ...summary,
            folder: buildFolderResponse(folder),
        }
    })
}

async function listFoldersWithUnitCounts(
    folderStore: FolderStore,
    didacticUnitStore: DidacticUnitStore,
    ownerId: string
) {
    const folders = await ensureDefaultFolders(folderStore, ownerId)
    const didacticUnits = await didacticUnitStore.listByOwner(ownerId)
    const unitCounts = didacticUnits.reduce<Map<string, number>>((counts, didacticUnit) => {
        counts.set(
            didacticUnit.folderId,
            (counts.get(didacticUnit.folderId) ?? 0) + 1
        )
        return counts
    }, new Map())

    return folders.map((folder) => ({
        ...buildFolderResponse(folder),
        unitCount: unitCounts.get(folder.id) ?? 0,
    }))
}

function resolveFolderSelectionForManualMode(
    folderSelection: {
        mode: 'manual' | 'auto'
        folderId?: string
    },
    foldersById: Map<string, Folder>
) {
    if (folderSelection.mode !== 'manual') {
        return folderSelection
    }

    const selectedFolder = folderSelection.folderId
        ? foldersById.get(folderSelection.folderId)
        : null

    if (!selectedFolder) {
        throw new Error('Selected folder was not found.')
    }

    return {
        mode: 'manual' as const,
        folderId: selectedFolder.id,
    }
}

async function resolveAutoAssignedFolderSelection(input: {
    didacticUnit: DidacticUnit
    folderStore: FolderStore
    aiConfigStore: AiConfigStore
    aiService: AiService
    abortSignal?: AbortSignal
}): Promise<{
    folderId: string
    result?: FolderClassificationResult
}> {
    const folders = await ensureDefaultFolders(input.folderStore, input.didacticUnit.ownerId)
    const generalFolder = folders.find((folder) => folder.slug === 'general')

    if (!generalFolder) {
        throw new Error('General folder could not be resolved.')
    }

    try {
        const config = await input.aiConfigStore.get(input.didacticUnit.ownerId)
        const result = await input.aiService.classifyFolder({
            topic: input.didacticUnit.topic,
            additionalContext: input.didacticUnit.additionalContext,
            folders: folders.map((folder) => ({
                name: folder.name,
                description: buildFolderDescription(folder),
            })),
            config,
            tier: 'cheap',
            abortSignal: input.abortSignal,
        })

        const matchedFolder =
            folders.find(
                (folder) =>
                    folder.name.toLowerCase() === result.folderName.trim().toLowerCase()
            ) ?? generalFolder

        return {
            folderId: matchedFolder.id,
            result,
        }
    } catch {
        return { folderId: generalFolder.id }
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

    if (!promptSource.syllabus?.modules?.[chapterIndex]) {
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
    const folderStore = options.folderStore
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

    app.get('/api/folders', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        response.json({
            folders: await listFoldersWithUnitCounts(
                folderStore,
                didacticUnitStore,
                requestWithMockOwner.mockOwner.id
            ),
        })
    })

    app.post('/api/folders', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        try {
            if (!request.body || typeof request.body !== 'object') {
                throw new Error('Request body must be a JSON object.')
            }

            const payload = request.body as { name?: unknown }
            const name = normalizeFolderName(
                typeof payload.name === 'string' ? payload.name : ''
            )

            if (!name) {
                throw new Error('Folder name is required.')
            }

            const slug = slugifyFolderName(name)

            if (!slug) {
                throw new Error('Folder name must include letters or numbers.')
            }

            await ensureDefaultFolders(folderStore, requestWithMockOwner.mockOwner.id)
            const existingFolder = await folderStore.getBySlug(
                requestWithMockOwner.mockOwner.id,
                slug
            )

            if (existingFolder) {
                throw new Error('A folder with that name already exists.')
            }

            const folder = await folderStore.create({
                ownerId: requestWithMockOwner.mockOwner.id,
                name,
                slug,
                kind: 'custom',
                icon: CUSTOM_FOLDER_ICON,
                color: CUSTOM_FOLDER_COLOR,
            })

            response.status(201).json({
                ...buildFolderResponse(folder),
                unitCount: 0,
            })
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid folder request.',
            })
        }
    })

    app.post('/api/didactic-unit', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        try {
            const input = parseCreateDidacticUnitInput(request.body)
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const foldersById = await loadFoldersById(
                folderStore,
                requestWithMockOwner.mockOwner.id
            )
            const generalFolder = await getGeneralFolder(
                folderStore,
                requestWithMockOwner.mockOwner.id
            )
            const resolvedFolderSelection =
                input.folderSelection.mode === 'manual'
                    ? resolveFolderSelectionForManualMode(input.folderSelection, foldersById)
                    : {
                          mode: 'auto' as const,
                          folderId: generalFolder.id,
                      }
            const didacticUnit = createDidacticUnit(
                {
                    ...input,
                    provider: resolveCompatibilityProvider(config, input.provider),
                    folderSelection: resolvedFolderSelection,
                },
                requestWithMockOwner.mockOwner.id
            )

            await didacticUnitStore.save(didacticUnit)
            response.status(201).json(await buildDidacticUnitResponse(didacticUnit, folderStore))
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid didactic unit request.',
            })
        }
    })

    app.get('/api/didactic-unit', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnits = await didacticUnitStore.listByOwner(requestWithMockOwner.mockOwner.id)

        response.json({
            didacticUnits: await buildDidacticUnitSummaryResponses(
                didacticUnits,
                folderStore,
                requestWithMockOwner.mockOwner.id
            ),
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

        response.json(await buildDidacticUnitResponse(didacticUnit, folderStore))
    })

    app.delete('/api/didactic-unit/:id', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const deleted = await didacticUnitStore.deleteById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!deleted) {
            response.status(404).json({ error: 'Didactic unit not found.' })
            return
        }

        response.status(204).end()
    })

    app.patch('/api/didactic-unit/:id/folder', async (request, response) => {
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
            const parsedInput = parseUpdateDidacticUnitFolderInput(request.body)
            const foldersById = await loadFoldersById(
                folderStore,
                requestWithMockOwner.mockOwner.id
            )

            const updatedDidacticUnit =
                parsedInput.folderSelection.mode === 'manual'
                    ? updateDidacticUnitFolder(
                          didacticUnit,
                          resolveFolderSelectionForManualMode(
                              parsedInput.folderSelection,
                              foldersById
                          )
                      )
                    : updateDidacticUnitFolder(didacticUnit, {
                          mode: 'auto',
                          folderId:
                              (
                                  await resolveAutoAssignedFolderSelection({
                                      didacticUnit,
                                      folderStore,
                                      aiConfigStore,
                                      aiService,
                                  })
                              ).folderId,
                      })

            await didacticUnitStore.save(updatedDidacticUnit)
            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid didactic unit folder update request.',
            })
        }
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
            response.json(await buildDidacticUnitResponse(didacticUnit, folderStore))
            return
        }

        try {
            const config = await aiConfigStore.get(requestWithMockOwner.mockOwner.id)
            const moderation = await aiService.moderateTopic({
                topic: didacticUnit.topic,
                level: didacticUnit.level,
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
            const folderResolvedDidacticUnit =
                moderatedDidacticUnit.folderAssignmentMode === 'auto'
                    ? updateDidacticUnitFolder(moderatedDidacticUnit, {
                          mode: 'auto',
                          folderId:
                              (
                                  await resolveAutoAssignedFolderSelection({
                                      didacticUnit: moderatedDidacticUnit,
                                      folderStore,
                                      aiConfigStore,
                                      aiService,
                                      abortSignal: createAbortSignal(request),
                                  })
                              ).folderId,
                      })
                    : moderatedDidacticUnit
            await didacticUnitStore.save(folderResolvedDidacticUnit)
            response.json(await buildDidacticUnitResponse(folderResolvedDidacticUnit, folderStore))
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
                data: await buildDidacticUnitResponse(didacticUnit, folderStore),
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
                    level: didacticUnit.level,
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
            const folderResolvedDidacticUnit =
                moderatedDidacticUnit.folderAssignmentMode === 'auto'
                    ? updateDidacticUnitFolder(moderatedDidacticUnit, {
                          mode: 'auto',
                          folderId:
                              (
                                  await resolveAutoAssignedFolderSelection({
                                      didacticUnit: moderatedDidacticUnit,
                                      folderStore,
                                      aiConfigStore,
                                      aiService,
                                      abortSignal: createAbortSignal(request),
                                  })
                              ).folderId,
                      })
                    : moderatedDidacticUnit
            await didacticUnitStore.save(folderResolvedDidacticUnit)
            writeNdjsonEvent(response, {
                type: 'complete',
                data: await buildDidacticUnitResponse(folderResolvedDidacticUnit, folderStore),
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
                level: didacticUnit.level,
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
            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
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
                    level: didacticUnit.level,
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
                data: await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
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
            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
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
            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
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
                level: preparedDidacticUnit.level,
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
            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
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
                    level: preparedDidacticUnit.level,
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
                    onPartial: async (partial) => {
                        writeNdjsonEvent(response, {
                            type: 'partial_structured',
                            data: partial,
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
                data: await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
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
            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
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
            response.json(await buildDidacticUnitResponse(approvedDidacticUnit, folderStore))
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
            .map((chapter) => `# ${chapter.title}\n\n${chapter.markdown}`)
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
            planningOverview: plannedChapter.overview,
            content: generatedChapter?.markdown ?? null,
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
            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
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
            const plannedChapter = updatedDidacticUnit.chapters[chapterIndex]

            response.json(
                updatedChapter && plannedChapter
                    ? {
                          chapterIndex,
                          title: updatedChapter.title,
                          planningOverview: plannedChapter.overview,
                          content: updatedChapter.markdown,
                          presentationSettings:
                              resolveDidacticUnitChapterPresentationSettings(
                                  updatedChapter.presentationSettings
                              ),
                          generatedAt: updatedChapter.generatedAt,
                          updatedAt: updatedChapter.updatedAt,
                          state: 'ready',
                          isCompleted:
                              updatedDidacticUnit.completedChapters?.some(
                                  (chapter) => chapter.chapterIndex === chapterIndex
                              ) ?? false,
                          completedAt: updatedDidacticUnit.completedChapters?.find(
                              (chapter) => chapter.chapterIndex === chapterIndex
                          )?.completedAt,
                      }
                    : null
            )
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
                          level: didacticUnit.level,
                          syllabus:
                              didacticUnit.referenceSyllabus ??
                              adaptDidacticUnitSyllabusToReferenceSyllabus({
                                  topic: didacticUnit.topic,
                                  syllabus:
                                      didacticUnit.syllabus ?? {
                                          title: didacticUnit.title,
                                          overview: didacticUnit.overview,
                                          learningGoals: didacticUnit.learningGoals,
                                          keywords: didacticUnit.keywords,
                                          chapters: didacticUnit.chapters,
                                      },
                              }),
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
                      level: didacticUnit.level,
                      syllabus:
                          didacticUnit.referenceSyllabus ??
                          adaptDidacticUnitSyllabusToReferenceSyllabus({
                              topic: didacticUnit.topic,
                              syllabus:
                                  didacticUnit.syllabus ?? {
                                      title: didacticUnit.title,
                                      overview: didacticUnit.overview,
                                      learningGoals: didacticUnit.learningGoals,
                                      keywords: didacticUnit.keywords,
                                      chapters: didacticUnit.chapters,
                                  },
                          }),
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
                    data: await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
                })
                response.end()
                return
            }

            response.json(await buildDidacticUnitResponse(updatedDidacticUnit, folderStore))
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
