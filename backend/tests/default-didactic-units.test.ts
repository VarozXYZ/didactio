import request from "supertest";
import {describe, expect, it} from "vitest";
import {InMemoryDidacticUnitStore} from "../src/didactic-unit/didactic-unit-store.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

const SOURCE_UNIT_ID = "e6aa29be-3371-42ce-a33e-4f31fd4207a2";

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
		expect(firstList.body.didacticUnits).toHaveLength(1);
		const clonedId = firstList.body.didacticUnits[0].id as string;
		expect(clonedId).not.toBe(SOURCE_UNIT_ID);
		expect(firstList.body.didacticUnits[0].folder.name).toBe(
			"Computer Science",
		);
		expect(firstList.body.didacticUnits[0].modelUsed).toMatchObject({
			provider: "openai",
			model: "gpt-5.5",
		});

		const cloned = await didacticUnitStore.getById(login.user.id, clonedId);
		expect(cloned).toMatchObject({
			ownerId: login.user.id,
			defaultTemplateId: "welcome-unit-e6aa29be",
			defaultTemplateSourceId: SOURCE_UNIT_ID,
			modelAttribution: {
				provider: "openai",
				model: "gpt-5.5",
			},
		});
		expect(cloned?.moduleReadProgress).toBeUndefined();
		expect(cloned?.unitGenerationPaidAt).toBeUndefined();
		expect(cloned?.unitGenerationCreditTransactionId).toBeUndefined();

		const analytics = await request(app)
			.get("/api/analytics/usage")
			.set("Authorization", `Bearer ${login.accessToken}`);
		expect(analytics.status).toBe(200);
		expect(analytics.body.aiGenerations).toBe(0);

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
