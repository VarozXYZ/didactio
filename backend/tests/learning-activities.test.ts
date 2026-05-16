import request from "supertest";
import {describe, expect, it} from "vitest";
import type {AuthService} from "../src/auth/core/service.js";
import type {AiService} from "../src/ai/service.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {
	createApprovedDidacticUnit,
	generateDidacticUnitChapter,
} from "./helpers/didactic-unit-flow.js";
import {createMockAiService} from "./helpers/mock-ai-service.js";

describe("learning activities", () => {
	it("creates a structured activity for a generated module and charges silver once", async () => {
		const app = createTestApp();
		const unit = await createApprovedDidacticUnit(app);
		await generateDidacticUnitChapter(app, unit.id, 0);

		const authService = app.locals.authService as AuthService;
		const before = await authService.getUserById("mock-user");

		const response = await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/0/activities`)
			.send({
				scope: "current_module",
				type: "multiple_choice",
				quality: "silver",
			});

		expect(response.status).toBe(201);
		expect(response.body.activity).toMatchObject({
			didacticUnitId: unit.id,
			chapterIndex: 0,
			scope: "current_module",
			type: "multiple_choice",
			quality: "silver",
			feedbackAttemptLimit: 3,
		});
		expect((await authService.getUserById("mock-user"))?.credits.silver).toBe(
			(before?.credits.silver ?? 0) - 1,
		);

		const listed = await request(app).get(
			`/api/didactic-unit/${unit.id}/modules/0/activities`,
		);
		expect(listed.status).toBe(200);
		expect(listed.body.activities).toHaveLength(1);
	});

	it("stores objective attempts and blocks the fourth attempt", async () => {
		const app = createTestApp();
		const unit = await createApprovedDidacticUnit(app);
		await generateDidacticUnitChapter(app, unit.id, 0);
		const created = await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/0/activities`)
			.send({
				scope: "current_module",
				type: "multiple_choice",
				quality: "silver",
			});
		const activityId = created.body.activity.id as string;

		for (let index = 0; index < 3; index += 1) {
			const attempt = await request(app)
				.post(`/api/activities/${activityId}/attempts`)
				.send({answers: {q1: "b"}});
			expect(attempt.status).toBe(201);
			expect(attempt.body.attempt.score).toBe(100);
		}

		const blocked = await request(app)
			.post(`/api/activities/${activityId}/attempts`)
			.send({answers: {q1: "b"}});
		expect(blocked.status).toBe(409);
	});

	it("accumulates flashcards into one unit deck and lists it in generated modules", async () => {
		const app = createTestApp();
		const unit = await createApprovedDidacticUnit(app);
		await generateDidacticUnitChapter(app, unit.id, 0);
		await generateDidacticUnitChapter(app, unit.id, 1);

		const first = await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/0/activities`)
			.send({
				scope: "current_module",
				type: "flashcards",
				quality: "silver",
			});
		expect(first.status).toBe(201);
		expect(first.body.activity.content.visibleModuleIndexes).toEqual([0]);

		const second = await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/1/activities`)
			.send({
				scope: "current_module",
				type: "flashcards",
				quality: "silver",
			});
		expect(second.status).toBe(201);
		expect(second.body.activity.id).toBe(first.body.activity.id);
		expect(second.body.activity.content.visibleModuleIndexes).toEqual([0, 1]);
		expect(second.body.activity.content.cards).toHaveLength(2);

		const moduleOne = await request(app).get(
			`/api/didactic-unit/${unit.id}/modules/0/activities`,
		);
		const moduleTwo = await request(app).get(
			`/api/didactic-unit/${unit.id}/modules/1/activities`,
		);
		expect(moduleOne.body.activities.map((activity: {id: string}) => activity.id)).toContain(first.body.activity.id);
		expect(moduleTwo.body.activities.map((activity: {id: string}) => activity.id)).toContain(first.body.activity.id);

		await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/0/activities`)
			.send({
				scope: "current_module",
				type: "multiple_choice",
				quality: "silver",
			});
		const moduleOneWithPractice = await request(app).get(
			`/api/didactic-unit/${unit.id}/modules/0/activities`,
		);
		expect(moduleOneWithPractice.body.activities.at(-1).id).toBe(
			first.body.activity.id,
		);
	});

	it("passes existing unit flashcards to the prompt when adding cards from a new module", async () => {
		const aiService = createMockAiService();
		const observedInputs: Array<
			Parameters<AiService["generateLearningActivity"]>[0]
		> = [];
		const generateLearningActivity =
			aiService.generateLearningActivity.bind(aiService);
		aiService.generateLearningActivity = async (input) => {
			observedInputs.push(input);
			return generateLearningActivity(input);
		};
		const app = createTestApp({aiService});
		const unit = await createApprovedDidacticUnit(app);
		await generateDidacticUnitChapter(app, unit.id, 0);
		await generateDidacticUnitChapter(app, unit.id, 1);

		await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/0/activities`)
			.send({
				scope: "current_module",
				type: "flashcards",
				quality: "silver",
			});
		await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/1/activities`)
			.send({
				scope: "current_module",
				type: "flashcards",
				quality: "silver",
			});

		const secondFlashcardInput = observedInputs.at(-1);
		expect(secondFlashcardInput?.type).toBe("flashcards");
		const existingFlashcardContext =
			secondFlashcardInput?.previousActivities.find(
				(activity) => activity.type === "flashcards",
			);
		expect(existingFlashcardContext?.dedupeSummary).toContain(
			"Existing cards:",
		);
		expect(existingFlashcardContext?.dedupeSummary).toContain(
			"Core idea in",
		);
	});

	it("charges three silver coins for the advanced activity option", async () => {
		const app = createTestApp();
		const unit = await createApprovedDidacticUnit(app);
		await generateDidacticUnitChapter(app, unit.id, 0);

		const authService = app.locals.authService as AuthService;
		const before = await authService.getUserById("mock-user");

		const response = await request(app)
			.post(`/api/didactic-unit/${unit.id}/modules/0/activities`)
			.send({
				scope: "current_module",
				type: "flashcards",
				quality: "gold",
			});

		expect(response.status).toBe(201);
		expect((await authService.getUserById("mock-user"))?.credits.silver).toBe(
			(before?.credits.silver ?? 0) - 3,
		);
	});
});
