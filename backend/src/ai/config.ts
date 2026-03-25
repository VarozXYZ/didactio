import { getAppEnv } from '../config/env.js'

export type AiStage = 'moderation' | 'questionnaire' | 'syllabus' | 'summary' | 'chapter'

export interface AiStageConfig {
    provider: string
    model: string
}

export interface AiConfig {
    moderation: AiStageConfig
    questionnaire: AiStageConfig
    syllabus: AiStageConfig
    summary: AiStageConfig
    chapter: AiStageConfig
}

export type PartialAiConfig = Partial<{
    [Stage in AiStage]: Partial<AiStageConfig>
}>

export class AiConfigValidationError extends Error {}

function normalizeNonEmptyString(value: unknown, fieldName: string): string {
    const normalized = typeof value === 'string' ? value.trim() : ''

    if (!normalized) {
        throw new AiConfigValidationError(`${fieldName} must be a non-empty string.`)
    }

    return normalized
}

export function normalizeStageConfig(
    stage: AiStage,
    config: Partial<AiStageConfig> | undefined,
    fallback?: AiStageConfig
): AiStageConfig {
    const provider = normalizeNonEmptyString(
        config?.provider ?? fallback?.provider,
        `${stage}.provider`
    )
    const model = normalizeNonEmptyString(
        config?.model ?? fallback?.model,
        `${stage}.model`
    )

    return { provider, model }
}

export function getDefaultAiConfig(): AiConfig {
    const env = getAppEnv()

    return {
        moderation: {
            provider: env.aiModerationProvider,
            model: env.aiModerationModel,
        },
        questionnaire: {
            provider: env.aiQuestionnaireProvider,
            model: env.aiQuestionnaireModel,
        },
        syllabus: {
            provider: env.aiSyllabusProvider,
            model: env.aiSyllabusModel,
        },
        summary: {
            provider: env.aiSummaryProvider,
            model: env.aiSummaryModel,
        },
        chapter: {
            provider: env.aiChapterProvider,
            model: env.aiChapterModel,
        },
    }
}

export function resolveGatewayModelId(config: AiStageConfig): string {
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
            moderation: normalizeStageConfig(
                'moderation',
                patch.moderation,
                current.moderation
            ),
            questionnaire: normalizeStageConfig(
                'questionnaire',
                patch.questionnaire,
                current.questionnaire
            ),
            syllabus: normalizeStageConfig('syllabus', patch.syllabus, current.syllabus),
            summary: normalizeStageConfig('summary', patch.summary, current.summary),
            chapter: normalizeStageConfig('chapter', patch.chapter, current.chapter),
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
    const stages: AiStage[] = [
        'moderation',
        'questionnaire',
        'syllabus',
        'summary',
        'chapter',
    ]
    const patch: PartialAiConfig = {}

    for (const stage of stages) {
        const value = payload[stage]
        if (value === undefined) {
            continue
        }

        if (!value || typeof value !== 'object') {
            throw new AiConfigValidationError(`${stage} must be a JSON object.`)
        }

        const rawConfig = value as Record<string, unknown>
        patch[stage] = {
            provider:
                rawConfig.provider === undefined
                    ? undefined
                    : normalizeNonEmptyString(rawConfig.provider, `${stage}.provider`),
            model:
                rawConfig.model === undefined
                    ? undefined
                    : normalizeNonEmptyString(rawConfig.model, `${stage}.model`),
        }
    }

    return patch
}
