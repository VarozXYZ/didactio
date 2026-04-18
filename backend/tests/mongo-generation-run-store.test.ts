import {describe, expect, it, vi} from "vitest";
import {MongoGenerationRunStore} from "../src/generation-runs/mongo-generation-run-store.js";
import type {GenerationRun} from "../src/generation-runs/generation-run-store.js";

function createStoredRuns(): GenerationRun[] {
	return [
		{
			id: "run-2",
			stage: "chapter",
			didacticUnitId: "didactic-unit-1",
			ownerId: "mock-user",
			chapterIndex: 0,
			provider: "deepseek",
			model: "deepseek-chat",
			prompt: "Generate one chapter for next.js framework.",
			chapter: {
				chapterIndex: 0,
				title: "Foundations",
				markdown: "Detailed content.",
				generatedAt: "2026-03-12T00:01:00.000Z",
			},
			status: "completed",
			createdAt: "2026-03-12T00:01:00.000Z",
		},
		{
			id: "run-1",
			stage: "syllabus",
			didacticUnitId: "didactic-unit-1",
			ownerId: "mock-user",
			provider: "openai",
			model: "gpt-4o-mini",
			prompt: "Generate a syllabus for next.js framework.",
			syllabus: {
				title: "Next.js Learning Path",
				overview: "A focused syllabus.",
				learningGoals: ["Understand routing"],
				chapters: [
					{
						title: "Foundations",
						overview: "Learn the basics.",
						keyPoints: ["Routing"],
					},
				],
			},
			status: "completed",
			createdAt: "2026-03-12T00:00:00.000Z",
		},
	];
}

describe("MongoGenerationRunStore", () => {
	it("saves and lists generation runs through the didactic-unit collection key", async () => {
		const runs = createStoredRuns();
		const updateOne = vi.fn().mockResolvedValue(undefined);
		const toArray = vi
			.fn()
			.mockResolvedValue(
				runs.map((run, index) => ({...run, _id: index})),
			);
		const sort = vi.fn().mockReturnValue({toArray});
		const find = vi.fn().mockReturnValue({sort});
		const collection = {
			updateOne,
			find,
		};
		const database = {
			collection: vi.fn().mockReturnValue(collection),
		};

		const store = new MongoGenerationRunStore(database as never);

		await store.save(runs[0]!);
		const storedRuns = await store.listByDidacticUnit(
			"mock-user",
			"didactic-unit-1",
		);

		expect(updateOne).toHaveBeenCalledWith(
			{id: runs[0]!.id},
			{$set: runs[0]},
			{upsert: true},
		);
		expect(find).toHaveBeenCalledWith({
			ownerId: "mock-user",
			didacticUnitId: "didactic-unit-1",
		});
		expect(sort).toHaveBeenCalledWith({createdAt: -1});
		expect(storedRuns).toEqual(runs);
	});
});
