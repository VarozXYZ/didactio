import {describe, expect, it} from "vitest";
import {
	buildActivitiesHtmlDocument,
	sanitizeExportFilename,
	sanitizeStaticHtml,
	type ExportActivity,
	type UnitExportSnapshot,
} from "@/dashboard/export/unitExport";

function createActivity(
	id: string,
	type: ExportActivity["type"],
	content: Record<string, unknown>,
): ExportActivity {
	return {
		id,
		ownerId: "user-1",
		didacticUnitId: "unit-1",
		chapterIndex: 0,
		scope: "current_module",
		type,
		quality: "silver",
		title: `${type} activity`,
		instructions: "Complete it.",
		content,
		dedupeSummary: type,
		sourceModuleIndexes: [0],
		feedbackAttemptLimit: 3,
		createdAt: "2026-05-17T09:00:00.000Z",
		updatedAt: "2026-05-17T09:00:00.000Z",
	};
}

function createSnapshot(): UnitExportSnapshot {
	return {
		exportedAt: "2026-05-17T10:00:00.000Z",
		skippedModules: [],
		unit: {
			id: "unit-1",
			ownerId: "user-1",
			topic: "Testing exports",
			title: "Testing Exports",
			folderId: "folder-1",
			folderAssignmentMode: "manual",
			folder: {
				id: "folder-1",
				name: "General",
				slug: "general",
				icon: "book",
				color: "#15803D",
				kind: "default",
			},
			presentationTheme: null,
			provider: "mock",
			status: "content_generation_completed",
			nextAction: "open_editor",
			createdAt: "2026-05-17T09:00:00.000Z",
			updatedAt: "2026-05-17T09:30:00.000Z",
			level: "beginner",
			depth: "basic",
			length: "short",
			questionnaireEnabled: false,
			overview: "A unit for testing export helpers.",
			learningGoals: [],
			chapters: [
				{
					title: "Module one",
					overview: "Overview",
					keyPoints: [],
				},
			],
			studyProgress: {
				moduleCount: 1,
				readBlockCount: 1,
				totalBlockCount: 1,
				studyProgressPercent: 100,
			},
		},
		modules: [
			{
				chapterIndex: 0,
				title: "Module one",
				overview: "Overview",
				html: "<p>Theory</p>",
				state: "ready",
				activities: [
					{
						id: "mc",
						ownerId: "user-1",
						didacticUnitId: "unit-1",
						chapterIndex: 0,
						scope: "current_module",
						type: "multiple_choice",
						quality: "silver",
						title: "Quiz",
						instructions: "Choose one.",
						content: {
							questions: [
								{
									id: "q1",
									prompt: "Pick A",
									options: [
										{id: "a", text: "A"},
										{id: "b", text: "B"},
									],
									correctOptionId: "a",
									explanation: "A is correct.",
								},
							],
						},
						dedupeSummary: "quiz",
						sourceModuleIndexes: [0],
						feedbackAttemptLimit: 3,
						createdAt: "2026-05-17T09:00:00.000Z",
						updatedAt: "2026-05-17T09:00:00.000Z",
					},
					{
						id: "freeform",
						ownerId: "user-1",
						didacticUnitId: "unit-1",
						chapterIndex: 0,
						scope: "current_module",
						type: "freeform_html",
						quality: "silver",
						title: "Custom",
						instructions: "Read.",
						content: {
							html: '<section onclick="alert(1)">Safe</section><script>alert(2)</script>',
						},
						dedupeSummary: "custom",
						sourceModuleIndexes: [0],
						feedbackAttemptLimit: 3,
						createdAt: "2026-05-17T09:00:00.000Z",
						updatedAt: "2026-05-17T09:00:00.000Z",
					},
				],
			},
		],
	};
}

describe("unit export helpers", () => {
	it("creates a safe activities filename", () => {
		expect(sanitizeExportFilename("Álgebra: Unit / 01?")).toBe(
			"unidad-algebra-unit-01-actividades.html",
		);
	});

	it("renders type tabs and keeps explanations next to each activity", () => {
		const html = buildActivitiesHtmlDocument(createSnapshot());

		expect(html).toContain("Quiz");
		expect(html).toContain("Pick A");
		expect(html).toContain("Check answers");
		expect(html).toContain('class="tabs"');
		expect(html).toContain('class="tab-panel is-active"');
		expect(html).toContain("<summary>Explanation / rubric</summary>");
		expect(html.indexOf("Pick A")).toBeLessThan(html.indexOf("A is correct."));
		expect(html).toContain("A is correct.");
	});

	it("maps every activity type to offline HTML", () => {
		const snapshot = createSnapshot();
		snapshot.modules[0].activities = [
			createActivity("mc", "multiple_choice", {
				questions: [
					{
						id: "q1",
						prompt: "Choose",
						options: [{id: "a", text: "A"}],
						correctOptionId: "a",
					},
				],
			}),
			createActivity("short", "short_answer", {
				prompts: [
					{
						id: "p1",
						prompt: "Explain",
						expectedAnswer: "Expected",
						rubric: ["Clear"],
					},
				],
			}),
			createActivity("code", "coding_practice", {
				prompt: "Write code",
				starterCode: "const x = 1;",
				expectedOutcome: "Runs",
				rubric: ["Correct"],
			}),
			createActivity("cards", "flashcards", {
				cards: [{front: "Front", back: "Back"}],
			}),
			createActivity("match", "matching", {
				pairs: [{left: "Term", right: "Definition"}],
			}),
			createActivity("order", "ordering", {
				items: [{text: "First", correctOrder: 1}],
			}),
			createActivity("case", "case_study", {
				scenario: "Scenario",
				problem: "Problem",
				rubric: ["Analysis"],
			}),
			createActivity("debate", "debate_reflection", {
				prompt: "Debate",
				positions: ["For", "Against"],
				reflectionQuestions: ["Why?"],
			}),
			createActivity("cloze", "cloze", {
				textWithBlanks: "The answer is {{b1}}.",
				blanks: [{id: "b1", answer: "42", hint: "number"}],
			}),
			createActivity("project", "guided_project", {
				goal: "Build",
				brief: "Brief",
				steps: ["Step one"],
				deliverable: "Deliver it",
				rubric: ["Complete"],
			}),
			createActivity("free", "freeform_html", {
				html: "<p>Custom HTML</p>",
			}),
		];

		const html = buildActivitiesHtmlDocument(snapshot);

		for (const label of [
			"Quick check",
			"Open response questions",
			"Code practice",
			"Flashcards",
			"Matching",
			"Ordering",
			"Case study",
			"Debate reflection",
			"Cloze",
			"Mini project",
			"Interactive",
		]) {
			expect(html).toContain(label);
		}
		expect(html).toContain('data-tab-target="tab-multiple_choice"');
		expect(html).toContain('data-tab-target="tab-freeform_html"');
		expect(html).toContain("<summary>Explanation / rubric</summary>");
	});

	it("removes executable markup from freeform static HTML", () => {
		const sanitized = sanitizeStaticHtml(
			'<div onclick="alert(1)"><a href="javascript:alert(2)">x</a></div><script>alert(3)</script>',
		);

		expect(sanitized).not.toContain("onclick");
		expect(sanitized).not.toContain("javascript:");
		expect(sanitized).not.toContain("<script");
	});

	it("does not include executable freeform markup in the offline document", () => {
		const html = buildActivitiesHtmlDocument(createSnapshot());

		expect(html).not.toContain("onclick=");
		expect(html).not.toContain("<script>alert(2)</script>");
		expect(html).toContain("<script>");
	});
});
