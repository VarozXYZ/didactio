import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { getAppEnv, loadEnv } from '../src/config/env.js'
import type { DidacticUnitProvider } from '../src/didactic-unit/planning.js'
import { createTestApp } from './helpers/create-test-app.js'
import { advanceToQuestionnaireAnswered, createDidacticUnit } from './helpers/didactic-unit-flow.js'

loadEnv()

const env = getAppEnv()

const configuredProviders = [
    env.openAiApiKey
        ? {
              provider: 'openai' as const,
              syllabusModel: env.openAiSyllabusModel,
              chapterModel: env.openAiChapterModel,
          }
        : null,
    env.deepSeekApiKey
        ? {
              provider: 'deepseek' as const,
              syllabusModel: env.deepSeekSyllabusModel,
              chapterModel: env.deepSeekChapterModel,
          }
        : null,
].filter((provider): provider is {
    provider: DidacticUnitProvider
    syllabusModel: string
    chapterModel: string
} => provider !== null)

describe('live AI didactic-unit generation', () => {
    if (configuredProviders.length === 0) {
        it('requires an OpenAI or DeepSeek API key before running live tests', () => {
            throw new Error(
                'No live AI provider is configured. Set OPENAI_API_KEY and/or DEEPSEEK_API_KEY in backend/.env and run the live suite again.'
            )
        })

        return
    }

    for (const providerConfig of configuredProviders) {
        it(
            `generates a real syllabus and chapter with ${providerConfig.provider}`,
            async () => {
                const app = createTestApp()
                const topic = `live ${providerConfig.provider} didactic unit ${Date.now()}`

                const created = await createDidacticUnit(app, {
                    topic,
                    provider: providerConfig.provider,
                })

                await advanceToQuestionnaireAnswered(app, created.id)

                const syllabusPromptResponse = await request(app)
                    .post(`/api/didactic-unit/${created.id}/syllabus-prompt/generate`)
                    .send({})

                expect(syllabusPromptResponse.status).toBe(200)
                expect(syllabusPromptResponse.body).toMatchObject({
                    id: created.id,
                    provider: providerConfig.provider,
                    status: 'syllabus_prompt_ready',
                })

                const syllabusResponse = await request(app)
                    .post(`/api/didactic-unit/${created.id}/syllabus/generate`)
                    .send({})

                expect(syllabusResponse.status).toBe(200)
                expect(syllabusResponse.body).toMatchObject({
                    id: created.id,
                    provider: providerConfig.provider,
                    status: 'syllabus_ready',
                    nextAction: 'review_syllabus',
                })
                expect(syllabusResponse.body.syllabus.chapters.length).toBeGreaterThan(0)
                expect(syllabusResponse.body.syllabus.learningGoals.length).toBeGreaterThan(0)

                const approveResponse = await request(app)
                    .post(`/api/didactic-unit/${created.id}/approve-syllabus`)
                    .send({})

                expect(approveResponse.status).toBe(200)
                expect(approveResponse.body).toMatchObject({
                    id: created.id,
                    provider: providerConfig.provider,
                    status: 'syllabus_approved',
                })

                const chapterResponse = await request(app)
                    .post(`/api/didactic-unit/${created.id}/chapters/0/generate`)
                    .send({})

                expect(chapterResponse.status).toBe(200)
                expect(chapterResponse.body).toMatchObject({
                    id: created.id,
                    provider: providerConfig.provider,
                    status: 'content_generation_in_progress',
                })

                const generatedChapterResponse = await request(app).get(
                    `/api/didactic-unit/${created.id}/chapters/0`
                )

                expect(generatedChapterResponse.status).toBe(200)
                expect(generatedChapterResponse.body).toMatchObject({
                    chapterIndex: 0,
                    state: 'ready',
                    isCompleted: false,
                })
                expect(typeof generatedChapterResponse.body.content).toBe('string')
                expect(generatedChapterResponse.body.content.length).toBeGreaterThan(100)
                expect(generatedChapterResponse.body.keyTakeaways.length).toBeGreaterThan(0)

                const runsResponse = await request(app).get(`/api/didactic-unit/${created.id}/runs`)

                expect(runsResponse.status).toBe(200)

                const syllabusRun = runsResponse.body.runs.find(
                    (run: { stage: string }) => run.stage === 'syllabus'
                )
                const chapterRun = runsResponse.body.runs.find(
                    (run: { stage: string }) => run.stage === 'chapter'
                )

                expect(syllabusRun).toMatchObject({
                    didacticUnitId: created.id,
                    provider: providerConfig.provider,
                    model: providerConfig.syllabusModel,
                    status: 'completed',
                    stage: 'syllabus',
                })
                expect(chapterRun).toMatchObject({
                    didacticUnitId: created.id,
                    provider: providerConfig.provider,
                    model: providerConfig.chapterModel,
                    status: 'completed',
                    stage: 'chapter',
                    chapterIndex: 0,
                })
            },
            180000
        )
    }
})
