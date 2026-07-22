import {compactRecord, toSerializableValue} from "../utils/serialize.js";

type MaybePromise<T> = T | PromiseLike<T>;

type UsageLike = {
	inputTokens?: number;
	inputTokenDetails?: {
		noCacheTokens?: number;
		cacheReadTokens?: number;
		cacheWriteTokens?: number;
	};
	outputTokens?: number;
	outputTokenDetails?: {
		textTokens?: number;
		reasoningTokens?: number;
	};
	totalTokens?: number;
	reasoningTokens?: number;
	cachedInputTokens?: number;
	raw?: unknown;
};

type ResponseLike = {
	id?: string;
	timestamp?: Date | string;
	modelId?: string;
	headers?: Record<string, string>;
	body?: unknown;
};

type RequestLike = {
	body?: unknown;
};

export interface AiUsageTelemetry {
	inputTokens?: number;
	inputTokenDetails?: {
		noCacheTokens?: number;
		cacheReadTokens?: number;
		cacheWriteTokens?: number;
	};
	outputTokens?: number;
	outputTokenDetails?: {
		textTokens?: number;
		reasoningTokens?: number;
	};
	totalTokens?: number;
	reasoningTokens?: number;
	cachedInputTokens?: number;
	raw?: unknown;
}

export interface AiRequestTelemetry {
	body?: unknown;
}

export interface AiResponseTelemetry {
	id?: string;
	timestamp?: string;
	modelId?: string;
	headers?: Record<string, string>;
	body?: unknown;
}

export interface AiCallTelemetry {
	durationMs?: number;
	finishReason?: string;
	rawFinishReason?: string;
	usage?: AiUsageTelemetry;
	totalUsage?: AiUsageTelemetry;
	warnings?: unknown[];
	request?: AiRequestTelemetry;
	response?: AiResponseTelemetry;
	providerMetadata?: unknown;
}

type TelemetrySource = {
	finishReason?: MaybePromise<string | undefined>;
	rawFinishReason?: MaybePromise<string | undefined>;
	usage?: MaybePromise<UsageLike | undefined>;
	totalUsage?: MaybePromise<UsageLike | undefined>;
	warnings?: MaybePromise<unknown[] | undefined>;
	request?: MaybePromise<RequestLike | undefined>;
	response?: MaybePromise<ResponseLike | undefined>;
	providerMetadata?: MaybePromise<unknown | undefined>;
};

function normalizeUsage(
	usage: UsageLike | undefined,
): AiUsageTelemetry | undefined {
	if (!usage) {
		return undefined;
	}

	return compactRecord({
		inputTokens: usage.inputTokens,
		inputTokenDetails:
			usage.inputTokenDetails ?
				compactRecord({
					noCacheTokens: usage.inputTokenDetails.noCacheTokens,
					cacheReadTokens: usage.inputTokenDetails.cacheReadTokens,
					cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
				})
			:	undefined,
		outputTokens: usage.outputTokens,
		outputTokenDetails:
			usage.outputTokenDetails ?
				compactRecord({
					textTokens: usage.outputTokenDetails.textTokens,
					reasoningTokens: usage.outputTokenDetails.reasoningTokens,
				})
			:	undefined,
		totalTokens: usage.totalTokens,
		reasoningTokens: usage.reasoningTokens,
		cachedInputTokens: usage.cachedInputTokens,
		raw: toSerializableValue(usage.raw),
	});
}

function normalizeRequest(
	request: RequestLike | undefined,
): AiRequestTelemetry | undefined {
	if (!request) {
		return undefined;
	}

	return compactRecord({
		body: toSerializableValue(request.body),
	});
}

function normalizeResponse(
	response: ResponseLike | undefined,
): AiResponseTelemetry | undefined {
	if (!response) {
		return undefined;
	}

	return compactRecord({
		id: response.id,
		timestamp:
			response.timestamp instanceof Date ?
				response.timestamp.toISOString()
			:	response.timestamp,
		modelId: response.modelId,
		headers: response.headers,
		body: toSerializableValue(response.body),
	});
}

export async function collectAiCallTelemetry(
	source: TelemetrySource,
	durationMs?: number,
): Promise<AiCallTelemetry> {
	const [
		finishReason,
		rawFinishReason,
		usage,
		totalUsage,
		warnings,
		request,
		response,
		providerMetadata,
	] = await Promise.all([
		Promise.resolve(source.finishReason),
		Promise.resolve(source.rawFinishReason),
		Promise.resolve(source.usage),
		Promise.resolve(source.totalUsage),
		Promise.resolve(source.warnings),
		Promise.resolve(source.request),
		Promise.resolve(source.response),
		Promise.resolve(source.providerMetadata),
	]);

	const serializedProviderMetadata = toSerializableValue(providerMetadata);

	return compactRecord({
		durationMs,
		finishReason,
		rawFinishReason,
		usage: normalizeUsage(usage),
		totalUsage: normalizeUsage(totalUsage),
		warnings:
			warnings ? (toSerializableValue(warnings) as unknown[]) : undefined,
		request: normalizeRequest(request),
		response: normalizeResponse(response),
		providerMetadata: serializedProviderMetadata,
	});
}

export function summarizeAiCallTelemetry(
	telemetry: AiCallTelemetry,
): Record<string, unknown> {
	return compactRecord({
		durationMs: telemetry.durationMs,
		finishReason: telemetry.finishReason,
		rawFinishReason: telemetry.rawFinishReason,
		inputTokens:
			telemetry.totalUsage?.inputTokens ?? telemetry.usage?.inputTokens,
		outputTokens:
			telemetry.totalUsage?.outputTokens ?? telemetry.usage?.outputTokens,
		totalTokens:
			telemetry.totalUsage?.totalTokens ?? telemetry.usage?.totalTokens,
		warningCount: telemetry.warnings?.length,
		responseId: telemetry.response?.id,
		responseModelId: telemetry.response?.modelId,
	});
}
