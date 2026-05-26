import type {
	DidacticUnitNoteDto,
	DidacticUnitNoteAnchorDto,
} from "@/dashboard/api/dashboardApi";
import type {UnitEditorChapterViewModel, HtmlContentBlock} from "../types";

const ANNOTATABLE_BLOCK_TYPES = new Set<HtmlContentBlock["type"]>([
	"heading",
	"paragraph",
	"blockquote",
	"list",
]);

type TextPosition = {
	node: Text;
	offset: number;
	normalizedOffset: number;
};

function normalizeSelectionText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

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

function normalizedOffsetForDomPosition(
	root: HTMLElement,
	targetNode: Node,
	targetOffset: number,
): number | null {
	let result: number | null = null;
	walkTextPositions(root, ({node, offset, normalizedOffset}) => {
		if (node === targetNode && offset >= targetOffset) {
			result = normalizedOffset;
			return false;
		}
		return undefined;
	});
	return result;
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

function blockForGlobalOffset(
	blocks: HtmlContentBlock[],
	offset: number,
): HtmlContentBlock | null {
	return (
		blocks.find(
			(block) =>
				offset >= block.textStartOffset && offset <= block.textEndOffset,
		) ?? null
	);
}

function areBlocksAnnotatable(
	blocks: HtmlContentBlock[],
	startBlockId: string,
	endBlockId: string,
): boolean {
	const startIndex = blocks.findIndex((block) => block.id === startBlockId);
	const endIndex = blocks.findIndex((block) => block.id === endBlockId);
	if (startIndex < 0 || endIndex < startIndex) {
		return false;
	}
	return blocks
		.slice(startIndex, endIndex + 1)
		.every((block) => ANNOTATABLE_BLOCK_TYPES.has(block.type));
}

export function getValidUnitNotesForChapter(
	notes: DidacticUnitNoteDto[],
	chapter: UnitEditorChapterViewModel,
): DidacticUnitNoteDto[] {
	return notes.filter((note) => {
		if (note.chapterIndex !== chapter.chapterIndex) {
			return false;
		}
		if (
			note.anchor.htmlHash &&
			chapter.htmlHash &&
			note.anchor.htmlHash !== chapter.htmlHash
		) {
			return false;
		}
		if (note.anchor.htmlBlocksVersion !== chapter.htmlBlocksVersion) {
			return false;
		}
		return areBlocksAnnotatable(
			chapter.htmlBlocks,
			note.anchor.startBlockId,
			note.anchor.endBlockId,
		);
	});
}

export function buildNoteAnchorFromSelection(input: {
	range: Range;
	pageRoot: HTMLElement;
	pageStartOffset: number;
	chapter: UnitEditorChapterViewModel;
}): {anchor: DidacticUnitNoteAnchorDto; selectedText: string} | null {
	const selectedText = normalizeSelectionText(input.range.toString());
	if (!selectedText) {
		return null;
	}

	const startOffset = normalizedOffsetForDomPosition(
		input.pageRoot,
		input.range.startContainer,
		input.range.startOffset,
	);
	const endOffset = normalizedOffsetForDomPosition(
		input.pageRoot,
		input.range.endContainer,
		input.range.endOffset,
	);
	if (startOffset === null || endOffset === null || endOffset <= startOffset) {
		return null;
	}

	const globalStart = input.pageStartOffset + startOffset;
	const globalEnd = input.pageStartOffset + endOffset;
	const startBlock = blockForGlobalOffset(input.chapter.htmlBlocks, globalStart);
	const endBlock = blockForGlobalOffset(input.chapter.htmlBlocks, globalEnd);
	if (!startBlock || !endBlock) {
		return null;
	}
	if (
		!areBlocksAnnotatable(
			input.chapter.htmlBlocks,
			startBlock.id,
			endBlock.id,
		)
	) {
		return null;
	}

	return {
		selectedText,
		anchor: {
			startBlockId: startBlock.id,
			startOffset: Math.max(0, globalStart - startBlock.textStartOffset),
			endBlockId: endBlock.id,
			endOffset: Math.max(0, globalEnd - endBlock.textStartOffset),
			htmlHash: input.chapter.htmlHash,
			htmlBlocksVersion: input.chapter.htmlBlocksVersion,
			contextBefore: selectedText.slice(0, 80),
			contextAfter: selectedText.slice(-80),
		},
	};
}

function globalOffsetForAnchor(
	blocks: HtmlContentBlock[],
	anchor: DidacticUnitNoteAnchorDto,
	edge: "start" | "end",
): number | null {
	const block = blocks.find(
		(candidate) =>
			candidate.id ===
			(edge === "start" ? anchor.startBlockId : anchor.endBlockId),
	);
	if (!block) {
		return null;
	}
	return block.textStartOffset + (edge === "start" ? anchor.startOffset : anchor.endOffset);
}

function firstWordLength(value: string): number {
	return value.trim().match(/^\S+/)?.[0]?.length ?? 0;
}

function closestTextOccurrence(input: {
	text: string;
	search: string;
	expectedOffset: number;
}): number | null {
	if (!input.search) {
		return null;
	}
	let bestOffset: number | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	let searchFrom = 0;

	while (searchFrom <= input.text.length) {
		const offset = input.text.indexOf(input.search, searchFrom);
		if (offset < 0) {
			break;
		}
		const distance = Math.abs(offset - input.expectedOffset);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestOffset = offset;
		}
		searchFrom = offset + Math.max(1, input.search.length);
	}

	return bestOffset;
}

export function applyNoteMarksToPageHtml(input: {
	html: string;
	pageStartOffset: number;
	pageEndOffset: number;
	chapter: UnitEditorChapterViewModel;
	notes: DidacticUnitNoteDto[];
}): string {
	const validNotes = getValidUnitNotesForChapter(input.notes, input.chapter)
		.map((note) => {
			const start = globalOffsetForAnchor(input.chapter.htmlBlocks, note.anchor, "start");
			const wordLength = firstWordLength(note.selectedText);
			const end = wordLength > 0 ? start === null ? null : start + wordLength : null;
			return start === null || end === null ? null : {note, start, end};
		})
		.filter(
			(item): item is {note: DidacticUnitNoteDto; start: number; end: number} =>
				item !== null &&
				item.start >= input.pageStartOffset &&
				item.start < input.pageEndOffset,
		)
		.sort((left, right) => right.start - left.start);

	if (validNotes.length === 0) {
		return input.html;
	}

	const parser = new DOMParser();
	const document = parser.parseFromString(input.html, "text/html");
	const root = document.body;
	const normalizedPageText = normalizeSelectionText(root.textContent ?? "");

	for (const item of validNotes) {
		const expectedLocalStart = Math.max(0, item.start - input.pageStartOffset);
		const selectedText = normalizeSelectionText(item.note.selectedText);
		const matchedLocalStart =
			closestTextOccurrence({
				text: normalizedPageText,
				search: selectedText,
				expectedOffset: expectedLocalStart,
			}) ?? expectedLocalStart;
		const localStart = matchedLocalStart;
		const localEnd = Math.min(
			input.pageEndOffset - input.pageStartOffset,
			localStart + firstWordLength(selectedText),
		);
		const start = findTextPositionForNormalizedOffset(root, localStart);
		const end = findTextPositionForNormalizedOffset(root, localEnd);
		if (!start || !end) {
			continue;
		}
		const range = document.createRange();
		try {
			range.setStart(start.node, start.offset);
			range.setEnd(end.node, end.offset);
			const mark = document.createElement("mark");
			mark.dataset.noteId = item.note.id;
			mark.className = "didactio-note-mark";
			mark.appendChild(range.extractContents());
			range.insertNode(mark);
		} catch {
			continue;
		}
	}

	return root.innerHTML;
}
