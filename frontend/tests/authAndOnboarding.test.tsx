import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import type {ReactNode} from "react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "@/auth/authContext";
import type {AuthUser} from "@/auth/authClient";
import {authClient} from "@/auth/authClient";
import AuthScreen from "@/components/auth/AuthScreen";
import {RequireAuth} from "@/components/auth/RequireAuth";
import {OnboardingWizard} from "@/components/onboarding/OnboardingWizard";
import {LanguageStep} from "@/components/onboarding/steps/LanguageStep";
import {dashboardApi} from "@/dashboard/api/dashboardApi";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import DashboardPage from "@/pages/DashboardPage";
import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import RegisterPage from "@/pages/RegisterPage";
import {AppearanceContext} from "@/theme/appearanceContext";
import type {AuthContextValue} from "@/auth/authContext";

vi.mock("@/dashboard/api/dashboardApi", () => ({
	dashboardApi: {
		getAiConfigCatalog: vi.fn(),
		updateAiConfig: vi.fn(),
	},
}));
vi.mock("@/components/dashboard/DashboardShell", () => ({
	default: () => <div>Dashboard shell page</div>,
}));

const user: AuthUser = {
	id: "user",
	provider: "google",
	providerUserId: "google",
	email: "user@example.com",
	emailVerified: true,
	displayName: "Ada Lovelace",
	firstName: "Ada",
	lastName: "Lovelace",
	pictureUrl: "https://example.test/avatar.png",
	locale: "es-ES",
	role: "user",
	status: "active",
	credits: {bronze: 30, silver: 15, gold: 5},
	defaultPresentationTheme: null,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};

const authValue = {
	status: "authenticated" as const,
	user: {...user, onboardingCompletedAt: "2026-01-01T00:00:00Z"},
	error: null,
	beginGoogleLogin: vi.fn(),
	logout: vi.fn().mockResolvedValue(undefined),
	refreshUser: vi.fn().mockResolvedValue(undefined),
};

function renderWithProviders(
	ui: ReactNode,
	{route = "/", auth = authValue}: {route?: string; auth?: AuthContextValue} = {},
) {
	return render(
		<MemoryRouter initialEntries={[route]}>
			<AuthContext.Provider value={auth}>
				<AppearanceContext.Provider value={{mode: "light", resolvedMode: "light", setMode: vi.fn()}}>
					{ui}
				</AppearanceContext.Provider>
			</AuthContext.Provider>
		</MemoryRouter>,
	);
}

describe("auth and onboarding screens", () => {
	beforeEach(() => {
		vi.mocked(dashboardApi.getAiConfigCatalog).mockResolvedValue({
			silver: [{id: "deepseek/deepseek-v4-flash", label: "Fast", description: "Standard", recommended: true}],
			gold: [{id: "anthropic/claude-sonnet-4-6", label: "Claude", description: "Pro"}],
		});
		vi.mocked(dashboardApi.updateAiConfig).mockResolvedValue({
			silver: {provider: "deepseek", model: "deepseek-v4-flash"},
			gold: {provider: "anthropic", model: "claude-sonnet-4-6"},
			authoring: {language: "Spanish", tone: "neutral", learnerLevel: "beginner"},
		});
		vi.spyOn(authClient, "updateDisplayName").mockResolvedValue({user} as never);
		vi.spyOn(authClient, "completeOnboarding").mockResolvedValue({user} as never);
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			callback(performance.now() + 2000);
			return 1;
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("renders auth screens, route wrappers, and guards", () => {
		const beginGoogleLogin = vi.fn();
		const unauthenticated = {...authValue, status: "unauthenticated" as const, user: null};

		renderWithProviders(<LoginPage />, {auth: unauthenticated});
		expect(screen.getByText("Welcome back")).toBeTruthy();
		cleanup();

		renderWithProviders(<RegisterPage />);
		expect(screen.getByText("Create your account")).toBeTruthy();
		cleanup();

		renderWithProviders(<AuthScreen mode="login" />, {
			auth: {...authValue, beginGoogleLogin, error: "OAuth failed"},
		});
		expect(screen.getByText("OAuth failed")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Google"));
		expect(beginGoogleLogin).toHaveBeenCalled();
		cleanup();

		renderWithProviders(<RequireAuth><div>Secret</div></RequireAuth>, {
			auth: {...authValue, status: "loading", user: null},
		});
		expect(screen.getByText("Restoring your session")).toBeTruthy();
		cleanup();

		renderWithProviders(<DashboardPage />);
		expect(screen.getByText("Dashboard shell page")).toBeTruthy();
	});

	it("walks onboarding and standalone language controls", async () => {
		const refreshUser = vi.fn().mockResolvedValue(undefined);
		renderWithProviders(<OnboardingWizard />, {
			auth: {...authValue, user: {...user, onboardingCompletedAt: undefined}, refreshUser},
		});

		fireEvent.change(screen.getByLabelText("Display name"), {target: {value: "Ada L."}});
		fireEvent.click(screen.getByText("Continue"));
		expect(await screen.findByText("Standard model")).toBeTruthy();
		fireEvent.click(screen.getByText("Continue"));
		expect((await screen.findAllByText("Your starting coins")).length).toBeGreaterThan(0);
		fireEvent.click(await screen.findByText("Start learning"));

		await waitFor(() => expect(authClient.completeOnboarding).toHaveBeenCalled());
		expect(dashboardApi.updateAiConfig).toHaveBeenCalledWith(expect.objectContaining({
			authoring: expect.objectContaining({language: "Spanish"}),
		}));
		expect(refreshUser).toHaveBeenCalled();
		cleanup();

		renderWithProviders(<OnboardingPage />, {
			auth: {...authValue, user: {...user, onboardingCompletedAt: undefined}},
		});
		expect(screen.getByText("Content language")).toBeTruthy();
		cleanup();

		const onLanguageChange = vi.fn();
		render(<LanguageStep language="English" onLanguageChange={onLanguageChange} onNext={vi.fn()} onBack={vi.fn()} />);
		fireEvent.click(screen.getByText("Spanish"));
		fireEvent.change(screen.getByLabelText("Other language"), {target: {value: "Basque"}});
		expect(onLanguageChange).toHaveBeenCalledWith("Spanish");
		expect(onLanguageChange).toHaveBeenCalledWith("Basque");
	});

	it("renders OAuth callback errors without leaking timers", async () => {
		vi.spyOn(authClient, "handleOAuthCallback").mockRejectedValue(new Error("No OAuth state"));
		vi.spyOn(window, "setTimeout").mockImplementation(() => 1 as never);
		renderWithProviders(<AuthCallbackPage />, {route: "/auth/callback?error=access_denied"});

		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(screen.getByText("No OAuth state")).toBeTruthy();
	});
});
