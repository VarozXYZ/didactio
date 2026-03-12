import type { Db, Document } from 'mongodb'
import type {
    ChapterGenerationRunRecord,
    GenerationRun,
    GenerationRunStore,
} from './generation-run-store.js'

type GenerationRunDocument = GenerationRun & Document

function stripMongoId(document: GenerationRunDocument | null): GenerationRun | null {
    if (!document) {
        return null
    }

    const { _id: _ignored, ...run } = document
    return run as GenerationRun
}

export class MongoGenerationRunStore implements GenerationRunStore {
    private readonly collection

    constructor(database: Db) {
        this.collection = database.collection<GenerationRunDocument>('generationRuns')
    }

    async save(run: GenerationRun): Promise<void> {
        await this.collection.updateOne(
            { id: run.id },
            {
                $set: run,
            },
            { upsert: true }
        )
    }

    async listByUnitInit(ownerId: string, unitInitId: string): Promise<GenerationRun[]> {
        const documents = await this.collection
            .find({
                ownerId,
                unitInitId,
            })
            .sort({ createdAt: -1 })
            .toArray()

        return documents
            .map((document) => stripMongoId(document))
            .filter((document): document is GenerationRun => document !== null)
    }

    async listByDidacticUnit(
        ownerId: string,
        didacticUnitId: string
    ): Promise<ChapterGenerationRunRecord[]> {
        const documents = await this.collection
            .find({
                ownerId,
                stage: 'chapter',
                didacticUnitId,
            })
            .sort({ createdAt: -1 })
            .toArray()

        return documents
            .map((document) => stripMongoId(document))
            .filter(
                (document): document is ChapterGenerationRunRecord =>
                    document !== null && document.stage === 'chapter'
            )
    }
}
