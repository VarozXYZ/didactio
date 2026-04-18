import type {DidacticUnit} from "./create-didactic-unit.js";
import type {DidacticUnitFolderSelectionInput} from "./planning.js";

export function updateDidacticUnitFolder(
	didacticUnit: DidacticUnit,
	folderSelection: DidacticUnitFolderSelectionInput,
): DidacticUnit {
	return {
		...didacticUnit,
		folderId: folderSelection.folderId ?? didacticUnit.folderId,
		folderAssignmentMode: folderSelection.mode,
		updatedAt: new Date().toISOString(),
	};
}
