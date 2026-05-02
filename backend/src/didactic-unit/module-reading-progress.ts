import type {DidacticUnit} from "./create-didactic-unit.js";
import type {DidacticUnitGeneratedChapter} from "./didactic-unit-chapter.js";

export interface DidacticUnitModuleReadProgress {
	moduleIndex: number;
	furthestReadBlockIndex: number;
	furthestReadBlockOffset?: number;
	furthestReadBlocksVersion: number;
	recordedTotalBlocks: number;
	chapterCompleted: boolean;
	lastVisitedPageIndex?: number;
	lastReadAt: string;
	lastVisitedAt?: string;
}

export function getGeneratedModule(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): DidacticUnitGeneratedChapter | undefined {
	return didacticUnit.generatedChapters?.find(
		(generatedChapter) => generatedChapter.chapterIndex === moduleIndex,
	);
}

export function getModuleTotalBlockCount(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): number {
	return getGeneratedModule(didacticUnit, moduleIndex)?.htmlBlocks.length ?? 0;
}

export function getModuleReadProgressRecord(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): DidacticUnitModuleReadProgress | undefined {
	return didacticUnit.moduleReadProgress?.find(
		(progress) => progress.moduleIndex === moduleIndex,
	);
}

export function remapProgressToCurrentBlocks(
	progress: DidacticUnitModuleReadProgress | undefined,
	generatedModule: DidacticUnitGeneratedChapter | undefined,
): DidacticUnitModuleReadProgress | undefined {
	if (!progress || !generatedModule) {
		return progress;
	}

	const currentTotalBlocks = generatedModule.htmlBlocks.length;
	if (
		progress.furthestReadBlocksVersion ===
			generatedModule.htmlBlocksVersion &&
		progress.recordedTotalBlocks === currentTotalBlocks
	) {
		return progress;
	}

	const oldTotalBlocks = Math.max(1, progress.recordedTotalBlocks);
	const newIndex =
		currentTotalBlocks === 0 ? 0
		: Math.min(
				currentTotalBlocks - 1,
				Math.round(
					(progress.furthestReadBlockIndex / oldTotalBlocks) *
						currentTotalBlocks,
				),
			);

	return {
		...progress,
		furthestReadBlockIndex: newIndex,
		furthestReadBlockOffset: undefined,
		furthestReadBlocksVersion: generatedModule.htmlBlocksVersion,
		recordedTotalBlocks: currentTotalBlocks,
		lastVisitedPageIndex: undefined,
	};
}

export function progressPercentage(
	progress: DidacticUnitModuleReadProgress | undefined,
	totalBlocks: number,
	currentBlockTextLength: number,
): number {
	if (!progress) {
		return 0;
	}

	if (progress.chapterCompleted) {
		return 1;
	}

	if (totalBlocks === 0) {
		return 0;
	}

	const blockFraction =
		progress.furthestReadBlockOffset != null && currentBlockTextLength > 0 ?
			progress.furthestReadBlockOffset / currentBlockTextLength
		:	0;

	return Math.min(
		(progress.furthestReadBlockIndex + blockFraction) / totalBlocks,
		0.99,
	);
}

export function getModuleReadBlockCount(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): number {
	const generatedModule = getGeneratedModule(didacticUnit, moduleIndex);
	const progress = remapProgressToCurrentBlocks(
		getModuleReadProgressRecord(didacticUnit, moduleIndex),
		generatedModule,
	);

	if (!generatedModule || !progress) {
		return 0;
	}

	if (progress.chapterCompleted) {
		return generatedModule.htmlBlocks.length;
	}

	return Math.min(
		generatedModule.htmlBlocks.length,
		progress.furthestReadBlockIndex + 1,
	);
}

export function updateDidacticUnitModuleReadProgress(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
	requestedReadBlockIndex: number,
	requestedLastVisitedPageIndex?: number,
	requestedReadBlockOffset?: number,
): DidacticUnit {
	const generatedModule = getGeneratedModule(didacticUnit, moduleIndex);

	if (!generatedModule) {
		throw new Error("Generated didactic unit module not found.");
	}

	const totalBlocks = generatedModule.htmlBlocks.length;
	if (totalBlocks === 0) {
		throw new Error("Generated didactic unit module not found.");
	}

	const clampedRequestedBlockIndex = Math.max(
		0,
		Math.min(totalBlocks - 1, Math.floor(requestedReadBlockIndex)),
	);
	const existingProgress = remapProgressToCurrentBlocks(
		getModuleReadProgressRecord(didacticUnit, moduleIndex),
		generatedModule,
	);
	const previousBlockIndex = existingProgress?.furthestReadBlockIndex ?? 0;
	const nextBlockIndex = Math.max(
		previousBlockIndex,
		clampedRequestedBlockIndex,
	);
	const nextBlockOffset =
		nextBlockIndex === previousBlockIndex ?
			Math.max(
				existingProgress?.furthestReadBlockOffset ?? 0,
				requestedReadBlockOffset ?? 0,
			)
		:	requestedReadBlockOffset;
	const nextLastVisitedPageIndex =
		requestedLastVisitedPageIndex ?? existingProgress?.lastVisitedPageIndex;
	const chapterCompleted = existingProgress?.chapterCompleted ?? false;
	const didReadAdvance = nextBlockIndex > previousBlockIndex;
	const didLastVisitedPageChange =
		nextLastVisitedPageIndex !== existingProgress?.lastVisitedPageIndex;

	if (
		existingProgress &&
		existingProgress.furthestReadBlockIndex === nextBlockIndex &&
		existingProgress.furthestReadBlockOffset === nextBlockOffset &&
		!didLastVisitedPageChange
	) {
		return didacticUnit;
	}

	const updatedAt = new Date().toISOString();
	const nextModuleReadProgress = [
		...(didacticUnit.moduleReadProgress ?? []).filter(
			(progress) => progress.moduleIndex !== moduleIndex,
		),
		{
			moduleIndex,
			furthestReadBlockIndex: nextBlockIndex,
			furthestReadBlockOffset: nextBlockOffset,
			furthestReadBlocksVersion: generatedModule.htmlBlocksVersion,
			recordedTotalBlocks: totalBlocks,
			chapterCompleted: Boolean(chapterCompleted),
			lastReadAt:
				didReadAdvance || !existingProgress ?
					updatedAt
				:	existingProgress.lastReadAt,
			lastVisitedPageIndex: nextLastVisitedPageIndex,
			lastVisitedAt:
				requestedLastVisitedPageIndex !== undefined ?
					updatedAt
				:	existingProgress?.lastVisitedAt,
		},
	].sort((left, right) => left.moduleIndex - right.moduleIndex);

	return {
		...didacticUnit,
		moduleReadProgress: nextModuleReadProgress,
		updatedAt,
	};
}

export function completeDidacticUnitModuleReadProgress(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): DidacticUnit {
	const generatedModule = getGeneratedModule(didacticUnit, moduleIndex);

	if (!generatedModule || generatedModule.htmlBlocks.length === 0) {
		throw new Error("Generated didactic unit module not found.");
	}

	const existingProgress = remapProgressToCurrentBlocks(
		getModuleReadProgressRecord(didacticUnit, moduleIndex),
		generatedModule,
	);
	const updatedAt = new Date().toISOString();
	const totalBlocks = generatedModule.htmlBlocks.length;
	const nextModuleReadProgress = [
		...(didacticUnit.moduleReadProgress ?? []).filter(
			(progress) => progress.moduleIndex !== moduleIndex,
		),
		{
			moduleIndex,
			furthestReadBlockIndex: totalBlocks - 1,
			furthestReadBlockOffset:
				generatedModule.htmlBlocks.at(-1)?.textLength ?? 0,
			furthestReadBlocksVersion: generatedModule.htmlBlocksVersion,
			recordedTotalBlocks: totalBlocks,
			chapterCompleted: true,
			lastReadAt: updatedAt,
			lastVisitedPageIndex: existingProgress?.lastVisitedPageIndex,
			lastVisitedAt: existingProgress?.lastVisitedAt,
		},
	].sort((left, right) => left.moduleIndex - right.moduleIndex);

	return {
		...didacticUnit,
		moduleReadProgress: nextModuleReadProgress,
		updatedAt,
	};
}

export function resetDidacticUnitModuleReadProgress(
	didacticUnit: DidacticUnit,
	moduleIndex: number,
): DidacticUnit {
	const nextModuleReadProgress = (
		didacticUnit.moduleReadProgress ?? []
	).filter((progress) => progress.moduleIndex !== moduleIndex);

	if (
		nextModuleReadProgress.length ===
		(didacticUnit.moduleReadProgress ?? []).length
	) {
		return didacticUnit;
	}

	return {
		...didacticUnit,
		moduleReadProgress: nextModuleReadProgress,
	};
}
