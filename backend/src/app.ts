import express from 'express'
import {
    createDidacticUnitFromApprovedUnitInit,
} from './didactic-unit/create-didactic-unit.js'
import { parseUpdateDidacticUnitChapterInput } from './didactic-unit/didactic-unit-chapter.js'
import { generateDidacticUnitChapter } from './didactic-unit/generate-didactic-unit-chapter.js'
import { listDidacticUnitChapters } from './didactic-unit/list-didactic-unit-chapters.js'
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
import { approveSyllabus } from './unit-init/approve-syllabus.js'
import {
    answerQuestionnaire,
    parseQuestionnaireAnswersInput,
} from './unit-init/answer-questionnaire.js'
import {
    createUnitInit,
    moderateUnitInit,
    parseCreateUnitInitInput,
} from './unit-init/create-unit-init.js'
import { generateQuestionnaire } from './unit-init/generate-questionnaire.js'
import { generateSyllabus } from './unit-init/generate-syllabus.js'
import { generateSyllabusPrompt } from './unit-init/generate-syllabus-prompt.js'
import {
    parseUpdateSyllabusInput,
    updateSyllabus,
} from './unit-init/update-syllabus.js'
import type { UnitInitStore } from './unit-init/unit-init-store.js'

export interface CreateAppOptions {
    unitInitStore: UnitInitStore
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

function canCreateSyllabusGenerationRun(unitInit: {
    status: string
    syllabusPrompt?: string
}): boolean {
    return unitInit.status === 'syllabus_prompt_ready' && Boolean(unitInit.syllabusPrompt?.trim())
}

function canBuildChapterGenerationPrompt(
    unitInit: { syllabus?: { chapters?: unknown[] } | undefined },
    chapterIndex: number
): boolean {
    return Boolean(unitInit.syllabus?.chapters?.[chapterIndex])
}

function isSyllabusGenerationRun(
    run: SyllabusGenerationRunRecord | ChapterGenerationRunRecord
): run is SyllabusGenerationRunRecord {
    return run.stage === 'syllabus'
}

function compareRunsByCreatedAtDesc(
    left: SyllabusGenerationRunRecord | ChapterGenerationRunRecord,
    right: SyllabusGenerationRunRecord | ChapterGenerationRunRecord
): number {
    return right.createdAt.localeCompare(left.createdAt)
}

export function createApp(options: CreateAppOptions) {
    const app = express()
    const unitInitStore = options.unitInitStore
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

    app.post('/api/unit-init', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        try {
            const input = parseCreateUnitInitInput(request.body)
            const unitInit = createUnitInit(input, requestWithMockOwner.mockOwner.id)
            await unitInitStore.save(unitInit)

            response.status(201).json(unitInit)
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid unit-init request.',
            })
        }
    })

    app.get('/api/unit-init', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        response.json({
            unitInits: await unitInitStore.listByOwner(requestWithMockOwner.mockOwner.id),
        })
    })

    app.get('/api/didactic-unit', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        response.json({
            didacticUnits: await didacticUnitStore.listByOwner(
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
            response.status(404).json({
                error: 'Didactic unit not found.',
            })
            return
        }

        response.json(didacticUnit)
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

        response.json({
            chapters: listDidacticUnitChapters(didacticUnit),
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

        const generatedChapter = didacticUnit.generatedChapters?.find(
            (chapter) => chapter.chapterIndex === chapterIndex
        )

        if (!generatedChapter) {
            response.status(404).json({
                error: 'Generated didactic unit chapter not found.',
            })
            return
        }

        response.json(generatedChapter)
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

        const [syllabusRuns, chapterRuns] = await Promise.all([
            generationRunStore.listByUnitInit(
                requestWithMockOwner.mockOwner.id,
                didacticUnit.unitInitId
            ),
            generationRunStore.listByDidacticUnit(
                requestWithMockOwner.mockOwner.id,
                didacticUnit.id
            ),
        ])

        const runs: Array<SyllabusGenerationRunRecord | ChapterGenerationRunRecord> = [
            ...syllabusRuns.filter(isSyllabusGenerationRun),
            ...chapterRuns,
        ]

        response.json({
            runs: runs.sort(compareRunsByCreatedAtDesc),
        })
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
                chapterGenerator
            )
            await didacticUnitStore.save(updatedDidacticUnit)

            const generatedChapter = updatedDidacticUnit.generatedChapters?.find(
                (chapter) => chapter.chapterIndex === chapterIndex
            )

            if (generatedChapter) {
                await generationRunStore.save(
                    createCompletedChapterGenerationRunRecord({
                        unitInitId: updatedDidacticUnit.unitInitId,
                        didacticUnitId: updatedDidacticUnit.id,
                        ownerId: updatedDidacticUnit.ownerId,
                        chapterIndex,
                        provider: updatedDidacticUnit.provider,
                        model: resolveChapterGeneratorModel(updatedDidacticUnit.provider),
                        prompt: buildChapterGenerationPrompt(
                            {
                                id: updatedDidacticUnit.unitInitId,
                                ownerId: updatedDidacticUnit.ownerId,
                                topic: updatedDidacticUnit.topic,
                                provider: updatedDidacticUnit.provider,
                                status: 'syllabus_approved',
                                nextAction: 'generate_unit_content',
                                createdAt: updatedDidacticUnit.createdAt,
                                questionnaireAnswers: updatedDidacticUnit.questionnaireAnswers,
                                syllabus: {
                                    title: updatedDidacticUnit.title,
                                    overview: updatedDidacticUnit.overview,
                                    learningGoals: updatedDidacticUnit.learningGoals,
                                    chapters: updatedDidacticUnit.chapters,
                                },
                                syllabusApprovedAt: updatedDidacticUnit.createdAt,
                            },
                            chapterIndex
                        ),
                        chapter: generatedChapter,
                        createdAt: generatedChapter.generatedAt,
                    })
                )
            }

            response.json(updatedDidacticUnit)
        } catch (error) {
            const promptSource = {
                id: didacticUnit.unitInitId,
                ownerId: didacticUnit.ownerId,
                topic: didacticUnit.topic,
                provider: didacticUnit.provider,
                status: 'syllabus_approved' as const,
                nextAction: 'generate_unit_content' as const,
                createdAt: didacticUnit.createdAt,
                questionnaireAnswers: didacticUnit.questionnaireAnswers,
                syllabus: {
                    title: didacticUnit.title,
                    overview: didacticUnit.overview,
                    learningGoals: didacticUnit.learningGoals,
                    chapters: didacticUnit.chapters,
                },
                syllabusApprovedAt: didacticUnit.createdAt,
            }

            if (canBuildChapterGenerationPrompt(promptSource, chapterIndex)) {
                await generationRunStore.save(
                    createFailedChapterGenerationRunRecord({
                        unitInitId: didacticUnit.unitInitId,
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

    app.get('/api/unit-init/:id', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        response.json(unitInit)
    })

    app.get('/api/unit-init/:id/syllabus/runs', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        response.json({
            runs: (
                await generationRunStore.listByUnitInit(
                    requestWithMockOwner.mockOwner.id,
                    request.params.id
                )
            ).filter(isSyllabusGenerationRun),
        })
    })

    app.get('/api/unit-init/:id/runs', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        response.json({
            runs: await generationRunStore.listByUnitInit(
                requestWithMockOwner.mockOwner.id,
                request.params.id
            ),
        })
    })

    app.post('/api/unit-init/:id/moderate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        try {
            const moderatedUnitInit = moderateUnitInit(unitInit)
            await unitInitStore.save(moderatedUnitInit)
            response.json(moderatedUnitInit)
        } catch (error) {
            response.status(409).json({
                error: error instanceof Error ? error.message : 'Unit init moderation failed.',
            })
        }
    })

    app.post('/api/unit-init/:id/questionnaire/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        try {
            const updatedUnitInit = generateQuestionnaire(unitInit)
            await unitInitStore.save(updatedUnitInit)
            response.json(updatedUnitInit)
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unit init questionnaire generation failed.',
            })
        }
    })

    app.patch('/api/unit-init/:id/questionnaire/answers', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
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
            const updatedUnitInit = answerQuestionnaire(unitInit, parsedInput)
            await unitInitStore.save(updatedUnitInit)
            response.json(updatedUnitInit)
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unit init questionnaire answer submission failed.',
            })
        }
    })

    app.post('/api/unit-init/:id/syllabus-prompt/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        try {
            const updatedUnitInit = generateSyllabusPrompt(unitInit)
            await unitInitStore.save(updatedUnitInit)
            response.json(updatedUnitInit)
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unit init syllabus prompt generation failed.',
            })
        }
    })

    app.post('/api/unit-init/:id/syllabus/generate', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        try {
            const updatedUnitInit = await generateSyllabus(unitInit, syllabusGenerator)
            await unitInitStore.save(updatedUnitInit)
            await generationRunStore.save(
                createCompletedSyllabusGenerationRunRecord({
                    unitInitId: updatedUnitInit.id,
                    ownerId: updatedUnitInit.ownerId,
                    provider: updatedUnitInit.provider,
                    model: resolveSyllabusGeneratorModel(updatedUnitInit.provider),
                    prompt: updatedUnitInit.syllabusPrompt ?? '',
                    syllabus: updatedUnitInit.syllabus!,
                    createdAt: updatedUnitInit.syllabusGeneratedAt ?? new Date().toISOString(),
                })
            )
            response.json(updatedUnitInit)
        } catch (error) {
            if (canCreateSyllabusGenerationRun(unitInit)) {
                await generationRunStore.save(
                    createFailedSyllabusGenerationRunRecord({
                        unitInitId: unitInit.id,
                        ownerId: unitInit.ownerId,
                        provider: unitInit.provider,
                        model: resolveSyllabusGeneratorModel(unitInit.provider),
                        prompt: unitInit.syllabusPrompt ?? '',
                        rawOutput:
                            error instanceof OpenAiSyllabusGenerationError ||
                            error instanceof DeepSeekSyllabusGenerationError
                                ? error.rawOutput
                                : undefined,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Unit init syllabus generation failed.',
                        createdAt: new Date().toISOString(),
                    })
                )
            }

            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unit init syllabus generation failed.',
            })
        }
    })

    app.patch('/api/unit-init/:id/syllabus', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        let parsedInput
        try {
            parsedInput = parseUpdateSyllabusInput(request.body)
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid syllabus update request.',
            })
            return
        }

        try {
            const updatedUnitInit = updateSyllabus(unitInit, parsedInput)
            await unitInitStore.save(updatedUnitInit)
            response.json(updatedUnitInit)
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unit init syllabus update failed.',
            })
        }
    })

    app.post('/api/unit-init/:id/approve-syllabus', async (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = await unitInitStore.getById(
            requestWithMockOwner.mockOwner.id,
            request.params.id
        )

        if (!unitInit) {
            response.status(404).json({
                error: 'Unit init not found.',
            })
            return
        }

        try {
            const updatedUnitInit = approveSyllabus(unitInit)
            await unitInitStore.save(updatedUnitInit)
            const didacticUnit = createDidacticUnitFromApprovedUnitInit(updatedUnitInit)
            await didacticUnitStore.save(didacticUnit)
            response.json(updatedUnitInit)
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unit init syllabus approval failed.',
            })
        }
    })

    return app
}
