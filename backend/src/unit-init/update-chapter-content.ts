import type { CreatedUnitInit } from './create-unit-init.js'
import type { UnitInitGeneratedChapter } from './generate-chapter-content.js'

export interface UpdateChapterContentInput {
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

export function parseUpdateChapterContentInput(body: unknown): UpdateChapterContentInput {
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

export function updateChapterContent(
    unitInit: CreatedUnitInit,
    chapterIndex: number,
    input: UpdateChapterContentInput
): CreatedUnitInit {
    const generatedChapters = unitInit.generatedChapters ?? []
    const existingChapterIndex = generatedChapters.findIndex(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (existingChapterIndex < 0) {
        throw new Error('Generated chapter not found.')
    }

    const currentChapter = generatedChapters[existingChapterIndex]
    const updatedChapter: UnitInitGeneratedChapter = {
        ...currentChapter,
        title: input.chapter.title,
        overview: input.chapter.overview,
        content: input.chapter.content,
        keyTakeaways: input.chapter.keyTakeaways,
        updatedAt: new Date().toISOString(),
    }

    const updatedChapters = [...generatedChapters]
    updatedChapters[existingChapterIndex] = updatedChapter

    return {
        ...unitInit,
        generatedChapters: updatedChapters,
    }
}
