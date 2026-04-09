import { randomUUID } from 'node:crypto'
import type { Db, Document } from 'mongodb'
import type { Folder, FolderStore, CreateFolderInput } from './folder-store.js'

type FolderDocument = Folder & Document

function stripMongoId(document: FolderDocument | null): Folder | null {
    if (!document) {
        return null
    }

    const { _id: _ignored, ...folder } = document
    return folder as Folder
}

export class MongoFolderStore implements FolderStore {
    private readonly collection

    constructor(database: Db) {
        this.collection = database.collection<FolderDocument>('folders')
    }

    async listByOwner(ownerId: string): Promise<Folder[]> {
        const documents = await this.collection
            .find({ ownerId })
            .sort({ createdAt: 1 })
            .toArray()

        return documents
            .map((document) => stripMongoId(document))
            .filter((document): document is Folder => document !== null)
    }

    async getById(ownerId: string, folderId: string): Promise<Folder | null> {
        return stripMongoId(
            await this.collection.findOne({
                id: folderId,
                ownerId,
            })
        )
    }

    async getBySlug(ownerId: string, slug: string): Promise<Folder | null> {
        return stripMongoId(
            await this.collection.findOne({
                ownerId,
                slug,
            })
        )
    }

    async create(input: CreateFolderInput): Promise<Folder> {
        const createdAt = new Date().toISOString()
        const folder: Folder = {
            id: randomUUID(),
            ownerId: input.ownerId,
            name: input.name,
            slug: input.slug,
            kind: input.kind,
            icon: input.icon,
            color: input.color,
            createdAt,
            updatedAt: createdAt,
        }

        await this.collection.insertOne(folder)
        return folder
    }

    async updateById(ownerId: string, folderId: string, patch: { name?: string; icon?: string; color?: string }): Promise<Folder | null> {
        const update: Record<string, string> = { updatedAt: new Date().toISOString() }
        if (patch.name !== undefined) update.name = patch.name
        if (patch.icon !== undefined) update.icon = patch.icon
        if (patch.color !== undefined) update.color = patch.color

        const result = await this.collection.findOneAndUpdate(
            { id: folderId, ownerId },
            { $set: update },
            { returnDocument: 'after' }
        )

        return stripMongoId(result)
    }

    async deleteById(ownerId: string, folderId: string): Promise<boolean> {
        const result = await this.collection.deleteOne({ id: folderId, ownerId })
        return result.deletedCount === 1
    }
}
