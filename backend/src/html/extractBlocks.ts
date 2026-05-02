import {createHash} from "node:crypto";
import * as parse5 from "parse5";
import type {HtmlContentBlock} from "../didactic-unit/didactic-unit-chapter.js";

export const HTML_BLOCKS_VERSION = 1;

const TOP_LEVEL_BLOCK_TAGS = new Set([
	"h2",
	"h3",
	"h4",
	"p",
	"blockquote",
	"ul",
	"ol",
	"table",
	"pre",
	"hr",
]);

function serializeNode(node: unknown): string {
	const fragment = {
		nodeName: "#document-fragment",
		childNodes: [node],
	} as unknown as parse5.DefaultTreeAdapterMap["documentFragment"];
	return parse5.serialize(fragment);
}

function textContent(node: unknown): string {
	const record = node as {
		value?: string;
		childNodes?: unknown[];
	};

	if (typeof record.value === "string") {
		return record.value;
	}

	return (record.childNodes ?? []).map((child) => textContent(child)).join("");
}

function graphemeLength(value: string): number {
	if (typeof Intl.Segmenter === "function") {
		const segmenter = new Intl.Segmenter(undefined, {
			granularity: "grapheme",
		});
		return Array.from(segmenter.segment(value)).length;
	}

	return Array.from(value).length;
}

function classifyBlock(tagName: string): HtmlContentBlock["type"] {
	if (tagName === "h2" || tagName === "h3" || tagName === "h4") {
		return "heading";
	}
	if (tagName === "p") {
		return "paragraph";
	}
	if (tagName === "blockquote") {
		return "blockquote";
	}
	if (tagName === "ul" || tagName === "ol") {
		return "list";
	}
	if (tagName === "table") {
		return "table";
	}
	if (tagName === "pre") {
		return "code";
	}
	return "divider";
}

function blockId(chapterId: string, blockIndex: number, html: string): string {
	return createHash("sha1")
		.update(`${chapterId}:${blockIndex}:${html}`)
		.digest("hex")
		.slice(0, 12);
}

export function extractHtmlBlocks(
	sanitizedHtml: string,
	chapterId: string,
): HtmlContentBlock[] {
	const fragment = parse5.parseFragment(sanitizedHtml);
	let textOffset = 0;

	const blocks = fragment.childNodes.map((node, blockIndex) => {
		const record = node as {nodeName: string; tagName?: string; value?: string};

		if (record.nodeName === "#text") {
			if ((record.value ?? "").trim()) {
				throw new Error("HTML contains top-level orphan text.");
			}
			return null;
		}

		const tagName = record.tagName?.toLowerCase();
		if (!tagName || !TOP_LEVEL_BLOCK_TAGS.has(tagName)) {
			throw new Error("HTML contains top-level non-block content.");
		}

		const html = serializeNode(node);
		const blockText = textContent(node).replace(/\s+/g, " ").trim();
		const textLength = graphemeLength(blockText);
		const block: HtmlContentBlock = {
			id: blockId(chapterId, blockIndex, html),
			type: classifyBlock(tagName),
			html,
			textLength,
			textStartOffset: textOffset,
			textEndOffset: textOffset + textLength,
		};
		textOffset = block.textEndOffset;
		return block;
	});

	const validBlocks = blocks.filter(
		(block): block is HtmlContentBlock => block !== null,
	);

	if (validBlocks.length === 0) {
		throw new Error("HTML contains no block content.");
	}

	return validBlocks;
}
