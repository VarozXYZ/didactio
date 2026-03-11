import { describe, expect, it, vi } from 'vitest'
import { OpenAiSyllabusGenerator } from '../src/providers/openai-syllabus-generator.js'
import type { CreatedUnitInit } from '../src/unit-init/create-unit-init.js'

function createApprovedQuestionnaireUnitInit(): CreatedUnitInit {
    return {
        id: 'unit-init-1',
        ownerId: 'mock-user',
        topic: 'next.js framework',
        provider: 'openai',
        status: 'syllabus_prompt_ready',
        nextAction: 'review_syllabus_prompt',
        createdAt: '2026-03-12T00:00:00.000Z',
        questionnaireAnswers: [
            { questionId: 'topic_knowledge_level', value: 'basic' },
            { questionId: 'related_knowledge_level', value: 'basic' },
            { questionId: 'learning_goal', value: 'Build production-ready applications' },
            { questionId: 'preferred_depth', value: 'balanced' },
            { questionId: 'preferred_length', value: 'medium' },
        ],
        syllabusPrompt: 'Create a didactic unit about next.js framework.',
        syllabusPromptGeneratedAt: '2026-03-12T00:01:00.000Z',
    }
}

describe('OpenAiSyllabusGenerator', () => {
    it('parses a valid OpenAI JSON syllabus response', async () => {
        const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    title: 'Next.js Mastery Path',
                                    overview:
                                        'A practical syllabus for building production-ready Next.js applications.',
                                    learningGoals: [
                                        'Understand rendering strategies',
                                        'Ship production features',
                                        'Evaluate architectural tradeoffs',
                                    ],
                                    chapters: [
                                        {
                                            title: 'Rendering Foundations',
                                            overview: 'Understand the rendering model.',
                                            keyPoints: ['SSR', 'SSG', 'ISR'],
                                        },
                                    ],
                                }),
                            },
                        },
                    ],
                }),
                {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )
        )

        const generator = new OpenAiSyllabusGenerator({
            apiKey: 'test-key',
            model: 'gpt-test',
            fetchImplementation,
        })

        const syllabus = await generator.generate(createApprovedQuestionnaireUnitInit())

        expect(fetchImplementation).toHaveBeenCalledOnce()
        expect(syllabus).toMatchObject({
            title: 'Next.js Mastery Path',
            overview:
                'A practical syllabus for building production-ready Next.js applications.',
        })
        expect(syllabus.learningGoals).toHaveLength(3)
        expect(syllabus.chapters).toHaveLength(1)
        expect(syllabus.chapters[0]).toMatchObject({
            title: 'Rendering Foundations',
        })
    })

    it('throws when OpenAI returns a non-success status', async () => {
        const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
            new Response('upstream failure', {
                status: 500,
            })
        )

        const generator = new OpenAiSyllabusGenerator({
            apiKey: 'test-key',
            fetchImplementation,
        })

        await expect(
            generator.generate(createApprovedQuestionnaireUnitInit())
        ).rejects.toThrow('OpenAI syllabus generation failed with status 500.')
    })
})
