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
}
