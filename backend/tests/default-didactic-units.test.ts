import request from "supertest";
import {describe, expect, it} from "vitest";
import type {DidacticUnit} from "../src/didactic-unit/create-didactic-unit.js";
import {InMemoryDidacticUnitStore} from "../src/didactic-unit/didactic-unit-store.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

const SOURCE_UNIT_ID = "e6aa29be-3371-42ce-a33e-4f31fd4207a2";

function createSourceUnit(): DidacticUnit {
	return {
		id: SOURCE_UNIT_ID,
		ownerId: "template-owner",
		title: "Welcome to Didactio",
		topic: "Getting started",
		provider: "openai",
		status: "content_generation_completed",
		nextAction: "view_didactic_unit",
		overview: "A ready-to-read introductory unit.",
		learningGoals: ["Understand the learning workflow"],
		keywords: ["welcome"],
		level: "beginner",
		modules: [],
		chapters: [],
		depth: "basic",
		length: "intro",
		questionnaireEnabled: false,
		folderId: "template-folder",
		folderAssignmentMode: "manual",
		moduleReadProgress: [
			{
				chapterIndex: 0,
				furthestReadBlockIndex: 1,
				furthestReadBlocksVersion: 1,
				chapterCompleted: true,
				lastReadAt: "2026-05-01T00:00:00.000Z",
			},
		],
		unitGenerationPaidAt: "2026-05-01T00:00:00.000Z",
		unitGenerationCreditTransactionId: "template-payment",
		createdAt: "2026-05-01T00:00:00.000Z",
		updatedAt: "2026-05-01T00:00:00.000Z",
	};
}

describe("default didactic units", () => {
	it("clones configured templates once and does not restore a removed clone", async () => {
		const didacticUnitStore = new InMemoryDidacticUnitStore();
		await didacticUnitStore.save(createSourceUnit());
		const app = createTestApp({
			disableAuthBypass: true,
			didacticUnitStore,
		});

		const login = await loginTestUser(app);
		const firstList = await request(app)
			.get("/api/didactic-unit")
			.set("Authorization", `Bearer ${login.accessToken}`);

		expect(firstList.status).toBe(200);
		expect(firstList.body.didacticUnits).toHaveLength(1);
		const clonedId = firstList.body.didacticUnits[0].id as string;
		expect(clonedId).not.toBe(SOURCE_UNIT_ID);
		expect(firstList.body.didacticUnits[0].folder.name).toBe(
			"Computer Science",
		);

		const cloned = await didacticUnitStore.getById(login.user.id, clonedId);
		expect(cloned).toMatchObject({
			ownerId: login.user.id,
			defaultTemplateId: "welcome-unit-e6aa29be",
			defaultTemplateSourceId: SOURCE_UNIT_ID,
		});
		expect(cloned?.moduleReadProgress).toBeUndefined();
		expect(cloned?.unitGenerationPaidAt).toBeUndefined();
		expect(cloned?.unitGenerationCreditTransactionId).toBeUndefined();

		const removed = await request(app)
			.delete(`/api/didactic-unit/${clonedId}`)
			.set("Authorization", `Bearer ${login.accessToken}`);
		expect(removed.status).toBe(204);

		const nextLogin = await loginTestUser(app);
		const afterRelogin = await request(app)
			.get("/api/didactic-unit")
			.set("Authorization", `Bearer ${nextLogin.accessToken}`);
		expect(afterRelogin.status).toBe(200);
		expect(afterRelogin.body.didacticUnits).toEqual([]);
	});
});
