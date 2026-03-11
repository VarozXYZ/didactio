import type { CreatedUnitInit } from './create-unit-init.js'

export interface UnitInitQuestionAnswer {
    questionId: string
    value: string
}

export interface UnitInitQuestionnaireAnswersInput {
    answers: UnitInitQuestionAnswer[]
}

export function parseQuestionnaireAnswersInput(
    body: unknown
): UnitInitQuestionnaireAnswersInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { answers?: unknown }
    if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
        throw new Error('Answers must be a non-empty array.')
    }

    const answers = payload.answers.map((entry) => {
        if (!entry || typeof entry !== 'object') {
            throw new Error('Each answer must be an object.')
        }

        const answer = entry as { questionId?: unknown; value?: unknown }
        const questionId =
            typeof answer.questionId === 'string' ? answer.questionId.trim() : ''
        const value = typeof answer.value === 'string' ? answer.value.trim() : ''

        if (!questionId) {
            throw new Error('Each answer must include a questionId.')
        }

        if (!value) {
            throw new Error('Each answer must include a non-empty value.')
        }

        return { questionId, value }
    })

    return { answers }
}

export function answerQuestionnaire(
    unitInit: CreatedUnitInit,
    input: UnitInitQuestionnaireAnswersInput
): CreatedUnitInit {
    if (unitInit.status !== 'questionnaire_ready' || !unitInit.questionnaire) {
        throw new Error('Questionnaire cannot be answered from the current unit-init state.')
    }

    const questionIds = unitInit.questionnaire.questions.map((question) => question.id)
    const uniqueAnswerIds = new Set(input.answers.map((answer) => answer.questionId))

    if (uniqueAnswerIds.size !== input.answers.length) {
        throw new Error('Questionnaire answers cannot contain duplicate questionIds.')
    }

    if (input.answers.length !== questionIds.length) {
        throw new Error('Questionnaire answers must cover every generated question.')
    }

    for (const answer of input.answers) {
        if (!questionIds.includes(answer.questionId)) {
            throw new Error('Questionnaire answers must match the generated questions.')
        }
    }

    return {
        ...unitInit,
        status: 'questionnaire_answered',
        nextAction: 'generate_syllabus_prompt',
        questionnaireAnswers: input.answers,
        questionnaireAnsweredAt: new Date().toISOString(),
    }
}
