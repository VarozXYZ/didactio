import type { CreatedUnitInit } from './create-unit-init.js'

export interface UnitInitSummary {
    id: string
    topic: string
    provider: CreatedUnitInit['provider']
    status: CreatedUnitInit['status']
    nextAction: CreatedUnitInit['nextAction']
    createdAt: string
    lastActivityAt: string
    progressPercent: number
}

const progressPercentByStatus: Record<CreatedUnitInit['status'], number> = {
    submitted: 0,
    moderation_completed: 17,
    questionnaire_ready: 33,
    questionnaire_answered: 50,
    syllabus_prompt_ready: 67,
    syllabus_ready: 83,
    syllabus_approved: 100,
}

function resolveLastActivityAt(unitInit: CreatedUnitInit): string {
    return (
        unitInit.syllabusApprovedAt ??
        unitInit.syllabusUpdatedAt ??
        unitInit.syllabusGeneratedAt ??
        unitInit.syllabusPromptGeneratedAt ??
        unitInit.questionnaireAnsweredAt ??
        unitInit.questionnaireGeneratedAt ??
        unitInit.moderatedAt ??
        unitInit.createdAt
    )
}

export function summarizeUnitInit(unitInit: CreatedUnitInit): UnitInitSummary {
    return {
        id: unitInit.id,
        topic: unitInit.topic,
        provider: unitInit.provider,
        status: unitInit.status,
        nextAction: unitInit.nextAction,
        createdAt: unitInit.createdAt,
        lastActivityAt: resolveLastActivityAt(unitInit),
        progressPercent: progressPercentByStatus[unitInit.status],
    }
}
