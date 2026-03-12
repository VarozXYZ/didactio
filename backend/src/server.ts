import { resolve } from 'node:path'
import { getAppEnv, loadEnv } from './config/env.js'
import { createApp } from './app.js'
import {
    connectMongoIfConfigured,
    createMongoHealthStatus,
} from './mongo/mongo-connection.js'
import { FileUnitInitStore } from './unit-init/file-unit-init-store.js'
import { InMemoryUnitInitStore } from './unit-init/unit-init-store.js'

loadEnv()

const env = getAppEnv()
const mongoConnection = await connectMongoIfConfigured(env)
const unitInitStore =
    env.unitInitStoreKind === 'file'
        ? new FileUnitInitStore(resolve(process.cwd(), env.unitInitStoreFilePath))
        : new InMemoryUnitInitStore()
const app = createApp({
    unitInitStore,
    mongoHealth: createMongoHealthStatus(mongoConnection),
})

app.listen(env.port, () => {
    console.log(`Didactio backend listening on http://localhost:${env.port}`)
})
