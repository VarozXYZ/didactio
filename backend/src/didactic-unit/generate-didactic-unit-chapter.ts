import type {
    ChapterGenerationSource,
    ChapterGenerator,
} from '../providers/chapter-generator.js'
import {
    resolveDidacticUnitStatus,
    type DidacticUnit,
} from './create-didactic-unit.js'
import {
    createDidacticUnitChapterRevision,
    type DidacticUnitChapterRevisionSource,
} from './didactic-unit-chapter.js'

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

export function hasGeneratedDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number
): boolean {
    return (
        didacticUnit.generatedChapters?.some(
            (chapter) => chapter.chapterIndex === chapterIndex
        ) ?? false
    )
}

export async function generateDidacticUnitChapter(
    didacticUnit: DidacticUnit,
    chapterIndex: number,
    chapterGenerator: ChapterGenerator,
    revisionSource: DidacticUnitChapterRevisionSource = 'ai_generation'
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
            chapterRevisions: [
                ...(didacticUnit.chapterRevisions ?? []),
                createDidacticUnitChapterRevision({
                    chapterIndex,
                    source: revisionSource,
                    chapter: generatedChapter,
                }),
            ],
            status: resolveDidacticUnitStatus({
                ...didacticUnit,
                generatedChapters: updatedChapters,
            }),
            generatedChapters: updatedChapters,
        }
    }

    return {
        ...didacticUnit,
        chapterRevisions: [
            ...(didacticUnit.chapterRevisions ?? []),
            createDidacticUnitChapterRevision({
                chapterIndex,
                source: revisionSource,
                chapter: generatedChapter,
            }),
        ],
        generatedChapters: [...generatedChapters, generatedChapter].sort(
            (left, right) => left.chapterIndex - right.chapterIndex
        ),
        status: resolveDidacticUnitStatus({
            ...didacticUnit,
            generatedChapters: [...generatedChapters, generatedChapter].sort(
                (left, right) => left.chapterIndex - right.chapterIndex
            ),
        }),
    }
}
