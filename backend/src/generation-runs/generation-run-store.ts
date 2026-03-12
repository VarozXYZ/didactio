import { randomUUID } from 'node:crypto'
import type { UnitInitProvider } from '../unit-init/create-unit-init.js'
import type { DidacticUnitGeneratedChapter } from '../didactic-unit/didactic-unit-chapter.js'
import type { UnitInitSyllabus } from '../unit-init/generate-syllabus.js'

export type GenerationRunStage = 'syllabus' | 'chapter'
export type GenerationRunStatus = 'completed' | 'failed'

interface GenerationRunBase {
    id: string
    unitInitId: string
    ownerId: string
    provider: UnitInitProvider
    model: string
    prompt: string
    status: GenerationRunStatus
    createdAt: string
    rawOutput?: string
    error?: string
}

export interface SyllabusGenerationRunRecord extends GenerationRunBase {
    stage: 'syllabus'
    syllabus?: UnitInitSyllabus
}

export interface ChapterGenerationRunRecord extends GenerationRunBase {
    stage: 'chapter'
    didacticUnitId?: string
    chapterIndex: number
    chapter?: DidacticUnitGeneratedChapter
}

export type GenerationRun = SyllabusGenerationRunRecord | ChapterGenerationRunRecord

export interface GenerationRunStore {
    save(run: GenerationRun): Promise<void>
    listByUnitInit(ownerId: string, unitInitId: string): Promise<GenerationRun[]>
    listByDidacticUnit(ownerId: string, didacticUnitId: string): Promise<ChapterGenerationRunRecord[]>
}

export class InMemoryGenerationRunStore implements GenerationRunStore {
    private readonly runs = new Map<string, GenerationRun[]>()

    async save(run: GenerationRun): Promise<void> {
        const unitInitRuns = this.runs.get(run.unitInitId) ?? []
        unitInitRuns.unshift(run)
        this.runs.set(run.unitInitId, unitInitRuns)
    }

    async listByUnitInit(ownerId: string, unitInitId: string): Promise<GenerationRun[]> {
        return (this.runs.get(unitInitId) ?? []).filter((run) => run.ownerId === ownerId)
    }

    async listByDidacticUnit(
        ownerId: string,
        didacticUnitId: string
    ): Promise<ChapterGenerationRunRecord[]> {
        const runs = Array.from(this.runs.values()).flat()

        return runs.filter(
            (run): run is ChapterGenerationRunRecord =>
                run.ownerId === ownerId &&
                run.stage === 'chapter' &&
                run.didacticUnitId === didacticUnitId
        )
    }
}

interface CreateCompletedSyllabusGenerationRunInput {
    unitInitId: string
    ownerId: string
    provider: UnitInitProvider
    model: string
    prompt: string
    syllabus: UnitInitSyllabus
    createdAt: string
}

interface CreateFailedSyllabusGenerationRunInput {
    unitInitId: string
    ownerId: string
    provider: UnitInitProvider
    model: string
    prompt: string
    rawOutput?: string
    error: string
    createdAt: string
}

interface CreateCompletedChapterGenerationRunInput {
    unitInitId: string
    didacticUnitId?: string
    ownerId: string
    chapterIndex: number
    provider: UnitInitProvider
    model: string
    prompt: string
    chapter: DidacticUnitGeneratedChapter
    createdAt: string
}

interface CreateFailedChapterGenerationRunInput {
    unitInitId: string
    didacticUnitId?: string
    ownerId: string
    chapterIndex: number
    provider: UnitInitProvider
    model: string
    prompt: string
    rawOutput?: string
    error: string
    createdAt: string
}

export function createCompletedSyllabusGenerationRunRecord(
    input: CreateCompletedSyllabusGenerationRunInput
): SyllabusGenerationRunRecord {
    return {
        id: randomUUID(),
        stage: 'syllabus',
        unitInitId: input.unitInitId,
        ownerId: input.ownerId,
        provider: input.provider,
        model: input.model,
        prompt: input.prompt,
        syllabus: input.syllabus,
        status: 'completed',
        createdAt: input.createdAt,
    }
}

export function createFailedSyllabusGenerationRunRecord(
    input: CreateFailedSyllabusGenerationRunInput
): SyllabusGenerationRunRecord {
    return {
        id: randomUUID(),
        stage: 'syllabus',
        unitInitId: input.unitInitId,
        ownerId: input.ownerId,
        provider: input.provider,
        model: input.model,
        prompt: input.prompt,
        rawOutput: input.rawOutput,
        error: input.error,
        status: 'failed',
        createdAt: input.createdAt,
    }
}

export function createCompletedChapterGenerationRunRecord(
    input: CreateCompletedChapterGenerationRunInput
): ChapterGenerationRunRecord {
    return {
        id: randomUUID(),
        stage: 'chapter',
        unitInitId: input.unitInitId,
        didacticUnitId: input.didacticUnitId,
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

export function createFailedChapterGenerationRunRecord(
    input: CreateFailedChapterGenerationRunInput
): ChapterGenerationRunRecord {
    return {
        id: randomUUID(),
        stage: 'chapter',
        unitInitId: input.unitInitId,
        didacticUnitId: input.didacticUnitId,
        ownerId: input.ownerId,
        chapterIndex: input.chapterIndex,
        provider: input.provider,
        model: input.model,
        prompt: input.prompt,
        rawOutput: input.rawOutput,
        error: input.error,
        status: 'failed',
        createdAt: input.createdAt,
    }
}
