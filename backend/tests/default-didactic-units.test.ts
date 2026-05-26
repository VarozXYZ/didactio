import request from "supertest";
import {describe, expect, it} from "vitest";
import {InMemoryDidacticUnitStore} from "../src/didactic-unit/didactic-unit-store.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

const SOURCE_UNIT_ID = "e6aa29be-3371-42ce-a33e-4f31fd4207a2";
const NUTRITION_SOURCE_UNIT_ID = "a010c81d-49e5-4509-9354-c0ab66960d49";
const INVESTING_SOURCE_UNIT_ID = "01c78e7a-0288-4bc2-981b-c93e1b4f118d";
const ANIME_DRAWING_SOURCE_UNIT_ID = "c5de6495-3297-4c72-bbcf-a97fe65ede04";

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
		expect(firstList.body.didacticUnits).toHaveLength(4);
		expect(
			firstList.body.didacticUnits.map(
				(unit: {folder: {name: string}}) => unit.folder.name,
			),
		).toEqual(
			expect.arrayContaining([
				"Computer Science",
				"Biology",
				"Finance",
				"Arts",
			]),
		);

		const clonedUnits = await didacticUnitStore.listByOwner(login.user.id);
		const pythonClone = clonedUnits.find(
			(unit) => unit.defaultTemplateId === "welcome-unit-e6aa29be",
		);
		const nutritionClone = clonedUnits.find(
			(unit) => unit.defaultTemplateId === "sports-nutrition-unit-a010c81d",
		);
		const investingClone = clonedUnits.find(
			(unit) => unit.defaultTemplateId === "investing-unit-01c78e7a",
		);
		const animeDrawingClone = clonedUnits.find(
			(unit) => unit.defaultTemplateId === "anime-drawing-unit-c5de6495",
		);
		expect(pythonClone?.id).not.toBe(SOURCE_UNIT_ID);
		expect(nutritionClone?.id).not.toBe(NUTRITION_SOURCE_UNIT_ID);
		expect(investingClone?.id).not.toBe(INVESTING_SOURCE_UNIT_ID);
		expect(animeDrawingClone?.id).not.toBe(ANIME_DRAWING_SOURCE_UNIT_ID);

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
		expect(investingClone).toMatchObject({
			ownerId: login.user.id,
			defaultTemplateId: "investing-unit-01c78e7a",
			defaultTemplateSourceId: INVESTING_SOURCE_UNIT_ID,
		});
		expect(animeDrawingClone).toMatchObject({
			ownerId: login.user.id,
			defaultTemplateId: "anime-drawing-unit-c5de6495",
			defaultTemplateSourceId: ANIME_DRAWING_SOURCE_UNIT_ID,
		});
		expect(pythonClone?.moduleReadProgress).toBeUndefined();
		expect(pythonClone?.unitGenerationPaidAt).toBeUndefined();
		expect(pythonClone?.unitGenerationCreditTransactionId).toBeUndefined();
		expect(nutritionClone?.moduleReadProgress).toBeUndefined();
		expect(nutritionClone?.unitGenerationPaidAt).toBeUndefined();
		expect(nutritionClone?.unitGenerationCreditTransactionId).toBeUndefined();
		expect(investingClone?.moduleReadProgress).toBeUndefined();
		expect(investingClone?.unitGenerationPaidAt).toBeUndefined();
		expect(investingClone?.unitGenerationCreditTransactionId).toBeUndefined();
		expect(animeDrawingClone?.moduleReadProgress).toBeUndefined();
		expect(animeDrawingClone?.unitGenerationPaidAt).toBeUndefined();
		expect(
			animeDrawingClone?.unitGenerationCreditTransactionId,
		).toBeUndefined();

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
