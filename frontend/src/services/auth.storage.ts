import type { AuthResponse } from './auth.api'

const AUTH_SESSION_STORAGE_KEY = 'didactio.auth.session'

export type AuthSession = AuthResponse

export function saveAuthSession(session: AuthSession): void {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function loadAuthSession(): AuthSession | null {
    const rawSession = localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    if (!rawSession) {
        return null
    }

    try {
        const parsed = JSON.parse(rawSession) as AuthSession
        if (
            !parsed ||
            typeof parsed !== 'object' ||
            typeof parsed.accessToken !== 'string' ||
            typeof parsed.refreshToken !== 'string' ||
            !parsed.user
        ) {
            clearAuthSession()
            return null
        }

        return parsed
    } catch {
        clearAuthSession()
        return null
    }
}

export function clearAuthSession(): void {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}

