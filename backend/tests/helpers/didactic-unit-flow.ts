import request from 'supertest'
import { expect } from 'vitest'
import type { DidacticUnitProvider } from '../../src/didactic-unit/planning.js'
import { createTestApp } from './create-test-app.js'

type TestApp = ReturnType<typeof createTestApp>

export async function createDidacticUnit(
    app: TestApp,
    input: {
        topic?: string
        provider?: DidacticUnitProvider
    } = {}
) {
    const response = await request(app)
        .post('/api/didactic-unit')
        .send({
            topic: input.topic ?? 'next.js framework',
            provider: input.provider,
        })

    expect(response.status).toBe(201)
    return response.body as { id: string; topic: string; provider: DidacticUnitProvider }
}

export async function advanceToQuestionnaireAnswered(app: TestApp, didacticUnitId: string) {
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
    return answeredResponse.body as { id: string }
}

export async function createSyllabusReadyDidacticUnit(app: TestApp) {
    const created = await createDidacticUnit(app)

    await advanceToQuestionnaireAnswered(app, created.id)

    const syllabusPromptResponse = await request(app)
        .post(`/api/didactic-unit/${created.id}/syllabus-prompt/generate`)
        .send({})

    expect(syllabusPromptResponse.status).toBe(200)

    const syllabusResponse = await request(app)
        .post(`/api/didactic-unit/${created.id}/syllabus/generate`)
        .send({})

    expect(syllabusResponse.status).toBe(200)

    return syllabusResponse.body as { id: string; syllabus: { chapters: unknown[] } }
}

export async function createSyllabusReadyDidacticUnitWithProvider(
    app: TestApp,
    input: {
        topic?: string
        provider?: DidacticUnitProvider
    } = {}
) {
    const created = await createDidacticUnit(app, input)

    await advanceToQuestionnaireAnswered(app, created.id)

    const syllabusPromptResponse = await request(app)
        .post(`/api/didactic-unit/${created.id}/syllabus-prompt/generate`)
        .send({})

    expect(syllabusPromptResponse.status).toBe(200)

    const syllabusResponse = await request(app)
        .post(`/api/didactic-unit/${created.id}/syllabus/generate`)
        .send({})

    expect(syllabusResponse.status).toBe(200)

    return syllabusResponse.body as {
        id: string
        provider: DidacticUnitProvider
        syllabus: { chapters: unknown[] }
    }
}

export async function createApprovedDidacticUnit(
    app: TestApp,
    input: {
        topic?: string
        provider?: DidacticUnitProvider
    } = {}
) {
    const syllabusReady = await createSyllabusReadyDidacticUnitWithProvider(app, input)

    const approvedResponse = await request(app)
        .post(`/api/didactic-unit/${syllabusReady.id}/approve-syllabus`)
        .send({})

    expect(approvedResponse.status).toBe(200)

    return approvedResponse.body as { id: string }
}

export async function generateDidacticUnitChapter(
    app: TestApp,
    didacticUnitId: string,
    chapterIndex = 0
) {
    const response = await request(app)
        .post(`/api/didactic-unit/${didacticUnitId}/chapters/${chapterIndex}/generate`)
        .send({})

    expect(response.status).toBe(200)

    return response.body as {
        id: string
        generatedChapters?: Array<{ chapterIndex: number; content: string }>
    }
}
