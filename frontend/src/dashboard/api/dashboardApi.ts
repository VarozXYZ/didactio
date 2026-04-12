import type { PlanningQuestion, PlanningSyllabus } from '../types'

export class DashboardApiError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

type BackendProvider = string
export type BackendAiModelTier = 'cheap' | 'premium'

export interface BackendFolder {
    id: string
    name: string
    slug: string
    icon: string
    color: string
    kind: 'default' | 'custom'
    unitCount: number
}

export type BackendChapterPresentationSettings = {
    // New shape
    sizeProfile?: 'small' | 'regular' | 'large'
    bodyFontFamily?: string
    headingFontFamily?: string
    paragraphAlign?: 'left' | 'center' | 'right' | 'justify'
    // Legacy fields (older persisted data)
    paragraphFontFamily?: 'sans' | 'serif' | 'mono'
    paragraphFontSize?: '14px' | '16px' | '18px' | '20px'
}

export type BackendAiModelConfig = {
    provider: string
    model: string
}

export type BackendAuthoringConfig = {
    language: string
    tone: 'friendly' | 'neutral' | 'professional'
    learnerLevel: 'beginner' | 'intermediate' | 'advanced'
    extraInstructions?: string
}

export type BackendAiConfig = {
    cheap: BackendAiModelConfig
    premium: BackendAiModelConfig
    authoring: BackendAuthoringConfig
}

export interface BackendDidacticUnitSummary {
    id: string
    title: string
    topic: string
    folderId: string
    folder: Omit<BackendFolder, 'unitCount'>
    provider: BackendProvider
    status: string
    nextAction: string
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
    folderId: string
    folderAssignmentMode: 'manual' | 'auto'
    folder: Omit<BackendFolder, 'unitCount'>
    provider: BackendProvider
    status: string
    nextAction: string
    createdAt: string
    updatedAt: string
    moderatedAt?: string
    improvedTopicBrief?: string
    reasoningNotes?: string
    additionalContext?: string
    level: 'beginner' | 'intermediate' | 'advanced'
    depth: 'basic' | 'intermediate' | 'technical'
    length: 'intro' | 'short' | 'long' | 'textbook'
    generationTier?: BackendAiModelTier
    questionnaireEnabled: boolean
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
        moduleCount: number
        readCharacterCount: number
        totalCharacterCount: number
        studyProgressPercent: number
    }
}

export interface BackendDidacticUnitChapterSummary {
    chapterIndex: number
    title: string
    overview: string
    hasGeneratedContent: boolean
    readCharacterCount: number
    totalCharacterCount: number
    isCompleted: boolean
    state: 'pending' | 'ready' | 'failed'
    generatedAt?: string
    updatedAt?: string
    completedAt?: string
}

export interface BackendDidacticUnitChapterDetail {
    chapterIndex: number
    title: string
    planningOverview: string
    content: string | null
    presentationSettings: BackendChapterPresentationSettings
    state: 'pending' | 'ready' | 'failed'
    readCharacterCount: number
    totalCharacterCount: number
    isCompleted: boolean
    generatedAt?: string
    updatedAt?: string
    completedAt?: string
}

export interface BackendDidacticUnitReadingProgressResponse {
    module: BackendDidacticUnitChapterDetail | null
    studyProgress: {
        moduleCount: number
        readCharacterCount: number
        totalCharacterCount: number
        studyProgressPercent: number
    }
}

export interface BackendDidacticUnitChapterRevision {
    id: string
    chapterIndex: number
    source: 'ai_generation' | 'ai_regeneration' | 'manual_edit'
    createdAt: string
    chapter: {
        title: string
        content: string
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
    rawOutput?: string
    telemetry?: {
        durationMs?: number
        finishReason?: string
        rawFinishReason?: string
        usage?: {
            inputTokens?: number
            outputTokens?: number
            totalTokens?: number
            inputTokenDetails?: {
                noCacheTokens?: number
                cacheReadTokens?: number
                cacheWriteTokens?: number
            }
            outputTokenDetails?: {
                textTokens?: number
                reasoningTokens?: number
            }
            raw?: unknown
        }
        totalUsage?: {
            inputTokens?: number
            outputTokens?: number
            totalTokens?: number
            inputTokenDetails?: {
                noCacheTokens?: number
                cacheReadTokens?: number
                cacheWriteTokens?: number
            }
            outputTokenDetails?: {
                textTokens?: number
                reasoningTokens?: number
            }
            raw?: unknown
        }
        warnings?: unknown[]
        request?: {
            body?: unknown
        }
        response?: {
            id?: string
            timestamp?: string
            modelId?: string
            headers?: Record<string, string>
            body?: unknown
        }
        providerMetadata?: unknown
        gatewayGenerationId?: string
        gateway?: {
            id?: string
            totalCost?: number
            upstreamInferenceCost?: number
            usageCost?: number
            createdAt?: string
            model?: string
            providerName?: string
            streamed?: boolean
            isByok?: boolean
            inputTokens?: number
            outputTokens?: number
            cachedInputTokens?: number
            cacheCreationInputTokens?: number
            reasoningTokens?: number
        }
    }
}

type NdjsonEvent =
    | { type: 'start'; stage: string; provider: string; model: string }
    | { type: 'partial_markdown'; delta: string; markdown: string }
    | { type: 'partial_structured'; data: unknown }
    | { type: 'complete'; data: unknown }
    | { type: 'error'; message: string }

type StreamHandlers = {
    signal?: AbortSignal
    onStart?: (event: Extract<NdjsonEvent, { type: 'start' }>) => void
    onPartialMarkdown?: (event: Extract<NdjsonEvent, { type: 'partial_markdown' }>) => void
    onPartialStructured?: (event: Extract<NdjsonEvent, { type: 'partial_structured' }>) => void
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

async function streamNdjson<T>(
    path: string,
    handlers: StreamHandlers,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(path, {
        headers: {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        method: 'POST',
        body: JSON.stringify({}),
        ...init,
        signal: handlers.signal,
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

    if (!response.body) {
        throw new DashboardApiError('Streaming response body was not available.', 500)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let completedData: T | null = null

    while (true) {
        const { done, value } = await reader.read()

        if (done) {
            break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) {
                continue
            }

            const event = JSON.parse(trimmed) as NdjsonEvent

            if (event.type === 'start') {
                handlers.onStart?.(event)
                continue
            }

            if (event.type === 'partial_markdown') {
                handlers.onPartialMarkdown?.(event)
                continue
            }

            if (event.type === 'partial_structured') {
                handlers.onPartialStructured?.(event)
                continue
            }

            if (event.type === 'error') {
                throw new DashboardApiError(event.message, 500)
            }

            completedData = event.data as T
        }
    }

    if (completedData === null) {
        throw new DashboardApiError('Streaming response ended without a complete payload.', 500)
    }

    return completedData
}

export const dashboardApi = {
    listFolders() {
        return requestJson<{ folders: BackendFolder[] }>('/api/folders')
    },
    createFolder(input: { name: string; icon?: string; color?: string }) {
        return requestJson<BackendFolder>('/api/folders', {
            method: 'POST',
            body: JSON.stringify(input),
        })
    },
    updateFolder(id: string, patch: { name?: string; icon?: string; color?: string }) {
        return requestJson<BackendFolder>(`/api/folders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        })
    },
    deleteFolder(id: string) {
        return requestJson<void>(`/api/folders/${id}`, {
            method: 'DELETE',
        })
    },
    listDidacticUnits() {
        return requestJson<{ didacticUnits: BackendDidacticUnitSummary[] }>('/api/didactic-unit')
    },
    createDidacticUnit(input: {
        topic: string
        additionalContext?: string
        level?: 'beginner' | 'intermediate' | 'advanced'
        depth?: 'basic' | 'intermediate' | 'technical'
        length?: 'intro' | 'short' | 'long' | 'textbook'
        questionnaireEnabled?: boolean
        folderSelection?: {
            mode: 'manual' | 'auto'
            folderId?: string
        }
    }) {
        return requestJson<BackendDidacticUnitDetail>('/api/didactic-unit', {
            method: 'POST',
            body: JSON.stringify(input),
        })
    },
    getAiConfig() {
        return requestJson<BackendAiConfig>('/api/ai-config')
    },
    updateAiConfig(input: Partial<BackendAiConfig>) {
        return requestJson<BackendAiConfig>('/api/ai-config', {
            method: 'PATCH',
            body: JSON.stringify(input),
        })
    },
    getDidacticUnit(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}`)
    },
    updateDidacticUnitFolder(
        id: string,
        folderSelection: {
            mode: 'manual' | 'auto'
            folderId?: string
        }
    ) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/folder`, {
            method: 'PATCH',
            body: JSON.stringify({ folderSelection }),
        })
    },
    moderateDidacticUnit(id: string) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/moderate`, {
            method: 'POST',
            body: JSON.stringify({}),
        })
    },
    generateDidacticUnitQuestionnaire(id: string, tier: BackendAiModelTier) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/questionnaire/generate`, {
            method: 'POST',
            body: JSON.stringify({ tier }),
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
    generateDidacticUnitSyllabus(
        id: string,
        tier: BackendAiModelTier,
        input?: { context?: string }
    ) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/syllabus/generate`, {
            method: 'POST',
            body: JSON.stringify({
                tier,
                ...(input ?? {}),
            }),
        })
    },
    streamDidacticUnitSyllabus(
        id: string,
        tier: BackendAiModelTier,
        handlers: StreamHandlers,
        input?: { context?: string }
    ) {
        return streamNdjson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/syllabus/generate/stream`,
            handlers,
            {
                body: JSON.stringify({
                    tier,
                    ...(input ?? {}),
                }),
            }
        )
    },
    updateDidacticUnitSyllabus(id: string, syllabus: PlanningSyllabus) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/syllabus`, {
            method: 'PATCH',
            body: JSON.stringify({ syllabus }),
        })
    },
    approveDidacticUnitSyllabus(id: string, tier?: BackendAiModelTier) {
        return requestJson<BackendDidacticUnitDetail>(`/api/didactic-unit/${id}/approve-syllabus`, {
            method: 'POST',
            body: JSON.stringify(tier ? { tier } : {}),
        })
    },
    listDidacticUnitChapters(id: string) {
        return requestJson<{ chapters: BackendDidacticUnitChapterSummary[] }>(
            `/api/didactic-unit/${id}/modules`
        )
    },
    getDidacticUnitChapter(id: string, chapterIndex: number) {
        return requestJson<BackendDidacticUnitChapterDetail>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}`
        )
    },
    updateDidacticUnitChapter(
        id: string,
        chapterIndex: number,
        chapter: {
            title: string
            content: string
            presentationSettings?: BackendChapterPresentationSettings
        }
    ) {
        return requestJson<BackendDidacticUnitChapterDetail>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ chapter }),
            }
        )
    },
    generateDidacticUnitChapter(
        id: string,
        chapterIndex: number,
        tier: BackendAiModelTier
    ) {
        return requestJson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}/generate`,
            {
                method: 'POST',
                body: JSON.stringify({ tier }),
            }
        )
    },
    streamGenerateDidacticUnitChapter(
        id: string,
        chapterIndex: number,
        tier: BackendAiModelTier,
        handlers: StreamHandlers
    ) {
        return streamNdjson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}/generate/stream`,
            handlers,
            {
                body: JSON.stringify({ tier }),
            }
        )
    },
    regenerateDidacticUnitChapter(
        id: string,
        chapterIndex: number,
        tier: BackendAiModelTier,
        input?: { instruction?: string }
    ) {
        return requestJson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}/regenerate`,
            {
                method: 'POST',
                body: JSON.stringify({
                    tier,
                    ...(input ?? {}),
                }),
            }
        )
    },
    streamRegenerateDidacticUnitChapter(
        id: string,
        chapterIndex: number,
        tier: BackendAiModelTier,
        handlers: StreamHandlers,
        input?: { instruction?: string }
    ) {
        return streamNdjson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}/regenerate/stream`,
            handlers,
            {
                body: JSON.stringify({
                    tier,
                    ...(input ?? {}),
                }),
            }
        )
    },
    completeDidacticUnitChapter(id: string, chapterIndex: number) {
        return requestJson<BackendDidacticUnitDetail>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}/complete`,
            {
                method: 'POST',
                body: JSON.stringify({}),
            }
        )
    },
    updateDidacticUnitReadingProgress(
        id: string,
        chapterIndex: number,
        readCharacterCount: number
    ) {
        return requestJson<BackendDidacticUnitReadingProgressResponse>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}/reading-progress`,
            {
                method: 'PUT',
                body: JSON.stringify({ readCharacterCount }),
            }
        )
    },
    listDidacticUnitChapterRevisions(id: string, chapterIndex: number) {
        return requestJson<{ revisions: BackendDidacticUnitChapterRevision[] }>(
            `/api/didactic-unit/${id}/modules/${chapterIndex}/revisions`
        )
    },
    listDidacticUnitRuns(id: string) {
        return requestJson<{ runs: BackendGenerationRun[] }>(`/api/didactic-unit/${id}/runs`)
    },
    deleteDidacticUnit(id: string) {
        return requestJson<void>(`/api/didactic-unit/${id}`, {
            method: 'DELETE',
        })
    },
}
