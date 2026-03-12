import type { CreatedUnitInit } from '../unit-init/create-unit-init.js'
import type { UnitInitGeneratedChapter } from '../unit-init/generate-chapter-content.js'
import { buildChapterGenerationPrompt } from './chapter-generator.js'

type FetchImplementation = typeof fetch

interface OpenAiChapterGeneratorOptions {
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

function getSyllabusChapter(unitInit: CreatedUnitInit, chapterIndex: number) {
    const chapter = unitInit.syllabus?.chapters[chapterIndex]

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

function parseChapterResponse(content: string, chapterIndex: number): UnitInitGeneratedChapter {
    let parsedValue: unknown

    try {
        parsedValue = JSON.parse(extractJsonBlock(content))
    } catch {
        throw new Error('OpenAI chapter response was not valid JSON.')
    }

    if (!parsedValue || typeof parsedValue !== 'object') {
        throw new Error('OpenAI chapter response must be a JSON object.')
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

export class OpenAiChapterGenerator {
    private readonly apiKey: string
    private readonly model: string
    private readonly fetchImplementation: FetchImplementation

    constructor(options: OpenAiChapterGeneratorOptions) {
        this.apiKey = options.apiKey
        this.model = options.model ?? 'gpt-4o-mini'
        this.fetchImplementation = options.fetchImplementation ?? fetch
    }

    async generate(
        unitInit: CreatedUnitInit,
        chapterIndex: number
    ): Promise<UnitInitGeneratedChapter> {
        getSyllabusChapter(unitInit, chapterIndex)

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
                    temperature: 0.4,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You create high-quality personalized educational chapter content and return only valid JSON.',
                        },
                        {
                            role: 'user',
                            content: buildChapterGenerationPrompt(unitInit, chapterIndex),
                        },
                    ],
                }),
            }
        )

        if (!response.ok) {
            throw new Error(`OpenAI chapter generation failed with status ${response.status}.`)
        }

        const payload = (await response.json()) as OpenAiChatCompletionResponse
        const content = payload.choices?.[0]?.message?.content

        if (!content) {
            throw new Error('OpenAI chapter response did not include message content.')
        }

        return parseChapterResponse(content, chapterIndex)
    }
}
