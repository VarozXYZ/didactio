import type {
    DidacticUnitQuestionAnswer,
    DidacticUnitQuestionnaireAnswersInput,
    UpdateDidacticUnitSyllabusInput,
} from './planning.js'
import { buildQuestionnaireForDidacticUnit } from './planning.js'
import type { SyllabusGenerator } from '../providers/syllabus-generator.js'
import type { DidacticUnit } from './create-didactic-unit.js'

function withUpdatedAt<T extends DidacticUnit>(didacticUnit: T): T {
    return {
        ...didacticUnit,
        updatedAt: new Date().toISOString(),
    }
}

function findAnswerValue(
    answers: DidacticUnitQuestionAnswer[] | undefined,
    questionId: string
): string {
    return answers?.find((answer) => answer.questionId === questionId)?.value ?? 'not provided'
}

function buildSyllabusPrompt(didacticUnit: DidacticUnit): string {
    const topicKnowledge = findAnswerValue(
        didacticUnit.questionnaireAnswers,
        'topic_knowledge_level'
    )
    const relatedKnowledge = findAnswerValue(
        didacticUnit.questionnaireAnswers,
        'related_knowledge_level'
    )
    const learningGoal = findAnswerValue(didacticUnit.questionnaireAnswers, 'learning_goal')
    const preferredDepth = findAnswerValue(
        didacticUnit.questionnaireAnswers,
        'preferred_depth'
    )
    const preferredLength = findAnswerValue(
        didacticUnit.questionnaireAnswers,
        'preferred_length'
    )

    return [
        `Create a didactic unit about ${didacticUnit.topic}.`,
        `Learner current knowledge of the topic: ${topicKnowledge}.`,
        `Learner knowledge of related concepts: ${relatedKnowledge}.`,
        `Learning goal: ${learningGoal}.`,
        `Preferred depth: ${preferredDepth}.`,
        `Preferred length: ${preferredLength}.`,
        'Return a structured syllabus with a title, overview, learning goals, and ordered chapter outline.',
    ].join('\n')
}

export function moderateDidacticUnitPlanning(didacticUnit: DidacticUnit): DidacticUnit {
    if (didacticUnit.status !== 'submitted') {
        throw new Error('Didactic unit cannot be moderated from its current state.')
    }

    return withUpdatedAt({
        ...didacticUnit,
        status: 'moderation_completed',
        nextAction: 'generate_questionnaire',
        moderatedAt: new Date().toISOString(),
    })
}

export function generateDidacticUnitQuestionnaire(didacticUnit: DidacticUnit): DidacticUnit {
    if (didacticUnit.status !== 'moderation_completed') {
        throw new Error('Questionnaire cannot be generated from the current didactic unit state.')
    }

    return withUpdatedAt({
        ...didacticUnit,
        status: 'questionnaire_ready',
        nextAction: 'answer_questionnaire',
        questionnaire: buildQuestionnaireForDidacticUnit(didacticUnit.topic),
        questionnaireGeneratedAt: new Date().toISOString(),
    })
}

export function answerDidacticUnitQuestionnaire(
    didacticUnit: DidacticUnit,
    input: DidacticUnitQuestionnaireAnswersInput
): DidacticUnit {
    if (didacticUnit.status !== 'questionnaire_ready' || !didacticUnit.questionnaire) {
        throw new Error('Questionnaire cannot be answered from the current didactic unit state.')
    }

    const questionIds = didacticUnit.questionnaire.questions.map((question) => question.id)
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

    return withUpdatedAt({
        ...didacticUnit,
        status: 'questionnaire_answered',
        nextAction: 'generate_syllabus_prompt',
        questionnaireAnswers: input.answers,
        questionnaireAnsweredAt: new Date().toISOString(),
    })
}

export function generateDidacticUnitSyllabusPrompt(didacticUnit: DidacticUnit): DidacticUnit {
    if (didacticUnit.status !== 'questionnaire_answered' || !didacticUnit.questionnaireAnswers) {
        throw new Error('Syllabus prompt cannot be generated from the current didactic unit state.')
    }

    return withUpdatedAt({
        ...didacticUnit,
        status: 'syllabus_prompt_ready',
        nextAction: 'review_syllabus_prompt',
        syllabusPrompt: buildSyllabusPrompt(didacticUnit),
        syllabusPromptGeneratedAt: new Date().toISOString(),
    })
}

export async function generateDidacticUnitSyllabus(
    didacticUnit: DidacticUnit,
    syllabusGenerator: SyllabusGenerator
): Promise<DidacticUnit> {
    if (didacticUnit.status !== 'syllabus_prompt_ready' || !didacticUnit.syllabusPrompt) {
        throw new Error('Syllabus cannot be generated from the current didactic unit state.')
    }

    const syllabus = await syllabusGenerator.generate({
        topic: didacticUnit.topic,
        provider: didacticUnit.provider,
        questionnaireAnswers: didacticUnit.questionnaireAnswers,
        syllabusPrompt: didacticUnit.syllabusPrompt,
    })

    return withUpdatedAt({
        ...didacticUnit,
        title: syllabus.title,
        overview: syllabus.overview,
        learningGoals: [...syllabus.learningGoals],
        chapters: syllabus.chapters.map((chapter) => ({
            title: chapter.title,
            overview: chapter.overview,
            keyPoints: [...chapter.keyPoints],
        })),
        status: 'syllabus_ready',
        nextAction: 'review_syllabus',
        syllabus,
        syllabusGeneratedAt: new Date().toISOString(),
    })
}

export function updateDidacticUnitSyllabus(
    didacticUnit: DidacticUnit,
    input: UpdateDidacticUnitSyllabusInput
): DidacticUnit {
    if (didacticUnit.status !== 'syllabus_ready' || !didacticUnit.syllabus) {
        throw new Error('Syllabus cannot be updated from the current didactic unit state.')
    }

    return withUpdatedAt({
        ...didacticUnit,
        title: input.syllabus.title,
        overview: input.syllabus.overview,
        learningGoals: [...input.syllabus.learningGoals],
        chapters: input.syllabus.chapters.map((chapter) => ({
            title: chapter.title,
            overview: chapter.overview,
            keyPoints: [...chapter.keyPoints],
        })),
        nextAction: 'approve_syllabus',
        syllabus: input.syllabus,
        syllabusUpdatedAt: new Date().toISOString(),
    })
}

export function approveDidacticUnitSyllabus(didacticUnit: DidacticUnit): DidacticUnit {
    if (didacticUnit.status !== 'syllabus_ready' || !didacticUnit.syllabus) {
        throw new Error('Syllabus cannot be approved from the current didactic unit state.')
    }

    return withUpdatedAt({
        ...didacticUnit,
        status: 'syllabus_approved',
        nextAction: 'view_didactic_unit',
        syllabusApprovedAt: new Date().toISOString(),
    })
}
