import {defineConfig} from "vitest/config";

export default defineConfig({
	test: {
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
