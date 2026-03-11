import type { CreatedUnitInit } from './create-unit-init.js'
import {
    ProviderBackedFakeChapterGenerator,
    type ChapterGenerator,
} from '../providers/chapter-generator.js'

export interface UnitInitGeneratedChapter {
    chapterIndex: number
    title: string
    overview: string
    content: string
    keyTakeaways: string[]
    generatedAt: string
    updatedAt?: string
}

const defaultChapterGenerator = new ProviderBackedFakeChapterGenerator()

export function generateChapterContent(
    unitInit: CreatedUnitInit,
    chapterIndex: number,
    chapterGenerator: ChapterGenerator = defaultChapterGenerator
): CreatedUnitInit {
    if (unitInit.status !== 'syllabus_approved' || !unitInit.syllabus) {
        throw new Error('Chapter content cannot be generated from the current unit-init state.')
    }

    const generatedChapter = chapterGenerator.generate(unitInit, chapterIndex)
    const generatedChapters = unitInit.generatedChapters ?? []
    const existingChapterIndex = generatedChapters.findIndex(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (existingChapterIndex >= 0) {
        const updatedChapters = [...generatedChapters]
        updatedChapters[existingChapterIndex] = generatedChapter

        return {
            ...unitInit,
            nextAction: 'generate_unit_content',
            generatedChapters: updatedChapters,
        }
    }

    return {
        ...unitInit,
        nextAction: 'generate_unit_content',
        generatedChapters: [...generatedChapters, generatedChapter].sort(
            (left, right) => left.chapterIndex - right.chapterIndex
        ),
    }
}
