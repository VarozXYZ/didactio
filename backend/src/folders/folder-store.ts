import { randomUUID } from 'node:crypto'

export type FolderKind = 'default' | 'custom'

export interface Folder {
    id: string
    ownerId: string
    name: string
    slug: string
    kind: FolderKind
    icon: string
    color: string
    createdAt: string
    updatedAt: string
}

export interface CreateFolderInput {
    ownerId: string
    name: string
    slug: string
    kind: FolderKind
    icon: string
    color: string
}

export interface FolderStore {
    listByOwner(ownerId: string): Promise<Folder[]>
    getById(ownerId: string, folderId: string): Promise<Folder | null>
    getBySlug(ownerId: string, slug: string): Promise<Folder | null>
    create(input: CreateFolderInput): Promise<Folder>
}

function createFolderRecord(input: CreateFolderInput): Folder {
    const createdAt = new Date().toISOString()

    return {
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
}

export class InMemoryFolderStore implements FolderStore {
    private readonly folders = new Map<string, Folder>()

    async listByOwner(ownerId: string): Promise<Folder[]> {
        return [...this.folders.values()]
            .filter((folder) => folder.ownerId === ownerId)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    }

    async getById(ownerId: string, folderId: string): Promise<Folder | null> {
        const folder = this.folders.get(folderId)

        if (!folder || folder.ownerId !== ownerId) {
            return null
        }

        return folder
    }

    async getBySlug(ownerId: string, slug: string): Promise<Folder | null> {
        return (
            [...this.folders.values()].find(
                (folder) => folder.ownerId === ownerId && folder.slug === slug
            ) ?? null
        )
    }

    async create(input: CreateFolderInput): Promise<Folder> {
        const folder = createFolderRecord(input)
        this.folders.set(folder.id, folder)
        return folder
    }
}
