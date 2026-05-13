import type {
	EditorTextStyle,
	DidacticUnitEditorChapter as UnitChapter,
} from "./types";
import {
	buildCodeHtml,
	buildListHtml,
	extractHtmlBlocks,
	normalizeStoredHtml,
	splitParagraphHtmlAtTextOffset,
	wrapParagraphHtml,
	type HtmlPageBlock,
} from "./utils/htmlContent";
import {
	prepareParagraphBlock,
	prepareH1Block,
	prepareH2Block,
	prepareH3Block,
	prepareListItemBlock,
	getBlockLines,
	type BlockMeasurement,
} from "./utils/pretextMeasure";
import {
	resolveTypography,
	defaultTypography,
	STYLE_PRESETS,
	type ResolvedTypography,
	type FontId,
	type SizeProfile,
} from "./utils/typography";

const MOBILE_BREAKPOINT = 768;
const HEADER_HEIGHT = 64;
// Must match the editor aside (`w-[280px]` in UnitEditor).
const OPEN_SIDEBAR_WIDTH = 280;
// Page width ÷ page height. Desktop is tuned for a balance between readable line length and card shape.
const PAGE_WIDTH_RATIO_DESKTOP = 0.76;
// Mobile is a rough default only; dedicated mobile layout is planned separately.
const PAGE_WIDTH_RATIO_MOBILE = 0.72;
const POST_MODULE_ACTION_GAP = 24;
const FIRST_PAGE_HEADER_BOTTOM_GAP = 16;
const DOM_BLOCK_HEIGHT_CACHE_LIMIT = 2000;

const domBlockHeightCache = new Map<string, number>();

function setCachedDomBlockHeight(key: string, height: number): number {
	if (domBlockHeightCache.size >= DOM_BLOCK_HEIGHT_CACHE_LIMIT) {
		const oldestKey = domBlockHeightCache.keys().next().value;
		if (oldestKey !== undefined) {
			domBlockHeightCache.delete(oldestKey);
		}
	}

	domBlockHeightCache.set(key, height);
	return height;
}

function makeTypographyCacheKey(typography: ResolvedTypography): string {
	return [
		typography.body.family,
		typography.body.sizePx,
		typography.h1.family,
		typography.h1.sizePx,
		typography.h2.family,
		typography.h2.sizePx,
		typography.h3.family,
		typography.h3.sizePx,
	].join(":");
}

type ContentMeasuredModulePage = {
	kind: "content";
	html: string;
	startCharacterOffset: number;
	endCharacterOffset: number;
};

type ContentWithActionsMeasuredModulePage = {
	kind: "content_with_actions";
	html: string;
	startCharacterOffset: number;
	endCharacterOffset: number;
	hasNextModule: boolean;
	primaryActionLabel: string;
};

type PostModuleActionsMeasuredPage = {
	kind: "post_module_actions";
	startCharacterOffset: number;
	endCharacterOffset: number;
	hasNextModule: boolean;
	primaryActionLabel: string;
};

export type MeasuredModulePage =
	| ContentMeasuredModulePage
	| ContentWithActionsMeasuredModulePage
	| PostModuleActionsMeasuredPage;

type MeasurePageChapter = Pick<
	UnitChapter,
	"title" | "summary" | "status" | "readingTime" | "level"
>;

type AnnotatedHtmlPageBlock = HtmlPageBlock & {
	startCharacterOffset: number;
	endCharacterOffset: number;
	// Present for paragraphs and h1-h3 headings.
	blockMeasurement?: BlockMeasurement;
	// Present for splittable_list — one entry per item.
	itemMeasurements?: BlockMeasurement[];
};

function isHeadingBlock(block: AnnotatedHtmlPageBlock): boolean {
	return block.type === "html" && block.headingLevel !== undefined;
}

function isShortIntroBlock(block: AnnotatedHtmlPageBlock): boolean {
	return block.type === "paragraph" && block.text.length < 80;
}

function pullTrailingOrphanBlocksForward(
	blocks: AnnotatedHtmlPageBlock[],
): AnnotatedHtmlPageBlock[] {
	const movedBlocks: AnnotatedHtmlPageBlock[] = [];

	const lastBlock = blocks.at(-1);
	const secondLastBlock = blocks.at(-2);

	if (
		blocks.length > 2 &&
		lastBlock &&
		secondLastBlock &&
		isHeadingBlock(secondLastBlock) &&
		isShortIntroBlock(lastBlock)
	) {
		movedBlocks.unshift(...blocks.splice(-2));
	} else {
		while (blocks.length >= 2 && isHeadingBlock(blocks.at(-1)!)) {
			movedBlocks.unshift(blocks.pop()!);
		}
	}

	return movedBlocks;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function renderHtmlBlock(block: HtmlPageBlock): string {
	if (block.type === "code") {
		return buildCodeHtml(block);
	}

	if (block.type === "splittable_list") {
		return buildListHtml(block);
	}

	if (block.type === "paragraph") {
		return block.html || wrapParagraphHtml(escapeHtml(block.text));
	}

	return block.html;
}

function getLanguageFromCodeElement(codeElement: Element | null): string {
	const className = codeElement?.getAttribute("class") ?? "";
	return className.match(/\blanguage-([a-z0-9+#-]+)/i)?.[1] ?? "plaintext";
}

function createCodeBlockMeasurementHtml(html: string): string {
	const parser = new DOMParser();
	const document = parser.parseFromString(html, "text/html");

	document.body.querySelectorAll("pre").forEach((pre) => {
		const codeElement = pre.querySelector("code");
		const language = getLanguageFromCodeElement(codeElement);
		const wrapper = document.createElement("div");
		wrapper.className = "code-block-wrapper";
		wrapper.innerHTML = `
			<div class="code-block-header">
				<div class="flex items-center gap-2">
					<span class="code-block-lang">${escapeHtml(language)}</span>
				</div>
				<button type="button" class="code-block-copy">Copy</button>
			</div>
			<div class="code-block-highlight"></div>
		`;
		wrapper
			.querySelector(".code-block-highlight")
			?.appendChild(pre.cloneNode(true));
		pre.replaceWith(wrapper);
	});

	return document.body.innerHTML;
}

function measureRenderedHtmlHeight(
	html: string,
	proseMeasure: HTMLDivElement,
): number {
	proseMeasure.innerHTML = createCodeBlockMeasurementHtml(html);
	return proseMeasure.scrollHeight;
}

function isMeasuredContentPage(
	page: MeasuredModulePage,
): page is ContentMeasuredModulePage | ContentWithActionsMeasuredModulePage {
	return page.kind === "content" || page.kind === "content_with_actions";
}

function isMeasuredPageWithReadableContent(
	page: MeasuredModulePage,
): page is ContentMeasuredModulePage | ContentWithActionsMeasuredModulePage {
	return isMeasuredContentPage(page);
}

function annotateBlocks(
	blocks: HtmlPageBlock[],
	typography: ResolvedTypography,
): AnnotatedHtmlPageBlock[] {
	let characterOffset = 0;

	return blocks.map((block) => {
		const startCharacterOffset = characterOffset;
		const endCharacterOffset = startCharacterOffset + block.text.length;
		characterOffset = endCharacterOffset;

		if (block.type === "paragraph") {
			return {
				...block,
				startCharacterOffset,
				endCharacterOffset,
				blockMeasurement: prepareParagraphBlock(
					undefined,
					block.text,
					typography,
				),
			};
		}

		if (block.type === "html") {
			const hl = block.headingLevel;
			if (hl === 1) {
				return {
					...block,
					startCharacterOffset,
					endCharacterOffset,
					blockMeasurement: prepareH1Block(
						undefined,
						block.text,
						typography,
					),
				};
			}
			if (hl === 2) {
				return {
					...block,
					startCharacterOffset,
					endCharacterOffset,
					blockMeasurement: prepareH2Block(
						undefined,
						block.text,
						typography,
					),
				};
			}
			if (hl === 3) {
				return {
					...block,
					startCharacterOffset,
					endCharacterOffset,
					blockMeasurement: prepareH3Block(
						undefined,
						block.text,
						typography,
					),
				};
			}
			return {...block, startCharacterOffset, endCharacterOffset};
		}

		if (block.type === "splittable_list") {
			const itemMeasurements = block.items.map((item) =>
				prepareListItemBlock(
					undefined,
					item.text,
					typography,
				),
			);
			return {
				...block,
				startCharacterOffset,
				endCharacterOffset,
				itemMeasurements,
			};
		}

		if (block.type === "code") {
			return {...block, startCharacterOffset, endCharacterOffset};
		}

		// All union members handled above; this is unreachable.
		return {
			...(block as object),
			startCharacterOffset,
			endCharacterOffset,
		} as AnnotatedHtmlPageBlock;
	});
}

function joinBlocksHtml(blocks: HtmlPageBlock[]): string {
	if (blocks.length === 0) return "";
	let out = renderHtmlBlock(blocks[0]);
	for (let i = 1; i < blocks.length; i++) {
		const curr = blocks[i];
		out += "\n\n";
		out += renderHtmlBlock(curr);
	}
	return out;
}

function makeParagraphFragment({
	block,
	fittingText,
	remainderText,
	typography,
}: {
	block: Extract<AnnotatedHtmlPageBlock, {type: "paragraph"}>;
	fittingText: string;
	remainderText: string;
	typography: ResolvedTypography;
}): {
	fittingBlock: Extract<AnnotatedHtmlPageBlock, {type: "paragraph"}>;
	remainder: Extract<AnnotatedHtmlPageBlock, {type: "paragraph"}> | null;
} {
	const fittingEndText =
		remainderText ?
			block.text.slice(0, fittingText.length).trimEnd()
		:	block.text;
	const remainderStartText =
		remainderText ? block.text.slice(fittingEndText.length).trimStart() : "";
	const fittingEndCharacterOffset = Math.min(
		block.endCharacterOffset,
		block.startCharacterOffset + fittingEndText.length,
	);
	const remainderStartCharacterOffset =
		remainderStartText ?
			Math.min(
				block.endCharacterOffset,
				fittingEndCharacterOffset +
					(block.text.length -
						fittingEndText.length -
						remainderStartText.length),
			)
		:	fittingEndCharacterOffset;
	const splitHtml = splitParagraphHtmlAtTextOffset(
		block.html,
		fittingEndText.length,
	);

	return {
		fittingBlock: {
			...block,
			html: splitHtml.fittingHtml,
			text: fittingEndText,
			endCharacterOffset: fittingEndCharacterOffset,
			blockMeasurement: prepareParagraphBlock(
				undefined,
				fittingEndText,
				typography,
			),
		},
		remainder:
			remainderStartText ?
				{
					...block,
					html: splitHtml.remainderHtml,
					text: remainderStartText,
					continued: true,
					startCharacterOffset: remainderStartCharacterOffset,
					blockMeasurement: prepareParagraphBlock(
						undefined,
						remainderStartText,
						typography,
					),
				}
			:	null,
	};
}

function splitParagraphToFit({
	block,
	currentLimit,
	contentWidth,
	typography,
	currentBlocks,
	domMeasurePage,
}: {
	block: Extract<AnnotatedHtmlPageBlock, {type: "paragraph"}>;
	currentLimit: number;
	contentWidth: number;
	typography: ResolvedTypography;
	currentBlocks: AnnotatedHtmlPageBlock[];
	domMeasurePage: (blocks: HtmlPageBlock[], pageLimit: number) => number;
}): {
	fittingBlock: Extract<
		AnnotatedHtmlPageBlock,
		{type: "paragraph"}
	> | null;
	remainder: Extract<AnnotatedHtmlPageBlock, {type: "paragraph"}> | null;
} {
	const measurement =
		block.blockMeasurement ??
		prepareParagraphBlock(undefined, block.text, typography);
	const lines = getBlockLines(measurement, contentWidth);
	if (lines.length === 0) {
		return {fittingBlock: null, remainder: {...block}};
	}

	let lo = 1;
	let hi = lines.length;
	let best:
		| {
				fittingBlock: Extract<AnnotatedHtmlPageBlock, {type: "paragraph"}>;
				remainder: Extract<AnnotatedHtmlPageBlock, {type: "paragraph"}> | null;
		  }
		| null = null;

	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const fittingText = lines.slice(0, mid).join(" ");
		const remainderText = lines.slice(mid).join(" ");
		const candidate = makeParagraphFragment({
			block,
			fittingText,
			remainderText,
			typography,
		});
		const candidateHeight = domMeasurePage(
			[...currentBlocks, candidate.fittingBlock],
			currentLimit,
		);

		if (candidateHeight <= currentLimit + 1) {
			best = candidate;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	return best ?? {fittingBlock: null, remainder: {...block}};
}

type SplittableListAnnotated = Extract<
	AnnotatedHtmlPageBlock,
	{type: "splittable_list"}
>;

type CodeAnnotated = Extract<AnnotatedHtmlPageBlock, {type: "code"}>;

let codeSplitIdCounter = 0;

function getCodeLines(code: string): string[] {
	return code.split("\n");
}

function makeCodeSubBlock({
	block,
	code,
	text,
	continued,
	continuesNext,
	splitId,
	startCharacterOffset,
	endCharacterOffset,
}: {
	block: CodeAnnotated;
	code: string;
	text: string;
	continued: boolean;
	continuesNext: boolean;
	splitId?: string;
	startCharacterOffset: number;
	endCharacterOffset: number;
}): CodeAnnotated {
	return {
		...block,
		code,
		text,
		html: buildCodeHtml({
			code,
			language: block.language,
			splitId,
			continued,
			continuesNext,
		}),
		continued,
		continuesNext,
		splitId,
		startCharacterOffset,
		endCharacterOffset,
	};
}

function splitCodeToFit({
	block,
	currentLimit,
	currentBlocks,
	domMeasurePage,
}: {
	block: CodeAnnotated;
	currentLimit: number;
	currentBlocks: AnnotatedHtmlPageBlock[];
	domMeasurePage: (blocks: HtmlPageBlock[], pageLimit: number) => number;
}): {
	fittingBlock: CodeAnnotated | null;
	remainder: CodeAnnotated | null;
} {
	const lines = getCodeLines(block.code);
	if (lines.length <= 1) {
		return {fittingBlock: null, remainder: block};
	}
	const splitId = block.splitId ?? `code-split-${codeSplitIdCounter++}`;

	const makeCandidate = (lineCount: number): CodeAnnotated => {
		const code = lines.slice(0, lineCount).join("\n");
		const text = code.replace(/\s+/g, " ").trim();
		return makeCodeSubBlock({
			block,
			code,
			text,
			continued: block.continued,
			continuesNext: lineCount < lines.length,
			splitId,
			startCharacterOffset: block.startCharacterOffset,
			endCharacterOffset: Math.min(
				block.endCharacterOffset,
				block.startCharacterOffset + text.length,
			),
		});
	};

	let lo = 1;
	let hi = lines.length;
	let bestLineCount = 0;

	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const candidate = makeCandidate(mid);
		const candidateHeight = domMeasurePage(
			[...currentBlocks, candidate],
			currentLimit,
		);

		if (candidateHeight <= currentLimit + 1) {
			bestLineCount = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	if (bestLineCount <= 0) {
		return {fittingBlock: null, remainder: block};
	}

	if (bestLineCount >= lines.length) {
		return {fittingBlock: block, remainder: null};
	}

	const fittingCode = lines.slice(0, bestLineCount).join("\n");
	const remainderCode = lines.slice(bestLineCount).join("\n");
	const fittingText = fittingCode.replace(/\s+/g, " ").trim();
	const remainderText = remainderCode.replace(/\s+/g, " ").trim();
	const fittingEndOffset = Math.min(
		block.endCharacterOffset,
		block.startCharacterOffset + fittingText.length,
	);

	return {
		fittingBlock: makeCodeSubBlock({
			block,
			code: fittingCode,
			text: fittingText,
			continued: block.continued,
			continuesNext: Boolean(remainderCode),
			splitId,
			startCharacterOffset: block.startCharacterOffset,
			endCharacterOffset: fittingEndOffset,
		}),
		remainder:
			remainderCode ?
				makeCodeSubBlock({
					block,
					code: remainderCode,
					text: remainderText,
					continued: true,
					continuesNext: false,
					splitId,
					startCharacterOffset: fittingEndOffset,
					endCharacterOffset: block.endCharacterOffset,
				})
			:	null,
	};
}

function splitListToFit({
	block,
	currentLimit,
	typography,
	currentBlocks,
	domMeasurePage,
}: {
	block: SplittableListAnnotated;
	currentLimit: number;
	typography: ResolvedTypography;
	currentBlocks: AnnotatedHtmlPageBlock[];
	domMeasurePage: (blocks: HtmlPageBlock[], pageLimit: number) => number;
}): {
	fittingBlock: SplittableListAnnotated | null;
	remainder: SplittableListAnnotated | null;
} {
	const {items} = block;
	const itemMeasurements =
		block.itemMeasurements ??
		items.map((item) =>
			prepareListItemBlock(undefined, item.text, typography),
		);
	if (items.length <= 1) {
		return {fittingBlock: null, remainder: block};
	}

	const makeSubBlock = (
		slicedItems: typeof items,
		slicedMeasurements: BlockMeasurement[],
	): SplittableListAnnotated => ({
		...block,
		items: slicedItems,
		html: buildListHtml({...block, items: slicedItems}),
		text: slicedItems.map((item) => item.text).join(" "),
		itemMeasurements: slicedMeasurements,
	});

	let bestK = 0;
	let lo = 1;
	let hi = items.length;

	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const candidate = makeSubBlock(
			items.slice(0, mid),
			itemMeasurements.slice(0, mid),
		);
		const candidateHeight = domMeasurePage(
			[...currentBlocks, candidate],
			currentLimit,
		);

		if (candidateHeight <= currentLimit + 1) {
			bestK = mid;
			lo = mid + 1;
		} else {
			hi = mid - 1;
		}
	}

	if (bestK === 0) {
		return {fittingBlock: null, remainder: block};
	}

	if (bestK >= items.length) {
		return {fittingBlock: block, remainder: null};
	}

	const fittingItems = items.slice(0, bestK);
	const remainderItems = items.slice(bestK);
	const fittingTextLength = fittingItems.reduce(
		(sum, item) => sum + item.text.length,
		0,
	);
	const fittingEndOffset = Math.min(
		block.endCharacterOffset,
		block.startCharacterOffset + fittingTextLength,
	);

	return {
		fittingBlock: {
			...makeSubBlock(fittingItems, itemMeasurements.slice(0, bestK)),
			startCharacterOffset: block.startCharacterOffset,
			endCharacterOffset: fittingEndOffset,
		},
		remainder: {
			...makeSubBlock(remainderItems, itemMeasurements.slice(bestK)),
			startCharacterOffset: fittingEndOffset,
			endCharacterOffset: block.endCharacterOffset,
		},
	};
}

function paginateBlocks({
	blocks,
	firstPageLimit,
	regularPageLimit,
	contentWidth,
	typography,
	domMeasurePage,
}: {
	blocks: AnnotatedHtmlPageBlock[];
	firstPageLimit: number;
	regularPageLimit: number;
	contentWidth: number;
	typography: ResolvedTypography;
	domMeasurePage: (blocks: HtmlPageBlock[], pageLimit: number) => number;
}): AnnotatedHtmlPageBlock[][] {
	const mutableBlocks = [...blocks];
	const pages: AnnotatedHtmlPageBlock[][] = [];
	let currentBlocks: AnnotatedHtmlPageBlock[] = [];
	let blockIndex = 0;

	const currentLimit = () =>
		pages.length === 0 ? firstPageLimit : regularPageLimit;
	const fits = (
		candidateBlocks: AnnotatedHtmlPageBlock[],
		pageLimit: number,
	): boolean => domMeasurePage(candidateBlocks, pageLimit) <= pageLimit + 1;
	const closeCurrentPage = (): boolean => {
		if (currentBlocks.length === 0) return false;

		const orphanBlocks = pullTrailingOrphanBlocksForward(currentBlocks);
		if (orphanBlocks.length > 0) {
			mutableBlocks.splice(blockIndex, 0, ...orphanBlocks);
		}

		if (currentBlocks.length > 0) {
			pages.push(currentBlocks);
		}

		currentBlocks = [];
		return true;
	};
	const splitBlock = (
		block: AnnotatedHtmlPageBlock,
		pageLimit: number,
	) => {
		if (block.type === "paragraph") {
			return splitParagraphToFit({
				block,
				currentLimit: pageLimit,
				contentWidth,
				typography,
				currentBlocks,
				domMeasurePage,
			});
		}

		if (block.type === "splittable_list") {
			return splitListToFit({
				block,
				currentLimit: pageLimit,
				typography,
				currentBlocks,
				domMeasurePage,
			});
		}

		if (block.type === "code") {
			return splitCodeToFit({
				block,
				currentLimit: pageLimit,
				currentBlocks,
				domMeasurePage,
			});
		}

		return {fittingBlock: null, remainder: block};
	};
	const useSplitResult = (
		splitResult: {
			fittingBlock: AnnotatedHtmlPageBlock | null;
			remainder: AnnotatedHtmlPageBlock | null;
		},
	): boolean => {
		if (!splitResult.fittingBlock) return false;

		pages.push([...currentBlocks, splitResult.fittingBlock]);
		currentBlocks = [];

		if (splitResult.remainder) {
			mutableBlocks.splice(blockIndex, 1, splitResult.remainder);
		} else {
			blockIndex += 1;
		}

		return true;
	};

	while (blockIndex < mutableBlocks.length) {
		const block = mutableBlocks[blockIndex];
		const pageLimit = currentLimit();

		if (
			block.type === "code" &&
			block.continued &&
			block.splitId &&
			currentBlocks.some(
				(currentBlock) =>
					currentBlock.type === "code" &&
					currentBlock.splitId === block.splitId,
			)
		) {
			if (closeCurrentPage()) continue;
		}

		if (fits([...currentBlocks, block], pageLimit)) {
			currentBlocks.push(block);
			blockIndex += 1;
			continue;
		}

		const splitResult = splitBlock(block, pageLimit);
		if (useSplitResult(splitResult)) continue;

		if (currentBlocks.length > 0) {
			closeCurrentPage();
			continue;
		}

		const freshSplitResult = splitBlock(block, currentLimit());
		if (useSplitResult(freshSplitResult)) continue;

		pages.push([block]);
		blockIndex += 1;
	}

	if (currentBlocks.length > 0) {
		pages.push(currentBlocks);
	}

	return pages;
}

function validatePagesWithDom(
	pages: AnnotatedHtmlPageBlock[][],
	firstPageLimit: number,
	regularPageLimit: number,
	proseMeasure: HTMLDivElement,
): AnnotatedHtmlPageBlock[][] {
	const validated: AnnotatedHtmlPageBlock[][] = [];

	for (let i = 0; i < pages.length; i++) {
		const page = pages[i];
		const limit =
			(validated.length === 0 ? firstPageLimit : regularPageLimit) + 1;
		const pageHtml = joinBlocksHtml(page);
		const cacheKey = [
			"page",
			proseMeasure.style.cssText,
			pageHtml,
		].join("\u0000");
		const pageHeight =
			domBlockHeightCache.get(cacheKey) ??
			(() => {
				return setCachedDomBlockHeight(
					cacheKey,
					measureRenderedHtmlHeight(pageHtml, proseMeasure),
				);
			})();

		if (pageHeight <= limit) {
			validated.push(page);
			continue;
		}

		if (page.length <= 1) {
			validated.push(page);
			continue;
		}

		const overflow = page.at(-1)!;
		const retainedBlocks = page.slice(0, -1);
		const carriedBlocks = [
			...pullTrailingOrphanBlocksForward(retainedBlocks),
			overflow,
		];

		if (retainedBlocks.length > 0) {
			validated.push(retainedBlocks);
		}

		const nextPage = pages[i + 1];
		if (nextPage) {
			pages[i + 1] = [...carriedBlocks, ...nextPage];
		} else {
			pages.push(carriedBlocks);
		}
	}

	return validated;
}

function buildMeasuredPage(
	blocks: AnnotatedHtmlPageBlock[],
): ContentMeasuredModulePage {
	return {
		kind: "content",
		html: joinBlocksHtml(blocks),
		startCharacterOffset: blocks[0]?.startCharacterOffset ?? 0,
		endCharacterOffset: blocks.at(-1)?.endCharacterOffset ?? 0,
	};
}

function createPostModuleActionMeasurementMarkup(input: {
	hasNextModule: boolean;
	primaryActionLabel: string;
	stylePresetId: string;
}): string {
	const palette =
		input.stylePresetId === "classic" ?
			{
				border: "#D8B98F",
				panelBg:
					"linear-gradient(135deg,#FFFDF8 0%,#FFFFFF 58%,#FBF2E7 100%)",
				accent: "#996633",
				accentSoft: "#F7EEE4",
				accentText: "#7A4E28",
				heading: "#2A1A0A",
				body: "#5B4630",
				primary: "#2A1A0A",
				tipBorder: "#EAD8C2",
			}
		: input.stylePresetId === "plain" ?
			{
				border: "#BFDBFE",
				panelBg:
					"linear-gradient(135deg,#F8FBFF 0%,#FFFFFF 58%,#EFF6FF 100%)",
				accent: "#2563EB",
				accentSoft: "#EFF6FF",
				accentText: "#1D4ED8",
				heading: "#111827",
				body: "#4B5563",
				primary: "#111827",
				tipBorder: "#DBEAFE",
			}
		:	{
				border: "#86EFAC",
				panelBg:
					"linear-gradient(135deg,#F8FFFB 0%,#FFFFFF 58%,#F0FFF7 100%)",
				accent: "#16A34A",
				accentSoft: "#DCFCE7",
				accentText: "#15803D",
				heading: "#111827",
				body: "#4B5563",
				primary: "#111827",
				tipBorder: "#DCFCE7",
			};
	const continueBody =
		input.hasNextModule ?
			"Move forward when you are ready."
		:	"Finish this unit and return to your dashboard.";
	const footerLabel = input.hasNextModule ? "Next lesson" : "Unit finished";
	return `
        <div style="border:1px solid ${palette.border}; background:${palette.panelBg}; border-radius:22px; padding:20px;">
            <div style="text-align:center;">
                <div style="width:44px;height:44px;margin:0 auto;border-radius:999px;border:1px solid ${palette.tipBorder};background:${palette.accentSoft};color:${palette.accent};display:flex;align-items:center;justify-content:center;font-weight:700;">✓</div>
                <div style="margin-top:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.24em;color:#6B7280;">Next steps</div>
                <div style="margin-top:4px;font-size:24px;line-height:1.15;font-weight:700;color:${palette.heading};">Module complete</div>
                <div style="max-width:460px;margin:8px auto 0;font-size:14px;line-height:1.45;color:${palette.body};">You have finished the theory part. Practice now or continue to the next topic.</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:24px;">
                <div style="min-height:164px;border-radius:20px;background:${palette.primary};color:white;padding:20px;display:flex;flex-direction:column;">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                        <div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;">◇</div>
                        <div style="border-radius:999px;background:white;color:${palette.accentText};font-size:11px;font-weight:700;padding:4px 12px;">Recommended</div>
                    </div>
                    <div style="margin-top:20px;font-size:18px;font-weight:700;line-height:1.2;">Exercises &amp; Practice</div>
                    <div style="margin-top:8px;font-size:14px;font-weight:500;line-height:1.45;color:rgba(255,255,255,.75);">Apply what you learned with guided exercises.</div>
                    <div style="margin-top:auto;border-top:1px solid rgba(255,255,255,.15);padding-top:16px;font-size:12px;font-weight:600;color:rgba(255,255,255,.8);">Custom activity · AI feedback</div>
                </div>
                <div style="min-height:164px;border-radius:20px;border:1px solid #E5E5E7;background:white;color:#111827;padding:20px;display:flex;flex-direction:column;">
                    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                        <div style="width:44px;height:44px;border-radius:12px;background:${palette.accentSoft};color:${palette.accent};display:flex;align-items:center;justify-content:center;">□</div>
                        <div style="border-radius:999px;background:${palette.accentSoft};color:${palette.accentText};font-size:11px;font-weight:700;padding:4px 12px;">Continue</div>
                    </div>
                    <div style="margin-top:20px;font-size:18px;font-weight:700;line-height:1.2;color:${palette.heading};">${escapeHtml(input.primaryActionLabel)}</div>
                    <div style="margin-top:8px;font-size:14px;font-weight:500;line-height:1.45;color:#4B5563;">${escapeHtml(continueBody)}</div>
                    <div style="margin-top:auto;border-top:1px solid #E5E5E7;padding-top:16px;font-size:12px;font-weight:600;color:#4B5563;">${escapeHtml(footerLabel)}</div>
                </div>
            </div>
            <div style="margin-top:20px;border:1px solid ${palette.tipBorder};background:rgba(255,255,255,.82);border-radius:16px;padding:12px 16px;text-align:center;font-size:14px;line-height:1.35;color:${palette.body};"><strong style="color:${palette.accentText};">Tip:</strong> Practicing now helps retain the concepts before moving on.</div>
        </div>
    `;

	return `
        <div style="border:1px solid ${palette.border}; background:${palette.panelBg}; border-radius:22px; padding:20px;">
            <div style="text-align:center;">
                <div style="width:44px;height:44px;margin:0 auto;border-radius:999px;border:1px solid ${palette.tipBorder};background:${palette.accentSoft};color:${palette.accent};display:flex;align-items:center;justify-content:center;font-weight:700;">✓</div>
                <div style="margin-top:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.24em;color:#6B7280;">Next steps</div>
                <div style="margin-top:4px;font-size:24px;line-height:1.15;font-weight:700;color:${palette.heading};">Module complete</div>
                <div style="max-width:460px;margin:8px auto 0;font-size:14px;line-height:1.45;color:${palette.body};">You have finished the theory part. Practice now or continue to the next topic.</div>
            </div>
            <div class="grid gap-2">
                <button type="button" disabled class="w-full rounded-2xl border border-[#E5E5E7] bg-[#F8F8F9] px-4 py-3 text-left text-sm font-semibold text-[#A1A1AA]">
                    Quick Check · Coming soon
                </button>
                <button type="button" disabled class="w-full rounded-2xl border border-[#E5E5E7] bg-[#F8F8F9] px-4 py-3 text-left text-sm font-semibold text-[#A1A1AA]">
                    Applied Practice · Coming soon
                </button>
                <button type="button" class="w-full rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white">
                    ${escapeHtml(input.primaryActionLabel)}
                </button>
            </div>
        </div>
    `;
}

function canMergeTerminalActionPage({
	lastPage,
	pageLimit,
	proseMeasure,
	actionMeasure,
}: {
	lastPage: ContentMeasuredModulePage;
	pageLimit: number;
	proseMeasure: HTMLDivElement;
	actionMeasure: HTMLDivElement;
}): boolean {
	const proseHeight = measureRenderedHtmlHeight(lastPage.html, proseMeasure);
	const actionHeight = actionMeasure.scrollHeight;

	return proseHeight + POST_MODULE_ACTION_GAP + actionHeight <= pageLimit + 1;
}

export function getReadTextOffsetForSpread(
	pages: MeasuredModulePage[],
	spreadIndex: number,
): number {
	const spreadPages = pages.slice(spreadIndex * 2, spreadIndex * 2 + 2);
	const contentPages = spreadPages.filter(isMeasuredPageWithReadableContent);

	if (contentPages.length === 0) {
		return 0;
	}

	return Math.max(...contentPages.map((page) => page.endCharacterOffset));
}

export function findResumeSpreadIndex(
	pages: MeasuredModulePage[],
	readTextOffset: number,
): number {
	if (pages.length === 0) {
		return 0;
	}

	const firstUnreadPageIndex = pages.findIndex(
		(page) =>
			isMeasuredPageWithReadableContent(page) &&
			page.endCharacterOffset > readTextOffset,
	);

	if (firstUnreadPageIndex === -1) {
		return Math.max(0, Math.floor((pages.length - 1) / 2));
	}

	return Math.floor(firstUnreadPageIndex / 2);
}

export function getStatusPillClass(status: UnitChapter["status"]): string {
	if (status === "ready") return "bg-[#4ADE80]/10 text-[#2D8F4B]";
	if (status === "pending") return "bg-amber-50 text-amber-600";
	return "bg-red-50 text-red-600";
}

function createHeaderMarkup(
	activeChapter: MeasurePageChapter,
	chapterIndex: number,
): string {
	const overviewHtml = escapeHtml(activeChapter.summary);

	return `
    <div class="mb-4 flex-shrink-0 space-y-2">
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#86868B]">
          Module ${chapterIndex + 1}
        </span>
        <span class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${getStatusPillClass(activeChapter.status)}">
          ${escapeHtml(activeChapter.status)}
        </span>
      </div>
      <h2 class="text-xl font-bold leading-tight tracking-tight text-[#1D1D1F] md:text-2xl">
        ${escapeHtml(activeChapter.title)}
      </h2>
      <div class="text-xs font-medium italic leading-relaxed text-[#86868B] md:text-sm">
        ${overviewHtml}
      </div>
      <div class="flex items-center gap-3 pt-1 text-[10px] text-[#86868B]">
        <div class="flex items-center gap-1">
          <span>${escapeHtml(activeChapter.readingTime)}</span>
        </div>
        <div class="flex items-center gap-1">
          <span>${escapeHtml(activeChapter.level)}</span>
        </div>
      </div>
      <div class="my-3 h-[1px] w-full bg-[#E5E5E7]"></div>
    </div>
  `;
}

export function measurePages({
	activeChapter,
	content,
	pageWidth,
	pageHeight,
	chapterIndex,
	hasNextModule,
	textStyle,
}: {
	activeChapter: MeasurePageChapter;
	content: string;
	pageWidth: number;
	pageHeight: number;
	chapterIndex: number;
	hasNextModule: boolean;
	textStyle?: EditorTextStyle;
}): MeasuredModulePage[] {
	if (!content || !pageWidth || !pageHeight) return [];
	const renderedContent = normalizeStoredHtml(content);
	if (!renderedContent) return [];

	const isMobile = pageWidth < 420;

	// Padding constants must exactly match the page card wrapper CSS:
	//   mobile:   px-5 py-4 → sides 20px, top/bottom 16px
	//   desktop:  md:px-6 md:py-5 → sides 24px, top/bottom 20px
	const pagePaddingSide = isMobile ? 20 : 24;
	const pagePaddingTop = isMobile ? 16 : 20;
	const pagePaddingBottom = isMobile ? 16 : 20;
	const measurementBuffer = isMobile ? 8 : 6;

	const contentWidth = Math.max(240, pageWidth - pagePaddingSide * 2);
	const contentLimit = Math.max(
		160,
		pageHeight - pagePaddingTop - pagePaddingBottom,
	);
	const primaryActionLabel = hasNextModule ? "Next module" : "Finish unit 🎉";

	const stylePresetId = textStyle?.stylePreset ?? "classic";
	const typography =
		textStyle ?
			(() => {
				const preset = STYLE_PRESETS[stylePresetId];
				return resolveTypography({
					sizeProfile: (textStyle.sizeProfile ??
						"regular") as SizeProfile,
					bodyFontId: preset.body as FontId,
					headingFontId: preset.heading as FontId,
					isMobile,
					stylePreset: stylePresetId,
				});
			})()
		:	defaultTypography(isMobile);

	const sandbox = document.createElement("div");
	sandbox.style.position = "fixed";
	sandbox.style.left = "-10000px";
	sandbox.style.top = "0";
	sandbox.style.visibility = "hidden";
	sandbox.style.pointerEvents = "none";
	sandbox.style.opacity = "0";
	sandbox.style.zIndex = "-1";

	const proseMeasure = document.createElement("div");
	// Use unit-page-scope so measurement uses exactly the same CSS rules as
	// the rendered ChapterRenderer, ensuring heading/paragraph sizes match.
	proseMeasure.className = "unit-page-scope";
	proseMeasure.style.width = `${contentWidth}px`;
	proseMeasure.style.overflow = "hidden";
	proseMeasure.style.setProperty("--unit-body-font", typography.body.family);
	proseMeasure.style.setProperty("--unit-heading-font", typography.h2.family);
	proseMeasure.style.setProperty("--unit-body-size", `${typography.body.sizePx}px`);
	proseMeasure.style.setProperty("--unit-line-height", String(typography.body.lineHeight));
	proseMeasure.style.setProperty("--unit-heading-scale", "1");
	proseMeasure.style.setProperty("--unit-paragraph-align", "justify");
	proseMeasure.style.setProperty("--unit-paragraph-margin", "0.65em 0");

	const headerMeasure = document.createElement("div");
	headerMeasure.style.width = `${contentWidth}px`;
	headerMeasure.style.overflow = "hidden";
	headerMeasure.innerHTML = createHeaderMarkup(activeChapter, chapterIndex);

	const labelMeasure = document.createElement("div");
	labelMeasure.style.width = `${contentWidth}px`;

	const actionMeasure = document.createElement("div");
	actionMeasure.style.width = `${contentWidth}px`;
	actionMeasure.style.fontFamily = typography.body.family;
	actionMeasure.innerHTML = createPostModuleActionMeasurementMarkup({
		hasNextModule,
		primaryActionLabel,
		stylePresetId,
	});

	sandbox.appendChild(headerMeasure);
	sandbox.appendChild(labelMeasure);
	sandbox.appendChild(proseMeasure);
	sandbox.appendChild(actionMeasure);
	document.body.appendChild(sandbox);

	const firstPageLimit = Math.max(
		140,
		contentLimit -
			headerMeasure.scrollHeight -
			FIRST_PAGE_HEADER_BOTTOM_GAP -
			measurementBuffer,
	);
	const regularPageLimit = Math.max(
		140,
		contentLimit - measurementBuffer,
	);
	const blocks = annotateBlocks(
		extractHtmlBlocks(renderedContent),
		typography,
	);
	const typographyCacheKey = makeTypographyCacheKey(typography);

	const domMeasurePage = (
		pageBlocks: HtmlPageBlock[],
		pageLimit: number,
	): number => {
		const pageHtml = joinBlocksHtml(pageBlocks);
		const cacheKey = [
			"candidate-page",
			contentWidth,
			pageLimit,
			typographyCacheKey,
			pageHtml,
		].join("\u0000");
		const cachedHeight = domBlockHeightCache.get(cacheKey);
		if (cachedHeight !== undefined) {
			return cachedHeight;
		}

		return setCachedDomBlockHeight(
			cacheKey,
			measureRenderedHtmlHeight(pageHtml, proseMeasure),
		);
	};

	const rawPages = paginateBlocks({
		blocks,
		firstPageLimit,
		regularPageLimit,
		contentWidth,
		typography,
		domMeasurePage,
	});

	const contentPages = validatePagesWithDom(
		rawPages,
		firstPageLimit,
		regularPageLimit,
		proseMeasure,
	).map((pageBlocks) => buildMeasuredPage(pageBlocks));

	const totalTextLength = contentPages.at(-1)?.endCharacterOffset ?? 0;
	const lastContentPage = contentPages.at(-1);
	const canCollapseTerminalPage =
		lastContentPage !== undefined &&
		canMergeTerminalActionPage({
			lastPage: lastContentPage,
			pageLimit:
				contentPages.length === 1 ? firstPageLimit : regularPageLimit,
			proseMeasure,
			actionMeasure,
		});

	document.body.removeChild(sandbox);

	if (lastContentPage && canCollapseTerminalPage) {
		return [
			...contentPages.slice(0, -1),
			{
				...lastContentPage,
				kind: "content_with_actions",
				hasNextModule,
				primaryActionLabel,
			},
		];
	}

	return [
		...contentPages,
		{
			kind: "post_module_actions",
			startCharacterOffset: totalTextLength,
			endCharacterOffset: totalTextLength,
			hasNextModule,
			primaryActionLabel,
		},
	];
}

export function paginateHtmlContent({
	content,
	pageWidth,
	pageHeight,
}: {
	content: string;
	pageWidth: number;
	pageHeight: number;
}): string[] {
	if (!content || !pageWidth || !pageHeight) return [];

	const isMobile = pageWidth < 420;
	const clamp = (v: number, lo: number, hi: number) =>
		Math.max(lo, Math.min(hi, v));
	const horizontalPadding = clamp(Math.round(pageWidth * 0.06), 20, 40);
	const topPadding = clamp(Math.round(pageHeight * 0.04), 20, 36);
	const bottomPadding = clamp(Math.round(pageHeight * 0.055), 30, 50);
	const measurementBuffer = isMobile ? 10 : 14;
	const contentWidth = Math.max(240, pageWidth - horizontalPadding * 2);
	const contentLimit = Math.max(160, pageHeight - topPadding - bottomPadding);
	const regularPageLimit = Math.max(140, contentLimit - measurementBuffer);

	const typography = defaultTypography(isMobile);

	const sandbox = document.createElement("div");
	sandbox.style.position = "fixed";
	sandbox.style.left = "-10000px";
	sandbox.style.top = "0";
	sandbox.style.visibility = "hidden";
	sandbox.style.pointerEvents = "none";
	sandbox.style.opacity = "0";
	sandbox.style.zIndex = "-1";

	const proseMeasure = document.createElement("div");
	proseMeasure.className =
		"unit-page-scope leading-[1.9] text-[#1D1D1F]";
	proseMeasure.style.width = `${contentWidth}px`;
	proseMeasure.style.overflow = "hidden";

	sandbox.appendChild(proseMeasure);
	document.body.appendChild(sandbox);

	const blocks = annotateBlocks(
		extractHtmlBlocks(normalizeStoredHtml(content)),
		typography,
	);
	const typographyCacheKey = makeTypographyCacheKey(typography);

	const domMeasurePage = (
		pageBlocks: HtmlPageBlock[],
		pageLimit: number,
	): number => {
		const pageHtml = joinBlocksHtml(pageBlocks);
		const cacheKey = [
			"candidate-page",
			contentWidth,
			pageLimit,
			typographyCacheKey,
			pageHtml,
		].join("\u0000");
		const cachedHeight = domBlockHeightCache.get(cacheKey);
		if (cachedHeight !== undefined) {
			return cachedHeight;
		}

		return setCachedDomBlockHeight(
			cacheKey,
			measureRenderedHtmlHeight(pageHtml, proseMeasure),
		);
	};

	const rawPages = paginateBlocks({
		blocks,
		firstPageLimit: regularPageLimit,
		regularPageLimit,
		contentWidth,
		typography,
		domMeasurePage,
	});

	const pages = validatePagesWithDom(
		rawPages,
		regularPageLimit,
		regularPageLimit,
		proseMeasure,
	).map((pageBlocks) => joinBlocksHtml(pageBlocks));

	document.body.removeChild(sandbox);

	return pages;
}

export function calculateSpreadMetrics({
	viewportWidth,
	viewportHeight,
}: {
	viewportWidth: number;
	viewportHeight: number;
}) {
	const isMobile = viewportWidth < MOBILE_BREAKPOINT;
	const pageWidthRatio =
		isMobile ? PAGE_WIDTH_RATIO_MOBILE : PAGE_WIDTH_RATIO_DESKTOP;
	const stagePaddingTop = isMobile ? 16 : 24;
	const stagePaddingBottom = isMobile ? 20 : 32;
	const indicatorHeight = isMobile ? 42 : 48;
	const indicatorGap = isMobile ? 12 : 16;
	const arrowAllowance = isMobile ? 64 : 84;
	const mainStageHorizontalGutter = isMobile ? 24 : 48;
	const spreadGap = isMobile ? 16 : 32;
	const availableWidth = Math.max(
		360,
		viewportWidth -
			OPEN_SIDEBAR_WIDTH -
			mainStageHorizontalGutter -
			arrowAllowance,
	);
	const availableHeight = Math.max(
		420,
		viewportHeight -
			HEADER_HEIGHT -
			stagePaddingTop -
			stagePaddingBottom -
			indicatorHeight -
			indicatorGap,
	);
	const maxPageHeight = Math.min(
		availableHeight,
		isMobile ? 680 : viewportHeight * 0.88,
	);
	const spreadWidthByHeight = maxPageHeight * pageWidthRatio * 2 + spreadGap;
	const spreadWidth = Math.min(
		availableWidth,
		spreadWidthByHeight,
		isMobile ? 980 : 2000,
	);
	const pageWidth = (spreadWidth - spreadGap) / 2;
	const pageHeight = Math.min(maxPageHeight, pageWidth / pageWidthRatio);

	return {
		indicatorGap,
		isMobile,
		pageHeight,
		pageWidth,
		spreadGap,
		spreadHeight: pageHeight,
		spreadWidth: pageWidth * 2 + spreadGap,
	};
}
