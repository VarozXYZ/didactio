import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers/create-test-app.js'

async function createDidacticUnit(app: ReturnType<typeof createTestApp>) {
    const response = await request(app)
        .post('/api/didactic-unit')
        .send({ topic: 'next.js framework' })

    expect(response.status).toBe(201)
    return response.body as { id: string }
}

async function advanceToQuestionnaireAnswered(
    app: ReturnType<typeof createTestApp>,
    didacticUnitId: string
) {
    const questionnaireResponse = await request(app)
        .post(`/api/didactic-unit/${didacticUnitId}/questionnaire/generate`)
        .send({})

    expect(questionnaireResponse.status).toBe(200)

    const answers = questionnaireResponse.body.questionnaire.questions.map(
        (question: { id: string }) => ({
            questionId: question.id,
            value: `answer-for-${question.id}`,
        })
    )

    const answeredResponse = await request(app)
        .patch(`/api/didactic-unit/${didacticUnitId}/questionnaire/answers`)
        .send({ answers })

    expect(answeredResponse.status).toBe(200)
}

async function createApprovedDidacticUnit(app: ReturnType<typeof createTestApp>) {
    const created = await createDidacticUnit(app)

    await advanceToQuestionnaireAnswered(app, created.id)

    await request(app)
        .post(`/api/didactic-unit/${created.id}/syllabus-prompt/generate`)
        .send({})

    const syllabusResponse = await request(app)
        .post(`/api/didactic-unit/${created.id}/syllabus/generate`)
        .send({})

    expect(syllabusResponse.status).toBe(200)

    const approvedResponse = await request(app)
        .post(`/api/didactic-unit/${created.id}/approve-syllabus`)
        .send({})

    expect(approvedResponse.status).toBe(200)

    return approvedResponse.body as { id: string }
}

describe('didactic-unit lifecycle', () => {
    it('creates a didactic unit from topic and provider', async () => {
        const app = createTestApp()

        const response = await request(app)
            .post('/api/didactic-unit')
            .send({ topic: '  next.js framework  ', provider: 'deepseek' })

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({
            ownerId: 'mock-user',
            topic: 'next.js framework',
            title: 'next.js framework',
            provider: 'deepseek',
            status: 'moderation_completed',
            nextAction: 'generate_questionnaire',
            overview: '',
            chapters: [],
        })
        expect(typeof response.body.moderatedAt).toBe('string')
        expect(typeof response.body.id).toBe('string')
        expect(response.body.studyProgress).toEqual({
            chapterCount: 0,
            completedChapterCount: 0,
            studyProgressPercent: 0,
        })
    })

    it('lists didactic unit summaries without legacy handoff fields', async () => {
        const app = createTestApp()

        const created = await createDidacticUnit(app)
        const response = await request(app).get('/api/didactic-unit')

        expect(response.status).toBe(200)
        expect(response.body.didacticUnits).toHaveLength(1)
        expect(response.body.didacticUnits[0]).toMatchObject({
            id: created.id,
            title: 'next.js framework',
            topic: 'next.js framework',
            status: 'moderation_completed',
            nextAction: 'generate_questionnaire',
            chapterCount: 0,
            progressPercent: 17,
        })
        expect(response.body.didacticUnits[0]).not.toHaveProperty('legacyPlanningId')
    })

    it('progresses one didactic unit through setup and syllabus approval', async () => {
        const app = createTestApp()
        const created = await createDidacticUnit(app)

        await advanceToQuestionnaireAnswered(app, created.id)

        const syllabusPromptResponse = await request(app)
            .post(`/api/didactic-unit/${created.id}/syllabus-prompt/generate`)
            .send({})

        expect(syllabusPromptResponse.status).toBe(200)
        expect(syllabusPromptResponse.body).toMatchObject({
            status: 'syllabus_prompt_ready',
            nextAction: 'review_syllabus_prompt',
        })
        expect(typeof syllabusPromptResponse.body.syllabusPrompt).toBe('string')

        const syllabusResponse = await request(app)
            .post(`/api/didactic-unit/${created.id}/syllabus/generate`)
            .send({})

        expect(syllabusResponse.status).toBe(200)
        expect(syllabusResponse.body).toMatchObject({
            status: 'syllabus_ready',
            nextAction: 'review_syllabus',
        })
        expect(syllabusResponse.body.syllabus.chapters.length).toBeGreaterThan(0)

        const runsResponse = await request(app).get(`/api/didactic-unit/${created.id}/runs`)
        expect(runsResponse.status).toBe(200)
        expect(runsResponse.body.runs[0]).toMatchObject({
            stage: 'syllabus',
            status: 'completed',
            didacticUnitId: created.id,
        })

        const approvedResponse = await request(app)
            .post(`/api/didactic-unit/${created.id}/approve-syllabus`)
            .send({})

        expect(approvedResponse.status).toBe(200)
        expect(approvedResponse.body).toMatchObject({
            id: created.id,
            status: 'syllabus_approved',
            nextAction: 'view_didactic_unit',
        })
    })

    it('generates, reads, completes, and tracks a chapter on the same didactic unit', async () => {
        const app = createTestApp()
        const approved = await createApprovedDidacticUnit(app)

        const generateResponse = await request(app)
            .post(`/api/didactic-unit/${approved.id}/chapters/0/generate`)
            .send({})

        expect(generateResponse.status).toBe(200)
        expect(generateResponse.body).toMatchObject({
            id: approved.id,
            status: 'content_generation_in_progress',
        })

        const chapterResponse = await request(app).get(
            `/api/didactic-unit/${approved.id}/chapters/0`
        )

        expect(chapterResponse.status).toBe(200)
        expect(chapterResponse.body).toMatchObject({
            chapterIndex: 0,
            state: 'ready',
            isCompleted: false,
        })
        expect(typeof chapterResponse.body.content).toBe('string')

        const completionResponse = await request(app)
            .post(`/api/didactic-unit/${approved.id}/chapters/0/complete`)
            .send({})

        expect(completionResponse.status).toBe(200)
        expect(completionResponse.body.studyProgress).toMatchObject({
            chapterCount: expect.any(Number),
            completedChapterCount: 1,
        })

        const revisionsResponse = await request(app).get(
            `/api/didactic-unit/${approved.id}/chapters/0/revisions`
        )

        expect(revisionsResponse.status).toBe(200)
        expect(revisionsResponse.body.revisions[0]).toMatchObject({
            chapterIndex: 0,
            source: 'ai_generation',
        })

        const runsResponse = await request(app).get(`/api/didactic-unit/${approved.id}/runs`)
        expect(runsResponse.status).toBe(200)
        expect(
            runsResponse.body.runs.some(
                (run: { stage: string; didacticUnitId: string }) =>
                    run.stage === 'chapter' && run.didacticUnitId === approved.id
            )
        ).toBe(true)
    })
})
