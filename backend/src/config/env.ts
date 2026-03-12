import dotenv from 'dotenv'

let envLoaded = false

export interface AppEnv {
    port: number
    openAiApiKey: string | null
    openAiSyllabusModel: string
    openAiChapterModel: string
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
        openAiApiKey: parseOptionalString(process.env.OPENAI_API_KEY),
        openAiSyllabusModel: parseOptionalString(process.env.OPENAI_SYLLABUS_MODEL) ?? 'gpt-4o-mini',
        openAiChapterModel: parseOptionalString(process.env.OPENAI_CHAPTER_MODEL) ?? 'gpt-4o-mini',
        mongoDbUri: parseOptionalString(process.env.MONGODB_URI),
        mongoDbName: parseOptionalString(process.env.MONGODB_DB_NAME) ?? 'didactio',
    }
}
