import { randomUUID } from 'node:crypto'
import type { UnitInitProvider } from '../unit-init/create-unit-init.js'
import type { UnitInitGeneratedChapter } from '../unit-init/generate-chapter-content.js'

export interface ChapterGenerationRun {
    id: string
    unitInitId: string
    ownerId: string
    chapterIndex: number
    provider: UnitInitProvider
    model: string
    prompt: string
    chapter: UnitInitGeneratedChapter
    status: 'completed'
    createdAt: string
}

export interface ChapterGenerationRunStore {
    save(run: ChapterGenerationRun): Promise<void>
    listByUnitInit(ownerId: string, unitInitId: string): Promise<ChapterGenerationRun[]>
}

export class InMemoryChapterGenerationRunStore implements ChapterGenerationRunStore {
    private readonly runs = new Map<string, ChapterGenerationRun[]>()

    async save(run: ChapterGenerationRun): Promise<void> {
        const unitInitRuns = this.runs.get(run.unitInitId) ?? []
        unitInitRuns.unshift(run)
        this.runs.set(run.unitInitId, unitInitRuns)
    }

    async listByUnitInit(ownerId: string, unitInitId: string): Promise<ChapterGenerationRun[]> {
        return (this.runs.get(unitInitId) ?? []).filter((run) => run.ownerId === ownerId)
    }
}

interface CreateChapterGenerationRunInput {
    unitInitId: string
    ownerId: string
    chapterIndex: number
    provider: UnitInitProvider
    model: string
    prompt: string
    chapter: UnitInitGeneratedChapter
    createdAt: string
}

export function createChapterGenerationRun(
    input: CreateChapterGenerationRunInput
): ChapterGenerationRun {
    return {
        id: randomUUID(),
        unitInitId: input.unitInitId,
        ownerId: input.ownerId,
        chapterIndex: input.chapterIndex,
        provider: input.provider,
        model: input.model,
        prompt: input.prompt,
        chapter: input.chapter,
        status: 'completed',
        createdAt: input.createdAt,
    }
}
