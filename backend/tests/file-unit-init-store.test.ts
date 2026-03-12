import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CreatedUnitInit } from '../src/unit-init/create-unit-init.js'
import { FileUnitInitStore } from '../src/unit-init/file-unit-init-store.js'

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

describe('FileUnitInitStore', () => {
    it('persists unit-inits across store instances', () => {
        const directoryPath = mkdtempSync(join(tmpdir(), 'didactio-unit-init-store-'))
        const filePath = join(directoryPath, 'unit-inits.json')
        const store = new FileUnitInitStore(filePath)
        const unitInit = createStoredUnitInit()

        store.save(unitInit)

        const reopenedStore = new FileUnitInitStore(filePath)

        expect(reopenedStore.getById('mock-user', unitInit.id)).toEqual(unitInit)
    })

    it('still filters by owner id', () => {
        const directoryPath = mkdtempSync(join(tmpdir(), 'didactio-unit-init-store-'))
        const filePath = join(directoryPath, 'unit-inits.json')
        const store = new FileUnitInitStore(filePath)
        const unitInit = createStoredUnitInit()

        store.save(unitInit)

        expect(store.getById('another-user', unitInit.id)).toBeNull()
    })
})
