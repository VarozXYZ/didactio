import {AIMessage, AIMessageChunk, HumanMessage, SystemMessage} from "@langchain/core/messages";
import {LangChainTracer} from "@langchain/core/tracers/tracer_langchain";
import {Annotation, END, START, StateGraph} from "@langchain/langgraph";
import {ChatOpenAI} from "@langchain/openai";
import {Client} from "langsmith";
import type {Logger} from "../logging/logger.js";
import {z} from "zod";

export interface LangSmithOptions {
	apiKey: string | null;
	project: string;
	endpoint: string;
	tracing: boolean;
}

export interface LangChainRuntimeOptions {
	apiKey: string;
	baseURL: string;
	langSmith?: LangSmithOptions;
	logger?: Logger;
}

type StructuredRepair =
	| ((input: {text: string}) => string | null | Promise<string | null>)
	| undefined;

interface BaseGenerationOptions {
	model: ChatOpenAI;
	system?: string;
	prompt: string;
	maxOutputTokens?: number;
	abortSignal?: AbortSignal;
}

interface StructuredGenerationOptions<T = unknown> extends BaseGenerationOptions {
	schema: z.ZodType<T>;
	experimental_repairText?: StructuredRepair;
}

export interface LangChainGenerationResult {
	text: string;
	finishReason?: string;
	rawFinishReason?: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
	totalUsage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
	response?: {
		id?: string;
		modelId?: string;
		timestamp?: Date;
	};
}

export interface LangChainStructuredResult<T> extends LangChainGenerationResult {
	object: T;
}

interface StructuredStreamResult<T> {
	object: Promise<T>;
	partialObjectStream: AsyncIterable<Partial<T>>;
	finishReason?: Promise<string | undefined>;
	rawFinishReason?: Promise<string | undefined>;
	usage?: Promise<LangChainGenerationResult["usage"]>;
	totalUsage?: Promise<LangChainGenerationResult["totalUsage"]>;
	response?: Promise<LangChainGenerationResult["response"]>;
}

interface TextStreamOptions extends BaseGenerationOptions {
	onChunk?: (input: {chunk: {type: string; text: string}}) => Promise<void> | void;
}

interface TextStreamResult {
	text: Promise<string>;
	finishReason?: Promise<string | undefined>;
	rawFinishReason?: Promise<string | undefined>;
	usage?: Promise<LangChainGenerationResult["usage"]>;
	totalUsage?: Promise<LangChainGenerationResult["totalUsage"]>;
	response?: Promise<LangChainGenerationResult["response"]>;
}

function normalizeBaseUrl(baseURL: string): string {
	return baseURL.replace(/\/ai\/?$/, "");
}

function createMessages(system: string | undefined, prompt: string) {
	return [
		...(system ? [new SystemMessage(system)] : []),
		new HumanMessage(prompt),
	];
}

function contentToText(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => {
			if (typeof part === "string") return part;
			if (part && typeof part === "object" && "text" in part) {
				return typeof part.text === "string" ? part.text : "";
			}
			return "";
		})
		.join("");
}

function responseMetadata(message: AIMessage | AIMessageChunk) {
	const metadata = message.response_metadata as Record<string, unknown> | undefined;
	const usage = message.usage_metadata as {
		input_tokens?: number;
		output_tokens?: number;
		total_tokens?: number;
	} | undefined;
	return {
		finishReason:
			typeof metadata?.finish_reason === "string" ? metadata.finish_reason : undefined,
		usage: usage ? {
			inputTokens: usage.input_tokens,
			outputTokens: usage.output_tokens,
			totalTokens: usage.total_tokens,
		} : undefined,
		response: {
			id: typeof message.id === "string" ? message.id : undefined,
			modelId:
				typeof metadata?.model_name === "string" ? metadata.model_name : undefined,
			timestamp: new Date(),
		},
	};
}

const StructuredState = Annotation.Root({
	raw: Annotation<string>(),
	parseFn: Annotation<(raw: string) => unknown>(),
	parsed: Annotation<unknown>(),
});

const structuredGraph = new StateGraph(StructuredState)
	.addNode("parseNode", (state) => ({parsed: state.parseFn(state.raw)}))
	.addEdge(START, "parseNode")
	.addEdge("parseNode", END)
	.compile();

async function parseWithLangGraph<T>(raw: string, parse: (value: string) => T): Promise<T> {
	const result = await structuredGraph.invoke({raw, parseFn: parse});
	return result.parsed as T;
}

async function parseStructured<T>(
	raw: string,
	schema: z.ZodType<T>,
	repairText: StructuredRepair,
): Promise<T> {
	return parseWithLangGraph(raw, async (candidate) => {
		const validate = (value: string) => {
			const parsed = schema.safeParse(JSON.parse(value));
			if (!parsed.success) throw new Error("Structured AI response did not match schema.");
			return parsed.data;
		};

		try {
			return validate(candidate);
		} catch (error) {
			const repaired = await repairText?.({text: candidate});
			if (!repaired) throw error;
			return validate(repaired);
		}
	});
}

function invokeOptions(options: BaseGenerationOptions) {
	return {
		maxTokens: options.maxOutputTokens,
		signal: options.abortSignal,
		response_format: {type: "json_object" as const},
	};
}

function generationSource(
	message: AIMessage | AIMessageChunk,
	startedAt: number,
): LangChainGenerationResult {
	const metadata = responseMetadata(message);
	return {
		text: contentToText(message.content),
		finishReason: metadata.finishReason,
		rawFinishReason: metadata.finishReason,
		usage: metadata.usage,
		totalUsage: metadata.usage,
		response: metadata.response,
	};
}

export async function generateObject<T>(
	options: StructuredGenerationOptions<T>,
): Promise<LangChainStructuredResult<T>> {
	const startedAt = Date.now();
	const message = await options.model.invoke(
		createMessages(options.system, options.prompt),
		invokeOptions(options),
	);
	const source = generationSource(message, startedAt);
	return {
		...source,
		object: await parseStructured(source.text, options.schema, options.experimental_repairText),
	};
}

export function streamObject<T>(
	options: StructuredGenerationOptions<T>,
): StructuredStreamResult<T> {
	let resolveObject!: (value: T) => void;
	let rejectObject!: (error: unknown) => void;
	const object = new Promise<T>((resolve, reject) => {
		resolveObject = resolve;
		rejectObject = reject;
	});
	const partialQueue = new AsyncQueue<Partial<T>>();
	let resolveTelemetry!: (value: LangChainGenerationResult) => void;
	let rejectTelemetry!: (error: unknown) => void;
	const telemetry = new Promise<LangChainGenerationResult>((resolve, reject) => {
		resolveTelemetry = resolve;
		rejectTelemetry = reject;
	});

	void (async () => {
		let raw = "";
		let lastMessage: AIMessageChunk | undefined;
		try {
			const stream = await options.model.stream(
				createMessages(options.system, options.prompt),
				invokeOptions(options),
			);
			for await (const chunk of stream) {
				lastMessage = chunk;
				raw += contentToText(chunk.content);
				try {
					const partial = JSON.parse(raw) as Partial<T>;
					await partialQueue.push(partial);
				} catch {
					// Structured JSON is incomplete until a later chunk.
				}
			}
			const source = generationSource(lastMessage ?? new AIMessageChunk({content: raw}), Date.now());
			resolveTelemetry(source);
			resolveObject(await parseStructured(raw, options.schema, options.experimental_repairText));
			partialQueue.end();
		} catch (error) {
			rejectTelemetry(error);
			rejectObject(error);
			partialQueue.fail(error);
		}
	})();

	return {
		object,
		partialObjectStream: partialQueue,
		finishReason: telemetry.then((value) => value.finishReason),
		rawFinishReason: telemetry.then((value) => value.rawFinishReason),
		usage: telemetry.then((value) => value.usage),
		totalUsage: telemetry.then((value) => value.totalUsage),
		response: telemetry.then((value) => value.response),
	};
}

export async function generateText(options: BaseGenerationOptions): Promise<LangChainGenerationResult> {
	const message = await options.model.invoke(
		createMessages(options.system, options.prompt),
		{...invokeOptions(options), response_format: undefined},
	);
	return generationSource(message, Date.now());
}

export function streamText(options: TextStreamOptions): TextStreamResult {
	let resolveText!: (value: string) => void;
	let rejectText!: (error: unknown) => void;
	const text = new Promise<string>((resolve, reject) => {
		resolveText = resolve;
		rejectText = reject;
	});
	let resolveTelemetry!: (value: LangChainGenerationResult) => void;
	let rejectTelemetry!: (error: unknown) => void;
	const telemetry = new Promise<LangChainGenerationResult>((resolve, reject) => {
		resolveTelemetry = resolve;
		rejectTelemetry = reject;
	});

	void (async () => {
		let output = "";
		let lastMessage: AIMessageChunk | undefined;
		try {
			const stream = await options.model.stream(
				createMessages(options.system, options.prompt),
				{...invokeOptions(options), response_format: undefined},
			);
			for await (const chunk of stream) {
				lastMessage = chunk;
				const delta = contentToText(chunk.content);
				if (!delta) continue;
				output += delta;
				await options.onChunk?.({chunk: {type: "text-delta", text: delta}});
			}
			const source = generationSource(lastMessage ?? new AIMessageChunk({content: output}), Date.now());
			resolveTelemetry(source);
			resolveText(output);
		} catch (error) {
			rejectTelemetry(error);
			rejectText(error);
		}
	})();

	return {
		text,
		finishReason: telemetry.then((value) => value.finishReason),
		rawFinishReason: telemetry.then((value) => value.rawFinishReason),
		usage: telemetry.then((value) => value.usage),
		totalUsage: telemetry.then((value) => value.totalUsage),
		response: telemetry.then((value) => value.response),
	};
}

export interface LangChainGateway {
	(modelId: string): ChatOpenAI;
}

export function createLangSmithTracer(options: LangSmithOptions, logger?: Logger): LangChainTracer | undefined {
	if (!options.tracing || !options.apiKey) return undefined;
	const client = new Client({apiKey: options.apiKey, apiUrl: options.endpoint});
	logger?.info("LangSmith tracing enabled", {project: options.project});
	return new LangChainTracer({client, projectName: options.project, tags: ["didactio"]});
}

export function createLangChainGateway(options: LangChainRuntimeOptions): LangChainGateway {
	const tracer = options.langSmith ? createLangSmithTracer(options.langSmith, options.logger) : undefined;
	const models = new Map<string, ChatOpenAI>();
	return (modelId: string) => {
		const existing = models.get(modelId);
		if (existing) return existing;
		const model = new ChatOpenAI({
			model: modelId,
			apiKey: options.apiKey,
			configuration: {baseURL: normalizeBaseUrl(options.baseURL)},
			callbacks: tracer ? [tracer] : undefined,
		});
		models.set(modelId, model);
		return model;
	};
}

class AsyncQueue<T> implements AsyncIterable<Partial<T>> {
	private readonly values: Partial<T>[] = [];
	private readonly waiters: Array<(result: IteratorResult<Partial<T>>) => void> = [];
	private ended = false;
	private failure: unknown;

	async push(value: Partial<T>): Promise<void> {
		const waiter = this.waiters.shift();
		if (waiter) waiter({done: false, value});
		else this.values.push(value);
	}

	end(): void {
		this.ended = true;
		while (this.waiters.length) this.waiters.shift()!({done: true, value: undefined as never});
	}

	fail(error: unknown): void {
		this.failure = error;
		this.ended = true;
		while (this.waiters.length) this.waiters.shift()!({done: true, value: undefined as never});
	}

	[Symbol.asyncIterator](): AsyncIterator<Partial<T>> {
		return {
			next: async () => {
				if (this.values.length) return {done: false, value: this.values.shift()!};
				if (this.failure) throw this.failure;
				if (this.ended) return {done: true, value: undefined as never};
				return new Promise<IteratorResult<Partial<T>>>((resolve) => this.waiters.push(resolve));
			},
		};
	}
}
