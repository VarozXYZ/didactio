import { getAppEnv } from '../config/env.js'
import type { UnitInitProvider } from '../unit-init/create-unit-init.js'
import type { UnitInitQuestionAnswer } from '../unit-init/answer-questionnaire.js'
import { DeepSeekSyllabusGenerator } from './deepseek-syllabus-generator.js'
import { OpenAiSyllabusGenerator } from './openai-syllabus-generator.js'
import type {
    UnitInitSyllabus,
    UnitInitSyllabusChapter,
} from '../unit-init/generate-syllabus.js'

export interface SyllabusGenerationSource {
    topic: string
    provider: UnitInitProvider
    questionnaireAnswers?: UnitInitQuestionAnswer[]
    syllabusPrompt?: string
}

export interface SyllabusGenerator {
    generate(source: SyllabusGenerationSource): Promise<UnitInitSyllabus>
}

export function resolveSyllabusGeneratorModel(provider: UnitInitProvider): string {
    const env = getAppEnv()

    if (provider === 'openai') {
        return env.openAiApiKey ? env.openAiSyllabusModel : 'fake-openai-syllabus-generator'
    }

    return env.deepSeekApiKey
        ? env.deepSeekSyllabusModel
        : 'fake-deepseek-syllabus-generator'
}

function findAnswerValue(source: SyllabusGenerationSource, questionId: string): string {
    return (
        source.questionnaireAnswers?.find((answer) => answer.questionId === questionId)?.value ??
        'not provided'
    )
}

function buildOpenAiLearningGoals(source: SyllabusGenerationSource): string[] {
    const learningGoal = findAnswerValue(source, 'learning_goal')
    const preferredDepth = findAnswerValue(source, 'preferred_depth')

    return [
        `Build confidence in ${source.topic}`,
        `Reach the learner goal: ${learningGoal}`,
        `Match a ${preferredDepth} level of detail throughout the unit`,
    ]
}

function buildDeepSeekLearningGoals(source: SyllabusGenerationSource): string[] {
    const learningGoal = findAnswerValue(source, 'learning_goal')
    const relatedKnowledge = findAnswerValue(source, 'related_knowledge_level')

    return [
        `Map the core reasoning model behind ${source.topic}`,
        `Connect prior related knowledge (${relatedKnowledge}) to the learner goal: ${learningGoal}`,
        `Practice making sound decisions with the topic in realistic scenarios`,
    ]
}

function buildOpenAiChapters(source: SyllabusGenerationSource): UnitInitSyllabusChapter[] {
    return [
        {
            title: `Foundations of ${source.topic}`,
            overview: `Introduce the core concepts and shared vocabulary required to understand ${source.topic}.`,
            keyPoints: [
                `What ${source.topic} is and why it matters`,
                'Essential terminology',
                'Common beginner misunderstandings',
            ],
        },
        {
            title: `Practical workflow for ${source.topic}`,
            overview: `Move from theory into hands-on use of ${source.topic} through guided practice.`,
            keyPoints: [
                'Recommended workflow',
                'Step-by-step example',
                'How to avoid common errors',
            ],
        },
        {
            title: `Applied use cases for ${source.topic}`,
            overview: `Connect the topic to real-world goals and decision-making scenarios.`,
            keyPoints: [
                'When to use it',
                'How to evaluate tradeoffs',
                'What to practice next',
            ],
        },
    ]
}

function buildDeepSeekChapters(source: SyllabusGenerationSource): UnitInitSyllabusChapter[] {
    return [
        {
            title: `${source.topic} mental model`,
            overview: `Build a practical reasoning framework for understanding how ${source.topic} works.`,
            keyPoints: [
                'Core system model',
                'How the moving parts relate',
                'Signals that indicate correct understanding',
            ],
        },
        {
            title: `${source.topic} decision patterns`,
            overview: `Learn how to choose the right approach when working with ${source.topic}.`,
            keyPoints: [
                'Common decision points',
                'Tradeoff analysis',
                'Failure patterns to watch for',
            ],
        },
        {
            title: `${source.topic} applied practice`,
            overview: `Turn the topic into repeatable practical action through scenarios and structured practice.`,
            keyPoints: [
                'Scenario-based application',
                'Practical checkpoints',
                'What to refine next',
            ],
        },
    ]
}

class OpenAiFakeSyllabusGenerator implements SyllabusGenerator {
    async generate(source: SyllabusGenerationSource): Promise<UnitInitSyllabus> {
        const preferredLength = findAnswerValue(source, 'preferred_length')
        const learningGoal = findAnswerValue(source, 'learning_goal')

        return {
            title: `${source.topic} Learning Path`,
            overview: `A ${preferredLength} didactic unit designed to help the learner achieve: ${learningGoal}.`,
            learningGoals: buildOpenAiLearningGoals(source),
            chapters: buildOpenAiChapters(source),
        }
    }
}

class DeepSeekFakeSyllabusGenerator implements SyllabusGenerator {
    async generate(source: SyllabusGenerationSource): Promise<UnitInitSyllabus> {
        const preferredLength = findAnswerValue(source, 'preferred_length')
        const learningGoal = findAnswerValue(source, 'learning_goal')

        return {
            title: `${source.topic} Learning Path`,
            overview: `A ${preferredLength} didactic unit organized around practical reasoning for: ${learningGoal}.`,
            learningGoals: buildDeepSeekLearningGoals(source),
            chapters: buildDeepSeekChapters(source),
        }
    }
}

export class ProviderBackedFakeSyllabusGenerator implements SyllabusGenerator {
    private readonly generators: Record<UnitInitProvider, SyllabusGenerator>

    constructor() {
        const env = getAppEnv()

        this.generators = {
            openai: env.openAiApiKey
                ? new OpenAiSyllabusGenerator({
                      apiKey: env.openAiApiKey,
                      model: env.openAiSyllabusModel,
                  })
                : new OpenAiFakeSyllabusGenerator(),
            deepseek: env.deepSeekApiKey
                ? new DeepSeekSyllabusGenerator({
                      apiKey: env.deepSeekApiKey,
                      model: env.deepSeekSyllabusModel,
                  })
                : new DeepSeekFakeSyllabusGenerator(),
        }
    }

    async generate(source: SyllabusGenerationSource): Promise<UnitInitSyllabus> {
        return this.generators[source.provider].generate(source)
    }
}
