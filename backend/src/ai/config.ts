import { getAppEnv } from '../config/env.js'

export type AiModelTier = 'cheap' | 'premium'
export type AuthoringTone = 'friendly' | 'neutral' | 'professional'
export type AuthoringLearnerLevel = 'beginner' | 'intermediate' | 'advanced'

export interface AiModelConfig {
    provider: string
    model: string
}

export interface AuthoringConfig {
    language: string
    tone: AuthoringTone
    learnerLevel: AuthoringLearnerLevel
    preferences?: string
}

export interface AiConfig {
    cheap: AiModelConfig
    premium: AiModelConfig
    authoring: AuthoringConfig
}

export type PartialAiConfig = Partial<{
    cheap: Partial<AiModelConfig>
    premium: Partial<AiModelConfig>
    authoring: Partial<AuthoringConfig>
}>

export class AiConfigValidationError extends Error {}

const AUTHORING_TONES: AuthoringTone[] = ['friendly', 'neutral', 'professional']
const AUTHORING_LEARNER_LEVELS: AuthoringLearnerLevel[] = [
    'beginner',
    'intermediate',
    'advanced',
]
const MODEL_TIERS: AiModelTier[] = ['cheap', 'premium']

function normalizeNonEmptyString(value: unknown, fieldName: string): string {
    const normalized = typeof value === 'string' ? value.trim() : ''

    if (!normalized) {
        throw new AiConfigValidationError(`${fieldName} must be a non-empty string.`)
    }

    return normalized
}

function normalizeEnumValue<T extends string>(
    value: unknown,
    fieldName: string,
    allowedValues: readonly T[],
    fallback?: T
): T {
    const normalized = normalizeNonEmptyString(value ?? fallback, fieldName)

    if (!allowedValues.includes(normalized as T)) {
        throw new AiConfigValidationError(
            `${fieldName} must be one of: ${allowedValues.join(', ')}.`
        )
    }

    return normalized as T
}

export function normalizeModelConfig(
    tier: AiModelTier,
    config: Partial<AiModelConfig> | undefined,
    fallback?: AiModelConfig
): AiModelConfig {
    return {
        provider: normalizeNonEmptyString(
            config?.provider ?? fallback?.provider,
            `${tier}.provider`
        ),
        model: normalizeNonEmptyString(
            config?.model ?? fallback?.model,
            `${tier}.model`
        ),
    }
}

export function normalizeAuthoringConfig(
    config: Partial<AuthoringConfig> | undefined,
    fallback?: AuthoringConfig
): AuthoringConfig {
    const preferencesSource = config?.preferences ?? fallback?.preferences
    const normalizedPreferences =
        typeof preferencesSource === 'string' ? preferencesSource.trim() : ''

    return {
        language: normalizeNonEmptyString(
            config?.language ?? fallback?.language,
            'authoring.language'
        ),
        tone: normalizeEnumValue(
            config?.tone,
            'authoring.tone',
            AUTHORING_TONES,
            fallback?.tone
        ),
        learnerLevel: normalizeEnumValue(
            config?.learnerLevel,
            'authoring.learnerLevel',
            AUTHORING_LEARNER_LEVELS,
            fallback?.learnerLevel
        ),
        preferences: normalizedPreferences || undefined,
    }
}

export function getDefaultAiConfig(): AiConfig {
    const env = getAppEnv()

    return {
        cheap: {
            provider: env.aiCheapProvider,
            model: env.aiCheapModel,
        },
        premium: {
            provider: env.aiPremiumProvider,
            model: env.aiPremiumModel,
        },
        authoring: {
            language: env.aiAuthoringLanguage,
            tone: normalizeEnumValue(
                env.aiAuthoringTone,
                'authoring.tone',
                AUTHORING_TONES,
                'neutral'
            ),
            learnerLevel: normalizeEnumValue(
                env.aiAuthoringLearnerLevel,
                'authoring.learnerLevel',
                AUTHORING_LEARNER_LEVELS,
                'beginner'
            ),
            preferences: env.aiAuthoringPreferences ?? undefined,
        },
    }
}

export function resolveGatewayModelId(config: AiModelConfig): string {
    return config.model.includes('/') ? config.model : `${config.provider}/${config.model}`
}

export interface AiConfigStore {
    get(ownerId: string): Promise<AiConfig>
    update(ownerId: string, patch: PartialAiConfig): Promise<AiConfig>
}

export class InMemoryAiConfigStore implements AiConfigStore {
    private readonly configs = new Map<string, AiConfig>()

    constructor(private readonly defaults: AiConfig = getDefaultAiConfig()) {}

    async get(ownerId: string): Promise<AiConfig> {
        const existing = this.configs.get(ownerId)
        if (existing) {
            return existing
        }

        const seeded = structuredClone(this.defaults)
        this.configs.set(ownerId, seeded)
        return seeded
    }

    async update(ownerId: string, patch: PartialAiConfig): Promise<AiConfig> {
        const current = await this.get(ownerId)
        const next: AiConfig = {
            cheap: normalizeModelConfig('cheap', patch.cheap, current.cheap),
            premium: normalizeModelConfig('premium', patch.premium, current.premium),
            authoring: normalizeAuthoringConfig(patch.authoring, current.authoring),
        }

        this.configs.set(ownerId, next)
        return next
    }
}

export function parseAiConfigPatch(body: unknown): PartialAiConfig {
    if (!body || typeof body !== 'object') {
        throw new AiConfigValidationError('Request body must be a JSON object.')
    }

    const payload = body as Record<string, unknown>
    const patch: PartialAiConfig = {}

    for (const tier of MODEL_TIERS) {
        const value = payload[tier]
        if (value === undefined) {
            continue
        }

        if (!value || typeof value !== 'object') {
            throw new AiConfigValidationError(`${tier} must be a JSON object.`)
        }

        const rawConfig = value as Record<string, unknown>
        patch[tier] = {
            provider:
                rawConfig.provider === undefined
                    ? undefined
                    : normalizeNonEmptyString(rawConfig.provider, `${tier}.provider`),
            model:
                rawConfig.model === undefined
                    ? undefined
                    : normalizeNonEmptyString(rawConfig.model, `${tier}.model`),
        }
    }

    if (payload.authoring !== undefined) {
        if (!payload.authoring || typeof payload.authoring !== 'object') {
            throw new AiConfigValidationError('authoring must be a JSON object.')
        }

        const rawConfig = payload.authoring as Record<string, unknown>
        patch.authoring = {
            language:
                rawConfig.language === undefined
                    ? undefined
                    : normalizeNonEmptyString(rawConfig.language, 'authoring.language'),
            tone:
                rawConfig.tone === undefined
                    ? undefined
                    : normalizeEnumValue(rawConfig.tone, 'authoring.tone', AUTHORING_TONES),
            learnerLevel:
                rawConfig.learnerLevel === undefined
                    ? undefined
                    : normalizeEnumValue(
                          rawConfig.learnerLevel,
                          'authoring.learnerLevel',
                          AUTHORING_LEARNER_LEVELS
                      ),
            preferences:
                rawConfig.preferences === undefined
                    ? undefined
                    : typeof rawConfig.preferences === 'string'
                      ? rawConfig.preferences.trim()
                      : (() => {
                            throw new AiConfigValidationError(
                                'authoring.preferences must be a string.'
                            )
                        })(),
        }
    }

    return patch
}
