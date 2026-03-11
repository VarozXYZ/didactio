import type { CreatedUnitInit } from './create-unit-init.js'

export interface UnitInitGeneratedChapter {
    chapterIndex: number
    title: string
    overview: string
    content: string
    keyTakeaways: string[]
    generatedAt: string
}

function buildChapterContent(unitInit: CreatedUnitInit, chapterIndex: number): UnitInitGeneratedChapter {
    const chapter = unitInit.syllabus?.chapters[chapterIndex]

    if (!chapter) {
        throw new Error('Chapter index is out of range for the approved syllabus.')
    }

    const learningGoal =
        unitInit.questionnaireAnswers?.find((answer) => answer.questionId === 'learning_goal')
            ?.value ?? 'the stated learner goal'

    const preferredDepth =
        unitInit.questionnaireAnswers?.find((answer) => answer.questionId === 'preferred_depth')
            ?.value ?? 'balanced'

    return {
        chapterIndex,
        title: chapter.title,
        overview: chapter.overview,
        content: [
            `This chapter focuses on ${chapter.title}.`,
            `The purpose is to help the learner move closer to ${learningGoal}.`,
            `It should keep a ${preferredDepth} level of explanation while staying grounded in ${unitInit.topic}.`,
            `Core ideas covered here include ${chapter.keyPoints.join(', ')}.`,
            `By the end of the chapter, the learner should be able to explain the main concepts, connect them to practical decisions, and continue into the next chapter with clear context.`,
        ].join(' '),
        keyTakeaways: [
            `Understand the chapter scope: ${chapter.title}`,
            `Connect the chapter to the learner goal: ${learningGoal}`,
            `Review the main key points: ${chapter.keyPoints.join(', ')}`,
        ],
        generatedAt: new Date().toISOString(),
    }
}

export function generateChapterContent(
    unitInit: CreatedUnitInit,
    chapterIndex: number
): CreatedUnitInit {
    if (unitInit.status !== 'syllabus_approved' || !unitInit.syllabus) {
        throw new Error('Chapter content cannot be generated from the current unit-init state.')
    }

    const generatedChapter = buildChapterContent(unitInit, chapterIndex)
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
