import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "@/auth/authContext";
import {AppearanceContext} from "@/theme/appearanceContext";
import {CreateUnitWizard} from "@/components/dashboard/setup/CreateUnitWizard";
import {dashboardApi, type DidacticUnitDetailDto} from "@/dashboard/api/dashboardApi";

vi.mock("@/hooks/use-toast", () => ({toastError: vi.fn()}));

const syllabus = {
	title: "Testing foundations",
	overview: "A structured route through testing.",
	learningGoals: ["Write tests"],
	keywords: ["tests", "quality"],
	chapters: [
		{
			title: "Core concepts",
			overview: "Why tests matter.",
			keyPoints: ["Confidence"],
			lessons: [{title: "Assertions", contentOutline: ["Arrange and assert"]}],
		},
	],
};

function detail(overrides: Partial<DidacticUnitDetailDto> = {}): DidacticUnitDetailDto {
	return {
		id: "unit",
		ownerId: "owner",
		topic: "Testing",
		title: "Testing unit",
		folderId: "folder",
		folderAssignmentMode: "manual",
		folder: {id: "folder", name: "General", slug: "general", icon: "book-open", color: "#16a34a", kind: "default"},
		presentationTheme: null,
		provider: "mock",
		status: "questionnaire_ready",
		nextAction: "answer_questionnaire",
		createdAt: "2026-05-27T00:00:00Z",
		updatedAt: "2026-05-27T00:00:00Z",
		level: "beginner",
		depth: "basic",
		learningProfile: "beginner",
		length: "short",
		questionnaireEnabled: true,
		questionnaire: {
			questions: [
				{id: "goal", prompt: "What is your goal?", type: "single_select", options: [{value: "understand_theory", label: "Understand theory"}, {value: "other", label: "Other"}]},
				{id: "context", prompt: "Any context?", type: "long_text"},
			],
		},
		overview: "Overview",
		learningGoals: ["Learn"],
		chapters: [{title: "Core concepts", overview: "Concepts", keyPoints: ["Point"]}],
		studyProgress: {moduleCount: 1, readBlockCount: 0, totalBlockCount: 0, studyProgressPercent: 0},
		...overrides,
	};
}

const questionnaireUnit = detail();
const syllabusUnit = detail({
	status: "syllabus_ready",
	nextAction: "approve_syllabus",
	syllabus,
});

function display(props: {didacticUnitId?: string | null; onOpenEditor?: (id: string) => void} = {}) {
	return render(
		<AuthContext.Provider
			value={{
				status: "authenticated",
				user: {
					role: "user",
					credits: {bronze: 30, silver: 30, gold: 30},
				} as never,
				error: null,
				beginGoogleLogin: vi.fn(),
				logout: vi.fn().mockResolvedValue(undefined),
				refreshUser: vi.fn().mockResolvedValue(undefined),
			}}
		>
			<AppearanceContext.Provider value={{mode: "light", resolvedMode: "light", setMode: vi.fn()}}>
				<CreateUnitWizard
					didacticUnitId={props.didacticUnitId}
					onClose={vi.fn()}
					onDataChanged={vi.fn()}
					onOpenEditor={props.onOpenEditor ?? vi.fn()}
				/>
			</AppearanceContext.Provider>
		</AuthContext.Provider>,
	);
}

describe("CreateUnitWizard", () => {
	beforeEach(() => {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})),
		});
		vi.spyOn(dashboardApi, "listFolders").mockResolvedValue({
			folders: [{id: "folder", name: "General", slug: "general", icon: "book-open", color: "#16a34a", kind: "default", unitCount: 0}],
		});
		vi.spyOn(dashboardApi, "getAiConfig").mockResolvedValue({
			silver: {provider: "mock", model: "fast"},
			gold: {provider: "mock", model: "best"},
			authoring: {language: "English", tone: "friendly", learnerLevel: "beginner"},
		});
		vi.spyOn(dashboardApi, "getAiConfigCatalog").mockResolvedValue({
			silver: [{id: "mock/fast", label: "Fast", description: "Fast"}],
			gold: [{id: "mock/best", label: "Best", description: "Best"}],
		});
		vi.spyOn(dashboardApi, "createDidacticUnit").mockResolvedValue(questionnaireUnit);
		vi.spyOn(dashboardApi, "answerDidacticUnitQuestionnaire").mockResolvedValue(syllabusUnit);
		vi.spyOn(dashboardApi, "approveDidacticUnitSyllabus").mockResolvedValue({
			...syllabusUnit,
			nextAction: "open_editor",
		});
		vi.spyOn(dashboardApi, "streamDidacticUnitSyllabus").mockImplementation(async (_id, _quality, handlers) => {
			handlers.onPartialStructured?.({data: {syllabus: {title: "Rebuilding", chapters: [{title: "Draft module"}]}}} as never);
			return syllabusUnit;
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("creates a unit, answers its questionnaire, and regenerates a rejected syllabus", async () => {
		display();
		const topicInput = await screen.findByRole("textbox");
		fireEvent.change(topicInput, {target: {value: "Testing with Vitest"}});
		fireEvent.click(screen.getByText("Additional context"));
		fireEvent.change(screen.getByPlaceholderText("Learner goals, domain constraints, audience notes..."), {
			target: {value: "Focus on practical tests"},
		});
		fireEvent.click(screen.getByText("Advanced"));
		fireEvent.click(screen.getByText("Course"));
		fireEvent.click(screen.getByText("Continue"));

		expect(await screen.findByText("What is your goal?")).toBeTruthy();
		fireEvent.click(screen.getByText("Other"));
		fireEvent.change(screen.getByPlaceholderText("Write your own answer..."), {target: {value: "Ship confidently"}});
		fireEvent.change(screen.getByPlaceholderText("Your answer..."), {target: {value: "React app"}});
		fireEvent.click(screen.getByText("Continue"));

		expect(await screen.findByText("Testing foundations")).toBeTruthy();
		fireEvent.click(screen.getByText(/Core concepts/));
		fireEvent.click(screen.getByText(/No, tweak it/));
		fireEvent.change(screen.getByPlaceholderText("Context for regeneration"), {target: {value: "More examples"}});
		fireEvent.click(screen.getByText("Regenerate"));
		await waitFor(() => expect(dashboardApi.streamDidacticUnitSyllabus).toHaveBeenCalled());
	});

	it("loads an existing syllabus and approves generation for the selected quality", async () => {
		const openEditor = vi.fn();
		vi.spyOn(dashboardApi, "getDidacticUnit").mockResolvedValue(syllabusUnit);
		display({didacticUnitId: "unit", onOpenEditor: openEditor});

		expect(await screen.findByText("Testing foundations")).toBeTruthy();
		fireEvent.click(screen.getByText(/Yes, looks great/));
		fireEvent.click(await screen.findByText("Start learning"));

		await waitFor(() => expect(dashboardApi.approveDidacticUnitSyllabus).toHaveBeenCalledWith("unit", "silver"));
		expect(openEditor).toHaveBeenCalledWith("unit");
	});
});
