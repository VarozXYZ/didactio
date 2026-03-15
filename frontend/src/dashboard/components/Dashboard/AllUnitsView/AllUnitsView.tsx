import { Grid3x3, List, Search } from 'lucide-react'
import { AllUnitsHeader } from './AllUnitsHeader'
import { UnitsGrid } from './UnitsGrid'
import { UnitsTable } from './UnitsTable'
import type { DashboardListItem } from '../../../types'

type AllUnitsViewProps = {
    filteredUnits: DashboardListItem[]
    searchQuery: string
    setSearchQuery: (value: string) => void
    viewMode: 'grid' | 'list'
    setViewMode: (value: 'grid' | 'list') => void
    totalUnits: number
    folderCount: number
    averageProgress: number
    onOpenItem: (itemId: string) => void
    onCreateUnit: () => void
}

export function AllUnitsView({
    filteredUnits,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    totalUnits,
    folderCount,
    averageProgress,
    onOpenItem,
    onCreateUnit,
}: AllUnitsViewProps) {
    void totalUnits
    void folderCount
    void averageProgress

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <AllUnitsHeader
                filteredUnitsCount={filteredUnits.length}
                onCreateUnit={onCreateUnit}
            />
            <div className="bg-[#F5F5F7] p-8">
                <div className="mx-auto w-full max-w-[1560px]">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div className="relative">
                            <Search
                                size={16}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]"
                            />
                            <input
                                type="text"
                                placeholder="Search units..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="w-[280px] rounded-2xl border border-[#D9D9D9] bg-white py-3 pl-11 pr-4 text-[14px] text-[#1D1D1F] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-all focus:border-[#4ADE80] focus:outline-none md:w-[320px]"
                            />
                        </div>

                        <div className="flex items-center gap-1 rounded-[10px] border border-[#D9D9D9] bg-white p-1 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`rounded-[8px] p-2.5 transition-all ${
                                    viewMode === 'grid'
                                        ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                                        : 'text-[#86868B] hover:text-[#1D1D1F]'
                                }`}
                            >
                                <Grid3x3 size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`rounded-[8px] p-2.5 transition-all ${
                                    viewMode === 'list'
                                        ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                                        : 'text-[#86868B] hover:text-[#1D1D1F]'
                                }`}
                            >
                                <List size={16} />
                            </button>
                        </div>
                    </div>

                    {viewMode === 'grid' ? (
                        <UnitsGrid onOpenItem={onOpenItem} units={filteredUnits} />
                    ) : (
                        <UnitsTable onOpenItem={onOpenItem} units={filteredUnits} />
                    )}
                </div>
            </div>
        </div>
    )
}
