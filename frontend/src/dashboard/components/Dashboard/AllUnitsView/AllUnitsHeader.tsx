import { Plus } from 'lucide-react'

export function AllUnitsHeader({
    filteredUnitsCount,
    onCreateUnit,
}: {
    filteredUnitsCount: number
    onCreateUnit: () => void
}) {
    return (
        <header className="z-10 flex h-[80px] shrink-0 items-center justify-between border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-[1560px] items-center justify-between gap-6">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
                        Library
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[#86868B]">
                        {filteredUnitsCount} library items
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onCreateUnit}
                    className="flex items-center gap-2 rounded-[10px] bg-[#1D1D1F] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#333333]"
                >
                    <Plus size={18} />
                    Create Unit
                </button>
            </div>
        </header>
    )
}
