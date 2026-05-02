import {randomUUID} from "node:crypto";
import {computeHtmlHash} from "../html/hash.js";
import {sanitizeChapterHtml} from "../html/sanitize.js";
import {
	HTML_BLOCKS_VERSION,
	extractHtmlBlocks,
} from "../html/extractBlocks.js";

export interface HtmlContentBlock {
	id: string;
	type:
		| "heading"
		| "paragraph"
		| "blockquote"
		| "list"
		| "table"
		| "code"
		| "divider";
	html: string;
	textLength: number;
	textStartOffset: number;
	textEndOffset: number;
}

export interface DidacticUnitGeneratedChapter {
	chapterIndex: number;
	title: string;
	html: string;
	htmlHash: string;
	htmlBlocks: HtmlContentBlock[];
	htmlBlocksVersion: number;
	generatedAt: string;
	updatedAt?: string;
}

export interface DidacticUnitChapterCompletion {
	chapterIndex: number;
	completedAt: string;
}

export type DidacticUnitChapterRevisionSource =
	| "ai_generation"
	| "ai_regeneration"
	| "manual_edit";

export interface DidacticUnitChapterRevision {
	id: string;
	chapterIndex: number;
	source: DidacticUnitChapterRevisionSource;
	chapter: DidacticUnitGeneratedChapter;
	createdAt: string;
}

export interface UpdateDidacticUnitChapterInput {
	chapter: {
		title: string;
		html: string;
		htmlHash?: string;
	};
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
	const parsedValue = typeof value === "string" ? value.trim() : "";

	if (!parsedValue) {
		throw new Error(`${fieldName} is required.`);
	}

	return parsedValue;
}

export function createCanonicalDidacticUnitChapter(input: {
	chapterIndex: number;
	title: string;
	rawHtml: string;
	generatedAt?: string;
	updatedAt?: string;
	chapterId?: string;
}): DidacticUnitGeneratedChapter {
	const sanitized = sanitizeChapterHtml(input.rawHtml);

	if (sanitized.isEmpty) {
		throw new Error("Generated chapter HTML is empty after sanitization.");
	}

	const chapterId = input.chapterId ?? `${input.chapterIndex}`;
	const htmlBlocks = extractHtmlBlocks(sanitized.html, chapterId);

	return {
		chapterIndex: input.chapterIndex,
		title: input.title.trim(),
		html: sanitized.html,
		htmlHash: computeHtmlHash(sanitized.html),
		htmlBlocks,
		htmlBlocksVersion: HTML_BLOCKS_VERSION,
		generatedAt: input.generatedAt ?? new Date().toISOString(),
		updatedAt: input.updatedAt,
	};
}

export function parseUpdateDidacticUnitChapterInput(
	body: unknown,
): UpdateDidacticUnitChapterInput {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}

	const payload = body as {chapter?: unknown};

	if (!payload.chapter || typeof payload.chapter !== "object") {
		throw new Error("Chapter is required.");
	}

	const chapterPayload = payload.chapter as {
		title?: unknown;
		html?: unknown;
		htmlHash?: unknown;
	};

	return {
		chapter: {
			title: parseNonEmptyString(chapterPayload.title, "chapter.title"),
			html: parseNonEmptyString(chapterPayload.html, "chapter.html"),
			htmlHash:
				typeof chapterPayload.htmlHash === "string" ?
					chapterPayload.htmlHash.trim()
				:	undefined,
		},
	};
}

export function createDidacticUnitChapterRevision(input: {
	chapterIndex: number;
	source: DidacticUnitChapterRevisionSource;
	chapter: DidacticUnitGeneratedChapter;
}): DidacticUnitChapterRevision {
	return {
		id: randomUUID(),
		chapterIndex: input.chapterIndex,
		source: input.source,
		chapter: {...input.chapter},
		createdAt: input.chapter.updatedAt ?? input.chapter.generatedAt,
	};
}
