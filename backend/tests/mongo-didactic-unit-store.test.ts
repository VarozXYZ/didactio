import { describe, expect, it, vi } from 'vitest'
import { MongoDidacticUnitStore } from '../src/didactic-unit/mongo-didactic-unit-store.js'
import type { DidacticUnit } from '../src/didactic-unit/create-didactic-unit.js'

function createStoredDidacticUnit(): DidacticUnit {
    return {
        id: 'didactic-unit-1',
        unitInitId: 'unit-init-1',
        ownerId: 'mock-user',
        title: 'Next.js Learning Path',
        topic: 'next.js framework',
        provider: 'openai',
        status: 'ready_for_content_generation',
        overview: 'A focused syllabus.',
        learningGoals: ['Understand routing'],
        chapters: [
            {
                title: 'Foundations',
                overview: 'Learn the basics.',
                keyPoints: ['Routing'],
            },
        ],
        createdAt: '2026-03-12T00:00:00.000Z',
    }
}

describe('MongoDidacticUnitStore', () => {
    it('saves, looks up, and lists didactic units through the collection', async () => {
        const didacticUnit = createStoredDidacticUnit()
        const updateOne = vi.fn().mockResolvedValue(undefined)
        const findOne = vi.fn().mockResolvedValue({ ...didacticUnit, _id: 'mongo-1' })
        const toArray = vi.fn().mockResolvedValue([{ ...didacticUnit, _id: 'mongo-1' }])
        const sort = vi.fn().mockReturnValue({ toArray })
        const find = vi.fn().mockReturnValue({ sort })
        const collection = {
            updateOne,
            findOne,
            find,
        }
        const database = {
            collection: vi.fn().mockReturnValue(collection),
        }

        const store = new MongoDidacticUnitStore(database as never)

        await store.save(didacticUnit)
        const storedDidacticUnit = await store.getByUnitInitId('mock-user', 'unit-init-1')
        const listedDidacticUnits = await store.listByOwner('mock-user')

        expect(updateOne).toHaveBeenCalledWith(
            { id: didacticUnit.id },
            { $set: didacticUnit },
            { upsert: true }
        )
        expect(findOne).toHaveBeenCalledWith({
            ownerId: 'mock-user',
            unitInitId: 'unit-init-1',
        })
        expect(find).toHaveBeenCalledWith({
            ownerId: 'mock-user',
        })
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 })
        expect(storedDidacticUnit).toEqual(didacticUnit)
        expect(listedDidacticUnits).toEqual([didacticUnit])
    })
})
