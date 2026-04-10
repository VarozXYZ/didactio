import { Clock, FolderInput, MoreHorizontal, PenLine, Settings2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { BackendFolder } from '../../../api/dashboardApi'
import type { DashboardListItem } from '../../../types'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../../../components/ui/alert-dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu'
import { getFolderEmoji, getFolderVisuals } from '../../../utils/folderDisplay'

type UnitCardProps = {
    allFolders: BackendFolder[]
    onOpenItem: (itemId: string) => void
    onOpenEditor: (itemId: string) => void
    onOpenSetup: (itemId: string) => Promise<void>
    onDeleteItem: (itemId: string) => Promise<void>
    onMoveToFolder: (itemId: string, folderId: string) => Promise<void>
    unit: DashboardListItem
}

export function UnitCard({
    allFolders,
    onDeleteItem,
    onMoveToFolder,
    onOpenEditor,
    onOpenItem,
    onOpenSetup,
    unit,
}: UnitCardProps) {
    const style = getFolderVisuals(unit.folder)
    const folderEmoji = getFolderEmoji(unit.folder.icon)
    const handleOpenItem = () => onOpenItem(unit.id)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    return (
        <>
        <div className="group">
            <div className="overflow-hidden rounded-2xl border border-[#E5E5E7] bg-white transition-all duration-300 hover:border-[#4ADE80] hover:shadow-lg">
                <button type="button" onClick={handleOpenItem} className="block w-full text-left">
                    <div
                        className="relative flex h-[180px] items-center justify-center"
                        style={{ backgroundColor: style.bgColor }}
                    >
                        <span
                            className="select-none text-[72px] leading-none"
                            style={{ opacity: 0.4 }}
                        >
                            {folderEmoji}
                        </span>

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
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5">
                                <div
                                    className="h-full transition-all"
                                    style={{
                                        width: `${unit.primaryProgressPercent}%`,
                                        backgroundColor: style.accentColor,
                                    }}
                                />
                            </div>
                        ) : null}
                    </div>
                </button>

                <div className="p-5">
                    <div className="mb-2 flex items-start justify-between gap-2">
                        <button
                            type="button"
                            onClick={handleOpenItem}
                            className="min-w-0 flex-1 text-left"
                        >
                            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#1D1D1F] transition-colors group-hover:text-[#4ADE80]">
                                {unit.title}
                            </h3>
                        </button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="cursor-pointer rounded-lg p-1.5 opacity-0 transition-all group-hover:bg-[#F5F5F7] group-hover:opacity-100 data-[state=open]:bg-[#F5F5F7] data-[state=open]:opacity-100"
                                >
                                    <MoreHorizontal size={16} className="text-[#86868B]" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="left" align="end">
                                {unit.canOpenEditor ? (
                                    <DropdownMenuItem onSelect={() => onOpenEditor(unit.id)}>
                                        <PenLine />
                                        Open editor
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem onSelect={() => onOpenSetup(unit.id)}>
                                        <Settings2 />
                                        Open Setup
                                    </DropdownMenuItem>
                                )}

                                {allFolders.filter((f) => f.id !== unit.folder.id).length > 0 && (
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <FolderInput />
                                            Move to folder
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            {allFolders
                                                .filter((f) => f.id !== unit.folder.id)
                                                .map((folder) => (
                                                    <DropdownMenuItem
                                                        key={folder.id}
                                                        onSelect={() => onMoveToFolder(unit.id, folder.id)}
                                                    >
                                                        <span>{getFolderEmoji(folder.icon)}</span>
                                                        {folder.name}
                                                    </DropdownMenuItem>
                                                ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                )}

                                <DropdownMenuSeparator />
                                <DropdownMenuItem destructive onSelect={() => setShowDeleteDialog(true)}>
                                    <Trash2 />
                                    Remove unit
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <button type="button" onClick={handleOpenItem} className="block w-full text-left">
                        <div className="mb-4 flex items-center gap-2">
                            <span
                                className="inline-flex min-w-0 max-w-[calc(100%-4.5rem)] shrink items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{
                                    backgroundColor: style.bgColor,
                                    color: style.iconColor,
                                }}
                            >
                                <span className="text-[10px] leading-none">{folderEmoji}</span>
                                <span className="truncate">{unit.folder.name}</span>
                            </span>
                            {unit.canOpenEditor && (
                                <span className="ml-auto shrink-0 text-[11px] text-[#86868B]">
                                    {unit.chapterCount} {unit.chapterCount === 1 ? 'module' : 'modules'}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#86868B]">
                            <div className="flex items-center gap-1.5">
                                <Clock size={12} />
                                <span>{unit.lastActivityAt}</span>
                            </div>
                            {unit.canOpenEditor ? (
                                <div className="font-semibold text-[#4ADE80]">
                                    {unit.primaryProgressPercent}%
                                </div>
                            ) : (
                                <span className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E7] bg-white/70 px-2 py-1 text-[11px] font-medium leading-tight text-[#6E6E73]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500/80" />
                                    Setup needed
                                </span>
                            )}
                        </div>
                    </button>
                </div>
            </div>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove unit?</AlertDialogTitle>
                    <AlertDialogDescription>
                        <strong className="font-medium text-[#1D1D1F]">{unit.title}</strong> will be permanently removed. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-500 hover:bg-red-600 focus-visible:ring-red-500"
                        onClick={() => onDeleteItem(unit.id)}
                    >
                        Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}
