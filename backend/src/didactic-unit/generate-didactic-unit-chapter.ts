import type {
	ChapterGenerator,
	ChapterGenerationSource,
} from "../providers/chapter-generator.js";
import {
	resolveDidacticUnitStatus,
	type DidacticUnit,
} from "./create-didactic-unit.js";
import {
	createDidacticUnitChapterRevision,
	resolveDidacticUnitChapterPresentationSettings,
	type DidacticUnitChapterRevisionSource,
} from "./didactic-unit-chapter.js";
import {resetDidacticUnitModuleReadProgress} from "./module-reading-progress.js";

export function createChapterGenerationSourceFromDidacticUnit(
	didacticUnit: DidacticUnit,
): ChapterGenerationSource {
	return {
		topic: didacticUnit.topic,
		provider: didacticUnit.provider,
		level: didacticUnit.level,
		questionnaireAnswers: didacticUnit.questionnaireAnswers,
		syllabus: didacticUnit.referenceSyllabus ?? {
			topic: didacticUnit.topic,
			title: didacticUnit.title,
			description: didacticUnit.overview,
			keywords: didacticUnit.keywords.join(", "),
			modules: didacticUnit.modules,
		},
	};
}

export function hasGeneratedDidacticUnitChapter(
	didacticUnit: DidacticUnit,
	chapterIndex: number,
): boolean {
	return (
		didacticUnit.generatedChapters?.some(
			(chapter) => chapter.chapterIndex === chapterIndex,
		) ?? false
	);
}

export async function generateDidacticUnitChapter(
	didacticUnit: DidacticUnit,
	chapterIndex: number,
	chapterGenerator: ChapterGenerator,
	revisionSource: DidacticUnitChapterRevisionSource = "ai_generation",
): Promise<DidacticUnit> {
	const chapterGenerationSource =
		createChapterGenerationSourceFromDidacticUnit(didacticUnit);
	const rawGeneratedChapter = await chapterGenerator.generate(
		chapterGenerationSource,
		chapterIndex,
	);
	return applyGeneratedDidacticUnitChapter(
		didacticUnit,
		chapterIndex,
		rawGeneratedChapter,
		revisionSource,
	);
}

export function applyGeneratedDidacticUnitChapter(
	didacticUnit: DidacticUnit,
	chapterIndex: number,
	rawGeneratedChapter: ReturnType<ChapterGenerator["generate"]> extends (
		Promise<infer Result>
	) ?
		Result
	:	never,
	revisionSource: DidacticUnitChapterRevisionSource = "ai_generation",
	continuitySummary?: string,
): DidacticUnit {
	const generatedChapter = {
		...rawGeneratedChapter,
		presentationSettings: resolveDidacticUnitChapterPresentationSettings(
			rawGeneratedChapter.presentationSettings,
		),
	};
	const updatedAt =
		generatedChapter.updatedAt ?? generatedChapter.generatedAt;
	const generatedChapters = didacticUnit.generatedChapters ?? [];
	const nextContinuitySummaries = [
		...(didacticUnit.continuitySummaries ?? []),
	];
	if (continuitySummary?.trim()) {
		nextContinuitySummaries[chapterIndex] = continuitySummary.trim();
	}
	const existingChapterIndex = generatedChapters.findIndex(
		(chapter) => chapter.chapterIndex === chapterIndex,
	);

	if (existingChapterIndex >= 0) {
		const updatedChapters = [...generatedChapters];
		updatedChapters[existingChapterIndex] = generatedChapter;

		return resetDidacticUnitModuleReadProgress(
			{
				...didacticUnit,
				chapterRevisions: [
					...(didacticUnit.chapterRevisions ?? []),
					createDidacticUnitChapterRevision({
						chapterIndex,
						source: revisionSource,
						chapter: generatedChapter,
					}),
				],
				updatedAt,
				status: resolveDidacticUnitStatus({
					...didacticUnit,
					generatedChapters: updatedChapters,
				}),
				continuitySummaries: nextContinuitySummaries,
				generatedChapters: updatedChapters,
			},
			chapterIndex,
		);
	}

	return resetDidacticUnitModuleReadProgress(
		{
			...didacticUnit,
			chapterRevisions: [
				...(didacticUnit.chapterRevisions ?? []),
				createDidacticUnitChapterRevision({
					chapterIndex,
					source: revisionSource,
					chapter: generatedChapter,
				}),
			],
			updatedAt,
			continuitySummaries: nextContinuitySummaries,
			generatedChapters: [...generatedChapters, generatedChapter].sort(
				(left, right) => left.chapterIndex - right.chapterIndex,
			),
			status: resolveDidacticUnitStatus({
				...didacticUnit,
				generatedChapters: [
					...generatedChapters,
					generatedChapter,
				].sort((left, right) => left.chapterIndex - right.chapterIndex),
			}),
		},
		chapterIndex,
	);
}
