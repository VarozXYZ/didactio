import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/create-test-app.js'

describe('AI config API', () => {
    it('returns the stage-based AI config and allows in-memory updates', async () => {
        const app = createTestApp()

        const initialResponse = await request(app).get('/api/ai-config')
        expect(initialResponse.status).toBe(200)
        expect(initialResponse.body).toMatchObject({
            moderation: expect.any(Object),
            questionnaire: expect.any(Object),
            syllabus: expect.any(Object),
            summary: expect.any(Object),
            chapter: expect.any(Object),
        })

        const updateResponse = await request(app)
            .patch('/api/ai-config')
            .send({
                chapter: {
                    provider: 'anthropic',
                    model: 'claude-sonnet-4',
                },
            })

        expect(updateResponse.status).toBe(200)
        expect(updateResponse.body.chapter).toEqual({
            provider: 'anthropic',
            model: 'claude-sonnet-4',
        })

        const refreshedResponse = await request(app).get('/api/ai-config')
        expect(refreshedResponse.status).toBe(200)
        expect(refreshedResponse.body.chapter).toEqual({
            provider: 'anthropic',
            model: 'claude-sonnet-4',
        })
    })
})
