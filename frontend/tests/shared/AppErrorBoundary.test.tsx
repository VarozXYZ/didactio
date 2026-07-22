import {fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {AppErrorBoundary} from "@/components/shared/AppErrorBoundary";

function BrokenChild(): never {
		throw new Error("private implementation detail");
}

describe("AppErrorBoundary", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows a generic recovery action without leaking the error", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		render(
			<AppErrorBoundary>
				<BrokenChild />
			</AppErrorBoundary>,
		);

		expect(screen.getByRole("alert")).toBeTruthy();
		expect(screen.getByText("Something went wrong")).toBeTruthy();
		expect(screen.queryByText("private implementation detail")).toBeNull();
		fireEvent.click(screen.getByRole("button", {name: "Reload page"}));
	});
});
