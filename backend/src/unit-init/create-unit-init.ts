import { randomUUID } from 'node:crypto'
import type { UnitInitQuestionAnswer } from './answer-questionnaire.js'
import type { UnitInitQuestionnaire } from './generate-questionnaire.js'
import type { UnitInitSyllabus } from './generate-syllabus.js'

export type UnitInitProvider = 'openai' | 'deepseek'
export type UnitInitStatus =
    | 'submitted'
    | 'moderation_completed'
    | 'questionnaire_ready'
    | 'questionnaire_answered'
    | 'syllabus_prompt_ready'
    | 'syllabus_ready'
    | 'syllabus_approved'
export type UnitInitNextAction =
    | 'moderate_topic'
    | 'generate_questionnaire'
    | 'answer_questionnaire'
    | 'generate_syllabus_prompt'
    | 'review_syllabus_prompt'
    | 'review_syllabus'
    | 'approve_syllabus'
    | 'generate_unit_content'

export interface CreateUnitInitInput {
    topic: string
    provider: UnitInitProvider
}

export interface CreatedUnitInit {
    id: string
    ownerId: string
    topic: string
    provider: UnitInitProvider
    status: UnitInitStatus
    nextAction: UnitInitNextAction
    createdAt: string
    moderatedAt?: string
    questionnaire?: UnitInitQuestionnaire
    questionnaireGeneratedAt?: string
    questionnaireAnswers?: UnitInitQuestionAnswer[]
    questionnaireAnsweredAt?: string
    syllabusPrompt?: string
    syllabusPromptGeneratedAt?: string
    syllabus?: UnitInitSyllabus
    syllabusGeneratedAt?: string
    syllabusUpdatedAt?: string
    syllabusApprovedAt?: string
}

function isSupportedProvider(value: unknown): value is UnitInitProvider {
    return value === 'openai' || value === 'deepseek'
}

export function parseCreateUnitInitInput(body: unknown): CreateUnitInitInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { topic?: unknown; provider?: unknown }
    const topic = typeof payload.topic === 'string' ? payload.topic.trim() : ''

    if (!topic) {
        throw new Error('Topic is required.')
    }

    if (payload.provider !== undefined && !isSupportedProvider(payload.provider)) {
        throw new Error('Provider must be either "openai" or "deepseek".')
    }

    return {
        topic,
        provider: payload.provider ?? 'openai',
    }
}

export function createUnitInit(
    input: CreateUnitInitInput,
    ownerId: string
): CreatedUnitInit {
    const createdAt = new Date().toISOString()

    return {
        id: randomUUID(),
        ownerId,
        topic: input.topic,
        provider: input.provider,
        status: 'submitted',
        nextAction: 'moderate_topic',
        createdAt,
    }
}

export function moderateUnitInit(unitInit: CreatedUnitInit): CreatedUnitInit {
    if (unitInit.status !== 'submitted') {
        throw new Error('Unit init cannot be moderated from its current state.')
    }

    return {
        ...unitInit,
        status: 'moderation_completed',
        nextAction: 'generate_questionnaire',
        moderatedAt: new Date().toISOString(),
    }
}
