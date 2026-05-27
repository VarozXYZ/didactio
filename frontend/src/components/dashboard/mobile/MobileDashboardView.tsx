import {BookOpen, FolderPlus, MoreHorizontal, PenLine, Search, Trash2} from "lucide-react";
import {useMemo, useRef, useState} from "react";
import type {FolderDto} from "@/dashboard/api/dashboardApi";
import type {UnitLibraryItem} from "@/dashboard/types";
import {getFolderEmoji} from "@/dashboard/utils/folderDisplay";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {FolderFormModal} from "../navigation/FolderFormModal";
import {CreateUnitButton} from "../library/UnitLibraryHeader";
import {MobileUnitCard} from "./MobileUnitCard";

type MobileDashboardViewProps = {
	allFolders: FolderDto[];
	filteredUnits: UnitLibraryItem[];
	onCreateFolder: (
		name: string,
		icon: string,
		color: string,
	) => Promise<void>;
	onCreateUnit: () => void;
	onDeleteFolder: (folderId: string) => Promise<void>;
	onDeleteItem: (itemId: string) => Promise<void>;
	onEditFolder: (
		folderId: string,
		name: string,
		icon: string,
		color: string,
	) => Promise<void>;
	onMoveToFolder: (itemId: string, folderId: string) => Promise<void>;
	onOpenEditor: (itemId: string) => void;
	onOpenItem: (itemId: string) => void;
	onOpenSetup: (itemId: string) => Promise<void>;
	searchQuery: string;
	setSearchQuery: (value: string) => void;
};

export function MobileDashboardView({
	allFolders,
	filteredUnits,
	onCreateFolder,
	onCreateUnit,
	onDeleteFolder,
	onDeleteItem,
	onEditFolder,
	onMoveToFolder,
	onOpenEditor,
	onOpenItem,
	onOpenSetup,
	searchQuery,
	setSearchQuery,
}: MobileDashboardViewProps) {
	const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
	const [folderModal, setFolderModal] = useState<
		| {open: false}
		| {open: true; mode: "create"}
		| {open: true; mode: "edit"; folder: FolderDto}
	>({open: false});
	const [folderPendingDelete, setFolderPendingDelete] =
		useState<FolderDto | null>(null);
	const visibleFolders = useMemo(
		() => allFolders.filter((folder) => folder.slug !== "general"),
		[allFolders],
	);
	const visibleUnits = useMemo(() => {
		if (!activeFolderId) {
			return filteredUnits;
		}

		return filteredUnits.filter((unit) => unit.folder.id === activeFolderId);
	}, [activeFolderId, filteredUnits]);

	return (
		<div className="app-dashboard-canvas min-h-screen bg-[#F7F7F8] pb-[calc(env(safe-area-inset-bottom)+86px)] text-[#111113] md:hidden">
			<header className="app-dashboard-header sticky top-0 z-20 border-b border-[#E5E5E7] bg-white/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur-xl">
				<div className="mx-auto flex w-full max-w-[min(100%,900px)] items-center justify-between gap-4">
					<img
						src="/assets/logos/logo-horizontal.png"
						alt="Didactio"
						className="h-10 min-w-0 max-w-[150px] object-contain"
					/>
					<CreateUnitButton onClick={onCreateUnit} />
				</div>
			</header>

			<main className="mx-auto w-full max-w-[min(100%,900px)] px-[clamp(1rem,4vw,2rem)] pt-6">
				<div>
					<h1 className="text-[32px] font-bold leading-none tracking-tight text-[#050506]">
						Library
					</h1>
				</div>

				<div className="relative mt-5">
					<Search
						size={22}
						className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E8E93]"
					/>
					<input
						type="text"
						placeholder="Search units..."
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						className="app-library-search h-[48px] w-full rounded-[16px] border border-[#DADADD] bg-white px-4 pl-12 text-[16px] font-medium text-[#1D1D1F] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] outline-none transition focus:border-[#34C759]"
					/>
				</div>

				<div className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					<div className="flex w-max gap-3">
						<button
							type="button"
							onClick={() => setActiveFolderId(null)}
							className={`app-mobile-folder-chip inline-flex h-12 items-center gap-2 rounded-[16px] border px-4 text-[15px] font-semibold transition ${
								activeFolderId === null ?
									"app-mobile-folder-chip-active border-[#CFEFDB] bg-[#DDF8E8] text-[#111113]"
								:	"border-[#E1E1E4] bg-white text-[#3A3A3C]"
							}`}
						>
							<BookOpen size={20} />
							General
						</button>
						{visibleFolders.map((folder) => (
							<MobileFolderChip
								key={folder.id}
								folder={folder}
								isActive={activeFolderId === folder.id}
								onDelete={() => setFolderPendingDelete(folder)}
								onEdit={() =>
									setFolderModal({
										open: true,
										mode: "edit",
										folder,
									})
								}
								onClick={() => setActiveFolderId(folder.id)}
							/>
						))}
						<button
							type="button"
							onClick={() =>
								setFolderModal({open: true, mode: "create"})
							}
							className="app-mobile-folder-chip inline-flex h-12 items-center gap-2 rounded-[16px] border border-dashed border-[#D1D1D6] bg-white px-4 text-[15px] font-semibold text-[#6E6E73] transition hover:border-[#34C759] hover:text-[#1D1D1F]"
						>
							<FolderPlus size={20} />
							Create new folder
						</button>
					</div>
				</div>

				<p className="mt-5 text-[14px] font-semibold text-[#8E8E93]">
					{visibleUnits.length} library items
				</p>

				{visibleUnits.length === 0 ?
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[18px] bg-white shadow-sm">
							<BookOpen size={28} className="text-[#8E8E93]" />
						</div>
						<p className="text-[17px] font-bold text-[#1D1D1F]">
							{searchQuery ? "No results found" : "Your library is empty"}
						</p>
						<p className="mt-1 max-w-[260px] text-[14px] leading-relaxed text-[#8E8E93]">
							{searchQuery ?
								"Try a different search term or category."
							:	"Create your first unit to start building your learning library."}
						</p>
						{!searchQuery && (
							<div className="mt-5">
								<CreateUnitButton
									onClick={onCreateUnit}
									label="Create unit"
								/>
							</div>
						)}
					</div>
				:	<div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-[clamp(0.875rem,2.4vw,1.25rem)]">
						{visibleUnits.map((unit) => (
							<MobileUnitCard
								key={unit.id}
								allFolders={allFolders}
								onDeleteItem={onDeleteItem}
								onMoveToFolder={onMoveToFolder}
								onOpenEditor={onOpenEditor}
								onOpenItem={onOpenItem}
								onOpenSetup={onOpenSetup}
								unit={unit}
							/>
						))}
					</div>
				}
			</main>

			<FolderFormModal
				open={folderModal.open}
				mode={folderModal.open ? folderModal.mode : "create"}
				initialName={
					folderModal.open && folderModal.mode === "edit" ?
						folderModal.folder.name
					:	undefined
				}
				initialIcon={
					folderModal.open && folderModal.mode === "edit" ?
						getFolderEmoji(folderModal.folder.icon)
					:	undefined
				}
				initialColor={
					folderModal.open && folderModal.mode === "edit" ?
						folderModal.folder.color
					:	undefined
				}
				onClose={() => setFolderModal({open: false})}
				onSubmit={async (name, icon, color) => {
					if (folderModal.open && folderModal.mode === "edit") {
						await onEditFolder(
							folderModal.folder.id,
							name,
							icon,
							color,
						);
						return;
					}

					await onCreateFolder(name, icon, color);
				}}
			/>

			<AlertDialog
				open={folderPendingDelete !== null}
				onOpenChange={(open) => {
					if (!open) {
						setFolderPendingDelete(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove folder?</AlertDialogTitle>
						<AlertDialogDescription>
							<strong className="font-medium text-[#1D1D1F]">
								{folderPendingDelete?.name}
							</strong>{" "}
							will be removed. All units inside will be moved to{" "}
							<strong className="font-medium text-[#1D1D1F]">
								General
							</strong>{" "}
							automatically. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-red-500 hover:bg-red-600 focus-visible:ring-red-500"
							onClick={() => {
								if (!folderPendingDelete) {
									return;
								}

								if (activeFolderId === folderPendingDelete.id) {
									setActiveFolderId(null);
								}
								void onDeleteFolder(folderPendingDelete.id);
								setFolderPendingDelete(null);
							}}
						>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

type MobileFolderChipProps = {
	folder: FolderDto;
	isActive: boolean;
	onClick: () => void;
	onDelete: () => void;
	onEdit: () => void;
};

function MobileFolderChip({
	folder,
	isActive,
	onClick,
	onDelete,
	onEdit,
}: MobileFolderChipProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const longPressTimerRef = useRef<number | null>(null);
	const pointerStartRef = useRef<{x: number; y: number} | null>(null);

	const clearLongPressTimer = () => {
		if (longPressTimerRef.current === null) {
			return;
		}

		window.clearTimeout(longPressTimerRef.current);
		longPressTimerRef.current = null;
	};

	const clearPressState = () => {
		clearLongPressTimer();
		pointerStartRef.current = null;
	};

	const openActionMenu = () => {
		clearPressState();
		setIsMenuOpen(true);
	};

	return (
		<DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
			<div
				className={`app-mobile-folder-chip inline-flex h-12 items-center overflow-hidden rounded-[16px] border text-[15px] font-semibold transition ${
					isActive ?
						"app-mobile-folder-chip-active border-[#CFEFDB] bg-[#DDF8E8] text-[#111113]"
					:	"border-[#E1E1E4] bg-white text-[#3A3A3C]"
				}`}
			>
				<button
					type="button"
					onClick={onClick}
					onContextMenu={(event) => {
						event.preventDefault();
						openActionMenu();
					}}
					onPointerCancel={clearPressState}
					onPointerDown={(event) => {
						if (event.pointerType !== "touch") {
							return;
						}

						clearPressState();
						pointerStartRef.current = {
							x: event.clientX,
							y: event.clientY,
						};
						longPressTimerRef.current = window.setTimeout(
							openActionMenu,
							520,
						);
					}}
					onPointerLeave={clearPressState}
					onPointerMove={(event) => {
						const start = pointerStartRef.current;
						if (!start) {
							return;
						}

						const deltaX = Math.abs(event.clientX - start.x);
						const deltaY = Math.abs(event.clientY - start.y);
						if (deltaX > 8 || deltaY > 8) {
							clearPressState();
						}
					}}
					onPointerUp={clearPressState}
					className="inline-flex h-full min-w-0 items-center gap-2 px-4"
				>
					<span className="text-[20px] leading-none">
						{getFolderEmoji(folder.icon)}
					</span>
					<span className="max-w-[150px] truncate">{folder.name}</span>
				</button>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="app-mobile-folder-chip-action flex h-full w-9 shrink-0 items-center justify-center border-l border-black/[0.04] text-[#8E8E93]"
						aria-label={`${folder.name} actions`}
						onClick={(event) => event.stopPropagation()}
					>
						<MoreHorizontal size={16} />
					</button>
				</DropdownMenuTrigger>
			</div>
			<DropdownMenuContent align="start" side="bottom">
				<DropdownMenuItem onSelect={onEdit}>
					<PenLine />
					Edit folder
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem destructive onSelect={onDelete}>
					<Trash2 />
					Remove folder
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
