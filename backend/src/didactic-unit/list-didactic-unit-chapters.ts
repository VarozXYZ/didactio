import type {DidacticUnit} from "./create-didactic-unit.js";
import {
	getModuleReadProgressRecord,
	getModuleTotalBlockCount,
} from "./module-reading-progress.js";

export interface DidacticUnitChapterSummary {
	chapterIndex: number;
	title: string;
	overview: string;
	hasGeneratedContent: boolean;
	readBlockIndex: number;
	readBlockOffset?: number;
	readBlocksVersion: number;
	totalBlocks: number;
	isCompleted: boolean;
	generatedAt?: string;
	updatedAt?: string;
	completedAt?: string;
	lastVisitedPageIndex?: number;
}

export function listDidacticUnitChapters(
	didacticUnit: DidacticUnit,
): DidacticUnitChapterSummary[] {
	return didacticUnit.chapters.map((chapter, chapterIndex) => {
		const generatedChapter = didacticUnit.generatedChapters?.find(
			(candidate) => candidate.chapterIndex === chapterIndex,
		);
		const readProgress = getModuleReadProgressRecord(
			didacticUnit,
			chapterIndex,
		);
		const isCompleted = readProgress?.chapterCompleted ?? false;
		const completedAt = isCompleted ? readProgress?.lastReadAt : undefined;

		return {
			chapterIndex,
			title: chapter.title,
			overview: chapter.overview,
			hasGeneratedContent: generatedChapter !== undefined,
			readBlockIndex: readProgress?.furthestReadBlockIndex ?? 0,
			readBlockOffset: readProgress?.furthestReadBlockOffset,
			readBlocksVersion: readProgress?.furthestReadBlocksVersion ?? 0,
			totalBlocks: getModuleTotalBlockCount(didacticUnit, chapterIndex),
			isCompleted,
			generatedAt: generatedChapter?.generatedAt,
			updatedAt: generatedChapter?.updatedAt,
			completedAt,
			lastVisitedPageIndex: readProgress?.lastVisitedPageIndex,
		};
	});
}
