import request from "supertest";
import {describe, expect, it} from "vitest";
import type {AuthService} from "../src/auth/core/service.js";
import type {AiService} from "../src/ai/service.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {
	advanceToQuestionnaireAnswered,
	createApprovedDidacticUnit,
	createDidacticUnit,
	createSyllabusReadyDidacticUnit,
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

describe("coin system", () => {
	it("debits syllabus generation, rejects insufficient balance, and keeps refunds for failed streams", async () => {
		const app = createTestApp();
		const created = await createDidacticUnit(app);
		await advanceToQuestionnaireAnswered(app, created.id);

		const response = await request(app)
			.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
			.send({quality: "silver"});

		expect(response.status).toBe(200);
		expect(parseStreamComplete<{status: string}>(response.text).status).toBe(
			"syllabus_ready",
		);

		const authService = app.locals.authService as AuthService;
		const user = await authService.getUserById("mock-user");
		expect(user?.credits.bronze).toBe(29);

		await authService.adjustUserCredits({
			userId: "mock-user",
			actorUserId: "mock-user",
			coinType: "bronze",
			direction: "debit",
			amount: 29,
			reason: "test_exhaustion",
		});

		const next = await createDidacticUnit(app, {topic: "coin shortage"});
		await advanceToQuestionnaireAnswered(app, next.id);
		const rejected = await request(app)
			.post(`/api/didactic-unit/${next.id}/syllabus/generate/stream`)
			.send({quality: "silver"});

		expect(rejected.status).toBe(402);
		expect(rejected.body).toMatchObject({
			error: "insufficient_credits",
			requiredCost: {coinType: "bronze", amount: 1},
			credits: {bronze: 0},
		});
	});

	it("charges approval by unit length and module regeneration by stored quality", async () => {
		const app = createTestApp();
		const syllabusReady = await createSyllabusReadyDidacticUnit(app);

		const approveResponse = await request(app)
			.post(`/api/didactic-unit/${syllabusReady.id}/approve-syllabus`)
			.send({quality: "gold"});

		expect(approveResponse.status).toBe(200);
		expect(approveResponse.body).toMatchObject({
			generationQuality: "gold",
			unitGenerationCreditTransactionId: expect.any(String),
		});

		const authService = app.locals.authService as AuthService;
		expect((await authService.getUserById("mock-user"))?.credits.gold).toBe(0);

		await generateDidacticUnitChapter(app, syllabusReady.id, 0);
		await generateDidacticUnitChapter(app, syllabusReady.id, 0);
		expect((await authService.getUserById("mock-user"))?.credits.silver).toBe(14);
	});

	it("records a failed initial module attempt once without charging extra coins", async () => {
		const baseAiService = createMockAiService();
		const aiService: AiService = {
			...baseAiService,
			async generateChapter() {
				throw new Error("module failed");
			},
		};
		const app = createTestApp({aiService});
		const approved = await createApprovedDidacticUnit(app);
		const authService = app.locals.authService as AuthService;
		const before = await authService.getUserById("mock-user");

		const failedRun = await request(app)
			.post(`/api/didactic-unit/${approved.id}/modules/0/generate-run`)
			.send({});

		expect(failedRun.status).toBe(202);
		const failedStream = await request(app)
			.get(`/api/generation-runs/${failedRun.body.runId}/stream`)
			.send({});
		expect(failedStream.status).toBe(200);
		expect(failedStream.text).toContain("\"type\":\"error\"");
		expect((await authService.getUserById("mock-user"))?.credits).toEqual(
			before?.credits,
		);

		const repeatRun = await request(app)
			.post(`/api/didactic-unit/${approved.id}/modules/0/generate-run`)
			.send({});

		expect(repeatRun.status).toBe(202);
	});
});
