import { describe, expect, it, vi } from 'vitest'
import type { CreatedUnitInit } from '../src/unit-init/create-unit-init.js'
import { MongoUnitInitStore } from '../src/unit-init/mongo-unit-init-store.js'

function createStoredUnitInit(): CreatedUnitInit {
    return {
        id: 'unit-init-1',
        ownerId: 'mock-user',
        topic: 'next.js framework',
        provider: 'openai',
        status: 'submitted',
        nextAction: 'moderate_topic',
        createdAt: '2026-03-12T00:00:00.000Z',
    }
}

describe('MongoUnitInitStore', () => {
    it('saves and loads a unit-init through the collection', async () => {
        const unitInit = createStoredUnitInit()
        const updateOne = vi.fn().mockResolvedValue(undefined)
        const findOne = vi.fn().mockResolvedValue({
            ...unitInit,
            _id: 'mongo-id',
        })
        const collection = {
            updateOne,
            findOne,
            find: vi.fn(),
        }
        const database = {
            collection: vi.fn().mockReturnValue(collection),
        }

        const store = new MongoUnitInitStore(database as never)

        await store.save(unitInit)
        const loadedUnitInit = await store.getById('mock-user', unitInit.id)

        expect(updateOne).toHaveBeenCalledWith(
            { id: unitInit.id },
            { $set: unitInit },
            { upsert: true }
        )
        expect(findOne).toHaveBeenCalledWith({
            id: unitInit.id,
            ownerId: 'mock-user',
        })
        expect(loadedUnitInit).toEqual(unitInit)
    })

    it('lists owner unit-inits in descending createdAt order', async () => {
        const olderUnitInit = createStoredUnitInit()
        const newerUnitInit: CreatedUnitInit = {
            ...olderUnitInit,
            id: 'unit-init-2',
            topic: 'english language',
            createdAt: '2026-03-12T01:00:00.000Z',
        }
        const toArray = vi.fn().mockResolvedValue([
            { ...newerUnitInit, _id: 'mongo-2' },
            { ...olderUnitInit, _id: 'mongo-1' },
        ])
        const sort = vi.fn().mockReturnValue({
            toArray,
        })
        const find = vi.fn().mockReturnValue({
            sort,
        })
        const collection = {
            updateOne: vi.fn(),
            findOne: vi.fn(),
            find,
        }
        const database = {
            collection: vi.fn().mockReturnValue(collection),
        }

        const store = new MongoUnitInitStore(database as never)
        const unitInits = await store.listByOwner('mock-user')

        expect(find).toHaveBeenCalledWith({ ownerId: 'mock-user' })
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 })
        expect(unitInits).toEqual([newerUnitInit, olderUnitInit])
    })
})
