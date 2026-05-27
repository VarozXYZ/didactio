import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {
	buildCodeHtml,
	buildListHtml,
	extractHtmlBlocks,
	htmlToPlainText,
	normalizeHtmlForStorage,
	splitParagraphHtmlAtTextOffset,
} from "@/dashboard/utils/htmlContent";
import {
	extractMarkdownBlocks,
	formatModuleMarkdownForRender,
	htmlToMarkdown,
	markdownToDom,
	markdownToHtml,
	markdownToPlainText,
	normalizeMarkdownForStorage,
	normalizeStoredMarkdown,
} from "@/dashboard/utils/markdown";
import {
	hasStructuredSyllabusPreview,
	parsePartialSyllabusMarkdown,
} from "@/dashboard/utils/syllabusPreview";
import {
	applyNoteMarksToPageHtml,
	buildNoteAnchorFromSelection,
	getValidUnitNotesForChapter,
} from "@/dashboard/utils/unitNotes";
import {
	deriveEffortFromReadingTime,
	estimateReadingTimeFromText,
	formatRelativeTimestamp,
} from "@/dashboard/utils/unitDisplayMetadata";

describe("HTML and markdown content utilities", () => {
	it("extracts paragraphs, headings, lists, and merges ordinary code blocks", () => {
		const blocks = extractHtmlBlocks(
			"<h2>Heading</h2><p>Hello <strong>world</strong></p>" +
				'<ol><li>One</li><li><em>Two</em></li></ol>' +
				'<pre><code class="language-ts">const a = 1;</code></pre>' +
				'<pre><code class="language-ts">&lt;b&gt;</code></pre>',
		);

		expect(blocks.map((block) => block.type)).toEqual([
			"html",
			"paragraph",
			"splittable_list",
			"code",
		]);
		expect(blocks[0]).toMatchObject({headingLevel: 1, text: "Heading"});
		expect(blocks[3]).toMatchObject({
			language: "ts",
			code: "const a = 1;\n<b>",
		});
		expect(buildCodeHtml({code: "<tag>&", language: "html"})).toContain(
			"&lt;tag&gt;&amp;",
		);
		expect(
			buildListHtml(blocks[2] as Extract<(typeof blocks)[number], {type: "splittable_list"}>),
		).toBe("<ol><li>One</li><li><em>Two</em></li></ol>");
	});

	it("normalizes text and splits rich paragraphs while preserving markup", () => {
		expect(normalizeHtmlForStorage(" \u00a0<p>A</p> ")).toBe("<p>A</p>");
		expect(htmlToPlainText("<p>A   B</p><p>C</p>")).toBe("A BC");
		expect(extractHtmlBlocks("plain text")).toEqual([]);

		const split = splitParagraphHtmlAtTextOffset(
			"<p>Hello <strong>wide world</strong> again</p>",
			10,
		);
		expect(split.fittingHtml).toContain("Hello");
		expect(split.remainderHtml).toContain("world");
		expect(splitParagraphHtmlAtTextOffset("<div>not p</div>", 2)).toEqual({
			fittingHtml: "<p></p>",
			remainderHtml: "<p><div>not p</div></p>",
		});
	});

	it("round-trips rich HTML and repairs generated markdown structures", () => {
		const html =
			"<h2>Title</h2><p><strong>Bold</strong> and <a href=\"/x\">link</a></p>" +
			"<ul><li>First<ul><li>Nested</li></ul></li></ul>" +
			"<blockquote>A<br>B</blockquote><pre>const x = 1;</pre>" +
			"<table><tr><th>A</th><th>B</th></tr><tr><td>x</td><td>y</td></tr></table>";
		const markdown = htmlToMarkdown(html);

		expect(markdown).toContain("## Title");
		expect(markdown).toContain("**Bold**");
		expect(markdown).toContain("- First");
		expect(markdown).toContain("| A | B |");
		expect(markdownToHtml(markdown)).toContain("<table>");
		expect(markdownToPlainText(markdown)).toContain("Bold and link");
		expect(markdownToDom("# Heading").body.textContent).toContain("Heading");

		const repaired = formatModuleMarkdownForRender(
			"# Existing\n\n## Child\n\n**Term**\nDefinition\n\nText: 1. first 2. second",
		);
		expect(repaired).toContain("# 1. Existing");
		expect(repaired).toContain("## 1.1. Child");
		expect(repaired).toContain("**Term**\n\nDefinition");
		expect(normalizeStoredMarkdown("<p>Already html</p>")).toBe("<p>Already html</p>");
		expect(normalizeMarkdownForStorage("\u00a0 text ")).toBe("text");
	});

	it("extracts both markdown and HTML page blocks including tables and lists", () => {
		const blocks = extractMarkdownBlocks(
			"# Module\n\nParagraph\n\n1. One\n2. Two\n\n| H |\n| --- |\n| V |",
		);
		expect(blocks.map((block) => block.type)).toEqual([
			"markdown",
			"paragraph",
			"splittable_list",
			"markdown",
		]);
		expect(extractMarkdownBlocks("<h3>HTML</h3><p>Body</p>")).toHaveLength(2);
		expect(extractMarkdownBlocks("")).toEqual([]);
	});
});

describe("syllabus and display helpers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("parses streamed syllabus markdown with chapters and lessons", () => {
		const syllabus = parsePartialSyllabusMarkdown(`# Course
## Overview
An overview.
## Learning goals
- Understand concepts
## Keywords
- testing
## Estimated duration
95 minutes
## Chapters
### 1. Foundations
#### Overview
Chapter overview.
#### Estimated duration
45 min
#### Key points
- Core idea
#### Lessons
##### 1. Setup
- Install
`);

		expect(syllabus).toMatchObject({
			title: "Course",
			overview: "An overview.",
			estimatedDurationMinutes: 95,
			learningGoals: ["Understand concepts"],
			keywords: ["testing"],
		});
		expect(syllabus?.chapters[0]).toMatchObject({
			title: "Foundations",
			keyPoints: ["Core idea"],
			estimatedDurationMinutes: 45,
		});
		expect(syllabus?.chapters[0].lessons[0]).toEqual({
			title: "Setup",
			contentOutline: ["Install"],
		});
		expect(hasStructuredSyllabusPreview(syllabus)).toBe(true);
		expect(hasStructuredSyllabusPreview(null)).toBe(false);
		expect(parsePartialSyllabusMarkdown("")).toBeNull();
		expect(parsePartialSyllabusMarkdown("No headings")).toBeNull();
	});

	it("formats timestamps, reading estimates, and effort bands", () => {
		expect(formatRelativeTimestamp("2026-05-27T12:00:00.000Z")).toBe("just now");
		expect(formatRelativeTimestamp("2026-05-27T11:59:00.000Z")).toBe("1 min ago");
		expect(formatRelativeTimestamp("2026-05-27T10:00:00.000Z")).toBe("2 hours ago");
		expect(formatRelativeTimestamp("2026-05-24T12:00:00.000Z")).toBe("3 days ago");
		expect(formatRelativeTimestamp("bad date")).toBe("bad date");
		expect(estimateReadingTimeFromText(null)).toBe("Pending");
		expect(estimateReadingTimeFromText("<p>short content</p>")).toBe("1 min");
		expect(deriveEffortFromReadingTime("4 min")).toBe("Low");
		expect(deriveEffortFromReadingTime("10 min")).toBe("Medium");
		expect(deriveEffortFromReadingTime("20 min")).toBe("High");
		expect(deriveEffortFromReadingTime("Pending")).toBe("Medium");
	});
});

describe("unit note anchors", () => {
	const chapter = {
		chapterIndex: 0,
		htmlHash: "hash",
		htmlBlocksVersion: 1,
		htmlBlocks: [
			{id: "a", type: "paragraph", textStartOffset: 0, textEndOffset: 11},
			{id: "b", type: "paragraph", textStartOffset: 12, textEndOffset: 23},
		],
	} as never;
	const note = {
		id: "note-1",
		chapterIndex: 0,
		selectedText: "hello",
		anchor: {
			startBlockId: "a",
			startOffset: 0,
			endBlockId: "a",
			endOffset: 5,
			htmlHash: "hash",
			htmlBlocksVersion: 1,
			contextBefore: "",
			contextAfter: "",
		},
	} as never;

	it("filters stale notes and builds a text-range anchor", () => {
		expect(getValidUnitNotesForChapter([note], chapter)).toEqual([note]);
		expect(
			getValidUnitNotesForChapter(
				[{...note, chapterIndex: 2} as never, {...note, anchor: {...(note as {anchor: object}).anchor, htmlHash: "old"}} as never],
				chapter,
			),
		).toEqual([]);

		const pageRoot = document.createElement("div");
		pageRoot.innerHTML = "<p>hello world</p><p>second block</p>";
		const text = pageRoot.querySelector("p")!.firstChild!;
		const range = document.createRange();
		range.setStart(text, 0);
		range.setEnd(text, 5);
		expect(buildNoteAnchorFromSelection({range, pageRoot, pageStartOffset: 0, chapter})).toMatchObject({
			selectedText: "hello",
			anchor: {startBlockId: "a", startOffset: 0, endOffset: 5},
		});

		const empty = document.createRange();
		empty.setStart(text, 0);
		empty.setEnd(text, 0);
		expect(buildNoteAnchorFromSelection({range: empty, pageRoot, pageStartOffset: 0, chapter})).toBeNull();
	});

	it("places note marks in rendered page content", () => {
		expect(
			applyNoteMarksToPageHtml({
				html: "<p>hello world</p>",
				pageStartOffset: 0,
				pageEndOffset: 11,
				chapter,
				notes: [note],
			}),
		).toContain('data-note-id="note-1"');
		expect(
			applyNoteMarksToPageHtml({
				html: "<p>hello world</p>",
				pageStartOffset: 0,
				pageEndOffset: 11,
				chapter,
				notes: [],
			}),
		).toBe("<p>hello world</p>");
	});
});
