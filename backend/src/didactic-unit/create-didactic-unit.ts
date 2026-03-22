import { randomUUID } from 'node:crypto'
import type {
    CreateDidacticUnitInput,
    DidacticUnitNextAction,
    DidacticUnitProvider,
    DidacticUnitQuestionAnswer,
    DidacticUnitQuestionnaire,
    DidacticUnitSyllabus,
    DidacticUnitSyllabusChapter,
} from './planning.js'
import type {
    DidacticUnitChapterCompletion,
    DidacticUnitChapterRevision,
    DidacticUnitGeneratedChapter,
} from './didactic-unit-chapter.js'

export type DidacticUnitStatus =
    | 'submitted'
    | 'moderation_completed'
    | 'questionnaire_ready'
    | 'questionnaire_answered'
    | 'syllabus_prompt_ready'
    | 'syllabus_ready'
    | 'syllabus_approved'
    | 'ready_for_content_generation'
    | 'content_generation_in_progress'
    | 'content_generation_completed'

export interface DidacticUnit {
    id: string
    ownerId: string
    title: string
    topic: string
    provider: DidacticUnitProvider
    status: DidacticUnitStatus
    nextAction: DidacticUnitNextAction
    overview: string
    learningGoals: string[]
    chapters: DidacticUnitSyllabusChapter[]
    questionnaire?: DidacticUnitQuestionnaire
    questionnaireGeneratedAt?: string
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
    questionnaireAnsweredAt?: string
    moderatedAt?: string
    syllabusPrompt?: string
    syllabusPromptGeneratedAt?: string
    syllabus?: DidacticUnitSyllabus
    syllabusGeneratedAt?: string
    syllabusUpdatedAt?: string
    syllabusApprovedAt?: string
    generatedChapters?: DidacticUnitGeneratedChapter[]
    completedChapters?: DidacticUnitChapterCompletion[]
    chapterRevisions?: DidacticUnitChapterRevision[]
    createdAt: string
    updatedAt: string
}

export function createDidacticUnit(
    input: CreateDidacticUnitInput,
    ownerId: string
): DidacticUnit {
    const createdAt = new Date().toISOString()
    const id = randomUUID()

    return {
        id,
        ownerId,
        title: input.topic,
        topic: input.topic,
        provider: input.provider,
        status: 'moderation_completed',
        nextAction: 'generate_questionnaire',
        overview: '',
        learningGoals: [],
        chapters: [],
        moderatedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
    }
}

export function resolveDidacticUnitStatus(didacticUnit: {
    chapters: DidacticUnitSyllabusChapter[]
    generatedChapters?: DidacticUnitGeneratedChapter[]
}): DidacticUnitStatus {
    const chapterCount = didacticUnit.chapters.length
    const generatedChapterCount = didacticUnit.generatedChapters?.length ?? 0

    if (generatedChapterCount === 0) {
        return 'ready_for_content_generation'
    }

    if (generatedChapterCount >= chapterCount) {
        return 'content_generation_completed'
    }

    return 'content_generation_in_progress'
}
