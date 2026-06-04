import type {DidacticUnitChapterDetailDto} from "@/dashboard/api/dashboardApi";
import type {UnitEditorChapterViewModel} from "@/dashboard/types";

const SEARCH_RESULT_LIMIT = 50;
const SNIPPET_CONTEXT_WORDS = 4;

type NormalizedTextIndex = {
	offsets: number[];
	text: string;
};

type IndexedSearchBlock = {
	displayText: string;
	normalized: NormalizedTextIndex;
	textStartOffset: number;
};

type IndexedSearchChapter = {
	chapterIndex: number;
	moduleIndex: number;
	title: string;
	unitStartOffset: number;
	textLength: number;
	blocks: IndexedSearchBlock[];
};

export type UnitSearchIndex = {
	chapters: IndexedSearchChapter[];
	totalTextLength: number;
};

export type UnitSearchResult = {
	id: string;
	after: string;
	before: string;
	chapterIndex: number;
	match: string;
	matchEndOffsetInModule: number;
	matchOffsetInModule: number;
	moduleIndex: number;
	moduleTitle: string;
	unitPercent: number;
};

export type ActiveSearchHighlight = {
	chapterIndex: number;
	endOffset: number;
	key: number;
	startOffset: number;
};

function stripDiacritics(value: string): string {
	return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeUnitSearchText(value: string): string {
	return stripDiacritics(value)
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

function buildNormalizedTextIndex(value: string): NormalizedTextIndex {
	const normalizedChars: string[] = [];
	const offsets: number[] = [];
	let pendingSpace = false;

	for (let offset = 0; offset < value.length; offset += 1) {
		const char = value[offset];
		if (/\s/.test(char)) {
			pendingSpace = normalizedChars.length > 0;
			continue;
		}

		const normalizedChar = stripDiacritics(char).toLowerCase();
		if (!normalizedChar) {
			continue;
		}

		if (pendingSpace) {
			normalizedChars.push(" ");
			offsets.push(offset);
			pendingSpace = false;
		}

		for (const normalizedPart of normalizedChar) {
			normalizedChars.push(normalizedPart);
			offsets.push(offset);
		}
	}

	return {
		offsets,
		text: normalizedChars.join(""),
	};
}

function htmlToText(html: string): string {
	const parser = new DOMParser();
	const document = parser.parseFromString(html, "text/html");
	return document.body.textContent ?? "";
}

function displayText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function chapterTextLength(chapter: UnitEditorChapterViewModel): number {
	return (
		chapter.htmlBlocks.at(-1)?.textEndOffset ??
		displayText(chapter.html ?? "").length
	);
}

export function buildUnitSearchIndex(input: {
	chapterDetails: Record<number, DidacticUnitChapterDetailDto>;
	chapters: UnitEditorChapterViewModel[];
}): UnitSearchIndex {
	let unitStartOffset = 0;

	const chapters = input.chapters.map((chapter) => {
		const detail = input.chapterDetails[chapter.chapterIndex];
		const htmlBlocks = detail?.htmlBlocks ?? chapter.htmlBlocks;
		const textLength = chapterTextLength(chapter);
		const indexedChapter: IndexedSearchChapter = {
			chapterIndex: chapter.chapterIndex,
			moduleIndex: chapter.chapterIndex + 1,
			title: detail?.title ?? chapter.title,
			unitStartOffset,
			textLength,
			blocks: htmlBlocks
				.filter((block) => block.type !== "divider" && block.textLength > 0)
				.map((block) => {
					const text = htmlToText(block.html);
					return {
						displayText: displayText(text),
						normalized: buildNormalizedTextIndex(text),
						textStartOffset: block.textStartOffset,
					};
				})
				.filter((block) => block.normalized.text.length > 0),
		};

		unitStartOffset += textLength;
		return indexedChapter;
	});

	return {
		chapters,
		totalTextLength: unitStartOffset,
	};
}

function buildSnippet(input: {
	displayText: string;
	matchEnd: number;
	matchStart: number;
}): {after: string; before: string; match: string} {
	return {
		before: getContextBefore(input.displayText, input.matchStart),
		match: input.displayText.slice(input.matchStart, input.matchEnd),
		after: getContextAfter(input.displayText, input.matchEnd),
	};
}

function isCountedContextWord(value: string): boolean {
	return stripDiacritics(value).replace(/[^\p{L}\p{N}]+/gu, "").length >= 3;
}

function getContextBefore(value: string, matchStart: number): string {
	const before = value.slice(0, matchStart);
	const words = Array.from(before.matchAll(/\S+/g));
	let countedWords = 0;
	let firstWordIndex = words.length;

	for (let index = words.length - 1; index >= 0; index -= 1) {
		firstWordIndex = index;
		if (isCountedContextWord(words[index][0])) {
			countedWords += 1;
		}
		if (countedWords >= SNIPPET_CONTEXT_WORDS) {
			break;
		}
	}

	if (firstWordIndex >= words.length) {
		return "";
	}

	return before.slice(words[firstWordIndex].index).trimStart();
}

function getContextAfter(value: string, matchEnd: number): string {
	const after = value.slice(matchEnd);
	const words = Array.from(after.matchAll(/\S+/g));
	let countedWords = 0;
	let lastWordEnd = 0;

	for (const word of words) {
		lastWordEnd = (word.index ?? 0) + word[0].length;
		if (isCountedContextWord(word[0])) {
			countedWords += 1;
		}
		if (countedWords >= SNIPPET_CONTEXT_WORDS) {
			break;
		}
	}

	return after.slice(0, lastWordEnd).trimEnd();
}

export function searchUnitIndex(
	index: UnitSearchIndex,
	query: string,
): UnitSearchResult[] {
	const normalizedQuery = normalizeUnitSearchText(query);
	if (!normalizedQuery) {
		return [];
	}

	const results: UnitSearchResult[] = [];

	for (const chapter of index.chapters) {
		for (const block of chapter.blocks) {
			let searchFrom = 0;
			while (searchFrom <= block.normalized.text.length) {
				const matchStart = block.normalized.text.indexOf(
					normalizedQuery,
					searchFrom,
				);
				if (matchStart < 0) {
					break;
				}

				const matchEnd = matchStart + normalizedQuery.length;
				const matchOffsetInModule = block.textStartOffset + matchStart;
				const matchEndOffsetInModule = block.textStartOffset + matchEnd;
				const unitOffset = chapter.unitStartOffset + matchOffsetInModule;
				const unitPercent =
					index.totalTextLength > 0 ?
						Math.max(
							0,
							Math.min(
								100,
								Math.round((unitOffset / index.totalTextLength) * 100),
							),
						)
					:	0;

				results.push({
					id: `${chapter.chapterIndex}:${matchOffsetInModule}:${results.length}`,
					chapterIndex: chapter.chapterIndex,
					moduleIndex: chapter.moduleIndex,
					moduleTitle: chapter.title,
					matchOffsetInModule,
					matchEndOffsetInModule,
					unitPercent,
					...buildSnippet({
						displayText: block.displayText,
						matchStart,
						matchEnd,
					}),
				});

				if (results.length >= SEARCH_RESULT_LIMIT) {
					return results;
				}

				searchFrom = matchStart + Math.max(1, normalizedQuery.length);
			}
		}
	}

	return results;
}

type TextPosition = {
	node: Text;
	offset: number;
	normalizedOffset: number;
};

function walkTextPositions(
	root: HTMLElement,
	visit: (position: TextPosition) => boolean | void,
): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let normalizedOffset = 0;
	let inWhitespace = false;

	while (walker.nextNode()) {
		const node = walker.currentNode as Text;
		const value = node.data;

		for (let offset = 0; offset <= value.length; offset += 1) {
			if (visit({node, offset, normalizedOffset}) === false) {
				return;
			}
			if (offset === value.length) {
				continue;
			}
			const char = value[offset];
			if (/\s/.test(char)) {
				if (inWhitespace) {
					continue;
				}
				inWhitespace = true;
			} else {
				inWhitespace = false;
			}
			normalizedOffset += 1;
		}
	}
}

function findTextPositionForNormalizedOffset(
	root: HTMLElement,
	targetOffset: number,
): {node: Text; offset: number} | null {
	let result: {node: Text; offset: number} | null = null;
	walkTextPositions(root, ({node, offset, normalizedOffset}) => {
		result = {node, offset};
		if (normalizedOffset >= targetOffset) {
			return false;
		}
		return undefined;
	});
	return result;
}

function wrapTextNodeSegment(input: {
	className: string;
	document: Document;
	endOffset: number;
	node: Text;
	startOffset: number;
}): void {
	const startOffset = Math.max(0, Math.min(input.startOffset, input.node.length));
	const endOffset = Math.max(
		startOffset,
		Math.min(input.endOffset, input.node.length),
	);

	if (!input.node.parentNode || endOffset <= startOffset) {
		return;
	}

	let target = input.node;
	if (endOffset < target.length) {
		target.splitText(endOffset);
	}
	if (startOffset > 0) {
		target = target.splitText(startOffset);
	}
	if (!target.data.trim()) {
		return;
	}

	const mark = input.document.createElement("mark");
	mark.className = input.className;
	mark.dataset.searchHit = "true";
	target.parentNode?.insertBefore(mark, target);
	mark.appendChild(target);
}

function wrapTextPositions(input: {
	className: string;
	document: Document;
	end: {node: Text; offset: number};
	root: HTMLElement;
	start: {node: Text; offset: number};
}): void {
	const textNodes: Text[] = [];
	const walker = input.document.createTreeWalker(
		input.root,
		NodeFilter.SHOW_TEXT,
	);
	while (walker.nextNode()) {
		textNodes.push(walker.currentNode as Text);
	}

	const startIndex = textNodes.indexOf(input.start.node);
	const endIndex = textNodes.indexOf(input.end.node);
	if (startIndex < 0 || endIndex < startIndex) {
		return;
	}

	for (let index = endIndex; index >= startIndex; index -= 1) {
		const node = textNodes[index];
		wrapTextNodeSegment({
			node,
			startOffset: index === startIndex ? input.start.offset : 0,
			endOffset: index === endIndex ? input.end.offset : node.length,
			className: input.className,
			document: input.document,
		});
	}
}

export function applySearchHighlightToPageHtml(input: {
	highlight: ActiveSearchHighlight | null;
	html: string;
	pageEndOffset: number;
	pageStartOffset: number;
}): string {
	if (
		!input.highlight ||
		input.highlight.endOffset <= input.pageStartOffset ||
		input.highlight.startOffset >= input.pageEndOffset
	) {
		return input.html;
	}

	const localStart = Math.max(
		0,
		input.highlight.startOffset - input.pageStartOffset,
	);
	const localEnd = Math.min(
		input.pageEndOffset - input.pageStartOffset,
		input.highlight.endOffset - input.pageStartOffset,
	);
	const parser = new DOMParser();
	const document = parser.parseFromString(input.html, "text/html");
	const root = document.body;
	const start = findTextPositionForNormalizedOffset(root, localStart);
	const end = findTextPositionForNormalizedOffset(root, localEnd);
	if (!start || !end) {
		return input.html;
	}

	try {
		wrapTextPositions({
			root,
			start,
			end,
			document,
			className: "didactio-search-hit",
		});
	} catch {
		return input.html;
	}

	return root.innerHTML;
}
