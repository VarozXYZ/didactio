import {defineConfig} from "vitest/config";

export default defineConfig({
	test: {
		pool: "threads",
		maxWorkers: 2,
		minWorkers: 1,
		fileParallelism: false,
		teardownTimeout: 5000,
		coverage: {
			provider: "v8",
			all: true,
			include: ["src/**/*.ts"],
			reporter: ["text", "json-summary"],
			thresholds: {
				lines: 80,
				statements: 80,
			},
		},
	},
});
