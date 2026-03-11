import express from 'express'
import { attachMockOwner, type RequestWithMockOwner } from './middleware/mock-owner.js'
import { createUnitInit, parseCreateUnitInitInput } from './unit-init/create-unit-init.js'

export function createApp() {
    const app = express()

    app.use(express.json())
    app.use(attachMockOwner)

    app.get('/api/health', (request, response) => {
        const requestWithMockOwner = request as RequestWithMockOwner

        response.json({
            status: 'ok',
            service: 'didactio-backend',
            mockOwnerId: requestWithMockOwner.mockOwner.id,
        })
    })

    app.post('/api/unit-init', (request, response) => {
        const requestWithMockOwner = request as RequestWithMockOwner

        try {
            const input = parseCreateUnitInitInput(request.body)
            const unitInit = createUnitInit(input, requestWithMockOwner.mockOwner.id)

            response.status(201).json(unitInit)
        } catch (error) {
            response.status(400).json({
                error: error instanceof Error ? error.message : 'Invalid unit-init request.',
            })
        }
    })

    return app
}
