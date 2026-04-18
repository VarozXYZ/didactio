import {UnitCard} from "./UnitCard";
import type {BackendFolder} from "../../../api/dashboardApi";
import type {DashboardListItem} from "../../../types";

type UnitsGridProps = {
	allFolders: BackendFolder[];
	onOpenItem: (itemId: string) => void;
	onOpenEditor: (itemId: string) => void;
	onOpenSetup: (itemId: string) => Promise<void>;
	onDeleteItem: (itemId: string) => Promise<void>;
	onMoveToFolder: (itemId: string, folderId: string) => Promise<void>;
	units: DashboardListItem[];
};

export function UnitsGrid({
	allFolders,
	onDeleteItem,
	onMoveToFolder,
	onOpenEditor,
	onOpenItem,
	onOpenSetup,
	units,
}: UnitsGridProps) {
	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{units.map((unit) => (
				<UnitCard
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
	);
}
