type FolderLike = {
    id: string
    slug: string
}

export function getMoveTargetFolders<T extends FolderLike>(
    folders: T[],
    currentFolder: FolderLike
): T[] {
    const seenSlugs = new Set<string>()

    return folders.filter((folder) => {
        if (folder.slug === currentFolder.slug) {
            return false
        }

        if (seenSlugs.has(folder.slug)) {
            return false
        }

        seenSlugs.add(folder.slug)
        return true
    })
}
