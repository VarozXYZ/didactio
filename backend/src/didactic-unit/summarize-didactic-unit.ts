import type { DidacticUnit } from './create-didactic-unit.js'

export interface DidacticUnitSummary {
    id: string
    unitInitId: string
    title: string
    topic: string
    provider: DidacticUnit['provider']
    status: DidacticUnit['status']
    overview: string
    chapterCount: number
    generatedChapterCount: number
    completedChapterCount: number
    progressPercent: number
    studyProgressPercent: number
    createdAt: string
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

export function summarizeDidacticUnit(didacticUnit: DidacticUnit): DidacticUnitSummary {
    const chapterCount = didacticUnit.chapters.length
    const generatedChapterCount = didacticUnit.generatedChapters?.length ?? 0
    const completedChapterCount = didacticUnit.completedChapters?.length ?? 0

    return {
        id: didacticUnit.id,
        unitInitId: didacticUnit.unitInitId,
        title: didacticUnit.title,
        topic: didacticUnit.topic,
        provider: didacticUnit.provider,
        status: didacticUnit.status,
        overview: didacticUnit.overview,
        chapterCount,
        generatedChapterCount,
        completedChapterCount,
        progressPercent: calculateProgressPercent(chapterCount, generatedChapterCount),
        studyProgressPercent: calculateProgressPercent(
            chapterCount,
            completedChapterCount
        ),
        createdAt: didacticUnit.createdAt,
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
