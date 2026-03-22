import type { DidacticUnitGeneratedChapter } from '../didactic-unit/didactic-unit-chapter.js'
import {
    buildChapterGenerationPrompt,
    type ChapterGenerationSource,
} from './chapter-generator.js'

type FetchImplementation = typeof fetch

interface DeepSeekChapterGeneratorOptions {
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

export class DeepSeekChapterGenerationError extends Error {
    readonly rawOutput?: string

    constructor(message: string, rawOutput?: string) {
        super(message)
        this.name = 'DeepSeekChapterGenerationError'
        this.rawOutput = rawOutput
    }
}

function getSyllabusChapter(source: ChapterGenerationSource, chapterIndex: number) {
    const chapter = source.syllabus?.chapters[chapterIndex]

    if (!chapter) {
        throw new Error('Chapter index is out of range for the approved syllabus.')
    }

    return chapter
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

function parseChapterResponse(
    content: string,
    chapterIndex: number
): DidacticUnitGeneratedChapter {
    let parsedValue: unknown

    try {
        parsedValue = JSON.parse(extractJsonBlock(content))
    } catch {
        throw new Error('DeepSeek chapter response was not valid JSON.')
    }

    if (!parsedValue || typeof parsedValue !== 'object') {
        throw new Error('DeepSeek chapter response must be a JSON object.')
    }

    const payload = parsedValue as {
        title?: unknown
        overview?: unknown
        content?: unknown
        keyTakeaways?: unknown
    }

    return {
        chapterIndex,
        title: parseNonEmptyString(payload.title, 'title'),
        overview: parseNonEmptyString(payload.overview, 'overview'),
        content: parseNonEmptyString(payload.content, 'content'),
        keyTakeaways: parseStringArray(payload.keyTakeaways, 'keyTakeaways'),
        generatedAt: new Date().toISOString(),
    }
}

export class DeepSeekChapterGenerator {
    private readonly apiKey: string
    private readonly model: string
    private readonly fetchImplementation: FetchImplementation

    constructor(options: DeepSeekChapterGeneratorOptions) {
        this.apiKey = options.apiKey
        this.model = options.model ?? 'deepseek-chat'
        this.fetchImplementation = options.fetchImplementation ?? fetch
    }

    async generate(
        source: ChapterGenerationSource,
        chapterIndex: number
    ): Promise<DidacticUnitGeneratedChapter> {
        getSyllabusChapter(source, chapterIndex)

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
                                'You create high-quality personalized educational chapter content and return only valid JSON matching the requested shape.',
                        },
                        {
                            role: 'user',
                            content: buildChapterGenerationPrompt(source, chapterIndex),
                        },
                    ],
                }),
            }
        )

        const responseText = await response.text()

        if (!response.ok) {
            throw new DeepSeekChapterGenerationError(
                `DeepSeek chapter generation failed with status ${response.status}.`,
                responseText
            )
        }

        let payload: DeepSeekChatCompletionResponse

        try {
            payload = JSON.parse(responseText) as DeepSeekChatCompletionResponse
        } catch {
            throw new DeepSeekChapterGenerationError(
                'DeepSeek chapter response was not valid JSON.',
                responseText
            )
        }

        const content = payload.choices?.[0]?.message?.content

        if (!content) {
            throw new DeepSeekChapterGenerationError(
                'DeepSeek chapter response did not include message content.',
                responseText
            )
        }

        try {
            return parseChapterResponse(content, chapterIndex)
        } catch (error) {
            throw new DeepSeekChapterGenerationError(
                error instanceof Error
                    ? error.message
                    : 'DeepSeek chapter response could not be parsed.',
                content
            )
        }
    }
}
