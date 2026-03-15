import type { DidacticUnitSyllabus } from '../didactic-unit/planning.js'
import type { SyllabusGenerationSource } from './syllabus-generator.js'

type FetchImplementation = typeof fetch

interface DeepSeekSyllabusGeneratorOptions {
    apiKey: string
    model?: string
    fetchImplementation?: FetchImplementation
}

interface DeepSeekChatCompletionResponse {
    choices?: Array<{
        message?: {
            content?: string | null
        }
    }>
}

export class DeepSeekSyllabusGenerationError extends Error {
    readonly rawOutput?: string

    constructor(message: string, rawOutput?: string) {
        super(message)
        this.name = 'DeepSeekSyllabusGenerationError'
        this.rawOutput = rawOutput
    }
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
        throw new Error('DeepSeek syllabus response was not valid JSON.')
    }

    if (!parsedValue || typeof parsedValue !== 'object') {
        throw new Error('DeepSeek syllabus response must be a JSON object.')
    }

    const payload = parsedValue as {
        title?: unknown
        overview?: unknown
        learningGoals?: unknown
        chapters?: unknown
    }

    if (!Array.isArray(payload.chapters) || payload.chapters.length === 0) {
        throw new Error('DeepSeek syllabus response must include a non-empty chapters array.')
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
    const basePrompt =
        source.syllabusPrompt?.trim() ??
        [
            'Create a syllabus for a personalized didactic unit.',
            `Topic: ${source.topic}`,
        ].join('\n')

    return [
        basePrompt,
        'Return only valid JSON with this exact shape:',
        '{',
        '  "title": "string",',
        '  "overview": "string",',
        '  "learningGoals": ["string", "string", "string"],',
        '  "chapters": [',
        '    {',
        '      "title": "string",',
        '      "overview": "string",',
        '      "keyPoints": ["string", "string", "string"]',
        '    }',
        '  ]',
        '}',
        'Rules:',
        '- chapters must be a non-empty array',
        '- include at least 3 chapters',
        '- each chapter must include title, overview, and a non-empty keyPoints array',
        '- do not include markdown fences or explanatory text',
    ].join('\n')
}

export class DeepSeekSyllabusGenerator {
    private readonly apiKey: string
    private readonly model: string
    private readonly fetchImplementation: FetchImplementation

    constructor(options: DeepSeekSyllabusGeneratorOptions) {
        this.apiKey = options.apiKey
        this.model = options.model ?? 'deepseek-chat'
        this.fetchImplementation = options.fetchImplementation ?? fetch
    }

    async generate(source: SyllabusGenerationSource): Promise<DidacticUnitSyllabus> {
        const response = await this.fetchImplementation(
            'https://api.deepseek.com/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    temperature: 0.1,
                    response_format: {
                        type: 'json_object',
                    },
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You create high-quality personalized educational syllabi and return only valid JSON matching the requested shape.',
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
            throw new DeepSeekSyllabusGenerationError(
                `DeepSeek syllabus generation failed with status ${response.status}.`,
                responseText
            )
        }

        let payload: DeepSeekChatCompletionResponse

        try {
            payload = JSON.parse(responseText) as DeepSeekChatCompletionResponse
        } catch {
            throw new DeepSeekSyllabusGenerationError(
                'DeepSeek syllabus response was not valid JSON.',
                responseText
            )
        }

        const content = payload.choices?.[0]?.message?.content

        if (!content) {
            throw new DeepSeekSyllabusGenerationError(
                'DeepSeek syllabus response did not include message content.',
                responseText
            )
        }

        try {
            return parseSyllabusResponse(content)
        } catch (error) {
            throw new DeepSeekSyllabusGenerationError(
                error instanceof Error
                    ? error.message
                    : 'DeepSeek syllabus response could not be parsed.',
                content
            )
        }
    }
}
