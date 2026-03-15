import type { DidacticUnit } from './create-didactic-unit.js'

export interface DidacticUnitStore {
    save(didacticUnit: DidacticUnit): Promise<void>
    getById(ownerId: string, didacticUnitId: string): Promise<DidacticUnit | null>
    listByOwner(ownerId: string): Promise<DidacticUnit[]>
}

export class InMemoryDidacticUnitStore implements DidacticUnitStore {
    private readonly didacticUnits = new Map<string, DidacticUnit>()

    async save(didacticUnit: DidacticUnit): Promise<void> {
        this.didacticUnits.set(didacticUnit.id, didacticUnit)
    }

    async getById(ownerId: string, didacticUnitId: string): Promise<DidacticUnit | null> {
        const didacticUnit = this.didacticUnits.get(didacticUnitId)

        if (!didacticUnit || didacticUnit.ownerId !== ownerId) {
            return null
        }

        return didacticUnit
    }

    async listByOwner(ownerId: string): Promise<DidacticUnit[]> {
        return [...this.didacticUnits.values()]
            .filter((didacticUnit) => didacticUnit.ownerId === ownerId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    }
}
