import type {
    DidacticUnitQuestionAnswer,
    DidacticUnitSyllabus,
} from '../didactic-unit/planning.js'

export interface SyllabusGenerationSource {
    topic: string
    provider: string
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
    syllabusPrompt?: string
}

export interface SyllabusGenerator {
    generate(source: SyllabusGenerationSource): Promise<DidacticUnitSyllabus>
}
