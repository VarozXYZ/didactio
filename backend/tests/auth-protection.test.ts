import request from "supertest";
import {describe, expect, it} from "vitest";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

describe("api authentication", () => {
	it("rejects unauthenticated access to protected routes", async () => {
		const app = createTestApp({disableAuthBypass: true});

		const [folderResponse, didacticUnitResponse] = await Promise.all([
			request(app).get("/api/folders"),
			request(app).get("/api/didactic-unit"),
		]);

		expect(folderResponse.status).toBe(401);
		expect(folderResponse.body.error).toBe("missing_authorization_header");
		expect(didacticUnitResponse.status).toBe(401);
		expect(didacticUnitResponse.body.error).toBe(
			"missing_authorization_header",
		);
	});

	it("allows authenticated access with a bearer token", async () => {
		const app = createTestApp({disableAuthBypass: true});
		const login = await loginTestUser(app);

		const response = await request(app)
			.get("/api/folders")
			.set("Authorization", `Bearer ${login.accessToken}`);

		expect(response.status).toBe(200);
		expect(response.body.folders).toEqual(expect.any(Array));
	});
});
