import express from 'express'
import {
    InMemoryChapterGenerationRunStore,
    createChapterGenerationRun,
    type ChapterGenerationRunStore,
} from './generation-runs/chapter-generation-run-store.js'
import {
    InMemorySyllabusGenerationRunStore,
    createSyllabusGenerationRun,
    type SyllabusGenerationRunStore,
} from './generation-runs/syllabus-generation-run-store.js'
import {
    buildChapterGenerationPrompt,
    ProviderBackedFakeChapterGenerator,
    resolveChapterGeneratorModel,
    type ChapterGenerator,
} from './providers/chapter-generator.js'
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
import { generateChapterContent } from './unit-init/generate-chapter-content.js'
import { generateQuestionnaire } from './unit-init/generate-questionnaire.js'
import { generateSyllabus } from './unit-init/generate-syllabus.js'
import { generateSyllabusPrompt } from './unit-init/generate-syllabus-prompt.js'
import { listChapters } from './unit-init/list-chapters.js'
import {
    parseUpdateChapterContentInput,
    updateChapterContent,
} from './unit-init/update-chapter-content.js'
import {
    parseUpdateSyllabusInput,
    updateSyllabus,
} from './unit-init/update-syllabus.js'
import { InMemoryUnitInitStore, type UnitInitStore } from './unit-init/unit-init-store.js'

interface CreateAppOptions {
    unitInitStore?: UnitInitStore
    chapterGenerationRunStore?: ChapterGenerationRunStore
    syllabusGenerationRunStore?: SyllabusGenerationRunStore
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

export function createApp(options: CreateAppOptions = {}) {
    const app = express()
    const unitInitStore = options.unitInitStore ?? new InMemoryUnitInitStore()
    const chapterGenerationRunStore =
        options.chapterGenerationRunStore ?? new InMemoryChapterGenerationRunStore()
    const syllabusGenerationRunStore =
        options.syllabusGenerationRunStore ?? new InMemorySyllabusGenerationRunStore()
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

    app.get('/api/unit-init/:id/chapters', async (request, response) => {
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
            response.json({
                chapters: listChapters(unitInit),
            })
        } catch (error) {
            response.status(409).json({
                error:
                    error instanceof Error ? error.message : 'Unit init chapter list failed.',
            })
        }
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
            runs: await syllabusGenerationRunStore.listByUnitInit(
                requestWithMockOwner.mockOwner.id,
                request.params.id
            ),
        })
    })

    app.get('/api/unit-init/:id/chapters/runs', async (request, response) => {
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
            runs: await chapterGenerationRunStore.listByUnitInit(
                requestWithMockOwner.mockOwner.id,
                request.params.id
            ),
        })
    })

    app.get('/api/unit-init/:id/chapters/:chapterIndex', async (request, response) => {
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

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(request.params.chapterIndex)
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid chapter lookup request.',
            })
            return
        }

        const generatedChapter = unitInit.generatedChapters?.find(
            (chapter) => chapter.chapterIndex === chapterIndex
        )

        if (!generatedChapter) {
            response.status(404).json({
                error: 'Generated chapter not found.',
            })
            return
        }

        response.json(generatedChapter)
    })

    app.patch('/api/unit-init/:id/chapters/:chapterIndex', async (request, response) => {
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

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(request.params.chapterIndex)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error ? error.message : 'Invalid chapter update request.',
            })
            return
        }

        let parsedInput
        try {
            parsedInput = parseUpdateChapterContentInput(request.body)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error ? error.message : 'Invalid chapter update request.',
            })
            return
        }

        try {
            const updatedUnitInit = updateChapterContent(unitInit, chapterIndex, parsedInput)
            await unitInitStore.save(updatedUnitInit)
            const updatedChapter = updatedUnitInit.generatedChapters?.find(
                (chapter) => chapter.chapterIndex === chapterIndex
            )

            response.json(updatedChapter)
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Unit init chapter update failed.'

            response.status(message === 'Generated chapter not found.' ? 404 : 409).json({
                error: message,
            })
        }
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
            await syllabusGenerationRunStore.save(
                createSyllabusGenerationRun({
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

    app.post('/api/unit-init/:id/chapters/:chapterIndex/generate', async (request, response) => {
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

        let chapterIndex
        try {
            chapterIndex = parseChapterIndex(request.params.chapterIndex)
        } catch (error) {
            response.status(400).json({
                error:
                    error instanceof Error
                        ? error.message
                        : 'Invalid chapter generation request.',
            })
            return
        }

        try {
            const updatedUnitInit = await generateChapterContent(
                unitInit,
                chapterIndex,
                chapterGenerator
            )
            await unitInitStore.save(updatedUnitInit)
            const generatedChapter = updatedUnitInit.generatedChapters?.find(
                (chapter) => chapter.chapterIndex === chapterIndex
            )

            if (generatedChapter) {
                await chapterGenerationRunStore.save(
                    createChapterGenerationRun({
                        unitInitId: updatedUnitInit.id,
                        ownerId: updatedUnitInit.ownerId,
                        chapterIndex,
                        provider: updatedUnitInit.provider,
                        model: resolveChapterGeneratorModel(updatedUnitInit.provider),
                        prompt: buildChapterGenerationPrompt(updatedUnitInit, chapterIndex),
                        chapter: generatedChapter,
                        createdAt: generatedChapter.generatedAt,
                    })
                )
            }

            response.json(updatedUnitInit)
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unit init chapter generation failed.'

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
