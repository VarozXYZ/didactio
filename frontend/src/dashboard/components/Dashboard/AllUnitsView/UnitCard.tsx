import { Clock, MoreVertical, PencilLine } from 'lucide-react'
import type { DashboardListItem } from '../../../types'
import { getFolderVisuals } from '../../../utils/folderDisplay'

type UnitCardProps = {
    onOpenItem: (itemId: string) => void
    unit: DashboardListItem
}

export function UnitCard({ onOpenItem, unit }: UnitCardProps) {
    const style = getFolderVisuals(unit.folder)
    const FolderIcon = style.icon

    return (
        <button
            type="button"
            onClick={() => onOpenItem(unit.id)}
            className="group cursor-pointer text-left"
        >
            <div className="overflow-hidden rounded-2xl border border-[#E5E5E7] bg-white transition-all duration-300 hover:border-[#4ADE80] hover:shadow-lg">
                <div
                    className="relative flex h-[180px] items-center justify-center"
                    style={{ backgroundColor: style.bgColor }}
                >
                    <FolderIcon
                        size={72}
                        strokeWidth={1.5}
                        style={{ color: style.iconColor, opacity: 0.4 }}
                    />

                    <div
                        className="absolute right-0 top-0 h-32 w-32 rounded-bl-full opacity-10"
                        style={{ backgroundColor: style.accentColor }}
                    />

                    {unit.status === 'generating' && (
                        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 backdrop-blur-sm">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Setup in progress
                        </div>
                    )}

                    {unit.canOpenEditor ? (
                        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1D1D1F] backdrop-blur-sm">
                            <PencilLine size={12} />
                            Open Editor
                        </div>
                    ) : (
                        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1D1D1F] backdrop-blur-sm">
                            <PencilLine size={12} />
                            Continue Setup
                        </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5">
                        <div
                            className="h-full transition-all"
                            style={{
                                width: `${unit.primaryProgressPercent}%`,
                                backgroundColor: style.accentColor,
                            }}
                        />
                    </div>
                </div>

                <div className="p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#1D1D1F] transition-colors group-hover:text-[#4ADE80]">
                            {unit.title}
                        </h3>
                        <span className="rounded-lg p-1.5 opacity-0 transition-all group-hover:bg-[#F5F5F7] group-hover:opacity-100">
                            <MoreVertical size={16} className="text-[#86868B]" />
                        </span>
                    </div>

                    <div className="mb-4 flex items-center gap-2">
                        <span
                            className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                                backgroundColor: style.bgColor,
                                color: style.iconColor,
                            }}
                        >
                            <FolderIcon size={10} strokeWidth={2.5} />
                            {unit.folder.name}
                        </span>
                        <span className="text-[11px] text-[#86868B]">
                            {unit.chapterCount} {unit.chapterCount === 1 ? 'chapter' : 'chapters'}
                        </span>
                        <span className="text-[11px] text-[#B0B0B6]">
                            {unit.canOpenEditor ? 'Learner workspace' : 'Setup workflow'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#86868B]">
                        <div className="flex items-center gap-1.5">
                            <Clock size={12} />
                            <span>{unit.lastActivityAt}</span>
                        </div>
                        <div className="font-semibold text-[#4ADE80]">
                            {unit.primaryProgressPercent}%
                        </div>
                    </div>
                </div>
            </div>
        </button>
    )
}
