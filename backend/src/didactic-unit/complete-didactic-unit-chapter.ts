import type {DidacticUnit} from "./create-didactic-unit.js";
import {
	completeDidacticUnitModuleReadProgress,
	getModuleTotalBlockCount,
} from "./module-reading-progress.js";

export function completeDidacticUnitChapter(
	didacticUnit: DidacticUnit,
	chapterIndex: number,
): DidacticUnit {
	const totalBlockCount = getModuleTotalBlockCount(
		didacticUnit,
		chapterIndex,
	);

	if (totalBlockCount === 0) {
		throw new Error("Generated didactic unit module not found.");
	}

	return completeDidacticUnitModuleReadProgress(didacticUnit, chapterIndex);
}
