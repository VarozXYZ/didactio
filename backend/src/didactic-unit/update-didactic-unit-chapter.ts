import type {DidacticUnit} from "./create-didactic-unit.js";
import type {
	DidacticUnitGeneratedChapter,
	UpdateDidacticUnitChapterInput,
} from "./didactic-unit-chapter.js";
import {
	createCanonicalDidacticUnitChapter,
	createDidacticUnitChapterRevision,
} from "./didactic-unit-chapter.js";
import {resetDidacticUnitModuleReadProgress} from "./module-reading-progress.js";

export function updateDidacticUnitChapter(
	didacticUnit: DidacticUnit,
	chapterIndex: number,
	input: UpdateDidacticUnitChapterInput,
): DidacticUnit {
	const generatedChapters = didacticUnit.generatedChapters ?? [];
	const existingChapterIndex = generatedChapters.findIndex(
		(chapter) => chapter.chapterIndex === chapterIndex,
	);

	if (existingChapterIndex < 0) {
		throw new Error("Generated didactic unit chapter not found.");
	}

	const currentChapter = generatedChapters[existingChapterIndex];
	if (
		input.chapter.htmlHash &&
		input.chapter.htmlHash !== currentChapter.htmlHash
	) {
		throw new Error("Chapter was updated elsewhere. Reload before saving.");
	}

	const updatedAt = new Date().toISOString();
	const updatedChapter: DidacticUnitGeneratedChapter =
		createCanonicalDidacticUnitChapter({
			chapterIndex,
			chapterId: `${didacticUnit.id}:${chapterIndex}`,
			generatedAt: currentChapter.generatedAt,
			updatedAt,
			rawHtml: input.chapter.html,
			title: input.chapter.title,
		});

	if (
		updatedChapter.title === currentChapter.title &&
		updatedChapter.htmlHash === currentChapter.htmlHash
	) {
		return didacticUnit;
	}

	const nextChapter: DidacticUnitGeneratedChapter = updatedChapter;

	const updatedChapters = [...generatedChapters];
	updatedChapters[existingChapterIndex] = nextChapter;

	return resetDidacticUnitModuleReadProgress(
		{
			...didacticUnit,
			chapterRevisions: [
				...(didacticUnit.chapterRevisions ?? []),
				createDidacticUnitChapterRevision({
					chapterIndex,
					source: "manual_edit",
					chapter: nextChapter,
				}),
			],
			generatedChapters: updatedChapters,
			updatedAt,
		},
		chapterIndex,
	);
}
