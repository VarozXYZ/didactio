import type { DidacticUnit } from './create-didactic-unit.js'
import type { UpdateChapterContentInput } from '../unit-init/update-chapter-content.js'
import type { UnitInitGeneratedChapter } from '../unit-init/generate-chapter-content.js'

export function updateDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number,
    input: UpdateChapterContentInput
): DidacticUnit {
    const generatedChapters = didacticUnit.generatedChapters ?? []
    const existingChapterIndex = generatedChapters.findIndex(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (existingChapterIndex < 0) {
        throw new Error('Generated didactic unit chapter not found.')
    }

    const currentChapter = generatedChapters[existingChapterIndex]
    const updatedChapter: UnitInitGeneratedChapter = {
        ...currentChapter,
        title: input.chapter.title,
        overview: input.chapter.overview,
        content: input.chapter.content,
        keyTakeaways: input.chapter.keyTakeaways,
        updatedAt: new Date().toISOString(),
    }

    const updatedChapters = [...generatedChapters]
    updatedChapters[existingChapterIndex] = updatedChapter

    return {
        ...didacticUnit,
        generatedChapters: updatedChapters,
    }
}
