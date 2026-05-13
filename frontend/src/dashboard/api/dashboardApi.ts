import {authClient} from "../../auth/authClient";
import type {PlanningQuestion, PlanningSyllabus} from "../types";
import type {PresentationTheme} from "../../types/presentationTheme";

export class DashboardApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

type BackendProvider = string;
export type BackendGenerationQuality = "silver" | "gold";
export type BackendCoinType = "bronze" | "silver" | "gold";
export type BackendAiModelTier = BackendGenerationQuality;
export type BackendBillingProductKind = "credit_pack" | "subscription";

export interface BackendBillingProduct {
	id: string;
	kind: BackendBillingProductKind;
	name: string;
	description: string;
	priceLabel: string;
	interval?: "/month";
	stripePriceEnvKey: string;
	stripeConfigured: boolean;
	credits: Record<BackendCoinType, number>;
	subscriptionTier?: "teacher" | "teacher_pro";
	recommended?: boolean;
	unlimitedBronze?: boolean;
	features: string[];
}

export interface BackendBillingSummary {
	billing?: {
		stripeCustomerId?: string;
		stripeSubscriptionId?: string;
		subscriptionTier?: "teacher" | "teacher_pro";
		subscriptionStatus?: string;
		currentPeriodStart?: string;
		currentPeriodEnd?: string;
		cancelAtPeriodEnd?: boolean;
		bronzeFairUseActive?: boolean;
	};
	pricing: {
		products: BackendBillingProduct[];
	};
}

export type BackendUsageAnalyticsPeriod = "7d" | "30d" | "6m" | "12m";

export interface BackendUsageAnalytics {
	period: BackendUsageAnalyticsPeriod;
	unitsCreated: number;
	aiGenerations: number;
	completionRate: number;
	readBlockCount: number;
	totalBlockCount: number;
	favoriteModel: {
		provider: string;
		model: string;
		label: string;
		count: number;
	} | null;
	favoriteTopic: (BackendFolder & {unitCount: number}) | null;
	chart: Array<{
		key: string;
		label: string;
		count: number;
	}>;
}

export type BackendLearningActivityScope =
	| "current_module"
	| "cumulative_until_module";
export type BackendLearningActivityType =
	| "multiple_choice"
	| "short_answer"
	| "coding_practice"
	| "flashcards"
	| "matching"
	| "ordering"
	| "case_study"
	| "debate_reflection"
	| "cloze"
	| "guided_project"
	| "freeform_html";

export interface BackendLearningActivity {
	id: string;
	ownerId: string;
	didacticUnitId: string;
	chapterIndex: number;
	scope: BackendLearningActivityScope;
	type: BackendLearningActivityType;
	quality: BackendGenerationQuality;
	title: string;
	instructions: string;
	content: Record<string, unknown>;
	dedupeSummary: string;
	sourceModuleIndexes: number[];
	feedbackAttemptLimit: number;
	generationRunId?: string;
	createdAt: string;
	updatedAt: string;
}

export interface BackendLearningActivityAttempt {
	id: string;
	activityId: string;
	ownerId: string;
	answers: unknown;
	score?: number;
	feedback: string;
	completedAt: string;
}

export interface BackendActivityProgress {
	activityId: string;
	ownerId: string;
	confirmedAnswers: Record<string, {
		selectedOptionId: string;
		isCorrect: boolean;
		correctOptionId: string;
		explanation: string;
	}>;
	completed: boolean;
	updatedAt: string;
}

export interface BackendFolder {
	id: string;
	name: string;
	slug: string;
	icon: string;
	color: string;
	kind: "default" | "custom";
	unitCount: number;
}

export interface BackendHtmlContentBlock {
	id: string;
	type:
		| "heading"
		| "paragraph"
		| "blockquote"
		| "list"
		| "table"
		| "code"
		| "divider";
	html: string;
	textLength: number;
	textStartOffset: number;
	textEndOffset: number;
}

export type BackendAiModelConfig = {
	provider: string;
	model: string;
};

export type BackendModelEntry = {
	id: string;
	label: string;
	description: string;
	recommended?: boolean;
};

export type BackendModelCatalog = {
	silver: BackendModelEntry[];
	gold: BackendModelEntry[];
};

export type BackendAuthoringConfig = {
	language: string;
	tone: "friendly" | "neutral" | "professional";
	learnerLevel: "beginner" | "intermediate" | "advanced";
	extraInstructions?: string;
};

export type BackendAiConfig = {
	silver: BackendAiModelConfig;
	gold: BackendAiModelConfig;
	authoring: BackendAuthoringConfig;
};

export interface BackendDidacticUnitSummary {
	id: string;
	title: string;
	topic: string;
	folderId: string;
	folder: Omit<BackendFolder, "unitCount">;
	provider: BackendProvider;
	status: string;
	nextAction: string;
	overview: string;
	moduleCount: number;
	generatedChapterCount: number;
	readBlockCount: number;
	totalBlockCount: number;
	progressPercent: number;
	studyProgressPercent: number;
	createdAt: string;
	lastActivityAt: string;
}

export interface BackendQuestionnaire {
	questions: PlanningQuestion[];
}

export interface BackendQuestionAnswer {
	questionId: string;
	value: string;
}

export interface BackendDidacticUnitDetail {
	id: string;
	ownerId: string;
	topic: string;
	title: string;
	folderId: string;
	folderAssignmentMode: "manual" | "auto";
	folder: Omit<BackendFolder, "unitCount">;
	presentationTheme: PresentationTheme | null;
	provider: BackendProvider;
	status: string;
	nextAction: string;
	createdAt: string;
	updatedAt: string;
	moderatedAt?: string;
	moderationError?: string;
	moderationAttempts?: number;
	improvedTopicBrief?: string;
	reasoningNotes?: string;
	additionalContext?: string;
	level: "beginner" | "intermediate" | "advanced";
	depth: "basic" | "intermediate" | "technical";
	length: "intro" | "short" | "long" | "textbook";
	generationTier?: BackendAiModelTier;
	generationQuality?: BackendGenerationQuality;
	unitGenerationPaidAt?: string;
	unitGenerationCreditTransactionId?: string;
	questionnaireEnabled: boolean;
	questionnaire?: BackendQuestionnaire;
	questionnaireAnswers?: BackendQuestionAnswer[];
	syllabusPrompt?: string;
	syllabus?: PlanningSyllabus;
	overview: string;
	learningGoals: string[];
	chapters: Array<{
		title: string;
		overview: string;
		keyPoints: string[];
	}>;
	studyProgress: {
		moduleCount: number;
		readBlockCount: number;
		totalBlockCount: number;
		studyProgressPercent: number;
	};
}

export interface BackendDidacticUnitChapterSummary {
	chapterIndex: number;
	title: string;
	overview: string;
	hasGeneratedContent: boolean;
	readBlockIndex: number;
	readBlockOffset?: number;
	readBlocksVersion: number;
	totalBlocks: number;
	lastVisitedPageIndex?: number;
	isCompleted: boolean;
	state: "pending" | "ready" | "failed";
	generatedAt?: string;
	updatedAt?: string;
	completedAt?: string;
}

export interface BackendDidacticUnitChapterDetail {
	chapterIndex: number;
	title: string;
	planningOverview: string;
	html: string | null;
	htmlHash?: string;
	htmlBlocks: BackendHtmlContentBlock[];
	htmlBlocksVersion: number;
	state: "pending" | "ready" | "failed";
	readBlockIndex: number;
	readBlockOffset?: number;
	readBlocksVersion: number;
	totalBlocks: number;
	lastVisitedPageIndex?: number;
	isCompleted: boolean;
	generatedAt?: string;
	updatedAt?: string;
	completedAt?: string;
}

export interface BackendDidacticUnitReadingProgressResponse {
	module: BackendDidacticUnitChapterDetail | null;
	studyProgress: {
		moduleCount: number;
		readBlockCount: number;
		totalBlockCount: number;
		studyProgressPercent: number;
	};
}

export interface BackendDidacticUnitChapterRevision {
	id: string;
	chapterIndex: number;
	source: "ai_generation" | "ai_regeneration" | "manual_edit";
	createdAt: string;
	chapter: {
		title: string;
		html: string;
		htmlHash: string;
		htmlBlocks: BackendHtmlContentBlock[];
		htmlBlocksVersion: number;
	};
}

export interface BackendGenerationRun {
	id: string;
	stage: "syllabus" | "chapter";
	status:
		| "payment_pending"
		| "queued"
		| "running"
		| "retrying"
		| "completed"
		| "failed"
		| "payment_failed";
	didacticUnitId?: string;
	unitId?: string;
	ownerId?: string;
	userId?: string;
	provider: BackendProvider;
	model: string;
	prompt: string;
	createdAt: string;
	updatedAt?: string;
	error?: string;
	errorMessage?: string;
	chapterIndex?: number;
	attempts?: number;
	emittedBlocks?: BackendHtmlContentBlock[];
	finalHtml?: string;
	finalHash?: string;
	htmlBlocksVersion?: number;
	completedAt?: string;
	rawOutput?: string;
	telemetry?: {
		durationMs?: number;
		finishReason?: string;
		rawFinishReason?: string;
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
			inputTokenDetails?: {
				noCacheTokens?: number;
				cacheReadTokens?: number;
				cacheWriteTokens?: number;
			};
			outputTokenDetails?: {
				textTokens?: number;
				reasoningTokens?: number;
			};
			raw?: unknown;
		};
		totalUsage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
			inputTokenDetails?: {
				noCacheTokens?: number;
				cacheReadTokens?: number;
				cacheWriteTokens?: number;
			};
			outputTokenDetails?: {
				textTokens?: number;
				reasoningTokens?: number;
			};
			raw?: unknown;
		};
		warnings?: unknown[];
		request?: {
			body?: unknown;
		};
		response?: {
			id?: string;
			timestamp?: string;
			modelId?: string;
			headers?: Record<string, string>;
			body?: unknown;
		};
		providerMetadata?: unknown;
		gatewayGenerationId?: string;
		gateway?: {
			id?: string;
			totalCost?: number;
			upstreamInferenceCost?: number;
			usageCost?: number;
			createdAt?: string;
			model?: string;
			providerName?: string;
			streamed?: boolean;
			isByok?: boolean;
			inputTokens?: number;
			outputTokens?: number;
			cachedInputTokens?: number;
			cacheCreationInputTokens?: number;
			reasoningTokens?: number;
		};
	};
}

type NdjsonEvent =
	| {type: "start"; stage: string; provider: string; model: string}
	| {type: "partial_html_block"; block: BackendHtmlContentBlock}
	| {type: "partial_structured"; data: unknown}
	| {type: "complete"; data: unknown}
	| {type: "error"; message: string; data?: unknown};

type StreamHandlers = {
	signal?: AbortSignal;
	onStart?: (event: Extract<NdjsonEvent, {type: "start"}>) => void;
	onPartialHtmlBlock?: (
		event: Extract<NdjsonEvent, {type: "partial_html_block"}>,
	) => void;
	onPartialStructured?: (
		event: Extract<NdjsonEvent, {type: "partial_structured"}>,
	) => void;
};

function asDashboardApiError(error: unknown): DashboardApiError {
	if (error instanceof DashboardApiError) {
		return error;
	}

	if (error instanceof DOMException && error.name === "AbortError") {
		return new DashboardApiError("The request was cancelled.", 499);
	}

	if (error instanceof TypeError) {
		return new DashboardApiError(
			"Could not reach the server. Please try again.",
			0,
		);
	}

	if (error instanceof Error) {
		return new DashboardApiError(error.message, 500);
	}

	return new DashboardApiError("Request failed.", 500);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await authClient.authorizedFetch(path, {
			...init,
			headers: {
				...(init?.headers ?? {}),
			},
		});
	} catch (error) {
		throw asDashboardApiError(error);
	}

	if (!response.ok) {
		let message = `Request failed with status ${response.status}.`;
		if (response.status === 401) {
			message = "Your session expired. Please sign in again.";
		}

		try {
			const body = (await response.json()) as {error?: string; message?: string};
			if (body.error && response.status !== 401) {
				message = body.message ?? body.error;
			}
		} catch {
			// Keep default message.
		}

		throw new DashboardApiError(message, response.status);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

async function streamNdjson<T>(
	path: string,
	handlers: StreamHandlers,
	init?: RequestInit,
): Promise<T> {
	let response: Response;
	try {
		response = await authClient.authorizedFetch(path, {
			method: "POST",
			body: JSON.stringify({}),
			...init,
			signal: handlers.signal,
			headers: {
				...(init?.headers ?? {}),
			},
		});
	} catch (error) {
		throw asDashboardApiError(error);
	}

	if (!response.ok) {
		let message = `Request failed with status ${response.status}.`;
		if (response.status === 401) {
			message = "Your session expired. Please sign in again.";
		}

		try {
			const body = (await response.json()) as {error?: string; message?: string};
			if (body.error && response.status !== 401) {
				message = body.message ?? body.error;
			}
		} catch {
			// Keep default message.
		}

		throw new DashboardApiError(message, response.status);
	}

	if (!response.body) {
		throw new DashboardApiError(
			"Streaming response body was not available.",
			500,
		);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let completedData: T | null = null;

	while (true) {
		let chunk;
		try {
			chunk = await reader.read();
		} catch (error) {
			throw asDashboardApiError(error);
		}
		const {done, value} = chunk;

		if (done) {
			break;
		}

		buffer += decoder.decode(value, {stream: true});
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}

			const event = JSON.parse(trimmed) as NdjsonEvent;

			if (event.type === "start") {
				handlers.onStart?.(event);
				continue;
			}

			if (event.type === "partial_html_block") {
				handlers.onPartialHtmlBlock?.(event);
				continue;
			}

			if (event.type === "partial_structured") {
				handlers.onPartialStructured?.(event);
				continue;
			}

			if (event.type === "error") {
				throw new DashboardApiError(event.message, 500);
			}

			completedData = event.data as T;
		}
	}

	if (completedData === null) {
		throw new DashboardApiError(
			"Streaming response ended without a complete payload.",
			500,
		);
	}

	return completedData;
}

export const dashboardApi = {
	listFolders() {
		return requestJson<{folders: BackendFolder[]}>("/api/folders");
	},
	getBillingPricing() {
		return requestJson<{products: BackendBillingProduct[]}>(
			"/api/billing/pricing",
		);
	},
	getBillingSummary() {
		return requestJson<BackendBillingSummary>("/api/billing/me");
	},
	getUsageAnalytics(period: BackendUsageAnalyticsPeriod) {
		return requestJson<BackendUsageAnalytics>(
			`/api/analytics/usage?period=${encodeURIComponent(period)}`,
		);
	},
	createBillingCheckoutSession(productId: string) {
		return requestJson<{url: string}>("/api/billing/checkout-session", {
			method: "POST",
			body: JSON.stringify({productId}),
		});
	},
	createBillingPortalSession() {
		return requestJson<{url: string}>("/api/billing/portal-session", {
			method: "POST",
			body: JSON.stringify({}),
		});
	},
	createFolder(input: {name: string; icon?: string; color?: string}) {
		return requestJson<BackendFolder>("/api/folders", {
			method: "POST",
			body: JSON.stringify(input),
		});
	},
	updateFolder(
		id: string,
		patch: {name?: string; icon?: string; color?: string},
	) {
		return requestJson<BackendFolder>(`/api/folders/${id}`, {
			method: "PATCH",
			body: JSON.stringify(patch),
		});
	},
	deleteFolder(id: string) {
		return requestJson<void>(`/api/folders/${id}`, {
			method: "DELETE",
		});
	},
	listDidacticUnits() {
		return requestJson<{didacticUnits: BackendDidacticUnitSummary[]}>(
			"/api/didactic-unit",
		);
	},
	createDidacticUnit(input: {
		topic: string;
		additionalContext?: string;
		level?: "beginner" | "intermediate" | "advanced";
		depth?: "basic" | "intermediate" | "technical";
		length?: "intro" | "short" | "long" | "textbook";
		questionnaireEnabled?: boolean;
		folderSelection?: {
			mode: "manual" | "auto";
			folderId?: string;
		};
	}) {
		return requestJson<BackendDidacticUnitDetail>("/api/didactic-unit", {
			method: "POST",
			body: JSON.stringify(input),
		});
	},
	getAiConfig() {
		return requestJson<BackendAiConfig>("/api/ai-config");
	},
	getAiConfigCatalog() {
		return requestJson<BackendModelCatalog>("/api/ai-config/catalog");
	},
	updateAiConfig(input: Partial<BackendAiConfig>) {
		return requestJson<BackendAiConfig>("/api/ai-config", {
			method: "PATCH",
			body: JSON.stringify(input),
		});
	},
	getDidacticUnit(id: string) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}`,
		);
	},
	updateDidacticUnitFolder(
		id: string,
		folderSelection: {
			mode: "manual" | "auto";
			folderId?: string;
		},
	) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/folder`,
			{
				method: "PATCH",
				body: JSON.stringify({folderSelection}),
			},
		);
	},
	updateDidacticUnitTheme(
		id: string,
		presentationTheme: PresentationTheme | null,
	) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/theme`,
			{
				method: "PATCH",
				body: JSON.stringify({presentationTheme}),
			},
		);
	},
	moderateDidacticUnit(id: string) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/moderate`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	answerDidacticUnitQuestionnaire(
		id: string,
		answers: BackendQuestionAnswer[],
	) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/questionnaire/answers`,
			{
				method: "PATCH",
				body: JSON.stringify({answers}),
			},
		);
	},
	generateDidacticUnitSyllabusPrompt(id: string) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/syllabus-prompt/generate`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	streamDidacticUnitSyllabus(
		id: string,
		quality: BackendGenerationQuality,
		handlers: StreamHandlers,
		input?: {context?: string},
	) {
		return streamNdjson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/syllabus/generate/stream`,
			handlers,
			{
				body: JSON.stringify({
					quality,
					...(input ?? {}),
				}),
			},
		);
	},
	updateDidacticUnitSyllabus(id: string, syllabus: PlanningSyllabus) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/syllabus`,
			{
				method: "PATCH",
				body: JSON.stringify({syllabus}),
			},
		);
	},
	approveDidacticUnitSyllabus(id: string, quality: BackendGenerationQuality) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/approve-syllabus`,
			{
				method: "POST",
				body: JSON.stringify({quality}),
			},
		);
	},
	listDidacticUnitChapters(id: string) {
		return requestJson<{chapters: BackendDidacticUnitChapterSummary[]}>(
			`/api/didactic-unit/${id}/modules`,
		);
	},
	getDidacticUnitChapter(id: string, chapterIndex: number) {
		return requestJson<BackendDidacticUnitChapterDetail>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}`,
		);
	},
	listLearningActivities(id: string, chapterIndex: number) {
		return requestJson<{activities: BackendLearningActivity[]}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/activities`,
		);
	},
	createLearningActivity(
		id: string,
		chapterIndex: number,
		input: {
			scope: BackendLearningActivityScope;
			type: BackendLearningActivityType;
			quality: BackendGenerationQuality;
		},
	) {
		return requestJson<{activity: BackendLearningActivity}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/activities`,
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		);
	},
	createLearningActivityAttempt(activityId: string, answers: unknown) {
		return requestJson<{attempt: BackendLearningActivityAttempt}>(
			`/api/activities/${activityId}/attempts`,
			{
				method: "POST",
				body: JSON.stringify({answers}),
			},
		);
	},
	getActivityProgress(activityId: string) {
		return requestJson<{progress: BackendActivityProgress | null}>(
			`/api/activities/${activityId}/progress`,
		);
	},
	saveActivityProgress(activityId: string, payload: {confirmedAnswers: BackendActivityProgress["confirmedAnswers"]; completed: boolean}) {
		return requestJson<{progress: BackendActivityProgress}>(
			`/api/activities/${activityId}/progress`,
			{
				method: "PUT",
				body: JSON.stringify(payload),
			},
		);
	},
	updateDidacticUnitChapter(
		id: string,
		chapterIndex: number,
		chapter: {
			title: string;
			html?: string;
			htmlHash?: string;
		},
	) {
		return requestJson<BackendDidacticUnitChapterDetail>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}`,
			{
				method: "PATCH",
				body: JSON.stringify({chapter}),
			},
		);
	},
	createGenerationRun(id: string, chapterIndex: number) {
		return requestJson<{runId: string; run: BackendGenerationRun}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/generate-run`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	getGenerationRun(runId: string) {
		return requestJson<{run: BackendGenerationRun}>(
			`/api/generation-runs/${runId}`,
		);
	},
	cancelGenerationRun(runId: string) {
		return requestJson<{ok: boolean}>(`/api/generation-runs/${runId}/cancel`, {
			method: "POST",
		});
	},
	streamGenerationRun(runId: string, handlers: StreamHandlers) {
		return streamNdjson<{run: BackendGenerationRun}>(
			`/api/generation-runs/${runId}/stream`,
			handlers,
			{
				method: "GET",
			body: undefined,
			},
		);
	},
	completeDidacticUnitChapter(id: string, chapterIndex: number) {
		return requestJson<BackendDidacticUnitDetail>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/complete`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	updateDidacticUnitReadingProgress(
		id: string,
		chapterIndex: number,
		progress: {
			readBlockIndex: number;
			readBlockOffset?: number;
		},
		lastVisitedPageIndex?: number,
	) {
		return requestJson<BackendDidacticUnitReadingProgressResponse>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/reading-progress`,
			{
				method: "PUT",
				body: JSON.stringify({
					...progress,
					...(lastVisitedPageIndex !== undefined ?
						{lastVisitedPageIndex}
					: 	{}),
				}),
			},
		);
	},
	listDidacticUnitChapterRevisions(id: string, chapterIndex: number) {
		return requestJson<{revisions: BackendDidacticUnitChapterRevision[]}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/revisions`,
		);
	},
	listDidacticUnitRuns(id: string) {
		return requestJson<{runs: BackendGenerationRun[]}>(
			`/api/didactic-unit/${id}/runs`,
		);
	},
	deleteDidacticUnit(id: string) {
		return requestJson<void>(`/api/didactic-unit/${id}`, {
			method: "DELETE",
		});
	},
};
