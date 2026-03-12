import type { DidacticUnit } from './create-didactic-unit.js'

export interface DidacticUnitChapterSummary {
    chapterIndex: number
    title: string
    overview: string
    hasGeneratedContent: boolean
    generatedAt?: string
    updatedAt?: string
}

export function listDidacticUnitChapters(
    didacticUnit: DidacticUnit
): DidacticUnitChapterSummary[] {
    return didacticUnit.chapters.map((chapter, chapterIndex) => {
        const generatedChapter = didacticUnit.generatedChapters?.find(
            (candidate) => candidate.chapterIndex === chapterIndex
        )

        return {
            chapterIndex,
            title: chapter.title,
            overview: chapter.overview,
            hasGeneratedContent: generatedChapter !== undefined,
            generatedAt: generatedChapter?.generatedAt,
            updatedAt: generatedChapter?.updatedAt,
        }
    })
}
