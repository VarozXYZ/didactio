import { MoreVertical, PencilLine } from 'lucide-react'
import type { DashboardListItem } from '../../../types'
import { getFolderEmoji, getFolderVisuals } from '../../../utils/folderDisplay'

type UnitsTableProps = {
    onOpenItem: (itemId: string) => void
    units: DashboardListItem[]
}

export function UnitsTable({ onOpenItem, units }: UnitsTableProps) {
    return (
        <div className="overflow-hidden rounded-2xl border border-[#E5E5E7] bg-white">
            <table className="w-full">
                <thead className="border-b border-[#E5E5E7] bg-[#F5F5F7]">
                    <tr>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                            Title
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                            Folder
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                            Chapters
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                            Progress
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                            Last Modified
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {units.map((unit, index) => {
                        const style = getFolderVisuals(unit.folder)
                        const folderEmoji = getFolderEmoji(unit.folder.icon)

                        return (
                            <tr
                                key={unit.id}
                                className={`transition-all hover:bg-[#F5F5F7]/50 ${
                                    index === units.length - 1 ? '' : 'border-b border-[#E5E5E7]'
                                }`}
                            >
                                <td className="px-6 py-4">
                                    <button
                                        type="button"
                                        onClick={() => onOpenItem(unit.id)}
                                        className="group flex items-center gap-3 text-left"
                                    >
                                        <div
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                                            style={{ backgroundColor: style.bgColor }}
                                        >
                                            <span className="text-[22px] leading-none">{folderEmoji}</span>
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-semibold text-[#1D1D1F] transition-colors group-hover:text-[#4ADE80]">
                                                {unit.title}
                                            </div>
                                            <div className="flex items-center gap-2 text-[12px] text-[#86868B]">
                                                <span>{unit.canOpenEditor ? 'Learner workspace' : 'Setup workflow'}</span>
                                                {unit.canOpenEditor ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1D1D1F] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                        <PencilLine size={10} />
                                                        Editor
                                                    </span>
                                                ) : (
                                                    <span>Continue setup</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <span
                                        className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
                                        style={{
                                            backgroundColor: style.bgColor,
                                            color: style.iconColor,
                                        }}
                                    >
                                        <span className="text-[11px] leading-none">{folderEmoji}</span>
                                        {unit.folder.name}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-[14px] text-[#1D1D1F]">
                                    {unit.chapterCount}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 max-w-[120px] flex-1 overflow-hidden rounded-full bg-[#F5F5F7]">
                                            <div
                                                className="h-full"
                                                style={{
                                                    width: `${unit.primaryProgressPercent}%`,
                                                    backgroundColor: style.accentColor,
                                                }}
                                            />
                                        </div>
                                        <span className="min-w-[35px] text-[13px] font-semibold text-[#1D1D1F]">
                                            {unit.primaryProgressPercent}%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-[13px] text-[#86868B]">
                                    {unit.lastActivityAt}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        type="button"
                                        onClick={() => onOpenItem(unit.id)}
                                        className="rounded-lg p-2 transition-all hover:bg-[#F5F5F7]"
                                    >
                                        <MoreVertical size={16} className="text-[#86868B]" />
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
