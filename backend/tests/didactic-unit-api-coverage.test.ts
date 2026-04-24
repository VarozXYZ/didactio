import request from "supertest";
import {describe, expect, it} from "vitest";
import type {AiService} from "../src/ai/service.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {
	createApprovedDidacticUnit,
	createSyllabusReadyDidacticUnit,
	advanceToQuestionnaireAnswered,
	createDidacticUnit,
	generateDidacticUnitChapter,
} from "./helpers/didactic-unit-flow.js";
import {createMockAiService} from "./helpers/mock-ai-service.js";

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
				readCharacterCount: 0,
				totalCharacterCount: 0,
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
			readCharacterCount: 0,
			state: "ready",
		});
	});

	it("updates module reading progress monotonically and returns weighted study progress", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		await generateDidacticUnitChapter(app, approved.id, 0);

		const chapterResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/chapters/0`,
		);

		expect(chapterResponse.status).toBe(200);
		expect(chapterResponse.body.totalCharacterCount).toBeGreaterThan(0);

		const firstProgressResponse = await request(app)
			.put(
				`/api/didactic-unit/${approved.id}/chapters/0/reading-progress`,
			)
			.send({readCharacterCount: 40, lastVisitedPageIndex: 2});

		expect(firstProgressResponse.status).toBe(200);
		expect(firstProgressResponse.body.module).toMatchObject({
			chapterIndex: 0,
			readCharacterCount: 40,
			totalCharacterCount: chapterResponse.body.totalCharacterCount,
			lastVisitedPageIndex: 2,
			isCompleted: false,
		});
		expect(firstProgressResponse.body.studyProgress).toMatchObject({
			moduleCount: expect.any(Number),
			readCharacterCount: 40,
			totalCharacterCount: chapterResponse.body.totalCharacterCount,
		});

		const secondProgressResponse = await request(app)
			.put(
				`/api/didactic-unit/${approved.id}/chapters/0/reading-progress`,
			)
			.send({readCharacterCount: 10, lastVisitedPageIndex: 1});

		expect(secondProgressResponse.status).toBe(200);
		expect(secondProgressResponse.body.module.readCharacterCount).toBe(40);
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
				readCharacterCount: chapterResponse.body.totalCharacterCount,
			});

		expect(progressResponse.status).toBe(200);
		expect(progressResponse.body.module.isCompleted).toBe(true);

		const updateResponse = await request(app)
			.patch(`/api/didactic-unit/${approved.id}/chapters/0`)
			.send({
				chapter: {
					title: `${chapterResponse.body.title} updated`,
					content: `${chapterResponse.body.content}\n\nAdditional closing note.`,
					presentationSettings:
						chapterResponse.body.presentationSettings,
				},
			});

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.body).toMatchObject({
			chapterIndex: 0,
			readCharacterCount: 0,
			isCompleted: false,
		});
	});

	it("regenerates an existing chapter and records regeneration history", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		await generateDidacticUnitChapter(app, approved.id, 0);

		const regenerateResponse = await request(app)
			.post(`/api/didactic-unit/${approved.id}/chapters/0/regenerate`)
			.send({tier: "cheap"});

		expect(regenerateResponse.status).toBe(200);
		expect(regenerateResponse.body).toMatchObject({
			id: approved.id,
			status: "content_generation_in_progress",
		});

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
			.post(`/api/didactic-unit/${created.id}/syllabus/generate`)
			.send({tier: "cheap"});

		expect(firstGenerationResponse.status).toBe(200);
		expect(firstGenerationResponse.body).toMatchObject({
			id: created.id,
			status: "syllabus_ready",
			nextAction: "review_syllabus",
		});

		const regenerateResponse = await request(app)
			.post(`/api/didactic-unit/${created.id}/syllabus/generate`)
			.send({
				tier: "premium",
				context:
					"Lean further into practical exercises and project-based outcomes.",
			});

		expect(regenerateResponse.status).toBe(200);
		expect(regenerateResponse.body).toMatchObject({
			id: created.id,
			status: "syllabus_ready",
			nextAction: "review_syllabus",
		});
		expect(regenerateResponse.body.additionalContext).toContain(
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
				`/api/didactic-unit/${createdResponse.body.id}/syllabus/generate`,
			)
			.send({tier: "cheap"});

		expect(syllabusResponse.status).toBe(200);
		expect(syllabusResponse.body.syllabus.chapters).toHaveLength(12);
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
			.send({tier: "cheap"});

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
