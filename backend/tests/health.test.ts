import request from "supertest";
import {afterEach, describe, expect, it} from "vitest";
import {buildTestAuthConfig, createTestApp} from "./helpers/create-test-app.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
	if (originalNodeEnv === undefined) {
		delete process.env.NODE_ENV;
	} else {
		process.env.NODE_ENV = originalNodeEnv;
	}
});

describe("GET /api/health", () => {
	it("returns the service health", async () => {
		const app = createTestApp();

		const response = await request(app).get("/api/health");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			status: "ok",
			service: "didactio-backend",
			mongo: {
				configured: false,
				connected: false,
				databaseName: null,
			},
		});
	});

	it("returns the configured mongo health when provided", async () => {
		const app = createTestApp({
			mongoHealth: {
				configured: true,
				connected: true,
				databaseName: "didactio",
			},
		});

		const response = await request(app).get("/api/health");

		expect(response.status).toBe(200);
		expect(response.body.mongo).toEqual({
			configured: true,
			connected: true,
			databaseName: "didactio",
		});
	});

	it("rejects unknown origins in production when no allowlist is configured", async () => {
		process.env.NODE_ENV = "production";
		const app = createTestApp({
			authConfig: {
				...buildTestAuthConfig(),
				corsAllowedOrigins: [],
			},
		});

		const response = await request(app)
			.get("/api/health")
			.set("Origin", "https://attacker.example");

		expect(response.status).toBe(500);
		expect(response.body).toMatchObject({
			error: "internal_server_error",
			message: "Unexpected error.",
		});
	});

	it("does not expose parser errors in the public response", async () => {
		const response = await request(createTestApp())
			.post("/api/didactic-unit")
			.set("Content-Type", "application/json")
			.send("{invalid");

		expect(response.status).toBe(500);
		expect(response.body.message).toBe("Unexpected error.");
		expect(response.body.message).not.toContain("Unexpected token");
		expect(response.body.requestId).toBeTruthy();
	});
});
