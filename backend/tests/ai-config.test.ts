import request from "supertest";
import {describe, expect, it} from "vitest";
import {createTestApp} from "./helpers/create-test-app.js";

describe("AI config API", () => {
	it("returns the stage-based AI config and allows in-memory updates", async () => {
		const app = createTestApp();

		const initialResponse = await request(app).get("/api/ai-config");
		expect(initialResponse.status).toBe(200);
		expect(initialResponse.body).toMatchObject({
			silver: expect.any(Object),
			gold: expect.any(Object),
			authoring: expect.any(Object),
		});

		const updateResponse = await request(app)
			.patch("/api/ai-config")
			.send({
				gold: {
					provider: "anthropic",
					model: "claude-sonnet-4",
				},
				authoring: {
					language: "Spanish",
					tone: "professional",
				},
			});

		expect(updateResponse.status).toBe(200);
		expect(updateResponse.body.gold).toEqual({
			provider: "anthropic",
			model: "claude-sonnet-4",
		});
		expect(updateResponse.body.authoring).toMatchObject({
			language: "Spanish",
			tone: "professional",
		});

		const refreshedResponse = await request(app).get("/api/ai-config");
		expect(refreshedResponse.status).toBe(200);
		expect(refreshedResponse.body.gold).toEqual({
			provider: "anthropic",
			model: "claude-sonnet-4",
		});
		expect(refreshedResponse.body.authoring).toMatchObject({
			language: "Spanish",
			tone: "professional",
		});
	});
});
