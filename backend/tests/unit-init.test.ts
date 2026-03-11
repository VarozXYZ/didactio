import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

describe('POST /api/unit-init', () => {
    it('creates a unit-init with the default provider', async () => {
        const app = createApp()

        const response = await request(app)
            .post('/api/unit-init')
            .send({ topic: '  next.js framework  ' })

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
            ownerId: 'mock-user',
            topic: 'next.js framework',
            provider: 'openai',
            status: 'submitted',
        })
        expect(typeof response.body.id).toBe('string')
    })

    it('creates a unit-init with an explicit supported provider', async () => {
        const app = createApp()

        const response = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'english language', provider: 'deepseek' })

        expect(response.status).toBe(201)
        expect(response.body.provider).toBe('deepseek')
    })

    it('rejects an empty topic', async () => {
        const app = createApp()

        const response = await request(app)
            .post('/api/unit-init')
            .send({ topic: '   ' })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'Topic is required.',
        })
    })

    it('rejects an unsupported provider', async () => {
        const app = createApp()

        const response = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'statistics', provider: 'anthropic' })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'Provider must be either "openai" or "deepseek".',
        })
    })
})
