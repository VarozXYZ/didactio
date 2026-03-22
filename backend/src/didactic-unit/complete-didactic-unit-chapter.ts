import type { DidacticUnit } from './create-didactic-unit.js'

export function completeDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number
): DidacticUnit {
    const generatedChapter = didacticUnit.generatedChapters?.find(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (!generatedChapter) {
        throw new Error('Generated didactic unit chapter not found.')
    }

    const completedChapters = didacticUnit.completedChapters ?? []
    const existingCompletion = completedChapters.find(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (existingCompletion) {
        return didacticUnit
    }

    const completedAt = new Date().toISOString()

    return {
        ...didacticUnit,
        completedChapters: [
            ...completedChapters,
            {
                chapterIndex,
                completedAt,
            },
        ].sort((left, right) => left.chapterIndex - right.chapterIndex),
        updatedAt: completedAt,
    }
}
