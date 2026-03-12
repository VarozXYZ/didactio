import type { Db, Document } from 'mongodb'
import type {
    ChapterGenerationRun,
    ChapterGenerationRunStore,
} from './chapter-generation-run-store.js'

type ChapterGenerationRunDocument = ChapterGenerationRun & Document

function stripMongoId(document: ChapterGenerationRunDocument | null): ChapterGenerationRun | null {
    if (!document) {
        return null
    }

    const { _id: _ignored, ...run } = document
    return run as ChapterGenerationRun
}

export class MongoChapterGenerationRunStore implements ChapterGenerationRunStore {
    private readonly collection

    constructor(database: Db) {
        this.collection = database.collection<ChapterGenerationRunDocument>(
            'chapterGenerationRuns'
        )
    }

    async save(run: ChapterGenerationRun): Promise<void> {
        await this.collection.updateOne(
            { id: run.id },
            {
                $set: run,
            },
            { upsert: true }
        )
    }

    async listByUnitInit(ownerId: string, unitInitId: string): Promise<ChapterGenerationRun[]> {
        const documents = await this.collection
            .find({
                ownerId,
                unitInitId,
            })
            .sort({ createdAt: -1 })
            .toArray()

        return documents
            .map((document) => stripMongoId(document))
            .filter((document): document is ChapterGenerationRun => document !== null)
    }
}
