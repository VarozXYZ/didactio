import { describe, expect, it, vi } from 'vitest'
import { MongoChapterGenerationRunStore } from '../src/generation-runs/mongo-chapter-generation-run-store.js'
import type { ChapterGenerationRun } from '../src/generation-runs/chapter-generation-run-store.js'

function createStoredRun(): ChapterGenerationRun {
    return {
        id: 'run-1',
        unitInitId: 'unit-init-1',
        ownerId: 'mock-user',
        chapterIndex: 0,
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt: 'Generate one chapter for next.js framework.',
        chapter: {
            chapterIndex: 0,
            title: 'Foundations',
            overview: 'Learn the basics.',
            content: 'Detailed content.',
            keyTakeaways: ['Routing'],
            generatedAt: '2026-03-12T00:00:00.000Z',
        },
        status: 'completed',
        createdAt: '2026-03-12T00:00:00.000Z',
    }
}

describe('MongoChapterGenerationRunStore', () => {
    it('saves and lists chapter generation runs through the collection', async () => {
        const run = createStoredRun()
        const updateOne = vi.fn().mockResolvedValue(undefined)
        const toArray = vi.fn().mockResolvedValue([{ ...run, _id: 'mongo-run-1' }])
        const sort = vi.fn().mockReturnValue({ toArray })
        const find = vi.fn().mockReturnValue({ sort })
        const collection = {
            updateOne,
            find,
        }
        const database = {
            collection: vi.fn().mockReturnValue(collection),
        }

        const store = new MongoChapterGenerationRunStore(database as never)

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
