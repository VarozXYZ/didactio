import type { CreatedUnitInit } from './create-unit-init.js'

export interface UnitInitStore {
    save(unitInit: CreatedUnitInit): void
    getById(ownerId: string, unitInitId: string): CreatedUnitInit | null
    listByOwner(ownerId: string): CreatedUnitInit[]
}

export class InMemoryUnitInitStore implements UnitInitStore {
    private readonly unitInits = new Map<string, CreatedUnitInit>()

    save(unitInit: CreatedUnitInit): void {
        this.unitInits.set(unitInit.id, unitInit)
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
}
