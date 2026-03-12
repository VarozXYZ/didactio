import { describe, expect, it, vi } from 'vitest'
import {
    DeepSeekChapterGenerationError,
    DeepSeekChapterGenerator,
} from '../src/providers/deepseek-chapter-generator.js'
import type { CreatedUnitInit } from '../src/unit-init/create-unit-init.js'

function createApprovedSyllabusUnitInit(): CreatedUnitInit {
    return {
        id: 'unit-init-1',
        ownerId: 'mock-user',
        topic: 'next.js framework',
        provider: 'deepseek',
        status: 'syllabus_approved',
        nextAction: 'generate_unit_content',
        createdAt: '2026-03-12T00:00:00.000Z',
        questionnaireAnswers: [
            { questionId: 'topic_knowledge_level', value: 'basic' },
            { questionId: 'related_knowledge_level', value: 'basic' },
            { questionId: 'learning_goal', value: 'Build production-ready applications' },
            { questionId: 'preferred_depth', value: 'balanced' },
            { questionId: 'preferred_length', value: 'medium' },
        ],
        syllabus: {
            title: 'Next.js Learning Path',
            overview: 'A practical syllabus.',
            learningGoals: ['One', 'Two', 'Three'],
            chapters: [
                {
                    title: 'Rendering Foundations',
                    overview: 'Understand the rendering model.',
                    keyPoints: ['SSR', 'SSG', 'ISR'],
                },
            ],
        },
        syllabusGeneratedAt: '2026-03-12T00:01:00.000Z',
        syllabusApprovedAt: '2026-03-12T00:02:00.000Z',
    }
}

describe('DeepSeekChapterGenerator', () => {
    it('parses a valid DeepSeek JSON chapter response', async () => {
        const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    choices: [
                        {
                            message: {
                                content: JSON.stringify({
                                    title: 'Rendering Foundations',
                                    overview: 'Understand the rendering model.',
                                    content:
                                        'This chapter explains the rendering model in a practical way.',
                                    keyTakeaways: [
                                        'Understand SSR',
                                        'Understand SSG',
                                        'Understand ISR',
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

        const generator = new DeepSeekChapterGenerator({
            apiKey: 'test-key',
            model: 'deepseek-chat',
            fetchImplementation,
        })

        const chapter = await generator.generate(createApprovedSyllabusUnitInit(), 0)

        expect(fetchImplementation).toHaveBeenCalledOnce()
        const requestInit = fetchImplementation.mock.calls[0]?.[1]
        const parsedBody = JSON.parse(String(requestInit?.body))
        expect(parsedBody.temperature).toBe(0.1)
        expect(parsedBody.response_format).toEqual({
            type: 'json_object',
        })
        expect(chapter).toMatchObject({
            chapterIndex: 0,
            title: 'Rendering Foundations',
            overview: 'Understand the rendering model.',
            content: 'This chapter explains the rendering model in a practical way.',
        })
        expect(chapter.keyTakeaways).toHaveLength(3)
        expect(typeof chapter.generatedAt).toBe('string')
    })

    it('throws when DeepSeek returns a non-success status', async () => {
        const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
            new Response('upstream failure', {
                status: 500,
            })
        )

        const generator = new DeepSeekChapterGenerator({
            apiKey: 'test-key',
            fetchImplementation,
        })

        await expect(
            generator.generate(createApprovedSyllabusUnitInit(), 0)
        ).rejects.toThrow('DeepSeek chapter generation failed with status 500.')
    })

    it('throws a parse error that preserves the raw model content', async () => {
        const rawContent = JSON.stringify({
            title: 'Rendering Foundations',
            overview: 'Understand the rendering model.',
            content: '',
            keyTakeaways: [],
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

        const generator = new DeepSeekChapterGenerator({
            apiKey: 'test-key',
            fetchImplementation,
        })

        await expect(
            generator.generate(createApprovedSyllabusUnitInit(), 0)
        ).rejects.toMatchObject<Partial<DeepSeekChapterGenerationError>>({
            message: 'content is required.',
            rawOutput: rawContent,
        })
    })
})
