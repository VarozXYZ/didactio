import type { CreatedUnitInit } from './create-unit-init.js'

export interface UnitInitChapterSummary {
    chapterIndex: number
    title: string
    overview: string
    hasGeneratedContent: boolean
    generatedAt?: string
    updatedAt?: string
}

export function listChapters(unitInit: CreatedUnitInit): UnitInitChapterSummary[] {
    if (!unitInit.syllabus) {
        throw new Error('Chapters are not available until a syllabus has been generated.')
    }

    return unitInit.syllabus.chapters.map((chapter, chapterIndex) => {
        const generatedChapter = unitInit.generatedChapters?.find(
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
