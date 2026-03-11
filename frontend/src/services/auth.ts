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

interface StoredAuthUser extends AuthUser {
    password: string
}

const AUTH_USERS_STORAGE_KEY = 'didactio.auth.users'

function loadStoredUsers(): StoredAuthUser[] {
    const rawUsers = localStorage.getItem(AUTH_USERS_STORAGE_KEY)
    if (!rawUsers) {
        return []
    }

    try {
        const parsed = JSON.parse(rawUsers) as StoredAuthUser[]
        if (!Array.isArray(parsed)) {
            return []
        }
        return parsed
    } catch {
        return []
    }
}

function saveStoredUsers(users: StoredAuthUser[]): void {
    localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(users))
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

function createSession(user: AuthUser): AuthResponse {
    return {
        accessToken: crypto.randomUUID(),
        refreshToken: crypto.randomUUID(),
        user,
    }
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
    const email = normalizeEmail(payload.email)
    const users = loadStoredUsers()
    const user = users.find((candidate) => candidate.email === email)

    if (!user || user.password !== payload.password) {
        throw new Error('Invalid email or password.')
    }

    const { password: _password, ...safeUser } = user
    return createSession(safeUser)
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
    const email = normalizeEmail(payload.email)
    const users = loadStoredUsers()

    if (users.some((candidate) => candidate.email === email)) {
        throw new Error('An account with this email already exists.')
    }

    const now = new Date().toISOString()
    const storedUser: StoredAuthUser = {
        id: crypto.randomUUID(),
        name: payload.name?.trim() || undefined,
        email,
        password: payload.password,
        role: 'standard',
        createdAt: now,
        updatedAt: now,
    }

    users.push(storedUser)
    saveStoredUsers(users)

    const { password: _password, ...safeUser } = storedUser
    return createSession(safeUser)
}
