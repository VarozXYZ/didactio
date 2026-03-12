import type { Db, Document } from 'mongodb'
import type { CreatedUnitInit } from './create-unit-init.js'
import type { UnitInitStore } from './unit-init-store.js'

type UnitInitDocument = CreatedUnitInit & Document

function stripMongoId(document: UnitInitDocument | null): CreatedUnitInit | null {
    if (!document) {
        return null
    }

    const { _id: _ignored, ...unitInit } = document
    return unitInit as CreatedUnitInit
}

export class MongoUnitInitStore implements UnitInitStore {
    private readonly collection

    constructor(database: Db) {
        this.collection = database.collection<UnitInitDocument>('unitInits')
    }

    async save(unitInit: CreatedUnitInit): Promise<void> {
        await this.collection.updateOne(
            { id: unitInit.id },
            {
                $set: unitInit,
            },
            { upsert: true }
        )
    }

    async getById(ownerId: string, unitInitId: string): Promise<CreatedUnitInit | null> {
        return stripMongoId(
            await this.collection.findOne({
                id: unitInitId,
                ownerId,
            })
        )
    }

    async listByOwner(ownerId: string): Promise<CreatedUnitInit[]> {
        const documents = await this.collection
            .find({ ownerId })
            .sort({ createdAt: -1 })
            .toArray()

        return documents
            .map((document) => stripMongoId(document))
            .filter((document): document is CreatedUnitInit => document !== null)
    }
}
