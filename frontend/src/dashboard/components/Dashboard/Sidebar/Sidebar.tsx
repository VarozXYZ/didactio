import {
    BarChart3,
    ChevronDown,
    ChevronRight,
    CreditCard,
    Lock,
    MoreHorizontal,
    MoreVertical,
    Palette,
    PenLine,
    Plus,
    Settings2,
    Trash2,
    User,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type Dispatch, type SetStateAction } from 'react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu'
import type {
    DashboardFolder,
    DashboardListItem,
    DashboardSection,
} from '../../../types'
import { getFolderIcon } from '../../../utils/folderDisplay'

type SidebarProps = {
    isSidebarOpen: boolean
    activeSection: DashboardSection
    setActiveSection: Dispatch<SetStateAction<DashboardSection>>
    expandedFolders: string[]
    toggleFolder: (folderId: string) => void
    folders: DashboardFolder[]
    onCreateFolder: (name: string) => Promise<void>
    onOpenItem: (itemId: string) => void
    onOpenEditor: (itemId: string) => void
    onOpenSetup: (itemId: string) => void
    onDeleteItem: (itemId: string) => void
    items: DashboardListItem[]
}

export function Sidebar({
    isSidebarOpen,
    activeSection,
    setActiveSection,
    expandedFolders,
    toggleFolder,
    folders,
    onCreateFolder,
    onOpenItem,
    onOpenEditor,
    onOpenSetup,
    onDeleteItem,
    items,
}: SidebarProps) {
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [draftFolderName, setDraftFolderName] = useState('')
    const [isSubmittingFolder, setIsSubmittingFolder] = useState(false)
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
                    <img
                        src="/assets/logos/logo-horizontal.png"
                        alt="Didactio"
                        className="h-10 w-auto object-contain"
                    />
                ) : (
                    <img
                        src="/assets/logos/logo.png"
                        alt="Didactio"
                        className="h-10 w-10 object-contain"
                    />
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-3">
                {isSidebarOpen && (
                    <div className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-widest text-[#86868B]">
                        MY FOLDERS
                    </div>
                )}

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
                                {(() => {
                                    const FolderIcon = getFolderIcon(folder.icon)

                                    return isSidebarOpen ? (
                                        <>
                                            {expandedFolders.includes(folder.id) ? (
                                                <ChevronDown size={14} className="text-[#86868B]" />
                                            ) : (
                                                <ChevronRight
                                                    size={14}
                                                    className="text-[#86868B]"
                                                />
                                            )}
                                            <div
                                                className="flex h-7 w-7 items-center justify-center rounded-lg"
                                                style={{
                                                    backgroundColor: `${folder.color}1A`,
                                                    color: folder.color,
                                                }}
                                            >
                                                <FolderIcon size={15} strokeWidth={2} />
                                            </div>
                                            <span className="flex-1 truncate text-left text-[14px] font-medium">
                                                {folder.name}
                                            </span>
                                            <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px]">
                                                {folder.unitCount}
                                            </span>
                                        </>
                                    ) : (
                                        <FolderIcon
                                            size={18}
                                            strokeWidth={2}
                                            style={{ color: folder.color }}
                                        />
                                    )
                                })()}
                            </button>

                            {isSidebarOpen && expandedFolders.includes(folder.id) && (
                                <div className="ml-8 mt-1 space-y-0.5">
                                    {folder.units.map((unitId) => {
                                        const unit = items.find((entry) => entry.id === unitId)

                                        if (!unit) {
                                            return null
                                        }

                                        return (
                                            <div
                                                key={unitId}
                                                className="group flex items-center gap-1 rounded-[6px] px-3 py-1.5 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenItem(unitId)}
                                                    className="min-w-0 flex-1 truncate text-left"
                                                >
                                                    {unit.title}
                                                </button>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#E5E5E7] group-hover:opacity-100 data-[state=open]:opacity-100"
                                                        >
                                                            <MoreHorizontal size={13} />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent side="right" align="start">
                                                        {unit.canOpenEditor ? (
                                                            <DropdownMenuItem
                                                                onSelect={() => onOpenEditor(unitId)}
                                                            >
                                                                <PenLine />
                                                                Open Editor
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                onSelect={() => onOpenSetup(unitId)}
                                                            >
                                                                <Settings2 />
                                                                Open Setup
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            destructive
                                                            onSelect={() => onDeleteItem(unitId)}
                                                        >
                                                            <Trash2 />
                                                            Remove Unit
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
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
                    <div className="mb-6">
                        {isCreatingFolder ? (
                            <form
                                className="space-y-2 rounded-[14px] border border-[#E5E5E7] bg-[#FAFAFB] p-3"
                                onSubmit={(event) => {
                                    event.preventDefault()

                                    if (!draftFolderName.trim() || isSubmittingFolder) {
                                        return
                                    }

                                    void (async () => {
                                        setIsSubmittingFolder(true)

                                        try {
                                            await onCreateFolder(draftFolderName.trim())
                                            setDraftFolderName('')
                                            setIsCreatingFolder(false)
                                        } finally {
                                            setIsSubmittingFolder(false)
                                        }
                                    })()
                                }}
                            >
                                <input
                                    type="text"
                                    value={draftFolderName}
                                    onChange={(event) => setDraftFolderName(event.target.value)}
                                    placeholder="New folder name"
                                    className="w-full rounded-[10px] border border-[#E5E5E7] bg-white px-3 py-2 text-[13px] text-[#1D1D1F] outline-none focus:border-[#4ADE80]"
                                />
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDraftFolderName('')
                                            setIsCreatingFolder(false)
                                        }}
                                        className="rounded-[10px] px-3 py-2 text-[12px] font-medium text-[#86868B]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!draftFolderName.trim() || isSubmittingFolder}
                                        className="rounded-[10px] bg-[#1D1D1F] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
                                    >
                                        {isSubmittingFolder ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsCreatingFolder(true)}
                                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]"
                            >
                                <Plus size={16} />
                                <span>Create Folder</span>
                            </button>
                        )}
                    </div>
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
