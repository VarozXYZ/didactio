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

export const disconnectedMongoHealthStatus: MongoHealthStatus = {
    configured: false,
    connected: false,
    databaseName: null,
}

export async function connectMongo(env: AppEnv): Promise<MongoConnection> {
    if (!env.mongoDbUri) {
        throw new Error('MONGODB_URI must be configured to start the backend.')
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

export function getMongoHealthStatus(connection: MongoConnection): MongoHealthStatus {
    return connection.health
}
