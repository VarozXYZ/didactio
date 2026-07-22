import {describe, expect, it, vi} from "vitest";
import {AIMessage, AIMessageChunk} from "@langchain/core/messages";
import {z} from "zod";
import {
	createLangChainGateway,
	createLangSmithTracer,
	generateObject,
	streamObject,
	streamText,
} from "../src/ai/langchain-runtime.js";

describe("LangChain runtime adapter", () => {
	it("runs structured parsing through the LangGraph boundary", async () => {
		const gateway = createLangChainGateway({
			apiKey: "test-key",
			baseURL: "https://example.test/v1/ai",
		});
		const model = gateway("mock/model");
		vi.spyOn(model, "invoke").mockResolvedValue(
			new AIMessage({
				content: '{"approved":true}',
				response_metadata: {finish_reason: "stop", model_name: "mock/model"},
				usage_metadata: {input_tokens: 2, output_tokens: 3, total_tokens: 5},
			}),
		);

		const result = await generateObject({
			model,
			system: "Return JSON.",
			prompt: "Approve this test.",
			schema: z.object({approved: z.boolean()}),
		});

		expect(result.object).toEqual({approved: true});
		expect(result.usage).toEqual({inputTokens: 2, outputTokens: 3, totalTokens: 5});
		expect(model.invoke).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({response_format: {type: "json_object"}}),
		);
	});

	it("repairs malformed structured output and forwards text deltas", async () => {
		const gateway = createLangChainGateway({
			apiKey: "test-key",
			baseURL: "https://example.test/v1",
		});
		const model = gateway("mock/model");
		vi.spyOn(model, "invoke").mockResolvedValue(new AIMessage({content: "not-json"}));
		const repaired = await generateObject({
			model,
			prompt: "Return JSON.",
			schema: z.object({value: z.string()}),
			experimental_repairText: async () => '{"value":"repaired"}',
		});
		expect(repaired.object).toEqual({value: "repaired"});

		const stream = vi.spyOn(model, "stream").mockResolvedValue(
			(async function* () {
				yield new AIMessageChunk({content: "Hello"});
				yield new AIMessageChunk({content: " world"});
			})(),
		);
		const deltas: string[] = [];
		const textResult = streamText({
			model,
			prompt: "Say hello.",
			onChunk: ({chunk}) => deltas.push(chunk.text),
		});

		expect(await textResult.text).toBe("Hello world");
		expect(deltas).toEqual(["Hello", " world"]);
		expect(stream).toHaveBeenCalled();
	});

	it("keeps LangSmith opt-in when no credentials are configured", () => {
		expect(
		createLangSmithTracer({
			apiKey: null,
			project: "test",
			endpoint: "https://api.smith.langchain.com",
			tracing: true,
		}),
		).toBeUndefined();
	});
});
