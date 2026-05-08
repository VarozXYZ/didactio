import request from "supertest";
import {describe, expect, it} from "vitest";
import {createTestApp} from "./helpers/create-test-app.js";
import {createMockAiService} from "./helpers/mock-ai-service.js";

async function createDidacticUnit(app: ReturnType<typeof createTestApp>) {
	const response = await request(app)
		.post("/api/didactic-unit")
		.send({topic: "next.js framework"});

	expect(response.status).toBe(201);
	return response.body as {id: string};
}

async function waitForDidacticUnitStatus(
	app: ReturnType<typeof createTestApp>,
	didacticUnitId: string,
	status: string,
) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const response = await request(app).get(
			`/api/didactic-unit/${didacticUnitId}`,
		);
		expect(response.status).toBe(200);
		if (response.body.status === status) {
			return response.body;
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	throw new Error(`Didactic unit did not reach status "${status}".`);
}

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

async function advanceToQuestionnaireAnswered(
	app: ReturnType<typeof createTestApp>,
	didacticUnitId: string,
) {
	const moderationResponse = await request(app)
		.post(`/api/didactic-unit/${didacticUnitId}/moderate`)
		.send({tier: "cheap"});

	expect(moderationResponse.status).toBe(200);

	const questionnaireResponse = await request(app).get(
		`/api/didactic-unit/${didacticUnitId}`,
	);

	expect(questionnaireResponse.status).toBe(200);

	const answers = questionnaireResponse.body.questionnaire.questions.map(
		(question: {id: string}) => ({
			questionId: question.id,
			value: `answer-for-${question.id}`,
		}),
	);

	const answeredResponse = await request(app)
		.patch(`/api/didactic-unit/${didacticUnitId}/questionnaire/answers`)
		.send({answers});

	expect(answeredResponse.status).toBe(200);
}

async function createApprovedDidacticUnit(
	app: ReturnType<typeof createTestApp>,
) {
	const created = await createDidacticUnit(app);

	await advanceToQuestionnaireAnswered(app, created.id);

	const syllabusResponse = await request(app)
		.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
		.send({quality: "silver"});

	expect(syllabusResponse.status).toBe(200);

	const approvedResponse = await request(app)
		.post(`/api/didactic-unit/${created.id}/approve-syllabus`)
		.send({quality: "silver"});

	expect(approvedResponse.status).toBe(200);

	return approvedResponse.body as {id: string};
}

async function generateChapter(
	app: ReturnType<typeof createTestApp>,
	didacticUnitId: string,
	chapterIndex = 0,
) {
	const createRunResponse = await request(app)
		.post(
			`/api/didactic-unit/${didacticUnitId}/modules/${chapterIndex}/generate-run`,
		)
		.send({});
	expect(createRunResponse.status).toBe(202);

	const streamResponse = await request(app)
		.get(`/api/generation-runs/${createRunResponse.body.runId}/stream`)
		.send({});
	expect(streamResponse.status).toBe(200);
	parseStreamComplete(streamResponse.text);
}

describe("didactic-unit lifecycle", () => {
	it("creates a didactic unit from topic and provider", async () => {
		const app = createTestApp();

		const response = await request(app)
			.post("/api/didactic-unit")
			.send({topic: "  next.js framework  ", provider: "deepseek"});

		expect(response.status).toBe(201);
		expect(response.body).toMatchObject({
			ownerId: "mock-user",
			topic: "next.js framework",
			title: "next.js framework",
			provider: "deepseek",
			status: "questionnaire_pending_moderation",
			nextAction: "answer_questionnaire",
			overview: "",
			chapters: [],
		});
		expect(response.body.questionnaire.questions).toHaveLength(3);
		expect(response.body.questionnaire.questions[0]).toMatchObject({
			id: "desired_outcome",
			type: "single_select",
		});
		expect(typeof response.body.id).toBe("string");
		expect(response.body.studyProgress).toEqual({
			moduleCount: 0,
			readBlockCount: 0,
			totalBlockCount: 0,
			studyProgressPercent: 0,
		});
	});

	it("persists a moderation rejection from the background moderation job", async () => {
		const baseAiService = createMockAiService();
		const app = createTestApp({
			aiService: {
				...baseAiService,
				async moderateTopic(input) {
					const result = await baseAiService.moderateTopic(input);
					return {
						...result,
						approved: false,
						notes: "Topic was rejected.",
					};
				},
			},
		});

		const created = await createDidacticUnit(app);
		const rejected = await waitForDidacticUnitStatus(
			app,
			created.id,
			"moderation_rejected",
		);

		expect(rejected).toMatchObject({
			status: "moderation_rejected",
			nextAction: "moderate_topic",
			moderationError: "Topic was rejected.",
		});
	});

	it("marks moderation as failed after three background job attempts", async () => {
		const baseAiService = createMockAiService();
		const app = createTestApp({
			aiService: {
				...baseAiService,
				async moderateTopic() {
					throw new Error("Gateway unavailable.");
				},
			},
		});

		const created = await createDidacticUnit(app);
		const failed = await waitForDidacticUnitStatus(
			app,
			created.id,
			"moderation_failed",
		);

		expect(failed).toMatchObject({
			status: "moderation_failed",
			nextAction: "moderate_topic",
			moderationError: "Gateway unavailable.",
			moderationAttempts: 3,
		});
	});

	it("lists didactic unit summaries without legacy handoff fields", async () => {
		const app = createTestApp();

		const created = await createDidacticUnit(app);
		const response = await request(app).get("/api/didactic-unit");

		expect(response.status).toBe(200);
		expect(response.body.didacticUnits).toHaveLength(1);
		expect(response.body.didacticUnits[0]).toMatchObject({
			id: created.id,
			title: "next.js framework",
			topic: "next.js framework",
			nextAction: "answer_questionnaire",
			moduleCount: 0,
		});
		expect([
			"questionnaire_pending_moderation",
			"questionnaire_ready",
		]).toContain(response.body.didacticUnits[0].status);
		expect([17, 33]).toContain(
			response.body.didacticUnits[0].progressPercent,
		);
		expect(response.body.didacticUnits[0]).not.toHaveProperty(
			"legacyPlanningId",
		);
	});

	it("progresses one didactic unit through setup and syllabus approval", async () => {
		const app = createTestApp();
		const created = await createDidacticUnit(app);

		await advanceToQuestionnaireAnswered(app, created.id);

		const syllabusResponse = await request(app)
			.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
			.send({quality: "silver"});

		expect(syllabusResponse.status).toBe(200);
		const syllabusBody = parseStreamComplete<{
			status: string;
			nextAction: string;
			syllabus: {chapters: unknown[]};
		}>(syllabusResponse.text);
		expect(syllabusBody).toMatchObject({
			status: "syllabus_ready",
			nextAction: "review_syllabus",
		});
		expect(syllabusBody.syllabus.chapters.length).toBeGreaterThan(
			0,
		);

		const runsResponse = await request(app).get(
			`/api/didactic-unit/${created.id}/runs`,
		);
		expect(runsResponse.status).toBe(200);
		expect(runsResponse.body.runs[0]).toMatchObject({
			stage: "syllabus",
			status: "completed",
			didacticUnitId: created.id,
		});

		const approvedResponse = await request(app)
			.post(`/api/didactic-unit/${created.id}/approve-syllabus`)
			.send({quality: "silver"});

		expect(approvedResponse.status).toBe(200);
		expect(approvedResponse.body).toMatchObject({
			id: created.id,
			status: "syllabus_approved",
			nextAction: "view_didactic_unit",
		});
	});

	it("can skip questionnaire onboarding and move directly to syllabus prompt generation", async () => {
		const app = createTestApp();

		const createdResponse = await request(app)
			.post("/api/didactic-unit")
			.send({
				topic: "python scripting",
				questionnaireEnabled: false,
			});

		expect(createdResponse.status).toBe(201);
		expect(createdResponse.body.questionnaireEnabled).toBe(false);

		const moderatedResponse = await request(app)
			.post(`/api/didactic-unit/${createdResponse.body.id}/moderate`)
			.send({});

		expect(moderatedResponse.status).toBe(200);
		expect(moderatedResponse.body).toMatchObject({
			status: "moderation_completed",
			nextAction: "generate_syllabus_prompt",
			questionnaireEnabled: false,
		});
	});

	it("can skip a generated questionnaire and continue with fallback learner context", async () => {
		const app = createTestApp();
		const created = await createDidacticUnit(app);

		const moderatedResponse = await request(app)
			.post(`/api/didactic-unit/${created.id}/moderate`)
			.send({tier: "cheap"});

		expect(moderatedResponse.status).toBe(200);

	const skippedResponse = await request(app)
			.patch(`/api/didactic-unit/${created.id}/questionnaire/answers`)
			.send({answers: []});

		expect(skippedResponse.status).toBe(200);
		expect(skippedResponse.body).toMatchObject({
			status: "questionnaire_answered",
			nextAction: "generate_syllabus_prompt",
			questionnaireAnswers: [],
		});

		const syllabusResponse = await request(app)
			.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
			.send({quality: "silver"});

		expect(syllabusResponse.status).toBe(200);
		expect(parseStreamComplete(syllabusResponse.text)).toMatchObject({
			status: "syllabus_ready",
			nextAction: "review_syllabus",
		});
	});

	it("generates, reads, completes, and tracks a chapter on the same didactic unit", async () => {
		const app = createTestApp();
		const approved = await createApprovedDidacticUnit(app);

		await generateChapter(app, approved.id, 0);

		const chapterResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/chapters/0`,
		);

		expect(chapterResponse.status).toBe(200);
		expect(chapterResponse.body).toMatchObject({
			chapterIndex: 0,
			planningOverview: expect.any(String),
			state: "ready",
			isCompleted: false,
		});
		expect(typeof chapterResponse.body.html).toBe("string");
		expect(chapterResponse.body.htmlBlocks.length).toBeGreaterThan(0);

		const updateResponse = await request(app)
			.patch(`/api/didactic-unit/${approved.id}/chapters/0`)
			.send({
				chapter: {
					title: chapterResponse.body.title,
					html: `${chapterResponse.body.html}<p>Additional practice note.</p>`,
					htmlHash: chapterResponse.body.htmlHash,
				},
			});

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.body.html).toContain("Additional practice note");

		const completionResponse = await request(app)
			.post(`/api/didactic-unit/${approved.id}/chapters/0/complete`)
			.send({});

		expect(completionResponse.status).toBe(200);
		expect(completionResponse.body.studyProgress).toMatchObject({
			moduleCount: expect.any(Number),
			readBlockCount: expect.any(Number),
			totalBlockCount: expect.any(Number),
			studyProgressPercent: expect.any(Number),
		});
		expect(
			completionResponse.body.studyProgress.readBlockCount,
		).toBeGreaterThan(0);
		expect(
			completionResponse.body.studyProgress.totalBlockCount,
		).toBeGreaterThan(0);

		const revisionsResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/chapters/0/revisions`,
		);

		expect(revisionsResponse.status).toBe(200);
		expect(
			revisionsResponse.body.revisions.some(
				(revision: {chapterIndex: number; source: string}) =>
					revision.chapterIndex === 0 &&
					revision.source === "ai_generation",
			),
		).toBe(true);
		expect(revisionsResponse.body.revisions[0]).toMatchObject({
			chapterIndex: 0,
			source: "manual_edit",
		});

		const runsResponse = await request(app).get(
			`/api/didactic-unit/${approved.id}/runs`,
		);
		expect(runsResponse.status).toBe(200);
		expect(
			runsResponse.body.runs.some(
				(run: {stage: string; didacticUnitId: string}) =>
					run.stage === "chapter" &&
					run.didacticUnitId === approved.id,
			),
		).toBe(true);
	});
});
