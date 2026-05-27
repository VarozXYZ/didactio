import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import {EditorFirstRunGuide} from "@/components/dashboard/editor/UnitEditorChrome";

describe("EditorFirstRunGuide", () => {
	afterEach(() => {
		cleanup();
	});

	it("skips tutorial targets that are unavailable before generated pages exist", () => {
		render(
			<>
				<div data-editor-tour="modules" />
				<div data-editor-tour="header-actions" />
				<div data-editor-tour="sidebar-actions" />
				<EditorFirstRunGuide
					isMobile={false}
					onOpenChange={() => undefined}
					open
				/>
			</>,
		);

		expect(screen.getByText("Module outline")).toBeTruthy();
		fireEvent.click(screen.getByText("Next"));
		expect(screen.getByText("Tools")).toBeTruthy();
	});
});
