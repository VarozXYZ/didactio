import { getAppEnv, loadEnv } from './config/env.js'
import { createApp } from './app.js'
import { MongoChapterGenerationRunStore } from './generation-runs/mongo-chapter-generation-run-store.js'
import { MongoSyllabusGenerationRunStore } from './generation-runs/mongo-syllabus-generation-run-store.js'
import { connectMongo, getMongoHealthStatus } from './mongo/mongo-connection.js'
import { MongoUnitInitStore } from './unit-init/mongo-unit-init-store.js'

loadEnv()

const env = getAppEnv()
const mongoConnection = await connectMongo(env)

const unitInitStore = new MongoUnitInitStore(mongoConnection.database)
const chapterGenerationRunStore = new MongoChapterGenerationRunStore(
    mongoConnection.database
)
const syllabusGenerationRunStore = new MongoSyllabusGenerationRunStore(
    mongoConnection.database
)
const app = createApp({
    unitInitStore,
    chapterGenerationRunStore,
    syllabusGenerationRunStore,
    mongoHealth: getMongoHealthStatus(mongoConnection),
})

app.listen(env.port, () => {
    console.log(`Didactio backend listening on http://localhost:${env.port}`)
})
