import { describe, expect, it, vi } from 'vitest'
import { MongoSyllabusGenerationRunStore } from '../src/generation-runs/mongo-syllabus-generation-run-store.js'
import type { SyllabusGenerationRun } from '../src/generation-runs/syllabus-generation-run-store.js'

function createStoredRun(): SyllabusGenerationRun {
    return {
        id: 'run-1',
        unitInitId: 'unit-init-1',
        ownerId: 'mock-user',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt: 'Generate a syllabus for next.js framework.',
        syllabus: {
            title: 'Next.js Learning Path',
            overview: 'A focused syllabus.',
            learningGoals: ['Understand routing'],
            chapters: [
                {
                    title: 'Foundations',
                    overview: 'Learn the basics.',
                    keyPoints: ['Routing'],
                },
            ],
        },
        status: 'completed',
        createdAt: '2026-03-12T00:00:00.000Z',
    }
}

describe('MongoSyllabusGenerationRunStore', () => {
    it('saves and lists syllabus generation runs through the collection', async () => {
        const run = createStoredRun()
        const updateOne = vi.fn().mockResolvedValue(undefined)
        const toArray = vi.fn().mockResolvedValue([
            { ...run, _id: 'mongo-run-1' },
        ])
        const sort = vi.fn().mockReturnValue({ toArray })
        const find = vi.fn().mockReturnValue({ sort })
        const collection = {
            updateOne,
            find,
        }
        const database = {
            collection: vi.fn().mockReturnValue(collection),
        }

        const store = new MongoSyllabusGenerationRunStore(database as never)

        await store.save(run)
        const runs = await store.listByUnitInit('mock-user', 'unit-init-1')

        expect(updateOne).toHaveBeenCalledWith(
            { id: run.id },
            { $set: run },
            { upsert: true }
        )
        expect(find).toHaveBeenCalledWith({
            ownerId: 'mock-user',
            unitInitId: 'unit-init-1',
        })
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 })
        expect(runs).toEqual([run])
    })
})
