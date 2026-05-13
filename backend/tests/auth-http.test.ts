import request from "supertest";
import {describe, expect, it} from "vitest";
import {createTestApp, buildTestAuthConfig} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

describe("auth http", () => {
	it("starts the Google flow and stores the oauth state cookie", async () => {
		const app = createTestApp({disableAuthBypass: true});

		const response = await request(app)
			.get("/auth/google")
			.query({redirectTo: "http://localhost:5173/auth/callback"});

		expect(response.status).toBe(302);
		expect(response.headers.location).toContain("accounts.google.com");
		expect(response.headers["set-cookie"][0]).toContain("oauth_flow=");
	});

	it("refreshes and logs out using the refresh cookie", async () => {
		const app = createTestApp({disableAuthBypass: true});
		const config = buildTestAuthConfig();
		const login = await loginTestUser(app, {
			providerUserId: "google-user-789",
			email: "cookie@example.com",
			displayName: "Katherine Johnson",
		});

		const refreshResponse = await request(app)
			.post("/auth/refresh")
			.set("Cookie", `${config.cookie.name}=${login.refreshToken}`);

		expect(refreshResponse.status).toBe(200);
		expect(refreshResponse.body.accessToken).toBeTruthy();
		expect(refreshResponse.headers["set-cookie"][0]).toContain(
			`${config.cookie.name}=`,
		);

		const accessToken = refreshResponse.body.accessToken as string;
		const meResponse = await request(app)
			.get("/auth/me")
			.set("Authorization", `Bearer ${accessToken}`);

		expect(meResponse.status).toBe(200);
		expect(meResponse.body.user.email).toBe("cookie@example.com");
		expect(meResponse.body.user.credits).toEqual({
			bronze: 30,
			silver: 15,
			gold: 1,
		});
		const rotatedRefreshCookie = refreshResponse.headers["set-cookie"][0]
			.split(";")
			.at(0);

		const logoutResponse = await request(app)
			.post("/auth/logout")
			.set("Cookie", rotatedRefreshCookie ?? "");

		expect(logoutResponse.status).toBe(204);
		expect(logoutResponse.headers["set-cookie"][0]).toContain(
			`${config.cookie.name}=;`,
		);
	});

	it("rejects /auth/me when no bearer token is present", async () => {
		const app = createTestApp({disableAuthBypass: true});

		const response = await request(app).get("/auth/me");

		expect(response.status).toBe(401);
		expect(response.body.error).toBe("missing_authorization_header");
	});

	it("tolerates an immediate duplicate refresh request", async () => {
		const app = createTestApp({disableAuthBypass: true});
		const config = buildTestAuthConfig();
		const login = await loginTestUser(app, {
			providerUserId: "google-user-456",
			email: "reuse@example.com",
			displayName: "Grace Hopper",
		});

		const rotated = await request(app)
			.post("/auth/refresh")
			.set("Cookie", `${config.cookie.name}=${login.refreshToken}`);
		expect(rotated.status).toBe(200);

		const reused = await request(app)
			.post("/auth/refresh")
			.set("Cookie", `${config.cookie.name}=${login.refreshToken}`);
		expect(reused.status).toBe(200);
		expect(reused.body.accessToken).toBeTruthy();
		expect(reused.headers["set-cookie"][0]).toContain(
			`${config.cookie.name}=`,
		);
	});
});
