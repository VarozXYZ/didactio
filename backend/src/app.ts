import express from 'express'
import {
    createDidacticUnit,
    type DidacticUnit,
} from './didactic-unit/create-didactic-unit.js'
import { completeDidacticUnitChapter } from './didactic-unit/complete-didactic-unit-chapter.js'
import { parseUpdateDidacticUnitChapterInput } from './didactic-unit/didactic-unit-chapter.js'
import {
    createChapterGenerationSourceFromDidacticUnit,
    generateDidacticUnitChapter,
    hasGeneratedDidacticUnitChapter,
} from './didactic-unit/generate-didactic-unit-chapter.js'
import { listDidacticUnitChapters } from './didactic-unit/list-didactic-unit-chapters.js'
import {
    answerDidacticUnitQuestionnaire,
    approveDidacticUnitSyllabus,
    generateDidacticUnitQuestionnaire,
    generateDidacticUnitSyllabus,
    generateDidacticUnitSyllabusPrompt,
    moderateDidacticUnitPlanning,
    updateDidacticUnitSyllabus,
} from './didactic-unit/planning-lifecycle.js'
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
import { DeepSeekChapterGenerationError } from './providers/deepseek-chapter-generator.js'
import { DeepSeekSyllabusGenerationError } from './providers/deepseek-syllabus-generator.js'
import { OpenAiSyllabusGenerationError } from './providers/openai-syllabus-generator.js'
import {
    buildChapterGenerationPrompt,
    ProviderBackedFakeChapterGenerator,
    resolveChapterGeneratorModel,
    type ChapterGenerator,
} from './providers/chapter-generator.js'
import { OpenAiChapterGenerationError } from './providers/openai-chapter-generator.js'
import { attachMockOwner, type RequestWithMockOwner } from './middleware/mock-owner.js'
import {
    disconnectedMongoHealthStatus,
    type MongoHealthStatus,
} from './mongo/mongo-connection.js'
import {
    ProviderBackedFakeSyllabusGenerator,
    resolveSyllabusGeneratorModel,
    type SyllabusGenerator,
} from './providers/syllabus-generator.js'
import {
    parseCreateDidacticUnitInput,
    parseQuestionnaireAnswersInput,
    parseUpdateDidacticUnitSyllabusInput,
} from './didactic-unit/planning.js'

export interface CreateAppOptions {
    didacticUnitStore: DidacticUnitStore
    generationRunStore: GenerationRunStore
    syllabusGenerator?: SyllabusGenerator
    chapterGenerator?: ChapterGenerator
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

function canCreateSyllabusGenerationRun(didacticUnit: {
    status: string
    syllabusPrompt?: string
}): boolean {
    return (
        didacticUnit.status === 'syllabus_prompt_ready' &&
        Boolean(didacticUnit.syllabusPrompt?.trim())
    )
}

function canBuildChapterGenerationPrompt(
    didacticUnit: { syllabus?: { chapters?: unknown[] } | undefined },
    chapterIndex: number
): boolean {
    return Boolean(didacticUnit.syllabus?.chapters?.[chapterIndex])
}

function compareRunsByCreatedAtDesc(
    left: SyllabusGenerationRunRecord | ChapterGenerationRunRecord,
    right: SyllabusGenerationRunRecord | ChapterGenerationRunRecord
): number {
    return right.createdAt.localeCompare(left.createdAt)
}

function buildDidacticUnitResponse(didacticUnit: DidacticUnit) {
    const { ...restDidacticUnit } = didacticUnit

    return {
        ...restDidacticUnit,
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

export function createApp(options: CreateAppOptions) {
    const app = express()
    const didacticUnitStore = options.didacticUnitStore
    const generationRunStore = options.generationRunStore
    const syllabusGenerator =
        options.syllabusGenerator ?? new ProviderBackedFakeSyllabusGenerator()
    const chapterGenerator =
        options.chapterGenerator ?? new ProviderBackedFakeChapterGenerator()
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

    app.post('/api/didactic-unit', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        try {
            const input = parseCreateDidacticUnitInput(request.body)
            const didacticUnit = createDidacticUnit(input, requestWithMockOwner.mockOwner.id)
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
            return
        }

        try {
            const moderatedDidacticUnit = moderateDidacticUnitPlanning(didacticUnit)
            await didacticUnitStore.save(moderatedDidacticUnit)
            response.json(buildDidacticUnitResponse(moderatedDidacticUnit))
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error ? error.message : 'Didactic unit moderation failed.',
            })
        }
    })

    app.post('/api/didactic-unit/:id/questionnaire/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
            return
        }

        try {
            const updatedDidacticUnit = generateDidacticUnitQuestionnaire(didacticUnit)
            await didacticUnitStore.save(updatedDidacticUnit)
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Didactic unit questionnaire generation failed.',
            })
        }
    })

    app.patch('/api/didactic-unit/:id/questionnaire/answers', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
            return
        }

        try {
            const updatedDidacticUnit = generateDidacticUnitSyllabusPrompt(didacticUnit)
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
            return
        }

        try {
            const updatedDidacticUnit = await generateDidacticUnitSyllabus(
                didacticUnit,
                syllabusGenerator
            )
            await didacticUnitStore.save(updatedDidacticUnit)
            await generationRunStore.save(
                createCompletedSyllabusGenerationRunRecord({
                    didacticUnitId: updatedDidacticUnit.id,
                    ownerId: updatedDidacticUnit.ownerId,
                    provider: updatedDidacticUnit.provider,
                    model: resolveSyllabusGeneratorModel(updatedDidacticUnit.provider),
                    prompt: updatedDidacticUnit.syllabusPrompt ?? '',
                    syllabus: updatedDidacticUnit.syllabus!,
                    createdAt:
                        updatedDidacticUnit.syllabusGeneratedAt ?? new Date().toISOString(),
                })
            )
            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            if (canCreateSyllabusGenerationRun(didacticUnit)) {
                await generationRunStore.save(
                    createFailedSyllabusGenerationRunRecord({
                        didacticUnitId: didacticUnit.id,
                        ownerId: didacticUnit.ownerId,
                        provider: didacticUnit.provider,
                        model: resolveSyllabusGeneratorModel(didacticUnit.provider),
                        prompt: didacticUnit.syllabusPrompt ?? '',
                        rawOutput:
                            error instanceof OpenAiSyllabusGenerationError ||
                            error instanceof DeepSeekSyllabusGenerationError
                                ? error.rawOutput
                                : undefined,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Didactic unit syllabus generation failed.',
                        createdAt: new Date().toISOString(),
                    })
                )
            }

            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Didactic unit syllabus generation failed.',
            })
        }
    })

    app.patch('/api/didactic-unit/:id/syllabus', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
            return
        }

        try {
            const approvedDidacticUnit = approveDidacticUnitSyllabus(didacticUnit)
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

    app.get('/api/didactic-unit/:id/chapters', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit chapter not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit chapter revisions not found.',
            })
            return
        }

        response.json({
            revisions,
        })
    })

    app.get('/api/didactic-unit/:id/runs', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            ).json({
                error: message,
            })
        }
    })

    app.patch('/api/didactic-unit/:id/chapters/:chapterIndex', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
            ).json({
                error: message,
            })
        }
    })

    app.post('/api/didactic-unit/:id/chapters/:chapterIndex/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
                        : 'Invalid didactic unit chapter generation request.',
            })
            return
        }

        try {
            const updatedDidacticUnit = await generateDidacticUnitChapter(
                didacticUnit,
                chapterIndex,
                chapterGenerator,
                'ai_generation'
            )
            await didacticUnitStore.save(updatedDidacticUnit)

            const generatedChapter = updatedDidacticUnit.generatedChapters?.find(
                (chapter) => chapter.chapterIndex === chapterIndex
            )

            if (generatedChapter) {
                await generationRunStore.save(
                    createCompletedChapterGenerationRunRecord({
                        didacticUnitId: updatedDidacticUnit.id,
                        ownerId: updatedDidacticUnit.ownerId,
                        chapterIndex,
                        provider: updatedDidacticUnit.provider,
                        model: resolveChapterGeneratorModel(updatedDidacticUnit.provider),
                        prompt: buildChapterGenerationPrompt(
                            createChapterGenerationSourceFromDidacticUnit(
                                updatedDidacticUnit
                            ),
                            chapterIndex
                        ),
                        chapter: generatedChapter,
                        createdAt: generatedChapter.generatedAt,
                    })
                )
            }

            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            const promptSource = createChapterGenerationSourceFromDidacticUnit(didacticUnit)

            if (canBuildChapterGenerationPrompt(promptSource, chapterIndex)) {
                await generationRunStore.save(
                    createFailedChapterGenerationRunRecord({
                        didacticUnitId: didacticUnit.id,
                        ownerId: didacticUnit.ownerId,
                        chapterIndex,
                        provider: didacticUnit.provider,
                        model: resolveChapterGeneratorModel(didacticUnit.provider),
                        prompt: buildChapterGenerationPrompt(promptSource, chapterIndex),
                        rawOutput:
                            error instanceof OpenAiChapterGenerationError ||
                            error instanceof DeepSeekChapterGenerationError
                                ? error.rawOutput
                                : undefined,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Didactic unit chapter generation failed.',
                        createdAt: new Date().toISOString(),
                    })
                )
            }

            const message =
                error instanceof Error
                    ? error.message
                    : 'Didactic unit chapter generation failed.'

            response.status(
                message === 'Chapter index is out of range for the approved syllabus.'
                    ? 400
                    : 409
            ).json({
                error: message,
            })
        }
    })

    app.post('/api/didactic-unit/:id/chapters/:chapterIndex/regenerate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const didacticUnit = await didacticUnitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!didacticUnit) {
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
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
                        : 'Invalid didactic unit chapter regeneration request.',
            })
            return
        }

        if (!hasGeneratedDidacticUnitChapter(didacticUnit, chapterIndex)) {
            response.status(404).json({
                error: 'Generated didactic unit chapter not found.',
            })
            return
        }

        try {
            const updatedDidacticUnit = await generateDidacticUnitChapter(
                didacticUnit,
                chapterIndex,
                chapterGenerator,
                'ai_regeneration'
            )
            await didacticUnitStore.save(updatedDidacticUnit)

            const regeneratedChapter = updatedDidacticUnit.generatedChapters?.find(
                (chapter) => chapter.chapterIndex === chapterIndex
            )

            if (regeneratedChapter) {
                await generationRunStore.save(
                    createCompletedChapterGenerationRunRecord({
                        didacticUnitId: updatedDidacticUnit.id,
                        ownerId: updatedDidacticUnit.ownerId,
                        chapterIndex,
                        provider: updatedDidacticUnit.provider,
                        model: resolveChapterGeneratorModel(updatedDidacticUnit.provider),
                        prompt: buildChapterGenerationPrompt(
                            createChapterGenerationSourceFromDidacticUnit(
                                updatedDidacticUnit
                            ),
                            chapterIndex
                        ),
                        chapter: regeneratedChapter,
                        createdAt: regeneratedChapter.generatedAt,
                    })
                )
            }

            response.json(buildDidacticUnitResponse(updatedDidacticUnit))
        } catch (error) {
            const promptSource = createChapterGenerationSourceFromDidacticUnit(didacticUnit)

            if (canBuildChapterGenerationPrompt(promptSource, chapterIndex)) {
                await generationRunStore.save(
                    createFailedChapterGenerationRunRecord({
                        didacticUnitId: didacticUnit.id,
                        ownerId: didacticUnit.ownerId,
                        chapterIndex,
                        provider: didacticUnit.provider,
                        model: resolveChapterGeneratorModel(didacticUnit.provider),
                        prompt: buildChapterGenerationPrompt(promptSource, chapterIndex),
                        rawOutput:
                            error instanceof OpenAiChapterGenerationError ||
                            error instanceof DeepSeekChapterGenerationError
                                ? error.rawOutput
                                : undefined,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Didactic unit chapter regeneration failed.',
                        createdAt: new Date().toISOString(),
                    })
                )
            }

            const message =
                error instanceof Error
                    ? error.message
                    : 'Didactic unit chapter regeneration failed.'

            response.status(
                message === 'Chapter index is out of range for the approved syllabus.'
                    ? 400
                    : 409
            ).json({
                error: message,
            })
        }
    })

    return app
}
