import type { DidacticUnitSyllabus } from '../didactic-unit/planning.js'
import type { SyllabusGenerationSource } from './syllabus-generator.js'

type FetchImplementation = typeof fetch

interface OpenAiSyllabusGeneratorOptions {
    apiKey: string
    model?: string
    fetchImplementation?: FetchImplementation
}

interface OpenAiChatCompletionResponse {
    choices?: Array<{
        message?: {
            content?: string | null
        }
    }>
}

export class OpenAiSyllabusGenerationError extends Error {
    readonly rawOutput?: string

    constructor(message: string, rawOutput?: string) {
        super(message)
        this.name = 'OpenAiSyllabusGenerationError'
        this.rawOutput = rawOutput
    }
}

function findAnswerValue(source: SyllabusGenerationSource, questionId: string): string {
    return (
        source.questionnaireAnswers?.find((answer) => answer.questionId === questionId)?.value ??
        'not provided'
    )
}

function extractJsonBlock(value: string): string {
    const trimmedValue = value.trim()

    if (trimmedValue.startsWith('```')) {
        const withoutOpeningFence = trimmedValue.replace(/^```(?:json)?\s*/i, '')
        return withoutOpeningFence.replace(/\s*```$/, '').trim()
    }

    return trimmedValue
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
    const parsedValue = typeof value === 'string' ? value.trim() : ''

    if (!parsedValue) {
        throw new Error(`${fieldName} is required.`)
    }

    return parsedValue
}

function parseStringArray(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`${fieldName} must be a non-empty array.`)
    }

    return value.map((item, index) =>
        parseNonEmptyString(item, `${fieldName}[${index}]`)
    )
}

function parseSyllabusResponse(content: string): DidacticUnitSyllabus {
    let parsedValue: unknown

    try {
        parsedValue = JSON.parse(extractJsonBlock(content))
    } catch {
        throw new Error('OpenAI syllabus response was not valid JSON.')
    }

    if (!parsedValue || typeof parsedValue !== 'object') {
        throw new Error('OpenAI syllabus response must be a JSON object.')
    }

    const payload = parsedValue as {
        title?: unknown
        overview?: unknown
        learningGoals?: unknown
        chapters?: unknown
    }

    if (!Array.isArray(payload.chapters) || payload.chapters.length === 0) {
        throw new Error('OpenAI syllabus response must include a non-empty chapters array.')
    }

    return {
        title: parseNonEmptyString(payload.title, 'title'),
        overview: parseNonEmptyString(payload.overview, 'overview'),
        learningGoals: parseStringArray(payload.learningGoals, 'learningGoals'),
        chapters: payload.chapters.map((chapter, index) => {
            if (!chapter || typeof chapter !== 'object') {
                throw new Error(`chapters[${index}] must be an object.`)
            }

            const chapterPayload = chapter as {
                title?: unknown
                overview?: unknown
                keyPoints?: unknown
            }

            return {
                title: parseNonEmptyString(chapterPayload.title, `chapters[${index}].title`),
                overview: parseNonEmptyString(
                    chapterPayload.overview,
                    `chapters[${index}].overview`
                ),
                keyPoints: parseStringArray(
                    chapterPayload.keyPoints,
                    `chapters[${index}].keyPoints`
                ),
            }
        }),
    }
}

function buildPrompt(source: SyllabusGenerationSource): string {
    if (source.syllabusPrompt?.trim()) {
        return source.syllabusPrompt.trim()
    }

    const topicKnowledgeLevel = findAnswerValue(source, 'topic_knowledge_level')
    const relatedKnowledgeLevel = findAnswerValue(source, 'related_knowledge_level')
    const learningGoal = findAnswerValue(source, 'learning_goal')
    const preferredDepth = findAnswerValue(source, 'preferred_depth')
    const preferredLength = findAnswerValue(source, 'preferred_length')

    return [
        'Create a syllabus for a personalized didactic unit.',
        `Topic: ${source.topic}`,
        `Current topic knowledge: ${topicKnowledgeLevel}`,
        `Related knowledge: ${relatedKnowledgeLevel}`,
        `Learner goal: ${learningGoal}`,
        `Preferred depth: ${preferredDepth}`,
        `Preferred length: ${preferredLength}`,
        'Return only valid JSON with this exact shape:',
        '{',
        '  "title": "string",',
        '  "overview": "string",',
        '  "learningGoals": ["string"],',
        '  "chapters": [',
        '    {',
        '      "title": "string",',
        '      "overview": "string",',
        '      "keyPoints": ["string"]',
        '    }',
        '  ]',
        '}',
    ].join('\n')
}

function buildSyllabusResponseFormat() {
    return {
        type: 'json_schema' as const,
        json_schema: {
            name: 'didactio_syllabus',
            strict: true,
            schema: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'overview', 'learningGoals', 'chapters'],
                properties: {
                    title: {
                        type: 'string',
                    },
                    overview: {
                        type: 'string',
                    },
                    learningGoals: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'string',
                        },
                    },
                    chapters: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['title', 'overview', 'keyPoints'],
                            properties: {
                                title: {
                                    type: 'string',
                                },
                                overview: {
                                    type: 'string',
                                },
                                keyPoints: {
                                    type: 'array',
                                    minItems: 1,
                                    items: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    }
}

export class OpenAiSyllabusGenerator {
    private readonly apiKey: string
    private readonly model: string
    private readonly fetchImplementation: FetchImplementation

    constructor(options: OpenAiSyllabusGeneratorOptions) {
        this.apiKey = options.apiKey
        this.model = options.model ?? 'gpt-4o-mini'
        this.fetchImplementation = options.fetchImplementation ?? fetch
    }

    async generate(source: SyllabusGenerationSource): Promise<DidacticUnitSyllabus> {
        const response = await this.fetchImplementation(
            'https://api.openai.com/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    temperature: 0.1,
                    response_format: buildSyllabusResponseFormat(),
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You create high-quality personalized educational syllabi and return only valid JSON.',
                        },
                        {
                            role: 'user',
                            content: buildPrompt(source),
                        },
                    ],
                }),
            }
        )

        const responseText = await response.text()

        if (!response.ok) {
            throw new OpenAiSyllabusGenerationError(
                `OpenAI syllabus generation failed with status ${response.status}.`,
                responseText
            )
        }

        let payload: OpenAiChatCompletionResponse

        try {
            payload = JSON.parse(responseText) as OpenAiChatCompletionResponse
        } catch {
            throw new OpenAiSyllabusGenerationError(
                'OpenAI syllabus response was not valid JSON.',
                responseText
            )
        }

        const content = payload.choices?.[0]?.message?.content

        if (!content) {
            throw new OpenAiSyllabusGenerationError(
                'OpenAI syllabus response did not include message content.',
                responseText
            )
        }

        try {
            return parseSyllabusResponse(content)
        } catch (error) {
            throw new OpenAiSyllabusGenerationError(
                error instanceof Error
                    ? error.message
                    : 'OpenAI syllabus response could not be parsed.',
                content
            )
        }
    }
}
