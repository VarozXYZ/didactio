import type { DidacticUnit } from './create-didactic-unit.js'

export interface DidacticUnitChapterSummary {
    chapterIndex: number
    title: string
    overview: string
    hasGeneratedContent: boolean
    isCompleted: boolean
    generatedAt?: string
    updatedAt?: string
    completedAt?: string
}

export function listDidacticUnitChapters(
    didacticUnit: DidacticUnit
): DidacticUnitChapterSummary[] {
    return didacticUnit.chapters.map((chapter, chapterIndex) => {
        const generatedChapter = didacticUnit.generatedChapters?.find(
            (candidate) => candidate.chapterIndex === chapterIndex
        )
        const completedChapter = didacticUnit.completedChapters?.find(
            (candidate) => candidate.chapterIndex === chapterIndex
        )

        return {
            chapterIndex,
            title: chapter.title,
            overview: chapter.overview,
            hasGeneratedContent: generatedChapter !== undefined,
            isCompleted: completedChapter !== undefined,
            generatedAt: generatedChapter?.generatedAt,
            updatedAt: generatedChapter?.updatedAt,
            completedAt: completedChapter?.completedAt,
        }
    })
}
