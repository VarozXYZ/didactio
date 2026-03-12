import { getAppEnv, loadEnv } from './config/env.js'
import { createApp } from './app.js'
import { MongoGenerationRunStore } from './generation-runs/mongo-generation-run-store.js'
import { connectMongo, getMongoHealthStatus } from './mongo/mongo-connection.js'
import { MongoUnitInitStore } from './unit-init/mongo-unit-init-store.js'

loadEnv()

const env = getAppEnv()
const mongoConnection = await connectMongo(env)

const unitInitStore = new MongoUnitInitStore(mongoConnection.database)
const generationRunStore = new MongoGenerationRunStore(mongoConnection.database)
const app = createApp({
    unitInitStore,
    generationRunStore,
    mongoHealth: getMongoHealthStatus(mongoConnection),
})

app.listen(env.port, () => {
    console.log(`Didactio backend listening on http://localhost:${env.port}`)
})
