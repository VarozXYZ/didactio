import {randomUUID} from "node:crypto";
import type {DidacticUnitGeneratedChapter} from "../didactic-unit/didactic-unit-chapter.js";
import type {DidacticUnitSyllabus} from "../didactic-unit/planning.js";
import type {AiCallTelemetry} from "../ai/telemetry.js";

export type GenerationRunStage = "syllabus" | "chapter";
export type GenerationRunStatus = "completed" | "failed";

interface GenerationRunBase {
	id: string;
	didacticUnitId: string;
	ownerId: string;
	provider: string;
	model: string;
	prompt: string;
	status: GenerationRunStatus;
	createdAt: string;
	rawOutput?: string;
	error?: string;
	telemetry?: AiCallTelemetry;
}

export interface SyllabusGenerationRunRecord extends GenerationRunBase {
	stage: "syllabus";
	syllabus?: DidacticUnitSyllabus;
}

export interface ChapterGenerationRunRecord extends GenerationRunBase {
	stage: "chapter";
	chapterIndex: number;
	chapter?: DidacticUnitGeneratedChapter;
}

export type GenerationRun =
	| SyllabusGenerationRunRecord
	| ChapterGenerationRunRecord;

export interface GenerationRunStore {
	save(run: GenerationRun): Promise<void>;
	listByDidacticUnit(
		ownerId: string,
		didacticUnitId: string,
	): Promise<GenerationRun[]>;
}

export class InMemoryGenerationRunStore implements GenerationRunStore {
	private readonly runs = new Map<string, GenerationRun[]>();

	async save(run: GenerationRun): Promise<void> {
		const didacticUnitRuns = this.runs.get(run.didacticUnitId) ?? [];
		didacticUnitRuns.unshift(run);
		this.runs.set(run.didacticUnitId, didacticUnitRuns);
	}

	async listByDidacticUnit(
		ownerId: string,
		didacticUnitId: string,
	): Promise<GenerationRun[]> {
		return (this.runs.get(didacticUnitId) ?? []).filter(
			(run) => run.ownerId === ownerId,
		);
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
		status: "failed",
		createdAt: input.createdAt,
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
		provider: input.provider,
		model: input.model,
		prompt: input.prompt,
		chapter: input.chapter,
		rawOutput: input.rawOutput,
		status: "completed",
		createdAt: input.createdAt,
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
		provider: input.provider,
		model: input.model,
		prompt: input.prompt,
		rawOutput: input.rawOutput,
		error: input.error,
		status: "failed",
		createdAt: input.createdAt,
		telemetry: input.telemetry,
	};
}
