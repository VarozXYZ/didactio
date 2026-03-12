import { getAppEnv } from '../config/env.js'
import type { CreatedUnitInit, UnitInitProvider } from '../unit-init/create-unit-init.js'
import type { UnitInitGeneratedChapter } from '../unit-init/generate-chapter-content.js'
import { DeepSeekChapterGenerator } from './deepseek-chapter-generator.js'
import { OpenAiChapterGenerator } from './openai-chapter-generator.js'

export interface ChapterGenerator {
    generate(
        unitInit: CreatedUnitInit,
        chapterIndex: number
    ): Promise<UnitInitGeneratedChapter>
}

export function resolveChapterGeneratorModel(provider: UnitInitProvider): string {
    const env = getAppEnv()

    if (provider === 'openai') {
        return env.openAiApiKey ? env.openAiChapterModel : 'fake-openai-chapter-generator'
    }

    return env.deepSeekApiKey ? env.deepSeekChapterModel : 'fake-deepseek-chapter-generator'
}

function findAnswerValue(unitInit: CreatedUnitInit, questionId: string): string {
    return (
        unitInit.questionnaireAnswers?.find((answer) => answer.questionId === questionId)?.value ??
        'not provided'
    )
}

function getSyllabusChapter(unitInit: CreatedUnitInit, chapterIndex: number) {
    const chapter = unitInit.syllabus?.chapters[chapterIndex]

    if (!chapter) {
        throw new Error('Chapter index is out of range for the approved syllabus.')
    }

    return chapter
}

export function buildChapterGenerationPrompt(
    unitInit: CreatedUnitInit,
    chapterIndex: number
): string {
    const chapter = getSyllabusChapter(unitInit, chapterIndex)
    const topicKnowledgeLevel = findAnswerValue(unitInit, 'topic_knowledge_level')
    const relatedKnowledgeLevel = findAnswerValue(unitInit, 'related_knowledge_level')
    const learningGoal = findAnswerValue(unitInit, 'learning_goal')
    const preferredDepth = findAnswerValue(unitInit, 'preferred_depth')

    return [
        'Create one chapter of a personalized didactic unit.',
        `Topic: ${unitInit.topic}`,
        `Chapter title: ${chapter.title}`,
        `Chapter overview: ${chapter.overview}`,
        `Chapter key points: ${chapter.keyPoints.join(', ')}`,
        `Current topic knowledge: ${topicKnowledgeLevel}`,
        `Related knowledge: ${relatedKnowledgeLevel}`,
        `Learner goal: ${learningGoal}`,
        `Preferred depth: ${preferredDepth}`,
        'Return only valid JSON with this exact shape:',
        '{',
        '  "title": "string",',
        '  "overview": "string",',
        '  "content": "string",',
        '  "keyTakeaways": ["string"]',
        '}',
    ].join('\n')
}

class OpenAiFakeChapterGenerator implements ChapterGenerator {
    async generate(
        unitInit: CreatedUnitInit,
        chapterIndex: number
    ): Promise<UnitInitGeneratedChapter> {
        const chapter = getSyllabusChapter(unitInit, chapterIndex)
        const learningGoal = findAnswerValue(unitInit, 'learning_goal')
        const preferredDepth = findAnswerValue(unitInit, 'preferred_depth')

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
}

class DeepSeekFakeChapterGenerator implements ChapterGenerator {
    async generate(
        unitInit: CreatedUnitInit,
        chapterIndex: number
    ): Promise<UnitInitGeneratedChapter> {
        const chapter = getSyllabusChapter(unitInit, chapterIndex)
        const learningGoal = findAnswerValue(unitInit, 'learning_goal')
        const relatedKnowledge = findAnswerValue(unitInit, 'related_knowledge_level')

        return {
            chapterIndex,
            title: chapter.title,
            overview: chapter.overview,
            content: [
                `This chapter builds a practical reasoning model for ${chapter.title}.`,
                `It connects the learner goal (${learningGoal}) with the current related knowledge level (${relatedKnowledge}).`,
                `The chapter emphasizes decisions, tradeoffs, and how to tell whether understanding of ${unitInit.topic} is actually usable.`,
                `Important signals in this chapter include ${chapter.keyPoints.join(', ')}.`,
                `By the end, the learner should be able to reason through the main patterns and justify the next practical step.`,
            ].join(' '),
            keyTakeaways: [
                `Recognize the chapter reasoning model: ${chapter.title}`,
                `Relate the chapter to the learner goal: ${learningGoal}`,
                `Track the main signals and tradeoffs: ${chapter.keyPoints.join(', ')}`,
            ],
            generatedAt: new Date().toISOString(),
        }
    }
}

export class ProviderBackedFakeChapterGenerator implements ChapterGenerator {
    private readonly generators: Record<UnitInitProvider, ChapterGenerator>

    constructor() {
        const env = getAppEnv()

        this.generators = {
            openai: env.openAiApiKey
                ? new OpenAiChapterGenerator({
                      apiKey: env.openAiApiKey,
                      model: env.openAiChapterModel,
                  })
                : new OpenAiFakeChapterGenerator(),
            deepseek: env.deepSeekApiKey
                ? new DeepSeekChapterGenerator({
                      apiKey: env.deepSeekApiKey,
                      model: env.deepSeekChapterModel,
                  })
                : new DeepSeekFakeChapterGenerator(),
        }
    }

    async generate(
        unitInit: CreatedUnitInit,
        chapterIndex: number
    ): Promise<UnitInitGeneratedChapter> {
        return this.generators[unitInit.provider].generate(unitInit, chapterIndex)
    }
}
