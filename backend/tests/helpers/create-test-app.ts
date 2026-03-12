import {
    InMemoryGenerationRunStore,
    type GenerationRunStore,
} from '../../src/generation-runs/generation-run-store.js'
import { createApp, type CreateAppOptions } from '../../src/app.js'
import type { MongoHealthStatus } from '../../src/mongo/mongo-connection.js'
import type { ChapterGenerator } from '../../src/providers/chapter-generator.js'
import type { SyllabusGenerator } from '../../src/providers/syllabus-generator.js'
import {
    InMemoryUnitInitStore,
    type UnitInitStore,
} from '../../src/unit-init/unit-init-store.js'

interface CreateTestAppOptions {
    unitInitStore?: UnitInitStore
    generationRunStore?: GenerationRunStore
    syllabusGenerator?: SyllabusGenerator
    chapterGenerator?: ChapterGenerator
    mongoHealth?: MongoHealthStatus
}

export function createTestApp(options: CreateTestAppOptions = {}) {
    const appOptions: CreateAppOptions = {
        unitInitStore: options.unitInitStore ?? new InMemoryUnitInitStore(),
        generationRunStore: options.generationRunStore ?? new InMemoryGenerationRunStore(),
        syllabusGenerator: options.syllabusGenerator,
        chapterGenerator: options.chapterGenerator,
        mongoHealth: options.mongoHealth,
    }

    return createApp(appOptions)
}
