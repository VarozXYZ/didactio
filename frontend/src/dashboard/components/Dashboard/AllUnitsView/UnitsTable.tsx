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
import {getMoveTargetFolders} from "../../../utils/folderTargets";

type UnitsTableProps = {
	allFolders: BackendFolder[];
	onOpenItem: (itemId: string) => void;
	onOpenEditor: (itemId: string) => void;
	onOpenSetup: (itemId: string) => Promise<void>;
	onDeleteItem: (itemId: string) => Promise<void>;
	onMoveToFolder: (itemId: string, folderId: string) => Promise<void>;
	units: DashboardListItem[];
};

export function UnitsTable({
	allFolders,
	onDeleteItem,
	onMoveToFolder,
	onOpenEditor,
	onOpenItem,
	onOpenSetup,
	units,
}: UnitsTableProps) {
	const [unitPendingDelete, setUnitPendingDelete] =
		useState<DashboardListItem | null>(null);

	return (
		<>
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
								Modules
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
							const style = getFolderVisuals(unit.folder);
							const folderEmoji = getFolderEmoji(
								unit.folder.icon,
							);
							const moveTargetFolders = getMoveTargetFolders(
								allFolders,
								unit.folder,
							);

							return (
								<tr
									key={unit.id}
									className={`transition-all hover:bg-[#F5F5F7]/50 ${
										index === units.length - 1 ?
											""
										:	"border-b border-[#E5E5E7]"
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
												style={{
													backgroundColor:
														style.bgColor,
												}}
											>
												<span className="text-[22px] leading-none">
													{folderEmoji}
												</span>
											</div>
											<div>
												<div className="text-[14px] font-semibold text-[#1D1D1F] transition-colors group-hover:text-[#4ADE80]">
													{unit.title}
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
											<span className="text-[11px] leading-none">
												{folderEmoji}
											</span>
											{unit.folder.name}
										</span>
									</td>
									<td className="px-6 py-4 text-[14px] text-[#1D1D1F]">
										{unit.chapterCount}
									</td>
									<td className="px-6 py-4">
										{unit.canOpenEditor ?
											<div className="flex items-center gap-3">
												<div className="h-2 max-w-[120px] flex-1 overflow-hidden rounded-full bg-[#F5F5F7]">
													<div
														className="h-full"
														style={{
															width: `${unit.primaryProgressPercent}%`,
															backgroundColor:
																style.accentColor,
														}}
													/>
												</div>
												<span className="min-w-[35px] text-[13px] font-semibold text-[#1D1D1F]">
													{
														unit.primaryProgressPercent
													}
													%
												</span>
											</div>
										:	<span className="inline-flex items-center gap-2 rounded-full border border-[#E5E5E7] bg-white/70 px-2 py-0.5 text-[11px] font-medium leading-none text-[#6E6E73]">
												<span className="h-1.5 w-1.5 rounded-full bg-amber-500/80" />
												Setup needed
											</span>
										}
									</td>
									<td className="px-6 py-4 text-[13px] text-[#86868B]">
										{unit.lastActivityAt}
									</td>
									<td className="px-6 py-4">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<button
													type="button"
													onClick={(e) =>
														e.stopPropagation()
													}
													className="rounded-lg p-2 transition-all hover:bg-[#F5F5F7]"
												>
													<MoreHorizontal
														size={16}
														className="text-[#86868B]"
													/>
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												side="left"
												align="end"
											>
												{unit.canOpenEditor ?
													<DropdownMenuItem
														onSelect={() =>
															onOpenEditor(
																unit.id,
															)
														}
													>
														<PenLine />
														Open editor
													</DropdownMenuItem>
												:	<DropdownMenuItem
														onSelect={() =>
															onOpenSetup(unit.id)
														}
													>
														<Settings2 />
														Open Setup
													</DropdownMenuItem>
												}

												{moveTargetFolders.length >
													0 && (
													<DropdownMenuSub>
														<DropdownMenuSubTrigger>
															<FolderInput />
															Move to folder
														</DropdownMenuSubTrigger>
														<DropdownMenuSubContent>
															{moveTargetFolders.map(
																(folder) => (
																	<DropdownMenuItem
																		key={
																			folder.id
																		}
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
													onSelect={() =>
														setUnitPendingDelete(
															unit,
														)
													}
												>
													<Trash2 />
													Remove unit
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

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
