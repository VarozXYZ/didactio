import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('GET /api/health', () => {
    afterEach(() => {
        delete process.env.MOCK_OWNER_ID
    })

    it('returns the service health and default mock owner id', async () => {
        const app = createApp()

        const response = await request(app).get('/api/health')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            status: 'ok',
            service: 'didactio-backend',
            mockOwnerId: 'mock-user',
        })
    })

    it('uses the configured mock owner id when provided', async () => {
        process.env.MOCK_OWNER_ID = 'local-dev-user'
        const app = createApp()

        const response = await request(app).get('/api/health')

        expect(response.status).toBe(200)
        expect(response.body.mockOwnerId).toBe('local-dev-user')
    })
})
