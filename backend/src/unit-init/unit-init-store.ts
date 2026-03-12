import type { CreatedUnitInit } from './create-unit-init.js'

export interface UnitInitStore {
    save(unitInit: CreatedUnitInit): Promise<void>
    getById(ownerId: string, unitInitId: string): Promise<CreatedUnitInit | null>
    listByOwner(ownerId: string): Promise<CreatedUnitInit[]>
}

export class InMemoryUnitInitStore implements UnitInitStore {
    private readonly unitInits = new Map<string, CreatedUnitInit>()

    async save(unitInit: CreatedUnitInit): Promise<void> {
        this.unitInits.set(unitInit.id, unitInit)
    }

    async getById(ownerId: string, unitInitId: string): Promise<CreatedUnitInit | null> {
        const unitInit = this.unitInits.get(unitInitId)
        if (!unitInit || unitInit.ownerId !== ownerId) {
            return null
        }

        return unitInit
    }

    async listByOwner(ownerId: string): Promise<CreatedUnitInit[]> {
        return [...this.unitInits.values()]
            .filter((unitInit) => unitInit.ownerId === ownerId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    }
}
