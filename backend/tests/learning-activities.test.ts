import request from "supertest";
import {describe, expect, it} from "vitest";
import type {AuthService} from "../src/auth/core/service.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {
	createApprovedDidacticUnit,
	generateDidacticUnitChapter,
} from "./helpers/didactic-unit-flow.js";

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
});
