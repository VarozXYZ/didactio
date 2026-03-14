import type {
    ChapterGenerationSource,
    ChapterGenerator,
} from '../providers/chapter-generator.js'
import type { DidacticUnit } from './create-didactic-unit.js'

export function createChapterGenerationSourceFromDidacticUnit(
    didacticUnit: DidacticUnit
): ChapterGenerationSource {
    return {
        topic: didacticUnit.topic,
        provider: didacticUnit.provider,
        questionnaireAnswers: didacticUnit.questionnaireAnswers,
        syllabus: {
            title: didacticUnit.title,
            overview: didacticUnit.overview,
            learningGoals: didacticUnit.learningGoals,
            chapters: didacticUnit.chapters,
        },
    }
}

export async function generateDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number,
    chapterGenerator: ChapterGenerator
): Promise<DidacticUnit> {
    const chapterGenerationSource = createChapterGenerationSourceFromDidacticUnit(
        didacticUnit
    )
    const generatedChapter = await chapterGenerator.generate(
        chapterGenerationSource,
        chapterIndex
    )
    const generatedChapters = didacticUnit.generatedChapters ?? []
    const existingChapterIndex = generatedChapters.findIndex(
        (chapter) => chapter.chapterIndex === chapterIndex
    )

    if (existingChapterIndex >= 0) {
        const updatedChapters = [...generatedChapters]
        updatedChapters[existingChapterIndex] = generatedChapter

        return {
            ...didacticUnit,
            generatedChapters: updatedChapters,
        }
    }

    return {
        ...didacticUnit,
        generatedChapters: [...generatedChapters, generatedChapter].sort(
            (left, right) => left.chapterIndex - right.chapterIndex
        ),
    }
}
