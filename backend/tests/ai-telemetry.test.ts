import {describe, expect, it} from "vitest";
import {
	collectAiCallTelemetry,
	enrichAiCallTelemetryWithGatewayInfo,
	summarizeAiCallTelemetry,
} from "../src/ai/telemetry.js";

describe("AI telemetry", () => {
	it("serializes provider calls and extracts gateway generation metadata", async () => {
		const telemetry = await collectAiCallTelemetry({
			finishReason: Promise.resolve("stop"),
			rawFinishReason: "finished",
			usage: {
				inputTokens: 2,
				outputTokens: 4,
				totalTokens: 6,
				inputTokenDetails: {noCacheTokens: 1, cacheReadTokens: 1},
				outputTokenDetails: {textTokens: 3, reasoningTokens: 1},
				raw: {nested: true},
			},
			totalUsage: {inputTokens: 3, outputTokens: 5, totalTokens: 8},
			warnings: [{message: "warning"}],
			request: {body: {prompt: "hello"}},
			response: {
				id: "r1",
				timestamp: new Date("2026-01-01T00:00:00Z"),
				modelId: "mock/model",
				headers: {trace: "one"},
				body: {answer: true},
			},
			providerMetadata: {gateway: {generationId: "g1"}},
		}, 12);

		expect(telemetry).toMatchObject({
			durationMs: 12,
			gatewayGenerationId: "g1",
			response: {timestamp: "2026-01-01T00:00:00.000Z"},
			usage: {inputTokenDetails: {cacheReadTokens: 1}},
		});
		expect(summarizeAiCallTelemetry(telemetry)).toMatchObject({
			totalTokens: 8,
			warningCount: 1,
			gatewayGenerationId: "g1",
		});
	});

	it("enriches missing token usage from gateway billing information", () => {
		const enriched = enrichAiCallTelemetryWithGatewayInfo(
			{usage: {inputTokens: 2}, response: {id: "r1"}},
			{
				id: "g1",
				totalCost: 0.2,
				upstreamInferenceCost: 0.1,
				usage: 0.18,
				createdAt: "2026-01-01T00:00:00Z",
				model: "model",
				providerName: "provider",
				streamed: true,
				isByok: false,
				inputTokens: 3,
				outputTokens: 7,
				cachedInputTokens: 1,
				reasoningTokens: 2,
			},
		);

		expect(enriched.gateway).toMatchObject({id: "g1", usageCost: 0.18});
		expect(enriched.usage).toMatchObject({inputTokens: 2, outputTokens: 7, totalTokens: 9});
		expect(enriched.totalUsage).toMatchObject({inputTokens: 3, outputTokens: 7, totalTokens: 10});
	});

	it("omits unavailable fields for empty sources", async () => {
		expect(await collectAiCallTelemetry({providerMetadata: {gateway: {generationId: " "}}})).toEqual({
			providerMetadata: {gateway: {generationId: " "}},
		});
		expect(summarizeAiCallTelemetry({})).toEqual({});
	});
});
