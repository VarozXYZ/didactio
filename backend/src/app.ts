import express from 'express'
import { attachMockOwner, type RequestWithMockOwner } from './middleware/mock-owner.js'

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

    return app
}
