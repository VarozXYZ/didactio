import type { ChapterGenerator } from '../providers/chapter-generator.js'
import type { CreatedUnitInit } from '../unit-init/create-unit-init.js'
import type { DidacticUnit } from './create-didactic-unit.js'

function createChapterGenerationSource(didacticUnit: DidacticUnit): CreatedUnitInit {
    return {
        id: didacticUnit.unitInitId,
        ownerId: didacticUnit.ownerId,
        topic: didacticUnit.topic,
        provider: didacticUnit.provider,
        status: 'syllabus_approved',
        nextAction: 'generate_unit_content',
        createdAt: didacticUnit.createdAt,
        questionnaireAnswers: didacticUnit.questionnaireAnswers,
        syllabus: {
            title: didacticUnit.title,
            overview: didacticUnit.overview,
            learningGoals: didacticUnit.learningGoals,
            chapters: didacticUnit.chapters,
        },
        syllabusApprovedAt: didacticUnit.createdAt,
        generatedChapters: didacticUnit.generatedChapters,
    }
}

export async function generateDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number,
    chapterGenerator: ChapterGenerator
): Promise<DidacticUnit> {
    const chapterGenerationSource = createChapterGenerationSource(didacticUnit)
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
