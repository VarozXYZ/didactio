import request from "supertest";
import {describe, expect, it} from "vitest";
import type {AiService} from "../src/ai/service.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {createMockAiService} from "./helpers/mock-ai-service.js";

function events(body: string): Array<{type: string; data?: Record<string, unknown>; message?: string}> {
	return body.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function createUnit(app: ReturnType<typeof createTestApp>, questionnaireEnabled = true) {
	const response = await request(app).post("/api/didactic-unit").send({
		topic: "typescript systems",
		questionnaireEnabled,
		folderSelection: {mode: "auto"},
	});
	expect(response.status).toBe(201);
	return response.body as {id: string};
}

function withPendingBackgroundModeration() {
	const streaming = createMockAiService();
	const service = createMockAiService();
	service.moderateTopic = async () => new Promise(() => {});
	service.streamModeration = streaming.streamModeration.bind(streaming);
	return service;
}

describe("planning streaming routes", () => {
	it("streams moderation partial state and completes an approved auto-assigned unit", async () => {
		const app = createTestApp({aiService: withPendingBackgroundModeration()});
		const unit = await createUnit(app);
		const response = await request(app)
			.post(`/api/didactic-unit/${unit.id}/moderate/stream`)
			.send({});
		const output = events(response.text);

		expect(response.status).toBe(200);
		expect(output.map((event) => event.type)).toEqual(expect.arrayContaining(["start", "partial_structured", "complete"]));
		expect(output.at(-1)?.data).toMatchObject({status: "questionnaire_ready"});

		const again = await request(app).post(`/api/didactic-unit/${unit.id}/moderate/stream`).send({});
		expect(events(again.text)[0]?.type).toBe("complete");
	});

	it("streams rejected and failed moderation and exposes syllabus-prompt transitions", async () => {
		const rejectedAi = withPendingBackgroundModeration();
		rejectedAi.streamModeration = async (input, callbacks) => {
			const base = await createMockAiService().moderateTopic(input);
			await callbacks.onStart?.({provider: "mock", model: "model", modelId: "mock/model"});
			return {...base, approved: false, notes: "Topic rejected."};
		};
		const rejectedApp = createTestApp({aiService: rejectedAi});
		const rejected = await createUnit(rejectedApp);
		const rejectedResponse = await request(rejectedApp).post(`/api/didactic-unit/${rejected.id}/moderate/stream`).send({});
		expect(events(rejectedResponse.text).at(-1)).toMatchObject({type: "error", message: "Topic rejected."});

		const brokenAi: AiService = {
			...withPendingBackgroundModeration(),
			async streamModeration() {
				throw new Error("Unavailable.");
			},
		};
		const brokenApp = createTestApp({aiService: brokenAi});
		const broken = await createUnit(brokenApp);
		expect(events((await request(brokenApp).post(`/api/didactic-unit/${broken.id}/moderate/stream`).send({})).text).at(-1)?.type).toBe("error");

		const app = createTestApp();
		const noQuestions = await createUnit(app, false);
		await request(app).post(`/api/didactic-unit/${noQuestions.id}/moderate`).send({}).expect(200);
		const prompt = await request(app).post(`/api/didactic-unit/${noQuestions.id}/syllabus-prompt/generate`).send({});
		expect(prompt.status).toBe(200);
		expect(prompt.body.syllabusPrompt).toEqual(expect.any(String));
		expect((await request(app).post("/api/didactic-unit/missing/syllabus-prompt/generate")).status).toBe(404);
	});
});

describe("folder mutation routes", () => {
	it("updates and deletes custom folders while protecting general and missing folders", async () => {
		const app = createTestApp();
		const custom = await request(app).post("/api/folders").send({name: " Projects ", icon: "star", color: "#112233"});
		expect(custom.status).toBe(201);

		const updated = await request(app)
			.patch(`/api/folders/${custom.body.id}`)
			.send({name: "Capstones", icon: "tag", color: "#abcdef"});
		expect(updated.status).toBe(200);
		expect(updated.body).toMatchObject({name: "Capstones", icon: "tag", color: "#abcdef"});

		const folders = await request(app).get("/api/folders");
		const general = folders.body.folders.find((folder: {slug: string}) => folder.slug === "general");
		expect((await request(app).delete(`/api/folders/${general.id}`)).status).toBe(403);
		expect((await request(app).delete(`/api/folders/${custom.body.id}`)).status).toBe(204);
		expect((await request(app).patch("/api/folders/missing").send({name: "Nope"})).status).toBe(404);
		expect((await request(app).delete("/api/folders/missing")).status).toBe(404);
	});

	it("rejects empty and excessively long custom folder input", async () => {
		const app = createTestApp();
		expect((await request(app).post("/api/folders").send({name: "   "})).status).toBe(400);
		expect((await request(app).post("/api/folders").send({name: "x".repeat(1000)})).status).toBe(400);
	});
});
