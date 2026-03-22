import { describe, expect, it, vi } from 'vitest'
import {
    DeepSeekSyllabusGenerationError,
    DeepSeekSyllabusGenerator,
} from '../src/providers/deepseek-syllabus-generator.js'
import type { SyllabusGenerationSource } from '../src/providers/syllabus-generator.js'

function createSyllabusGenerationSource(): SyllabusGenerationSource {
    return {
        topic: 'next.js framework',
        provider: 'deepseek',
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

describe('DeepSeekSyllabusGenerator', () => {
    it('parses a valid DeepSeek JSON syllabus response', async () => {
        const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    title: 'Next.js Reasoning Path',
                                    overview: 'A practical DeepSeek syllabus.',
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

        const generator = new DeepSeekSyllabusGenerator({
            apiKey: 'test-key',
            model: 'deepseek-chat',
            fetchImplementation,
        })

        const syllabus = await generator.generate(createSyllabusGenerationSource())

        expect(fetchImplementation).toHaveBeenCalledOnce()
        const requestInit = fetchImplementation.mock.calls[0]?.[1]
        const parsedBody = JSON.parse(String(requestInit?.body))
        expect(parsedBody.temperature).toBe(0.1)
        expect(parsedBody.response_format).toEqual({
            type: 'json_object',
        })
        expect(parsedBody.messages[1].content).toContain(
            'Return only valid JSON with this exact shape:'
        )
        expect(parsedBody.messages[1].content).toContain('"chapters"')
        expect(parsedBody.messages[1].content).toContain('include at least 3 chapters')
        expect(syllabus.title).toBe('Next.js Reasoning Path')
        expect(syllabus.chapters).toHaveLength(1)
    })

    it('throws when DeepSeek returns a non-success status', async () => {
        const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
            new Response('upstream failure', {
                status: 500,
            })
        )

        const generator = new DeepSeekSyllabusGenerator({
            apiKey: 'test-key',
            fetchImplementation,
        })

        await expect(
            generator.generate(createSyllabusGenerationSource())
        ).rejects.toThrow('DeepSeek syllabus generation failed with status 500.')
    })

    it('throws a parse error that preserves the raw model content', async () => {
        const rawContent = JSON.stringify({
            title: 'Incomplete syllabus',
            overview: 'Missing chapters',
            learningGoals: ['One'],
            chapters: [],
        })
        const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: rawContent,
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

        const generator = new DeepSeekSyllabusGenerator({
            apiKey: 'test-key',
            fetchImplementation,
        })

        await expect(
            generator.generate(createSyllabusGenerationSource())
        ).rejects.toMatchObject({
            message: 'DeepSeek syllabus response must include a non-empty chapters array.',
            rawOutput: rawContent,
        })
    })
})
