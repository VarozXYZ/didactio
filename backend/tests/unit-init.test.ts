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

describe('POST /api/unit-init/:id/questionnaire/generate', () => {
    it('generates the questionnaire after moderation', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/moderate`)
            .send({})

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/questionnaire/generate`)
            .send({})

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('questionnaire_ready')
        expect(response.body.nextAction).toBe('answer_questionnaire')
        expect(Array.isArray(response.body.questionnaire.questions)).toBe(true)
        expect(response.body.questionnaire.questions).toHaveLength(5)
        expect(response.body.questionnaire.questions[0]).toMatchObject({
            id: 'topic_knowledge_level',
            type: 'single_select',
        })
        expect(typeof response.body.questionnaireGeneratedAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.questionnaireGeneratedAt))).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .post('/api/unit-init/missing-id/questionnaire/generate')
            .send({})

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 409 when the questionnaire is requested before moderation', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/questionnaire/generate`)
            .send({})

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Questionnaire cannot be generated from the current unit-init state.',
        })
    })
})

describe('PATCH /api/unit-init/:id/questionnaire/answers', () => {
    it('stores questionnaire answers and advances the next action', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/moderate`)
            .send({})

        const questionnaireResponse = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/questionnaire/generate`)
            .send({})

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/questionnaire/answers`)
            .send({
                answers: questionnaireResponse.body.questionnaire.questions.map(
                    (question: { id: string }) => ({
                        questionId: question.id,
                        value: `answer-for-${question.id}`,
                    })
                ),
            })

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('questionnaire_answered')
        expect(response.body.nextAction).toBe('generate_syllabus_prompt')
        expect(response.body.questionnaireAnswers).toHaveLength(5)
        expect(typeof response.body.questionnaireAnsweredAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.questionnaireAnsweredAt))).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .patch('/api/unit-init/missing-id/questionnaire/answers')
            .send({
                answers: [{ questionId: 'topic_knowledge_level', value: 'basic' }],
            })

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 400 for invalid answer payloads', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/questionnaire/answers`)
            .send({
                answers: [],
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'Answers must be a non-empty array.',
        })
    })

    it('returns 409 when answers are submitted before the questionnaire is ready', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/questionnaire/answers`)
            .send({
                answers: [{ questionId: 'topic_knowledge_level', value: 'basic' }],
            })

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Questionnaire cannot be answered from the current unit-init state.',
        })
    })
})

describe('POST /api/unit-init/:id/syllabus-prompt/generate', () => {
    it('generates a syllabus prompt from the answered questionnaire', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/moderate`)
            .send({})

        const questionnaireResponse = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/questionnaire/generate`)
            .send({})

        await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/questionnaire/answers`)
            .send({
                answers: questionnaireResponse.body.questionnaire.questions.map(
                    (question: { id: string }) => ({
                        questionId: question.id,
                        value: `answer-for-${question.id}`,
                    })
                ),
            })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('syllabus_prompt_ready')
        expect(response.body.nextAction).toBe('review_syllabus_prompt')
        expect(typeof response.body.syllabusPrompt).toBe('string')
        expect(response.body.syllabusPrompt).toContain('Create a didactic unit about next.js framework.')
        expect(response.body.syllabusPrompt).toContain('answer-for-learning_goal')
        expect(typeof response.body.syllabusPromptGeneratedAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.syllabusPromptGeneratedAt))).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .post('/api/unit-init/missing-id/syllabus-prompt/generate')
            .send({})

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 409 when the questionnaire has not been answered yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Syllabus prompt cannot be generated from the current unit-init state.',
        })
    })
})
