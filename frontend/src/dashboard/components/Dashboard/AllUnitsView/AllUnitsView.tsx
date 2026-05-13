import {BookOpen, Grid3x3, List, Search} from "lucide-react";
import {AllUnitsHeader, CreateUnitButton} from "./AllUnitsHeader";
import {UnitsGrid} from "./UnitsGrid";
import {UnitsTable} from "./UnitsTable";
import type {BackendFolder} from "../../../api/dashboardApi";
import type {DashboardListItem} from "../../../types";

type AllUnitsViewProps = {
	filteredUnits: DashboardListItem[];
	allFolders: BackendFolder[];
	searchQuery: string;
	setSearchQuery: (value: string) => void;
	viewMode: "grid" | "list";
	setViewMode: (value: "grid" | "list") => void;
	totalUnits: number;
	folderCount: number;
	averageProgress: number;
	onOpenItem: (itemId: string) => void;
	onOpenEditor: (itemId: string) => void;
	onOpenSetup: (itemId: string) => Promise<void>;
	onDeleteItem: (itemId: string) => Promise<void>;
	onMoveToFolder: (itemId: string, folderId: string) => Promise<void>;
	onCreateUnit: () => void;
};

export function AllUnitsView({
	filteredUnits,
	allFolders,
	searchQuery,
	setSearchQuery,
	viewMode,
	setViewMode,
	totalUnits,
	folderCount,
	averageProgress,
	onOpenItem,
	onOpenEditor,
	onOpenSetup,
	onDeleteItem,
	onMoveToFolder,
	onCreateUnit,
}: AllUnitsViewProps) {
	void totalUnits;
	void folderCount;
	void averageProgress;

	return (
		<div className="flex min-w-0 flex-1 flex-col">
			<AllUnitsHeader
				filteredUnitsCount={filteredUnits.length}
				onCreateUnit={onCreateUnit}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto bg-[#F5F5F7] p-8">
				<div className="mx-auto w-full max-w-[1560px]">
					<div className="mb-6 flex items-center justify-between gap-4">
						<div className="relative">
							<Search
								size={16}
								className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]"
							/>
							<input
								type="text"
								placeholder="Search units..."
								value={searchQuery}
								onChange={(event) =>
									setSearchQuery(event.target.value)
								}
								className="w-[280px] rounded-2xl border border-[#D9D9D9] bg-white py-3 pl-11 pr-4 text-[14px] text-[#1D1D1F] shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-all focus:border-[#4ADE80] focus:outline-none md:w-[320px]"
							/>
						</div>

						<div className="flex items-center gap-1 rounded-[10px] border border-[#D9D9D9] bg-white p-1 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
							<button
								type="button"
								onClick={() => setViewMode("grid")}
								className={`rounded-[8px] p-2.5 transition-all ${
									viewMode === "grid" ?
										"bg-[#F5F5F7] text-[#1D1D1F]"
									:	"text-[#86868B] hover:text-[#1D1D1F]"
								}`}
							>
								<Grid3x3 size={16} />
							</button>
							<button
								type="button"
								onClick={() => setViewMode("list")}
								className={`rounded-[8px] p-2.5 transition-all ${
									viewMode === "list" ?
										"bg-[#F5F5F7] text-[#1D1D1F]"
									:	"text-[#86868B] hover:text-[#1D1D1F]"
								}`}
							>
								<List size={16} />
							</button>
						</div>
					</div>

					{filteredUnits.length === 0 ?
						<div className="flex flex-col items-center justify-center py-24 text-center">
							<div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
								<BookOpen size={28} className="text-[#86868B]" />
							</div>
							{searchQuery ?
								<>
									<p className="text-[17px] font-semibold text-[#1D1D1F]">No results for &ldquo;{searchQuery}&rdquo;</p>
									<p className="mt-1 text-[14px] text-[#86868B]">Try a different search term.</p>
								</>
							:	<>
									<p className="text-[17px] font-semibold text-[#1D1D1F]">Your library is empty</p>
									<p className="mt-1 max-w-xs text-[14px] text-[#86868B]">Create your first unit to start building your personal learning library.</p>
									<div className="mt-5">
										<CreateUnitButton onClick={onCreateUnit} label="Create your first unit" />
									</div>
								</>
							}
						</div>
					: viewMode === "grid" ?
						<UnitsGrid
							allFolders={allFolders}
							onDeleteItem={onDeleteItem}
							onMoveToFolder={onMoveToFolder}
							onOpenEditor={onOpenEditor}
							onOpenItem={onOpenItem}
							onOpenSetup={onOpenSetup}
							units={filteredUnits}
						/>
					:	<UnitsTable
							allFolders={allFolders}
							onDeleteItem={onDeleteItem}
							onMoveToFolder={onMoveToFolder}
							onOpenEditor={onOpenEditor}
							onOpenItem={onOpenItem}
							onOpenSetup={onOpenSetup}
							units={filteredUnits}
						/>
					}
				</div>
			</div>
		</div>
	);
}
