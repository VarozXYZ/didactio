import {describe, expect, it} from "vitest";
import {
	applySearchHighlightToPageHtml,
	buildUnitSearchIndex,
	normalizeUnitSearchText,
	searchUnitIndex,
	type ActiveSearchHighlight,
} from "@/dashboard/utils/unitSearch";

const chapters = [
	{
		chapterIndex: 0,
		title: "Intro",
		html: "<p>Programación básica</p>",
		htmlBlocks: [
			{
				id: "a",
				type: "paragraph",
				html: "<p>Programación básica</p>",
				textLength: 20,
				textStartOffset: 0,
				textEndOffset: 20,
			},
		],
	} as never,
	{
		chapterIndex: 1,
		title: "Code",
		html: '<pre><code class="language-go">package main</code></pre>',
		htmlBlocks: [
			{
				id: "b",
				type: "code",
				html: '<pre><code class="language-go">package main</code></pre>',
				textLength: 12,
				textStartOffset: 0,
				textEndOffset: 12,
			},
		],
	} as never,
];

const chapterDetails = {
	0: {
		chapterIndex: 0,
		title: "Intro",
		htmlBlocks: chapters[0].htmlBlocks,
	} as never,
	1: {
		chapterIndex: 1,
		title: "Code",
		htmlBlocks: chapters[1].htmlBlocks,
	} as never,
};

describe("unit search", () => {
	it("normalizes case, accents, and whitespace", () => {
		expect(normalizeUnitSearchText("  PROGRAMACIÓN   Basica ")).toBe(
			"programacion basica",
		);
	});

	it("finds module results with context and unit percentage", () => {
		const index = buildUnitSearchIndex({chapters, chapterDetails});
		const results = searchUnitIndex(index, "programacion");

		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			chapterIndex: 0,
			moduleIndex: 1,
			moduleTitle: "Intro",
			match: "Programación",
			unitPercent: 0,
		});
		expect(results[0].after).toContain("básica");
		expect(searchUnitIndex(index, "")).toEqual([]);
	});

	it("limits results to 50", () => {
		const repeatedChapters = [
			{
				chapterIndex: 0,
				title: "Many",
				html: `<p>${Array.from({length: 80}, () => "match").join(" ")}</p>`,
				htmlBlocks: [
					{
						id: "many",
						type: "paragraph",
						html: `<p>${Array.from({length: 80}, () => "match").join(" ")}</p>`,
						textLength: 479,
						textStartOffset: 0,
						textEndOffset: 479,
					},
				],
			} as never,
		];

		const index = buildUnitSearchIndex({
			chapters: repeatedChapters,
			chapterDetails: {
				0: {
					chapterIndex: 0,
					title: "Many",
					htmlBlocks: repeatedChapters[0].htmlBlocks,
				} as never,
			},
		});

		expect(searchUnitIndex(index, "match")).toHaveLength(50);
	});

	it("highlights search hits without wrapping table or code structure", () => {
		const highlight: ActiveSearchHighlight = {
			chapterIndex: 0,
			startOffset: 0,
			endOffset: 4,
			key: 1,
		};

		const tableHtml = applySearchHighlightToPageHtml({
			html: "<table><tbody><tr><td>Cell value</td></tr></tbody></table>",
			pageStartOffset: 0,
			pageEndOffset: 10,
			highlight,
		});
		const codeHtml = applySearchHighlightToPageHtml({
			html: '<pre><code class="language-go">package main</code></pre>',
			pageStartOffset: 0,
			pageEndOffset: 12,
			highlight: {...highlight, endOffset: 7},
		});

		expect(tableHtml).toContain('<td><mark class="didactio-search-hit"');
		expect(tableHtml).not.toContain('<mark class="didactio-search-hit"><table');
		expect(codeHtml).toContain("<code");
		expect(codeHtml).toContain('class="didactio-search-hit"');
		expect(codeHtml).not.toContain('<mark class="didactio-search-hit"><pre');
	});
});
