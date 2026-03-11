import type { CreatedUnitInit } from './create-unit-init.js'
import type { UnitInitSyllabus, UnitInitSyllabusChapter } from './generate-syllabus.js'

export interface UpdateSyllabusInput {
    syllabus: UnitInitSyllabus
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

function parseChapter(value: unknown, index: number): UnitInitSyllabusChapter {
    if (!value || typeof value !== 'object') {
        throw new Error(`syllabus.chapters[${index}] must be an object.`)
    }

    const payload = value as {
        title?: unknown
        overview?: unknown
        keyPoints?: unknown
    }

    return {
        title: parseNonEmptyString(payload.title, `syllabus.chapters[${index}].title`),
        overview: parseNonEmptyString(
            payload.overview,
            `syllabus.chapters[${index}].overview`
        ),
        keyPoints: parseStringArray(
            payload.keyPoints,
            `syllabus.chapters[${index}].keyPoints`
        ),
    }
}

export function parseUpdateSyllabusInput(body: unknown): UpdateSyllabusInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { syllabus?: unknown }

    if (!payload.syllabus || typeof payload.syllabus !== 'object') {
        throw new Error('Syllabus is required.')
    }

    const syllabusPayload = payload.syllabus as {
        title?: unknown
        overview?: unknown
        learningGoals?: unknown
        chapters?: unknown
    }

    if (!Array.isArray(syllabusPayload.chapters) || syllabusPayload.chapters.length === 0) {
        throw new Error('syllabus.chapters must be a non-empty array.')
    }

    return {
        syllabus: {
            title: parseNonEmptyString(syllabusPayload.title, 'syllabus.title'),
            overview: parseNonEmptyString(syllabusPayload.overview, 'syllabus.overview'),
            learningGoals: parseStringArray(
                syllabusPayload.learningGoals,
                'syllabus.learningGoals'
            ),
            chapters: syllabusPayload.chapters.map((chapter, index) =>
                parseChapter(chapter, index)
            ),
        },
    }
}

export function updateSyllabus(
    unitInit: CreatedUnitInit,
    input: UpdateSyllabusInput
): CreatedUnitInit {
    if (unitInit.status !== 'syllabus_ready' || !unitInit.syllabus) {
        throw new Error('Syllabus cannot be updated from the current unit-init state.')
    }

    return {
        ...unitInit,
        nextAction: 'approve_syllabus',
        syllabus: input.syllabus,
        syllabusUpdatedAt: new Date().toISOString(),
    }
}
