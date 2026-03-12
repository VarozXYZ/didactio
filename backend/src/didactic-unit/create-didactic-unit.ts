import { randomUUID } from 'node:crypto'
import type { CreatedUnitInit } from '../unit-init/create-unit-init.js'
import type { UnitInitProvider } from '../unit-init/create-unit-init.js'
import type { UnitInitQuestionAnswer } from '../unit-init/answer-questionnaire.js'
import type { UnitInitSyllabus, UnitInitSyllabusChapter } from '../unit-init/generate-syllabus.js'
import type { DidacticUnitGeneratedChapter } from './didactic-unit-chapter.js'

export type DidacticUnitStatus = 'ready_for_content_generation'

export interface DidacticUnit {
    id: string
    unitInitId: string
    ownerId: string
    title: string
    topic: string
    provider: UnitInitProvider
    status: DidacticUnitStatus
    overview: string
    learningGoals: string[]
    chapters: UnitInitSyllabusChapter[]
    questionnaireAnswers: UnitInitQuestionAnswer[]
    generatedChapters?: DidacticUnitGeneratedChapter[]
    createdAt: string
}

function ensureApprovedSyllabus(
    unitInit: CreatedUnitInit
): UnitInitSyllabus {
    if (unitInit.status !== 'syllabus_approved' || !unitInit.syllabus || !unitInit.syllabusApprovedAt) {
        throw new Error('Didactic unit can only be created from an approved syllabus.')
    }

    return unitInit.syllabus
}

export function createDidacticUnitFromApprovedUnitInit(
    unitInit: CreatedUnitInit
): DidacticUnit {
    const syllabus = ensureApprovedSyllabus(unitInit)
    const createdAt = unitInit.syllabusApprovedAt as string

    return {
        id: randomUUID(),
        unitInitId: unitInit.id,
        ownerId: unitInit.ownerId,
        title: syllabus.title,
        topic: unitInit.topic,
        provider: unitInit.provider,
        status: 'ready_for_content_generation',
        overview: syllabus.overview,
        learningGoals: [...syllabus.learningGoals],
        chapters: syllabus.chapters.map((chapter) => ({
            title: chapter.title,
            overview: chapter.overview,
            keyPoints: [...chapter.keyPoints],
        })),
        questionnaireAnswers: [...(unitInit.questionnaireAnswers ?? [])],
        createdAt,
    }
}
