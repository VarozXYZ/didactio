import request from "supertest";
import {describe, expect, it, vi} from "vitest";
import {
	createLangSmithTelemetryService,
	type LangSmithTelemetryRun,
} from "../src/observability/langsmith-telemetry.js";
import {createTestApp} from "./helpers/create-test-app.js";
import {loginTestUser} from "./helpers/auth.js";

function sourceFrom(runs: LangSmithTelemetryRun[]) {
	return {
		listRuns: vi.fn(async function* () {
			for (const run of runs) {
				yield run;
			}
		}),
	};
}

describe("LangSmith telemetry", () => {
	it("returns a safe disabled summary without provider calls", async () => {
		const source = sourceFrom([]);
		const service = createLangSmithTelemetryService({
			apiKey: null,
			project: "didactio",
			endpoint: "https://api.smith.langchain.com",
			tracing: false,
			client: source,
		});

		const summary = await service.getSummary();

		expect(summary.configured).toBe(false);
		expect(summary.latestRuns).toEqual([]);
		expect(source.listRuns).not.toHaveBeenCalled();
	});

	it("aggregates runs without exposing prompts or outputs", async () => {
		const source = sourceFrom([
			{
				id: "run-1",
				name: "generate chapter",
				run_type: "llm",
				start_time: "2026-07-22T10:00:00.000Z",
				end_time: "2026-07-22T10:00:02.500Z",
				prompt_tokens: 12,
				completion_tokens: 8,
				total_tokens: 20,
			},
			{
				id: "run-2",
				name: "parse response",
				run_type: "parser",
				start_time: "2026-07-22T10:01:00.000Z",
				error: "private error details",
				total_tokens: 2,
				inputs: {prompt: "must not be returned"},
			},
		]);
		const service = createLangSmithTelemetryService({
			apiKey: "test-key",
			project: "didactio",
			endpoint: "https://api.smith.langchain.com",
			tracing: true,
			client: source,
			clock: () => new Date("2026-07-22T10:05:00.000Z"),
		});

		const summary = await service.getSummary(999);

		expect(source.listRuns).toHaveBeenCalledWith(
			expect.objectContaining({limit: 200, projectName: "didactio"}),
		);
		expect(summary).toMatchObject({
			configured: true,
			totalRuns: 2,
			completedRuns: 1,
			failedRuns: 1,
			activeRuns: 0,
			totalTokens: 22,
			averageDurationMs: 2500,
			byRunType: {llm: 1, parser: 1},
		});
		expect(summary.latestRuns[1]).toMatchObject({
			id: "run-2",
			hasError: true,
			status: "error",
		});
		expect(summary.latestRuns[1]).not.toHaveProperty("inputs");
		expect(summary.latestRuns[1]).not.toHaveProperty("error");
	});

	it("only allows authenticated administrators to read telemetry", async () => {
		const telemetryService = createLangSmithTelemetryService({
			apiKey: null,
			project: "didactio",
			endpoint: "https://api.smith.langchain.com",
			tracing: false,
		});
		const app = createTestApp({
			disableAuthBypass: true,
			langSmithTelemetry: telemetryService,
		});
		const userLogin = await loginTestUser(app, {email: "user@example.com"});
		const adminLogin = await loginTestUser(app, {
			providerUserId: "admin-google-user",
			email: "admin@example.com",
		});

		const forbidden = await request(app)
			.get("/api/admin/telemetry/summary")
			.set("Authorization", `Bearer ${userLogin.accessToken}`);
		const allowed = await request(app)
			.get("/api/admin/telemetry/summary?limit=10")
			.set("Authorization", `Bearer ${adminLogin.accessToken}`);

		expect(forbidden.status).toBe(403);
		expect(allowed.status).toBe(200);
		expect(allowed.body.configured).toBe(false);
	});
});
