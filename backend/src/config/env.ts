import dotenv from 'dotenv'

let envLoaded = false

export interface AppEnv {
    port: number
    aiGatewayApiKey: string | null
    aiGatewayBaseUrl: string
    aiModerationProvider: string
    aiModerationModel: string
    aiQuestionnaireProvider: string
    aiQuestionnaireModel: string
    aiSyllabusProvider: string
    aiSyllabusModel: string
    aiSummaryProvider: string
    aiSummaryModel: string
    aiChapterProvider: string
    aiChapterModel: string
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
        aiModerationProvider:
            parseOptionalString(process.env.AI_MODERATION_PROVIDER) ?? 'openai',
        aiModerationModel:
            parseOptionalString(process.env.AI_MODERATION_MODEL) ?? 'gpt-4o-mini',
        aiQuestionnaireProvider:
            parseOptionalString(process.env.AI_QUESTIONNAIRE_PROVIDER) ?? 'openai',
        aiQuestionnaireModel:
            parseOptionalString(process.env.AI_QUESTIONNAIRE_MODEL) ?? 'gpt-4o-mini',
        aiSyllabusProvider:
            parseOptionalString(process.env.AI_SYLLABUS_PROVIDER) ?? 'openai',
        aiSyllabusModel: parseOptionalString(process.env.AI_SYLLABUS_MODEL) ?? 'gpt-4o-mini',
        aiSummaryProvider:
            parseOptionalString(process.env.AI_SUMMARY_PROVIDER) ?? 'openai',
        aiSummaryModel: parseOptionalString(process.env.AI_SUMMARY_MODEL) ?? 'gpt-4o-mini',
        aiChapterProvider: parseOptionalString(process.env.AI_CHAPTER_PROVIDER) ?? 'openai',
        aiChapterModel: parseOptionalString(process.env.AI_CHAPTER_MODEL) ?? 'gpt-4o-mini',
        mongoDbUri: parseOptionalString(process.env.MONGODB_URI),
        mongoDbName: parseOptionalString(process.env.MONGODB_DB_NAME) ?? 'didactio',
    }
}
