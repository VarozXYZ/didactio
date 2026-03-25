import type { DidacticUnitGeneratedChapter } from '../didactic-unit/didactic-unit-chapter.js'
import type {
    DidacticUnitQuestionAnswer,
    DidacticUnitSyllabus,
} from '../didactic-unit/planning.js'

export interface ChapterGenerationSource {
    topic: string
    provider: string
    questionnaireAnswers?: DidacticUnitQuestionAnswer[]
    syllabus?: DidacticUnitSyllabus
}

export interface ChapterGenerator {
    generate(
        source: ChapterGenerationSource,
        chapterIndex: number
    ): Promise<DidacticUnitGeneratedChapter>
}

function findAnswerValue(source: ChapterGenerationSource, questionId: string): string {
    return (
        source.questionnaireAnswers?.find((answer) => answer.questionId === questionId)?.value ??
        'not provided'
    )
}

function getSyllabusChapter(source: ChapterGenerationSource, chapterIndex: number) {
    const chapter = source.syllabus?.chapters[chapterIndex]

    if (!chapter) {
        throw new Error('Chapter index is out of range for the approved syllabus.')
    }

    return chapter
}

export function buildChapterGenerationPrompt(
    source: ChapterGenerationSource,
    chapterIndex: number
): string {
    const chapter = getSyllabusChapter(source, chapterIndex)
    const topicKnowledgeLevel = findAnswerValue(source, 'topic_knowledge_level')
    const relatedKnowledgeLevel = findAnswerValue(source, 'related_knowledge_level')
    const learningGoal = findAnswerValue(source, 'learning_goal')
    const preferredDepth = findAnswerValue(source, 'preferred_depth')

    return [
        'Write one didactic chapter in markdown.',
        `Topic: ${source.topic}`,
        `Chapter title: ${chapter.title}`,
        `Chapter overview: ${chapter.overview}`,
        `Chapter key points: ${chapter.keyPoints.join(', ')}`,
        `Current topic knowledge: ${topicKnowledgeLevel}`,
        `Related knowledge: ${relatedKnowledgeLevel}`,
        `Learner goal: ${learningGoal}`,
        `Preferred depth: ${preferredDepth}`,
        'Structure:',
        '# <Chapter Title>',
        '## Overview',
        '<paragraph>',
        '## Lesson',
        '<markdown body>',
        '## Key Takeaways',
        '- takeaway',
        '- takeaway',
        '- takeaway',
    ].join('\n')
}
