import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { InMemoryUnitInitStore } from '../src/unit-init/unit-init-store.js'

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
            nextAction: 'moderate_topic',
        })
        expect(typeof response.body.id).toBe('string')
        expect(typeof response.body.createdAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.createdAt))).toBe(false)
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

describe('GET /api/unit-init/:id', () => {
    it('returns a previously created unit-init for the same mock owner', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app).get(`/api/unit-init/${createdResponse.body.id}`)

        expect(response.status).toBe(200)
        expect(response.body).toEqual(createdResponse.body)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app).get('/api/unit-init/missing-id')

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })
})

describe('POST /api/unit-init/:id/moderate', () => {
    it('transitions a submitted unit-init into moderation completed', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/moderate`)
            .send({})

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            ...createdResponse.body,
            status: 'moderation_completed',
            nextAction: 'generate_questionnaire',
        })
        expect(typeof response.body.moderatedAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.moderatedAt))).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .post('/api/unit-init/missing-id/moderate')
            .send({})

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 409 when moderation is requested twice', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/moderate`)
            .send({})

        const secondResponse = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/moderate`)
            .send({})

        expect(secondResponse.status).toBe(409)
        expect(secondResponse.body).toEqual({
            error: 'Unit init cannot be moderated from its current state.',
        })
    })
})
