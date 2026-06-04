import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ChapterRenderer} from "@/components/dashboard/content/ChapterRenderer";
import {AppearanceContext} from "@/theme/appearanceContext";

vi.mock("motion/react", () => ({
	motion: {
		div: ({children, ...props}: React.HTMLAttributes<HTMLDivElement>) => (
			<div {...props}>{children}</div>
		),
	},
	useReducedMotion: () => true,
}));

vi.mock("@/dashboard/utils/codeHighlighting", () => ({
	CODE_LANGUAGE_ALIASES: {},
	CODE_THEME_MAP: {classic: "light"},
	DARK_CODE_THEME: "dark",
	getCodeHighlighter: vi.fn().mockResolvedValue({
		codeToHtml: (code: string) => `<pre><code>${code}</code></pre>`,
	}),
}));

function display(html: string) {
	return render(
		<AppearanceContext.Provider
			value={{mode: "light", resolvedMode: "light", setMode: vi.fn()}}
		>
			<ChapterRenderer html={html} />
		</AppearanceContext.Provider>,
	);
}

describe("ChapterRenderer", () => {
	afterEach(() => {
		cleanup();
	});

	it("keeps note markers visible when rendering highlighted code blocks", () => {
		display(
			'<pre><code class="language-ts"><mark data-note-id="note-code" class="didactio-note-mark">const</mark> x = 1;</code></pre>',
		);

		expect(screen.getByLabelText("Open code note").dataset.noteId).toBe(
			"note-code",
		);
	});
});
