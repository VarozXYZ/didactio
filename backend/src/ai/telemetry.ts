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

export interface AiGatewayGenerationTelemetry {
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
	gatewayGenerationId?: string;
	gateway?: AiGatewayGenerationTelemetry;
}

interface GatewayGenerationInfoLike {
	id: string;
	totalCost: number;
	upstreamInferenceCost: number;
	usage: number;
	createdAt: string;
	model: string;
	isByok: boolean;
	providerName: string;
	streamed: boolean;
	inputTokens?: number;
	outputTokens?: number;
	cachedInputTokens?: number;
	cacheCreationInputTokens?: number;
	reasoningTokens?: number;
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

function extractGatewayGenerationId(
	providerMetadata: unknown,
): string | undefined {
	if (!providerMetadata || typeof providerMetadata !== "object") {
		return undefined;
	}

	const gatewayValue = (providerMetadata as {gateway?: unknown}).gateway;

	if (!gatewayValue || typeof gatewayValue !== "object") {
		return undefined;
	}

	const generationId = (gatewayValue as {generationId?: unknown})
		.generationId;
	return typeof generationId === "string" && generationId.trim() ?
			generationId
		:	undefined;
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
		gatewayGenerationId: extractGatewayGenerationId(
			serializedProviderMetadata,
		),
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
		totalCost: telemetry.gateway?.totalCost,
		usageCost: telemetry.gateway?.usageCost,
		warningCount: telemetry.warnings?.length,
		responseId: telemetry.response?.id,
		responseModelId: telemetry.response?.modelId,
		gatewayGenerationId: telemetry.gatewayGenerationId,
	});
}

function createGatewayUsageTelemetry(
	usage: AiUsageTelemetry | undefined,
	gateway: AiGatewayGenerationTelemetry,
): AiUsageTelemetry | undefined {
	const inputTokens = usage?.inputTokens ?? gateway.inputTokens;
	const outputTokens = usage?.outputTokens ?? gateway.outputTokens;
	const totalTokens =
		usage?.totalTokens ??
		(typeof inputTokens === "number" && typeof outputTokens === "number" ?
			inputTokens + outputTokens
		:	undefined);

	const merged = compactRecord({
		...usage,
		inputTokens,
		outputTokens,
		totalTokens,
		reasoningTokens: usage?.reasoningTokens ?? gateway.reasoningTokens,
		cachedInputTokens:
			usage?.cachedInputTokens ?? gateway.cachedInputTokens,
	});

	return Object.keys(merged).length > 0 ?
			(merged as AiUsageTelemetry)
		:	undefined;
}

export function enrichAiCallTelemetryWithGatewayInfo(
	telemetry: AiCallTelemetry,
	gatewayInfo: GatewayGenerationInfoLike,
): AiCallTelemetry {
	const gateway = compactRecord({
		id: gatewayInfo.id,
		totalCost: gatewayInfo.totalCost,
		upstreamInferenceCost: gatewayInfo.upstreamInferenceCost,
		usageCost: gatewayInfo.usage,
		createdAt: gatewayInfo.createdAt,
		model: gatewayInfo.model,
		providerName: gatewayInfo.providerName,
		streamed: gatewayInfo.streamed,
		isByok: gatewayInfo.isByok,
		inputTokens: gatewayInfo.inputTokens,
		outputTokens: gatewayInfo.outputTokens,
		cachedInputTokens: gatewayInfo.cachedInputTokens,
		cacheCreationInputTokens: gatewayInfo.cacheCreationInputTokens,
		reasoningTokens: gatewayInfo.reasoningTokens,
	}) as AiGatewayGenerationTelemetry;

	const usage = createGatewayUsageTelemetry(telemetry.usage, gateway);
	const totalUsage = createGatewayUsageTelemetry(
		telemetry.totalUsage,
		gateway,
	);

	return compactRecord({
		...telemetry,
		usage,
		totalUsage,
		gateway,
	}) as AiCallTelemetry;
}
