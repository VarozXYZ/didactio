import type { DidacticUnit } from './create-didactic-unit.js'
import type {
    DidacticUnitGeneratedChapter,
    UpdateDidacticUnitChapterInput,
} from './didactic-unit-chapter.js'
import {
    createDidacticUnitChapterRevision,
    resolveDidacticUnitChapterPresentationSettings,
} from './didactic-unit-chapter.js'

export function updateDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number,
    input: UpdateDidacticUnitChapterInput
): DidacticUnit {
    const generatedChapters = didacticUnit.generatedChapters ?? []
    const existingChapterIndex = generatedChapters.findIndex(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (existingChapterIndex < 0) {
        throw new Error('Generated didactic unit chapter not found.')
    }

    const currentChapter = generatedChapters[existingChapterIndex]
    const updatedChapter: DidacticUnitGeneratedChapter = {
        ...currentChapter,
        title: input.chapter.title,
        markdown: input.chapter.content,
        presentationSettings: resolveDidacticUnitChapterPresentationSettings(
            input.chapter.presentationSettings ?? currentChapter.presentationSettings
        ),
        updatedAt: new Date().toISOString(),
    }

    const updatedChapters = [...generatedChapters]
    updatedChapters[existingChapterIndex] = updatedChapter

    return {
        ...didacticUnit,
        chapterRevisions: [
            ...(didacticUnit.chapterRevisions ?? []),
            createDidacticUnitChapterRevision({
                chapterIndex,
                source: 'manual_edit',
                chapter: updatedChapter,
            }),
        ],
        generatedChapters: updatedChapters,
        updatedAt: updatedChapter.updatedAt as string,
    }
}
