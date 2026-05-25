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
import {LengthBadge} from "../AllUnitsView/LengthBadge";

type MobileUnitCardProps = {
	allFolders: BackendFolder[];
	onDeleteItem: (itemId: string) => Promise<void>;
	onMoveToFolder: (itemId: string, folderId: string) => Promise<void>;
	onOpenEditor: (itemId: string) => void;
	onOpenItem: (itemId: string) => void;
	onOpenSetup: (itemId: string) => Promise<void>;
	unit: DashboardListItem;
};

export function MobileUnitCard({
	allFolders,
	onDeleteItem,
	onMoveToFolder,
	onOpenEditor,
	onOpenItem,
	onOpenSetup,
	unit,
}: MobileUnitCardProps) {
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const style = getFolderVisuals(unit.folder);
	const folderEmoji = getFolderEmoji(unit.folder.icon);
	const modelLogo = getProviderLogo(unit.modelUsed?.provider);
	const moveTargetFolders = allFolders.filter(
		(folder) => folder.id !== unit.folder.id,
	);

	return (
		<>
			<article className="app-dashboard-card relative overflow-hidden rounded-[18px] border border-[#E1E1E4] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#6E6E73] shadow-sm backdrop-blur-md"
							aria-label="Unit actions"
						>
							<MoreHorizontal size={17} />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="left" align="start">
						{unit.canOpenEditor ?
							<DropdownMenuItem
								onSelect={() => onOpenEditor(unit.id)}
							>
								<PenLine />
								Open editor
							</DropdownMenuItem>
						:	<DropdownMenuItem
								onSelect={() => {
									void onOpenSetup(unit.id);
								}}
							>
								<Settings2 />
								Open Setup
							</DropdownMenuItem>
						}
						{moveTargetFolders.length > 0 && (
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<FolderInput />
									Move to folder
								</DropdownMenuSubTrigger>
								<DropdownMenuSubContent>
									{moveTargetFolders.map((folder) => (
										<DropdownMenuItem
											key={folder.id}
											onSelect={() => {
												void onMoveToFolder(
													unit.id,
													folder.id,
												);
											}}
										>
											<span>
												{getFolderEmoji(folder.icon)}
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
					onClick={() => onOpenItem(unit.id)}
					className="block w-full text-left"
				>
					<div
						className="relative flex aspect-[1.35] min-h-[116px] items-center justify-center overflow-hidden"
						style={{backgroundColor: style.bgColor}}
					>
						<div
							className="absolute right-0 top-0 h-24 w-24 rounded-bl-full opacity-20"
							style={{backgroundColor: style.accentColor}}
						/>
						<span
							className="select-none text-[58px] leading-none drop-shadow-sm"
							style={{opacity: 0.52}}
						>
							{folderEmoji}
						</span>
						{unit.canOpenEditor && (
							<div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#DDEFE5]">
								<div
									className="h-full bg-[#2ED866]"
									style={{
										width: `${unit.primaryProgressPercent}%`,
									}}
								/>
							</div>
						)}
					</div>

					<div className="flex min-h-[188px] flex-col px-3.5 pb-3.5 pt-3">
						<h3 className="line-clamp-3 text-[15px] font-bold leading-snug text-[#111113]">
							{unit.title}
						</h3>

						<div className="mt-3 flex flex-wrap items-center gap-1.5">
							<span
								className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase leading-none"
								style={{
									backgroundColor: style.bgColor,
									color: style.iconColor,
								}}
							>
								<span className="text-[11px] leading-none">
									{folderEmoji}
								</span>
								<span className="truncate">
									{unit.folder.name}
								</span>
							</span>
							{unit.canOpenEditor ?
								<LengthBadge
									length={unit.length}
									className="px-2.5 text-[10px]"
								/>
							:	<span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E7] bg-white px-2.5 py-1 text-[10px] font-semibold leading-none text-[#6E6E73]">
									<span className="h-1.5 w-1.5 rounded-full bg-[#FF9F0A]" />
									Setup needed
								</span>
							}
						</div>

						<div className="mt-auto flex items-end justify-between gap-2 pt-4">
							{unit.canOpenEditor ?
								<span className="text-[15px] font-bold text-[#00B84A]">
									{unit.primaryProgressPercent}%
								</span>
							:	<span className="text-[12px] font-semibold text-[#8E8E93]">
									Setup
								</span>
							}
							{modelLogo ?
								<img
									src={modelLogo}
									alt={unit.modelUsed?.label ?? "Model used"}
									title={unit.modelUsed?.label}
									className="h-5 w-5 rounded-full object-contain"
								/>
							:	<span className="text-[10px] font-semibold text-[#C7C7CC]">
									No model
								</span>
							}
						</div>
					</div>
				</button>
			</article>

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
							onClick={() => {
								void onDeleteItem(unit.id);
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
