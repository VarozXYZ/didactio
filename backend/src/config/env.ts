import dotenv from 'dotenv'

let envLoaded = false

export interface AppEnv {
    port: number
    aiGatewayApiKey: string | null
    aiGatewayBaseUrl: string
    aiCheapProvider: string
    aiCheapModel: string
    aiPremiumProvider: string
    aiPremiumModel: string
    aiAuthoringLanguage: string
    aiAuthoringTone: string
    aiAuthoringLearnerLevel: string
    aiExtraInstructions: string | null
    mongoDbUri: string | null
    mongoDbName: string
}

function parsePort(value: string | undefined): number {
    if (!value) {
        return 3000
    }

    const parsedPort = Number.parseInt(value, 10)

    if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
        throw new Error('PORT must be a positive integer.')
    }

    return parsedPort
}

function parseOptionalString(value: string | undefined): string | null {
    const parsedValue = value?.trim()
    return parsedValue ? parsedValue : null
}

export function loadEnv(): void {
    if (envLoaded) {
        return
    }

    dotenv.config()
    envLoaded = true
}

export function getAppEnv(): AppEnv {
    return {
        port: parsePort(process.env.PORT),
        aiGatewayApiKey: parseOptionalString(process.env.AI_GATEWAY_API_KEY),
        aiGatewayBaseUrl:
            parseOptionalString(process.env.AI_GATEWAY_BASE_URL) ??
            'https://ai-gateway.vercel.sh/v1/ai',
        aiCheapProvider: parseOptionalString(process.env.AI_CHEAP_PROVIDER) ?? 'deepseek',
        aiCheapModel: parseOptionalString(process.env.AI_CHEAP_MODEL) ?? 'deepseek-chat',
        aiPremiumProvider:
            parseOptionalString(process.env.AI_PREMIUM_PROVIDER) ?? 'deepseek',
        aiPremiumModel:
            parseOptionalString(process.env.AI_PREMIUM_MODEL) ?? 'deepseek-reasoner',
        aiAuthoringLanguage: parseOptionalString(process.env.AI_AUTHORING_LANGUAGE) ?? 'English',
        aiAuthoringTone: parseOptionalString(process.env.AI_AUTHORING_TONE) ?? 'neutral',
        aiAuthoringLearnerLevel:
            parseOptionalString(process.env.AI_AUTHORING_LEARNER_LEVEL) ?? 'beginner',
        aiExtraInstructions: parseOptionalString(process.env.AI_EXTRA_INSTRUCTIONS),
        mongoDbUri: parseOptionalString(process.env.MONGODB_URI),
        mongoDbName: parseOptionalString(process.env.MONGODB_DB_NAME) ?? 'didactio',
    }
}
