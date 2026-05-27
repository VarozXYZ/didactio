import request from "supertest";
import {describe, expect, it} from "vitest";
import {loadAuthConfigFromEnv} from "../src/auth/core/config.js";
import {SYSTEM_DEFAULT_THEME} from "../src/presentation-theme/types.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

function authEnv() {
	return {
		NODE_ENV: "production",
		GOOGLE_CLIENT_ID: "client",
		GOOGLE_CLIENT_SECRET: "secret",
		GOOGLE_CALLBACK_URL: "http://localhost/auth/google/callback",
		JWT_ACCESS_SECRET: "a".repeat(32),
		JWT_REFRESH_SECRET: "b".repeat(32),
		COOKIE_SECRET: "c".repeat(32),
		COOKIE_SECURE: "true",
		COOKIE_SAME_SITE: "none",
		AUTH_ALLOWED_REDIRECTS: "http://localhost/callback, http://localhost/second",
		AUTH_DEFAULT_REDIRECT: "http://localhost/callback",
		AUTH_ADMIN_EMAILS: "ADMIN@example.com",
		TRUST_PROXY: "true",
		CORS_ALLOWED_ORIGINS: "http://localhost:5173",
		ACCESS_TOKEN_TTL_SECONDS: "10",
		REFRESH_TOKEN_TTL_SECONDS: "20",
		AUTH_COOKIE_NAME: "session",
		COOKIE_DOMAIN: "example.com",
	};
}

describe("auth configuration", () => {
	it("loads production cookie, token, redirect, and administrator settings", () => {
		const config = loadAuthConfigFromEnv(authEnv());
		expect(config).toMatchObject({
			jwtIssuer: "didactio",
			jwtAudience: "web",
			accessTokenTtlSeconds: 10,
			refreshTokenTtlSeconds: 20,
			cookie: {name: "session", secure: true, sameSite: "none", domain: "example.com"},
			adminEmails: ["admin@example.com"],
			trustProxy: true,
		});
	});

	it("rejects missing secrets, unsafe cookies, invalid lifetimes, and redirect values", () => {
		expect(() => loadAuthConfigFromEnv({...authEnv(), JWT_ACCESS_SECRET: ""})).toThrow("JWT_ACCESS_SECRET");
		expect(() => loadAuthConfigFromEnv({...authEnv(), JWT_ACCESS_SECRET: "short"})).toThrow("at least 32");
		expect(() => loadAuthConfigFromEnv({...authEnv(), COOKIE_SECURE: "false"})).toThrow("COOKIE_SECURE");
		expect(() => loadAuthConfigFromEnv({...authEnv(), COOKIE_SAME_SITE: "occasionally"})).toThrow("COOKIE_SAME_SITE");
		expect(() => loadAuthConfigFromEnv({...authEnv(), ACCESS_TOKEN_TTL_SECONDS: "-1"})).toThrow("positive integer");
		expect(() => loadAuthConfigFromEnv({...authEnv(), AUTH_DEFAULT_REDIRECT: "http://blocked"})).toThrow("AUTH_DEFAULT_REDIRECT");
	});
});

describe("additional auth HTTP account flows", () => {
	it("updates profile, default theme and onboarding, then lists credit transactions", async () => {
		const app = createTestApp({disableAuthBypass: true});
		const login = await loginTestUser(app);
		const bearer = `Bearer ${login.accessToken}`;

		const profile = await request(app)
			.patch("/auth/me/profile")
			.set("Authorization", bearer)
			.send({displayName: "Updated Name"});
		expect(profile.status).toBe(200);
		expect(profile.body.user.displayName).toBe("Updated Name");

		const theme = await request(app)
			.patch("/auth/me/default-theme")
			.set("Authorization", bearer)
			.send({defaultPresentationTheme: {...SYSTEM_DEFAULT_THEME, stylePreset: "plain"}});
		expect(theme.status).toBe(200);
		expect(theme.body.user.defaultPresentationTheme.stylePreset).toBe("plain");

		const onboarding = await request(app)
			.patch("/auth/me/onboarding-complete")
			.set("Authorization", bearer)
			.send({});
		expect(onboarding.status).toBe(200);
		expect(onboarding.body.user.onboardingCompletedAt).toBeTruthy();

		const transactions = await request(app)
			.get("/auth/credits/transactions")
			.set("Authorization", bearer);
		expect(transactions.status).toBe(200);
		expect(transactions.body.transactions).toEqual(expect.any(Array));
	});

	it("validates profile/theme/redirect input and missing refresh tokens", async () => {
		const app = createTestApp({disableAuthBypass: true});
		const login = await loginTestUser(app);
		const bearer = `Bearer ${login.accessToken}`;

		expect((await request(app).post("/auth/refresh")).status).toBe(401);
		expect((await request(app).post("/auth/logout")).status).toBe(204);
		expect((await request(app).get("/auth/google").query({redirectTo: "http://blocked"})).status).toBe(400);
		expect((await request(app).patch("/auth/me/profile").set("Authorization", bearer).send({displayName: " "})).status).toBe(400);
		expect((await request(app).patch("/auth/me/default-theme").set("Authorization", bearer).send({defaultPresentationTheme: {}})).status).toBe(422);
	});
});
