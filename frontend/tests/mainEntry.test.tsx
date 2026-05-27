import type {ReactNode} from "react";
import {describe, expect, it, vi} from "vitest";

const render = vi.fn();
const createRoot = vi.fn(() => ({render}));

vi.mock("react-dom/client", () => ({createRoot}));
vi.mock("@/App", () => ({
	default: () => <div>App root</div>,
}));
vi.mock("@/components/auth/AuthProvider", () => ({
	AuthProvider: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));
vi.mock("@/components/shared/AppearanceProvider", () => ({
	AppearanceProvider: ({children}: {children: ReactNode}) => <div>{children}</div>,
}));
vi.mock("@/components/ui/toaster", () => ({
	Toaster: () => <div>Toaster root</div>,
}));
vi.mock("streamdown/styles.css", () => ({}));
vi.mock("@/index.css", () => ({}));

describe("main entrypoint", () => {
	it("mounts the app into the root element", async () => {
		const root = document.createElement("div");
		root.id = "root";
		document.body.append(root);

		await import("../src/main");

		expect(createRoot).toHaveBeenCalledWith(root);
		expect(render).toHaveBeenCalledTimes(1);
	});
});
