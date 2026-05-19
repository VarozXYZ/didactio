import {
	FolderInput,
	MoreHorizontal,
	PenLine,
	Settings2,
	Trash2,
} from "lucide-react";
import {useState} from "react";
import type {BackendFolder} from "../../../api/dashboardApi";
import type {DashboardListItem} from "../../../types";
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
import {getFolderEmoji, getFolderVisuals} from "../../../utils/folderDisplay";
import {getProviderLogo} from "../../../utils/modelOptions";
import {LengthBadge} from "./LengthBadge";

type UnitCardProps = {
	allFolders: BackendFolder[];
	onOpenItem: (itemId: string) => void;
	onOpenEditor: (itemId: string) => void;
	onOpenSetup: (itemId: string) => Promise<void>;
	onDeleteItem: (itemId: string) => Promise<void>;
	onMoveToFolder: (itemId: string, folderId: string) => Promise<void>;
	unit: DashboardListItem;
};

export function UnitCard({
	allFolders,
	onDeleteItem,
	onMoveToFolder,
	onOpenEditor,
	onOpenItem,
	onOpenSetup,
	unit,
}: UnitCardProps) {
	const style = getFolderVisuals(unit.folder);
	const folderEmoji = getFolderEmoji(unit.folder.icon);
	const modelLogo = getProviderLogo(unit.modelUsed?.provider);
	const handleOpenItem = () => onOpenItem(unit.id);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	return (
		<>
			<div className="group">
				<div className="relative overflow-hidden rounded-2xl border border-[#E5E5E7] bg-white transition-all duration-300 hover:border-[#4ADE80] hover:shadow-lg">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="absolute right-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/85 opacity-0 shadow-sm backdrop-blur-md transition-all hover:bg-white group-hover:opacity-100 data-[state=open]:bg-white data-[state=open]:opacity-100"
								aria-label="Unit actions"
							>
								<MoreHorizontal
									size={16}
									className="text-[#86868B]"
								/>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent side="left" align="end">
							{unit.canOpenEditor ?
								<DropdownMenuItem
									onSelect={() => onOpenEditor(unit.id)}
								>
									<PenLine />
									Open editor
								</DropdownMenuItem>
							:	<DropdownMenuItem
									onSelect={() => onOpenSetup(unit.id)}
								>
									<Settings2 />
									Open Setup
								</DropdownMenuItem>
							}

							{allFolders.filter((f) => f.id !== unit.folder.id)
								.length > 0 && (
								<DropdownMenuSub>
									<DropdownMenuSubTrigger>
										<FolderInput />
										Move to folder
									</DropdownMenuSubTrigger>
									<DropdownMenuSubContent>
										{allFolders
											.filter(
												(f) => f.id !== unit.folder.id,
											)
											.map((folder) => (
												<DropdownMenuItem
													key={folder.id}
													onSelect={() =>
														onMoveToFolder(
															unit.id,
															folder.id,
														)
													}
												>
													<span>
														{getFolderEmoji(
															folder.icon,
														)}
													</span>
													{folder.name}
												</DropdownMenuItem>
											))}
									</DropdownMenuSubContent>
								</DropdownMenuSub>
							)}

							<DropdownMenuSeparator />
							<DropdownMenuItem
								destructive
								onSelect={() => setShowDeleteDialog(true)}
							>
								<Trash2 />
								Remove unit
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<button
						type="button"
						onClick={handleOpenItem}
						className="block w-full text-left"
					>
						<div
							className="relative flex h-[180px] items-center justify-center"
							style={{backgroundColor: style.bgColor}}
						>
							<span
								className="select-none text-[72px] leading-none"
								style={{opacity: 0.4}}
							>
								{folderEmoji}
							</span>

							<div
								className="absolute right-0 top-0 h-32 w-32 rounded-bl-full opacity-10"
								style={{backgroundColor: style.accentColor}}
							/>

							{unit.status === "generating" && (
								<div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 backdrop-blur-sm">
									<div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
									Setup in progress
								</div>
							)}

							{unit.canOpenEditor ?
								<div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5">
									<div
										className="h-full transition-all"
										style={{
											width: `${unit.primaryProgressPercent}%`,
											backgroundColor: "#4ADE80",
										}}
									/>
								</div>
							:	null}
						</div>
					</button>

					<div className="px-5 py-5">
						<button
							type="button"
							onClick={handleOpenItem}
							className="flex min-h-[82px] w-full items-center justify-center text-center"
						>
							<h3 className="line-clamp-3 max-w-[92%] text-[16px] font-semibold leading-snug text-[#1D1D1F] transition-colors group-hover:text-[#4ADE80]">
								{unit.title}
							</h3>
						</button>

						<button
							type="button"
							onClick={handleOpenItem}
							className="mt-3 block w-full text-left"
						>
							<div className="flex min-w-0 items-center gap-2 text-[11px] text-[#86868B]">
								<span
									className="inline-flex w-fit min-w-0 max-w-[52%] shrink items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
									style={{
										backgroundColor: style.bgColor,
										color: style.iconColor,
									}}
								>
									<span className="text-[10px] leading-none">
										{folderEmoji}
									</span>
									<span className="truncate">
										{unit.folder.name}
									</span>
								</span>
								{unit.canOpenEditor && (
									<LengthBadge length={unit.length} />
								)}
								<span className="flex-1" />
								{modelLogo ?
									<img
										src={modelLogo}
										alt={
											unit.modelUsed?.label ??
											"Model used"
										}
										title={unit.modelUsed?.label}
										className="h-5 w-5 shrink-0 rounded-full object-contain"
									/>
								:	<span className="shrink-0 text-[11px] font-medium text-[#AEAEB2]">
										No model
									</span>
								}
								{unit.canOpenEditor ?
									<div className="shrink-0 font-semibold text-[#4ADE80]">
										{unit.primaryProgressPercent}%
									</div>
								:	<span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#E5E5E7] bg-white/70 px-2 py-1 text-[11px] font-medium leading-tight text-[#6E6E73]">
										<span className="h-1.5 w-1.5 rounded-full bg-amber-500/80" />
										Setup needed
									</span>
								}
							</div>
						</button>
					</div>
				</div>
			</div>

			<AlertDialog
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove unit?</AlertDialogTitle>
						<AlertDialogDescription>
							<strong className="font-medium text-[#1D1D1F]">
								{unit.title}
							</strong>{" "}
							will be permanently removed. This action cannot be
							undone.
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
	);
}
