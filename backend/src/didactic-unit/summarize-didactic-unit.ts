import type { DidacticUnit } from './create-didactic-unit.js'
import {
    getModuleReadCharacterCount,
    getModuleTotalCharacterCount,
} from './module-reading-progress.js'

export interface DidacticUnitSummary {
    id: string
    title: string
    topic: string
    folderId: string
    provider: DidacticUnit['provider']
    status: DidacticUnit['status']
    nextAction: DidacticUnit['nextAction']
    overview: string
    moduleCount: number
    generatedChapterCount: number
    readCharacterCount: number
    totalCharacterCount: number
    progressPercent: number
    studyProgressPercent: number
    createdAt: string
    lastActivityAt: string
}

export interface DidacticUnitStudyProgress {
    moduleCount: number
    readCharacterCount: number
    totalCharacterCount: number
    studyProgressPercent: number
}

function calculateProgressPercent(
    moduleCount: number,
    generatedChapterCount: number
): number {
    if (moduleCount === 0) {
        return 0
    }

    return Math.round((generatedChapterCount / moduleCount) * 100)
}

function calculateStudyProgressPercent(
    readCharacterCount: number,
    totalCharacterCount: number
): number {
    if (totalCharacterCount === 0) {
        return 0
    }

    return Math.round((readCharacterCount / totalCharacterCount) * 100)
}

const planningProgressPercentByStatus: Partial<Record<DidacticUnit['status'], number>> = {
    submitted: 0,
    moderation_completed: 17,
    questionnaire_ready: 33,
    questionnaire_answered: 50,
    syllabus_prompt_ready: 67,
    syllabus_ready: 83,
    syllabus_approved: 100,
}

function resolveLastActivityAt(didacticUnit: DidacticUnit): string {
    return (
        didacticUnit.syllabusApprovedAt ??
        didacticUnit.syllabusUpdatedAt ??
        didacticUnit.syllabusGeneratedAt ??
        didacticUnit.syllabusPromptGeneratedAt ??
        didacticUnit.questionnaireAnsweredAt ??
        didacticUnit.questionnaireGeneratedAt ??
        didacticUnit.moderatedAt ??
        didacticUnit.updatedAt ??
        didacticUnit.createdAt
    )
}

function summarizeReadableProgress(didacticUnit: DidacticUnit): {
    readCharacterCount: number
    totalCharacterCount: number
} {
    return didacticUnit.chapters.reduce(
        (totals, _chapter, moduleIndex) => ({
            readCharacterCount:
                totals.readCharacterCount +
                getModuleReadCharacterCount(didacticUnit, moduleIndex),
            totalCharacterCount:
                totals.totalCharacterCount +
                getModuleTotalCharacterCount(didacticUnit, moduleIndex),
        }),
        {
            readCharacterCount: 0,
            totalCharacterCount: 0,
        }
    )
}

export function summarizeDidacticUnit(didacticUnit: DidacticUnit): DidacticUnitSummary {
    const moduleCount = didacticUnit.chapters.length
    const generatedChapterCount = didacticUnit.generatedChapters?.length ?? 0
    const lastActivityAt = resolveLastActivityAt(didacticUnit)
    const { readCharacterCount, totalCharacterCount } =
        summarizeReadableProgress(didacticUnit)
    const progressPercent =
        planningProgressPercentByStatus[didacticUnit.status] ??
        calculateProgressPercent(moduleCount, generatedChapterCount)

    return {
        id: didacticUnit.id,
        title: didacticUnit.title,
        topic: didacticUnit.topic,
        folderId: didacticUnit.folderId,
        provider: didacticUnit.provider,
        status: didacticUnit.status,
        nextAction: didacticUnit.nextAction,
        overview: didacticUnit.overview,
        moduleCount,
        generatedChapterCount,
        readCharacterCount,
        totalCharacterCount,
        progressPercent,
        studyProgressPercent: calculateStudyProgressPercent(
            readCharacterCount,
            totalCharacterCount
        ),
        createdAt: didacticUnit.createdAt,
        lastActivityAt,
    }
}

export function summarizeDidacticUnitStudyProgress(
    didacticUnit: DidacticUnit
): DidacticUnitStudyProgress {
    const moduleCount = didacticUnit.chapters.length
    const { readCharacterCount, totalCharacterCount } =
        summarizeReadableProgress(didacticUnit)

    return {
        moduleCount,
        readCharacterCount,
        totalCharacterCount,
        studyProgressPercent: calculateStudyProgressPercent(
            readCharacterCount,
            totalCharacterCount
        ),
    }
}
