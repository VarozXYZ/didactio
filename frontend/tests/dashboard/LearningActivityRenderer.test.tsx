import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {LearningActivityRenderer} from "@/components/dashboard/activities/LearningActivityRenderer";
import {AppearanceContext} from "@/theme/appearanceContext";
import {dashboardApi, type LearningActivityDto, type LearningActivityAttemptDto} from "@/dashboard/api/dashboardApi";

vi.mock("react-quizlet-flashcard", () => ({
	useFlashcard: () => ({flip: vi.fn(), resetCardState: vi.fn()}),
	Flashcard: ({front, back}: {front: {html: React.ReactNode}; back: {html: React.ReactNode}}) => (
		<div>{front.html}{back.html}</div>
	),
}));

const submit = vi.fn(async () => undefined);
const refill = vi.fn(async () => undefined);
const remove = vi.fn(async () => undefined);

function activity(type: LearningActivityDto["type"], content: Record<string, unknown>): LearningActivityDto {
	return {
		id: `activity-${type}`,
		ownerId: "owner",
		didacticUnitId: "unit",
		chapterIndex: 0,
		scope: "current_module",
		type,
		quality: "silver",
		title: `${type} title`,
		instructions: "Complete the exercise.",
		content,
		dedupeSummary: "summary",
		sourceModuleIndexes: [0],
		feedbackAttemptLimit: 3,
		createdAt: "2026-05-27T00:00:00Z",
		updatedAt: "2026-05-27T00:00:00Z",
	};
}

function attempt(overrides: Partial<LearningActivityAttemptDto> = {}): LearningActivityAttemptDto {
	return {
		id: "attempt",
		activityId: "activity",
		answers: {},
		feedback: "Feedback: Solid work\nStrengths: Clear response\nImprovements: Add detail",
		score: 75,
		strengths: ["Clear response"],
		improvements: ["Add an example"],
		createdAt: "2026-05-27T00:00:00Z",
		...overrides,
	} as LearningActivityAttemptDto;
}

function display(item: LearningActivityDto, attempts: LearningActivityAttemptDto[] = []) {
	return render(
		<AppearanceContext.Provider value={{mode: "light", resolvedMode: "light", setMode: vi.fn()}}>
			<LearningActivityRenderer
				activity={item}
				attempts={attempts}
				isSubmitting={false}
				onSubmitAttempt={submit}
				onRefillAttempts={refill}
				onDeleteActivity={remove}
				stylePreset="modern"
			/>
		</AppearanceContext.Provider>,
	);
}

describe("LearningActivityRenderer", () => {
	beforeEach(() => {
		submit.mockClear();
		refill.mockClear();
		remove.mockClear();
		vi.spyOn(dashboardApi, "getActivityProgress").mockResolvedValue({progress: null});
		vi.spyOn(dashboardApi, "saveActivityProgress").mockResolvedValue({progress: {} as never});
		Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText: vi.fn().mockResolvedValue(undefined)}});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("completes and repeats a multiple-choice exercise", async () => {
		display(activity("multiple_choice", {
			questions: [
				{id: "q1", prompt: "First?", options: [{id: "a", text: "A"}, {id: "b", text: "B"}], correctOptionId: "a", explanation: "Because A."},
				{id: "q2", prompt: "Second?", options: [{id: "c", text: "C"}], correctOptionId: "c", explanation: "Because C."},
			],
		}));
		fireEvent.click(screen.getByText("A"));
		fireEvent.click(screen.getByText("Confirm answer"));
		expect(await screen.findByText("Correct!")).toBeTruthy();
		fireEvent.click(screen.getByText("Next question"));
		fireEvent.click(screen.getByText("C"));
		fireEvent.click(screen.getByText("Confirm answer"));
		expect(await screen.findByText("Activity complete")).toBeTruthy();
		expect(submit).toHaveBeenCalled();
		fireEvent.click(screen.getByText("Repeat activity"));
		expect(await screen.findByText("First?")).toBeTruthy();
	});

	it("answers short response prompts, displays corrections, and refills exhausted feedback", async () => {
		const item = {...activity("short_answer", {
			prompts: [{id: "p1", prompt: "Explain testing"}, {id: "p2", prompt: "Why?"}],
		}), feedbackAttemptLimit: 1};
		display(item, [attempt({
			questionFeedback: [{id: "p1", score: 80, simplifiedScore: "Good", feedback: "Nice", expectedAnswer: "Expected"}],
		})]);
		await waitFor(() => expect(dashboardApi.getActivityProgress).toHaveBeenCalled());
		fireEvent.change(screen.getByPlaceholderText("Write your answer..."), {target: {value: "An answer"}});
		fireEvent.click(screen.getByText("Question 2"));
		fireEvent.click(screen.getByText("Check answer"));
		expect(await screen.findByText("No attempts remaining")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", {name: /Use/}));
		await waitFor(() => expect(refill).toHaveBeenCalled());
		expect(submit).toHaveBeenCalled();
	});

	it("renders and submits matching, ordering, cloze, and free response formats", async () => {
		for (const item of [
			activity("matching", {pairs: [{id: "pair", left: "Term", right: "Definition"}]}),
			activity("ordering", {items: [{id: "first", text: "First"}]}),
			activity("cloze", {textWithBlanks: "Answer {{blank}}", blanks: [{id: "blank", hint: "hint"}]}),
			activity("debate_reflection", {prompt: "Debate this"}),
		]) {
			const view = display(item, [attempt()]);
			const input = view.container.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
			if (input) fireEvent.change(input, {target: {value: "1"}});
			fireEvent.click(screen.getByText(item.type === "debate_reflection" ? "Check answer" : "Check answers"));
			view.unmount();
		}
		expect(submit).toHaveBeenCalledTimes(4);
	});

	it("edits coding practice, case study, and guided project drafts", async () => {
		const coding = display(activity("coding_practice", {
			prompt: "Implement",
			language: "typescript",
			starterCode: "const x = 1;",
			expectedOutcome: "Works",
			testCases: [{input: "1", expected: "1"}],
		}), [attempt({score: 90})]);
		fireEvent.click(await screen.findByText("Code"));
		const editor = coding.container.querySelector("textarea")!;
		fireEvent.change(editor, {target: {value: "const x = 2;"}});
		fireEvent.click(screen.getByText("Check answer"));
		coding.unmount();

		const caseView = display(activity("case_study", {
			scenario: "Scenario",
			problem: "Problem",
			rubric: ["Analyze"],
		}), [attempt()]);
		fireEvent.click(screen.getByText("Analysis"));
		fireEvent.change(caseView.container.querySelector("textarea")!, {target: {value: "Analysis"}});
		fireEvent.click(screen.getByText("Check answer"));
		caseView.unmount();

		const project = display(activity("guided_project", {
			goal: "Build",
			brief: "A deliverable",
			steps: ["1. Start", "2. Finish"],
			deliverable: "Submit",
			rubric: ["Complete"],
		}), [attempt()]);
		fireEvent.click(screen.getByText("Files"));
		fireEvent.click(screen.getByText("Add file"));
		expect(await screen.findByText("Save file")).toBeTruthy();
		fireEvent.change(screen.getByPlaceholderText("DataList.tsx, report.md, analysis.csv..."), {target: {value: "report.md"}});
		fireEvent.change(screen.getByPlaceholderText("Paste the file contents here..."), {target: {value: "content"}});
		fireEvent.click(screen.getByText("Save file"));
		fireEvent.click(screen.getByText("Check answer"));
		expect(submit).toHaveBeenCalledTimes(3);
	});

	it("reveals flashcards, marks learning progress, and deletes an activity", async () => {
		display(activity("flashcards", {cards: [{id: "card", front: "Front", back: "Back"}]}));
		await waitFor(() => expect(dashboardApi.getActivityProgress).toHaveBeenCalled());
		fireEvent.click(screen.getByText("Reveal answer"));
		fireEvent.click(await screen.findByText("Learned"));
		expect(await screen.findByText("Deck learned")).toBeTruthy();
		fireEvent.click(screen.getByText("Review again"));
		fireEvent.click(screen.getByLabelText(/Delete/));
		fireEvent.click(await screen.findByText("Delete forever"));
		await waitFor(() => expect(remove).toHaveBeenCalled());
	});
});
