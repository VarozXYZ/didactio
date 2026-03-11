import type { CreatedUnitInit } from './create-unit-init.js'
import {
    ProviderBackedFakeSyllabusGenerator,
    type SyllabusGenerator,
} from '../providers/syllabus-generator.js'

export interface UnitInitSyllabusChapter {
    title: string
    overview: string
    keyPoints: string[]
}

export interface UnitInitSyllabus {
    title: string
    overview: string
    learningGoals: string[]
    chapters: UnitInitSyllabusChapter[]
}

const defaultSyllabusGenerator = new ProviderBackedFakeSyllabusGenerator()

export function generateSyllabus(
    unitInit: CreatedUnitInit,
    syllabusGenerator: SyllabusGenerator = defaultSyllabusGenerator
): CreatedUnitInit {
    if (unitInit.status !== 'syllabus_prompt_ready' || !unitInit.syllabusPrompt) {
        throw new Error('Syllabus cannot be generated from the current unit-init state.')
    }

    return {
        ...unitInit,
        status: 'syllabus_ready',
        nextAction: 'review_syllabus',
        syllabus: syllabusGenerator.generate(unitInit),
        syllabusGeneratedAt: new Date().toISOString(),
    }
}
