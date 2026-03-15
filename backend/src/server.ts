import { getAppEnv, loadEnv } from './config/env.js'
import { createApp } from './app.js'
import { MongoDidacticUnitStore } from './didactic-unit/mongo-didactic-unit-store.js'
import { MongoGenerationRunStore } from './generation-runs/mongo-generation-run-store.js'
import { connectMongo, getMongoHealthStatus } from './mongo/mongo-connection.js'

loadEnv()

const env = getAppEnv()
const mongoConnection = await connectMongo(env)

const didacticUnitStore = new MongoDidacticUnitStore(mongoConnection.database)
const generationRunStore = new MongoGenerationRunStore(mongoConnection.database)
const app = createApp({
    didacticUnitStore,
    generationRunStore,
    mongoHealth: getMongoHealthStatus(mongoConnection),
})

app.listen(env.port, () => {
    console.log(`Didactio backend listening on http://localhost:${env.port}`)
})
