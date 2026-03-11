import type { CreatedUnitInit } from './create-unit-init.js'

function findAnswerValue(unitInit: CreatedUnitInit, questionId: string): string {
    return (
        unitInit.questionnaireAnswers?.find((answer) => answer.questionId === questionId)?.value ??
        'not provided'
    )
}

function buildSyllabusPrompt(unitInit: CreatedUnitInit): string {
    const topicKnowledge = findAnswerValue(unitInit, 'topic_knowledge_level')
    const relatedKnowledge = findAnswerValue(unitInit, 'related_knowledge_level')
    const learningGoal = findAnswerValue(unitInit, 'learning_goal')
    const preferredDepth = findAnswerValue(unitInit, 'preferred_depth')
    const preferredLength = findAnswerValue(unitInit, 'preferred_length')

    return [
        `Create a didactic unit about ${unitInit.topic}.`,
        `Learner current knowledge of the topic: ${topicKnowledge}.`,
        `Learner knowledge of related concepts: ${relatedKnowledge}.`,
        `Learning goal: ${learningGoal}.`,
        `Preferred depth: ${preferredDepth}.`,
        `Preferred length: ${preferredLength}.`,
        'Return a structured syllabus with a title, overview, learning goals, and ordered chapter outline.',
    ].join('\n')
}

export function generateSyllabusPrompt(unitInit: CreatedUnitInit): CreatedUnitInit {
    if (unitInit.status !== 'questionnaire_answered' || !unitInit.questionnaireAnswers) {
        throw new Error('Syllabus prompt cannot be generated from the current unit-init state.')
    }

    return {
        ...unitInit,
        status: 'syllabus_prompt_ready',
        nextAction: 'review_syllabus_prompt',
        syllabusPrompt: buildSyllabusPrompt(unitInit),
        syllabusPromptGeneratedAt: new Date().toISOString(),
    }
}
