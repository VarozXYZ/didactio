import type { DidacticUnit } from './create-didactic-unit.js'
import {
    getModuleReadCharacterCount,
    getModuleReadProgressRecord,
    getModuleTotalCharacterCount,
} from './module-reading-progress.js'

export interface DidacticUnitChapterSummary {
    chapterIndex: number
    title: string
    overview: string
    hasGeneratedContent: boolean
    readCharacterCount: number
    totalCharacterCount: number
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
        const totalCharacterCount = getModuleTotalCharacterCount(didacticUnit, chapterIndex)
        const readCharacterCount = getModuleReadCharacterCount(didacticUnit, chapterIndex)
        const isCompleted =
            totalCharacterCount > 0 && readCharacterCount >= totalCharacterCount
        const completedAt = isCompleted
            ? getModuleReadProgressRecord(didacticUnit, chapterIndex)?.lastReadAt
            : undefined

        return {
            chapterIndex,
            title: chapter.title,
            overview: chapter.overview,
            hasGeneratedContent: generatedChapter !== undefined,
            readCharacterCount,
            totalCharacterCount,
            isCompleted,
            generatedAt: generatedChapter?.generatedAt,
            updatedAt: generatedChapter?.updatedAt,
            completedAt,
        }
    })
}
