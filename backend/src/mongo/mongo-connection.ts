import { Db, MongoClient } from 'mongodb'
import type { AppEnv } from '../config/env.js'

export interface MongoHealthStatus {
    configured: boolean
    connected: boolean
    databaseName: string | null
}

export interface MongoConnection {
    client: MongoClient
    database: Db
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
    const database = client.db(env.mongoDbName)
    await database.command({ ping: 1 })

    return {
        client,
        database,
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
