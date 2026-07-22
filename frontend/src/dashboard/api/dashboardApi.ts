import {authClient} from "@/auth/authClient";
import type {PlanningQuestion, PlanningSyllabus} from "../types";
import type {PresentationTheme} from "@/shared/presentation/presentationTheme";
import type {CoinType} from "@/shared/types/credits";
import type {
	AiConfigDto,
	AiModelTierDto,
	GenerationQualityDto,
	ModelCatalogDto,
} from "@/shared/types/aiContracts";

export type {
	AiConfigDto,
	AiModelConfigDto,
	AiModelTierDto,
	AuthoringConfigDto,
	GenerationQualityDto,
	ModelCatalogDto,
	ModelEntryDto,
} from "@/shared/types/aiContracts";

export class DashboardApiError extends Error {
	status: number;
	code?: string;

	constructor(message: string, status: number, code?: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

export function getDashboardErrorMessage(error: unknown, fallback: string): string {
	if (
		error instanceof DashboardApiError &&
		error.code === "free_generation_limit_reached"
	) {
		return `${error.message} Contact support at /contact.`;
	}

	return error instanceof Error ? error.message : fallback;
}

type ProviderDto = string;
export type CoinTypeDto = CoinType;
export type BillingProductKindDto = "credit_pack" | "subscription";

export interface BillingProductDto {
	id: string;
	kind: BillingProductKindDto;
	name: string;
	description: string;
	priceLabel: string;
	interval?: "/month";
	stripePriceEnvKey: string;
	stripeConfigured: boolean;
	credits: Record<CoinTypeDto, number>;
	subscriptionTier?: "teacher" | "teacher_pro";
	recommended?: boolean;
	unlimitedBronze?: boolean;
	features: string[];
}

export interface BillingSummaryDto {
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
		products: BillingProductDto[];
	};
}

export interface LangSmithTelemetryRunSummaryDto {
	id: string;
	name: string;
	runType: string;
	status: "completed" | "error" | "running";
	startedAt: string | null;
	endedAt: string | null;
	durationMs: number | null;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	hasError: boolean;
}

export interface LangSmithTelemetrySummaryDto {
	configured: boolean;
	project: string;
	generatedAt: string;
	totalRuns: number;
	completedRuns: number;
	failedRuns: number;
	activeRuns: number;
	totalTokens: number;
	averageDurationMs: number | null;
	byRunType: Record<string, number>;
	latestRuns: LangSmithTelemetryRunSummaryDto[];
}

export type UsageAnalyticsPeriodDto = "7d" | "30d" | "6m" | "12m";

export interface UsageAnalyticsDto {
	period: UsageAnalyticsPeriodDto;
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
	favoriteTopic: (FolderDto & {unitCount: number}) | null;
	chart: Array<{
		key: string;
		label: string;
		count: number;
	}>;
}

export type LearningActivityScopeDto =
	| "current_module"
	| "cumulative_until_module";
export type LearningActivityTypeDto =
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

export interface LearningActivityDto {
	id: string;
	ownerId: string;
	didacticUnitId: string;
	chapterIndex: number;
	scope: LearningActivityScopeDto;
	type: LearningActivityTypeDto;
	quality: GenerationQualityDto;
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

export interface LearningActivityAttemptDto {
	id: string;
	activityId: string;
	ownerId: string;
	answers: unknown;
	score?: number;
	feedback: string;
	strengths?: string[];
	improvements?: string[];
	questionFeedback?: Array<{
		id: string;
		feedback?: string;
		simplifiedScore?: "wrong" | "Almost there" | "Good" | "Perfect";
		expectedAnswer?: string;
		improvementReason?: string;
		score?: number;
		strengths: string[];
		improvements: string[];
	}>;
	completedAt: string;
}

export interface ActivityProgressDto {
	activityId: string;
	ownerId: string;
	confirmedAnswers: Record<string, {
		selectedOptionId: string;
		isCorrect: boolean;
		correctOptionId: string;
		explanation: string;
	}>;
	answers?: Record<string, unknown>;
	completed: boolean;
	updatedAt: string;
}

export interface FolderDto {
	id: string;
	name: string;
	slug: string;
	icon: string;
	color: string;
	kind: "default" | "custom";
	unitCount: number;
}

export interface HtmlContentBlockDto {
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

export interface DidacticUnitSummaryDto {
	id: string;
	title: string;
	topic: string;
	folderId: string;
	folder: Omit<FolderDto, "unitCount">;
	provider: ProviderDto;
	modelUsed?: {
		provider: ProviderDto;
		model: string;
		label: string;
	} | null;
	status: string;
	nextAction: string;
	overview: string;
	length: "intro" | "short" | "long" | "textbook";
	moduleCount: number;
	generatedChapterCount: number;
	readBlockCount: number;
	totalBlockCount: number;
	progressPercent: number;
	studyProgressPercent: number;
	createdAt: string;
	lastActivityAt: string;
}

export interface QuestionnaireDto {
	questions: PlanningQuestion[];
}

export interface QuestionAnswerDto {
	questionId: string;
	value: string;
}

export interface DidacticUnitDetailDto {
	id: string;
	ownerId: string;
	topic: string;
	title: string;
	folderId: string;
	folderAssignmentMode: "manual" | "auto";
	folder: Omit<FolderDto, "unitCount">;
	presentationTheme: PresentationTheme | null;
	provider: ProviderDto;
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
	learningProfile?: "beginner" | "intermediate" | "advanced";
	length: "intro" | "short" | "long" | "textbook";
	generationTier?: AiModelTierDto;
	generationQuality?: GenerationQualityDto;
	unitGenerationPaidAt?: string;
	unitGenerationCreditTransactionId?: string;
	questionnaireEnabled: boolean;
	questionnaire?: QuestionnaireDto;
	questionnaireAnswers?: QuestionAnswerDto[];
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

export interface DidacticUnitChapterSummaryDto {
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

export interface DidacticUnitChapterDetailDto {
	chapterIndex: number;
	title: string;
	planningOverview: string;
	html: string | null;
	htmlHash?: string;
	htmlBlocks: HtmlContentBlockDto[];
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

export interface DidacticUnitReadingProgressResponseDto {
	module: DidacticUnitChapterDetailDto | null;
	studyProgress: {
		moduleCount: number;
		readBlockCount: number;
		totalBlockCount: number;
		studyProgressPercent: number;
	};
}

export interface DidacticUnitChapterRevisionDto {
	id: string;
	chapterIndex: number;
	source: "ai_generation" | "ai_regeneration" | "manual_edit";
	createdAt: string;
	chapter: {
		title: string;
		html: string;
		htmlHash: string;
		htmlBlocks: HtmlContentBlockDto[];
		htmlBlocksVersion: number;
	};
}

export interface DidacticUnitNoteAnchorDto {
	startBlockId: string;
	startOffset: number;
	endBlockId: string;
	endOffset: number;
	htmlHash?: string;
	htmlBlocksVersion: number;
	contextBefore?: string;
	contextAfter?: string;
}

export interface DidacticUnitNoteDto {
	id: string;
	ownerId: string;
	didacticUnitId: string;
	chapterIndex: number;
	source: "manual" | "ai";
	selectedText: string;
	question?: string;
	content: string;
	quality?: GenerationQualityDto;
	anchor: DidacticUnitNoteAnchorDto;
	createdAt: string;
	updatedAt: string;
}

export interface GenerationRunDto {
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
	provider: ProviderDto;
	model: string;
	prompt: string;
	createdAt: string;
	updatedAt?: string;
	error?: string;
	errorMessage?: string;
	chapterIndex?: number;
	attempts?: number;
	emittedBlocks?: HtmlContentBlockDto[];
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
	| {type: "partial_html_block"; block: HtmlContentBlockDto}
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

		let code: string | undefined;
		try {
			const body = (await response.json()) as {error?: string; message?: string};
			if (body.error && response.status !== 401) {
				code = body.error;
				message = body.message ?? body.error;
			}
		} catch (parseError) {
			void parseError;
		}

		throw new DashboardApiError(message, response.status, code);
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

		let code: string | undefined;
		try {
			const body = (await response.json()) as {error?: string; message?: string};
			if (body.error && response.status !== 401) {
				code = body.error;
				message = body.message ?? body.error;
			}
		} catch (parseError) {
			void parseError;
		}

		throw new DashboardApiError(message, response.status, code);
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
		return requestJson<{folders: FolderDto[]}>("/api/folders");
	},
	getBillingPricing() {
		return requestJson<{products: BillingProductDto[]}>(
			"/api/billing/pricing",
		);
	},
	getBillingSummary() {
		return requestJson<BillingSummaryDto>("/api/billing/me");
	},
	getUsageAnalytics(period: UsageAnalyticsPeriodDto) {
		return requestJson<UsageAnalyticsDto>(
			`/api/analytics/usage?period=${encodeURIComponent(period)}`,
		);
	},
	getAdminTelemetrySummary(limit = 50) {
		return requestJson<LangSmithTelemetrySummaryDto>(
			`/api/admin/telemetry/summary?limit=${encodeURIComponent(String(limit))}`,
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
		return requestJson<FolderDto>("/api/folders", {
			method: "POST",
			body: JSON.stringify(input),
		});
	},
	updateFolder(
		id: string,
		patch: {name?: string; icon?: string; color?: string},
	) {
		return requestJson<FolderDto>(`/api/folders/${id}`, {
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
		return requestJson<{didacticUnits: DidacticUnitSummaryDto[]}>(
			"/api/didactic-unit",
		);
	},
	createDidacticUnit(input: {
		topic: string;
		additionalContext?: string;
		level?: "beginner" | "intermediate" | "advanced";
		depth?: "basic" | "intermediate" | "technical";
		learningProfile?: "beginner" | "intermediate" | "advanced";
		length?: "intro" | "short" | "long" | "textbook";
		questionnaireEnabled?: boolean;
		folderSelection?: {
			mode: "manual" | "auto";
			folderId?: string;
		};
	}) {
		return requestJson<DidacticUnitDetailDto>("/api/didactic-unit", {
			method: "POST",
			body: JSON.stringify(input),
		});
	},
	getAiConfig() {
		return requestJson<AiConfigDto>("/api/ai-config");
	},
	getAiConfigCatalog() {
		return requestJson<ModelCatalogDto>("/api/ai-config/catalog");
	},
	updateAiConfig(input: Partial<AiConfigDto>) {
		return requestJson<AiConfigDto>("/api/ai-config", {
			method: "PATCH",
			body: JSON.stringify(input),
		});
	},
	getDidacticUnit(id: string) {
		return requestJson<DidacticUnitDetailDto>(
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
		return requestJson<DidacticUnitDetailDto>(
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
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/theme`,
			{
				method: "PATCH",
				body: JSON.stringify({presentationTheme}),
			},
		);
	},
	moderateDidacticUnit(id: string) {
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/moderate`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	answerDidacticUnitQuestionnaire(
		id: string,
		answers: QuestionAnswerDto[],
	) {
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/questionnaire/answers`,
			{
				method: "PATCH",
				body: JSON.stringify({answers}),
			},
		);
	},
	generateDidacticUnitSyllabusPrompt(id: string) {
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/syllabus-prompt/generate`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	streamDidacticUnitSyllabus(
		id: string,
		quality: GenerationQualityDto,
		handlers: StreamHandlers,
		input?: {context?: string},
	) {
		return streamNdjson<DidacticUnitDetailDto>(
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
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/syllabus`,
			{
				method: "PATCH",
				body: JSON.stringify({syllabus}),
			},
		);
	},
	approveDidacticUnitSyllabus(id: string, quality: GenerationQualityDto) {
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/approve-syllabus`,
			{
				method: "POST",
				body: JSON.stringify({quality}),
			},
		);
	},
	listDidacticUnitChapters(id: string) {
		return requestJson<{chapters: DidacticUnitChapterSummaryDto[]}>(
			`/api/didactic-unit/${id}/modules`,
		);
	},
	getDidacticUnitChapter(id: string, chapterIndex: number) {
		return requestJson<DidacticUnitChapterDetailDto>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}`,
		);
	},
	listDidacticUnitNotes(id: string) {
		return requestJson<{notes: DidacticUnitNoteDto[]}>(
			`/api/didactic-unit/${id}/notes`,
		);
	},
	createDidacticUnitNote(
		id: string,
		input: {
			chapterIndex: number;
			selectedText: string;
			content: string;
			anchor: DidacticUnitNoteAnchorDto;
		},
	) {
		return requestJson<{note: DidacticUnitNoteDto}>(
			`/api/didactic-unit/${id}/notes`,
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		);
	},
	generateDidacticUnitNote(
		id: string,
		input: {
			chapterIndex: number;
			selectedText: string;
			question?: string;
			quality: GenerationQualityDto;
			anchor: DidacticUnitNoteAnchorDto;
		},
	) {
		return requestJson<{note: DidacticUnitNoteDto}>(
			`/api/didactic-unit/${id}/notes/generate`,
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		);
	},
	updateDidacticUnitNote(
		id: string,
		noteId: string,
		patch: {question?: string; content?: string},
	) {
		return requestJson<{note: DidacticUnitNoteDto}>(
			`/api/didactic-unit/${id}/notes/${noteId}`,
			{
				method: "PATCH",
				body: JSON.stringify(patch),
			},
		);
	},
	deleteDidacticUnitNote(id: string, noteId: string) {
		return requestJson<void>(
			`/api/didactic-unit/${id}/notes/${noteId}`,
			{method: "DELETE"},
		);
	},
	listLearningActivities(id: string, chapterIndex: number) {
		return requestJson<{activities: LearningActivityDto[]}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/activities`,
		);
	},
	createLearningActivity(
		id: string,
		chapterIndex: number,
		input: {
			scope: LearningActivityScopeDto;
			type: LearningActivityTypeDto;
			quality: GenerationQualityDto;
		},
	) {
		return requestJson<{activity: LearningActivityDto}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/activities`,
			{
				method: "POST",
				body: JSON.stringify(input),
			},
		);
	},
	deleteLearningActivity(activityId: string) {
		return requestJson<void>(
			`/api/activities/${activityId}`,
			{method: "DELETE"},
		);
	},
	listLearningActivityAttempts(activityId: string) {
		return requestJson<{attempts: LearningActivityAttemptDto[]}>(
			`/api/activities/${activityId}/attempts`,
		);
	},
	refillActivityAttempts(activityId: string) {
		return requestJson<{activity: LearningActivityDto}>(
			`/api/activities/${activityId}/refill`,
			{method: "POST"},
		);
	},
	createLearningActivityAttempt(activityId: string, answers: unknown) {
		return requestJson<{attempt: LearningActivityAttemptDto}>(
			`/api/activities/${activityId}/attempts`,
			{
				method: "POST",
				body: JSON.stringify({answers}),
			},
		);
	},
	getActivityProgress(activityId: string) {
		return requestJson<{progress: ActivityProgressDto | null}>(
			`/api/activities/${activityId}/progress`,
		);
	},
	saveActivityProgress(
		activityId: string,
		payload: {
			confirmedAnswers: ActivityProgressDto["confirmedAnswers"];
			answers?: ActivityProgressDto["answers"];
			completed: boolean;
		},
	) {
		return requestJson<{progress: ActivityProgressDto}>(
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
		return requestJson<DidacticUnitChapterDetailDto>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}`,
			{
				method: "PATCH",
				body: JSON.stringify({chapter}),
			},
		);
	},
	createGenerationRun(id: string, chapterIndex: number) {
		return requestJson<{runId: string; run: GenerationRunDto}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/generate-run`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	getGenerationRun(runId: string) {
		return requestJson<{run: GenerationRunDto}>(
			`/api/generation-runs/${runId}`,
		);
	},
	cancelGenerationRun(runId: string) {
		return requestJson<{ok: boolean}>(`/api/generation-runs/${runId}/cancel`, {
			method: "POST",
		});
	},
	streamGenerationRun(runId: string, handlers: StreamHandlers) {
		return streamNdjson<{run: GenerationRunDto}>(
			`/api/generation-runs/${runId}/stream`,
			handlers,
			{
				method: "GET",
			body: undefined,
			},
		);
	},
	completeDidacticUnitChapter(id: string, chapterIndex: number) {
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/complete`,
			{
				method: "POST",
				body: JSON.stringify({}),
			},
		);
	},
	markDidacticUnitChapterUnread(id: string, chapterIndex: number) {
		return requestJson<DidacticUnitDetailDto>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/unread`,
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
		return requestJson<DidacticUnitReadingProgressResponseDto>(
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
		return requestJson<{revisions: DidacticUnitChapterRevisionDto[]}>(
			`/api/didactic-unit/${id}/modules/${chapterIndex}/revisions`,
		);
	},
	listDidacticUnitRuns(id: string) {
		return requestJson<{runs: GenerationRunDto[]}>(
			`/api/didactic-unit/${id}/runs`,
		);
	},
	deleteDidacticUnit(id: string) {
		return requestJson<void>(`/api/didactic-unit/${id}`, {
			method: "DELETE",
		});
	},
};
