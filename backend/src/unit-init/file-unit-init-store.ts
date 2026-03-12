import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { CreatedUnitInit } from './create-unit-init.js'
import type { UnitInitStore } from './unit-init-store.js'

export class FileUnitInitStore implements UnitInitStore {
    private readonly unitInits: Map<string, CreatedUnitInit>

    constructor(private readonly filePath: string) {
        this.unitInits = new Map(
            this.readStoredUnitInits().map((unitInit) => [unitInit.id, unitInit])
        )
    }

    save(unitInit: CreatedUnitInit): void {
        this.unitInits.set(unitInit.id, unitInit)
        this.flush()
    }

    getById(ownerId: string, unitInitId: string): CreatedUnitInit | null {
        const unitInit = this.unitInits.get(unitInitId)
        if (!unitInit || unitInit.ownerId !== ownerId) {
            return null
        }

        return unitInit
    }

    listByOwner(ownerId: string): CreatedUnitInit[] {
        return [...this.unitInits.values()]
            .filter((unitInit) => unitInit.ownerId === ownerId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }

    private readStoredUnitInits(): CreatedUnitInit[] {
        try {
            const fileContents = readFileSync(this.filePath, 'utf8')
            const parsedValue = JSON.parse(fileContents) as unknown

            return Array.isArray(parsedValue) ? (parsedValue as CreatedUnitInit[]) : []
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException

            if (nodeError.code === 'ENOENT') {
                return []
            }

            throw error
        }
    }

    private flush(): void {
        mkdirSync(dirname(this.filePath), { recursive: true })
        writeFileSync(
            this.filePath,
            JSON.stringify([...this.unitInits.values()], null, 2),
            'utf8'
        )
    }
}
