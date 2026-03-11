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

describe('GET /api/unit-init/:id/chapters', () => {
    it('returns the syllabus chapter list with generation state', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/approve-syllabus`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/chapters/0/generate`)
            .send({})

        const response = await request(app).get(`/api/unit-init/${createdResponse.body.id}/chapters`)

        expect(response.status).toBe(200)
        expect(Array.isArray(response.body.chapters)).toBe(true)
        expect(response.body.chapters).toHaveLength(3)
        expect(response.body.chapters[0]).toMatchObject({
            chapterIndex: 0,
            title: 'Foundations of next.js framework',
            hasGeneratedContent: true,
        })
        expect(typeof response.body.chapters[0].generatedAt).toBe('string')
        expect(response.body.chapters[1]).toMatchObject({
            chapterIndex: 1,
            title: 'Practical workflow for next.js framework',
            hasGeneratedContent: false,
        })
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app).get('/api/unit-init/missing-id/chapters')

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 409 when the syllabus has not been generated yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app).get(`/api/unit-init/${createdResponse.body.id}/chapters`)

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Chapters are not available until a syllabus has been generated.',
        })
    })
})

describe('GET /api/unit-init/:id/chapters/:chapterIndex', () => {
    it('returns one generated chapter by index', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/approve-syllabus`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/chapters/0/generate`)
            .send({})

        const response = await request(app).get(
            `/api/unit-init/${createdResponse.body.id}/chapters/0`
        )

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            chapterIndex: 0,
            title: 'Foundations of next.js framework',
            overview:
                'Introduce the core concepts and shared vocabulary required to understand next.js framework.',
        })
        expect(typeof response.body.content).toBe('string')
        expect(Array.isArray(response.body.keyTakeaways)).toBe(true)
        expect(typeof response.body.generatedAt).toBe('string')
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app).get('/api/unit-init/missing-id/chapters/0')

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 400 for an invalid chapter index', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app).get(
            `/api/unit-init/${createdResponse.body.id}/chapters/not-a-number`
        )

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'chapterIndex must be a non-negative integer.',
        })
    })

    it('returns 404 when the chapter has not been generated yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app).get(
            `/api/unit-init/${createdResponse.body.id}/chapters/0`
        )

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Generated chapter not found.',
        })
    })
})

describe('PATCH /api/unit-init/:id/chapters/:chapterIndex', () => {
    it('replaces one generated chapter by index', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/approve-syllabus`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/chapters/0/generate`)
            .send({})

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/chapters/0`)
            .send({
                chapter: {
                    title: 'Edited Foundations',
                    overview: 'A rewritten overview for the chapter.',
                    content: 'A rewritten body of content for manual editing.',
                    keyTakeaways: [
                        'Edited takeaway one',
                        'Edited takeaway two',
                    ],
                },
            })

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            chapterIndex: 0,
            title: 'Edited Foundations',
            overview: 'A rewritten overview for the chapter.',
            content: 'A rewritten body of content for manual editing.',
        })
        expect(response.body.keyTakeaways).toEqual([
            'Edited takeaway one',
            'Edited takeaway two',
        ])
        expect(typeof response.body.updatedAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.updatedAt))).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .patch('/api/unit-init/missing-id/chapters/0')
            .send({
                chapter: {
                    title: 'Edited Foundations',
                    overview: 'Overview',
                    content: 'Content',
                    keyTakeaways: ['Takeaway'],
                },
            })

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 400 for an invalid chapter update payload', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/chapters/0`)
            .send({
                chapter: {
                    title: '',
                    overview: 'Overview',
                    content: 'Content',
                    keyTakeaways: ['Takeaway'],
                },
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'chapter.title is required.',
        })
    })

    it('returns 404 when the generated chapter does not exist yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/chapters/0`)
            .send({
                chapter: {
                    title: 'Edited Foundations',
                    overview: 'Overview',
                    content: 'Content',
                    keyTakeaways: ['Takeaway'],
                },
            })

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Generated chapter not found.',
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

describe('POST /api/unit-init/:id/syllabus/generate', () => {
    it('generates a structured syllabus from the stored syllabus prompt', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('syllabus_ready')
        expect(response.body.nextAction).toBe('review_syllabus')
        expect(response.body.syllabus).toMatchObject({
            title: 'next.js framework Learning Path',
        })
        expect(Array.isArray(response.body.syllabus.learningGoals)).toBe(true)
        expect(response.body.syllabus.learningGoals).toHaveLength(3)
        expect(Array.isArray(response.body.syllabus.chapters)).toBe(true)
        expect(response.body.syllabus.chapters).toHaveLength(3)
        expect(response.body.syllabus.chapters[0]).toMatchObject({
            title: 'Foundations of next.js framework',
        })
        expect(typeof response.body.syllabusGeneratedAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.syllabusGeneratedAt))).toBe(false)
    })

    it('uses the selected fake provider strategy for deepseek unit-inits', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework', provider: 'deepseek' })

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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        expect(response.status).toBe(200)
        expect(response.body.provider).toBe('deepseek')
        expect(response.body.syllabus.overview).toContain(
            'organized around practical reasoning'
        )
        expect(response.body.syllabus.learningGoals[0]).toBe(
            'Map the core reasoning model behind next.js framework'
        )
        expect(response.body.syllabus.chapters[0].title).toBe(
            'next.js framework mental model'
        )
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .post('/api/unit-init/missing-id/syllabus/generate')
            .send({})

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 409 when the syllabus prompt has not been generated yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Syllabus cannot be generated from the current unit-init state.',
        })
    })
})

describe('PATCH /api/unit-init/:id/syllabus', () => {
    it('replaces the generated syllabus and advances the next action', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/syllabus`)
            .send({
                syllabus: {
                    title: 'Advanced Next.js Delivery Plan',
                    overview: 'A custom syllabus focused on shipping production-ready Next.js systems.',
                    learningGoals: [
                        'Understand the framework architecture',
                        'Build production features confidently',
                        'Choose appropriate rendering strategies',
                    ],
                    chapters: [
                        {
                            title: 'Runtime Fundamentals',
                            overview: 'Review the core runtime model and framework primitives.',
                            keyPoints: [
                                'Routing model',
                                'Rendering modes',
                                'Server and client boundaries',
                            ],
                        },
                        {
                            title: 'Delivery Workflow',
                            overview: 'Move from local development to production delivery.',
                            keyPoints: [
                                'Project structure',
                                'Deployment pipeline',
                                'Operational checks',
                            ],
                        },
                    ],
                },
            })

        expect(response.status).toBe(200)
        expect(response.body.nextAction).toBe('approve_syllabus')
        expect(response.body.syllabus).toMatchObject({
            title: 'Advanced Next.js Delivery Plan',
            overview: 'A custom syllabus focused on shipping production-ready Next.js systems.',
        })
        expect(response.body.syllabus.learningGoals).toHaveLength(3)
        expect(response.body.syllabus.chapters).toHaveLength(2)
        expect(typeof response.body.syllabusUpdatedAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.syllabusUpdatedAt))).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .patch('/api/unit-init/missing-id/syllabus')
            .send({
                syllabus: {
                    title: 'Example',
                    overview: 'Example overview',
                    learningGoals: ['One'],
                    chapters: [
                        {
                            title: 'Chapter 1',
                            overview: 'Overview',
                            keyPoints: ['Point 1'],
                        },
                    ],
                },
            })

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 400 for an invalid syllabus payload', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/syllabus`)
            .send({
                syllabus: {
                    title: '',
                    overview: 'Example overview',
                    learningGoals: ['One'],
                    chapters: [
                        {
                            title: 'Chapter 1',
                            overview: 'Overview',
                            keyPoints: ['Point 1'],
                        },
                    ],
                },
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'syllabus.title is required.',
        })
    })

    it('returns 409 when the syllabus has not been generated yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .patch(`/api/unit-init/${createdResponse.body.id}/syllabus`)
            .send({
                syllabus: {
                    title: 'Example',
                    overview: 'Example overview',
                    learningGoals: ['One'],
                    chapters: [
                        {
                            title: 'Chapter 1',
                            overview: 'Overview',
                            keyPoints: ['Point 1'],
                        },
                    ],
                },
            })

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Syllabus cannot be updated from the current unit-init state.',
        })
    })
})

describe('POST /api/unit-init/:id/approve-syllabus', () => {
    it('approves a generated syllabus and marks the unit-init ready for content generation', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/approve-syllabus`)
            .send({})

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('syllabus_approved')
        expect(response.body.nextAction).toBe('generate_unit_content')
        expect(typeof response.body.syllabusApprovedAt).toBe('string')
        expect(Number.isNaN(Date.parse(response.body.syllabusApprovedAt))).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .post('/api/unit-init/missing-id/approve-syllabus')
            .send({})

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 409 when the syllabus has not been generated yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/approve-syllabus`)
            .send({})

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Syllabus cannot be approved from the current unit-init state.',
        })
    })
})

describe('POST /api/unit-init/:id/chapters/:chapterIndex/generate', () => {
    it('generates content for one approved syllabus chapter', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/approve-syllabus`)
            .send({})

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/chapters/0/generate`)
            .send({})

        expect(response.status).toBe(200)
        expect(response.body.status).toBe('syllabus_approved')
        expect(response.body.nextAction).toBe('generate_unit_content')
        expect(Array.isArray(response.body.generatedChapters)).toBe(true)
        expect(response.body.generatedChapters).toHaveLength(1)
        expect(response.body.generatedChapters[0]).toMatchObject({
            chapterIndex: 0,
            title: 'Foundations of next.js framework',
            overview:
                'Introduce the core concepts and shared vocabulary required to understand next.js framework.',
        })
        expect(typeof response.body.generatedChapters[0].content).toBe('string')
        expect(response.body.generatedChapters[0].content).toContain(
            'The purpose is to help the learner move closer to answer-for-learning_goal.'
        )
        expect(response.body.generatedChapters[0].keyTakeaways).toHaveLength(3)
        expect(typeof response.body.generatedChapters[0].generatedAt).toBe('string')
        expect(
            Number.isNaN(Date.parse(response.body.generatedChapters[0].generatedAt))
        ).toBe(false)
    })

    it('returns 404 when the unit-init does not exist', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const response = await request(app)
            .post('/api/unit-init/missing-id/chapters/0/generate')
            .send({})

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Unit init not found.',
        })
    })

    it('returns 400 for an invalid chapter index', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/chapters/not-a-number/generate`)
            .send({})

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'chapterIndex must be a non-negative integer.',
        })
    })

    it('returns 400 when the chapter index is out of range', async () => {
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

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus-prompt/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/syllabus/generate`)
            .send({})

        await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/approve-syllabus`)
            .send({})

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/chapters/99/generate`)
            .send({})

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'Chapter index is out of range for the approved syllabus.',
        })
    })

    it('returns 409 when the syllabus has not been approved yet', async () => {
        const store = new InMemoryUnitInitStore()
        const app = createApp({ unitInitStore: store })

        const createdResponse = await request(app)
            .post('/api/unit-init')
            .send({ topic: 'next.js framework' })

        const response = await request(app)
            .post(`/api/unit-init/${createdResponse.body.id}/chapters/0/generate`)
            .send({})

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Chapter content cannot be generated from the current unit-init state.',
        })
    })
})
