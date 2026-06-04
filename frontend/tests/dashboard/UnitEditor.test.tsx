import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "@/auth/authContext";
import {AppearanceContext} from "@/theme/appearanceContext";
import {dashboardApi, type DidacticUnitChapterDetailDto, type DidacticUnitDetailDto, type LearningActivityDto} from "@/dashboard/api/dashboardApi";
import {UnitEditor} from "@/components/dashboard/editor/UnitEditor";
import {loadFonts} from "@/shared/presentation/fontLoader";

vi.mock("canvas-confetti", () => ({default: vi.fn()}));
vi.mock("motion/react", () => ({
	AnimatePresence: ({children}: {children: React.ReactNode}) => <>{children}</>,
	motion: {
		div: ({children, ...props}: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...withoutMotionProps(props)}>{children}</div>,
		aside: ({children, ...props}: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) => <aside {...withoutMotionProps(props)}>{children}</aside>,
		button: ({children, ...props}: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => <button {...withoutMotionProps(props)}>{children}</button>,
	},
}));
vi.mock("@/hooks/use-toast", () => ({toastError: vi.fn()}));
vi.mock("@/shared/presentation/fontLoader", () => ({
	loadFonts: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/dashboard/export/unitExport", () => ({
	buildActivitiesHtmlDocument: vi.fn(() => "<html></html>"),
	buildUnitExportSnapshot: vi.fn().mockResolvedValue({unit: {title: "Unit title"}}),
	downloadTextFile: vi.fn(),
	sanitizeExportFilename: vi.fn(() => "unit-title"),
}));
vi.mock("@/dashboard/readerPagination", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/dashboard/readerPagination")>();
	return {
		...actual,
		measurePages: vi.fn(() => [
			{
				kind: "content",
				html: "<p>Measured page</p>",
				startCharacterOffset: 0,
				endCharacterOffset: 13,
			},
			{
				kind: "post_module_actions",
				startCharacterOffset: 13,
				endCharacterOffset: 13,
				hasNextModule: true,
				primaryActionLabel: "Continue",
			},
		]),
	};
});
vi.mock("@/components/dashboard/editor/TiptapHtmlEditor", () => ({
	TiptapHtmlEditor: ({
		initialHtml,
		onHtmlChange,
		placeholder,
	}: {
		initialHtml: string;
		onHtmlChange: (html: string) => void;
		placeholder: string;
	}) => (
		<textarea
			value={initialHtml}
			placeholder={placeholder}
			onChange={(event) => onHtmlChange(event.target.value)}
		/>
	),
}));
vi.mock("@/components/dashboard/content/ChapterRenderer", () => ({
	ChapterRenderer: ({html}: {html: string}) => <div data-testid="chapter-content" dangerouslySetInnerHTML={{__html: html}} />,
}));
vi.mock("@/components/dashboard/activities/LearningActivityRenderer", () => ({
	LearningActivityRenderer: ({activity}: {activity: LearningActivityDto}) => <div>{activity.title}</div>,
}));

function withoutMotionProps<TProps extends Record<string, unknown>>(props: TProps) {
	const {animate, exit, initial, transition, whileTap, ...domProps} = props;
	void animate;
	void exit;
	void initial;
	void transition;
	void whileTap;
	return domProps;
}

const chapter: DidacticUnitChapterDetailDto = {
	chapterIndex: 0,
	title: "Module one",
	planningOverview: "First module overview",
	html: "<h2>Introduction</h2><p>Body text</p>",
	htmlHash: "hash",
	htmlBlocks: [
		{
			id: "body",
			type: "paragraph",
			html: "<p>Body text</p>",
			textLength: 9,
			textStartOffset: 0,
			textEndOffset: 9,
		},
	],
	htmlBlocksVersion: 1,
	state: "ready",
	readBlockIndex: 0,
	readBlocksVersion: 1,
	totalBlocks: 1,
	isCompleted: false,
};

const secondChapter: DidacticUnitChapterDetailDto = {
	...chapter,
	chapterIndex: 1,
	title: "Module two",
	planningOverview: "Second module overview",
	html: "<p>Second module text</p>",
	htmlHash: "hash-two",
};

const unit: DidacticUnitDetailDto = {
	id: "unit",
	ownerId: "owner",
	topic: "Testing",
	title: "Unit title",
	folderId: "folder",
	folderAssignmentMode: "manual",
	folder: {id: "folder", name: "General", slug: "general", icon: "book-open", color: "#16a34a", kind: "default"},
	presentationTheme: null,
	provider: "mock",
	status: "content_generation_completed",
	nextAction: "open_editor",
	createdAt: "2026-05-27T00:00:00Z",
	updatedAt: "2026-05-27T00:00:00Z",
	level: "beginner",
	depth: "basic",
	length: "short",
	generationQuality: "silver",
	questionnaireEnabled: false,
	overview: "A test unit",
	learningGoals: ["Read modules"],
	chapters: [
		{title: "Module one", overview: "First module overview", keyPoints: ["First point"]},
		{title: "Module two", overview: "Second module overview", keyPoints: ["Second point"]},
	],
	studyProgress: {moduleCount: 2, readBlockCount: 0, totalBlockCount: 2, studyProgressPercent: 25},
};

const generatedActivity: LearningActivityDto = {
	id: "activity",
	ownerId: "owner",
	didacticUnitId: "unit",
	chapterIndex: 0,
	scope: "current_module",
	type: "multiple_choice",
	quality: "silver",
	title: "Quick check",
	instructions: "Answer.",
	content: {},
	dedupeSummary: "check",
	sourceModuleIndexes: [0],
	feedbackAttemptLimit: 3,
	createdAt: "2026-05-27T00:00:00Z",
	updatedAt: "2026-05-27T00:00:00Z",
};

function display() {
	return render(
		<MemoryRouter>
			<AuthContext.Provider
				value={{
					status: "authenticated",
					user: {
						id: "owner",
						provider: "google",
						email: "owner@example.com",
						emailVerified: true,
						displayName: "Owner",
						role: "user",
						status: "active",
						credits: {bronze: 10, silver: 10, gold: 10},
						defaultPresentationTheme: null,
					} as never,
					error: null,
					beginGoogleLogin: vi.fn(),
					logout: vi.fn().mockResolvedValue(undefined),
					refreshUser: vi.fn().mockResolvedValue(undefined),
				}}
			>
				<AppearanceContext.Provider value={{mode: "light", resolvedMode: "light", setMode: vi.fn()}}>
					<UnitEditor didacticUnitId="unit" onDataChanged={vi.fn()} />
				</AppearanceContext.Provider>
			</AuthContext.Provider>
		</MemoryRouter>,
	);
}

describe("UnitEditor", () => {
	beforeEach(() => {
		window.localStorage.setItem("didactio.editor.guide.v1", "seen");
		Object.defineProperty(document, "fonts", {
			configurable: true,
			value: {status: "loaded", ready: Promise.resolve()},
		});
		Object.defineProperty(HTMLElement.prototype, "scrollTo", {configurable: true, value: vi.fn()});
		Object.defineProperty(window, "innerWidth", {configurable: true, writable: true, value: 1440});
		Object.defineProperty(window, "innerHeight", {configurable: true, writable: true, value: 900});
		vi.mocked(loadFonts).mockResolvedValue(undefined);

		vi.spyOn(dashboardApi, "getAiConfig").mockResolvedValue({
			silver: {provider: "mock", model: "fast"},
			gold: {provider: "mock", model: "best"},
			authoring: {language: "English", tone: "friendly", learnerLevel: "beginner"},
		});
		vi.spyOn(dashboardApi, "getAiConfigCatalog").mockResolvedValue({
			silver: [{id: "fast", label: "Fast", description: "Fast"}],
			gold: [{id: "best", label: "Best", description: "Best"}],
		});
		vi.spyOn(dashboardApi, "getDidacticUnit").mockResolvedValue(unit);
		vi.spyOn(dashboardApi, "listDidacticUnitChapters").mockResolvedValue({
			chapters: [
				{chapterIndex: 0, title: "Module one", overview: "First", hasGeneratedContent: true, readBlockIndex: 0, readBlocksVersion: 1, totalBlocks: 1, isCompleted: false, state: "ready"},
				{chapterIndex: 1, title: "Module two", overview: "Second", hasGeneratedContent: true, readBlockIndex: 0, readBlocksVersion: 1, totalBlocks: 1, isCompleted: false, state: "ready"},
			],
		});
		vi.spyOn(dashboardApi, "getDidacticUnitChapter").mockImplementation(async (_id, index) => index === 0 ? chapter : secondChapter);
		vi.spyOn(dashboardApi, "listDidacticUnitNotes").mockResolvedValue({notes: []});
		vi.spyOn(dashboardApi, "listDidacticUnitChapterRevisions").mockResolvedValue({revisions: []});
		vi.spyOn(dashboardApi, "listLearningActivities").mockResolvedValue({activities: []});
		vi.spyOn(dashboardApi, "listLearningActivityAttempts").mockResolvedValue({attempts: []});
		vi.spyOn(dashboardApi, "updateDidacticUnitChapter").mockResolvedValue(chapter);
		vi.spyOn(dashboardApi, "updateDidacticUnitTheme").mockResolvedValue(unit);
		vi.spyOn(dashboardApi, "updateDidacticUnitReadingProgress").mockResolvedValue({
			module: chapter,
			studyProgress: unit.studyProgress,
		});
		vi.spyOn(dashboardApi, "completeDidacticUnitChapter").mockResolvedValue(unit);
		vi.spyOn(dashboardApi, "createLearningActivity").mockResolvedValue({activity: generatedActivity});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		window.localStorage.clear();
	});

	it("loads the desktop editor with its reading and navigation surfaces", async () => {
		display();

		expect(await screen.findByText("Overall Progress")).toBeTruthy();
		expect(screen.getAllByText("Module one").length).toBeGreaterThan(0);
		expect(screen.getByLabelText("Notes")).toBeTruthy();
		expect(screen.getByLabelText("Version history")).toBeTruthy();
		expect(screen.getByLabelText("Search unit")).toBeTruthy();
		expect(screen.getByLabelText("Edit")).toBeTruthy();
	});

	it("opens unit search and shows module results", async () => {
		display();

		fireEvent.click(await screen.findByLabelText("Search unit"));
		const input = await screen.findByPlaceholderText("Search modules...");
		fireEvent.change(input, {target: {value: "body"}});

		expect(await screen.findByText("Module 1 · 0% of unit")).toBeTruthy();
		expect(screen.getByText("Module one")).toBeTruthy();
		expect(screen.getByText("Body")).toBeTruthy();
	});

	it("keeps editable page drafts stable while typing", async () => {
		display();

		fireEvent.click(await screen.findByLabelText("Edit"));
		const editor = await screen.findByPlaceholderText(
			"Write the module content here...",
		);

		fireEvent.change(editor, {target: {value: "<p>Measured page!</p>"}});

		await waitFor(() => {
			expect((editor as HTMLTextAreaElement).value).toBe(
				"<p>Measured page!</p>",
			);
		});
	});

	it("renders the mobile navigation, actions, style dialog, and export dialog", async () => {
		Object.defineProperty(window, "innerWidth", {configurable: true, writable: true, value: 500});
		display();

		expect(await screen.findByText("Practice with exercises")).toBeTruthy();
		fireEvent.click(screen.getByText("Modules"));
		expect(screen.getByText("Overall progress")).toBeTruthy();
		fireEvent.click(screen.getByText("Content"));

		fireEvent.click(screen.getByLabelText("More actions"));
		expect(await screen.findByLabelText("Search unit")).toBeTruthy();
		fireEvent.click(await screen.findByLabelText("Reading style"));
		expect(await screen.findByText("Adjust how this unit reads.")).toBeTruthy();
		fireEvent.click(screen.getByText("Large"));

		fireEvent.click(screen.getByText("Exercises"));
		expect(await screen.findByText("No exercises yet")).toBeTruthy();
		fireEvent.click(screen.getByText("Create"));
		expect(await screen.findByText("Exercises & Practice")).toBeTruthy();

		fireEvent.keyDown(document, {key: "Escape"});
		fireEvent.click(screen.getByText("Settings"));
		fireEvent.click(screen.getByText("Export unit"));
		expect(await screen.findByText("Print theory PDF")).toBeTruthy();
		expect(screen.getByText("Download activities HTML")).toBeTruthy();
	});
});
