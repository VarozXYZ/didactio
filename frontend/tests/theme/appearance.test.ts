import {describe, expect, it} from "vitest";
import {parseAppearanceMode, resolveAppearance} from "@/theme/appearance";

describe("appearance preferences", () => {
	it("accepts supported persisted appearance modes", () => {
		expect(parseAppearanceMode("light")).toBe("light");
		expect(parseAppearanceMode("dark")).toBe("dark");
		expect(parseAppearanceMode("system")).toBe("system");
	});

	it("defaults missing or invalid stored preferences to system", () => {
		expect(parseAppearanceMode(null)).toBe("system");
		expect(parseAppearanceMode("sepia")).toBe("system");
	});

	it("resolves explicit modes independently of the system mode", () => {
		expect(resolveAppearance("light", "dark")).toBe("light");
		expect(resolveAppearance("dark", "light")).toBe("dark");
	});

	it("resolves system mode from the current media-query result", () => {
		expect(resolveAppearance("system", "light")).toBe("light");
		expect(resolveAppearance("system", "dark")).toBe("dark");
	});
});
