import {describe, expect, it} from "vitest";
import {
	CODE_LANGUAGE_ALIASES,
	DARK_CODE_THEME,
	getCodeHighlighter,
} from "@/dashboard/utils/codeHighlighting";

describe("code highlighting", () => {
	it("loads Go grammar for Shiki highlighting", async () => {
		expect(CODE_LANGUAGE_ALIASES.go).toBe("go");
		expect(CODE_LANGUAGE_ALIASES.golang).toBe("go");

		const highlighter = await getCodeHighlighter();
		const html = highlighter.codeToHtml(
			"package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"Hola\") }",
			{lang: "go", theme: DARK_CODE_THEME},
		);

		expect(html).toContain("<span");
		expect(html).toContain("package");
		expect(html).not.toBe(
			"<pre><code>package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"Hola\") }</code></pre>",
		);
	});
});
