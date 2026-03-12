import { randomUUID } from 'node:crypto'
import type { UnitInitProvider } from '../unit-init/create-unit-init.js'
import type { UnitInitSyllabus } from '../unit-init/generate-syllabus.js'

export interface SyllabusGenerationRun {
    id: string
    unitInitId: string
    ownerId: string
    provider: UnitInitProvider
    model: string
    prompt: string
    syllabus?: UnitInitSyllabus
    rawOutput?: string
    error?: string
    status: 'completed' | 'failed'
    createdAt: string
}

export interface SyllabusGenerationRunStore {
    save(run: SyllabusGenerationRun): Promise<void>
    listByUnitInit(ownerId: string, unitInitId: string): Promise<SyllabusGenerationRun[]>
}

export class InMemorySyllabusGenerationRunStore implements SyllabusGenerationRunStore {
    private readonly runs = new Map<string, SyllabusGenerationRun[]>()

    async save(run: SyllabusGenerationRun): Promise<void> {
        const unitInitRuns = this.runs.get(run.unitInitId) ?? []
        unitInitRuns.unshift(run)
        this.runs.set(run.unitInitId, unitInitRuns)
    }

    async listByUnitInit(
        ownerId: string,
        unitInitId: string
    ): Promise<SyllabusGenerationRun[]> {
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

export function createCompletedSyllabusGenerationRun(
    input: CreateCompletedSyllabusGenerationRunInput
): SyllabusGenerationRun {
    return {
        id: randomUUID(),
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

export function createFailedSyllabusGenerationRun(
    input: CreateFailedSyllabusGenerationRunInput
): SyllabusGenerationRun {
    return {
        id: randomUUID(),
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
