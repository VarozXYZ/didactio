import {describe, expect, it, vi} from "vitest";
import {createLogger} from "../src/logging/logger.js";

describe("logger", () => {
	it("prints readable info logs without level or logger fields", () => {
		const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
		const logger = createLogger({
			name: "didactio-backend",
			context: {component: "app"},
			level: "info",
		});

		logger.info("HTTP request completed", {
			method: "GET",
			path: "/api/didactic-unit/example/modules/0/revisions",
			statusCode: 200,
			durationMs: 4,
		});

		const output = String(consoleLog.mock.calls[0]?.[0]);
		consoleLog.mockRestore();

		expect(output).toMatch(
			/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] HTTP request completed/,
		);
		expect(output).toContain("component: 'app'");
		expect(output).toContain("method: 'GET'");
		expect(output).toContain("statusCode: 200");
		expect(output).not.toContain('"level":"info"');
		expect(output).not.toContain("INFO");
		expect(output).not.toContain("didactio-backend");
	});

	it("keeps visible labels for warnings and errors", () => {
		const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const logger = createLogger({name: "didactio-backend", level: "warn"});

		logger.warn("Moderation rejected", {statusCode: 409});

		const output = String(consoleWarn.mock.calls[0]?.[0]);
		consoleWarn.mockRestore();

		expect(output).toMatch(
			/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] WARN Moderation rejected/,
		);
		expect(output).toContain("statusCode: 409");
	});
});
