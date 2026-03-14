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
    progressPercent: number
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
        progressPercent: calculateProgressPercent(chapterCount, generatedChapterCount),
        createdAt: didacticUnit.createdAt,
    }
}
