import {describe, expect, it, vi} from "vitest";
import {resetUserOnboarding} from "../src/auth/reset-onboarding.js";
import type {DidacticUnit} from "../src/didactic-unit/didactic-unit.js";
import {createDefaultDidacticUnitTemplate} from "../src/didactic-unit/export-default-template.js";
import type {GenerationRun} from "../src/generation-runs/generation-run-store.js";

function createSourceUnit(): DidacticUnit {
	return {
		_id: "mongo-id",
		id: "source-unit",
		ownerId: "source-owner",
		title: "Template",
		topic: "Template",
		provider: "openai",
		status: "content_generation_completed",
		nextAction: "view_didactic_unit",
		overview: "",
		learningGoals: [],
		keywords: [],
		level: "beginner",
		modules: [],
		chapters: [],
		depth: "basic",
		length: "intro",
		questionnaireEnabled: false,
		folderId: "source-folder",
		folderAssignmentMode: "manual",
		moduleReadProgress: [],
		completedChapters: [],
		unitGenerationPaidAt: "2026-01-01T00:00:00.000Z",
		unitGenerationCreditTransactionId: "credit-tx",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	} as DidacticUnit & {_id: string};
}

function createRun(input: {
	id: string;
	stage: "syllabus" | "chapter";
	provider: string;
	model: string;
	createdAt: string;
}): GenerationRun {
	return {
		...input,
		didacticUnitId: "source-unit",
		ownerId: "source-owner",
		prompt: "",
		status: "completed",
		...(input.stage === "chapter" ? {chapterIndex: 0} : {}),
	} as GenerationRun;
}

describe("maintenance operations", () => {
	it("creates a clean default template with displayed chapter model attribution", () => {
		const template = createDefaultDidacticUnitTemplate(createSourceUnit(), [
			createRun({
				id: "syllabus",
				stage: "syllabus",
				provider: "deepseek",
				model: "deepseek-v4-flash",
				createdAt: "2026-05-01T00:00:00.000Z",
			}),
			createRun({
				id: "chapter",
				stage: "chapter",
				provider: "openai",
				model: "gpt-5.5",
				createdAt: "2026-05-02T00:00:00.000Z",
			}),
		]);

		expect(template.modelAttribution).toEqual({
			provider: "openai",
			model: "gpt-5.5",
		});
		expect(template).not.toHaveProperty("_id");
		expect(template).not.toHaveProperty("ownerId");
		expect(template).not.toHaveProperty("folderId");
		expect(template).not.toHaveProperty("moduleReadProgress");
		expect(template).not.toHaveProperty("unitGenerationCreditTransactionId");
	});

	it("resets onboarding through the supplied configured database", async () => {
		const updateOne = vi.fn().mockResolvedValue({
			matchedCount: 1,
			modifiedCount: 1,
		});
		const database = {
			collection: vi.fn().mockReturnValue({updateOne}),
		};

		const result = await resetUserOnboarding(database as never, " USER@Example.com ");

		expect(updateOne).toHaveBeenCalledWith(
			{email: "user@example.com"},
			{$unset: {onboardingCompletedAt: ""}},
		);
		expect(result).toEqual({found: true, modified: true});
	});
});
