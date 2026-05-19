import {randomUUID} from "node:crypto";
import {isGenerationQuality, type GenerationQuality} from "../credits/generation-pricing.js";

export type DidacticUnitNoteSource = "manual" | "ai";

export interface DidacticUnitNoteAnchor {
	startBlockId: string;
	startOffset: number;
	endBlockId: string;
	endOffset: number;
	htmlHash?: string;
	htmlBlocksVersion: number;
	contextBefore?: string;
	contextAfter?: string;
}

export interface DidacticUnitNote {
	id: string;
	ownerId: string;
	didacticUnitId: string;
	chapterIndex: number;
	source: DidacticUnitNoteSource;
	selectedText: string;
	question?: string;
	content: string;
	quality?: GenerationQuality;
	anchor: DidacticUnitNoteAnchor;
	createdAt: string;
	updatedAt: string;
}

export interface CreateManualDidacticUnitNoteInput {
	chapterIndex: number;
	selectedText: string;
	content: string;
	anchor: DidacticUnitNoteAnchor;
}

export interface GenerateDidacticUnitNoteInput {
	chapterIndex: number;
	selectedText: string;
	question?: string;
	quality?: GenerationQuality;
	anchor: DidacticUnitNoteAnchor;
}

export interface UpdateDidacticUnitNoteInput {
	question?: string;
	content?: string;
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
	const parsed = typeof value === "string" ? value.trim() : "";
	if (!parsed) {
		throw new Error(`${fieldName} is required.`);
	}
	return parsed;
}

function parseOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseNonNegativeInteger(value: unknown, fieldName: string): number {
	if (!Number.isInteger(value) || Number(value) < 0) {
		throw new Error(`${fieldName} must be a non-negative integer.`);
	}
	return Number(value);
}

function parseAnchor(value: unknown): DidacticUnitNoteAnchor {
	if (!value || typeof value !== "object") {
		throw new Error("anchor is required.");
	}

	const payload = value as Record<string, unknown>;
	const startOffset = parseNonNegativeInteger(payload.startOffset, "anchor.startOffset");
	const endOffset = parseNonNegativeInteger(payload.endOffset, "anchor.endOffset");
	if (payload.startBlockId === payload.endBlockId && endOffset <= startOffset) {
		throw new Error("anchor.endOffset must be greater than anchor.startOffset.");
	}

	return {
		startBlockId: parseNonEmptyString(payload.startBlockId, "anchor.startBlockId"),
		startOffset,
		endBlockId: parseNonEmptyString(payload.endBlockId, "anchor.endBlockId"),
		endOffset,
		htmlHash: parseOptionalString(payload.htmlHash),
		htmlBlocksVersion: parseNonNegativeInteger(
			payload.htmlBlocksVersion,
			"anchor.htmlBlocksVersion",
		),
		contextBefore: parseOptionalString(payload.contextBefore),
		contextAfter: parseOptionalString(payload.contextAfter),
	};
}

function parseChapterIndex(value: unknown): number {
	return parseNonNegativeInteger(value, "chapterIndex");
}

export function parseCreateManualDidacticUnitNoteInput(
	body: unknown,
): CreateManualDidacticUnitNoteInput {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}
	const payload = body as Record<string, unknown>;
	return {
		chapterIndex: parseChapterIndex(payload.chapterIndex),
		selectedText: parseNonEmptyString(payload.selectedText, "selectedText"),
		content: parseNonEmptyString(payload.content, "content"),
		anchor: parseAnchor(payload.anchor),
	};
}

export function parseGenerateDidacticUnitNoteInput(
	body: unknown,
): GenerateDidacticUnitNoteInput {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}
	const payload = body as Record<string, unknown>;
	const quality = payload.quality ?? "silver";
	if (!isGenerationQuality(quality)) {
		throw new Error('quality must be either "silver" or "gold".');
	}
	return {
		chapterIndex: parseChapterIndex(payload.chapterIndex),
		selectedText: parseNonEmptyString(payload.selectedText, "selectedText"),
		question: parseOptionalString(payload.question),
		quality,
		anchor: parseAnchor(payload.anchor),
	};
}

export function parseUpdateDidacticUnitNoteInput(
	body: unknown,
): UpdateDidacticUnitNoteInput {
	if (!body || typeof body !== "object") {
		throw new Error("Request body must be a JSON object.");
	}
	const payload = body as Record<string, unknown>;
	const patch: UpdateDidacticUnitNoteInput = {};
	if ("question" in payload) {
		patch.question = parseOptionalString(payload.question) ?? "";
	}
	if ("content" in payload) {
		patch.content = parseNonEmptyString(payload.content, "content");
	}
	if (!("question" in patch) && !("content" in patch)) {
		throw new Error("At least one note field is required.");
	}
	return patch;
}

export function createDidacticUnitNote(input: {
	ownerId: string;
	didacticUnitId: string;
	chapterIndex: number;
	source: DidacticUnitNoteSource;
	selectedText: string;
	content: string;
	question?: string;
	quality?: GenerationQuality;
	anchor: DidacticUnitNoteAnchor;
	now?: string;
}): DidacticUnitNote {
	const now = input.now ?? new Date().toISOString();
	return {
		id: randomUUID(),
		ownerId: input.ownerId,
		didacticUnitId: input.didacticUnitId,
		chapterIndex: input.chapterIndex,
		source: input.source,
		selectedText: input.selectedText.trim(),
		question: input.question?.trim() || undefined,
		content: input.content.trim(),
		quality: input.quality,
		anchor: input.anchor,
		createdAt: now,
		updatedAt: now,
	};
}
