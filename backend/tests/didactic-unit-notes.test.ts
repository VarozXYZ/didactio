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

async function createGeneratedUnitWithAnchor() {
	const app = createTestApp();
	const unit = await createApprovedDidacticUnit(app);
	await generateDidacticUnitChapter(app, unit.id, 0);
	const moduleResponse = await request(app).get(
		`/api/didactic-unit/${unit.id}/modules/0`,
	);
	expect(moduleResponse.status).toBe(200);
	const block = moduleResponse.body.htmlBlocks.find(
		(item: {type: string; textLength: number}) =>
			item.type === "paragraph" && item.textLength > 12,
	);
	expect(block).toBeTruthy();
	const anchor = {
		startBlockId: block.id,
		startOffset: 0,
		endBlockId: block.id,
		endOffset: Math.min(12, block.textLength),
		htmlHash: moduleResponse.body.htmlHash,
		htmlBlocksVersion: moduleResponse.body.htmlBlocksVersion,
	};
	return {app, unit, anchor};
}

describe("didactic unit notes", () => {
	it("creates, lists, updates and deletes manual notes", async () => {
		const {app, unit, anchor} = await createGeneratedUnitWithAnchor();

		const created = await request(app)
			.post(`/api/didactic-unit/${unit.id}/notes`)
			.send({
				chapterIndex: 0,
				selectedText: "This module",
				content: "My note",
				anchor,
			});

		expect(created.status).toBe(201);
		expect(created.body.note).toMatchObject({
			didacticUnitId: unit.id,
			chapterIndex: 0,
			source: "manual",
			content: "My note",
		});

		const listed = await request(app).get(`/api/didactic-unit/${unit.id}/notes`);
		expect(listed.status).toBe(200);
		expect(listed.body.notes).toHaveLength(1);

		const updated = await request(app)
			.patch(`/api/didactic-unit/${unit.id}/notes/${created.body.note.id}`)
			.send({question: "Why?", content: "Updated note"});
		expect(updated.status).toBe(200);
		expect(updated.body.note).toMatchObject({
			question: "Why?",
			content: "Updated note",
		});

		const deleted = await request(app).delete(
			`/api/didactic-unit/${unit.id}/notes/${created.body.note.id}`,
		);
		expect(deleted.status).toBe(204);

		const empty = await request(app).get(`/api/didactic-unit/${unit.id}/notes`);
		expect(empty.body.notes).toHaveLength(0);
	});

	it("generates AI notes with standard model and hidden dark coin costs", async () => {
		const {app, unit, anchor} = await createGeneratedUnitWithAnchor();
		const authService = app.locals.authService as AuthService;
		await authService.adjustUserCredits({
			userId: "mock-user",
			actorUserId: "mock-user",
			coinType: "silver",
			direction: "credit",
			amount: 1,
			reason: "test_credit",
		});
		const before = await authService.getUserById("mock-user");

		const silver = await request(app)
			.post(`/api/didactic-unit/${unit.id}/notes/generate`)
			.send({
				chapterIndex: 0,
				selectedText: "This module",
				question: "Explain this",
				quality: "silver",
				anchor,
			});
		expect(silver.status).toBe(201);
		expect(silver.body.note).toMatchObject({
			source: "ai",
			quality: "silver",
			question: "Explain this",
		});

		const gold = await request(app)
			.post(`/api/didactic-unit/${unit.id}/notes/generate`)
			.send({
				chapterIndex: 0,
				selectedText: "This module",
				question: "Go deeper",
				quality: "gold",
				anchor,
			});
		expect(gold.status).toBe(201);
		expect(gold.body.note).toMatchObject({
			source: "ai",
			quality: "silver",
		});

		const after = await authService.getUserById("mock-user");
		expect(after?.credits.dark).toBe((before?.credits.dark ?? 0) - 2);
		expect(after?.credits.bronze).toBe(before?.credits.bronze);
		expect(after?.credits.silver).toBe(before?.credits.silver);
	});

	it("refunds credits when AI note generation fails", async () => {
		const failingAiService: AiService = {
			...createMockAiService(),
			async generateDidacticUnitNote() {
				throw new Error("AI note failed");
			},
		};
		const app = createTestApp({aiService: failingAiService});
		const unit = await createApprovedDidacticUnit(app);
		await generateDidacticUnitChapter(app, unit.id, 0);
		const moduleResponse = await request(app).get(
			`/api/didactic-unit/${unit.id}/modules/0`,
		);
		const block = moduleResponse.body.htmlBlocks.find(
			(item: {type: string; textLength: number}) =>
				item.type === "paragraph" && item.textLength > 12,
		);
		const anchor = {
			startBlockId: block.id,
			startOffset: 0,
			endBlockId: block.id,
			endOffset: 12,
			htmlHash: moduleResponse.body.htmlHash,
			htmlBlocksVersion: moduleResponse.body.htmlBlocksVersion,
		};
		const authService = app.locals.authService as AuthService;
		await authService.adjustUserCredits({
			userId: "mock-user",
			actorUserId: "mock-user",
			coinType: "bronze",
			direction: "credit",
			amount: 1,
			reason: "test_credit",
		});
		const before = await authService.getUserById("mock-user");

		const response = await request(app)
			.post(`/api/didactic-unit/${unit.id}/notes/generate`)
			.send({
				chapterIndex: 0,
				selectedText: "This module",
				question: "Explain this",
				quality: "gold",
				anchor,
			});

		expect(response.status).toBe(409);
		const after = await authService.getUserById("mock-user");
		expect(after?.credits.silver).toBe(before?.credits.silver);
	});
});
