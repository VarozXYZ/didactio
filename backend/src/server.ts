import { getAppEnv, loadEnv } from './config/env.js'
import { createApp } from './app.js'
import {
    connectMongoIfConfigured,
    createMongoHealthStatus,
} from './mongo/mongo-connection.js'
import { MongoUnitInitStore } from './unit-init/mongo-unit-init-store.js'

loadEnv()

const env = getAppEnv()
const mongoConnection = await connectMongoIfConfigured(env)

if (!mongoConnection) {
    throw new Error('MONGODB_URI must be configured to start the backend.')
}

const unitInitStore = new MongoUnitInitStore(mongoConnection.database)
const app = createApp({
    unitInitStore,
    mongoHealth: createMongoHealthStatus(mongoConnection),
})

app.listen(env.port, () => {
    console.log(`Didactio backend listening on http://localhost:${env.port}`)
})
