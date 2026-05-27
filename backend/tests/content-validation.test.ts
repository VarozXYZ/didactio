import {describe, expect, it} from "vitest";
import {extractContinuitySummary} from "../src/html/extract-continuity.js";
import {sanitizeChapterHtml, sanitizeSimpleFeedbackHtml} from "../src/html/sanitize.js";
import {normalizePresentationTheme, parsePresentationTheme} from "../src/presentation-theme/validate.js";
import {SYSTEM_DEFAULT_THEME} from "../src/presentation-theme/types.js";

describe("presentation theme validation", () => {
	it("accepts a complete customized theme and supplies system defaults", () => {
		const theme = parsePresentationTheme({
			...SYSTEM_DEFAULT_THEME,
			stylePreset: "modern",
			bodyColor: "rgb(1, 2, 3)",
			headingColor: "hsl(120, 10%, 20%)",
			numberColor: "rebeccapurple",
		});
		expect(theme).toMatchObject({stylePreset: "modern", numberColor: "rebeccapurple"});
		expect(normalizePresentationTheme(undefined)).toEqual(SYSTEM_DEFAULT_THEME);
	});

	it("rejects malformed enums, line height, colors, and non-object values", () => {
		expect(() => parsePresentationTheme(null)).toThrow("JSON object");
		expect(() => parsePresentationTheme({...SYSTEM_DEFAULT_THEME, bodyFont: "comic"})).toThrow("bodyFont");
		expect(() => parsePresentationTheme({...SYSTEM_DEFAULT_THEME, lineHeight: 10})).toThrow("lineHeight");
		expect(() => parsePresentationTheme({...SYSTEM_DEFAULT_THEME, bodyColor: "url(evil)"})).toThrow("bodyColor");
		expect(() => parsePresentationTheme({...SYSTEM_DEFAULT_THEME, accentColor: 3})).toThrow("accentColor");
	});
});

describe("HTML sanitization and continuity", () => {
	it("normalizes headings, links, classes, top-level text, and empty content", () => {
		process.env.INTERNAL_HOSTS = "didactio.local";
		const result = sanitizeChapterHtml([
			"Loose introduction",
			"<h2 id=\"topic\">First</h2><h2 id=\"topic\">Second</h2>",
			"<a href=\"https://outside.example/x\" title=\" external \">Outside</a>",
			"<a href=\"https://didactio.local/unit\">Inside</a>",
			"<a href=\"javascript:alert(1)\">Unsafe</a>",
			"<pre><code class=\"language-ts\">const x = 1;</code></pre>",
			"<p> </p><script>alert(1)</script>",
		].join(""));
		expect(result.html).toContain("<p>Loose introduction</p>");
		expect(result.html).toContain('id="topic-2"');
		expect(result.html).toContain('target="_blank"');
		expect(result.html).toContain('href="https://didactio.local/unit"');
		expect(result.html).not.toContain("javascript:");
		expect(result.html).toContain('class="language-ts"');
		expect(sanitizeChapterHtml("<p> </p>").isEmpty).toBe(true);
	});

	it("strips feedback markup and extracts the final paragraph as continuity", () => {
		expect(sanitizeSimpleFeedbackHtml("<p><strong>Good</strong><img src=x></p>")).toBe("<p><strong>Good</strong></p>");
		expect(extractContinuitySummary("<h2>Title</h2><p>Key idea to remember.</p>")).toBe("Key idea to remember.");
		expect(extractContinuitySummary("")).toBe("");
		expect(extractContinuitySummary(`<p>${"word ".repeat(200)}</p>`).length).toBe(799);
	});
});
