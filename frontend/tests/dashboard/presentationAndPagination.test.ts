import {describe, expect, it, vi} from "vitest";
import {
	calculateSpreadMetrics,
	findResumeSpreadIndex,
	getReadTextOffsetForSpread,
	getStatusPillClass,
	measurePages,
	paginateHtmlContent,
} from "@/dashboard/readerPagination";
import {
	getActivityFeedbackRefillCost,
	getActivityGenerationCost,
	getModuleRegenerationCost,
	getUnitGenerationCost,
} from "@/dashboard/utils/generationCosts";
import {getFolderEmoji, getFolderIcon, getFolderVisuals} from "@/dashboard/utils/folderDisplay";
import {getMoveTargetFolders} from "@/dashboard/utils/folderTargets";
import {
	applyTypographyVars,
	defaultTypography,
	makeTypographyVars,
	resolveBodyLineHeight,
	resolveTypography,
} from "@/shared/presentation/typography";
import {SYSTEM_DEFAULT_THEME} from "@/shared/presentation/presentationTheme";
import {resolvePresentationTheme, themeVars} from "@/shared/presentation/themeVars";
import {
	buildGenerationModelOptions,
	getProviderLogo,
} from "@/shared/models/generationModels";

describe("pagination", () => {
	it("computes responsive metrics for mobile, single page, and desktop", () => {
		expect(calculateSpreadMetrics({viewportWidth: 600, viewportHeight: 800}).pagesPerSpread).toBe(2);
		expect(calculateSpreadMetrics({viewportWidth: 1000, viewportHeight: 800}).pagesPerSpread).toBe(1);
		expect(calculateSpreadMetrics({viewportWidth: 1800, viewportHeight: 900}).pagesPerSpread).toBe(2);
	});

	it("resolves page offsets, resume indexes, and status classes", () => {
		const pages = [
			{kind: "content", startCharacterOffset: 0, endCharacterOffset: 10, html: "a"},
			{kind: "content", startCharacterOffset: 10, endCharacterOffset: 20, html: "b"},
			{kind: "post_module_actions", startCharacterOffset: 20, endCharacterOffset: 20, hasNextModule: false, primaryActionLabel: "Done"},
		] as never;
		expect(getReadTextOffsetForSpread(pages, 0, 2)).toBe(20);
		expect(getReadTextOffsetForSpread(pages, 9, 2)).toBe(0);
		expect(findResumeSpreadIndex(pages, 11, 2)).toBe(0);
		expect(findResumeSpreadIndex(pages, 20, 1)).toBe(2);
		expect(getStatusPillClass("ready")).toContain("#4ADE80");
		expect(getStatusPillClass("pending")).toContain("amber");
		expect(getStatusPillClass("failed")).toContain("red");
	});

	it("paginates rich HTML using DOM measurement", () => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			font: "",
			measureText: (value: string) => ({width: value.length * 8}),
		} as never);
		vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(80);
		const pages = paginateHtmlContent({
			content:
				"<h2>Title</h2><p>Paragraph one.</p><p>Paragraph two.</p>" +
				"<ul><li>one</li><li>two</li></ul><pre><code>const x = 1;</code></pre>",
			pageWidth: 600,
			pageHeight: 500,
		});
		expect(pages.length).toBeGreaterThan(0);
		expect(pages.join("")).toContain("Title");
		expect(paginateHtmlContent({content: "", pageWidth: 10, pageHeight: 10})).toEqual([]);
	});

	it("measures module pages and terminal actions for structured long content", () => {
		vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function () {
			return this.innerHTML.length > 180 ? 500 : 48;
		});
		const content =
			"<h2>Foundations</h2>" +
			`<p>${"Readable paragraph words ".repeat(16)}</p>` +
			"<ul><li>First principle</li><li>Second principle</li><li>Third principle</li></ul>" +
			"<pre><code class=\"language-ts\">const one = 1;\nconst two = 2;\nconst three = 3;</code></pre>";
		const pages = measurePages({
			activeChapter: {title: "Testing", summary: "A summary", status: "ready", readingTime: "4 min", level: "beginner"},
			content,
			pageWidth: 600,
			pageHeight: 320,
			chapterIndex: 0,
			hasNextModule: true,
			textStyle: {stylePreset: "classic", sizeProfile: "regular"},
		});
		expect(pages.length).toBeGreaterThan(1);
		expect(pages.at(-1)?.kind).toMatch(/actions/);
		expect(measurePages({
			activeChapter: {title: "Empty", summary: "", status: "ready", readingTime: "1 min", level: "beginner"},
			content: "",
			pageWidth: 600,
			pageHeight: 320,
			chapterIndex: 1,
			hasNextModule: false,
		})).toEqual([]);
		vi.restoreAllMocks();
	});
});

describe("presentation and selection utilities", () => {
	it("calculates credit costs and folder targets", () => {
		expect(getUnitGenerationCost({quality: "gold", length: "textbook"})).toEqual({coinType: "gold", amount: 3});
		expect(getModuleRegenerationCost({quality: "gold", length: "long"})).toEqual({coinType: "silver", amount: 5});
		expect(getModuleRegenerationCost({quality: "silver", length: "long"})).toEqual({coinType: "bronze", amount: 3});
		expect(getActivityGenerationCost({quality: "gold"})).toEqual({coinType: "silver", amount: 1});
		expect(getActivityFeedbackRefillCost({quality: "silver"})).toEqual({coinType: "bronze", amount: 1});
		expect(
			getMoveTargetFolders(
				[{id: "1", slug: "one"}, {id: "2", slug: "two"}, {id: "3", slug: "two"}],
				{id: "1", slug: "one"},
			),
		).toEqual([{id: "2", slug: "two"}]);
	});

	it("maps folder visuals including invalid colors and fallback icons", () => {
		expect(getFolderVisuals({color: "#102030", icon: "atom"}).bgColor).toBe("rgba(16, 32, 48, 0.16)");
		expect(getFolderVisuals({color: "var(--x)", icon: "unknown"}).bgColor).toBe("var(--x)");
		expect(getFolderIcon("missing")).toBeDefined();
		expect(getFolderEmoji("landmark")).toBe("🏛️");
		expect(getFolderEmoji("unknown")).toBe("unknown");
	});

	it("resolves typography and theme CSS variables across presets", () => {
		expect(resolveBodyLineHeight("plain")).toBe(2);
		expect(resolveBodyLineHeight("classic")).toBe(1.9);
		const classic = resolveTypography({
			sizeProfile: "large",
			bodyFontId: "crimsonPro",
			headingFontId: "ebGaramond",
			isMobile: false,
			stylePreset: "classic",
		});
		expect(classic.body.sizePx).toBe(20);
		expect(classic.h1.sizePx).toBe(29);
		expect(classic.h2.sizePx).toBe(25);
		expect(classic.h3.sizePx).toBe(22);
		expect(defaultTypography(true).body.sizePx).toBe(16);
		expect(makeTypographyVars(classic)["--typo-body-size"]).toBe("20px");
		expect(makeTypographyVars(classic)["--typo-h2-size"]).toBe("25px");
		const element = document.createElement("div");
		applyTypographyVars(element, classic);
		expect(element.style.fontSize).toBe("20px");

		expect(resolvePresentationTheme(null, null)).toEqual(SYSTEM_DEFAULT_THEME);
		expect(themeVars(SYSTEM_DEFAULT_THEME, false)["--unit-body-size"]).toBe("18px");
		expect(themeVars(SYSTEM_DEFAULT_THEME, false)["--unit-heading-size-adjust"]).toBe("2px");
		expect(themeVars({...SYSTEM_DEFAULT_THEME, stylePreset: "modern"}, true)["--unit-page-bg"]).toBe("#17201F");
		expect(themeVars({...SYSTEM_DEFAULT_THEME, stylePreset: "modern"}, true)["--unit-heading-size-adjust"]).toBe("0px");
		expect(themeVars({...SYSTEM_DEFAULT_THEME, stylePreset: "plain"}, false)["--unit-table-bg"]).toBe("#FAFBFC");
	});

	it("builds configured model options and logos", () => {
		expect(getProviderLogo("openai", "dark")).toContain("white");
		expect(getProviderLogo(undefined)).toBeUndefined();
		const options = buildGenerationModelOptions(
			{
				silver: {provider: "openai", model: "gpt-test"},
				gold: {provider: "anthropic", model: "claude-test"},
			} as never,
			{
				silver: [{id: "openai/gpt-test", label: "GPT Test"}],
				gold: [],
			} as never,
			"dark",
		);
		expect(options[0]).toMatchObject({label: "GPT Test", provider: "openai"});
		expect(options[1]).toMatchObject({label: "claude-test", provider: "anthropic"});
	});
});
