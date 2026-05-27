import request from "supertest";
import {describe, expect, it} from "vitest";
import type {AiService} from "../src/ai/service.js";
import {
	createQueuedChapterGenerationRunRecord,
	InMemoryGenerationRunStore,
} from "../src/generation-runs/generation-run-store.js";
import {SYSTEM_DEFAULT_THEME} from "../src/presentation-theme/types.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {
	createApprovedDidacticUnit,
	createSyllabusReadyDidacticUnit,
	advanceToQuestionnaireAnswered,
	createDidacticUnit,
	generateDidacticUnitChapter,
} from "./helpers/didactic-unit-flow.js";
import {createMockAiService} from "./helpers/mock-ai-service.js";

function parseStreamComplete<T>(body: string): T {
	const completeLine = body
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line) as {type: string; data?: unknown})
		.find((event) => event.type === "complete");

	if (!completeLine) {
		throw new Error("Stream did not include a complete event.");
	}

	return completeLine.data as T;
}

describe("didactic-unit API coverage", () => {
	it("gets a didactic unit by id with the complete approved syllabus payload", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		const response = await request(app).get(
			`/api/didactic-unit/${approved.id}`,
		);

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			id: approved.id,
			status: "syllabus_approved",
			nextAction: "view_didactic_unit",
			title: expect.any(String),
			chapters: expect.any(Array),
			studyProgress: {
				moduleCount: expect.any(Number),
				readBlockCount: 0,
				totalBlockCount: 0,
				studyProgressPercent: 0,
			},
		});
		expect(response.body.chapters.length).toBeGreaterThan(0);
		expect(typeof response.body.syllabusApprovedAt).toBe("string");
	});

	it("updates the generated syllabus before approval and persists the edited structure", async () => {
		const app = createTestApp();
		const syllabusReady = await createSyllabusReadyDidacticUnit(app);
		const customSyllabus = {
			title: "Advanced next.js delivery plan",
			overview:
				"A custom syllabus focused on shipping production-ready outcomes.",
			learningGoals: [
				"Understand the framework architecture",
				"Build production features confidently",
				"Choose appropriate implementation tradeoffs",
			],
			keywords: ["framework architecture", "delivery", "production"],
			chapters: [
				{
					title: "Runtime Fundamentals",
					overview:
						"Review the core runtime model and framework primitives.",
					keyPoints: [
						"Routing model",
						"Rendering modes",
						"Server and client boundaries",
					],
					lessons: [
						{
							title: "Core Runtime",
							contentOutline: [
								"Routing model",
								"Rendering modes",
							],
						},
						{
							title: "Boundaries",
							contentOutline: ["Server and client boundaries"],
						},
					],
				},
				{
					title: "Delivery Workflow",
					overview:
						"Move from local development to production delivery.",
					keyPoints: [
						"Project structure",
						"Deployment pipeline",
						"Operational checks",
					],
					lessons: [
						{
							title: "Project Structure",
							contentOutline: [
								"Organize the app",
								"Prepare the pipeline",
							],
						},
						{
							title: "Operational Checks",
							contentOutline: [
								"Validate deployment",
								"Check production health",
							],
						},
					],
				},
			],
		};

		const updateResponse = await request(app)
			.patch(`/api/didactic-unit/${syllabusReady.id}/syllabus`)
			.send({syllabus: customSyllabus});

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.body).toMatchObject({
			id: syllabusReady.id,
			status: "syllabus_ready",
			nextAction: "approve_syllabus",
			syllabus: customSyllabus,
		});
		expect(typeof updateResponse.body.syllabusUpdatedAt).toBe("string");

		const getResponse = await request(app).get(
			`/api/didactic-unit/${syllabusReady.id}`,
		);

		expect(getResponse.status).toBe(200);
		expect(getResponse.body).toMatchObject({
			id: syllabusReady.id,
			title: customSyllabus.title,
			overview: customSyllabus.overview,
			learningGoals: customSyllabus.learningGoals,
			chapters: customSyllabus.chapters,
			syllabus: customSyllabus,
		});
	});

	it("lists chapter summaries with generated-content flags after chapter generation", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		await generateDidacticUnitChapter(app, approved.id, 0);

		const response = await request(app).get(
			`/api/didactic-unit/${approved.id}/chapters`,
		);

		expect(response.status).toBe(200);
		expect(response.body.chapters.length).toBeGreaterThan(0);
		expect(response.body.chapters[0]).toMatchObject({
			chapterIndex: 0,
			hasGeneratedContent: true,
			readBlockIndex: 0,
			totalBlocks: expect.any(Number),
			state: "ready",
		});
	});

	it("streams generation-run HTML blocks before completion", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		const createRunResponse = await request(app)
			.post(`/api/didactic-unit/${approved.id}/modules/0/generate-run`)
			.send({});

		expect(createRunResponse.status).toBe(202);

		const streamResponse = await request(app)
			.get(`/api/generation-runs/${createRunResponse.body.runId}/stream`)
			.send({});

		expect(streamResponse.status).toBe(200);
		const events = streamResponse.text
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as {type: string});
		const partialIndex = events.findIndex(
			(event) => event.type === "partial_html_block",
		);
		const completeIndex = events.findIndex(
			(event) => event.type === "complete",
		);

		expect(partialIndex).toBeGreaterThan(-1);
		expect(completeIndex).toBeGreaterThan(-1);
		expect(partialIndex).toBeLessThan(completeIndex);
	});

	it("keeps a unit theme selected while module generation is in progress", async () => {
		const baseAiService = createMockAiService();
		let notifyChapterStarted!: () => void;
		const chapterStarted = new Promise<void>((resolve) => {
			notifyChapterStarted = resolve;
		});
		let finishChapterGeneration!: () => void;
		const canFinishChapterGeneration = new Promise<void>((resolve) => {
			finishChapterGeneration = resolve;
		});
		const aiService: AiService = {
			...baseAiService,
			async streamChapter(input, callbacks) {
				notifyChapterStarted();
				await canFinishChapterGeneration;
				return baseAiService.streamChapter(input, callbacks);
			},
		};
		const app = createTestApp({aiService});
		const approved = await createApprovedDidacticUnit(app);

		const createRunResponse = await request(app)
			.post(`/api/didactic-unit/${approved.id}/modules/0/generate-run`)
			.send({});
		expect(createRunResponse.status).toBe(202);
		await chapterStarted;

		const themeResponse = await request(app)
			.patch(`/api/didactic-unit/${approved.id}/theme`)
			.send({
				presentationTheme: {
					...SYSTEM_DEFAULT_THEME,
					stylePreset: "plain",
				},
			});
		expect(themeResponse.status).toBe(200);
		expect(themeResponse.body.presentationTheme.stylePreset).toBe("plain");

		finishChapterGeneration();
		const streamResponse = await request(app).get(
			`/api/generation-runs/${createRunResponse.body.runId}/stream`,
		);
		expect(streamResponse.status).toBe(200);
		parseStreamComplete(streamResponse.text);

		const unitResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}`,
		);
		expect(unitResponse.status).toBe(200);
		expect(unitResponse.body.presentationTheme.stylePreset).toBe("plain");
	});

	it("cancels a pending generation run and streams its failed terminal state", async () => {
		const generationRunStore = new InMemoryGenerationRunStore();
		const run = createQueuedChapterGenerationRunRecord({
			didacticUnitId: "unit-to-cancel",
			ownerId: "mock-user",
			chapterIndex: 0,
			provider: "test-provider",
			model: "test-model",
		});
		await generationRunStore.save(run);
		const app = createTestApp({generationRunStore});

		const cancelResponse = await request(app).post(
			`/api/generation-runs/${run.id}/cancel`,
		);
		expect(cancelResponse.status).toBe(200);

		const streamResponse = await request(app).get(
			`/api/generation-runs/${run.id}/stream`,
		);
		expect(streamResponse.status).toBe(200);
		expect(streamResponse.text).toContain('"type":"error"');
		expect(streamResponse.text).toContain("Cancelled by user.");
	});

	it("updates module reading progress monotonically and returns weighted study progress", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		await generateDidacticUnitChapter(app, approved.id, 0);

		const chapterResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/chapters/0`,
		);

		expect(chapterResponse.status).toBe(200);
		expect(chapterResponse.body.totalBlocks).toBeGreaterThan(0);

		const firstProgressResponse = await request(app)
			.put(
				`/api/didactic-unit/${approved.id}/chapters/0/reading-progress`,
			)
			.send({readBlockIndex: 1, readBlockOffset: 4, lastVisitedPageIndex: 2});

		expect(firstProgressResponse.status).toBe(200);
		expect(firstProgressResponse.body.module).toMatchObject({
			chapterIndex: 0,
			readBlockIndex: 1,
			readBlockOffset: 4,
			totalBlocks: chapterResponse.body.totalBlocks,
			lastVisitedPageIndex: 2,
			isCompleted: false,
		});
		expect(firstProgressResponse.body.studyProgress).toMatchObject({
			moduleCount: expect.any(Number),
			readBlockCount: expect.any(Number),
			totalBlockCount: expect.any(Number),
		});

		const secondProgressResponse = await request(app)
			.put(
				`/api/didactic-unit/${approved.id}/chapters/0/reading-progress`,
			)
			.send({readBlockIndex: 0, lastVisitedPageIndex: 1});

		expect(secondProgressResponse.status).toBe(200);
		expect(secondProgressResponse.body.module.readBlockIndex).toBe(1);
		expect(secondProgressResponse.body.module.lastVisitedPageIndex).toBe(1);

		const listResponse = await request(app)
			.get(`/api/didactic-unit/${approved.id}/chapters`)
			.expect(200);
		expect(listResponse.body.chapters[0].lastVisitedPageIndex).toBe(1);

		const detailResponse = await request(app)
			.get(`/api/didactic-unit/${approved.id}/chapters/0`)
			.expect(200);
		expect(detailResponse.body.lastVisitedPageIndex).toBe(1);
	});

	it("resets module reading progress when generated content is edited", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		await generateDidacticUnitChapter(app, approved.id, 0);

		const chapterResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/chapters/0`,
		);

		expect(chapterResponse.status).toBe(200);

		const progressResponse = await request(app)
			.put(
				`/api/didactic-unit/${approved.id}/chapters/0/reading-progress`,
			)
			.send({
				readBlockIndex: chapterResponse.body.totalBlocks - 1,
			});

		expect(progressResponse.status).toBe(200);
		expect(progressResponse.body.module.isCompleted).toBe(false);

		const completionResponse = await request(app).post(
			`/api/didactic-unit/${approved.id}/chapters/0/complete`,
		);
		expect(completionResponse.status).toBe(200);
		expect(completionResponse.body.studyProgress.studyProgressPercent).toBe(100);

		const updateResponse = await request(app)
			.patch(`/api/didactic-unit/${approved.id}/chapters/0`)
			.send({
				chapter: {
					title: `${chapterResponse.body.title} updated`,
					html: `${chapterResponse.body.html}<p>Additional closing note.</p>`,
					htmlHash: chapterResponse.body.htmlHash,
				},
			});

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.body).toMatchObject({
			chapterIndex: 0,
			readBlockIndex: 0,
			isCompleted: false,
		});
	});

	it("regenerates an existing chapter through a generation run and records history", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		await generateDidacticUnitChapter(app, approved.id, 0);

		await generateDidacticUnitChapter(app, approved.id, 0);

		const revisionsResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/chapters/0/revisions`,
		);

		expect(revisionsResponse.status).toBe(200);
		expect(revisionsResponse.body.revisions[0]).toMatchObject({
			chapterIndex: 0,
			source: "ai_regeneration",
		});
		expect(
			revisionsResponse.body.revisions.some(
				(revision: {chapterIndex: number; source: string}) =>
					revision.chapterIndex === 0 &&
					revision.source === "ai_generation",
			),
		).toBe(true);

		const runsResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/runs`,
		);

		expect(runsResponse.status).toBe(200);
		expect(
			runsResponse.body.runs.filter(
				(run: {stage: string}) => run.stage === "chapter",
			),
		).toHaveLength(2);
		expect(
			runsResponse.body.runs.find(
				(run: {stage: string; chapterIndex?: number}) =>
					run.stage === "chapter" && run.chapterIndex === 0,
			),
		).toMatchObject({
			telemetry: {
				finishReason: "stop",
				totalUsage: {
					totalTokens: 30,
				},
				response: {
					id: "mock-response-id",
				},
				gatewayGenerationId: "mock-generation-id",
			},
		});
	});

	it("generates and regenerates a syllabus directly without exposing the prompt step", async () => {
		const app = createTestApp();
		const created = await createDidacticUnit(app);

		await advanceToQuestionnaireAnswered(app, created.id);

		const firstGenerationResponse = await request(app)
			.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
			.send({quality: "silver"});

		expect(firstGenerationResponse.status).toBe(200);
		expect(parseStreamComplete(firstGenerationResponse.text)).toMatchObject({
			id: created.id,
			status: "syllabus_ready",
			nextAction: "review_syllabus",
		});

		const regenerateResponse = await request(app)
			.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
			.send({
				quality: "gold",
				context:
					"Lean further into practical exercises and project-based outcomes.",
			});

		expect(regenerateResponse.status).toBe(200);
		const regenerated = parseStreamComplete<{additionalContext: string}>(
			regenerateResponse.text,
		);
		expect(regenerated).toMatchObject({
			id: created.id,
			status: "syllabus_ready",
			nextAction: "review_syllabus",
		});
		expect(regenerated.additionalContext).toContain(
			"Lean further into practical exercises and project-based outcomes.",
		);
	});

	it("sizes syllabus chapter counts according to the requested unit length", async () => {
		const app = createTestApp();

		const createdResponse = await request(app)
			.post("/api/didactic-unit")
			.send({
				topic: "python scripting",
				length: "textbook",
			});

		expect(createdResponse.status).toBe(201);

		await advanceToQuestionnaireAnswered(app, createdResponse.body.id);

		const syllabusResponse = await request(app)
			.post(
				`/api/didactic-unit/${createdResponse.body.id}/syllabus/generate/stream`,
			)
			.send({quality: "silver"});

		expect(syllabusResponse.status).toBe(200);
		expect(
			parseStreamComplete<{syllabus: {chapters: unknown[]}}>(
				syllabusResponse.text,
			).syllabus.chapters,
		).toHaveLength(12);
	});

	it("trims extra textbook modules returned by streamed syllabus generation", async () => {
		const baseAiService = createMockAiService();
		const aiService: AiService = {
			...baseAiService,
			async generateSyllabus(input) {
				const result = await baseAiService.generateSyllabus(input);
				return {
					...result,
					syllabus: {
						...result.syllabus,
						modules: [
							...result.syllabus.modules,
							{
								title: "Bonus module",
								overview:
									"A spillover module that should be trimmed.",
								lessons: [
									{
										title: "Overflow lesson",
										contentOutline: [
											"Keep the syllabus within the requested size",
										],
									},
								],
							},
						],
					},
				};
			},
		};
		const app = createTestApp({aiService});

		const createdResponse = await request(app)
			.post("/api/didactic-unit")
			.send({
				topic: "python scripting",
				length: "textbook",
			});

		expect(createdResponse.status).toBe(201);

		await advanceToQuestionnaireAnswered(app, createdResponse.body.id);

		const streamResponse = await request(app)
			.post(
				`/api/didactic-unit/${createdResponse.body.id}/syllabus/generate/stream`,
			)
			.send({quality: "silver"});

		expect(streamResponse.status).toBe(200);

		const events = streamResponse.text
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as {type: string; data?: unknown});
		const completeEvent = [...events]
			.reverse()
			.find((event) => event.type === "complete");

		expect(events.some((event) => event.type === "error")).toBe(false);
		expect(completeEvent).toBeTruthy();
		expect(completeEvent?.data).toMatchObject({
			id: createdResponse.body.id,
			syllabus: {
				chapters: expect.any(Array),
			},
		});
		expect(
			(
				completeEvent?.data as {
					syllabus: {chapters: unknown[]};
				}
			).syllabus.chapters,
		).toHaveLength(12);
	});
});
