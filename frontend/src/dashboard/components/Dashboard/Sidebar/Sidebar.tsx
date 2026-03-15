import {
    BarChart3,
    ChevronDown,
    ChevronRight,
    CreditCard,
    FileText,
    Lock,
    MoreVertical,
    Palette,
    Plus,
    Sparkles,
    User,
} from 'lucide-react'
import { motion } from 'motion/react'
import type { Dispatch, SetStateAction } from 'react'
import type { DashboardFolder, DashboardSection, UnitSummary } from '../../../types'

type SidebarProps = {
    isSidebarOpen: boolean
    activeSection: DashboardSection
    setActiveSection: Dispatch<SetStateAction<DashboardSection>>
    expandedFolders: number[]
    toggleFolder: (folderId: number) => void
    folders: DashboardFolder[]
    isUnitEditable: (unitId: number) => boolean
    onOpenUnit: (unitId: number) => void
    units: UnitSummary[]
}

export function Sidebar({
    isSidebarOpen,
    activeSection,
    setActiveSection,
    expandedFolders,
    toggleFolder,
    folders,
    isUnitEditable,
    onOpenUnit,
    units,
}: SidebarProps) {
    const settingsItems: Array<{
        id: DashboardSection
        label: string
        icon: typeof CreditCard
    }> = [
        { id: 'subscription', icon: CreditCard, label: 'Subscription & Credits' },
        { id: 'profile', icon: User, label: 'Profile' },
        { id: 'security', icon: Lock, label: 'Security' },
        { id: 'preferences', icon: Palette, label: 'Preferences' },
        { id: 'analytics', icon: BarChart3, label: 'Usage & Analytics' },
    ]

    return (
        <motion.aside
            initial={false}
            animate={{ width: isSidebarOpen ? 280 : 80 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="z-20 flex min-h-screen flex-col overflow-hidden border-r border-[#E5E5E7] bg-white"
        >
            <div
                className={`flex shrink-0 items-center p-6 ${
                    isSidebarOpen ? 'justify-between gap-3' : 'justify-center'
                }`}
            >
                {isSidebarOpen ? (
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D1D1F]">
                            <Sparkles size={18} className="text-[#4ADE80]" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight">Didactio</span>
                    </div>
                ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D1D1F]">
                        <Sparkles size={18} className="text-[#4ADE80]" />
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-3">
                {isSidebarOpen && (
                    <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-[#86868B]">
                        Content
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setActiveSection('all-units')}
                    className={`mb-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 transition-all ${
                        activeSection === 'all-units'
                            ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                            : 'text-[#86868B] hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]'
                    } ${!isSidebarOpen ? 'justify-center' : ''}`}
                >
                    <FileText size={18} />
                    {isSidebarOpen && <span className="text-[14px] font-medium">All Units</span>}
                </button>

                <div className="mb-6 space-y-0.5">
                    {folders.map((folder) => (
                        <div key={folder.id}>
                            <button
                                type="button"
                                onClick={() => toggleFolder(folder.id)}
                                className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F] ${
                                    !isSidebarOpen ? 'justify-center' : ''
                                }`}
                            >
                                {isSidebarOpen ? (
                                    <>
                                        {expandedFolders.includes(folder.id) ? (
                                            <ChevronDown size={14} className="text-[#86868B]" />
                                        ) : (
                                            <ChevronRight size={14} className="text-[#86868B]" />
                                        )}
                                        <span className="text-lg">{folder.icon}</span>
                                        <span className="flex-1 truncate text-left text-[14px] font-medium">
                                            {folder.name}
                                        </span>
                                        <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px]">
                                            {folder.unitCount}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-lg">{folder.icon}</span>
                                )}
                            </button>

                            {isSidebarOpen && expandedFolders.includes(folder.id) && (
                                <div className="ml-8 mt-1 space-y-0.5">
                                    {folder.units.map((unitId) => {
                                        const unit = units.find((entry) => entry.id === unitId)

                                        if (!unit) {
                                            return null
                                        }

                                        return (
                                            <button
                                                key={unitId}
                                                type="button"
                                                disabled={!isUnitEditable(unitId)}
                                                onClick={() => onOpenUnit(unitId)}
                                                className="block w-full rounded-[6px] px-3 py-1.5 text-left text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]"
                                            >
                                                <span className="flex items-center justify-between gap-3">
                                                    <span className="truncate">{unit.title}</span>
                                                    {isUnitEditable(unitId) && (
                                                        <span className="rounded-full bg-[#1D1D1F] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                            Editor
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                        )
                                    })}
                                    {folder.units.length === 0 && (
                                        <div className="px-3 py-1.5 text-[12px] italic text-[#86868B]">
                                            No units yet
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {isSidebarOpen && (
                    <button
                        type="button"
                        className="mb-6 flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]"
                    >
                        <Plus size={16} />
                        <span>Create Folder</span>
                    </button>
                )}

                {isSidebarOpen && (
                    <div className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-widest text-[#86868B]">
                        Settings
                    </div>
                )}

                <div className="space-y-0.5">
                    {settingsItems.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveSection(item.id)}
                            className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 transition-all ${
                                activeSection === item.id
                                    ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                                    : 'text-[#86868B] hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]'
                            } ${!isSidebarOpen ? 'justify-center' : ''}`}
                        >
                            <item.icon size={18} />
                            {isSidebarOpen && (
                                <span className="text-[14px] font-medium">{item.label}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="shrink-0 border-t border-[#E5E5E7] p-4">
                {isSidebarOpen ? (
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] to-[#2D8F4B] text-sm font-semibold text-white">
                            JD
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-[#1D1D1F]">
                                John Doe
                            </div>
                            <div className="text-[11px] text-[#86868B]">Pro Plan</div>
                        </div>
                        <button
                            type="button"
                            className="rounded-lg p-1 transition-all hover:bg-[#F5F5F7]"
                        >
                            <MoreVertical size={16} className="text-[#86868B]" />
                        </button>
                    </div>
                ) : (
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] to-[#2D8F4B] text-sm font-semibold text-white">
                        JD
                    </div>
                )}
            </div>
        </motion.aside>
    )
}
