import { UnitCard } from './UnitCard'
import type { DashboardListItem } from '../../../types'

type UnitsGridProps = {
    onOpenItem: (itemId: string) => void
    units: DashboardListItem[]
}

export function UnitsGrid({ onOpenItem, units }: UnitsGridProps) {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {units.map((unit) => (
                <UnitCard key={unit.id} onOpenItem={onOpenItem} unit={unit} />
            ))}
        </div>
    )
}
