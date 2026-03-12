import type { Db, Document } from 'mongodb'
import type {
    SyllabusGenerationRun,
    SyllabusGenerationRunStore,
} from './syllabus-generation-run-store.js'

type SyllabusGenerationRunDocument = SyllabusGenerationRun & Document

function stripMongoId(
    document: SyllabusGenerationRunDocument | null
): SyllabusGenerationRun | null {
    if (!document) {
        return null
    }

    const { _id: _ignored, ...run } = document
    return run as SyllabusGenerationRun
}

export class MongoSyllabusGenerationRunStore implements SyllabusGenerationRunStore {
    private readonly collection

    constructor(database: Db) {
        this.collection = database.collection<SyllabusGenerationRunDocument>(
            'syllabusGenerationRuns'
        )
    }

    async save(run: SyllabusGenerationRun): Promise<void> {
        await this.collection.updateOne(
            { id: run.id },
            {
                $set: run,
            },
            { upsert: true }
        )
    }

    async listByUnitInit(
        ownerId: string,
        unitInitId: string
    ): Promise<SyllabusGenerationRun[]> {
        const documents = await this.collection
            .find({
                ownerId,
                unitInitId,
            })
            .sort({ createdAt: -1 })
            .toArray()

        return documents
            .map((document) => stripMongoId(document))
            .filter((document): document is SyllabusGenerationRun => document !== null)
    }
}
