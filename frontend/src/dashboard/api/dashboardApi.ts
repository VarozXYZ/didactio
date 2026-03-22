import type { PlanningQuestion, PlanningSyllabus } from '../types'

export class DashboardApiError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

type BackendProvider = 'openai' | 'deepseek'
export type BackendChapterPresentationSettings = {
    paragraphFontFamily: 'sans' | 'serif' | 'mono'
    paragraphFontSize: '14px' | '16px' | '18px' | '20px'
    paragraphAlign: 'left' | 'center' | 'right' | 'justify'
}

export interface BackendDidacticUnitSummary {
    id: string
    title: string
    topic: string
    provider: BackendProvider
    status: string
    nextAction: string
    overview: string
    chapterCount: number
    generatedChapterCount: number
    completedChapterCount: number
    progressPercent: number
    studyProgressPercent: number
    createdAt: string
    lastActivityAt: string
}

export interface BackendQuestionnaire {
    questions: PlanningQuestion[]
}

export interface BackendQuestionAnswer {
    questionId: string
    value: string
}

export interface BackendDidacticUnitDetail {
    id: string
    ownerId: string
    topic: string
    title: string
    provider: BackendProvider
    status: string
    nextAction: string
    createdAt: string
    updatedAt: string
    moderatedAt?: string
    questionnaire?: BackendQuestionnaire
    questionnaireAnswers?: BackendQuestionAnswer[]
    syllabusPrompt?: string
    syllabus?: PlanningSyllabus
    overview: string
    learningGoals: string[]
    chapters: Array<{
        title: string
        overview: string
        keyPoints: string[]
    }>
    studyProgress: {
        chapterCount: number
        completedChapterCount: number
        studyProgressPercent: number
    }
}

export interface BackendDidacticUnitChapterSummary {
    chapterIndex: number
    title: string
    overview: string
    hasGeneratedContent: boolean
    isCompleted: boolean
    state: 'pending' | 'ready' | 'failed'
    generatedAt?: string
    updatedAt?: string
    completedAt?: string
}

export interface BackendDidacticUnitChapterDetail {
    chapterIndex: number
    title: string
    overview: string
    content: string | null
    keyTakeaways: string[]
    presentationSettings: BackendChapterPresentationSettings
    state: 'pending' | 'ready' | 'failed'
    isCompleted: boolean
    generatedAt?: string
    updatedAt?: string
    completedAt?: string
}

export interface BackendDidacticUnitChapterRevision {
    id: string
    chapterIndex: number
    source: 'ai_generation' | 'ai_regeneration' | 'manual_edit'
    createdAt: string
    chapter: {
        title: string
        overview: string
        content: string
        keyTakeaways: string[]
        presentationSettings?: BackendChapterPresentationSettings
    }
}

export interface BackendGenerationRun {
    id: string
    stage: 'syllabus' | 'chapter'
    status: 'completed' | 'failed'
    provider: BackendProvider
    model: string
    prompt: string
    createdAt: string
    error?: string
    chapterIndex?: number
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, {
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        ...init,
    })

    if (!response.ok) {
        let message = `Request failed with status ${response.status}.`

        try {
            const body = (await response.json()) as { error?: string }
            if (body.error) {
                message = body.error
            }
        } catch {
            // Keep default message.
        }

        throw new DashboardApiError(message, response.status)
    }

    if (response.status === 204) {
        return undefined as T
    }

    return (await response.json()) as T
}

export const dashboardApi = {
    listDidacticUnits() {
        return requestJson<{ didacticUnits: BackendDidacticUnitSummary[] }>('/api/didactic-unit')
    },
    createDidacticUnit(input: { topic: string; provider: BackendProvider }) {
        return requestJson<BackendDidacticUnitDetail>('/api/didactic-unit', {
            method: 'POST',
            body: JSON.stringify(input),
        })
    },
    getDidacticUnit(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}`)
    },
    moderateDidacticUnit(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/moderate`, {
            method: 'POST',
            body: JSON.stringify({}),
        })
    },
    generateDidacticUnitQuestionnaire(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/questionnaire/generate`, {
            method: 'POST',
            body: JSON.stringify({}),
        })
    },
    answerDidacticUnitQuestionnaire(id: string, answers: BackendQuestionAnswer[]) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/questionnaire/answers`, {
            method: 'PATCH',
            body: JSON.stringify({ answers }),
        })
    },
    generateDidacticUnitSyllabusPrompt(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/syllabus-prompt/generate`, {
            method: 'POST',
            body: JSON.stringify({}),
        })
    },
    generateDidacticUnitSyllabus(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/syllabus/generate`, {
            method: 'POST',
            body: JSON.stringify({}),
        })
    },
    updateDidacticUnitSyllabus(id: string, syllabus: PlanningSyllabus) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/syllabus`, {
            method: 'PATCH',
            body: JSON.stringify({ syllabus }),
        })
    },
    approveDidacticUnitSyllabus(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/approve-syllabus`, {
            method: 'POST',
            body: JSON.stringify({}),
        })
    },
    listDidacticUnitChapters(id: string) {
        return requestJson<{ chapters: BackendDidacticUnitChapterSummary[] }>(
            `/api/didactic-unit/${id}/chapters`
        )
    },
    getDidacticUnitChapter(id: string, chapterIndex: number) {
        return requestJson<BackendDidacticUnitChapterDetail>(
            `/api/didactic-unit/${id}/chapters/${chapterIndex}`
        )
    },
    updateDidacticUnitChapter(
        id: string,
        chapterIndex: number,
        chapter: {
            title: string
            overview: string
            content: string
            keyTakeaways: string[]
            presentationSettings?: BackendChapterPresentationSettings
        }
    ) {
        return requestJson<BackendDidacticUnitChapterDetail>(
            `/api/didactic-unit/${id}/chapters/${chapterIndex}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ chapter }),
            }
        )
    },
    generateDidacticUnitChapter(id: string, chapterIndex: number) {
        return requestJson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/chapters/${chapterIndex}/generate`,
            {
                method: 'POST',
                body: JSON.stringify({}),
            }
        )
    },
    regenerateDidacticUnitChapter(id: string, chapterIndex: number) {
        return requestJson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/chapters/${chapterIndex}/regenerate`,
            {
                method: 'POST',
                body: JSON.stringify({}),
            }
        )
    },
    completeDidacticUnitChapter(id: string, chapterIndex: number) {
        return requestJson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/chapters/${chapterIndex}/complete`,
            {
                method: 'POST',
                body: JSON.stringify({}),
            }
        )
    },
    listDidacticUnitChapterRevisions(id: string, chapterIndex: number) {
        return requestJson<{ revisions: BackendDidacticUnitChapterRevision[] }>(
            `/api/didactic-unit/${id}/chapters/${chapterIndex}/revisions`
        )
    },
    listDidacticUnitRuns(id: string) {
        return requestJson<{ runs: BackendGenerationRun[] }>(`/api/didactic-unit/${id}/runs`)
    },
}
