import {describe, expect, it} from "vitest";
import {
	collectAiCallTelemetry,
	summarizeAiCallTelemetry,
} from "../src/ai/telemetry.js";

describe("AI telemetry", () => {
	it("serializes LangChain calls without provider-specific billing metadata", async () => {
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
		}, 12);

		expect(telemetry).toMatchObject({
			durationMs: 12,
			response: {timestamp: "2026-01-01T00:00:00.000Z"},
			usage: {inputTokenDetails: {cacheReadTokens: 1}},
		});
		expect(summarizeAiCallTelemetry(telemetry)).toMatchObject({
			totalTokens: 8,
			warningCount: 1,
		});
	});

	it("omits unavailable fields for empty sources", async () => {
		expect(await collectAiCallTelemetry({})).toEqual({});
		expect(summarizeAiCallTelemetry({})).toEqual({});
	});
});
