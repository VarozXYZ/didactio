import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {AiConfig} from "../src/ai/config.js";
import {
	AiGatewayConfigurationError,
	GatewayAiService,
} from "../src/ai/service.js";

const sdk = vi.hoisted(() => ({
	createGateway: vi.fn(),
	generateObject: vi.fn(),
	generateText: vi.fn(),
	streamObject: vi.fn(),
	streamText: vi.fn(),
}));

vi.mock("ai", () => sdk);

const config: AiConfig = {
	silver: {provider: "mock", model: "quick"},
	gold: {provider: "mock", model: "careful"},
	authoring: {language: "English", tone: "friendly", learnerLevel: "beginner"},
};

const telemetrySource = {
	finishReason: "stop",
	rawFinishReason: "stop",
	usage: {inputTokens: 2, outputTokens: 3, totalTokens: 5},
	totalUsage: {inputTokens: 2, outputTokens: 3, totalTokens: 5},
	request: {body: {prompt: "input"}},
	response: {id: "response", modelId: "mock/model", timestamp: new Date("2026-01-01T00:00:00Z")},
	providerMetadata: {gateway: {generationId: "generation"}},
};

const moderation = {
	approved: true,
	notes: "Approved.",
	normalizedTopic: "Testing",
	improvedTopicBrief: "A useful path through testing.",
	reasoningNotes: "Safe educational material.",
	folderName: "Computer Science",
	folderReasoning: "Programming topic.",
	stylePreset: "modern" as const,
};

function modules(count: number) {
	return Array.from({length: count}, (_, index) => ({
		title: `Module ${index + 1}`,
		overview: "Overview",
		lessons: [{title: "Lesson", contentOutline: ["Explain it"]}],
	}));
}

function syllabus(count = 6) {
	return {
		topic: "Testing",
		title: "Testing Path",
		keywords: "testing, quality",
		description: "A structured course.",
		modules: modules(count),
	};
}

function objectResult(object: unknown) {
	return {...telemetrySource, object};
}

function streamedObject(object: unknown, partial = object) {
	return {
		...telemetrySource,
		object: Promise.resolve(object),
		partialObjectStream: (async function* () {
			yield partial;
		})(),
	};
}

function streamedText(text: string, onChunk?: (input: {chunk: {type: string; text: string}}) => Promise<void>) {
	return {
		...telemetrySource,
		text: (async () => {
			await onChunk?.({chunk: {type: "tool-call", text: ""}});
			await onChunk?.({chunk: {type: "text-delta", text}});
			return text;
		})(),
	};
}

const logger = {
	child: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
};

function service() {
	logger.child.mockReturnValue(logger);
	return new GatewayAiService({logger: logger as never});
}

describe("GatewayAiService", () => {
	beforeEach(() => {
		process.env.AI_GATEWAY_API_KEY = "gateway-key";
		sdk.createGateway.mockReturnValue(
			Object.assign(vi.fn((modelId: string) => modelId), {
				getGenerationInfo: vi.fn().mockResolvedValue({
					id: "generation",
					totalCost: 0.1,
					upstreamInferenceCost: 0.05,
					usage: 0.09,
					createdAt: "2026-01-01T00:00:00Z",
					model: "mock/quick",
					providerName: "mock",
					streamed: false,
					isByok: false,
					inputTokens: 2,
					outputTokens: 3,
				}),
			}),
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
		delete process.env.AI_GATEWAY_API_KEY;
	});

	it("requires gateway configuration and classifies and moderates topics", async () => {
		delete process.env.AI_GATEWAY_API_KEY;
		expect(() => new GatewayAiService()).toThrow(AiGatewayConfigurationError);
		process.env.AI_GATEWAY_API_KEY = "gateway-key";
		sdk.generateObject
			.mockResolvedValueOnce(objectResult({folderName: "General", reasoning: "Broad topic.", stylePreset: "plain"}))
			.mockResolvedValueOnce(objectResult(moderation));

		const gateway = service();
		const classified = await gateway.classifyFolder({
			topic: "Testing",
			folders: [{name: "General", description: "Broad"}],
			config,
			tier: "silver",
		});
		const moderated = await gateway.moderateTopic({
			topic: "Testing",
			level: "beginner",
			config,
			tier: "silver",
		});

		expect(classified).toMatchObject({folderName: "General", stylePreset: "plain"});
		expect(classified.telemetry.gateway?.totalCost).toBe(0.1);
		expect(moderated).toMatchObject({approved: true, normalizedTopic: "Testing"});
		expect(logger.info).toHaveBeenCalled();
	});

	it("streams moderation and retries a short syllabus response", async () => {
		sdk.streamObject
			.mockReturnValueOnce(streamedObject(moderation, {approved: true, notes: "Approved."}))
			.mockReturnValueOnce(streamedObject(syllabus(1), {title: "Testing Path"}));
		sdk.generateObject.mockResolvedValueOnce(objectResult(syllabus(6)));
		const onPartial = vi.fn();
		const onComplete = vi.fn();
		const gateway = service();

		const moderationResult = await gateway.streamModeration(
			{topic: "Testing", level: "beginner", config, tier: "silver"},
			{onPartial, onComplete},
		);
		const syllabusResult = await gateway.streamSyllabus(
			{
				topic: "Testing",
				level: "beginner",
				syllabusPrompt: "Create a syllabus",
				depth: "basic",
				length: "intro",
				config,
				tier: "silver",
			},
			{onPartial, onComplete},
		);

		expect(moderationResult.approved).toBe(true);
		expect(syllabusResult.syllabus.modules).toHaveLength(6);
		expect(sdk.generateObject).toHaveBeenCalledOnce();
		expect(logger.warn).toHaveBeenCalledWith(
			"Syllabus module count mismatch; retrying",
			expect.any(Object),
		);
		expect(onPartial).toHaveBeenCalled();
		expect(onComplete).toHaveBeenCalledTimes(2);
	});

	it("streams summaries and canonical chapter HTML", async () => {
		sdk.streamText
			.mockImplementationOnce((input: {onChunk?: (event: {chunk: {type: string; text: string}}) => Promise<void>}) =>
				streamedText("## Recap\nA summary.", input.onChunk))
			.mockImplementationOnce((input: {onChunk?: (event: {chunk: {type: string; text: string}}) => Promise<void>}) =>
				streamedText("<h2>Concept</h2><p>A final transferable idea.</p>", input.onChunk));
		const onMarkdown = vi.fn();
		const onHtml = vi.fn();
		const gateway = service();

		const summary = await gateway.streamSummary(
			{topic: "Testing", chapterTitle: "Introduction", chapterMarkdown: "Body", config, tier: "silver"},
			{onMarkdown},
		);
		const chapter = await gateway.streamChapter(
			{
				topic: "Testing",
				level: "beginner",
				syllabus: syllabus(),
				chapterIndex: 0,
				depth: "basic",
				length: "intro",
				config,
				tier: "gold",
			},
			{onMarkdown, onHtml},
		);

		expect(summary.markdown).toContain("Recap");
		expect(chapter.chapter.html).toContain("final transferable idea");
		expect(chapter.continuitySummary).toBe("A final transferable idea.");
		expect(onHtml).toHaveBeenCalled();
		expect(onMarkdown).toHaveBeenCalledTimes(2);
	});

	it("normalizes activities, sanitizes feedback, and creates AI notes", async () => {
		const cards = Array.from({length: 20}, (_, index) => ({id: String(index)}));
		const prompts = Array.from({length: 5}, (_, index) => ({id: String(index)}));
		sdk.generateObject
			.mockResolvedValueOnce(objectResult({title: "Cards", instructions: "Study", dedupeSummary: "cards", content: {cards}}))
			.mockResolvedValueOnce(objectResult({title: "Questions", instructions: "Answer", dedupeSummary: "prompts", content: {prompts}}))
			.mockResolvedValueOnce(objectResult({
				score: 70,
				feedback: "Review.",
				strengths: ["Clear"],
				improvements: ["Detail"],
				questionFeedback: [{
					id: "one",
					simplifiedScore: "Good",
					expectedAnswer: "<p>Expected <script>remove</script></p>",
					improvementReason: "<strong>Improve</strong>",
					strengths: [],
					improvements: [],
				}],
			}));
		sdk.generateText.mockResolvedValueOnce({...telemetrySource, text: "<p>Keep <strong>this</strong>.</p><script>bad</script>"});
		const gateway = service();
		const input = {
			topic: "Testing",
			moduleTitle: "Assertions",
			scope: "current_module" as const,
			contextModules: [{index: 0, title: "Assertions", overview: "Checks"}],
			previousActivities: [],
			config,
			abortSignal: undefined,
		};

		const flashcards = await gateway.generateLearningActivity({...input, type: "flashcards", tier: "gold"});
		const answers = await gateway.generateLearningActivity({...input, type: "short_answer", tier: "silver"});
		const feedback = await gateway.generateLearningActivityFeedback({
			activityTitle: "Answers",
			activityType: "short_answer",
			instructions: "Answer",
			content: {},
			answers: {},
			config,
			tier: "silver",
		});
		const note = await gateway.generateDidacticUnitNote({
			unitTitle: "Testing",
			unitTopic: "Testing",
			unitOutline: [{index: 0, title: "Assertions", overview: "Checks"}],
			moduleTitle: "Assertions",
			moduleHtml: "<p>Body</p>",
			selectedText: "Body",
			config,
			tier: "silver",
		});

		expect((flashcards.content.cards as unknown[])).toHaveLength(15);
		expect((answers.content.prompts as unknown[])).toHaveLength(3);
		expect(feedback.questionFeedback[0]?.expectedAnswer).not.toContain("script");
		expect(note.content).toBe("<p>Keep <strong>this</strong>.</p>");
	});

	it("reports provider failures and invalid selected model settings", async () => {
		sdk.generateObject.mockRejectedValueOnce(new Error("provider failed"));
		const gateway = service();
		await expect(
			gateway.classifyFolder({topic: "Testing", folders: [], config, tier: "silver"}),
		).rejects.toThrow("provider failed");
		await expect(
			gateway.generateLearningActivity({
				topic: "Testing",
				moduleTitle: "One",
				scope: "current_module",
				type: "multiple_choice",
				contextModules: [],
				previousActivities: [],
				config: {...config, silver: {provider: "", model: ""}},
				tier: "silver",
			}),
		).rejects.toThrow(AiGatewayConfigurationError);
		expect(logger.error).toHaveBeenCalled();
	});
});
