import type { CreatedUnitInit, UnitInitProvider } from '../unit-init/create-unit-init.js'
import type {
    UnitInitSyllabus,
    UnitInitSyllabusChapter,
} from '../unit-init/generate-syllabus.js'

export interface SyllabusGenerator {
    generate(unitInit: CreatedUnitInit): UnitInitSyllabus
}

function findAnswerValue(unitInit: CreatedUnitInit, questionId: string): string {
    return (
        unitInit.questionnaireAnswers?.find((answer) => answer.questionId === questionId)?.value ??
        'not provided'
    )
}

function buildOpenAiLearningGoals(unitInit: CreatedUnitInit): string[] {
    const learningGoal = findAnswerValue(unitInit, 'learning_goal')
    const preferredDepth = findAnswerValue(unitInit, 'preferred_depth')

    return [
        `Build confidence in ${unitInit.topic}`,
        `Reach the learner goal: ${learningGoal}`,
        `Match a ${preferredDepth} level of detail throughout the unit`,
    ]
}

function buildDeepSeekLearningGoals(unitInit: CreatedUnitInit): string[] {
    const learningGoal = findAnswerValue(unitInit, 'learning_goal')
    const relatedKnowledge = findAnswerValue(unitInit, 'related_knowledge_level')

    return [
        `Map the core reasoning model behind ${unitInit.topic}`,
        `Connect prior related knowledge (${relatedKnowledge}) to the learner goal: ${learningGoal}`,
        `Practice making sound decisions with the topic in realistic scenarios`,
    ]
}

function buildOpenAiChapters(unitInit: CreatedUnitInit): UnitInitSyllabusChapter[] {
    return [
        {
            title: `Foundations of ${unitInit.topic}`,
            overview: `Introduce the core concepts and shared vocabulary required to understand ${unitInit.topic}.`,
            keyPoints: [
                `What ${unitInit.topic} is and why it matters`,
                'Essential terminology',
                'Common beginner misunderstandings',
            ],
        },
        {
            title: `Practical workflow for ${unitInit.topic}`,
            overview: `Move from theory into hands-on use of ${unitInit.topic} through guided practice.`,
            keyPoints: [
                'Recommended workflow',
                'Step-by-step example',
                'How to avoid common errors',
            ],
        },
        {
            title: `Applied use cases for ${unitInit.topic}`,
            overview: `Connect the topic to real-world goals and decision-making scenarios.`,
            keyPoints: [
                'When to use it',
                'How to evaluate tradeoffs',
                'What to practice next',
            ],
        },
    ]
}

function buildDeepSeekChapters(unitInit: CreatedUnitInit): UnitInitSyllabusChapter[] {
    return [
        {
            title: `${unitInit.topic} mental model`,
            overview: `Build a practical reasoning framework for understanding how ${unitInit.topic} works.`,
            keyPoints: [
                'Core system model',
                'How the moving parts relate',
                'Signals that indicate correct understanding',
            ],
        },
        {
            title: `${unitInit.topic} decision patterns`,
            overview: `Learn how to choose the right approach when working with ${unitInit.topic}.`,
            keyPoints: [
                'Common decision points',
                'Tradeoff analysis',
                'Failure patterns to watch for',
            ],
        },
        {
            title: `${unitInit.topic} applied practice`,
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
    generate(unitInit: CreatedUnitInit): UnitInitSyllabus {
        const preferredLength = findAnswerValue(unitInit, 'preferred_length')
        const learningGoal = findAnswerValue(unitInit, 'learning_goal')

        return {
            title: `${unitInit.topic} Learning Path`,
            overview: `A ${preferredLength} didactic unit designed to help the learner achieve: ${learningGoal}.`,
            learningGoals: buildOpenAiLearningGoals(unitInit),
            chapters: buildOpenAiChapters(unitInit),
        }
    }
}

class DeepSeekFakeSyllabusGenerator implements SyllabusGenerator {
    generate(unitInit: CreatedUnitInit): UnitInitSyllabus {
        const preferredLength = findAnswerValue(unitInit, 'preferred_length')
        const learningGoal = findAnswerValue(unitInit, 'learning_goal')

        return {
            title: `${unitInit.topic} Learning Path`,
            overview: `A ${preferredLength} didactic unit organized around practical reasoning for: ${learningGoal}.`,
            learningGoals: buildDeepSeekLearningGoals(unitInit),
            chapters: buildDeepSeekChapters(unitInit),
        }
    }
}

export class ProviderBackedFakeSyllabusGenerator implements SyllabusGenerator {
    private readonly generators: Record<UnitInitProvider, SyllabusGenerator> = {
        openai: new OpenAiFakeSyllabusGenerator(),
        deepseek: new DeepSeekFakeSyllabusGenerator(),
    }

    generate(unitInit: CreatedUnitInit): UnitInitSyllabus {
        return this.generators[unitInit.provider].generate(unitInit)
    }
}
