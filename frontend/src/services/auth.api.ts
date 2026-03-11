export type AuthRole = 'standard' | 'premium' | 'admin'

export interface AuthUser {
    id: string
    name?: string
    email: string
    role: AuthRole
    createdAt: string
    updatedAt: string
}

export interface AuthResponse {
    accessToken: string
    refreshToken: string
    user: AuthUser
}

export interface RegisterPayload {
    name?: string
    email: string
    password: string
}

export interface LoginPayload {
    email: string
    password: string
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function buildApiUrl(path: string): string {
    return `${apiBaseUrl}${path}`
}

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

async function postJson<TResponse>(path: string, body: object): Promise<TResponse> {
    let response: Response

    try {
        response = await fetch(buildApiUrl(path), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })
    } catch {
        throw new Error('Cannot reach the server. Please verify the backend is running.')
    }

    let payload: unknown = null
    try {
        payload = await response.json()
    } catch {
        payload = null
    }

    if (!response.ok) {
        throw new Error(
            extractErrorMessage(payload) ?? `Request failed with status ${response.status}.`
        )
    }

    return payload as TResponse
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
    return postJson<AuthResponse>('/api/auth/login', payload)
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
    return postJson<AuthResponse>('/api/auth/register', payload)
}

