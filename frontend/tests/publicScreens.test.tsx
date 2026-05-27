import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {ReactNode} from "react";
import {MemoryRouter} from "react-router-dom";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthContext} from "@/auth/authContext";
import Header from "@/components/marketing/Header";
import Footer from "@/components/marketing/Footer";
import Faq from "@/components/marketing/Faq";
import Features from "@/components/marketing/Features";
import Hero from "@/components/marketing/Hero";
import Testimonials from "@/components/marketing/Testimonials";
import ContactPage from "@/pages/ContactPage";
import HomePage from "@/pages/HomePage";
import PricingPage from "@/pages/PricingPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";
import {AppearanceContext} from "@/theme/appearanceContext";

vi.mock("react-fast-marquee", () => ({
	default: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));

const authValue = {
	status: "authenticated" as const,
	user: null,
	error: null,
	beginGoogleLogin: vi.fn(),
	logout: vi.fn(),
	refreshUser: vi.fn(),
};

function renderWithProviders(ui: ReactNode, route = "/") {
	return render(
		<MemoryRouter initialEntries={[route]}>
			<AuthContext.Provider value={authValue as never}>
				<AppearanceContext.Provider value={{mode: "light", resolvedMode: "light", setMode: vi.fn()}}>
					{ui}
				</AppearanceContext.Provider>
			</AuthContext.Provider>
		</MemoryRouter>,
	);
}

describe("public screens", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "ResizeObserver", {
			configurable: true,
			value: class {
				observe() {}
				unobserve() {}
				disconnect() {}
			},
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders marketing chrome, hero, FAQ, testimonials, and footer", () => {
		renderWithProviders(
			<>
				<Header />
				<Hero />
				<Features />
				<Faq />
				<Testimonials />
				<Footer />
			</>,
		);

		expect(screen.getByText("Learn about anything, powered by AI")).toBeTruthy();
		expect(screen.getByText("Fast & effortless")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Open navigation menu"));
		expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
		fireEvent.click(screen.getByText("What is Didactio?"));
		expect(screen.getByText(/combines the power of AI models/i)).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Next testimonial"));
		expect(screen.getByText("Daniel Thompson")).toBeTruthy();
		expect(screen.getByText("Join our newsletter")).toBeTruthy();
	});

	it("renders the composed home page", () => {
		renderWithProviders(<HomePage />);
		expect(screen.getByText("Learn about anything, powered by AI")).toBeTruthy();
		expect(screen.getByText("Frequently asked questions")).toBeTruthy();
	});

	it("renders pricing plan toggles for anonymous and authenticated users", () => {
		renderWithProviders(<PricingPage />, "/pricing");
		expect(screen.getByText("Flexible Plans for Every Need")).toBeTruthy();
		fireEvent.click(screen.getByText("Pro"));
		fireEvent.click(screen.getByText("Creator"));
		expect(screen.getByText("20 EUR")).toBeTruthy();
		expect(screen.getByText("15 EUR")).toBeTruthy();
	});

	it("renders contact and legal pages", () => {
		renderWithProviders(<ContactPage />, "/contact");
		expect(screen.getByPlaceholderText("jane@example.com")).toBeTruthy();
		cleanup();

		renderWithProviders(<PrivacyPolicyPage />, "/privacy");
		expect(screen.getByText("Privacy Policy")).toBeTruthy();
		cleanup();

		renderWithProviders(<TermsOfServicePage />, "/terms");
		expect(screen.getByText("Terms of Service")).toBeTruthy();
	});
});
