import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/create-test-app.js'
import {
    createApprovedDidacticUnit,
    createDidacticUnit,
    createSyllabusReadyDidacticUnit,
} from './helpers/didactic-unit-flow.js'

describe('didactic-unit API errors', () => {
    it('returns 400 when the syllabus update payload is invalid', async () => {
        const app = createTestApp()
        const syllabusReady = await createSyllabusReadyDidacticUnit(app)

        const response = await request(app)
            .patch(`/api/didactic-unit/${syllabusReady.id}/syllabus`)
            .send({
                syllabus: {
                    title: 'Broken syllabus',
                    overview: 'Missing required collections.',
                    learningGoals: ['One goal'],
                    chapters: [],
                },
            })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'syllabus.chapters must be a non-empty array.',
        })
    })

    it('returns 409 when the syllabus is updated before it is ready', async () => {
        const app = createTestApp()
        const created = await createDidacticUnit(app)

        const response = await request(app)
            .patch(`/api/didactic-unit/${created.id}/syllabus`)
            .send({
                syllabus: {
                    title: 'Should fail',
                    overview: 'This update should be rejected.',
                    learningGoals: ['One goal'],
                    keywords: ['one'],
                    chapters: [
                        {
                            title: 'Chapter',
                            overview: 'Overview',
                            keyPoints: ['Point'],
                            lessons: [
                                {
                                    title: 'Lesson',
                                    contentOutline: ['Outline item'],
                                },
                            ],
                        },
                    ],
                },
            })

        expect(response.status).toBe(409)
        expect(response.body).toEqual({
            error: 'Syllabus cannot be updated from the current didactic unit state.',
        })
    })

    it('returns 404 when a module regeneration is requested before any generation exists', async () => {
        const app = createTestApp()
        const approved = await createApprovedDidacticUnit(app)

        const response = await request(app)
            .post(`/api/didactic-unit/${approved.id}/chapters/0/regenerate`)
            .send({ tier: 'cheap' })

        expect(response.status).toBe(404)
        expect(response.body).toEqual({
            error: 'Generated didactic unit module not found.',
        })
    })

    it('returns 400 when the requested module index is outside the approved syllabus', async () => {
        const app = createTestApp()
        const approved = await createApprovedDidacticUnit(app)

        const response = await request(app)
            .post(`/api/didactic-unit/${approved.id}/chapters/99/generate`)
            .send({ tier: 'cheap' })

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
            error: 'Module index is out of range for the approved syllabus.',
        })
    })
})
