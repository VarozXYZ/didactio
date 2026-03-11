import type { AuthResponse } from './auth.api'
import { clearAuthSession, loadAuthSession, saveAuthSession } from './auth.storage'

export type CourseStatus =
    | 'draft'
    | 'filtering_prompt'
    | 'generating_syllabus'
    | 'generating_content'
    | 'ready'
    | 'error'

export type AIProvider = 'deepseek' | 'openai'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type ContentLength = 'intro' | 'short' | 'long' | 'textbook'
export type Tone = 'friendly' | 'neutral' | 'professional'
export type Technicality = 'basic' | 'intermediate' | 'technical'

export interface CourseLesson {
    title: string
    content_outline: string[]
    content?: string
}

export interface CourseModule {
    title: string
    overview?: string
    estimated_duration_minutes?: number
    lessons: CourseLesson[]
    generatedContent?: string
    summary?: string
}

export interface CourseSyllabus {
    topic: string
    title: string
    keywords: string
    description: string
    total_duration_minutes: number
    modules: CourseModule[]
}

export interface Course {
    _id: string
    owner: string
    status: CourseStatus
    provider: AIProvider
    contentLength: ContentLength
    tone: Tone
    technicality: Technicality
    language: string
    additionalContext?: string
    originalPrompt: string
    improvedPrompt?: string
    level: CourseLevel
    syllabus?: CourseSyllabus
    modules: CourseModule[]
    iterationSummaries: string[]
    errorMessage?: string
    createdAt: string
    updatedAt: string
}

export interface CreateCoursePayload {
    topic: string
    level: CourseLevel
    provider?: AIProvider
    contentLength?: ContentLength
    tone?: Tone
    technicality?: Technicality
    language?: string
    additionalContext?: string
    options?: {
        numLessons?: number
        maxMinutes?: number
    }
}

export interface CourseStatusResponse {
    id: string
    status: CourseStatus
    modulesGenerated: number
    totalModules: number
    errorMessage?: string
}

export interface RegenerateCoursePayload {
    moduleIndex: number
    context: string
    provider?: AIProvider
}

export interface ResumeCoursePayload {
    provider?: AIProvider
}

interface DownloadResult {
    blob: Blob
    filename: string
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const NETWORK_RETRY_BACKOFF_MS = 5000
const LIST_COURSES_CACHE_MS = 10000
let blockedUntil = 0

function buildApiUrl(path: string): string {
    return `${apiBaseUrl}${path}`
}

class NetworkUnavailableError extends Error {
    constructor(message = 'Cannot reach the server. Please verify the backend is running.') {
        super(message)
        this.name = 'NetworkUnavailableError'
    }
}

function assertNetworkRetryWindow(): void {
    const remaining = blockedUntil - Date.now()
    if (remaining <= 0) return
    const seconds = Math.max(1, Math.ceil(remaining / 1000))
    throw new NetworkUnavailableError(`Cannot reach the server. Retrying in ${seconds}s.`)
}

function markNetworkFailure(): void {
    blockedUntil = Date.now() + NETWORK_RETRY_BACKOFF_MS
}

function markNetworkHealthy(): void {
    blockedUntil = 0
}

let listCoursesInFlight: Promise<Course[]> | null = null
let listCoursesCache: Course[] | null = null
let listCoursesCacheUntil = 0

function extractErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
        return null
    }

    const maybeError = payload as { error?: unknown }
    if (typeof maybeError.error === 'string') {
        return maybeError.error
    }

    return null
}

async function refreshAccessToken(refreshToken: string): Promise<AuthResponse> {
    assertNetworkRetryWindow()

    let response: Response
    try {
        response = await fetch(buildApiUrl('/api/auth/refresh'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
        })
        markNetworkHealthy()
    } catch {
        markNetworkFailure()
        throw new NetworkUnavailableError()
    }

    const payload = (await response.json()) as unknown
    if (!response.ok) {
        throw new Error(extractErrorMessage(payload) ?? 'Your session has expired.')
    }

    return payload as AuthResponse
}

async function authenticatedFetch(
    path: string,
    init: RequestInit = {},
    retryWithRefresh = true
): Promise<Response> {
    const session = loadAuthSession()
    if (!session) {
        throw new Error('Please log in to continue.')
    }

    assertNetworkRetryWindow()

    let response: Response
    try {
        response = await fetch(buildApiUrl(path), {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...(init.headers || {}),
                Authorization: `Bearer ${session.accessToken}`,
            },
        })
        markNetworkHealthy()
    } catch {
        markNetworkFailure()
        throw new NetworkUnavailableError()
    }

    if (response.status !== 401 || !retryWithRefresh) {
        return response
    }

    try {
        const refreshed = await refreshAccessToken(session.refreshToken)
        saveAuthSession(refreshed)
    } catch (error) {
        if (error instanceof NetworkUnavailableError) {
            throw error
        }
        clearAuthSession()
        throw new Error('Your session has expired. Please log in again.')
    }

    return authenticatedFetch(path, init, false)
}

async function requestJson<TResponse>(
    path: string,
    init: RequestInit = {}
): Promise<TResponse> {
    const response = await authenticatedFetch(path, init)

    let payload: unknown = null
    try {
        payload = await response.json()
    } catch {
        payload = null
    }

    if (!response.ok) {
        throw new Error(extractErrorMessage(payload) ?? `Request failed with status ${response.status}.`)
    }

    return payload as TResponse
}

export function listCourses(force = false): Promise<Course[]> {
    const now = Date.now()
    if (!force && listCoursesCache && now < listCoursesCacheUntil) {
        return Promise.resolve(listCoursesCache)
    }

    if (!listCoursesInFlight) {
        listCoursesInFlight = requestJson<Course[]>('/api/courses')
            .then((courses) => {
                listCoursesCache = courses
                listCoursesCacheUntil = Date.now() + LIST_COURSES_CACHE_MS
                return courses
            })
            .finally(() => {
                listCoursesInFlight = null
            })
    }

    return listCoursesInFlight
}

export function getCourse(courseId: string): Promise<Course> {
    return requestJson<Course>(`/api/courses/${courseId}`)
}

export function getCourseStatus(courseId: string): Promise<CourseStatusResponse> {
    return requestJson<CourseStatusResponse>(`/api/courses/${courseId}/status`)
}

export function createCourse(payload: CreateCoursePayload): Promise<Course> {
    return requestJson<Course>('/api/courses', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export function regenerateCourse(
    courseId: string,
    payload: RegenerateCoursePayload
): Promise<Course> {
    return requestJson<Course>(`/api/courses/${courseId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export function resumeCourse(
    courseId: string,
    payload: ResumeCoursePayload = {}
): Promise<CourseStatusResponse> {
    return requestJson<CourseStatusResponse>(`/api/courses/${courseId}/resume`, {
        method: 'POST',
        body: JSON.stringify(payload),
    })
}

export async function exportCoursePdf(courseId: string): Promise<DownloadResult> {
    const response = await authenticatedFetch(`/api/courses/${courseId}/export/pdf`, {
        method: 'GET',
        headers: {
            Accept: 'application/pdf',
        },
    })

    if (!response.ok) {
        let payload: unknown = null
        try {
            payload = await response.json()
        } catch {
            payload = null
        }
        throw new Error(extractErrorMessage(payload) ?? `Request failed with status ${response.status}.`)
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition') || ''
    const match = contentDisposition.match(/filename="([^"]+)"/)
    const filename = match?.[1] || 'course.pdf'

    return { blob, filename }
}
