import type { CreatedUnitInit } from './create-unit-init.js'

export interface UnitInitSyllabusChapter {
    title: string
    overview: string
    keyPoints: string[]
}

export interface UnitInitSyllabus {
    title: string
    overview: string
    learningGoals: string[]
    chapters: UnitInitSyllabusChapter[]
}

function findAnswerValue(unitInit: CreatedUnitInit, questionId: string): string {
    return (
        unitInit.questionnaireAnswers?.find((answer) => answer.questionId === questionId)?.value ??
        'not provided'
    )
}

function buildLearningGoals(unitInit: CreatedUnitInit): string[] {
    const learningGoal = findAnswerValue(unitInit, 'learning_goal')
    const preferredDepth = findAnswerValue(unitInit, 'preferred_depth')

    return [
        `Build confidence in ${unitInit.topic}`,
        `Reach the learner goal: ${learningGoal}`,
        `Match a ${preferredDepth} level of detail throughout the unit`,
    ]
}

function buildChapters(unitInit: CreatedUnitInit): UnitInitSyllabusChapter[] {
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

function buildSyllabus(unitInit: CreatedUnitInit): UnitInitSyllabus {
    const preferredLength = findAnswerValue(unitInit, 'preferred_length')
    const learningGoal = findAnswerValue(unitInit, 'learning_goal')

    return {
        title: `${unitInit.topic} Learning Path`,
        overview: `A ${preferredLength} didactic unit designed to help the learner achieve: ${learningGoal}.`,
        learningGoals: buildLearningGoals(unitInit),
        chapters: buildChapters(unitInit),
    }
}

export function generateSyllabus(unitInit: CreatedUnitInit): CreatedUnitInit {
    if (unitInit.status !== 'syllabus_prompt_ready' || !unitInit.syllabusPrompt) {
        throw new Error('Syllabus cannot be generated from the current unit-init state.')
    }

    return {
        ...unitInit,
        status: 'syllabus_ready',
        nextAction: 'review_syllabus',
        syllabus: buildSyllabus(unitInit),
        syllabusGeneratedAt: new Date().toISOString(),
    }
}
