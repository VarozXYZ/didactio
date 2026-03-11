import express from 'express'
import { attachMockOwner, type RequestWithMockOwner } from './middleware/mock-owner.js'
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
import { InMemoryUnitInitStore, type UnitInitStore } from './unit-init/unit-init-store.js'

interface CreateAppOptions {
    unitInitStore?: UnitInitStore
}

function asRequestWithMockOwner(request: express.Request): RequestWithMockOwner {
    return request as unknown as RequestWithMockOwner
}

export function createApp(options: CreateAppOptions = {}) {
    const app = express()
    const unitInitStore = options.unitInitStore ?? new InMemoryUnitInitStore()

    app.use(express.json())
    app.use(attachMockOwner)

    app.get('/api/health', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        response.json({
            status: 'ok',
            service: 'didactio-backend',
            mockOwnerId: requestWithMockOwner.mockOwner.id,
        })
    })

    app.post('/api/unit-init', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)

        try {
            const input = parseCreateUnitInitInput(request.body)
            const unitInit = createUnitInit(input, requestWithMockOwner.mockOwner.id)
            unitInitStore.save(unitInit)

            response.status(201).json(unitInit)
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid unit-init request.',
            })
        }
    })

    app.get('/api/unit-init/:id', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = unitInitStore.getById(
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

    app.post('/api/unit-init/:id/moderate', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = unitInitStore.getById(
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
            unitInitStore.save(moderatedUnitInit)
            response.json(moderatedUnitInit)
        } catch (error) {
            response.status(409).json({
                error: error instanceof Error ? error.message : 'Unit init moderation failed.',
            })
        }
    })

    app.post('/api/unit-init/:id/questionnaire/generate', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = unitInitStore.getById(
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
            unitInitStore.save(updatedUnitInit)
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

    app.patch('/api/unit-init/:id/questionnaire/answers', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = unitInitStore.getById(
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
            unitInitStore.save(updatedUnitInit)
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

    app.post('/api/unit-init/:id/syllabus-prompt/generate', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = unitInitStore.getById(
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
            unitInitStore.save(updatedUnitInit)
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

    app.post('/api/unit-init/:id/syllabus/generate', (request, response) => {
        const requestWithMockOwner = asRequestWithMockOwner(request)
        const unitInit = unitInitStore.getById(
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
            const updatedUnitInit = generateSyllabus(unitInit)
            unitInitStore.save(updatedUnitInit)
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

    return app
}
