import {describe, expect, it} from "vitest";
import {createCanonicalDidacticUnitChapter} from "../src/didactic-unit/chapter.js";
import {
	createCompletedActivityFeedbackRunRecord,
	createCompletedActivityGenerationRunRecord,
	createCompletedChapterGenerationRunRecord,
	createCompletedSyllabusGenerationRunRecord,
	createFailedActivityGenerationRunRecord,
	createFailedChapterGenerationRunRecord,
	createFailedSyllabusGenerationRunRecord,
	createQueuedChapterGenerationRunRecord,
	InMemoryGenerationRunStore,
} from "../src/generation-runs/generation-run-store.js";

const common = {
	didacticUnitId: "unit",
	ownerId: "owner",
	provider: "mock",
	model: "model",
	prompt: "prompt",
	createdAt: "2026-01-01T00:00:00Z",
};

describe("generation run records", () => {
	it("creates success, failure, activity, and feedback records", () => {
		const chapter = createCanonicalDidacticUnitChapter({
			chapterId: "unit:0",
			chapterIndex: 0,
			title: "One",
			rawHtml: "<p>Content</p>",
		});
		const syllabus = createCompletedSyllabusGenerationRunRecord({
			...common,
			syllabus: {title: "Course", overview: "Overview", learningGoals: [], chapters: [], keywords: []},
		});
		const failedSyllabus = createFailedSyllabusGenerationRunRecord({...common, error: "failed", rawOutput: "bad"});
		const completedChapter = createCompletedChapterGenerationRunRecord({...common, chapterIndex: 0, chapter});
		const failedChapter = createFailedChapterGenerationRunRecord({...common, chapterIndex: 0, error: "failed"});
		const activity = createCompletedActivityGenerationRunRecord({...common, chapterIndex: 0, activityId: "activity", activityType: "quiz", scope: "module"});
		const failedActivity = createFailedActivityGenerationRunRecord({...common, chapterIndex: 0, activityType: "quiz", scope: "module", error: "failed"});
		const feedback = createCompletedActivityFeedbackRunRecord({...common, chapterIndex: 0, activityId: "activity", attemptId: "attempt"});

		expect([syllabus, completedChapter, activity, feedback].every((run) => run.status === "completed")).toBe(true);
		expect([failedSyllabus, failedChapter, failedActivity].every((run) => run.status === "failed")).toBe(true);
		expect(completedChapter.finalHtml).toContain("Content");
	});

	it("finds active runs and keeps owner scoping in memory", async () => {
		const store = new InMemoryGenerationRunStore();
		const active = createQueuedChapterGenerationRunRecord({...common, chapterIndex: 0});
		const other = createQueuedChapterGenerationRunRecord({...common, ownerId: "other", chapterIndex: 0});
		await store.save(active);
		await store.save(other);
		expect(await store.getById("owner", active.id)).toEqual(active);
		expect(await store.getById("other", active.id)).toBeNull();
		expect(await store.findActiveChapterRun("owner", "unit", 0)).toEqual(active);
		expect(await store.listByOwner("owner")).toEqual([active]);
		expect(await store.listByDidacticUnit("owner", "unit")).toEqual([active]);
	});
});
