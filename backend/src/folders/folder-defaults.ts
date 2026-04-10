import type { Folder, FolderStore } from './folder-store.js'

interface DefaultFolderDefinition {
    name: string
    slug: string
    icon: string
    color: string
}

const DEFAULT_FOLDER_DEFINITIONS: DefaultFolderDefinition[] = [
    { name: 'General', slug: 'general', icon: 'book-open', color: '#4ADE80' },
    { name: 'Computer Science', slug: 'computer-science', icon: 'binary', color: '#818CF8' },
    { name: 'Mathematics', slug: 'mathematics', icon: 'calculator', color: '#F59E0B' },
    { name: 'Biology', slug: 'biology', icon: 'microscope', color: '#22C55E' },
    { name: 'History', slug: 'history', icon: 'scroll-text', color: '#EF4444' },
    { name: 'Literature', slug: 'literature', icon: 'pen-line', color: '#A855F7' },
    { name: 'Physics', slug: 'physics', icon: 'atom', color: '#3B82F6' },
    { name: 'Chemistry', slug: 'chemistry', icon: 'flask-conical', color: '#F97316' },
    { name: 'Geography', slug: 'geography', icon: 'globe', color: '#10B981' },
]

export const CUSTOM_FOLDER_ICON = 'folder'
export const CUSTOM_FOLDER_COLOR = '#6B7280'
export const GENERAL_FOLDER_SLUG = 'general'
const defaultFolderSeedsInFlight = new Map<string, Promise<Folder[]>>()

export function normalizeFolderName(name: string): string {
    return name.replace(/\s+/g, ' ').trim()
}

export function slugifyFolderName(name: string): string {
    return normalizeFolderName(name)
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

async function ensureDefaultFoldersOnce(
    folderStore: FolderStore,
    ownerId: string
): Promise<Folder[]> {
    const existingFolders = await folderStore.listByOwner(ownerId)
    const existingBySlug = new Set(existingFolders.map((folder) => folder.slug))
    const createdFolders: Folder[] = []

    for (const definition of DEFAULT_FOLDER_DEFINITIONS) {
        if (existingBySlug.has(definition.slug)) {
            continue
        }

        const createdOrExistingFolder = await folderStore
            .create({
                ownerId,
                name: definition.name,
                slug: definition.slug,
                kind: 'default',
                icon: definition.icon,
                color: definition.color,
            })
            .catch(async (error) => {
                const existingFolder = await folderStore.getBySlug(ownerId, definition.slug)

                if (existingFolder) {
                    return existingFolder
                }

                throw error
            })

        existingBySlug.add(createdOrExistingFolder.slug)
        createdFolders.push(createdOrExistingFolder)
    }

    return [...existingFolders, ...createdFolders].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt)
    )
}

export async function ensureDefaultFolders(
    folderStore: FolderStore,
    ownerId: string
): Promise<Folder[]> {
    const inFlightSeed = defaultFolderSeedsInFlight.get(ownerId)

    if (inFlightSeed) {
        return inFlightSeed
    }

    let seedPromise: Promise<Folder[]>
    seedPromise = ensureDefaultFoldersOnce(folderStore, ownerId).finally(() => {
        if (defaultFolderSeedsInFlight.get(ownerId) === seedPromise) {
            defaultFolderSeedsInFlight.delete(ownerId)
        }
    })

    defaultFolderSeedsInFlight.set(ownerId, seedPromise)
    return seedPromise
}

export async function getGeneralFolder(
    folderStore: FolderStore,
    ownerId: string
): Promise<Folder> {
    const folders = await ensureDefaultFolders(folderStore, ownerId)
    const generalFolder = folders.find((folder) => folder.slug === GENERAL_FOLDER_SLUG)

    if (!generalFolder) {
        throw new Error('General folder could not be resolved.')
    }

    return generalFolder
}
