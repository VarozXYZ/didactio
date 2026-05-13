import {randomUUID} from "node:crypto";
import type {
	DidacticUnitGeneratedChapter,
	HtmlContentBlock,
} from "../didactic-unit/didactic-unit-chapter.js";
import type {DidacticUnitSyllabus} from "../didactic-unit/planning.js";
import type {AiCallTelemetry} from "../ai/telemetry.js";

export type GenerationRunStage = "syllabus" | "chapter";
export type GenerationRunStatus =
	| "payment_pending"
	| "queued"
	| "running"
	| "retrying"
	| "completed"
	| "failed"
	| "payment_failed";

interface GenerationRunBase {
	id: string;
	didacticUnitId: string;
	ownerId: string;
	provider: string;
	model: string;
	prompt: string;
	status: GenerationRunStatus;
	createdAt: string;
	updatedAt?: string;
	rawOutput?: string;
	error?: string;
	errorMessage?: string;
	telemetry?: AiCallTelemetry;
}

export interface SyllabusGenerationRunRecord extends GenerationRunBase {
	stage: "syllabus";
	syllabus?: DidacticUnitSyllabus;
}

export interface ChapterGenerationRunRecord extends GenerationRunBase {
	stage: "chapter";
	chapterIndex: number;
	unitId?: string;
	userId?: string;
	attempts?: number;
	coinTxId?: string;
	refundTxId?: string;
	emittedBlocks?: HtmlContentBlock[];
	finalHtml?: string;
	finalHash?: string;
	htmlBlocksVersion?: number;
	completedAt?: string;
	chapter?: DidacticUnitGeneratedChapter;
}

export type GenerationRun =
	| SyllabusGenerationRunRecord
	| ChapterGenerationRunRecord;

export interface GenerationRunStore {
	save(run: GenerationRun): Promise<void>;
	getById(ownerId: string, id: string): Promise<GenerationRun | null>;
	listByOwner(ownerId: string): Promise<GenerationRun[]>;
	findActiveChapterRun(
		ownerId: string,
		didacticUnitId: string,
		chapterIndex: number,
	): Promise<ChapterGenerationRunRecord | null>;
	listByDidacticUnit(
		ownerId: string,
		didacticUnitId: string,
	): Promise<GenerationRun[]>;
}

export class InMemoryGenerationRunStore implements GenerationRunStore {
	private readonly runsById = new Map<string, GenerationRun>();

	async save(run: GenerationRun): Promise<void> {
		this.runsById.set(run.id, run);
	}

	async getById(ownerId: string, id: string): Promise<GenerationRun | null> {
		const run = this.runsById.get(id);
		return run?.ownerId === ownerId ? run : null;
	}

	async listByOwner(ownerId: string): Promise<GenerationRun[]> {
		return [...this.runsById.values()]
			.filter((run) => run.ownerId === ownerId)
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	}

	async findActiveChapterRun(
		ownerId: string,
		didacticUnitId: string,
		chapterIndex: number,
	): Promise<ChapterGenerationRunRecord | null> {
		const activeStatuses = new Set<GenerationRunStatus>([
			"payment_pending",
			"queued",
			"running",
			"retrying",
		]);
		const runs = [...this.runsById.values()]
			.filter(
				(run): run is ChapterGenerationRunRecord =>
					run.ownerId === ownerId &&
					run.didacticUnitId === didacticUnitId &&
					run.stage === "chapter" &&
					run.chapterIndex === chapterIndex &&
					activeStatuses.has(run.status),
			)
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
		return runs[0] ?? null;
	}

	async listByDidacticUnit(
		ownerId: string,
		didacticUnitId: string,
	): Promise<GenerationRun[]> {
		return [...this.runsById.values()]
			.filter(
				(run) =>
					run.ownerId === ownerId &&
					run.didacticUnitId === didacticUnitId,
			)
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	}
}

interface CreateCompletedSyllabusGenerationRunInput {
	didacticUnitId: string;
	ownerId: string;
	provider: string;
	model: string;
	prompt: string;
	syllabus: DidacticUnitSyllabus;
	createdAt: string;
	telemetry?: AiCallTelemetry;
}

interface CreateFailedSyllabusGenerationRunInput {
	didacticUnitId: string;
	ownerId: string;
	provider: string;
	model: string;
	prompt: string;
	rawOutput?: string;
	error: string;
	createdAt: string;
	telemetry?: AiCallTelemetry;
}

interface CreateCompletedChapterGenerationRunInput {
	didacticUnitId: string;
	ownerId: string;
	chapterIndex: number;
	provider: string;
	model: string;
	prompt: string;
	chapter: DidacticUnitGeneratedChapter;
	createdAt: string;
	rawOutput?: string;
	telemetry?: AiCallTelemetry;
}

interface CreateFailedChapterGenerationRunInput {
	didacticUnitId: string;
	ownerId: string;
	chapterIndex: number;
	provider: string;
	model: string;
	prompt: string;
	rawOutput?: string;
	error: string;
	createdAt: string;
	telemetry?: AiCallTelemetry;
}

export function createCompletedSyllabusGenerationRunRecord(
	input: CreateCompletedSyllabusGenerationRunInput,
): SyllabusGenerationRunRecord {
	return {
		id: randomUUID(),
		stage: "syllabus",
		didacticUnitId: input.didacticUnitId,
		ownerId: input.ownerId,
		provider: input.provider,
		model: input.model,
		prompt: input.prompt,
		syllabus: input.syllabus,
		status: "completed",
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		telemetry: input.telemetry,
	};
}

export function createFailedSyllabusGenerationRunRecord(
	input: CreateFailedSyllabusGenerationRunInput,
): SyllabusGenerationRunRecord {
	return {
		id: randomUUID(),
		stage: "syllabus",
		didacticUnitId: input.didacticUnitId,
		ownerId: input.ownerId,
		provider: input.provider,
		model: input.model,
		prompt: input.prompt,
		rawOutput: input.rawOutput,
		error: input.error,
		errorMessage: input.error,
		status: "failed",
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		telemetry: input.telemetry,
	};
}

export function createCompletedChapterGenerationRunRecord(
	input: CreateCompletedChapterGenerationRunInput,
): ChapterGenerationRunRecord {
	return {
		id: randomUUID(),
		stage: "chapter",
		didacticUnitId: input.didacticUnitId,
		ownerId: input.ownerId,
		chapterIndex: input.chapterIndex,
		unitId: input.didacticUnitId,
		userId: input.ownerId,
		provider: input.provider,
		model: input.model,
		prompt: input.prompt,
		chapter: input.chapter,
		emittedBlocks: input.chapter.htmlBlocks,
		finalHtml: input.chapter.html,
		finalHash: input.chapter.htmlHash,
		htmlBlocksVersion: input.chapter.htmlBlocksVersion,
		rawOutput: input.rawOutput,
		status: "completed",
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		completedAt: input.createdAt,
		telemetry: input.telemetry,
	};
}

export function createFailedChapterGenerationRunRecord(
	input: CreateFailedChapterGenerationRunInput,
): ChapterGenerationRunRecord {
	return {
		id: randomUUID(),
		stage: "chapter",
		didacticUnitId: input.didacticUnitId,
		ownerId: input.ownerId,
		chapterIndex: input.chapterIndex,
		unitId: input.didacticUnitId,
		userId: input.ownerId,
		provider: input.provider,
		model: input.model,
		prompt: input.prompt,
		rawOutput: input.rawOutput,
		error: input.error,
		errorMessage: input.error,
		status: "failed",
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
		telemetry: input.telemetry,
	};
}

export function createQueuedChapterGenerationRunRecord(input: {
	didacticUnitId: string;
	ownerId: string;
	chapterIndex: number;
	provider: string;
	model: string;
	prompt?: string;
	coinTxId?: string;
}): ChapterGenerationRunRecord {
	const now = new Date().toISOString();
	return {
		id: randomUUID(),
		stage: "chapter",
		didacticUnitId: input.didacticUnitId,
		unitId: input.didacticUnitId,
		ownerId: input.ownerId,
		userId: input.ownerId,
		chapterIndex: input.chapterIndex,
		provider: input.provider,
		model: input.model,
		prompt: input.prompt ?? "",
		status: "queued",
		attempts: 0,
		coinTxId: input.coinTxId,
		emittedBlocks: [],
		createdAt: now,
		updatedAt: now,
	};
}
