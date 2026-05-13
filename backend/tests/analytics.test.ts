import request from "supertest";
import {describe, expect, it} from "vitest";
import type {DidacticUnit} from "../src/didactic-unit/create-didactic-unit.js";
import {
	InMemoryDidacticUnitStore,
} from "../src/didactic-unit/didactic-unit-store.js";
import {
	InMemoryFolderStore,
} from "../src/folders/folder-store.js";
import type {GenerationRun} from "../src/generation-runs/generation-run-store.js";
import {
	InMemoryGenerationRunStore,
} from "../src/generation-runs/generation-run-store.js";
import {createTestApp} from "./helpers/create-test-app.js";

const ownerId = "mock-user";

function isoDaysAgo(days: number): string {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() - days);
	return date.toISOString();
}

function createAnalyticsUnit(input: {
	id: string;
	folderId: string;
	readBlocks: number;
	totalBlocks: number;
	createdAt?: string;
	ownerId?: string;
}): DidacticUnit {
	const createdAt = input.createdAt ?? isoDaysAgo(1);
	const htmlBlocks = Array.from({length: input.totalBlocks}, (_, index) => ({
		id: `${input.id}-block-${index}`,
		type: "paragraph" as const,
		html: `<p>Block ${index}</p>`,
		textLength: 12,
		textStartOffset: index * 12,
		textEndOffset: index * 12 + 12,
	}));

	return {
		id: input.id,
		ownerId: input.ownerId ?? ownerId,
		title: input.id,
		topic: input.id,
		provider: "deepseek",
		status: "content_generation_completed",
		nextAction: "view_didactic_unit",
		overview: "",
		learningGoals: [],
		keywords: [],
		level: "beginner",
		modules: [],
		chapters: [
			{
				title: "Module 1",
				overview: "Overview",
				keyPoints: [],
				lessons: [],
			},
		],
		depth: "basic",
		length: "intro",
		questionnaireEnabled: false,
		folderId: input.folderId,
		folderAssignmentMode: "manual",
		generatedChapters:
			input.totalBlocks > 0 ?
				[
					{
						chapterIndex: 0,
						title: "Module 1",
						html: "<p>Generated</p>",
						htmlHash: "hash",
						htmlBlocks,
						htmlBlocksVersion: 1,
						generatedAt: createdAt,
					},
				]
			:	[],
		moduleReadProgress:
			input.totalBlocks > 0 && input.readBlocks > 0 ?
				[
					{
						moduleIndex: 0,
						furthestReadBlockIndex: Math.min(
							input.readBlocks - 1,
							input.totalBlocks - 1,
						),
						furthestReadBlocksVersion: 1,
						recordedTotalBlocks: input.totalBlocks,
						chapterCompleted: input.readBlocks >= input.totalBlocks,
						lastReadAt: createdAt,
					},
				]
			:	[],
		createdAt,
		updatedAt: createdAt,
	};
}

function createRun(input: {
	id: string;
	model: string;
	status?: GenerationRun["status"];
	stage?: GenerationRun["stage"];
	createdAt?: string;
	ownerId?: string;
}): GenerationRun {
	const createdAt = input.createdAt ?? isoDaysAgo(1);
	const base = {
		id: input.id,
		didacticUnitId: "unit-1",
		ownerId: input.ownerId ?? ownerId,
		provider: input.model.split("/")[0] ?? "openai",
		model: input.model.split("/").slice(1).join("/") || input.model,
		prompt: "Generate content.",
		status: input.status ?? "completed",
		createdAt,
		updatedAt: createdAt,
	};

	if (input.stage === "syllabus") {
		return {
			...base,
			stage: "syllabus",
			syllabus: {
				title: "Syllabus",
				overview: "",
				learningGoals: [],
				chapters: [],
				keywords: [],
			},
		};
	}

	return {
		...base,
		stage: "chapter",
		chapterIndex: 0,
		completedAt: createdAt,
	};
}

describe("usage analytics", () => {
	it("returns empty real-data metrics for a new user", async () => {
		const app = createTestApp();

		const response = await request(app).get("/api/analytics/usage");

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			period: "30d",
			unitsCreated: 0,
			aiGenerations: 0,
			completionRate: 0,
			readBlockCount: 0,
			totalBlockCount: 0,
			favoriteModel: null,
			favoriteTopic: null,
		});
		expect(response.body.chart).toHaveLength(30);
		expect(response.body.chart.every((bucket: {count: number}) => bucket.count === 0)).toBe(
			true,
		);
	});

	it("aggregates real units, completed runs, favorites, and chart buckets", async () => {
		const didacticUnitStore = new InMemoryDidacticUnitStore();
		const folderStore = new InMemoryFolderStore();
		const generationRunStore = new InMemoryGenerationRunStore();
		const science = await folderStore.create({
			ownerId,
			name: "Computer Science",
			slug: "computer-science",
			kind: "custom",
			icon: "💻",
			color: "#3B82F6",
		});
		const games = await folderStore.create({
			ownerId,
			name: "Videogames",
			slug: "videogames",
			kind: "custom",
			icon: "🕹️",
			color: "#A855F7",
		});

		await didacticUnitStore.save(
			createAnalyticsUnit({
				id: "unit-1",
				folderId: science.id,
				readBlocks: 3,
				totalBlocks: 4,
			}),
		);
		await didacticUnitStore.save(
			createAnalyticsUnit({
				id: "unit-2",
				folderId: science.id,
				readBlocks: 1,
				totalBlocks: 4,
			}),
		);
		await didacticUnitStore.save(
			createAnalyticsUnit({
				id: "unit-3",
				folderId: games.id,
				readBlocks: 0,
				totalBlocks: 2,
			}),
		);
		await didacticUnitStore.save(
			createAnalyticsUnit({
				id: "other-owner-unit",
				folderId: games.id,
				readBlocks: 2,
				totalBlocks: 2,
				ownerId: "other-owner",
			}),
		);

		await generationRunStore.save(
			createRun({
				id: "run-1",
				model: "anthropic/claude-sonnet-4-6",
				createdAt: isoDaysAgo(1),
			}),
		);
		await generationRunStore.save(
			createRun({
				id: "run-2",
				model: "anthropic/claude-sonnet-4-6",
				stage: "syllabus",
				createdAt: isoDaysAgo(2),
			}),
		);
		await generationRunStore.save(
			createRun({
				id: "run-3",
				model: "openai/gpt-5.5",
				createdAt: isoDaysAgo(3),
			}),
		);
		await generationRunStore.save(
			createRun({
				id: "failed-run",
				model: "openai/gpt-5.5",
				status: "failed",
				createdAt: isoDaysAgo(1),
			}),
		);
		await generationRunStore.save(
			createRun({
				id: "other-owner-run",
				model: "openai/gpt-5.5",
				ownerId: "other-owner",
				createdAt: isoDaysAgo(1),
			}),
		);

		const app = createTestApp({
			didacticUnitStore,
			folderStore,
			generationRunStore,
		});

		const response = await request(app).get("/api/analytics/usage?period=7d");

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({
			period: "7d",
			unitsCreated: 3,
			aiGenerations: 3,
			completionRate: 40,
			readBlockCount: 4,
			totalBlockCount: 10,
			favoriteModel: {
				provider: "anthropic",
				model: "claude-sonnet-4-6",
				label: "Claude Sonnet 4.6",
				count: 2,
			},
			favoriteTopic: {
				id: science.id,
				name: "Computer Science",
				unitCount: 2,
			},
		});
		expect(response.body.chart).toHaveLength(7);
		expect(
			response.body.chart.reduce(
				(total: number, bucket: {count: number}) => total + bucket.count,
				0,
			),
		).toBe(3);
	});

	it("validates analytics periods", async () => {
		const app = createTestApp();

		const response = await request(app).get(
			"/api/analytics/usage?period=forever",
		);

		expect(response.status).toBe(400);
		expect(response.body.error).toBe("Invalid analytics period.");
	});
});
