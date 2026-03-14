import type { CreatedUnitInit } from './create-unit-init.js'
import type {
    SyllabusGenerationSource,
    SyllabusGenerator,
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

export function createSyllabusGenerationSourceFromUnitInit(
    unitInit: CreatedUnitInit
): SyllabusGenerationSource {
    return {
        topic: unitInit.topic,
        provider: unitInit.provider,
        questionnaireAnswers: unitInit.questionnaireAnswers,
        syllabusPrompt: unitInit.syllabusPrompt,
    }
}

export async function generateSyllabus(
    unitInit: CreatedUnitInit,
    syllabusGenerator: SyllabusGenerator
): Promise<CreatedUnitInit> {
    if (unitInit.status !== 'syllabus_prompt_ready' || !unitInit.syllabusPrompt) {
        throw new Error('Syllabus cannot be generated from the current unit-init state.')
    }

    return {
        ...unitInit,
        status: 'syllabus_ready',
        nextAction: 'review_syllabus',
        syllabus: await syllabusGenerator.generate(
            createSyllabusGenerationSourceFromUnitInit(unitInit)
        ),
        syllabusGeneratedAt: new Date().toISOString(),
    }
}
