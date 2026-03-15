import { UnitCard } from './UnitCard'
import type { UnitSummary } from '../../../types'

type UnitsGridProps = {
    isUnitEditable: (unitId: number) => boolean
    onOpenUnit: (unitId: number) => void
    units: UnitSummary[]
}

export function UnitsGrid({ isUnitEditable, onOpenUnit, units }: UnitsGridProps) {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {units.map((unit) => (
                <UnitCard
                    key={unit.id}
                    isEditable={isUnitEditable(unit.id)}
                    onOpenUnit={onOpenUnit}
                    unit={unit}
                />
            ))}
        </div>
    )
}
