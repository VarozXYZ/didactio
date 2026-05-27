import {cleanup, render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, describe, expect, it, vi} from "vitest";
import App from "@/App";
import {AuthContext} from "@/auth/authContext";
import {AppearanceContext} from "@/theme/appearanceContext";

vi.mock("@/components/marketing/Header", () => ({
	default: () => <div>Header chrome</div>,
}));
vi.mock("@/components/marketing/Footer", () => ({
	default: () => <div>Footer chrome</div>,
}));
vi.mock("@/pages/HomePage", () => ({
	default: () => <div>Home route</div>,
}));
vi.mock("@/pages/LoginPage", () => ({
	default: () => <div>Login route</div>,
}));
vi.mock("@/pages/DashboardPage", () => ({
	default: () => <div>Dashboard route</div>,
}));
vi.mock("@/pages/OnboardingPage", () => ({
	default: () => <div>Onboarding route</div>,
}));
vi.mock("@/pages/AuthCallbackPage", () => ({
	default: () => <div>Callback route</div>,
}));

const auth = {
	status: "authenticated" as const,
	user: {onboardingCompletedAt: "2026-01-01T00:00:00Z"},
	error: null,
	beginGoogleLogin: vi.fn(),
	logout: vi.fn(),
	refreshUser: vi.fn(),
};

function renderApp(route: string) {
	return render(
		<MemoryRouter initialEntries={[route]}>
			<AuthContext.Provider value={auth as never}>
				<AppearanceContext.Provider value={{mode: "dark", resolvedMode: "dark", setMode: vi.fn()}}>
					<App />
				</AppearanceContext.Provider>
			</AuthContext.Provider>
		</MemoryRouter>,
	);
}

describe("App shell routes", () => {
	afterEach(() => {
		cleanup();
	});

	it("shows marketing chrome on public routes", async () => {
		renderApp("/");
		expect(await screen.findByText("Home route")).toBeTruthy();
		expect(screen.getByText("Header chrome")).toBeTruthy();
		expect(screen.getByText("Footer chrome")).toBeTruthy();
		expect(document.documentElement.dataset.appThemed).toBe("false");
	});

	it("hides marketing chrome on app routes and applies app theme", async () => {
		renderApp("/dashboard");
		expect(await screen.findByText("Dashboard route")).toBeTruthy();
		expect(screen.queryByText("Header chrome")).toBeNull();
		expect(document.documentElement.dataset.appTheme).toBe("dark");
	});
});
