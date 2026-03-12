import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/create-test-app.js'

describe('GET /api/health', () => {
    afterEach(() => {
        delete process.env.MOCK_OWNER_ID
    })

    it('returns the service health and default mock owner id', async () => {
        const app = createTestApp()

        const response = await request(app).get('/api/health')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            status: 'ok',
            service: 'didactio-backend',
            mockOwnerId: 'mock-user',
            mongo: {
                configured: false,
                connected: false,
                databaseName: null,
            },
        })
    })

    it('uses the configured mock owner id when provided', async () => {
        process.env.MOCK_OWNER_ID = 'local-dev-user'
        const app = createTestApp()

        const response = await request(app).get('/api/health')

        expect(response.status).toBe(200)
        expect(response.body.mockOwnerId).toBe('local-dev-user')
    })

    it('returns the configured mongo health when provided', async () => {
        const app = createTestApp({
            mongoHealth: {
                configured: true,
                connected: true,
                databaseName: 'didactio',
            },
        })

        const response = await request(app).get('/api/health')

        expect(response.status).toBe(200)
        expect(response.body.mongo).toEqual({
            configured: true,
            connected: true,
            databaseName: 'didactio',
        })
    })
})
