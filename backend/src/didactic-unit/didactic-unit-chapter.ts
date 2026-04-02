import { randomUUID } from 'node:crypto'

export interface DidacticUnitChapterPresentationSettings {
    paragraphFontFamily: 'sans' | 'serif' | 'mono'
    paragraphFontSize: '14px' | '16px' | '18px' | '20px'
    paragraphAlign: 'left' | 'center' | 'right' | 'justify'
}

export interface DidacticUnitGeneratedChapter {
    chapterIndex: number
    title: string
    markdown: string
    presentationSettings?: DidacticUnitChapterPresentationSettings
    generatedAt: string
    updatedAt?: string
}

export interface DidacticUnitChapterCompletion {
    chapterIndex: number
    completedAt: string
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
        content: string
        presentationSettings?: DidacticUnitChapterPresentationSettings
    }
}

export function createDefaultDidacticUnitChapterPresentationSettings(): DidacticUnitChapterPresentationSettings {
    return {
        paragraphFontFamily: 'sans',
        paragraphFontSize: '16px',
        paragraphAlign: 'left',
    }
}

export function resolveDidacticUnitChapterPresentationSettings(
    settings?: Partial<DidacticUnitChapterPresentationSettings> | null
): DidacticUnitChapterPresentationSettings {
    const defaults = createDefaultDidacticUnitChapterPresentationSettings()

    return {
        paragraphFontFamily:
            settings?.paragraphFontFamily ?? defaults.paragraphFontFamily,
        paragraphFontSize: settings?.paragraphFontSize ?? defaults.paragraphFontSize,
        paragraphAlign: settings?.paragraphAlign ?? defaults.paragraphAlign,
    }
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
    const parsedValue = typeof value === 'string' ? value.trim() : ''

    if (!parsedValue) {
        throw new Error(`${fieldName} is required.`)
    }

    return parsedValue
}

function parsePresentationSettings(
    value: unknown,
    fieldName: string
): DidacticUnitChapterPresentationSettings | undefined {
    if (value === undefined) {
        return undefined
    }

    if (!value || typeof value !== 'object') {
        throw new Error(`${fieldName} must be a JSON object.`)
    }

    const settings = value as Record<string, unknown>
    const paragraphFontFamily = parseNonEmptyString(
        settings.paragraphFontFamily,
        `${fieldName}.paragraphFontFamily`
    )
    const paragraphFontSize = parseNonEmptyString(
        settings.paragraphFontSize,
        `${fieldName}.paragraphFontSize`
    )
    const paragraphAlign = parseNonEmptyString(
        settings.paragraphAlign,
        `${fieldName}.paragraphAlign`
    )

    if (!['sans', 'serif', 'mono'].includes(paragraphFontFamily)) {
        throw new Error(`${fieldName}.paragraphFontFamily must be one of: sans, serif, mono.`)
    }

    if (!['14px', '16px', '18px', '20px'].includes(paragraphFontSize)) {
        throw new Error(`${fieldName}.paragraphFontSize must be one of: 14px, 16px, 18px, 20px.`)
    }

    if (!['left', 'center', 'right', 'justify'].includes(paragraphAlign)) {
        throw new Error(
            `${fieldName}.paragraphAlign must be one of: left, center, right, justify.`
        )
    }

    return {
        paragraphFontFamily: paragraphFontFamily as DidacticUnitChapterPresentationSettings['paragraphFontFamily'],
        paragraphFontSize: paragraphFontSize as DidacticUnitChapterPresentationSettings['paragraphFontSize'],
        paragraphAlign: paragraphAlign as DidacticUnitChapterPresentationSettings['paragraphAlign'],
    }
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
        content?: unknown
    }

    return {
        chapter: {
            title: parseNonEmptyString(chapterPayload.title, 'chapter.title'),
            content: parseNonEmptyString(chapterPayload.content, 'chapter.content'),
            presentationSettings: parsePresentationSettings(
                (chapterPayload as { presentationSettings?: unknown }).presentationSettings,
                'chapter.presentationSettings'
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
            presentationSettings: resolveDidacticUnitChapterPresentationSettings(
                input.chapter.presentationSettings
            ),
        },
        createdAt: input.chapter.updatedAt ?? input.chapter.generatedAt,
    }
}
