import type {
	DidacticUnitChapterDetailDto,
	DidacticUnitChapterRevisionDto,
	DidacticUnitChapterSummaryDto,
	DidacticUnitDetailDto,
	DidacticUnitSummaryDto,
	FolderDto,
} from "./api/dashboardApi";
import type {
	EditorTextStyle,
	DashboardFolder,
	UnitLibraryItem,
	UnitEditorChapterViewModel,
	UnitEditorViewModel,
	UnitRevisionViewModel,
	UnitSetupViewModel,
} from "./types";
import {
	deriveEffortFromReadingTime,
	estimateReadingTimeFromText,
	formatRelativeTimestamp,
} from "./utils/unitDisplayMetadata";
import {htmlToPlainText, normalizeStoredHtml} from "./utils/htmlContent";
import type {PresentationTheme} from "@/shared/presentation/presentationTheme";

function resolveDisplayStatus(status: string): string {
	switch (status) {
		case "submitted":
		case "questionnaire_pending_moderation":
		case "moderation_completed":
		case "questionnaire_ready":
		case "questionnaire_answered":
		case "syllabus_prompt_ready":
		case "syllabus_ready":
			return "generating";
		case "syllabus_approved":
		case "ready_for_content_generation":
		case "content_generation_in_progress":
		case "content_generation_completed":
			return "ready";
		case "moderation_rejected":
		case "moderation_failed":
			return "failed";
		default:
			return "failed";
	}
}

function resolvePlanningProgressPercent(
	status: DidacticUnitDetailDto["status"],
): number {
	switch (status) {
		case "submitted":
		case "moderation_rejected":
			return 0;
		case "questionnaire_pending_moderation":
		case "moderation_failed":
			return 17;
		case "moderation_completed":
			return 17;
		case "questionnaire_ready":
			return 33;
		case "questionnaire_answered":
			return 50;
		case "syllabus_prompt_ready":
			return 67;
		case "syllabus_ready":
			return 83;
		case "syllabus_approved":
		case "ready_for_content_generation":
		case "content_generation_in_progress":
		case "content_generation_completed":
			return 100;
		default:
			return 0;
	}
}

function resolveActivityDate(
	value: string | undefined,
	fallback: string,
): string {
	return value?.trim() ? value : fallback;
}

export function resolveTextStyle(): EditorTextStyle {
	return {
		stylePreset: "classic",
		sizeProfile: "regular",
	};
}

const LEGACY_PRESET_MAP: Record<string, import("@/shared/presentation/typography").StylePresetId> = {
	tech: "modern",
	educational: "modern",
	editorial: "classic",
	serious: "classic",
};

function resolveTextStyleFromTheme(
	theme?: PresentationTheme | null,
): EditorTextStyle {
	if (!theme) {
		return resolveTextStyle();
	}

	const raw = theme.stylePreset as string | undefined;
	const stylePreset =
		raw && raw in LEGACY_PRESET_MAP ?
			LEGACY_PRESET_MAP[raw]
		: raw && ["modern", "modern", "classic", "classic", "plain"].includes(raw) ?
			(raw as import("@/shared/presentation/typography").StylePresetId)
		:	"classic";

	return {
		stylePreset,
		sizeProfile: theme.bodyFontSize,
	};
}

export function mapFolderSummary(folder: Omit<FolderDto, "unitCount">) {
	return {
		id: folder.id,
		name: folder.name,
		slug: folder.slug,
		icon: folder.icon,
		color: folder.color,
		kind: folder.kind,
	} as const;
}

export function mapDidacticUnitSummaryToLibraryItem(
	summary: DidacticUnitSummaryDto,
): UnitLibraryItem {
	const activityDate = resolveActivityDate(
		summary.lastActivityAt,
		summary.createdAt,
	);
	const canOpenEditor =
		summary.status === "syllabus_approved" ||
		summary.status === "ready_for_content_generation" ||
		summary.status === "content_generation_in_progress" ||
		summary.status === "content_generation_completed";

	return {
		kind: "didacticUnit",
		id: summary.id,
		title: summary.title,
		subtitle: summary.topic,
		folder: mapFolderSummary(summary.folder),
		modelUsed: summary.modelUsed ?? null,
		length: summary.length,
		status: resolveDisplayStatus(summary.status),
		primaryProgressPercent:
			canOpenEditor ?
				summary.studyProgressPercent
			:	summary.progressPercent,
		studyProgressPercent: summary.studyProgressPercent,
		chapterCount: summary.moduleCount,
		lastActivityAt: formatRelativeTimestamp(activityDate),
		coverColor: summary.folder.color,
		canOpenEditor,
		didacticUnitId: summary.id,
		route: canOpenEditor ? `/dashboard/unit/${summary.id}` : "/dashboard",
	};
}

export function buildUnitLibraryItems(input: {
	didacticUnits: DidacticUnitSummaryDto[];
}): UnitLibraryItem[] {
	return input.didacticUnits
		.map((summary) => ({
			item: mapDidacticUnitSummaryToLibraryItem(summary),
			sortKey: resolveActivityDate(
				summary.lastActivityAt,
				summary.createdAt,
			),
		}))
		.sort((left, right) => right.sortKey.localeCompare(left.sortKey))
		.map(({item}) => item);
}

export function buildDashboardFolders(
	folders: FolderDto[],
	items: UnitLibraryItem[],
): DashboardFolder[] {
	return folders
		.map((folder) => {
			const units = items
				.filter((item) => item.folder.id === folder.id)
				.map((item) => item.id);

			return {
				id: folder.id,
				name: folder.name,
				slug: folder.slug,
				icon: folder.icon,
				color: folder.color,
				kind: folder.kind,
				units,
				unitCount: units.length,
			};
		})
		.filter((folder) => folder.unitCount > 0);
}

export function mapDidacticUnitToSetupViewModel(
	detail: DidacticUnitDetailDto,
): UnitSetupViewModel {
	const answers = Object.fromEntries(
		(detail.questionnaireAnswers ?? []).map((answer) => [
			answer.questionId,
			answer.value,
		]),
	);

	return {
		id: detail.id,
		topic: detail.topic,
		folder: mapFolderSummary(detail.folder),
		provider: detail.provider,
		status: detail.status,
		nextAction: detail.nextAction,
		progressPercent: resolvePlanningProgressPercent(detail.status),
		lastActivityAt: formatRelativeTimestamp(detail.updatedAt),
		additionalContext: detail.additionalContext,
		improvedTopicBrief: detail.improvedTopicBrief,
		reasoningNotes: detail.reasoningNotes,
		moderationError: detail.moderationError,
		moderationAttempts: detail.moderationAttempts,
		level: detail.level,
		depth: detail.depth,
		learningProfile: detail.learningProfile ?? detail.level,
		length: detail.length,
		generationQuality: detail.generationQuality,
		questionnaireEnabled: detail.questionnaireEnabled,
		questionnaire:
			detail.questionnaire ?
				{
					questions: detail.questionnaire.questions,
					answers,
				}
			:	undefined,
		syllabusPrompt: detail.syllabusPrompt,
		syllabus: detail.syllabus,
		didacticUnitId: detail.id,
	};
}

function buildEditorChapter(
	unit: DidacticUnitDetailDto,
	summary: DidacticUnitChapterSummaryDto,
	detail: DidacticUnitChapterDetailDto | undefined,
): UnitEditorChapterViewModel {
	const html = normalizeStoredHtml(detail?.html ?? "");
	const readingTime = estimateReadingTimeFromText(
		htmlToPlainText(html),
	);

	return {
		chapterIndex: summary.chapterIndex,
		title: detail?.title ?? summary.title,
		status: summary.state,
		summary: detail?.planningOverview ?? summary.overview,
		readingTime,
		html,
		htmlHash: detail?.htmlHash,
		htmlBlocks: detail?.htmlBlocks ?? [],
		htmlBlocksVersion: detail?.htmlBlocksVersion ?? 0,
		readBlockIndex: detail?.readBlockIndex ?? 0,
		readBlockOffset: detail?.readBlockOffset,
		readBlocksVersion: detail?.readBlocksVersion ?? 0,
		totalBlocks: detail?.totalBlocks ?? detail?.htmlBlocks.length ?? 0,
		learningGoals: [...unit.learningGoals],
		keyPoints: [...unit.chapters[summary.chapterIndex].keyPoints],
		level: unit.level,
		effort: deriveEffortFromReadingTime(readingTime),
		isCompleted: detail?.isCompleted ?? summary.isCompleted,
		completedAt: detail?.completedAt ?? summary.completedAt,
		lastVisitedPageIndex:
			detail?.lastVisitedPageIndex ?? summary.lastVisitedPageIndex,
		textStyle: resolveTextStyleFromTheme(
			unit.presentationTheme,
		),
	};
}

export function mapDidacticUnitToEditorViewModel(input: {
	unit: DidacticUnitDetailDto;
	chapterSummaries: DidacticUnitChapterSummaryDto[];
	chapterDetails: Map<number, DidacticUnitChapterDetailDto>;
}): UnitEditorViewModel {
	return {
		id: input.unit.id,
		title: input.unit.title,
		folder: mapFolderSummary(input.unit.folder),
		progress: input.unit.studyProgress.studyProgressPercent,
		lastEdited: formatRelativeTimestamp(input.unit.updatedAt),
		coverColor: input.unit.folder.color,
		status: resolveDisplayStatus(input.unit.status),
		overview: input.unit.overview,
		provider: input.unit.provider,
		generationQuality: input.unit.generationQuality,
		length: input.unit.length,
		presentationTheme: input.unit.presentationTheme ?? null,
		chapters: input.chapterSummaries.map((summary) =>
			buildEditorChapter(
				input.unit,
				summary,
				input.chapterDetails.get(summary.chapterIndex),
			),
		),
	};
}

export function mapDidacticUnitRevisionsToViewModels(
	revisions: DidacticUnitChapterRevisionDto[],
): UnitRevisionViewModel[] {
	return revisions.map((revision) => ({
		id: revision.id,
		chapterIndex: revision.chapterIndex,
		source: revision.source,
		createdAt: formatRelativeTimestamp(revision.createdAt),
		title: revision.chapter.title,
		chapter: {
			title: revision.chapter.title,
			html: normalizeStoredHtml(revision.chapter.html),
			htmlHash: revision.chapter.htmlHash,
		},
	}));
}
