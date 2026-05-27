import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import * as React from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {AuthProvider} from "@/components/auth/AuthProvider";
import {Toaster} from "@/components/ui/toaster";
import {
	Toast,
	ToastAction,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@/components/ui/toast";
import {authClient} from "@/auth/authClient";
import {AuthContext} from "@/auth/authContext";
import {dashboardApi} from "@/dashboard/api/dashboardApi";
import {useGenerationRunStream} from "@/dashboard/hooks/useGenerationRunStream";
import {getSubjectStyle, subjectStyles} from "@/dashboard/utils/subjectStyles";
import {toast, toastError, useToast} from "@/hooks/use-toast";
import {AppearanceProvider} from "@/components/shared/AppearanceProvider";
import {useAppearance} from "@/theme/useAppearance";

vi.mock("@/dashboard/api/dashboardApi", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/dashboard/api/dashboardApi")>();
	return {
		...actual,
		dashboardApi: {
			...actual.dashboardApi,
			streamGenerationRun: vi.fn(),
		},
	};
});

function ToastHarness() {
	const {toasts, dismiss} = useToast();
	return (
		<div>
			<span data-testid="toast-count">{toasts.length}</span>
			<button type="button" onClick={() => toast({title: "Saved", description: "Done", duration: Infinity})}>Add</button>
			<button type="button" onClick={() => toastError("Broken")}>Error</button>
			<button type="button" onClick={() => dismiss()}>Dismiss all</button>
			<Toaster />
		</div>
	);
}

function StreamHarness() {
	const stream = useGenerationRunStream();
	return (
		<div>
			<span data-testid="streaming">{String(stream.isStreaming)}</span>
			<span data-testid="blocks">{stream.blocks.map((block) => block.id).join(",")}</span>
			<span data-testid="error">{stream.error ?? ""}</span>
			<span data-testid="run">{stream.run?.id ?? ""}</span>
			<button type="button" onClick={() => void stream.stream("run").catch(() => undefined)}>Start</button>
			<button type="button" onClick={stream.cancel}>Cancel</button>
		</div>
	);
}

function AppearanceHarness() {
	const {mode, resolvedMode, setMode} = useAppearance();
	return (
		<div>
			<span data-testid="mode">{mode}</span>
			<span data-testid="resolved">{resolvedMode}</span>
			<button type="button" onClick={() => setMode("dark")}>Dark</button>
		</div>
	);
}

describe("toast primitives and hook", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("adds, updates, dismisses, removes, and renders toasts", async () => {
		render(<ToastHarness />);
		fireEvent.click(screen.getByText("Add"));
		expect(screen.getByTestId("toast-count").textContent).toBe("1");
		const created = toast({title: "Updated", duration: 50});
		act(() => created.update({id: created.id, title: "Updated again"}));
		expect(screen.getByText("Updated again")).toBeTruthy();
		act(() => vi.advanceTimersByTime(50));
		expect(screen.getByTestId("toast-count").textContent).toBe("2");
		act(() => vi.advanceTimersByTime(1000));
		expect(screen.getByTestId("toast-count").textContent).toBe("1");
		fireEvent.click(screen.getByText("Error"));
		expect(screen.getByText("Something went wrong")).toBeTruthy();
		fireEvent.click(screen.getByText("Dismiss all"));
		act(() => vi.advanceTimersByTime(1000));
		expect(screen.getByTestId("toast-count").textContent).toBe("0");
	});

	it("renders toast primitive slots and close behavior", () => {
		const onOpenChange = vi.fn();
		render(
			<ToastProvider>
				<Toast open duration={1000} onOpenChange={onOpenChange} variant="destructive">
					<ToastTitle>Title</ToastTitle>
					<ToastDescription>Description</ToastDescription>
					<ToastAction altText="Retry">Retry</ToastAction>
					<ToastClose />
				</Toast>
				<ToastViewport />
			</ToastProvider>,
		);
		expect(screen.getByText("Title")).toBeTruthy();
		fireEvent.mouseEnter(screen.getByText("Title"));
		fireEvent.mouseLeave(screen.getByText("Title"));
	});
});

describe("providers and frontend hooks", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("subscribes AuthProvider to the auth client and exposes context actions", async () => {
		const unsubscribe = vi.fn();
		const subscribe = vi.spyOn(authClient, "subscribe").mockImplementation((listener) => {
			listener({status: "unauthenticated", user: null, error: null});
			return unsubscribe;
		});
		vi.spyOn(authClient, "getSnapshot").mockReturnValue({status: "loading", user: null, error: null});
		vi.spyOn(authClient, "bootstrap").mockResolvedValue(undefined);
		vi.spyOn(authClient, "beginGoogleLogin").mockImplementation(() => undefined);
		vi.spyOn(authClient, "logout").mockResolvedValue(undefined);
		vi.spyOn(authClient, "refreshUser").mockResolvedValue(undefined);

		function Consumer() {
			const context = React.useContext(AuthContext);
			return (
				<div>
					<span>{context.status}</span>
					<button type="button" onClick={context.beginGoogleLogin}>Google</button>
					<button type="button" onClick={() => void context.logout()}>Logout</button>
					<button type="button" onClick={() => void context.refreshUser()}>Refresh</button>
				</div>
			);
		}

		const {unmount} = render(<AuthProvider><Consumer /></AuthProvider>);
		expect(screen.getByText("unauthenticated")).toBeTruthy();
		fireEvent.click(screen.getByText("Google"));
		fireEvent.click(screen.getByText("Logout"));
		fireEvent.click(screen.getByText("Refresh"));
		expect(subscribe).toHaveBeenCalled();
		expect(authClient.bootstrap).toHaveBeenCalled();
		unmount();
		expect(unsubscribe).toHaveBeenCalled();
	});

	it("tracks appearance mode, storage, and media-query changes", () => {
		const listeners: Array<() => void> = [];
		const matchMedia = vi.fn(() => ({
			matches: false,
			addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
			removeEventListener: vi.fn(),
		}));
		Object.defineProperty(window, "matchMedia", {configurable: true, value: matchMedia});
		window.localStorage.setItem("didactio.appearance", "system");

		render(<AppearanceProvider><AppearanceHarness /></AppearanceProvider>);
		expect(screen.getByTestId("resolved").textContent).toBe("light");
		fireEvent.click(screen.getByText("Dark"));
		expect(screen.getByTestId("mode").textContent).toBe("dark");
		expect(window.localStorage.getItem("didactio.appearance")).toBe("dark");
	});

	it("streams generation run blocks, de-duplicates partials, cancels, and reports errors", async () => {
		vi.mocked(dashboardApi.streamGenerationRun).mockImplementation(async (_runId, options) => {
			options.onPartialHtmlBlock?.({block: {id: "b1", type: "paragraph", html: "<p>One</p>", textLength: 3, textStartOffset: 0, textEndOffset: 3}});
			options.onPartialHtmlBlock?.({block: {id: "b1", type: "paragraph", html: "<p>One</p>", textLength: 3, textStartOffset: 0, textEndOffset: 3}});
			return {run: {id: "run", stage: "chapter", status: "completed", emittedBlocks: [{id: "b2", type: "paragraph", html: "<p>Two</p>", textLength: 3, textStartOffset: 0, textEndOffset: 3}]}} as never;
		});

		render(<StreamHarness />);
		fireEvent.click(screen.getByText("Start"));
		await waitFor(() => expect(screen.getByTestId("run").textContent).toBe("run"));
		expect(screen.getByTestId("blocks").textContent).toBe("b2");

		vi.mocked(dashboardApi.streamGenerationRun).mockRejectedValueOnce(new Error("Network down"));
		fireEvent.click(screen.getByText("Start"));
		await waitFor(() => expect(screen.getByTestId("error").textContent).toBe("Network down"));
		fireEvent.click(screen.getByText("Cancel"));
		expect(screen.getByTestId("streaming").textContent).toBe("false");
	});

	it("returns subject styles and falls back to mathematics", () => {
		expect(subjectStyles["Computer Science"].accentColor).toBe("#818CF8");
		expect(getSubjectStyle("Biology").iconColor).toBe("#16A34A");
		expect(getSubjectStyle("Unknown")).toBe(subjectStyles.Mathematics);
	});
});
