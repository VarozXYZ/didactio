import { randomUUID } from 'node:crypto'

export interface DidacticUnitGeneratedChapter {
    chapterIndex: number
    title: string
    overview: string
    content: string
    keyTakeaways: string[]
    generatedAt: string
    updatedAt?: string
}

export type DidacticUnitChapterRevisionSource =
    | 'ai_generation'
    | 'ai_regeneration'
    | 'manual_edit'

export interface DidacticUnitChapterRevision {
    id: string
    chapterIndex: number
    source: DidacticUnitChapterRevisionSource
    chapter: DidacticUnitGeneratedChapter
    createdAt: string
}

export interface UpdateDidacticUnitChapterInput {
    chapter: {
        title: string
        overview: string
        content: string
        keyTakeaways: string[]
    }
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

export function parseUpdateDidacticUnitChapterInput(
    body: unknown
): UpdateDidacticUnitChapterInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { chapter?: unknown }

    if (!payload.chapter || typeof payload.chapter !== 'object') {
        throw new Error('Chapter is required.')
    }

    const chapterPayload = payload.chapter as {
        title?: unknown
        overview?: unknown
        content?: unknown
        keyTakeaways?: unknown
    }

    return {
        chapter: {
            title: parseNonEmptyString(chapterPayload.title, 'chapter.title'),
            overview: parseNonEmptyString(chapterPayload.overview, 'chapter.overview'),
            content: parseNonEmptyString(chapterPayload.content, 'chapter.content'),
            keyTakeaways: parseStringArray(
                chapterPayload.keyTakeaways,
                'chapter.keyTakeaways'
            ),
        },
    }
}

export function createDidacticUnitChapterRevision(input: {
    chapterIndex: number
    source: DidacticUnitChapterRevisionSource
    chapter: DidacticUnitGeneratedChapter
}): DidacticUnitChapterRevision {
    return {
        id: randomUUID(),
        chapterIndex: input.chapterIndex,
        source: input.source,
        chapter: {
            ...input.chapter,
            keyTakeaways: [...input.chapter.keyTakeaways],
        },
        createdAt: input.chapter.updatedAt ?? input.chapter.generatedAt,
    }
}
