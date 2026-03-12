import { randomUUID } from 'node:crypto'
import type { UnitInitProvider } from '../unit-init/create-unit-init.js'
import type { UnitInitGeneratedChapter } from '../unit-init/generate-chapter-content.js'
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
    chapterIndex: number
    chapter?: UnitInitGeneratedChapter
}

export type GenerationRun = SyllabusGenerationRunRecord | ChapterGenerationRunRecord

export interface GenerationRunStore {
    save(run: GenerationRun): Promise<void>
    listByUnitInit(ownerId: string, unitInitId: string): Promise<GenerationRun[]>
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
    ownerId: string
    chapterIndex: number
    provider: UnitInitProvider
    model: string
    prompt: string
    chapter: UnitInitGeneratedChapter
    createdAt: string
}

interface CreateFailedChapterGenerationRunInput {
    unitInitId: string
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
