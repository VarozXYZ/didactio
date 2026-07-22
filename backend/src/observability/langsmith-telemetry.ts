import {Client} from "langsmith";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface LangSmithTelemetryRun {
	id?: unknown;
	name?: unknown;
	run_type?: unknown;
	status?: unknown;
	start_time?: unknown;
	end_time?: unknown;
	error?: unknown;
	prompt_tokens?: unknown;
	completion_tokens?: unknown;
	total_tokens?: unknown;
}

export interface LangSmithTelemetryRunSource {
	listRuns(options: {
		projectName: string;
		limit: number;
		order: "asc" | "desc";
		select: string[];
	}): AsyncIterable<LangSmithTelemetryRun>;
}

export interface LangSmithTelemetryRunSummary {
	id: string;
	name: string;
	runType: string;
	status: string;
	startedAt: string | null;
	endedAt: string | null;
	durationMs: number | null;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	hasError: boolean;
}

export interface LangSmithTelemetrySummary {
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
	latestRuns: LangSmithTelemetryRunSummary[];
}

export interface LangSmithTelemetryOptions {
	apiKey: string | null;
	project: string;
	endpoint: string;
	tracing: boolean;
	client?: LangSmithTelemetryRunSource;
	clock?: () => Date;
}

export interface LangSmithTelemetryService {
	getSummary(limit?: number): Promise<LangSmithTelemetrySummary>;
}

function clampLimit(limit: number | undefined): number {
	if (!Number.isFinite(limit)) {
		return DEFAULT_LIMIT;
	}

	return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit ?? DEFAULT_LIMIT)));
}

function parseTimestamp(value: unknown): Date | null {
	if (value instanceof Date && Number.isFinite(value.getTime())) {
		return value;
	}

	if (typeof value === "number" && Number.isFinite(value)) {
		const timestamp = new Date(value);
		return Number.isFinite(timestamp.getTime()) ? timestamp : null;
	}

	if (typeof value === "string" && value.trim()) {
		const timestamp = new Date(value);
		return Number.isFinite(timestamp.getTime()) ? timestamp : null;
	}

	return null;
}

function parseNonNegativeInteger(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ?
		Math.trunc(value)
	:	0;
}

function toStringValue(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function summarizeRun(run: LangSmithTelemetryRun): LangSmithTelemetryRunSummary {
	const startedAt = parseTimestamp(run.start_time);
	const endedAt = parseTimestamp(run.end_time);
	const hasError = Boolean(run.error) ||
		["error", "failed", "failure"].includes(
			String(run.status ?? "").toLowerCase(),
		);
	const durationMs = startedAt && endedAt ?
		Math.max(0, endedAt.getTime() - startedAt.getTime())
	:	null;

	return {
		id: toStringValue(run.id, "unknown"),
		name: toStringValue(run.name, "Unnamed run"),
		runType: toStringValue(run.run_type, "unknown"),
		status: hasError ? "error" : endedAt ? "completed" : "running",
		startedAt: startedAt?.toISOString() ?? null,
		endedAt: endedAt?.toISOString() ?? null,
		durationMs,
		promptTokens: parseNonNegativeInteger(run.prompt_tokens),
		completionTokens: parseNonNegativeInteger(run.completion_tokens),
		totalTokens: parseNonNegativeInteger(run.total_tokens),
		hasError,
	};
}

function createDisabledSummary(
	project: string,
	clock: () => Date,
): LangSmithTelemetrySummary {
	return {
		configured: false,
		project,
		generatedAt: clock().toISOString(),
		totalRuns: 0,
		completedRuns: 0,
		failedRuns: 0,
		activeRuns: 0,
		totalTokens: 0,
		averageDurationMs: null,
		byRunType: {},
		latestRuns: [],
	};
}

export function createLangSmithTelemetryService(
	options: LangSmithTelemetryOptions,
): LangSmithTelemetryService {
	const clock = options.clock ?? (() => new Date());
	const source = options.client ?? (
		options.apiKey && options.tracing ?
			new Client({apiKey: options.apiKey, apiUrl: options.endpoint})
		:	null
	);

	return {
		async getSummary(limit) {
			if (!options.apiKey || !options.tracing || !source) {
				return createDisabledSummary(options.project, clock);
			}

			const latestRuns: LangSmithTelemetryRunSummary[] = [];
			const byRunType: Record<string, number> = {};
			let totalTokens = 0;
			let completedRuns = 0;
			let failedRuns = 0;
			let activeRuns = 0;
			let durationTotal = 0;
			let durationCount = 0;

			for await (const run of source.listRuns({
				projectName: options.project,
				limit: clampLimit(limit),
				order: "desc",
				select: [
					"id",
					"name",
					"run_type",
					"status",
					"start_time",
					"end_time",
					"error",
					"prompt_tokens",
					"completion_tokens",
					"total_tokens",
				],
			})) {
				const summarized = summarizeRun(run);
				latestRuns.push(summarized);
				byRunType[summarized.runType] = (byRunType[summarized.runType] ?? 0) + 1;
				totalTokens += summarized.totalTokens;
				if (summarized.hasError) {
					failedRuns += 1;
				} else if (summarized.status === "running") {
					activeRuns += 1;
				} else {
					completedRuns += 1;
				}
				if (summarized.durationMs !== null) {
					durationTotal += summarized.durationMs;
					durationCount += 1;
				}
			}

			return {
				configured: true,
				project: options.project,
				generatedAt: clock().toISOString(),
				totalRuns: latestRuns.length,
				completedRuns,
				failedRuns,
				activeRuns,
				totalTokens,
				averageDurationMs: durationCount > 0 ?
					Math.round(durationTotal / durationCount)
				:	null,
				byRunType,
				latestRuns,
			};
		},
	};
}
