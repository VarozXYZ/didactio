import {describe, expect, it} from "vitest";
import {
	getCodePracticeLanguageExtensions,
	getCodePracticeThemeExtension,
} from "@/dashboard/utils/codePracticeEditor";

describe("code practice editor utilities", () => {
	it("maps known languages to CodeMirror extensions", () => {
		expect(getCodePracticeLanguageExtensions("tsx").length).toBeGreaterThan(0);
		expect(getCodePracticeLanguageExtensions("python").length).toBeGreaterThan(0);
		expect(getCodePracticeLanguageExtensions("go").length).toBeGreaterThan(0);
		expect(getCodePracticeLanguageExtensions("unknown-language")).toEqual([]);
	});

	it("returns light and dark theme extensions", () => {
		expect(getCodePracticeThemeExtension(false)).toBeTruthy();
		expect(getCodePracticeThemeExtension(true)).toBeTruthy();
	});
});
