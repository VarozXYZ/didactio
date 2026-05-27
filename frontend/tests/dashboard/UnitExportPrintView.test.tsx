import {cleanup, render} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import {UnitExportPrintView} from "@/components/dashboard/editor/UnitExportPrintView";
import type {UnitExportSnapshot} from "@/dashboard/export/unitExport";

function createSnapshot(): UnitExportSnapshot {
	return {
		exportedAt: "2026-05-27T00:00:00.000Z",
		modules: [
			{
				chapterIndex: 0,
				title: "Module one",
				overview: "Overview",
				html: "<p>Readable export content</p>",
				state: "ready",
				activities: [],
			},
		],
		skippedModules: [],
		unit: {
			title: "Exported unit",
			overview: "Export overview",
			presentationTheme: null,
		} as UnitExportSnapshot["unit"],
	};
}

describe("UnitExportPrintView", () => {
	afterEach(() => {
		cleanup();
		document.documentElement.removeAttribute("data-app-theme");
		document.documentElement.removeAttribute("data-app-themed");
	});

	it("provides light content variables when opened from dark mode", () => {
		document.documentElement.setAttribute("data-app-theme", "dark");
		document.documentElement.setAttribute("data-app-themed", "true");

		const {container} = render(
			<UnitExportPrintView
				onClose={() => undefined}
				onPrint={() => undefined}
				snapshot={createSnapshot()}
			/>,
		);
		const root = container.querySelector(".unit-print-root") as HTMLElement;

		expect(root.style.getPropertyValue("--unit-body-color")).toBe("#2F3137");
		expect(root.style.getPropertyValue("--unit-heading-color")).toBe("#1D1D1F");
		expect(root.style.getPropertyValue("--unit-page-bg")).toBe("#FFFFFF");
	});
});
