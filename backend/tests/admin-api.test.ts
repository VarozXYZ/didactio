import request from "supertest";
import {describe, expect, it} from "vitest";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

describe("admin api", () => {
	it("rejects regular users from admin routes", async () => {
		const app = createTestApp({disableAuthBypass: true});
		const login = await loginTestUser(app, {email: "user@example.com"});

		const response = await request(app)
			.get("/api/admin/users")
			.set("Authorization", `Bearer ${login.accessToken}`);

		expect(response.status).toBe(403);
		expect(response.body.error).toBe("forbidden");
	});

	it("allows admins to list users, update roles, and adjust credits", async () => {
		const app = createTestApp({disableAuthBypass: true});
		const adminLogin = await loginTestUser(app, {
			providerUserId: "admin-google-user",
			email: "admin@example.com",
			displayName: "Admin User",
		});
		const userLogin = await loginTestUser(app, {
			providerUserId: "user-google-user",
			email: "learner@example.com",
			displayName: "Learner User",
		});

		const listResponse = await request(app)
			.get("/api/admin/users")
			.set("Authorization", `Bearer ${adminLogin.accessToken}`);
		expect(listResponse.status).toBe(200);
		expect(listResponse.body.users).toHaveLength(2);

		const roleResponse = await request(app)
			.patch(`/api/admin/users/${userLogin.user.id}/role`)
			.set("Authorization", `Bearer ${adminLogin.accessToken}`)
			.send({role: "admin"});
		expect(roleResponse.status).toBe(200);
		expect(roleResponse.body.user.role).toBe("admin");

		const creditResponse = await request(app)
			.patch(`/api/admin/users/${userLogin.user.id}/credits`)
			.set("Authorization", `Bearer ${adminLogin.accessToken}`)
			.send({
				coinType: "gold",
				direction: "credit",
				amount: 5,
				reason: "Initial grant",
		});
		expect(creditResponse.status).toBe(200);
		expect(creditResponse.body.user.credits.gold).toBe(6);
	});
});
