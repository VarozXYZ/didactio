import { MongoClient } from 'mongodb'
import type { AppEnv } from '../config/env.js'

export interface MongoHealthStatus {
    configured: boolean
    connected: boolean
    databaseName: string | null
}

export interface MongoConnection {
    client: MongoClient
    databaseName: string
    health: MongoHealthStatus
}

export async function connectMongoIfConfigured(
    env: AppEnv
): Promise<MongoConnection | null> {
    if (!env.mongoDbUri) {
        return null
    }

    const client = new MongoClient(env.mongoDbUri)
    await client.connect()
    await client.db(env.mongoDbName).command({ ping: 1 })

    return {
        client,
        databaseName: env.mongoDbName,
        health: {
            configured: true,
            connected: true,
            databaseName: env.mongoDbName,
        },
    }
}

export function createMongoHealthStatus(
    connection: MongoConnection | null
): MongoHealthStatus {
    if (!connection) {
        return {
            configured: false,
            connected: false,
            databaseName: null,
        }
    }

    return connection.health
}
