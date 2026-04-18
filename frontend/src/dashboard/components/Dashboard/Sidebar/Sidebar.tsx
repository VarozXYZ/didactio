import {
	BarChart3,
	ChevronDown,
	ChevronRight,
	CreditCard,
	FolderInput,
	FolderPen,
	Lock,
	MoreHorizontal,
	MoreVertical,
	Palette,
	PenLine,
	Plus,
	LogOut,
	Settings2,
	Trash2,
	User,
} from "lucide-react";
import {motion} from "motion/react";
import {useState, type Dispatch, type SetStateAction} from "react";
import type {BackendFolder} from "../../../api/dashboardApi";
import {FolderFormModal} from "./FolderFormModal";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import type {
	DashboardFolder,
	DashboardListItem,
	DashboardSection,
} from "../../../types";
import {getFolderEmoji} from "../../../utils/folderDisplay";
import {getMoveTargetFolders} from "../../../utils/folderTargets";
import {useAuth} from "../../../../auth/AuthProvider";

type SidebarProps = {
	isSidebarOpen: boolean;
	activeSection: DashboardSection;
	setActiveSection: Dispatch<SetStateAction<DashboardSection>>;
	expandedFolders: string[];
	toggleFolder: (folderId: string) => void;
	folders: DashboardFolder[];
	allFolders: BackendFolder[];
	onCreateFolder: (
		name: string,
		icon: string,
		color: string,
	) => Promise<void>;
	onEditFolder: (
		folderId: string,
		name: string,
		icon: string,
		color: string,
	) => Promise<void>;
	onDeleteFolder: (folderId: string) => void;
	onOpenItem: (itemId: string) => void;
	onOpenEditor: (itemId: string) => void;
	onOpenSetup: (itemId: string) => void;
	onDeleteItem: (itemId: string) => void;
	onMoveToFolder: (itemId: string, folderId: string) => void;
	items: DashboardListItem[];
};

export function Sidebar({
	isSidebarOpen,
	activeSection,
	setActiveSection,
	expandedFolders,
	toggleFolder,
	folders,
	allFolders,
	onCreateFolder,
	onEditFolder,
	onDeleteFolder,
	onOpenItem,
	onOpenEditor,
	onOpenSetup,
	onDeleteItem,
	onMoveToFolder,
	items,
}: SidebarProps) {
	const {user, logout} = useAuth();
	const [folderModal, setFolderModal] = useState<
		| {open: false}
		| {
				open: true;
				mode: "create";
				initialName?: undefined;
				initialIcon?: undefined;
				initialColor?: undefined;
		  }
		| {
				open: true;
				mode: "edit";
				folderId: string;
				initialName: string;
				initialIcon: string;
				initialColor: string;
		  }
	>({open: false});
	const [folderPendingDelete, setFolderPendingDelete] =
		useState<DashboardFolder | null>(null);
	const [unitPendingDelete, setUnitPendingDelete] = useState<{
		id: string;
		title: string;
	} | null>(null);
	const settingsItems: Array<{
		id: DashboardSection;
		label: string;
		icon: typeof CreditCard;
	}> = [
		{id: "subscription", icon: CreditCard, label: "Subscription & Credits"},
		{id: "profile", icon: User, label: "Profile"},
		{id: "security", icon: Lock, label: "Security"},
		{id: "preferences", icon: Palette, label: "Preferences"},
		{id: "analytics", icon: BarChart3, label: "Usage & Analytics"},
	];
	const initials =
		user?.displayName
			.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() ?? "DU";
	const [pictureFailed, setPictureFailed] = useState(false);

	return (
		<>
			<motion.aside
				initial={false}
				animate={{width: isSidebarOpen ? 280 : 80}}
				transition={{type: "spring", stiffness: 300, damping: 30}}
				className="z-20 flex min-h-screen flex-col overflow-hidden border-r border-[#E5E5E7] bg-white"
			>
				<div
					className={`flex shrink-0 items-center p-6 ${
						isSidebarOpen ?
							"justify-between gap-3"
						:	"justify-center"
					}`}
				>
					{isSidebarOpen ?
						<img
							src="/assets/logos/logo-horizontal.png"
							alt="Didactio"
							className="h-10 w-auto object-contain"
						/>
					:	<img
							src="/assets/logos/logo.png"
							alt="Didactio"
							className="h-10 w-10 object-contain"
						/>
					}
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
								<div
									className={`group flex items-center rounded-[10px] text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F] ${!isSidebarOpen ? "justify-center" : ""}`}
								>
									<button
										type="button"
										onClick={() => toggleFolder(folder.id)}
										className={`flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5 ${!isSidebarOpen ? "justify-center" : ""}`}
									>
										{isSidebarOpen ?
											<>
												{(
													expandedFolders.includes(
														folder.id,
													)
												) ?
													<ChevronDown
														size={14}
														className="shrink-0 text-[#86868B]"
													/>
												:	<ChevronRight
														size={14}
														className="shrink-0 text-[#86868B]"
													/>
												}
												<span className="text-lg leading-none shrink-0">
													{getFolderEmoji(
														folder.icon,
													)}
												</span>
												<span className="flex-1 truncate text-left text-[14px] font-medium">
													{folder.name}
												</span>
												<span className="text-[12px] text-[#86868B] tabular-nums">
													{folder.unitCount}
												</span>
											</>
										:	<span className="text-lg leading-none">
												{getFolderEmoji(folder.icon)}
											</span>
										}
									</button>

									{isSidebarOpen && (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													onClick={(e) =>
														e.stopPropagation()
													}
													className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#E5E5E7] group-hover:opacity-100 data-[state=open]:opacity-100"
												>
													<MoreHorizontal size={13} />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												side="right"
												align="start"
											>
												<DropdownMenuItem
													onSelect={() =>
														setFolderModal({
															open: true,
															mode: "edit",
															folderId: folder.id,
															initialName:
																folder.name,
															initialIcon:
																folder.icon,
															initialColor:
																folder.color ??
																"#6B7280",
														})
													}
												>
													<FolderPen />
													Edit Folder
												</DropdownMenuItem>
												{folder.slug !== "general" && (
													<>
														<DropdownMenuSeparator />
														<DropdownMenuItem
															destructive
															onSelect={() =>
																setFolderPendingDelete(
																	folder,
																)
															}
														>
															<Trash2 />
															Remove Folder
														</DropdownMenuItem>
													</>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</div>

								{isSidebarOpen &&
									expandedFolders.includes(folder.id) && (
										<div className="ml-8 mt-1 space-y-0.5">
											{folder.units.map((unitId) => {
												const unit = items.find(
													(entry) =>
														entry.id === unitId,
												);

												if (!unit) {
													return null;
												}

												const moveTargetFolders =
													getMoveTargetFolders(
														allFolders,
														unit.folder,
													);

												return (
													<div
														key={unitId}
														className="group flex items-center gap-1 rounded-[6px] px-3 py-1.5 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]"
													>
														<button
															type="button"
															onClick={() =>
																onOpenItem(
																	unitId,
																)
															}
															className="min-w-0 flex-1 text-left"
														>
															{unit.title}
														</button>

														<DropdownMenu>
															<DropdownMenuTrigger
																asChild
															>
																<button
																	type="button"
																	onClick={(
																		e,
																	) =>
																		e.stopPropagation()
																	}
																	className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity hover:bg-[#E5E5E7] group-hover:opacity-100 data-[state=open]:opacity-100"
																>
																	<MoreHorizontal
																		size={
																			13
																		}
																	/>
																</button>
															</DropdownMenuTrigger>
															<DropdownMenuContent
																side="right"
																align="start"
															>
																{(
																	unit.canOpenEditor
																) ?
																	<DropdownMenuItem
																		onSelect={() =>
																			onOpenEditor(
																				unitId,
																			)
																		}
																	>
																		<PenLine />
																		Open
																		editor
																	</DropdownMenuItem>
																:	<DropdownMenuItem
																		onSelect={() =>
																			onOpenSetup(
																				unitId,
																			)
																		}
																	>
																		<Settings2 />
																		Open
																		Setup
																	</DropdownMenuItem>
																}
																{moveTargetFolders.length >
																	0 && (
																	<DropdownMenuSub>
																		<DropdownMenuSubTrigger>
																			<FolderInput />
																			Move
																			to
																			folder
																		</DropdownMenuSubTrigger>
																		<DropdownMenuSubContent>
																			{moveTargetFolders.map(
																				(
																					folder,
																				) => (
																					<DropdownMenuItem
																						key={
																							folder.id
																						}
																						onSelect={() =>
																							onMoveToFolder(
																								unitId,
																								folder.id,
																							)
																						}
																					>
																						<span>
																							{getFolderEmoji(
																								folder.icon,
																							)}
																						</span>
																						{
																							folder.name
																						}
																					</DropdownMenuItem>
																				),
																			)}
																		</DropdownMenuSubContent>
																	</DropdownMenuSub>
																)}
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	destructive
																	onSelect={() => {
																		const unit =
																			items.find(
																				(
																					e,
																				) =>
																					e.id ===
																					unitId,
																			);
																		setUnitPendingDelete(
																			{
																				id: unitId,
																				title:
																					unit?.title ??
																					"",
																			},
																		);
																	}}
																>
																	<Trash2 />
																	Remove unit
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</div>
												);
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
							<button
								type="button"
								onClick={() =>
									setFolderModal({open: true, mode: "create"})
								}
								className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]"
							>
								<Plus size={16} />
								<span>Create Folder</span>
							</button>
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
									activeSection === item.id ?
										"bg-[#F5F5F7] text-[#1D1D1F]"
									:	"text-[#86868B] hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]"
								} ${!isSidebarOpen ? "justify-center" : ""}`}
							>
								<item.icon size={18} />
								{isSidebarOpen && (
									<span className="text-[14px] font-medium">
										{item.label}
									</span>
								)}
							</button>
						))}
					</div>
				</div>

				<div className="shrink-0 border-t border-[#E5E5E7] p-4">
					{isSidebarOpen ?
						<div className="flex items-center gap-3">
							{user?.pictureUrl && !pictureFailed ?
								<img
									src={user.pictureUrl}
									alt={user.displayName}
									referrerPolicy="no-referrer"
									onError={() => setPictureFailed(true)}
									className="h-9 w-9 rounded-full object-cover"
								/>
							:	<div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] to-[#2D8F4B] text-sm font-semibold text-white">
									{initials}
								</div>
							}
							<div className="min-w-0 flex-1">
								<div className="truncate text-[13px] font-semibold text-[#1D1D1F]">
									{user?.displayName ?? "Didactio User"}
								</div>
								<div className="text-[11px] text-[#86868B]">
									{user?.email ?? "Signed in with Google"}
								</div>
							</div>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="rounded-lg p-1 transition-all hover:bg-[#F5F5F7]"
									>
										<MoreVertical
											size={16}
											className="text-[#86868B]"
										/>
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent side="top" align="end">
									<DropdownMenuItem
										onSelect={() => {
											void logout();
										}}
									>
										<LogOut />
										Sign out
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					:	(user?.pictureUrl && !pictureFailed ?
							<img
								src={user.pictureUrl}
								alt={user.displayName}
								referrerPolicy="no-referrer"
								onError={() => setPictureFailed(true)}
								className="mx-auto h-9 w-9 rounded-full object-cover"
							/>
						:	<div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#4ADE80] to-[#2D8F4B] text-sm font-semibold text-white">
								{initials}
							</div>)
					}
				</div>
			</motion.aside>

			<FolderFormModal
				open={folderModal.open}
				mode={folderModal.open ? folderModal.mode : "create"}
				initialName={
					folderModal.open ? folderModal.initialName : undefined
				}
				initialIcon={
					folderModal.open ?
						folderModal.initialIcon ?
							getFolderEmoji(folderModal.initialIcon)
						:	"📁"
					:	undefined
				}
				initialColor={
					folderModal.open && folderModal.mode === "edit" ?
						folderModal.initialColor
					:	undefined
				}
				onClose={() => setFolderModal({open: false})}
				onSubmit={async (name, icon, color) => {
					if (folderModal.open && folderModal.mode === "edit") {
						await onEditFolder(
							folderModal.folderId,
							name,
							icon,
							color,
						);
					} else {
						await onCreateFolder(name, icon, color);
					}
				}}
			/>

			<AlertDialog
				open={folderPendingDelete !== null}
				onOpenChange={(open: boolean) => {
					if (!open) setFolderPendingDelete(null);
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
								if (folderPendingDelete) {
									onDeleteFolder(folderPendingDelete.id);
									setFolderPendingDelete(null);
								}
							}}
						>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={unitPendingDelete !== null}
				onOpenChange={(open: boolean) => {
					if (!open) setUnitPendingDelete(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove unit?</AlertDialogTitle>
						<AlertDialogDescription>
							<strong className="font-medium text-[#1D1D1F]">
								{unitPendingDelete?.title}
							</strong>{" "}
							will be permanently removed. This action cannot be
							undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-red-500 hover:bg-red-600 focus-visible:ring-red-500"
							onClick={() => {
								if (unitPendingDelete) {
									onDeleteItem(unitPendingDelete.id);
									setUnitPendingDelete(null);
								}
							}}
						>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
