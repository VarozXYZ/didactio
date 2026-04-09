import type { DidacticUnit } from './create-didactic-unit.js'

export interface DidacticUnitSummary {
    id: string
    title: string
    topic: string
    folderId: string
    provider: DidacticUnit['provider']
    status: DidacticUnit['status']
    nextAction: DidacticUnit['nextAction']
    overview: string
    chapterCount: number
    generatedChapterCount: number
    completedChapterCount: number
    progressPercent: number
    studyProgressPercent: number
    createdAt: string
    lastActivityAt: string
}

function calculateProgressPercent(
    chapterCount: number,
    generatedChapterCount: number
): number {
    if (chapterCount === 0) {
        return 0
    }

    return Math.round((generatedChapterCount / chapterCount) * 100)
}

const planningProgressPercentByStatus: Partial<Record<DidacticUnit['status'], number>> = {
    submitted: 0,
    moderation_completed: 17,
    questionnaire_ready: 33,
    questionnaire_answered: 50,
    syllabus_prompt_ready: 67,
    syllabus_ready: 83,
    syllabus_approved: 100,
}

function resolveLastActivityAt(didacticUnit: DidacticUnit): string {
    return (
        didacticUnit.syllabusApprovedAt ??
        didacticUnit.syllabusUpdatedAt ??
        didacticUnit.syllabusGeneratedAt ??
        didacticUnit.syllabusPromptGeneratedAt ??
        didacticUnit.questionnaireAnsweredAt ??
        didacticUnit.questionnaireGeneratedAt ??
        didacticUnit.moderatedAt ??
        didacticUnit.updatedAt ??
        didacticUnit.createdAt
    )
}

export function summarizeDidacticUnit(didacticUnit: DidacticUnit): DidacticUnitSummary {
    const chapterCount = didacticUnit.chapters.length
    const generatedChapterCount = didacticUnit.generatedChapters?.length ?? 0
    const completedChapterCount = didacticUnit.completedChapters?.length ?? 0
    const lastActivityAt = resolveLastActivityAt(didacticUnit)
    const progressPercent =
        planningProgressPercentByStatus[didacticUnit.status] ??
        calculateProgressPercent(chapterCount, generatedChapterCount)

    return {
        id: didacticUnit.id,
        title: didacticUnit.title,
        topic: didacticUnit.topic,
        folderId: didacticUnit.folderId,
        provider: didacticUnit.provider,
        status: didacticUnit.status,
        nextAction: didacticUnit.nextAction,
        overview: didacticUnit.overview,
        chapterCount,
        generatedChapterCount,
        completedChapterCount,
        progressPercent,
        studyProgressPercent: calculateProgressPercent(
            chapterCount,
            completedChapterCount
        ),
        createdAt: didacticUnit.createdAt,
        lastActivityAt,
    }
}

export interface DidacticUnitStudyProgress {
    chapterCount: number
    completedChapterCount: number
    studyProgressPercent: number
}

export function summarizeDidacticUnitStudyProgress(
    didacticUnit: DidacticUnit
): DidacticUnitStudyProgress {
    const chapterCount = didacticUnit.chapters.length
    const completedChapterCount = didacticUnit.completedChapters?.length ?? 0

    return {
        chapterCount,
        completedChapterCount,
        studyProgressPercent: calculateProgressPercent(
            chapterCount,
            completedChapterCount
        ),
    }
}
