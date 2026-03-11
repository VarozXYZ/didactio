import { randomUUID } from 'node:crypto'

export type UnitInitProvider = 'openai' | 'deepseek'
export type UnitInitStatus = 'submitted'

export interface CreateUnitInitInput {
    topic: string
    provider: UnitInitProvider
}

export interface CreatedUnitInit {
    id: string
    ownerId: string
    topic: string
    provider: UnitInitProvider
    status: UnitInitStatus
}

function isSupportedProvider(value: unknown): value is UnitInitProvider {
    return value === 'openai' || value === 'deepseek'
}

export function parseCreateUnitInitInput(body: unknown): CreateUnitInitInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { topic?: unknown; provider?: unknown }
    const topic = typeof payload.topic === 'string' ? payload.topic.trim() : ''

    if (!topic) {
        throw new Error('Topic is required.')
    }

    if (payload.provider !== undefined && !isSupportedProvider(payload.provider)) {
        throw new Error('Provider must be either "openai" or "deepseek".')
    }

    return {
        topic,
        provider: payload.provider ?? 'openai',
    }
}

export function createUnitInit(
    input: CreateUnitInitInput,
    ownerId: string
): CreatedUnitInit {
    return {
        id: randomUUID(),
        ownerId,
        topic: input.topic,
        provider: input.provider,
        status: 'submitted',
    }
}
