import {randomUUID} from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import passport from "passport";
import {
	type AiConfig,
	type AiConfigStore,
	type AiModelConfig,
	type AiModelTier,
	AiConfigValidationError,
	InMemoryAiConfigStore,
	parseAiConfigPatch,
} from "./ai/config.js";
import {MODEL_CATALOG} from "./ai/model-catalog.js";
import {openNdjsonStream, writeNdjsonEvent} from "./ai/ndjson.js";
import {
	AiGatewayConfigurationError,
	GatewayAiService,
	type AiService,
	type FolderClassificationResult,
	type SyllabusResult,
} from "./ai/service.js";
import {completeDidacticUnitChapter} from "./didactic-unit/complete-didactic-unit-chapter.js";
import {
	createDidacticUnit,
	type DidacticUnit,
} from "./didactic-unit/create-didactic-unit.js";
import {
	parseUpdateDidacticUnitChapterInput,
	type HtmlContentBlock,
	createCanonicalDidacticUnitChapter,
} from "./didactic-unit/didactic-unit-chapter.js";
import {
	applyGeneratedDidacticUnitChapter,
	hasGeneratedDidacticUnitChapter,
} from "./didactic-unit/generate-didactic-unit-chapter.js";
import {listDidacticUnitChapters} from "./didactic-unit/list-didactic-unit-chapters.js";
import {
	getModuleReadProgressRecord,
	updateDidacticUnitModuleReadProgress,
} from "./didactic-unit/module-reading-progress.js";
import {
	answerDidacticUnitQuestionnaire,
	applyGeneratedDidacticUnitSyllabus,
	approveDidacticUnitSyllabus,
	failDidacticUnitModeration,
	generateDidacticUnitSyllabusPrompt,
	moderateDidacticUnitPlanning,
	prepareDidacticUnitSyllabusGeneration,
	rejectDidacticUnitModeration,
	updateDidacticUnitSyllabus,
} from "./didactic-unit/planning-lifecycle.js";
import {
	adaptDidacticUnitSyllabusToReferenceSyllabus,
	parseCreateDidacticUnitInput,
	parseFolderSelectionInput,
	parseQuestionnaireAnswersInput,
	parseUpdateDidacticUnitFolderInput,
	parseUpdateDidacticUnitSyllabusInput,
} from "./didactic-unit/planning.js";
import {
	summarizeDidacticUnit,
	summarizeDidacticUnitStudyProgress,
} from "./didactic-unit/summarize-didactic-unit.js";
import {updateDidacticUnitChapter} from "./didactic-unit/update-didactic-unit-chapter.js";
import {updateDidacticUnitFolder} from "./didactic-unit/update-didactic-unit-folder.js";
import type {DidacticUnitStore} from "./didactic-unit/didactic-unit-store.js";
import {
	CUSTOM_FOLDER_COLOR,
	CUSTOM_FOLDER_ICON,
	ensureDefaultFolders,
	getGeneralFolder,
	normalizeFolderName,
	slugifyFolderName,
} from "./folders/folder-defaults.js";
import type {Folder, FolderStore} from "./folders/folder-store.js";
import {
	createCompletedSyllabusGenerationRunRecord,
	createCompletedActivityFeedbackRunRecord,
	createCompletedActivityGenerationRunRecord,
	createFailedActivityGenerationRunRecord,
	createFailedSyllabusGenerationRunRecord,
	createQueuedChapterGenerationRunRecord,
	type ChapterGenerationRunRecord,
	type GenerationRun,
	type GenerationRunStore,
	type SyllabusGenerationRunRecord,
} from "./generation-runs/generation-run-store.js";
import {
	InMemoryCreditTransactionStore,
} from "./auth/adapters/memory/credit-transaction-store.js";
import {InMemoryBillingEventStore, type BillingEventStore} from "./billing/billing-event-store.js";
import {
	createBillingRouter,
	createBillingWebhookHandler,
} from "./billing/routes.js";
import {BillingService, type BillingConfig, type StripeClientLike} from "./billing/service.js";
import {InMemorySessionStore} from "./auth/adapters/memory/session-store.js";
import {InMemoryUserStore} from "./auth/adapters/memory/user-store.js";
import {createAdminRouter} from "./auth/admin/routes.js";
import type {AuthConfig} from "./auth/core/types.js";
import {AuthService} from "./auth/core/service.js";
import type {
	AuthenticatedPrincipal,
	CreditTransactionStore,
	SessionStore,
	UserStore,
} from "./auth/core/types.js";
import {createAuthRouter} from "./auth/http/routes.js";
import {
	authErrorHandler,
	createRequireAuth,
	createRequireRole,
} from "./auth/http/middleware.js";
import {configureGooglePassport} from "./auth/passport/google.js";
import {
	disconnectedMongoHealthStatus,
	type MongoHealthStatus,
} from "./mongo/mongo-connection.js";
import {createLogger, type Logger} from "./logging/logger.js";
import {AuthError, getPublicAuthErrorMessage} from "./auth/core/errors.js";
import {
	isGenerationQuality,
	legacyTierToGenerationQuality,
	resolveModuleRegenerationCost,
	resolveActivityGenerationCost,
	resolveActivityFeedbackRefillCost,
	resolveSyllabusGenerationCost,
	resolveUnitGenerationCost,
	type GenerationCoinCost,
	type GenerationQuality,
} from "./credits/generation-pricing.js";
import {parsePresentationTheme} from "./presentation-theme/validate.js";
import {SYSTEM_DEFAULT_THEME} from "./presentation-theme/types.js";
import {
	OBJECTIVE_ACTIVITY_TYPES,
	getFlashcardVisibleModuleIndexes,
	gradeObjectiveActivity,
	parseCreateLearningActivityInput,
	type LearningActivity,
	type LearningActivityAttempt,
	type LearningActivityProgress,
} from "./activities/learning-activity.js";
import {
	InMemoryLearningActivityStore,
	type LearningActivityStore,
} from "./activities/learning-activity-store.js";

export interface CreateAppOptions {
	didacticUnitStore: DidacticUnitStore;
	generationRunStore: GenerationRunStore;
	learningActivityStore?: LearningActivityStore;
	folderStore: FolderStore;
	aiConfigStore?: AiConfigStore;
	aiService?: AiService;
	mongoHealth?: MongoHealthStatus;
	logger?: Logger;
	authConfig: AuthConfig;
	userStore?: UserStore;
	sessionStore?: SessionStore;
	creditTransactionStore?: CreditTransactionStore;
	billingEventStore?: BillingEventStore;
	billingConfig?: BillingConfig;
	stripeClient?: StripeClientLike | null;
	testPrincipal?: AuthenticatedPrincipal;
}

interface RequestWithMockOwner extends express.Request {
	mockOwner: {
		id: string;
	};
}

type UsageAnalyticsPeriod = "7d" | "30d" | "6m" | "12m";

interface UsageAnalyticsBucket {
	key: string;
	label: string;
	count: number;
}

function asRequestWithMockOwner(request: express.Request): RequestWithMockOwner {
	const ownerId = request.auth?.sub;
	if (!ownerId) {
		throw new Error("Authentication required.");
	}

	return Object.assign(request, {
		mockOwner: {
			id: ownerId,
		},
	});
}

function parseChapterIndex(value: string): number {
	const chapterIndex = Number.parseInt(value, 10);

	if (!Number.isInteger(chapterIndex) || chapterIndex < 0) {
		throw new Error("moduleIndex must be a non-negative integer.");
	}

	return chapterIndex;
}

function parseModuleReadProgressInput(body: unknown): {
	readBlockIndex: number;
	readBlockOffset?: number;
	lastVisitedPageIndex?: number;
} {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}

	const payload = body as {
		readBlockIndex?: unknown;
		readBlockOffset?: unknown;
		lastVisitedPageIndex?: unknown;
	};
	const readBlockIndex =
		typeof payload.readBlockIndex === "number" ? payload.readBlockIndex : 0;

	if (
		payload.readBlockIndex !== undefined &&
		(typeof readBlockIndex !== "number" || !Number.isFinite(readBlockIndex))
	) {
		throw new Error("readBlockIndex must be a finite number.");
	}

	if (readBlockIndex < 0) {
		throw new Error(
			"readBlockIndex must be greater than or equal to 0.",
		);
	}
	if (
		payload.readBlockOffset !== undefined &&
		(
			typeof payload.readBlockOffset !== "number" ||
			!Number.isFinite(payload.readBlockOffset) ||
			payload.readBlockOffset < 0
		)
	) {
		throw new Error("readBlockOffset must be a non-negative number.");
	}

	if (
		payload.lastVisitedPageIndex !== undefined &&
		(
			typeof payload.lastVisitedPageIndex !== "number" ||
			!Number.isFinite(payload.lastVisitedPageIndex) ||
			!Number.isInteger(payload.lastVisitedPageIndex) ||
			payload.lastVisitedPageIndex < 0
		)
	) {
		throw new Error(
			"lastVisitedPageIndex must be a non-negative integer.",
		);
	}

	return {
		readBlockIndex,
		readBlockOffset:
			typeof payload.readBlockOffset === "number" ?
				payload.readBlockOffset
			:	undefined,
		lastVisitedPageIndex:
			typeof payload.lastVisitedPageIndex === "number" ?
				payload.lastVisitedPageIndex
			:	undefined,
	};
}

function parseChapterGenerationInstruction(body: unknown): string | undefined {
	if (body === undefined || body === null) {
		return undefined;
	}

	if (typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}

	const payload = body as {instruction?: unknown};
	if (payload.instruction === undefined) {
		return undefined;
	}

	if (typeof payload.instruction !== "string") {
		throw new Error("instruction must be a string.");
	}

	const normalized = payload.instruction.trim();
	return normalized || undefined;
}

function parseAiModelTier(body: unknown): AiModelTier {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}

	const payload = body as {tier?: unknown; quality?: unknown};
	const quality = legacyTierToGenerationQuality(payload.quality ?? payload.tier);

	if (!quality) {
		throw new Error('quality must be either "silver" or "gold".');
	}

	return quality;
}

function parseGenerationQuality(body: unknown): GenerationQuality {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}

	const payload = body as {quality?: unknown; tier?: unknown};
	const quality = legacyTierToGenerationQuality(payload.quality ?? payload.tier);
	if (!isGenerationQuality(quality)) {
		throw new Error('quality must be either "silver" or "gold".');
	}

	return quality;
}

function parseOptionalSyllabusContext(body: unknown): string | undefined {
	if (body === undefined || body === null) {
		return undefined;
	}

	if (typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}

	const payload = body as {context?: unknown};
	if (payload.context === undefined) {
		return undefined;
	}

	if (typeof payload.context !== "string") {
		throw new Error("context must be a string.");
	}

	const normalized = payload.context.trim();
	return normalized || undefined;
}

function compareRunsByCreatedAtDesc(
	left: GenerationRun,
	right: GenerationRun,
): number {
	return right.createdAt.localeCompare(left.createdAt);
}

function isTerminalGenerationRun(run: GenerationRun): boolean {
	return (
		run.status === "completed" ||
		run.status === "failed" ||
		run.status === "payment_failed"
	);
}

function buildFolderResponse(folder: Folder) {
	return {
		id: folder.id,
		name: folder.name,
		slug: folder.slug,
		icon: folder.icon,
		color: folder.color,
		kind: folder.kind,
	};
}

function buildFolderDescription(folder: Folder): string {
	if (folder.slug === "general") {
		return "Use for broad topics, mixed subjects, or units that do not clearly fit a specialized folder.";
	}

	return `Use for units primarily focused on ${folder.name.toLowerCase()}.`;
}

function resolveFolderOrFallback(
	didacticUnit: Pick<DidacticUnit, "folderId">,
	foldersById: Map<string, Folder>,
): Folder {
	const assignedFolder = foldersById.get(didacticUnit.folderId);
	if (assignedFolder) {
		return assignedFolder;
	}

	const generalFolder = [...foldersById.values()].find(
		(folder) => folder.slug === "general",
	);
	if (generalFolder) {
		return generalFolder;
	}

	throw new Error(
		"No folder metadata was available for the didactic unit response.",
	);
}

function buildDidacticUnitResponseFromFolders(
	didacticUnit: DidacticUnit,
	foldersById: Map<string, Folder>,
) {
	const folder = resolveFolderOrFallback(didacticUnit, foldersById);

	return {
		id: didacticUnit.id,
		ownerId: didacticUnit.ownerId,
		topic: didacticUnit.topic,
		title: didacticUnit.title,
		folderId: folder.id,
		folderAssignmentMode: didacticUnit.folderAssignmentMode,
		folder: buildFolderResponse(folder),
		presentationTheme: didacticUnit.presentationTheme ?? null,
		provider: didacticUnit.provider,
		status: didacticUnit.status,
		nextAction: didacticUnit.nextAction,
		createdAt: didacticUnit.createdAt,
		updatedAt: didacticUnit.updatedAt,
		moderatedAt: didacticUnit.moderatedAt,
		moderationError: didacticUnit.moderationError,
		moderationAttempts: didacticUnit.moderationAttempts,
		questionnaireGeneratedAt: didacticUnit.questionnaireGeneratedAt,
		questionnaireAnsweredAt: didacticUnit.questionnaireAnsweredAt,
		improvedTopicBrief: didacticUnit.improvedTopicBrief,
		reasoningNotes: didacticUnit.reasoningNotes,
		additionalContext: didacticUnit.additionalContext,
		depth: didacticUnit.depth,
		length: didacticUnit.length,
		level: didacticUnit.level,
		generationTier: didacticUnit.generationTier,
		generationQuality:
			didacticUnit.generationQuality ??
			legacyTierToGenerationQuality(didacticUnit.generationTier),
		unitGenerationPaidAt: didacticUnit.unitGenerationPaidAt,
		unitGenerationCreditTransactionId:
			didacticUnit.unitGenerationCreditTransactionId,
		questionnaireEnabled: didacticUnit.questionnaireEnabled,
		questionnaire: didacticUnit.questionnaire,
		questionnaireAnswers: didacticUnit.questionnaireAnswers,
		syllabusPrompt: didacticUnit.syllabusPrompt,
		syllabusPromptGeneratedAt: didacticUnit.syllabusPromptGeneratedAt,
		syllabus: didacticUnit.syllabus,
		syllabusGeneratedAt: didacticUnit.syllabusGeneratedAt,
		syllabusUpdatedAt: didacticUnit.syllabusUpdatedAt,
		syllabusApprovedAt: didacticUnit.syllabusApprovedAt,
		overview: didacticUnit.overview,
		learningGoals: didacticUnit.learningGoals,
		keywords: didacticUnit.keywords,
		chapters: didacticUnit.chapters.map((chapter) => ({
			title: chapter.title,
			overview: chapter.overview,
			keyPoints: [...chapter.keyPoints],
			lessons: chapter.lessons.map((lesson) => ({
				title: lesson.title,
				contentOutline: [...lesson.contentOutline],
			})),
		})),
		studyProgress: summarizeDidacticUnitStudyProgress(didacticUnit),
	};
}

async function loadFoldersById(
	folderStore: FolderStore,
	ownerId: string,
): Promise<Map<string, Folder>> {
	const folders = await ensureDefaultFolders(folderStore, ownerId);
	return new Map(folders.map((folder) => [folder.id, folder] as const));
}

async function buildDidacticUnitResponse(
	didacticUnit: DidacticUnit,
	folderStore: FolderStore,
) {
	return buildDidacticUnitResponseFromFolders(
		didacticUnit,
		await loadFoldersById(folderStore, didacticUnit.ownerId),
	);
}

async function buildDidacticUnitSummaryResponses(
	didacticUnits: DidacticUnit[],
	folderStore: FolderStore,
	ownerId: string,
) {
	const foldersById = await loadFoldersById(folderStore, ownerId);

	return didacticUnits.map((didacticUnit) => {
		const summary = summarizeDidacticUnit(didacticUnit);
		const folder = resolveFolderOrFallback(didacticUnit, foldersById);

		return {
			...summary,
			folder: buildFolderResponse(folder),
		};
	});
}

async function listFoldersWithUnitCounts(
	folderStore: FolderStore,
	didacticUnitStore: DidacticUnitStore,
	ownerId: string,
) {
	const folders = await ensureDefaultFolders(folderStore, ownerId);
	const didacticUnits = await didacticUnitStore.listByOwner(ownerId);
	const unitCounts = didacticUnits.reduce<Map<string, number>>(
		(counts, didacticUnit) => {
			counts.set(
				didacticUnit.folderId,
				(counts.get(didacticUnit.folderId) ?? 0) + 1,
			);
			return counts;
		},
		new Map(),
	);

	return folders.map((folder) => ({
		...buildFolderResponse(folder),
		unitCount: unitCounts.get(folder.id) ?? 0,
	}));
}

function parseUsageAnalyticsPeriod(value: unknown): UsageAnalyticsPeriod {
	if (
		value === undefined ||
		value === "7d" ||
		value === "30d" ||
		value === "6m" ||
		value === "12m"
	) {
		return value ?? "30d";
	}

	throw new Error("Invalid analytics period.");
}

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

function startOfUtcMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function formatMonthKey(date: Date): string {
	return date.toISOString().slice(0, 7);
}

function formatDayLabel(date: Date): string {
	return date.toLocaleDateString("en", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

function formatMonthLabel(date: Date): string {
	return date.toLocaleDateString("en", {
		month: "short",
		timeZone: "UTC",
	});
}

function addUtcDays(date: Date, amount: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + amount);
	return next;
}

function addUtcMonths(date: Date, amount: number): Date {
	const next = new Date(date);
	next.setUTCMonth(next.getUTCMonth() + amount);
	return next;
}

function buildEmptyAnalyticsBuckets(
	period: UsageAnalyticsPeriod,
	now = new Date(),
): UsageAnalyticsBucket[] {
	if (period === "7d" || period === "30d") {
		const dayCount = period === "7d" ? 7 : 30;
		const firstDay = addUtcDays(startOfUtcDay(now), -(dayCount - 1));
		return Array.from({length: dayCount}, (_ignored, index) => {
			const bucketDate = addUtcDays(firstDay, index);
			return {
				key: formatDayKey(bucketDate),
				label: formatDayLabel(bucketDate),
				count: 0,
			};
		});
	}

	const monthCount = period === "6m" ? 6 : 12;
	const firstMonth = addUtcMonths(startOfUtcMonth(now), -(monthCount - 1));
	return Array.from({length: monthCount}, (_ignored, index) => {
		const bucketDate = addUtcMonths(firstMonth, index);
		return {
			key: formatMonthKey(bucketDate),
			label: formatMonthLabel(bucketDate),
			count: 0,
		};
	});
}

function getRunActivityDate(run: GenerationRun): Date {
	return new Date(
		(run.stage === "chapter" ? run.completedAt : undefined) ??
			run.updatedAt ??
			run.createdAt,
	);
}

function getBucketKeyForDate(
	date: Date,
	period: UsageAnalyticsPeriod,
): string {
	return period === "7d" || period === "30d" ?
			formatDayKey(startOfUtcDay(date))
		:	formatMonthKey(startOfUtcMonth(date));
}

function getModelDisplayName(provider: string, model: string): string {
	const modelId = `${provider}/${model}`;
	const catalogEntry = [...MODEL_CATALOG.silver, ...MODEL_CATALOG.gold].find(
		(entry) => entry.id === modelId,
	);

	return catalogEntry?.label ?? modelId;
}

function buildFavoriteModel(completedRuns: GenerationRun[]) {
	const counts = completedRuns.reduce<
		Map<string, {provider: string; model: string; count: number}>
	>((accumulator, run) => {
		const key = `${run.provider}/${run.model}`;
		const current = accumulator.get(key);
		accumulator.set(key, {
			provider: run.provider,
			model: run.model,
			count: (current?.count ?? 0) + 1,
		});
		return accumulator;
	}, new Map());

	const favorite = [...counts.values()].sort(
		(left, right) =>
			right.count - left.count ||
			getModelDisplayName(left.provider, left.model).localeCompare(
				getModelDisplayName(right.provider, right.model),
			),
	)[0];

	if (!favorite) {
		return null;
	}

	return {
		provider: favorite.provider,
		model: favorite.model,
		label: getModelDisplayName(favorite.provider, favorite.model),
		count: favorite.count,
	};
}

function buildFavoriteTopic(
	didacticUnits: DidacticUnit[],
	foldersById: Map<string, Folder>,
) {
	const counts = didacticUnits.reduce<Map<string, number>>(
		(accumulator, didacticUnit) => {
			const folder = resolveFolderOrFallback(didacticUnit, foldersById);
			accumulator.set(folder.id, (accumulator.get(folder.id) ?? 0) + 1);
			return accumulator;
		},
		new Map(),
	);

	const favorite = [...counts.entries()]
		.map(([folderId, count]) => ({folder: foldersById.get(folderId), count}))
		.filter(
			(entry): entry is {folder: Folder; count: number} =>
				entry.folder !== undefined,
		)
		.sort(
			(left, right) =>
				right.count - left.count ||
				left.folder.name.localeCompare(right.folder.name),
		)[0];

	if (!favorite) {
		return null;
	}

	return {
		...buildFolderResponse(favorite.folder),
		unitCount: favorite.count,
	};
}

async function buildUsageAnalytics(input: {
	ownerId: string;
	period: UsageAnalyticsPeriod;
	didacticUnitStore: DidacticUnitStore;
	folderStore: FolderStore;
	generationRunStore: GenerationRunStore;
}) {
	const [didacticUnits, foldersById, generationRuns] = await Promise.all([
		input.didacticUnitStore.listByOwner(input.ownerId),
		loadFoldersById(input.folderStore, input.ownerId),
		input.generationRunStore.listByOwner(input.ownerId),
	]);

	const unitSummaries = didacticUnits.map((didacticUnit) =>
		summarizeDidacticUnit(didacticUnit),
	);
	const readBlockCount = unitSummaries.reduce(
		(total, summary) => total + summary.readBlockCount,
		0,
	);
	const totalBlockCount = unitSummaries.reduce(
		(total, summary) => total + summary.totalBlockCount,
		0,
	);
	const completedRuns = generationRuns.filter(
		(run) => run.status === "completed",
	);
	const buckets = buildEmptyAnalyticsBuckets(input.period);
	const bucketCounts = new Map(
		buckets.map((bucket) => [bucket.key, bucket.count] as const),
	);

	for (const run of completedRuns) {
		const key = getBucketKeyForDate(getRunActivityDate(run), input.period);
		if (bucketCounts.has(key)) {
			bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
		}
	}

	return {
		period: input.period,
		unitsCreated: didacticUnits.length,
		aiGenerations: completedRuns.length,
		completionRate:
			totalBlockCount === 0 ?
				0
			:	Math.round((readBlockCount / totalBlockCount) * 100),
		readBlockCount,
		totalBlockCount,
		favoriteModel: buildFavoriteModel(completedRuns),
		favoriteTopic: buildFavoriteTopic(didacticUnits, foldersById),
		chart: buckets.map((bucket) => ({
			...bucket,
			count: bucketCounts.get(bucket.key) ?? 0,
		})),
	};
}

function resolveFolderSelectionForManualMode(
	folderSelection: {
		mode: "manual" | "auto";
		folderId?: string;
	},
	foldersById: Map<string, Folder>,
) {
	if (folderSelection.mode !== "manual") {
		return folderSelection;
	}

	const selectedFolder =
		folderSelection.folderId ?
			foldersById.get(folderSelection.folderId)
		:	null;

	if (!selectedFolder) {
		throw new Error("Selected folder was not found.");
	}

	return {
		mode: "manual" as const,
		folderId: selectedFolder.id,
	};
}

function resolveFolderIdFromModelName(input: {
	folderName: string | undefined;
	folders: Folder[];
	fallbackFolderId: string;
}): string {
	const normalizedFolderName = input.folderName?.trim().toLowerCase();

	if (!normalizedFolderName) {
		return input.fallbackFolderId;
	}

	return (
		input.folders.find(
			(folder) =>
				folder.name.trim().toLowerCase() === normalizedFolderName,
		)?.id ?? input.fallbackFolderId
	);
}

async function resolveAutoAssignedFolderSelection(input: {
	didacticUnit: DidacticUnit;
	folderStore: FolderStore;
	aiConfigStore: AiConfigStore;
	aiService: AiService;
	abortSignal?: AbortSignal;
}): Promise<{
	folderId: string;
	result?: FolderClassificationResult;
}> {
	const folders = await ensureDefaultFolders(
		input.folderStore,
		input.didacticUnit.ownerId,
	);
	const generalFolder = folders.find((folder) => folder.slug === "general");

	if (!generalFolder) {
		throw new Error("General folder could not be resolved.");
	}

	try {
		const config = await input.aiConfigStore.get(
			input.didacticUnit.ownerId,
		);
		const result = await input.aiService.classifyFolder({
			topic: input.didacticUnit.topic,
			additionalContext: input.didacticUnit.additionalContext,
			folders: folders.map((folder) => ({
				name: folder.name,
				description: buildFolderDescription(folder),
			})),
			config,
			tier: "silver",
			abortSignal: input.abortSignal,
		});

		const matchedFolder =
			folders.find(
				(folder) =>
					folder.name.toLowerCase() ===
					result.folderName.trim().toLowerCase(),
			) ?? generalFolder;

		return {
			folderId: matchedFolder.id,
			result,
		};
	} catch {
		return {folderId: generalFolder.id};
	}
}

type DidacticUnitChapterState = "pending" | "ready" | "failed";

function resolveDidacticUnitChapterState(input: {
	didacticUnit: DidacticUnit;
	chapterIndex: number;
	chapterRuns: ChapterGenerationRunRecord[];
}): DidacticUnitChapterState {
	const generatedChapter = input.didacticUnit.generatedChapters?.find(
		(chapter) => chapter.chapterIndex === input.chapterIndex,
	);

	if (generatedChapter) {
		return "ready";
	}

	const latestRun = input.chapterRuns
		.filter((run) => run.chapterIndex === input.chapterIndex)
		.sort(compareRunsByCreatedAtDesc)[0];

	if (latestRun?.status === "failed") {
		return "failed";
	}

	return "pending";
}

function resolveCompatibilityProvider(
	config: AiConfig,
	requestedProvider: string,
): string {
	return requestedProvider === "profile-config" ?
			config.silver.provider
		:	requestedProvider;
}

function resolveStageConfigError(
	error: unknown,
	fallbackMessage: string,
): {status: number; message: string} {
	if (
		error instanceof AiGatewayConfigurationError ||
		error instanceof AiConfigValidationError
	) {
		return {status: 500, message: error.message};
	}

	return {
		status: 409,
		message: error instanceof Error ? error.message : fallbackMessage,
	};
}

function createAbortSignal(request: express.Request): AbortSignal {
	const controller = new AbortController();
	request.on("close", () => controller.abort());
	return controller.signal;
}

type CreditReservation = Awaited<
	ReturnType<AuthService["reserveUserCredits"]>
>;

function sendAuthErrorResponse(
	response: express.Response,
	error: AuthError,
): void {
	response.status(error.statusCode).json({
		error: error.code,
		message: getPublicAuthErrorMessage(error),
		...(error.details ?? {}),
	});
}

async function reserveGenerationCredits(input: {
	authService: AuthService;
	ownerId: string;
	cost: GenerationCoinCost;
	reason: string;
	metadata: Record<string, unknown>;
}): Promise<CreditReservation | null> {
	const user = await input.authService.getUserById(input.ownerId);
	if (user?.role === "admin") {
		return null;
	}

	return input.authService.reserveUserCredits({
		userId: input.ownerId,
		coinType: input.cost.coinType,
		amount: input.cost.amount,
		reason: input.reason,
		metadata: input.metadata,
	});
}

async function refundGenerationCredits(input: {
	authService: AuthService;
	reservation: CreditReservation | null;
	reason: string;
	metadata: Record<string, unknown>;
}): Promise<void> {
	if (!input.reservation) {
		return;
	}

	await input.authService.refundUserCredits({
		userId: input.reservation.transaction.userId,
		coinType: input.reservation.transaction.coinType,
		amount: input.reservation.transaction.amount,
		reason: input.reason,
		metadata: {
			...input.metadata,
			refundedTransactionId: input.reservation.transaction.id,
		},
	});
}

function getGeneratedChapterOrThrow(
	didacticUnit: DidacticUnit,
	chapterIndex: number,
) {
	const generatedChapter = didacticUnit.generatedChapters?.find(
		(chapter) => chapter.chapterIndex === chapterIndex,
	);

	if (!generatedChapter) {
		throw new Error("Generated didactic unit module not found.");
	}

	return generatedChapter;
}

function resolveActivitySourceModuleIndexes(input: {
	scope: "current_module" | "cumulative_until_module";
	chapterIndex: number;
}): number[] {
	return input.scope === "current_module" ?
			[input.chapterIndex]
		:	Array.from({length: input.chapterIndex + 1}, (_, index) => index);
}

function buildActivityContextModules(input: {
	didacticUnit: DidacticUnit;
	sourceModuleIndexes: number[];
}) {
	return input.sourceModuleIndexes.map((index) => {
		const planned =
			input.didacticUnit.referenceSyllabus?.modules[index] ??
			input.didacticUnit.modules[index] ??
			input.didacticUnit.chapters[index];
		const generated = input.didacticUnit.generatedChapters?.find(
			(chapter) => chapter.chapterIndex === index,
		);

		return {
			index,
			title: planned?.title ?? generated?.title ?? `Module ${index + 1}`,
			overview:
				"overview" in (planned ?? {}) ?
					String((planned as {overview?: unknown}).overview ?? "")
				:	"",
			html: generated?.html,
			continuitySummary: input.didacticUnit.continuitySummaries?.[index],
		};
	});
}

function sortPreviousActivitiesForPrompt(input: {
	activities: LearningActivity[];
	chapterIndex: number;
	type: string;
}): LearningActivity[] {
	return [...input.activities].sort((left, right) => {
		const leftScore =
			(left.chapterIndex === input.chapterIndex ? 4 : 0) +
			(left.type === input.type ? 2 : 0);
		const rightScore =
			(right.chapterIndex === input.chapterIndex ? 4 : 0) +
			(right.type === input.type ? 2 : 0);
		if (leftScore !== rightScore) {
			return rightScore - leftScore;
		}
		return right.createdAt.localeCompare(left.createdAt);
	});
}

function uniqueLearningActivitiesById(
	activities: LearningActivity[],
): LearningActivity[] {
	const seen = new Set<string>();
	const unique: LearningActivity[] = [];

	for (const activity of activities) {
		if (seen.has(activity.id)) {
			continue;
		}

		seen.add(activity.id);
		unique.push(activity);
	}

	return unique;
}

function resolveFlashcardGenerationCount(quality: GenerationQuality): number {
	return quality === "gold" ? 15 : 5;
}

function normalizeActivityRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ?
			(value as Record<string, unknown>)
		:	{};
}

function normalizeFlashcardText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeFlashcardKey(value: unknown): string {
	return normalizeFlashcardText(value)
		.toLowerCase()
		.replace(/\s+/g, " ");
}

function normalizeFlashcardCards(value: unknown): Array<Record<string, unknown>> {
	return Array.isArray(value) ?
			value
				.map((item) => normalizeActivityRecord(item))
				.filter(
					(card) =>
						normalizeFlashcardText(card.front).length > 0 &&
						normalizeFlashcardText(card.back).length > 0,
				)
		:	[];
}

function prepareGeneratedFlashcardCards(input: {
	cards: unknown;
	existingCards: Array<Record<string, unknown>>;
	count: number;
}): Array<Record<string, unknown>> {
	const existingKeys = new Set(
		input.existingCards.map((card) => normalizeFlashcardKey(card.front)),
	);
	const seenKeys = new Set<string>();

	return normalizeFlashcardCards(input.cards)
		.filter((card) => {
			const key = normalizeFlashcardKey(card.front);
			if (!key || existingKeys.has(key) || seenKeys.has(key)) {
				return false;
			}
			seenKeys.add(key);
			return true;
		})
		.slice(0, input.count)
		.map((card, index) => ({
			...card,
			id:
				normalizeFlashcardText(card.id) ||
				`card-${Date.now()}-${index + 1}`,
		}));
}

async function resolveCanonicalFlashcardActivity(input: {
	learningActivityStore: LearningActivityStore;
	ownerId: string;
	didacticUnitId: string;
	chapterIndex: number;
	sourceModuleIndexes: number[];
	quality: GenerationQuality;
	result: {
		title: string;
		instructions: string;
		content: Record<string, unknown>;
		dedupeSummary: string;
	};
	generationRunId: string;
	activityId: string;
	now: string;
}): Promise<LearningActivity> {
	const count = resolveFlashcardGenerationCount(input.quality);
	const unitActivities = await input.learningActivityStore.listByUnit({
		ownerId: input.ownerId,
		didacticUnitId: input.didacticUnitId,
	});
	const flashcardActivities = unitActivities
		.filter((activity) => activity.type === "flashcards")
		.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
	const canonical = flashcardActivities[0];
	const duplicateActivities = flashcardActivities.slice(1);
	const duplicateCards = duplicateActivities.flatMap((activity) =>
		normalizeFlashcardCards(activity.content.cards),
	);
	const existingCards =
		canonical ? normalizeFlashcardCards(canonical.content.cards) : [];
	const generatedCards = prepareGeneratedFlashcardCards({
		cards: input.result.content.cards,
		existingCards: [...existingCards, ...duplicateCards],
		count,
	});
	const mergedCards = [
		...existingCards,
		...duplicateCards.filter((card) => {
			const key = normalizeFlashcardKey(card.front);
			return !existingCards.some(
				(existing) => normalizeFlashcardKey(existing.front) === key,
			);
		}),
		...generatedCards,
	];

	if (canonical) {
		const visibleModuleIndexes = Array.from(
			new Set([
				...getFlashcardVisibleModuleIndexes(canonical),
				...duplicateActivities.flatMap(getFlashcardVisibleModuleIndexes),
				input.chapterIndex,
			]),
		).sort((left, right) => left - right);
		const updated: LearningActivity = {
			...canonical,
			quality: input.quality,
			title: input.result.title || canonical.title,
			instructions: input.result.instructions || canonical.instructions,
			content: {
				...canonical.content,
				...input.result.content,
				cards: mergedCards,
				visibleModuleIndexes,
			},
			dedupeSummary: [
				canonical.dedupeSummary,
				input.result.dedupeSummary,
			].filter(Boolean).join(" "),
			sourceModuleIndexes: Array.from(
				new Set([
					...canonical.sourceModuleIndexes,
					...input.sourceModuleIndexes,
				]),
			).sort((left, right) => left - right),
			feedbackAttemptLimit: Math.max(canonical.feedbackAttemptLimit, 3),
			generationRunId: input.generationRunId,
			updatedAt: input.now,
		};
		await input.learningActivityStore.saveActivity(updated);
		for (const duplicate of duplicateActivities) {
			await input.learningActivityStore.saveActivity({
				...duplicate,
				content: {...duplicate.content, archived: true},
				updatedAt: input.now,
			});
		}
		return updated;
	}

	return {
		id: input.activityId,
		ownerId: input.ownerId,
		didacticUnitId: input.didacticUnitId,
		chapterIndex: input.chapterIndex,
		scope: "cumulative_until_module",
		type: "flashcards",
		quality: input.quality,
		title: input.result.title,
		instructions: input.result.instructions,
		content: {
			...input.result.content,
			cards: generatedCards,
			visibleModuleIndexes: [input.chapterIndex],
		},
		dedupeSummary: input.result.dedupeSummary,
		sourceModuleIndexes: input.sourceModuleIndexes,
		feedbackAttemptLimit: 3,
		generationRunId: input.generationRunId,
		createdAt: input.now,
		updatedAt: input.now,
	};
}

function parseAttemptAnswers(body: unknown): unknown {
	if (!body || typeof body !== "object" || !("answers" in body)) {
		throw new Error("Activity attempt answers are required.");
	}

	return (body as {answers: unknown}).answers;
}

const TOP_LEVEL_HTML_BLOCK_TAGS = new Set([
	"h2",
	"h3",
	"h4",
	"p",
	"ul",
	"ol",
	"blockquote",
	"pre",
	"table",
]);

const VOID_HTML_BLOCK_TAGS = new Set(["hr"]);

function createHtmlBlockAccumulator(input: {
	chapterId: string;
	onBlock: (block: HtmlContentBlock) => Promise<void>;
}) {
	let buffer = "";
	let cursor = 0;
	let blockStart = -1;
	let activeTag: string | null = null;
	let depth = 0;
	let emittedCount = 0;

	const emitBlock = async (rawBlockHtml: string) => {
		const chapter = createCanonicalDidacticUnitChapter({
			chapterIndex: 0,
			title: "Streaming block",
			rawHtml: rawBlockHtml,
			chapterId: `${input.chapterId}:stream:${emittedCount}`,
		});
		const block = chapter.htmlBlocks[0];
		if (!block) {
			return;
		}
		emittedCount += 1;
		await input.onBlock(block);
	};

	const readTag = (tagStart: number) => {
		const tagEnd = buffer.indexOf(">", tagStart);
		if (tagEnd === -1) {
			return null;
		}

		const rawTag = buffer.slice(tagStart + 1, tagEnd).trim();
		if (
			!rawTag ||
			rawTag.startsWith("!") ||
			rawTag.startsWith("?")
		) {
			return {tagEnd, tagName: "", isClosing: false, isSelfClosing: true};
		}

		const isClosing = rawTag.startsWith("/");
		const tagBody = (isClosing ? rawTag.slice(1) : rawTag).trim();
		const tagName = tagBody.split(/\s+/)[0]?.toLowerCase() ?? "";
		const isSelfClosing =
			rawTag.endsWith("/") || VOID_HTML_BLOCK_TAGS.has(tagName);

		return {tagEnd, tagName, isClosing, isSelfClosing};
	};

	return {
		async ingest(delta: string) {
			buffer += delta;

			while (cursor < buffer.length) {
				const tagStart = buffer.indexOf("<", cursor);
				if (tagStart === -1) {
					cursor = buffer.length;
					break;
				}

				const tag = readTag(tagStart);
				if (!tag) {
					break;
				}

				if (!tag.tagName) {
					cursor = tag.tagEnd + 1;
					continue;
				}

				if (activeTag === null) {
					if (
						!tag.isClosing &&
						(TOP_LEVEL_HTML_BLOCK_TAGS.has(tag.tagName) ||
							VOID_HTML_BLOCK_TAGS.has(tag.tagName))
					) {
						blockStart = tagStart;
						activeTag = tag.tagName;
						depth = tag.isSelfClosing ? 0 : 1;

						if (tag.isSelfClosing) {
							await emitBlock(buffer.slice(blockStart, tag.tagEnd + 1));
							buffer = buffer.slice(tag.tagEnd + 1);
							cursor = 0;
							blockStart = -1;
							activeTag = null;
							continue;
						}
					}

					cursor = tag.tagEnd + 1;
					continue;
				}

				if (!tag.isClosing && !tag.isSelfClosing) {
					depth += 1;
				} else if (tag.isClosing) {
					depth = Math.max(0, depth - 1);
				}

				cursor = tag.tagEnd + 1;

				if (depth === 0 && blockStart !== -1) {
					await emitBlock(buffer.slice(blockStart, tag.tagEnd + 1));
					buffer = buffer.slice(tag.tagEnd + 1);
					cursor = 0;
					blockStart = -1;
					activeTag = null;
				}
			}
		},
	};
}

async function recordCompletedSyllabusRun(
	generationRunStore: GenerationRunStore,
	didacticUnit: DidacticUnit,
	result: SyllabusResult,
): Promise<void> {
	await generationRunStore.save(
		createCompletedSyllabusGenerationRunRecord({
			didacticUnitId: didacticUnit.id,
			ownerId: didacticUnit.ownerId,
			provider: result.provider,
			model: result.model,
			prompt: result.prompt,
			syllabus: didacticUnit.syllabus!,
			createdAt:
				didacticUnit.syllabusGeneratedAt ?? new Date().toISOString(),
			telemetry: result.telemetry,
		}),
	);
}

function buildDidacticUnitModuleDetailResponse(input: {
	didacticUnit: DidacticUnit;
	moduleIndex: number;
	chapterRuns: ChapterGenerationRunRecord[];
}) {
	const plannedChapter = input.didacticUnit.chapters[input.moduleIndex];
	if (!plannedChapter) {
		return null;
	}

	const generatedChapter = input.didacticUnit.generatedChapters?.find(
		(chapter) => chapter.chapterIndex === input.moduleIndex,
	);
	const readProgress = getModuleReadProgressRecord(
		input.didacticUnit,
		input.moduleIndex,
	);
	const isCompleted = readProgress?.chapterCompleted ?? false;
	const completedAt = isCompleted ? readProgress?.lastReadAt : undefined;

	return {
		chapterIndex: input.moduleIndex,
		title: generatedChapter?.title ?? plannedChapter.title,
		planningOverview: plannedChapter.overview,
		html: generatedChapter?.html ?? null,
		htmlHash: generatedChapter?.htmlHash,
		htmlBlocks: generatedChapter?.htmlBlocks ?? [],
		htmlBlocksVersion: generatedChapter?.htmlBlocksVersion ?? 0,
		generatedAt: generatedChapter?.generatedAt,
		updatedAt: generatedChapter?.updatedAt,
		state: resolveDidacticUnitChapterState({
			didacticUnit: input.didacticUnit,
			chapterIndex: input.moduleIndex,
			chapterRuns: input.chapterRuns,
		}),
		readBlockIndex: readProgress?.furthestReadBlockIndex ?? 0,
		readBlockOffset: readProgress?.furthestReadBlockOffset,
		readBlocksVersion: readProgress?.furthestReadBlocksVersion ?? 0,
		totalBlocks: generatedChapter?.htmlBlocks.length ?? 0,
		isCompleted,
		completedAt,
		lastVisitedPageIndex: readProgress?.lastVisitedPageIndex,
	};
}

async function recordFailedSyllabusRun(
	generationRunStore: GenerationRunStore,
	didacticUnit: DidacticUnit,
	prompt: string,
	modelConfig: AiModelConfig,
	error: unknown,
): Promise<void> {
	if (!prompt.trim()) {
		return;
	}

	await generationRunStore.save(
		createFailedSyllabusGenerationRunRecord({
			didacticUnitId: didacticUnit.id,
			ownerId: didacticUnit.ownerId,
			provider: modelConfig.provider,
			model: modelConfig.model,
			prompt,
			error:
				error instanceof Error ?
					error.message
				:	"Didactic unit syllabus generation failed.",
			createdAt: new Date().toISOString(),
		}),
	);
}

export function createApp(options: CreateAppOptions) {
	const app = express();
	app.set("etag", false);
	const activeGenerationControllers = new Map<string, AbortController>();
	const didacticUnitStore = options.didacticUnitStore;
	const generationRunStore = options.generationRunStore;
	const learningActivityStore =
		options.learningActivityStore ?? new InMemoryLearningActivityStore();
	const folderStore = options.folderStore;
	const aiConfigStore = options.aiConfigStore ?? new InMemoryAiConfigStore();
	const authConfig = options.authConfig;
	const logger =
		options.logger ??
		createLogger({
			name: "didactio-backend",
		});
	const appLogger = logger.child({component: "app"});
	const aiService = options.aiService ?? new GatewayAiService({logger});
	const mongoHealth = options.mongoHealth ?? disconnectedMongoHealthStatus;
	const userStore = options.userStore ?? new InMemoryUserStore();
	const sessionStore = options.sessionStore ?? new InMemorySessionStore();
	const creditTransactionStore =
		options.creditTransactionStore ?? new InMemoryCreditTransactionStore();
	const billingEventStore =
		options.billingEventStore ?? new InMemoryBillingEventStore();
	const billingConfig =
		options.billingConfig ?? {
			stripeSecretKey: null,
			stripeWebhookSecret: null,
			appPublicUrl: "http://localhost:5173",
			stripePriceIds: {},
		};
	const authService = new AuthService(
		userStore,
		sessionStore,
		creditTransactionStore,
		authConfig,
	);
	const billingService = new BillingService(
		authService,
		userStore,
		billingEventStore,
		billingConfig,
		options.stripeClient,
	);
	const requireAuth = createRequireAuth(authConfig);
	const requireAdmin = createRequireRole("admin");
	const sleep = (milliseconds: number) =>
		new Promise((resolve) => setTimeout(resolve, milliseconds));

	const runModerationJob = async (
		ownerId: string,
		didacticUnitId: string,
	): Promise<void> => {
		const maxAttempts = 3;

		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			const didacticUnit = await didacticUnitStore.getById(
				ownerId,
				didacticUnitId,
			);

			if (
				!didacticUnit ||
				(didacticUnit.status !== "submitted" &&
					didacticUnit.status !==
						"questionnaire_pending_moderation" &&
					didacticUnit.status !== "moderation_failed")
			) {
				return;
			}

			try {
				const config = await aiConfigStore.get(ownerId);
				const folders = await ensureDefaultFolders(
					folderStore,
					ownerId,
				);
				const generalFolder = folders.find(
					(folder) => folder.slug === "general",
				);

				if (!generalFolder) {
					throw new Error("General folder could not be resolved.");
				}

				const moderation = await aiService.moderateTopic({
					topic: didacticUnit.topic,
					level: didacticUnit.level,
					additionalContext: didacticUnit.additionalContext,
					folders:
						didacticUnit.folderAssignmentMode === "auto" ?
							folders.map((folder) => ({
								name: folder.name,
								description: buildFolderDescription(folder),
							}))
						:	undefined,
					config,
					tier: "silver",
				});

				if (!moderation.approved) {
					await didacticUnitStore.save(
						rejectDidacticUnitModeration(
							didacticUnit,
							moderation.notes,
						),
					);
					appLogger.warn("Didactic unit moderation rejected", {
						didacticUnitId,
						notes: moderation.notes,
						reasoningNotes: moderation.reasoningNotes,
					});
					return;
				}

				const moderatedDidacticUnit = moderateDidacticUnitPlanning(
					didacticUnit,
					{
						normalizedTopic: moderation.normalizedTopic,
						improvedTopicBrief: moderation.improvedTopicBrief,
						reasoningNotes: moderation.reasoningNotes,
					},
				);
				const folderUpdatedDidacticUnit =
					moderatedDidacticUnit.folderAssignmentMode === "auto" ?
						updateDidacticUnitFolder(moderatedDidacticUnit, {
							mode: "auto",
							folderId: resolveFolderIdFromModelName({
								folderName: moderation.folderName,
								folders,
								fallbackFolderId: generalFolder.id,
							}),
						})
					:	moderatedDidacticUnit;
				const themedDidacticUnit =
					moderation.stylePreset &&
					!folderUpdatedDidacticUnit.presentationTheme?.stylePreset ?
						{
							...folderUpdatedDidacticUnit,
							presentationTheme: {
								...(folderUpdatedDidacticUnit.presentationTheme ??
									SYSTEM_DEFAULT_THEME),
								stylePreset: moderation.stylePreset,
							},
						}
					:	folderUpdatedDidacticUnit;

				await didacticUnitStore.save(themedDidacticUnit);
				return;
			} catch (error) {
				if (attempt < maxAttempts) {
					await sleep(250 * attempt);
					continue;
				}

				const latest = await didacticUnitStore.getById(
					ownerId,
					didacticUnitId,
				);

				if (latest) {
					await didacticUnitStore.save(
						failDidacticUnitModeration(
							latest,
							error instanceof Error ?
								error.message
							:	"Didactic unit moderation failed.",
							attempt,
						),
					);
				}
				appLogger.error("Didactic unit moderation job failed", {
					didacticUnitId,
					error,
				});
			}
		}
	};

	const enqueueModerationJob = (ownerId: string, didacticUnitId: string) => {
		void runModerationJob(ownerId, didacticUnitId);
	};

	configureGooglePassport(authConfig);
	if (authConfig.trustProxy) {
		app.set("trust proxy", 1);
	}

	app.use(
		cors({
			origin(origin, callback) {
				if (
					!origin ||
					authConfig.corsAllowedOrigins.length === 0 ||
					authConfig.corsAllowedOrigins.includes(origin)
				) {
					callback(null, true);
					return;
				}

				callback(new Error("Origin not allowed by CORS"));
			},
			credentials: true,
		}),
	);
	app.use(helmet());
	app.post(
		"/api/billing/webhook",
		express.raw({type: "application/json"}),
		createBillingWebhookHandler(billingService),
	);
	app.use(express.json());
	app.use(express.urlencoded({extended: true}));
	app.use(cookieParser());
	app.use(passport.initialize());
	app.use((request, response, next) => {
		const requestId = randomUUID();
		const startedAt = Date.now();
		response.setHeader("X-Request-Id", requestId);

		appLogger.info("HTTP request started", {
			requestId,
			method: request.method,
			path: request.originalUrl,
		});

		response.on("finish", () => {
			const requestWithMockOwner =
				request as Partial<RequestWithMockOwner>;

			appLogger.info("HTTP request completed", {
				requestId,
				method: request.method,
				path: request.originalUrl,
				statusCode: response.statusCode,
				durationMs: Date.now() - startedAt,
				ownerId: request.auth?.sub,
			});
		});

		next();
	});

	app.locals.authService = authService;
	app.locals.authConfig = authConfig;
	app.locals.userStore = userStore;
	app.locals.sessionStore = sessionStore;
	app.locals.creditTransactionStore = creditTransactionStore;
	app.locals.billingService = billingService;
	app.locals.billingEventStore = billingEventStore;

	app.use("/auth", createAuthRouter(authConfig, authService, passport));
	app.use("/api", (request, response, next) => {
		response.setHeader(
			"Cache-Control",
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		response.setHeader("Pragma", "no-cache");
		response.setHeader("Expires", "0");
		response.removeHeader("ETag");

		if (request.path === "/health" || request.path === "/billing/pricing") {
			next();
			return;
		}

		if (!request.headers.authorization && options.testPrincipal) {
			request.auth = options.testPrincipal;
			next();
			return;
		}

		requireAuth(request, response, next);
	});
	app.use("/api/admin", requireAdmin, createAdminRouter(authService));
	app.use("/api/billing", createBillingRouter(billingService));

	app.get("/api/health", (_request, response) => {

		response.json({
			status: "ok",
			service: "didactio-backend",
			mongo: mongoHealth,
		});
	});

	app.get("/api/ai-config", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		response.json(
			await aiConfigStore.get(requestWithMockOwner.mockOwner.id),
		);
	});

	app.get("/api/ai-config/catalog", (_request, response) => {
		response.json(MODEL_CATALOG);
	});

	app.patch("/api/ai-config", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);

		try {
			const patch = parseAiConfigPatch(request.body);
			response.json(
				await aiConfigStore.update(
					requestWithMockOwner.mockOwner.id,
					patch,
				),
			);
		} catch (error) {
			response.status(400).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid AI config update request.",
			});
		}
	});

	app.get("/api/analytics/usage", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);

		try {
			const period = parseUsageAnalyticsPeriod(request.query.period);
			response.json(
				await buildUsageAnalytics({
					ownerId: requestWithMockOwner.mockOwner.id,
					period,
					didacticUnitStore,
					folderStore,
					generationRunStore,
				}),
			);
		} catch (error) {
			response.status(400).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid analytics request.",
			});
		}
	});

	app.get("/api/folders", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);

		response.json({
			folders: await listFoldersWithUnitCounts(
				folderStore,
				didacticUnitStore,
				requestWithMockOwner.mockOwner.id,
			),
		});
	});

	app.post("/api/folders", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);

		try {
			if (!request.body || typeof request.body !== "object") {
				throw new Error("Request body must be a JSON object.");
			}

			const payload = request.body as {
				name?: unknown;
				icon?: unknown;
				color?: unknown;
			};
			const name = normalizeFolderName(
				typeof payload.name === "string" ? payload.name : "",
			);
			const icon =
				(
					typeof payload.icon === "string" &&
					payload.icon.trim().length > 0 &&
					payload.icon.trim().length <= 16
				) ?
					payload.icon.trim()
				:	CUSTOM_FOLDER_ICON;
			const color =
				(
					typeof payload.color === "string" &&
					/^#[0-9a-fA-F]{6}$/.test(payload.color.trim())
				) ?
					payload.color.trim()
				:	CUSTOM_FOLDER_COLOR;

			if (!name) {
				throw new Error("Folder name is required.");
			}

			const slug = slugifyFolderName(name);

			if (!slug) {
				throw new Error("Folder name must include letters or numbers.");
			}

			await ensureDefaultFolders(
				folderStore,
				requestWithMockOwner.mockOwner.id,
			);
			const existingFolder = await folderStore.getBySlug(
				requestWithMockOwner.mockOwner.id,
				slug,
			);

			if (existingFolder) {
				throw new Error("A folder with that name already exists.");
			}

			const folder = await folderStore.create({
				ownerId: requestWithMockOwner.mockOwner.id,
				name,
				slug,
				kind: "custom",
				icon,
				color,
			});

			response.status(201).json({
				...buildFolderResponse(folder),
				unitCount: 0,
			});
		} catch (error) {
			response.status(400).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid folder request.",
			});
		}
	});

	app.patch("/api/folders/:id", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const ownerId = requestWithMockOwner.mockOwner.id;
		const folder = await folderStore.getById(ownerId, request.params.id);

		if (!folder) {
			response.status(404).json({error: "Folder not found."});
			return;
		}

		try {
			const payload = request.body as {
				name?: unknown;
				icon?: unknown;
				color?: unknown;
			};
			const patch: {name?: string; icon?: string; color?: string} = {};

			if (typeof payload.name === "string" && payload.name.trim()) {
				patch.name = normalizeFolderName(payload.name);
			}
			if (
				typeof payload.icon === "string" &&
				payload.icon.trim().length > 0 &&
				payload.icon.trim().length <= 16
			) {
				patch.icon = payload.icon.trim();
			}
			if (
				typeof payload.color === "string" &&
				/^#[0-9a-fA-F]{6}$/.test(payload.color.trim())
			) {
				patch.color = payload.color.trim();
			}

			const updated = await folderStore.updateById(
				ownerId,
				request.params.id,
				patch,
			);

			if (!updated) {
				response.status(404).json({error: "Folder not found."});
				return;
			}

			const unitCount = (
				await didacticUnitStore.listByOwner(ownerId)
			).filter((unit) => unit.folderId === updated.id).length;

			response.json({...buildFolderResponse(updated), unitCount});
		} catch (error) {
			response.status(400).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid folder update.",
			});
		}
	});

	app.delete("/api/folders/:id", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const ownerId = requestWithMockOwner.mockOwner.id;
		const folder = await folderStore.getById(ownerId, request.params.id);

		if (!folder) {
			response.status(404).json({error: "Folder not found."});
			return;
		}

		if (folder.slug === "general") {
			response
				.status(403)
				.json({error: "The General folder cannot be removed."});
			return;
		}

		const generalFolder = await getGeneralFolder(folderStore, ownerId);
		const allUnits = await didacticUnitStore.listByOwner(ownerId);
		const unitsInFolder = allUnits.filter(
			(unit) => unit.folderId === folder.id,
		);

		await Promise.all(
			unitsInFolder.map((unit) =>
				didacticUnitStore.save(
					updateDidacticUnitFolder(unit, {
						mode: "manual",
						folderId: generalFolder.id,
					}),
				),
			),
		);

		await folderStore.deleteById(ownerId, request.params.id);
		response.status(204).end();
	});

	app.post("/api/didactic-unit", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);

		try {
			const input = parseCreateDidacticUnitInput(request.body);
			const config = await aiConfigStore.get(
				requestWithMockOwner.mockOwner.id,
			);
			const foldersById = await loadFoldersById(
				folderStore,
				requestWithMockOwner.mockOwner.id,
			);
			const generalFolder = await getGeneralFolder(
				folderStore,
				requestWithMockOwner.mockOwner.id,
			);
			const resolvedFolderSelection =
				input.folderSelection.mode === "manual" ?
					resolveFolderSelectionForManualMode(
						input.folderSelection,
						foldersById,
					)
				:	{
						mode: "auto" as const,
						folderId: generalFolder.id,
					};
			const didacticUnit = createDidacticUnit(
				{
					...input,
					provider: resolveCompatibilityProvider(
						config,
						input.provider,
					),
					folderSelection: resolvedFolderSelection,
				},
				requestWithMockOwner.mockOwner.id,
			);

			await didacticUnitStore.save(didacticUnit);
			enqueueModerationJob(
				requestWithMockOwner.mockOwner.id,
				didacticUnit.id,
			);
			response
				.status(201)
				.json(
					await buildDidacticUnitResponse(didacticUnit, folderStore),
				);
		} catch (error) {
			response.status(400).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid didactic unit request.",
			});
		}
	});

	app.get("/api/didactic-unit", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const didacticUnits = await didacticUnitStore.listByOwner(
			requestWithMockOwner.mockOwner.id,
		);

		response.json({
			didacticUnits: await buildDidacticUnitSummaryResponses(
				didacticUnits,
				folderStore,
				requestWithMockOwner.mockOwner.id,
			),
		});
	});

	app.get("/api/didactic-unit/:id", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const didacticUnit = await didacticUnitStore.getById(
			requestWithMockOwner.mockOwner.id,
			String(request.params.id),
		);

		if (!didacticUnit) {
			response.status(404).json({error: "Didactic unit not found."});
			return;
		}

		response.json(
			await buildDidacticUnitResponse(didacticUnit, folderStore),
		);
	});

	app.delete("/api/didactic-unit/:id", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const deleted = await didacticUnitStore.deleteById(
			requestWithMockOwner.mockOwner.id,
			request.params.id,
		);

		if (!deleted) {
			response.status(404).json({error: "Didactic unit not found."});
			return;
		}

		response.status(204).end();
	});

	app.patch("/api/didactic-unit/:id/folder", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const didacticUnit = await didacticUnitStore.getById(
			requestWithMockOwner.mockOwner.id,
			String(request.params.id),
		);

		if (!didacticUnit) {
			response.status(404).json({error: "Didactic unit not found."});
			return;
		}

		try {
			const parsedInput = parseUpdateDidacticUnitFolderInput(
				request.body,
			);
			const foldersById = await loadFoldersById(
				folderStore,
				requestWithMockOwner.mockOwner.id,
			);

			const updatedDidacticUnit =
				parsedInput.folderSelection.mode === "manual" ?
					updateDidacticUnitFolder(
						didacticUnit,
						resolveFolderSelectionForManualMode(
							parsedInput.folderSelection,
							foldersById,
						),
					)
				:	updateDidacticUnitFolder(didacticUnit, {
						mode: "auto",
						folderId: (
							await resolveAutoAssignedFolderSelection({
								didacticUnit,
								folderStore,
								aiConfigStore,
								aiService,
							})
						).folderId,
					});

			await didacticUnitStore.save(updatedDidacticUnit);
			response.json(
				await buildDidacticUnitResponse(
					updatedDidacticUnit,
					folderStore,
				),
			);
		} catch (error) {
			response.status(400).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid didactic unit folder update request.",
			});
		}
	});

	app.patch("/api/didactic-unit/:id/theme", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const didacticUnit = await didacticUnitStore.getById(
			requestWithMockOwner.mockOwner.id,
			String(request.params.id),
		);

		if (!didacticUnit) {
			response.status(404).json({error: "Didactic unit not found."});
			return;
		}

		try {
			const body = request.body as {presentationTheme?: unknown};
			const presentationTheme =
				body.presentationTheme === null ?
					null
				:	parsePresentationTheme(body.presentationTheme);
			const updatedDidacticUnit: DidacticUnit = {
				...didacticUnit,
				presentationTheme,
				updatedAt: new Date().toISOString(),
			};
			await didacticUnitStore.save(updatedDidacticUnit);
			response.json(
				await buildDidacticUnitResponse(
					updatedDidacticUnit,
					folderStore,
				),
			);
		} catch (error) {
			response.status(422).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid didactic unit theme update request.",
			});
		}
	});

	app.post("/api/didactic-unit/:id/moderate", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const didacticUnit = await didacticUnitStore.getById(
			requestWithMockOwner.mockOwner.id,
			String(request.params.id),
		);

		if (!didacticUnit) {
			response.status(404).json({error: "Didactic unit not found."});
			return;
		}

		if (
			didacticUnit.status !== "submitted" &&
			didacticUnit.status !== "questionnaire_pending_moderation" &&
			didacticUnit.status !== "moderation_failed"
		) {
			response.json(
				await buildDidacticUnitResponse(didacticUnit, folderStore),
			);
			return;
		}

		try {
			const config = await aiConfigStore.get(
				requestWithMockOwner.mockOwner.id,
			);
			const folders = await ensureDefaultFolders(
				folderStore,
				requestWithMockOwner.mockOwner.id,
			);
			const generalFolder = folders.find(
				(folder) => folder.slug === "general",
			);

			if (!generalFolder) {
				throw new Error("General folder could not be resolved.");
			}
			const moderation = await aiService.moderateTopic({
				topic: didacticUnit.topic,
				level: didacticUnit.level,
				additionalContext: didacticUnit.additionalContext,
				folders:
					didacticUnit.folderAssignmentMode === "auto" ?
						folders.map((folder) => ({
							name: folder.name,
							description: buildFolderDescription(folder),
						}))
					:	undefined,
				config,
				tier: "silver",
				abortSignal: createAbortSignal(request),
			});

			if (!moderation.approved) {
				appLogger.warn("Didactic unit moderation rejected", {
					didacticUnitId: didacticUnit.id,
					ownerId: requestWithMockOwner.mockOwner.id,
					topic: didacticUnit.topic,
					notes: moderation.notes,
					reasoningNotes: moderation.reasoningNotes,
				});
				await didacticUnitStore.save(
					rejectDidacticUnitModeration(
						didacticUnit,
						moderation.notes,
					),
				);
				response.status(409).json({error: moderation.notes});
				return;
			}

			const moderatedDidacticUnit = moderateDidacticUnitPlanning(
				didacticUnit,
				{
					normalizedTopic: moderation.normalizedTopic,
					improvedTopicBrief: moderation.improvedTopicBrief,
					reasoningNotes: moderation.reasoningNotes,
				},
			);
			const folderResolvedDidacticUnit =
				moderatedDidacticUnit.folderAssignmentMode === "auto" ?
					updateDidacticUnitFolder(moderatedDidacticUnit, {
						mode: "auto",
						folderId: resolveFolderIdFromModelName({
							folderName: moderation.folderName,
							folders,
							fallbackFolderId: generalFolder.id,
						}),
					})
				:	moderatedDidacticUnit;
			const styledUnit =
				moderation.stylePreset &&
				!folderResolvedDidacticUnit.presentationTheme?.stylePreset ?
					{
						...folderResolvedDidacticUnit,
						presentationTheme: {
							...(folderResolvedDidacticUnit.presentationTheme ??
								SYSTEM_DEFAULT_THEME),
							stylePreset: moderation.stylePreset,
						},
					}
				:	folderResolvedDidacticUnit;
			await didacticUnitStore.save(styledUnit);
			response.json(
				await buildDidacticUnitResponse(
					styledUnit,
					folderStore,
				),
			);
		} catch (error) {
			const resolved = resolveStageConfigError(
				error,
				"Didactic unit moderation failed.",
			);
			response.status(resolved.status).json({error: resolved.message});
		}
	});

	app.post(
		"/api/didactic-unit/:id/moderate/stream",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			if (
				didacticUnit.status !== "submitted" &&
				didacticUnit.status !==
					"questionnaire_pending_moderation" &&
				didacticUnit.status !== "moderation_failed"
			) {
				openNdjsonStream(response);
				writeNdjsonEvent(response, {
					type: "complete",
					data: await buildDidacticUnitResponse(
						didacticUnit,
						folderStore,
					),
				});
				response.end();
				return;
			}

			openNdjsonStream(response);

			try {
				const config = await aiConfigStore.get(
					requestWithMockOwner.mockOwner.id,
				);
				const folders = await ensureDefaultFolders(
					folderStore,
					requestWithMockOwner.mockOwner.id,
				);
				const generalFolder = folders.find(
					(folder) => folder.slug === "general",
				);

				if (!generalFolder) {
					throw new Error("General folder could not be resolved.");
				}
				const moderation = await aiService.streamModeration(
					{
						topic: didacticUnit.topic,
						level: didacticUnit.level,
						additionalContext: didacticUnit.additionalContext,
						folders:
							didacticUnit.folderAssignmentMode === "auto" ?
								folders.map((folder) => ({
									name: folder.name,
									description: buildFolderDescription(folder),
								}))
							:	undefined,
						config,
						tier: "silver",
						abortSignal: createAbortSignal(request),
					},
					{
						onStart: async (selection) => {
							writeNdjsonEvent(response, {
								type: "start",
								stage: "moderation",
								provider: selection.provider,
								model: selection.model,
							});
						},
						onPartial: async (partial) => {
							writeNdjsonEvent(response, {
								type: "partial_structured",
								data: partial,
							});
						},
					},
				);

				if (!moderation.approved) {
					appLogger.warn("Didactic unit moderation rejected", {
						didacticUnitId: didacticUnit.id,
						ownerId: requestWithMockOwner.mockOwner.id,
						topic: didacticUnit.topic,
						notes: moderation.notes,
						reasoningNotes: moderation.reasoningNotes,
						streaming: true,
					});
					await didacticUnitStore.save(
						rejectDidacticUnitModeration(
							didacticUnit,
							moderation.notes,
						),
					);
					writeNdjsonEvent(response, {
						type: "error",
						message: moderation.notes,
					});
					response.end();
					return;
				}

				const moderatedDidacticUnit = moderateDidacticUnitPlanning(
					didacticUnit,
					{
						normalizedTopic: moderation.normalizedTopic,
						improvedTopicBrief: moderation.improvedTopicBrief,
						reasoningNotes: moderation.reasoningNotes,
					},
				);
				const folderResolvedDidacticUnit =
					moderatedDidacticUnit.folderAssignmentMode === "auto" ?
						updateDidacticUnitFolder(moderatedDidacticUnit, {
							mode: "auto",
							folderId: resolveFolderIdFromModelName({
								folderName: moderation.folderName,
								folders,
								fallbackFolderId: generalFolder.id,
							}),
						})
					:	moderatedDidacticUnit;
				await didacticUnitStore.save(folderResolvedDidacticUnit);
				writeNdjsonEvent(response, {
					type: "complete",
					data: await buildDidacticUnitResponse(
						folderResolvedDidacticUnit,
						folderStore,
					),
				});
			} catch (error) {
				const resolved = resolveStageConfigError(
					error,
					"Didactic unit moderation failed.",
				);
				writeNdjsonEvent(response, {
					type: "error",
					message: resolved.message,
				});
			}

			response.end();
		},
	);

	app.patch(
		"/api/didactic-unit/:id/questionnaire/answers",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let parsedInput;
			try {
				parsedInput = parseQuestionnaireAnswersInput(request.body);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid questionnaire answers request.",
				});
				return;
			}

			try {
				const updatedDidacticUnit = answerDidacticUnitQuestionnaire(
					didacticUnit,
					parsedInput,
				);
				await didacticUnitStore.save(updatedDidacticUnit);
				response.json(
					await buildDidacticUnitResponse(
						updatedDidacticUnit,
						folderStore,
					),
				);
			} catch (error) {
				response.status(409).json({
					error:
						error instanceof Error ?
							error.message
						:	"Didactic unit questionnaire answer submission failed.",
				});
			}
		},
	);

	app.post(
		"/api/didactic-unit/:id/syllabus-prompt/generate",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			try {
				const config = await aiConfigStore.get(
					requestWithMockOwner.mockOwner.id,
				);
				const updatedDidacticUnit = generateDidacticUnitSyllabusPrompt(
					didacticUnit,
					config.authoring,
				);
				await didacticUnitStore.save(updatedDidacticUnit);
				response.json(
					await buildDidacticUnitResponse(
						updatedDidacticUnit,
						folderStore,
					),
				);
			} catch (error) {
				response.status(409).json({
					error:
						error instanceof Error ?
							error.message
						:	"Didactic unit syllabus prompt generation failed.",
				});
			}
		},
	);

	app.post(
		"/api/didactic-unit/:id/syllabus/generate/stream",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				request.params.id,
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let tier: AiModelTier;
			try {
				tier = parseAiModelTier(request.body);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit syllabus generation request.",
				});
				return;
			}

			const config = await aiConfigStore.get(
				requestWithMockOwner.mockOwner.id,
			);
			let preparedDidacticUnit: DidacticUnit | null = null;
			let reservation: CreditReservation | null = null;

			let syllabusContext: string | undefined;
			try {
				syllabusContext = parseOptionalSyllabusContext(request.body);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit syllabus generation request.",
				});
				return;
			}

			try {
				reservation = await reserveGenerationCredits({
					authService,
					ownerId: requestWithMockOwner.mockOwner.id,
					cost: resolveSyllabusGenerationCost(),
					reason: "syllabus_generation",
					metadata: {
						operation: "syllabus_generation",
						didacticUnitId: didacticUnit.id,
						quality: tier,
						length: didacticUnit.length,
					},
				});
			} catch (error) {
				if (error instanceof AuthError) {
					sendAuthErrorResponse(response, error);
					return;
				}
				throw error;
			}

			openNdjsonStream(response);

			try {
				preparedDidacticUnit = prepareDidacticUnitSyllabusGeneration(
					didacticUnit,
					config.authoring,
					syllabusContext,
				);
				const result = await aiService.streamSyllabus(
					{
						topic: preparedDidacticUnit.topic,
						level: preparedDidacticUnit.level,
						improvedTopicBrief:
							preparedDidacticUnit.improvedTopicBrief,
						syllabusPrompt:
							preparedDidacticUnit.syllabusPrompt ?? "",
						questionnaireAnswers:
							preparedDidacticUnit.questionnaireAnswers,
						depth: preparedDidacticUnit.depth,
						length: preparedDidacticUnit.length,
						config,
						tier,
						abortSignal: createAbortSignal(request),
					},
					{
						onStart: async (selection) => {
							writeNdjsonEvent(response, {
								type: "start",
								stage: "syllabus",
								provider: selection.provider,
								model: selection.model,
							});
						},
						onPartial: async (partial) => {
							writeNdjsonEvent(response, {
								type: "partial_structured",
								data: partial,
							});
						},
					},
				);

				const updatedDidacticUnit = applyGeneratedDidacticUnitSyllabus(
					preparedDidacticUnit,
					result.syllabus,
				);
				updatedDidacticUnit.provider = result.provider;
				await didacticUnitStore.save(updatedDidacticUnit);
				await recordCompletedSyllabusRun(
					generationRunStore,
					updatedDidacticUnit,
					result,
				);
				writeNdjsonEvent(response, {
					type: "complete",
					data: await buildDidacticUnitResponse(
						updatedDidacticUnit,
						folderStore,
					),
				});
			} catch (error) {
				await recordFailedSyllabusRun(
					generationRunStore,
					didacticUnit,
					preparedDidacticUnit?.syllabusPrompt ??
						didacticUnit.syllabusPrompt ??
						"",
					config[tier],
					error,
				);
				await refundGenerationCredits({
					authService,
					reservation,
					reason: "syllabus_generation_refund",
					metadata: {
						operation: "syllabus_generation",
						didacticUnitId: didacticUnit.id,
						quality: tier,
						error:
							error instanceof Error ?
								error.message
							:	"Didactic unit syllabus generation failed.",
					},
				});
				const resolved = resolveStageConfigError(
					error,
					"Didactic unit syllabus generation failed.",
				);
				writeNdjsonEvent(response, {
					type: "error",
					message: resolved.message,
				});
			}

			response.end();
		},
	);

	app.patch("/api/didactic-unit/:id/syllabus", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const didacticUnit = await didacticUnitStore.getById(
			requestWithMockOwner.mockOwner.id,
			request.params.id,
		);

		if (!didacticUnit) {
			response.status(404).json({error: "Didactic unit not found."});
			return;
		}

		let parsedInput;
		try {
			parsedInput = parseUpdateDidacticUnitSyllabusInput(request.body);
		} catch (error) {
			response.status(400).json({
				error:
					error instanceof Error ?
						error.message
					:	"Invalid syllabus update request.",
			});
			return;
		}

		try {
			const updatedDidacticUnit = updateDidacticUnitSyllabus(
				didacticUnit,
				parsedInput,
			);
			await didacticUnitStore.save(updatedDidacticUnit);
			response.json(
				await buildDidacticUnitResponse(
					updatedDidacticUnit,
					folderStore,
				),
			);
		} catch (error) {
			response.status(409).json({
				error:
					error instanceof Error ?
						error.message
					:	"Didactic unit syllabus update failed.",
			});
		}
	});

	app.post(
		"/api/didactic-unit/:id/approve-syllabus",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				request.params.id,
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let quality: GenerationQuality;
			try {
				quality = parseGenerationQuality(request.body);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit syllabus approval request.",
				});
				return;
			}

			let reservation: CreditReservation | null = null;
			try {
				const cost = resolveUnitGenerationCost({
					quality,
					length: didacticUnit.length,
				});
				reservation = await reserveGenerationCredits({
					authService,
					ownerId: requestWithMockOwner.mockOwner.id,
					cost,
					reason: "unit_generation",
					metadata: {
						operation: "unit_generation",
						didacticUnitId: didacticUnit.id,
						quality,
						length: didacticUnit.length,
					},
				});
				const approvedDidacticUnit = approveDidacticUnitSyllabus(
					didacticUnit,
					{
						generationQuality: quality,
						creditTransactionId: reservation?.transaction.id,
						paidAt:
							reservation?.transaction.createdAt.toISOString() ??
							new Date().toISOString(),
					},
				);
				await didacticUnitStore.save(approvedDidacticUnit);
				response.json(
					await buildDidacticUnitResponse(
						approvedDidacticUnit,
						folderStore,
					),
				);
			} catch (error) {
				if (reservation) {
					await refundGenerationCredits({
						authService,
						reservation,
						reason: "unit_generation_refund",
						metadata: {
							operation: "unit_generation",
							didacticUnitId: didacticUnit.id,
							quality,
							error:
								error instanceof Error ?
									error.message
								:	"Didactic unit syllabus approval failed.",
						},
					});
				}
				if (error instanceof AuthError) {
					sendAuthErrorResponse(response, error);
					return;
				}
				response.status(409).json({
					error:
						error instanceof Error ?
							error.message
						:	"Didactic unit syllabus approval failed.",
				});
			}
		},
	);

	app.get(
		["/api/didactic-unit/:id/chapters", "/api/didactic-unit/:id/modules"],
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			const chapterRuns = (
				await generationRunStore.listByDidacticUnit(
					requestWithMockOwner.mockOwner.id,
					didacticUnit.id,
				)
			).filter(
				(run): run is ChapterGenerationRunRecord =>
					run.stage === "chapter",
			);

			response.json({
				chapters: listDidacticUnitChapters(didacticUnit).map(
					(chapter) => ({
						...chapter,
						state: resolveDidacticUnitChapterState({
							didacticUnit,
							chapterIndex: chapter.chapterIndex,
							chapterRuns,
						}),
					}),
				),
			});
		},
	);

	app.get(
		[
			"/api/didactic-unit/:id/chapters/:chapterIndex",
			"/api/didactic-unit/:id/modules/:chapterIndex",
		],
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			try {
				chapterIndex = parseChapterIndex(
					String(request.params.chapterIndex),
				);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit module lookup request.",
				});
				return;
			}

			const plannedChapter = didacticUnit.chapters[chapterIndex];
			if (!plannedChapter) {
				response
					.status(404)
					.json({error: "Didactic unit module not found."});
				return;
			}

			const chapterRuns = (
				await generationRunStore.listByDidacticUnit(
					requestWithMockOwner.mockOwner.id,
					didacticUnit.id,
				)
			).filter(
				(run): run is ChapterGenerationRunRecord =>
					run.stage === "chapter",
			);
			response.json(
				buildDidacticUnitModuleDetailResponse({
					didacticUnit,
					moduleIndex: chapterIndex,
					chapterRuns,
				}),
			);
		},
	);

	app.get(
		"/api/didactic-unit/:id/modules/:chapterIndex/activities",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const ownerId = requestWithMockOwner.mockOwner.id;
			const didacticUnit = await didacticUnitStore.getById(
				ownerId,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			try {
				chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid learning activity lookup request.",
				});
				return;
			}

			response.json({
				activities: await learningActivityStore.listByModule({
					ownerId,
					didacticUnitId: didacticUnit.id,
					chapterIndex,
				}),
			});
		},
	);

	app.post(
		"/api/didactic-unit/:id/modules/:chapterIndex/activities",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const ownerId = requestWithMockOwner.mockOwner.id;
			const didacticUnit = await didacticUnitStore.getById(
				ownerId,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			let input;
			try {
				chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
				input = parseCreateLearningActivityInput(request.body);
				getGeneratedChapterOrThrow(didacticUnit, chapterIndex);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid learning activity creation request.",
				});
				return;
			}

			if (
				input.type === "freeform_html" &&
				process.env.LEARNING_ACTIVITY_FREEFORM_ENABLED !== "true"
			) {
				response.status(403).json({
					error: "Freeform activity creation is not enabled.",
				});
				return;
			}

			const sourceModuleIndexes = resolveActivitySourceModuleIndexes({
				scope: input.scope,
				chapterIndex,
			});
			const activityPromptPool =
				input.scope === "current_module" ?
					await learningActivityStore.listByModule({
						ownerId,
						didacticUnitId: didacticUnit.id,
						chapterIndex,
					})
				:	await learningActivityStore.listByUnitRange({
						ownerId,
						didacticUnitId: didacticUnit.id,
						maxChapterIndex: chapterIndex,
					});
			const flashcardPromptPool =
				input.type === "flashcards" ?
					(await learningActivityStore.listByUnit({
						ownerId,
						didacticUnitId: didacticUnit.id,
					})).filter((activity) => activity.type === "flashcards")
				:	[];
			const previousActivities = sortPreviousActivitiesForPrompt({
				activities: uniqueLearningActivitiesById([
					...activityPromptPool,
					...flashcardPromptPool,
				]),
				chapterIndex,
				type: input.type,
			});
			const config = await aiConfigStore.get(ownerId);
			let reservation: CreditReservation | null = null;

			try {
				reservation = await reserveGenerationCredits({
					authService,
					ownerId,
					cost: resolveActivityGenerationCost({quality: input.quality}),
					reason: "activity_generation",
					metadata: {
						operation: "activity_generation",
						didacticUnitId: didacticUnit.id,
						chapterIndex,
						scope: input.scope,
						type: input.type,
						quality: input.quality,
					},
				});
			} catch (error) {
				if (error instanceof AuthError) {
					sendAuthErrorResponse(response, error);
					return;
				}
				throw error;
			}

			try {
				const result = await aiService.generateLearningActivity({
					topic: didacticUnit.topic,
					moduleTitle:
						didacticUnit.modules[chapterIndex]?.title ??
						didacticUnit.chapters[chapterIndex]?.title ??
						`Module ${chapterIndex + 1}`,
					scope: input.scope,
					type: input.type,
					contextModules: buildActivityContextModules({
						didacticUnit,
						sourceModuleIndexes,
					}),
					previousActivities: previousActivities.map((activity) => ({
						chapterIndex: activity.chapterIndex,
						type: activity.type,
						title: activity.title,
						instructions: activity.instructions,
						dedupeSummary:
							activity.type === "flashcards" ?
								[
									activity.dedupeSummary,
									"Existing cards:",
									normalizeFlashcardCards(activity.content.cards)
										.slice(0, 80)
										.map(
											(card) =>
												`${normalizeFlashcardText(card.front)} -> ${normalizeFlashcardText(card.back)}`,
										)
										.join("; "),
								]
									.filter(Boolean)
									.join(" ")
							:	activity.dedupeSummary,
					})),
					config,
					tier: input.quality,
					abortSignal: createAbortSignal(request),
				});
				const now = new Date().toISOString();
				const existingFlashcardActivity =
					input.type === "flashcards" ?
						(await learningActivityStore.listByUnit({
							ownerId,
							didacticUnitId: didacticUnit.id,
						}))
							.filter((activity) => activity.type === "flashcards")
							.sort((left, right) =>
								left.createdAt.localeCompare(right.createdAt),
							)[0]
					:	null;
				const activityId = existingFlashcardActivity?.id ?? randomUUID();
				const run = createCompletedActivityGenerationRunRecord({
					didacticUnitId: didacticUnit.id,
					ownerId,
					chapterIndex,
					activityId,
					activityType: input.type,
					scope: input.scope,
					provider: result.provider,
					model: result.model,
					prompt: result.prompt,
					rawOutput: JSON.stringify(result.raw),
					coinTxId: reservation?.transaction.id,
					createdAt: now,
					telemetry: result.telemetry,
				});
				await generationRunStore.save(run);
				const activity: LearningActivity =
					input.type === "flashcards" ?
						await resolveCanonicalFlashcardActivity({
							learningActivityStore,
							ownerId,
							didacticUnitId: didacticUnit.id,
							chapterIndex,
							sourceModuleIndexes,
							quality: input.quality,
							result,
							generationRunId: run.id,
							activityId,
							now,
						})
					:	{
							id: activityId,
							ownerId,
							didacticUnitId: didacticUnit.id,
							chapterIndex,
							scope: input.scope,
							type: input.type,
							quality: input.quality,
							title: result.title,
							instructions: result.instructions,
							content: result.content,
							dedupeSummary: result.dedupeSummary,
							sourceModuleIndexes,
							feedbackAttemptLimit: 3,
							generationRunId: run.id,
							createdAt: now,
							updatedAt: now,
						};
				await learningActivityStore.saveActivity(activity);
				response.status(201).json({activity});
			} catch (error) {
				await refundGenerationCredits({
					authService,
					reservation,
					reason: "activity_generation_refund",
					metadata: {
						operation: "activity_generation",
						didacticUnitId: didacticUnit.id,
						chapterIndex,
						scope: input.scope,
						type: input.type,
						quality: input.quality,
						error:
							error instanceof Error ?
								error.message
							:	"Learning activity generation failed.",
					},
				});
				await generationRunStore.save(
					createFailedActivityGenerationRunRecord({
						didacticUnitId: didacticUnit.id,
						ownerId,
						chapterIndex,
						activityType: input.type,
						scope: input.scope,
						provider: config[input.quality].provider,
						model: config[input.quality].model,
						prompt: "",
						error:
							error instanceof Error ?
								error.message
							:	"Learning activity generation failed.",
						coinTxId: reservation?.transaction.id,
						createdAt: new Date().toISOString(),
					}),
				);
				const resolved = resolveStageConfigError(
					error,
					"Learning activity generation failed.",
				);
				response.status(resolved.status).json({error: resolved.message});
			}
		},
	);

	app.get("/api/activities/:activityId/progress", async (request, response) => {
		const ownerId = asRequestWithMockOwner(request).mockOwner.id;
		const activity = await learningActivityStore.getActivity(
			ownerId,
			String(request.params.activityId),
		);
		if (!activity) {
			response.status(404).json({error: "Learning activity not found."});
			return;
		}
		const progress = await learningActivityStore.getProgress(ownerId, activity.id);
		response.json({progress});
	});

	app.put("/api/activities/:activityId/progress", async (request, response) => {
		const ownerId = asRequestWithMockOwner(request).mockOwner.id;
		const activity = await learningActivityStore.getActivity(
			ownerId,
			String(request.params.activityId),
		);
		if (!activity) {
			response.status(404).json({error: "Learning activity not found."});
			return;
		}
		const {confirmedAnswers, answers, completed} = request.body as {
			confirmedAnswers: LearningActivityProgress["confirmedAnswers"];
			answers?: LearningActivityProgress["answers"];
			completed: boolean;
		};
		const progress: LearningActivityProgress = {
			activityId: activity.id,
			ownerId,
			confirmedAnswers: confirmedAnswers ?? {},
			answers:
				answers && typeof answers === "object" && !Array.isArray(answers) ?
					answers
				:	undefined,
			completed: completed ?? false,
			updatedAt: new Date().toISOString(),
		};
		await learningActivityStore.saveProgress(progress);
		response.json({progress});
	});

	app.get("/api/activities/:activityId", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const ownerId = requestWithMockOwner.mockOwner.id;
		const activity = await learningActivityStore.getActivity(
			ownerId,
			String(request.params.activityId),
		);

		if (!activity) {
			response.status(404).json({error: "Learning activity not found."});
			return;
		}

		response.json({
			activity,
			attempts: await learningActivityStore.listAttempts(ownerId, activity.id),
		});
	});

	app.get(
		"/api/activities/:activityId/attempts",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const ownerId = requestWithMockOwner.mockOwner.id;
			const activity = await learningActivityStore.getActivity(
				ownerId,
				String(request.params.activityId),
			);

			if (!activity) {
				response.status(404).json({error: "Learning activity not found."});
				return;
			}

			response.json({
				attempts: await learningActivityStore.listAttempts(ownerId, activity.id),
			});
		},
	);

	app.post(
		"/api/activities/:activityId/refill",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const ownerId = requestWithMockOwner.mockOwner.id;
			const activity = await learningActivityStore.getActivity(
				ownerId,
				String(request.params.activityId),
			);

			if (!activity) {
				response.status(404).json({error: "Learning activity not found."});
				return;
			}

			const cost = resolveActivityFeedbackRefillCost({quality: activity.quality});

			try {
				await reserveGenerationCredits({
					authService,
					ownerId,
					cost,
					reason: "activity_feedback_refill",
					metadata: {
						operation: "activity_feedback_refill",
						activityId: activity.id,
						quality: activity.quality,
					},
				});
			} catch (error) {
				if (error instanceof AuthError) {
					sendAuthErrorResponse(response, error);
					return;
				}
				throw error;
			}

			const updatedActivity: LearningActivity = {
				...activity,
				feedbackAttemptLimit: activity.feedbackAttemptLimit + 3,
				updatedAt: new Date().toISOString(),
			};
			await learningActivityStore.saveActivity(updatedActivity);
			response.json({activity: updatedActivity});
		},
	);

	app.post(
		"/api/activities/:activityId/attempts",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const ownerId = requestWithMockOwner.mockOwner.id;
			const activity = await learningActivityStore.getActivity(
				ownerId,
				String(request.params.activityId),
			);

			if (!activity) {
				response.status(404).json({error: "Learning activity not found."});
				return;
			}

			let answers: unknown;
			try {
				answers = parseAttemptAnswers(request.body);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid learning activity attempt request.",
				});
				return;
			}

			const existingAttempts = await learningActivityStore.listAttempts(
				ownerId,
				activity.id,
			);
			if (existingAttempts.length >= activity.feedbackAttemptLimit) {
				response.status(409).json({
					error: "No feedback attempts remain for this activity.",
				});
				return;
			}

			const now = new Date().toISOString();
			const attemptId = randomUUID();
			try {
				let score: number | undefined;
				let feedback: string;
				let strengths: string[] | undefined;
				let improvements: string[] | undefined;
				let questionFeedback: LearningActivityAttempt["questionFeedback"];

				if (OBJECTIVE_ACTIVITY_TYPES.has(activity.type)) {
					const result = gradeObjectiveActivity({activity, answers});
					score = result.score;
					feedback = result.feedback;
				} else {
					const didacticUnit = await didacticUnitStore.getById(
						ownerId,
						activity.didacticUnitId,
					);
					if (!didacticUnit) {
						response.status(404).json({error: "Didactic unit not found."});
						return;
					}
					const config = await aiConfigStore.get(ownerId);
					const result =
						await aiService.generateLearningActivityFeedback({
							activityTitle: activity.title,
							activityType: activity.type,
							instructions: activity.instructions,
							content: activity.content,
							answers,
							config,
							tier: activity.quality,
							abortSignal: createAbortSignal(request),
						});
					score = result.score;
					questionFeedback = result.questionFeedback;
					strengths = result.strengths;
					improvements = result.improvements;
					feedback = result.feedback;
					await generationRunStore.save(
						createCompletedActivityFeedbackRunRecord({
							didacticUnitId: activity.didacticUnitId,
							ownerId,
							chapterIndex: activity.chapterIndex,
							activityId: activity.id,
							attemptId,
							provider: result.provider,
							model: result.model,
							prompt: result.prompt,
							rawOutput: JSON.stringify({
								score: result.score,
								feedback: result.feedback,
								strengths: result.strengths,
								improvements: result.improvements,
								questionFeedback: result.questionFeedback,
							}),
							createdAt: now,
							telemetry: result.telemetry,
						}),
					);
				}

				const attempt: LearningActivityAttempt = {
					id: attemptId,
					activityId: activity.id,
					ownerId,
					answers,
					score,
					feedback,
					strengths,
					improvements,
					questionFeedback,
					completedAt: now,
				};
				await learningActivityStore.saveAttempt(attempt);
				response.status(201).json({attempt});
			} catch (error) {
				const resolved = resolveStageConfigError(
					error,
					"Learning activity feedback failed.",
				);
				response.status(resolved.status).json({error: resolved.message});
			}
		},
	);

	app.get(
		[
			"/api/didactic-unit/:id/chapters/:chapterIndex/revisions",
			"/api/didactic-unit/:id/modules/:chapterIndex/revisions",
		],
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			try {
				chapterIndex = parseChapterIndex(
					String(request.params.chapterIndex),
				);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit module revision lookup request.",
				});
				return;
			}

			const revisions = (didacticUnit.chapterRevisions ?? [])
				.filter((revision) => revision.chapterIndex === chapterIndex)
				.sort((left, right) =>
					right.createdAt.localeCompare(left.createdAt),
				);

			if (revisions.length === 0) {
				response
					.status(404)
					.json({error: "Didactic unit module revisions not found."});
				return;
			}

			response.json({revisions});
		},
	);

	app.get("/api/didactic-unit/:id/runs", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const didacticUnit = await didacticUnitStore.getById(
			requestWithMockOwner.mockOwner.id,
			String(request.params.id),
		);

		if (!didacticUnit) {
			response.status(404).json({error: "Didactic unit not found."});
			return;
		}

		response.json({
			runs: (
				await generationRunStore.listByDidacticUnit(
					requestWithMockOwner.mockOwner.id,
					didacticUnit.id,
				)
			).sort(compareRunsByCreatedAtDesc),
		});
	});

	app.post(
		[
			"/api/didactic-unit/:id/chapters/:chapterIndex/complete",
			"/api/didactic-unit/:id/modules/:chapterIndex/complete",
		],
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			try {
				chapterIndex = parseChapterIndex(
					String(request.params.chapterIndex),
				);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit module completion request.",
				});
				return;
			}

			try {
				const updatedDidacticUnit = completeDidacticUnitChapter(
					didacticUnit,
					chapterIndex,
				);
				await didacticUnitStore.save(updatedDidacticUnit);
				response.json(
					await buildDidacticUnitResponse(
						updatedDidacticUnit,
						folderStore,
					),
				);
			} catch (error) {
				const message =
					error instanceof Error ?
						error.message
					:	"Didactic unit module completion failed.";
				response
					.status(
						(
							message ===
								"Generated didactic unit module not found."
						) ?
							404
						:	409,
					)
					.json({error: message});
			}
		},
	);

	app.put(
		[
			"/api/didactic-unit/:id/chapters/:chapterIndex/reading-progress",
			"/api/didactic-unit/:id/modules/:chapterIndex/reading-progress",
		],
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			try {
				chapterIndex = parseChapterIndex(
					String(request.params.chapterIndex),
				);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit module reading progress request.",
				});
				return;
			}

			try {
				const parsedInput = parseModuleReadProgressInput(request.body);
				const updatedDidacticUnit =
					updateDidacticUnitModuleReadProgress(
						didacticUnit,
						chapterIndex,
						parsedInput.readBlockIndex,
						parsedInput.lastVisitedPageIndex,
						parsedInput.readBlockOffset,
					);
				await didacticUnitStore.save(updatedDidacticUnit);

				response.json({
					module: buildDidacticUnitModuleDetailResponse({
						didacticUnit: updatedDidacticUnit,
						moduleIndex: chapterIndex,
						chapterRuns: [],
					}),
					studyProgress:
						summarizeDidacticUnitStudyProgress(updatedDidacticUnit),
				});
			} catch (error) {
				const message =
					error instanceof Error ?
						error.message
					:	"Didactic unit module reading progress update failed.";
				response
					.status(
						(
							message ===
								"Generated didactic unit module not found."
						) ?
							404
						:	409,
					)
					.json({error: message});
			}
		},
	);

	app.patch(
		[
			"/api/didactic-unit/:id/chapters/:chapterIndex",
			"/api/didactic-unit/:id/modules/:chapterIndex",
		],
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const didacticUnit = await didacticUnitStore.getById(
				requestWithMockOwner.mockOwner.id,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			try {
				chapterIndex = parseChapterIndex(
					String(request.params.chapterIndex),
				);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit module update request.",
				});
				return;
			}

			let parsedInput;
			try {
				parsedInput = parseUpdateDidacticUnitChapterInput(request.body);
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit module update request.",
				});
				return;
			}

			try {
				const updatedDidacticUnit = updateDidacticUnitChapter(
					didacticUnit,
					chapterIndex,
					parsedInput,
				);
				await didacticUnitStore.save(updatedDidacticUnit);
				response.json(
					buildDidacticUnitModuleDetailResponse({
						didacticUnit: updatedDidacticUnit,
						moduleIndex: chapterIndex,
						chapterRuns: [],
					}),
				);
			} catch (error) {
				const message =
					error instanceof Error ?
						error.message
					:	"Didactic unit module update failed.";
				response
					.status(
						(
							message ===
								"Generated didactic unit module not found."
						) ?
							404
						:	409,
					)
					.json({error: message});
			}
		},
	);

	app.post(
		"/api/didactic-unit/:id/modules/:chapterIndex/generate-run",
		async (request, response) => {
			const requestWithMockOwner = asRequestWithMockOwner(request);
			const ownerId = requestWithMockOwner.mockOwner.id;
			const didacticUnit = await didacticUnitStore.getById(
				ownerId,
				String(request.params.id),
			);

			if (!didacticUnit) {
				response.status(404).json({error: "Didactic unit not found."});
				return;
			}

			let chapterIndex;
			try {
				chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
			} catch (error) {
				response.status(400).json({
					error:
						error instanceof Error ?
							error.message
						:	"Invalid didactic unit module generation request.",
				});
				return;
			}

			const plannedChapter = didacticUnit.chapters[chapterIndex];
			if (!plannedChapter) {
				response.status(400).json({
					error: "Module index is out of range for the approved syllabus.",
				});
				return;
			}

			const activeRun = await generationRunStore.findActiveChapterRun(
				ownerId,
				didacticUnit.id,
				chapterIndex,
			);
			if (activeRun) {
				response.status(202).json({runId: activeRun.id, run: activeRun});
				return;
			}

			const quality =
				didacticUnit.generationQuality ??
				legacyTierToGenerationQuality(didacticUnit.generationTier);
			if (!quality || !didacticUnit.unitGenerationPaidAt) {
				response.status(409).json({
					error: "Unit generation must be paid for before modules can be generated.",
				});
				return;
			}

			let reservation: CreditReservation | null = null;
			const isRegeneration = hasGeneratedDidacticUnitChapter(
				didacticUnit,
				chapterIndex,
			);
			if (isRegeneration) {
				try {
					reservation = await reserveGenerationCredits({
						authService,
						ownerId,
						cost: resolveModuleRegenerationCost({quality}),
						reason: "module_regeneration",
						metadata: {
							operation: "module_regeneration",
							didacticUnitId: didacticUnit.id,
							chapterIndex,
							quality,
							length: didacticUnit.length,
						},
					});
				} catch (error) {
					if (error instanceof AuthError) {
						sendAuthErrorResponse(response, error);
						return;
					}
					throw error;
				}
			}

			const config = await aiConfigStore.get(ownerId);
			const run = createQueuedChapterGenerationRunRecord({
				didacticUnitId: didacticUnit.id,
				ownerId,
				chapterIndex,
				provider: config[quality].provider,
				model: config[quality].model,
				coinTxId: reservation?.transaction.id,
			});
			await generationRunStore.save(run);
			response.status(202).json({runId: run.id, run});

			const generationAbortController = new AbortController();
			activeGenerationControllers.set(run.id, generationAbortController);

			void (async () => {
				let currentRun: ChapterGenerationRunRecord = {
					...run,
					status: "running",
					attempts: 1,
					updatedAt: new Date().toISOString(),
				};
				await generationRunStore.save(currentRun);

				try {
					for (let attempt = 1; attempt <= 2; attempt += 1) {
						currentRun = {
							...currentRun,
							status: attempt === 1 ? "running" : "retrying",
							attempts: attempt,
							emittedBlocks: [],
							updatedAt: new Date().toISOString(),
						};
						await generationRunStore.save(currentRun);

						try {
							const latestUnit = await didacticUnitStore.getById(
								ownerId,
								didacticUnit.id,
							);
							if (!latestUnit) {
								throw new Error("Didactic unit not found.");
							}

							const referenceSyllabus =
								latestUnit.referenceSyllabus ??
								adaptDidacticUnitSyllabusToReferenceSyllabus({
									topic: latestUnit.topic,
									syllabus: latestUnit.syllabus ?? {
										title: latestUnit.title,
										overview: latestUnit.overview,
										learningGoals: latestUnit.learningGoals,
										keywords: latestUnit.keywords,
										chapters: latestUnit.chapters,
									},
								});
							const blockAccumulator = createHtmlBlockAccumulator({
								chapterId: `${latestUnit.topic}:${chapterIndex}`,
								onBlock: async (block) => {
									currentRun = {
										...currentRun,
										emittedBlocks: [
											...(currentRun.emittedBlocks ?? []),
											block,
										],
										updatedAt: new Date().toISOString(),
									};
									await generationRunStore.save(currentRun);
								},
							});

							const result = await aiService.streamChapter(
								{
									topic: latestUnit.topic,
									level: latestUnit.level,
									syllabus: referenceSyllabus,
									chapterIndex,
									questionnaireAnswers:
										latestUnit.questionnaireAnswers,
									continuitySummaries:
										latestUnit.continuitySummaries,
									depth: latestUnit.depth,
									length: latestUnit.length,
									additionalContext:
										latestUnit.additionalContext,
									instruction: parseChapterGenerationInstruction(
										request.body,
									),
									config,
									tier: quality,
									abortSignal: generationAbortController.signal,
								},
								{
									onHtml: async (delta) => {
										await blockAccumulator.ingest(delta);
									},
								},
							);

							const updatedDidacticUnit =
								applyGeneratedDidacticUnitChapter(
									latestUnit,
									chapterIndex,
									result.chapter,
									hasGeneratedDidacticUnitChapter(
										latestUnit,
										chapterIndex,
									) ?
										"ai_regeneration"
									:	"ai_generation",
									result.continuitySummary,
								);
							updatedDidacticUnit.provider = result.provider;
							await didacticUnitStore.save(updatedDidacticUnit);

							currentRun = {
								...currentRun,
								status: "completed",
								provider: result.provider,
								model: result.model,
								prompt: result.prompt,
								chapter: result.chapter,
								rawOutput: result.html,
								emittedBlocks: result.chapter.htmlBlocks,
								finalHtml: result.chapter.html,
								finalHash: result.chapter.htmlHash,
								htmlBlocksVersion:
									result.chapter.htmlBlocksVersion,
								telemetry: result.telemetry,
								updatedAt: new Date().toISOString(),
								completedAt: new Date().toISOString(),
							};
							await generationRunStore.save(currentRun);
							return;
						} catch (error) {
							if (attempt < 2) {
								continue;
							}
							throw error;
						}
					}
				} catch (error) {
					const message =
						error instanceof Error ?
							error.message
						:	"Didactic unit module generation failed.";
					if (reservation) {
						await refundGenerationCredits({
							authService,
							reservation,
							reason: "module_regeneration_refund",
							metadata: {
								operation: "module_regeneration",
								didacticUnitId: didacticUnit.id,
								chapterIndex,
								quality,
								error: message,
							},
						});
					}
					await generationRunStore.save({
						...currentRun,
						status: "failed",
						error: message,
						errorMessage: message,
						refundTxId:
							reservation ? `refund:${reservation.transaction.id}` : undefined,
						updatedAt: new Date().toISOString(),
						completedAt: new Date().toISOString(),
					});
				} finally {
					activeGenerationControllers.delete(run.id);
				}
			})();
		},
	);

	app.post("/api/generation-runs/:runId/cancel", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const ownerId = requestWithMockOwner.mockOwner.id;
		const runId = String(request.params.runId);
		const run = await generationRunStore.getById(ownerId, runId);

		if (!run) {
			response.status(404).json({error: "Generation run not found."});
			return;
		}

		if (isTerminalGenerationRun(run)) {
			response.status(409).json({error: "Generation run is already complete."});
			return;
		}

		activeGenerationControllers.get(runId)?.abort();
		activeGenerationControllers.delete(runId);

		await generationRunStore.save({
			...run,
			status: "failed",
			error: "Cancelled by user.",
			errorMessage: "Cancelled by user.",
			updatedAt: new Date().toISOString(),
			completedAt: new Date().toISOString(),
		} as ChapterGenerationRunRecord);

		response.status(200).json({ok: true});
	});

	app.get("/api/generation-runs/:runId", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const run = await generationRunStore.getById(
			requestWithMockOwner.mockOwner.id,
			String(request.params.runId),
		);
		if (!run) {
			response.status(404).json({error: "Generation run not found."});
			return;
		}

		response.json({run});
	});

	app.get("/api/generation-runs/:runId/stream", async (request, response) => {
		const requestWithMockOwner = asRequestWithMockOwner(request);
		const ownerId = requestWithMockOwner.mockOwner.id;
		const runId = String(request.params.runId);
		let run = await generationRunStore.getById(ownerId, runId);
		if (!run) {
			response.status(404).json({error: "Generation run not found."});
			return;
		}

		openNdjsonStream(response);
		writeNdjsonEvent(response, {
			type: "start",
			stage: run.stage === "chapter" ? "module" : run.stage,
			provider: run.provider,
			model: run.model,
		});

		let emittedCount = 0;
		const replay = (current: GenerationRun) => {
			if (current.stage !== "chapter") {
				return;
			}
			const blocks = current.emittedBlocks ?? [];
			for (const block of blocks.slice(emittedCount)) {
				writeNdjsonEvent(response, {type: "partial_html_block", block});
			}
			emittedCount = blocks.length;
		};

		replay(run);
		if (isTerminalGenerationRun(run)) {
			if (run.status === "completed") {
				writeNdjsonEvent(response, {type: "complete", data: {run}});
			} else {
				writeNdjsonEvent(response, {
					type: "error",
					message: run.errorMessage ?? run.error ?? "Generation failed.",
					data: {run},
				});
			}
			response.end();
			return;
		}

		const interval = setInterval(async () => {
			run = await generationRunStore.getById(ownerId, runId);
			if (!run) {
				clearInterval(interval);
				writeNdjsonEvent(response, {
					type: "error",
					message: "Generation run was removed.",
				});
				response.end();
				return;
			}
			replay(run);
			if (!isTerminalGenerationRun(run)) {
				return;
			}

			clearInterval(interval);
			if (run.status === "completed") {
				writeNdjsonEvent(response, {type: "complete", data: {run}});
			} else {
				writeNdjsonEvent(response, {
					type: "error",
					message: run.errorMessage ?? run.error ?? "Generation failed.",
					data: {run},
				});
			}
			response.end();
		}, 500);

		request.on("close", () => {
			clearInterval(interval);
		});
	});

	app.use(authErrorHandler);

	return app;
}
