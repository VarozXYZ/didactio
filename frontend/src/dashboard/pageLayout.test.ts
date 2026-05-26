import {describe, expect, it} from "vitest";
import {calculateSpreadMetrics} from "./pageLayout";

describe("calculateSpreadMetrics", () => {
	it("uses more horizontal room for compact desktop two-page spreads", () => {
		const compactDesktop = calculateSpreadMetrics({
			viewportHeight: 768,
			viewportWidth: 1536,
		});

		expect(compactDesktop.pagesPerSpread).toBe(2);
		expect(compactDesktop.pageHeight).toBe(626);
		expect(compactDesktop.pageWidth).toBeGreaterThan(570);
		expect(compactDesktop.spreadWidth).toBeGreaterThan(1160);
	});

	it("keeps the regular desktop reading ratio on larger viewports", () => {
		const desktop = calculateSpreadMetrics({
			viewportHeight: 900,
			viewportWidth: 1800,
		});

		expect(desktop.pagesPerSpread).toBe(2);
		expect(desktop.pageWidth / desktop.pageHeight).toBeCloseTo(0.76);
	});
});
