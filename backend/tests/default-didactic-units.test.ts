import request from "supertest";
import {describe, expect, it} from "vitest";
import {InMemoryDidacticUnitStore} from "../src/didactic-unit/didactic-unit-store.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

const SOURCE_UNIT_ID = "e6aa29be-3371-42ce-a33e-4f31fd4207a2";
const NUTRITION_SOURCE_UNIT_ID = "a010c81d-49e5-4509-9354-c0ab66960d49";

describe("default didactic units", () => {
	it("clones configured templates once and does not restore a removed clone", async () => {
		const didacticUnitStore = new InMemoryDidacticUnitStore();
		const app = createTestApp({
			disableAuthBypass: true,
			didacticUnitStore,
		});

		const login = await loginTestUser(app);
		const firstList = await request(app)
			.get("/api/didactic-unit")
			.set("Authorization", `Bearer ${login.accessToken}`);

		expect(firstList.status).toBe(200);
		expect(firstList.body.didacticUnits).toHaveLength(2);
		expect(
			firstList.body.didacticUnits.map(
				(unit: {folder: {name: string}}) => unit.folder.name,
			),
		).toEqual(expect.arrayContaining(["Computer Science", "Biology"]));

		const clonedUnits = await didacticUnitStore.listByOwner(login.user.id);
		const pythonClone = clonedUnits.find(
			(unit) => unit.defaultTemplateId === "welcome-unit-e6aa29be",
		);
		const nutritionClone = clonedUnits.find(
			(unit) => unit.defaultTemplateId === "sports-nutrition-unit-a010c81d",
		);
		expect(pythonClone?.id).not.toBe(SOURCE_UNIT_ID);
		expect(nutritionClone?.id).not.toBe(NUTRITION_SOURCE_UNIT_ID);

		const pythonSummary = firstList.body.didacticUnits.find(
			(unit: {id: string}) => unit.id === pythonClone?.id,
		);
		expect(pythonSummary.modelUsed).toMatchObject({
			provider: "openai",
			model: "gpt-5.5",
		});

		expect(pythonClone).toMatchObject({
			ownerId: login.user.id,
			defaultTemplateId: "welcome-unit-e6aa29be",
			defaultTemplateSourceId: SOURCE_UNIT_ID,
			modelAttribution: {
				provider: "openai",
				model: "gpt-5.5",
			},
		});
		expect(nutritionClone).toMatchObject({
			ownerId: login.user.id,
			defaultTemplateId: "sports-nutrition-unit-a010c81d",
			defaultTemplateSourceId: NUTRITION_SOURCE_UNIT_ID,
		});
		expect(pythonClone?.moduleReadProgress).toBeUndefined();
		expect(pythonClone?.unitGenerationPaidAt).toBeUndefined();
		expect(pythonClone?.unitGenerationCreditTransactionId).toBeUndefined();
		expect(nutritionClone?.moduleReadProgress).toBeUndefined();
		expect(nutritionClone?.unitGenerationPaidAt).toBeUndefined();
		expect(nutritionClone?.unitGenerationCreditTransactionId).toBeUndefined();

		const analytics = await request(app)
			.get("/api/analytics/usage")
			.set("Authorization", `Bearer ${login.accessToken}`);
		expect(analytics.status).toBe(200);
		expect(analytics.body.aiGenerations).toBe(0);

		for (const unit of clonedUnits) {
			const removed = await request(app)
				.delete(`/api/didactic-unit/${unit.id}`)
				.set("Authorization", `Bearer ${login.accessToken}`);
			expect(removed.status).toBe(204);
		}

		const nextLogin = await loginTestUser(app);
		const afterRelogin = await request(app)
			.get("/api/didactic-unit")
			.set("Authorization", `Bearer ${nextLogin.accessToken}`);
		expect(afterRelogin.status).toBe(200);
		expect(afterRelogin.body.didacticUnits).toEqual([]);
	});
});
