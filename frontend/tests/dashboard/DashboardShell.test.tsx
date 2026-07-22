import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "@/auth/authContext";
import {authClient} from "@/auth/authClient";
import {AppearanceContext} from "@/theme/appearanceContext";
import {dashboardApi} from "@/dashboard/api/dashboardApi";
import DashboardShell from "@/components/dashboard/DashboardShell";

vi.mock("@/hooks/use-toast", () => ({toastError: vi.fn()}));
vi.mock("motion/react", () => ({
	motion: {
		aside: ({children, ...props}: React.HTMLAttributes<HTMLElement> & Record<string, unknown>) => <aside {...withoutMotionProps(props)}>{children}</aside>,
	},
}));
vi.mock("recharts", () => ({
	ResponsiveContainer: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
	AreaChart: () => <div />,
	Area: () => <div />,
	CartesianGrid: () => <div />,
	Tooltip: () => <div />,
	XAxis: () => <div />,
	YAxis: () => <div />,
}));

function withoutMotionProps<TProps extends Record<string, unknown>>(props: TProps) {
	const {animate, exit, initial, transition, ...domProps} = props;
	void animate;
	void exit;
	void initial;
	void transition;
	return domProps;
}

const folder = {id: "folder", name: "General", slug: "general", icon: "book-open", color: "#16a34a", kind: "default" as const, unitCount: 1};
const summary = {
	id: "unit",
	title: "Ready unit",
	topic: "Testing",
	folderId: "folder",
	folder,
	provider: "mock",
	status: "content_generation_completed",
	nextAction: "open_editor",
	overview: "Overview",
	length: "short" as const,
	moduleCount: 2,
	generatedChapterCount: 2,
	readBlockCount: 1,
	totalBlockCount: 2,
	progressPercent: 100,
	studyProgressPercent: 50,
	createdAt: "2026-05-27T00:00:00Z",
	lastActivityAt: "2026-05-27T00:00:00Z",
};
let mobileViewport = false;

function display(route: string) {
	return render(
		<MemoryRouter initialEntries={[route]}>
			<AuthContext.Provider
				value={{
					status: "authenticated",
					user: {
						displayName: "Test Owner",
						email: "owner@example.com",
						credits: {bronze: 20, silver: 15, gold: 5},
						defaultPresentationTheme: null,
					} as never,
					error: null,
					beginGoogleLogin: vi.fn(),
					logout: vi.fn().mockResolvedValue(undefined),
					refreshUser: vi.fn().mockResolvedValue(undefined),
				}}
			>
				<AppearanceContext.Provider value={{mode: "light", resolvedMode: "light", setMode: vi.fn()}}>
					<Routes>
						<Route path="/dashboard/*" element={<DashboardShell />} />
					</Routes>
				</AppearanceContext.Provider>
			</AuthContext.Provider>
		</MemoryRouter>,
	);
}

describe("DashboardShell", () => {
	beforeEach(() => {
		mobileViewport = false;
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: vi.fn(() => ({
				matches: mobileViewport,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		});
		vi.spyOn(dashboardApi, "listDidacticUnits").mockResolvedValue({didacticUnits: [summary]});
		vi.spyOn(dashboardApi, "listFolders").mockResolvedValue({folders: [folder]});
		vi.spyOn(dashboardApi, "getAiConfig").mockResolvedValue({
			silver: {provider: "mock", model: "fast"},
			gold: {provider: "mock", model: "best"},
			authoring: {language: "English", tone: "friendly", learnerLevel: "beginner"},
		});
		vi.spyOn(dashboardApi, "getAiConfigCatalog").mockResolvedValue({
			silver: [{id: "mock/fast", label: "Fast", description: "Standard", recommended: true}],
			gold: [{id: "mock/best", label: "Best", description: "Pro"}],
		});
		vi.spyOn(dashboardApi, "updateAiConfig").mockResolvedValue({} as never);
		vi.spyOn(dashboardApi, "getUsageAnalytics").mockResolvedValue({
			period: "30d",
			unitsCreated: 3,
			aiGenerations: 7,
			completionRate: 60,
			readBlockCount: 6,
			totalBlockCount: 10,
			favoriteModel: {provider: "mock", model: "fast", label: "Fast", count: 4},
			favoriteTopic: {...folder, unitCount: 1},
			chart: [{key: "today", label: "Today", count: 2}],
		});
		vi.spyOn(dashboardApi, "getBillingSummary").mockResolvedValue({
			billing: {subscriptionTier: "teacher", subscriptionStatus: "active", currentPeriodEnd: "2026-06-27T00:00:00Z"},
			pricing: {products: [
				{id: "pack", kind: "credit_pack", name: "Starter pack", description: "Credits", priceLabel: "5 EUR", stripePriceEnvKey: "pack", stripeConfigured: true, credits: {bronze: 5, silver: 1, gold: 0}, features: []},
				{id: "plan", kind: "subscription", name: "Teacher", description: "Plan", priceLabel: "15 EUR", stripePriceEnvKey: "plan", stripeConfigured: true, credits: {bronze: 50, silver: 10, gold: 2}, subscriptionTier: "teacher", features: []},
			]},
		});
		vi.spyOn(authClient, "listCreditTransactions").mockResolvedValue({transactions: []});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders desktop and mobile libraries with loaded units", async () => {
		display("/dashboard");
		expect(await screen.findByText("Ready unit")).toBeTruthy();
		expect(screen.getByPlaceholderText("Search units...")).toBeTruthy();
		cleanup();

		mobileViewport = true;
		display("/dashboard");
		expect(await screen.findByText("Ready unit")).toBeTruthy();
		expect(screen.getByText("Create new folder")).toBeTruthy();
	});

	it("renders preferences and analytics sections with returned data", async () => {
		display("/dashboard?section=preferences");
		expect(await screen.findByText("Adjust your generation defaults.")).toBeTruthy();
		expect(await screen.findByText("Standard model")).toBeTruthy();
		fireEvent.click(screen.getByText("Dark"));
		cleanup();

		display("/dashboard?section=analytics");
		expect(await screen.findByText("AI Generations Over Time")).toBeTruthy();
		expect(screen.getByText("Favorite Topic")).toBeTruthy();
		fireEvent.click(screen.getByText("7D"));
	});

	it("renders profile and subscription account views", async () => {
		display("/dashboard?section=profile-security");
		expect(await screen.findByText("Basic Information")).toBeTruthy();
		fireEvent.click(screen.getByText("Sign out"));
		cleanup();

		display("/dashboard?section=subscription");
		expect(await screen.findByText("Current Plan")).toBeTruthy();
		expect(screen.getByText("Starter pack")).toBeTruthy();
		expect(screen.getByText("Teacher")).toBeTruthy();
	});
});
