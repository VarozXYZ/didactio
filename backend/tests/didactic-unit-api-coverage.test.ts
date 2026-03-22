import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/create-test-app.js'
import {
    createApprovedDidacticUnit,
    createSyllabusReadyDidacticUnit,
    generateDidacticUnitChapter,
} from './helpers/didactic-unit-flow.js'

describe('didactic-unit API coverage', () => {
    it('gets a didactic unit by id with the complete approved syllabus payload', async () => {
        const app = createTestApp()
        const approved = await createApprovedDidacticUnit(app)

        const response = await request(app).get(`/api/didactic-unit/${approved.id}`)

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
            id: approved.id,
            status: 'syllabus_approved',
            nextAction: 'view_didactic_unit',
            title: expect.any(String),
            chapters: expect.any(Array),
            studyProgress: {
                chapterCount: expect.any(Number),
                completedChapterCount: 0,
                studyProgressPercent: 0,
            },
        })
        expect(response.body.chapters.length).toBeGreaterThan(0)
        expect(typeof response.body.syllabusApprovedAt).toBe('string')
    })

    it('updates the generated syllabus before approval and persists the edited structure', async () => {
        const app = createTestApp()
        const syllabusReady = await createSyllabusReadyDidacticUnit(app)
        const customSyllabus = {
            title: 'Advanced next.js delivery plan',
            overview: 'A custom syllabus focused on shipping production-ready outcomes.',
            learningGoals: [
                'Understand the framework architecture',
                'Build production features confidently',
                'Choose appropriate implementation tradeoffs',
            ],
            chapters: [
                {
                    title: 'Runtime Fundamentals',
                    overview: 'Review the core runtime model and framework primitives.',
                    keyPoints: ['Routing model', 'Rendering modes', 'Server and client boundaries'],
                },
                {
                    title: 'Delivery Workflow',
                    overview: 'Move from local development to production delivery.',
                    keyPoints: ['Project structure', 'Deployment pipeline', 'Operational checks'],
                },
            ],
        }

        const updateResponse = await request(app)
            .patch(`/api/didactic-unit/${syllabusReady.id}/syllabus`)
            .send({ syllabus: customSyllabus })

        expect(updateResponse.status).toBe(200)
        expect(updateResponse.body).toMatchObject({
            id: syllabusReady.id,
            status: 'syllabus_ready',
            nextAction: 'approve_syllabus',
            syllabus: customSyllabus,
        })
        expect(typeof updateResponse.body.syllabusUpdatedAt).toBe('string')

        const getResponse = await request(app).get(`/api/didactic-unit/${syllabusReady.id}`)

        expect(getResponse.status).toBe(200)
        expect(getResponse.body).toMatchObject({
            id: syllabusReady.id,
            title: customSyllabus.title,
            overview: customSyllabus.overview,
            learningGoals: customSyllabus.learningGoals,
            chapters: customSyllabus.chapters,
            syllabus: customSyllabus,
        })
    })

    it('lists chapter summaries with generated-content flags after chapter generation', async () => {
        const app = createTestApp()
        const approved = await createApprovedDidacticUnit(app)

        await generateDidacticUnitChapter(app, approved.id, 0)

        const response = await request(app).get(`/api/didactic-unit/${approved.id}/chapters`)

        expect(response.status).toBe(200)
        expect(response.body.chapters.length).toBeGreaterThan(0)
        expect(response.body.chapters[0]).toMatchObject({
            chapterIndex: 0,
            hasGeneratedContent: true,
            state: 'ready',
        })
    })

    it('regenerates an existing chapter and records regeneration history', async () => {
        const app = createTestApp()
        const approved = await createApprovedDidacticUnit(app)

        await generateDidacticUnitChapter(app, approved.id, 0)

        const regenerateResponse = await request(app)
            .post(`/api/didactic-unit/${approved.id}/chapters/0/regenerate`)
            .send({})

        expect(regenerateResponse.status).toBe(200)
        expect(regenerateResponse.body).toMatchObject({
            id: approved.id,
            status: 'content_generation_in_progress',
        })

        const revisionsResponse = await request(app).get(
            `/api/didactic-unit/${approved.id}/chapters/0/revisions`
        )

        expect(revisionsResponse.status).toBe(200)
        expect(revisionsResponse.body.revisions[0]).toMatchObject({
            chapterIndex: 0,
            source: 'ai_regeneration',
        })
        expect(
            revisionsResponse.body.revisions.some(
                (revision: { chapterIndex: number; source: string }) =>
                    revision.chapterIndex === 0 && revision.source === 'ai_generation'
            )
        ).toBe(true)

        const runsResponse = await request(app).get(`/api/didactic-unit/${approved.id}/runs`)

        expect(runsResponse.status).toBe(200)
        expect(
            runsResponse.body.runs.filter((run: { stage: string }) => run.stage === 'chapter')
        ).toHaveLength(2)
    })
})
