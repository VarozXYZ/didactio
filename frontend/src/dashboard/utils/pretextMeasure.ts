import {
	prepareWithSegments,
	walkLineRanges,
	materializeLineRange,
	measureLineStats,
	type PreparedTextWithSegments,
} from "@chenglou/pretext";
import type {PhrasingContent} from "mdast";
import type {ResolvedTypography} from "./typography";


export type BlockMeasurement = {
	prepared: PreparedTextWithSegments;
	lineHeightPx: number;
	marginTopPx: number;
	marginBottomPx: number;
};


function makeBlock(
	plainText: string,
	fontString: string,
	lineHeightPx: number,
	marginTopPx: number,
	marginBottomPx: number,
): BlockMeasurement {
	const safeText = plainText.trim() || " ";
	return {
		prepared: prepareWithSegments(safeText, fontString),
		lineHeightPx,
		marginTopPx,
		marginBottomPx,
	};
}

export function prepareParagraphBlock(
	_inlineChildren: readonly PhrasingContent[] | undefined,
	plainText: string,
	typography: ResolvedTypography,
): BlockMeasurement {
	return makeBlock(
		plainText,
		typography.inline.normal,
		typography.body.sizePx * typography.body.lineHeight,
		0,
		typography.body.marginBottomPx,
	);
}

export function prepareH1Block(
	_inlineChildren: readonly PhrasingContent[] | undefined,
	plainText: string,
	typography: ResolvedTypography,
): BlockMeasurement {
	const h = typography.h1;
	return makeBlock(
		plainText,
		h.fontString,
		h.sizePx * h.lineHeight,
		h.marginTopPx,
		h.marginBottomPx,
	);
}

export function prepareH2Block(
	_inlineChildren: readonly PhrasingContent[] | undefined,
	plainText: string,
	typography: ResolvedTypography,
): BlockMeasurement {
	const h = typography.h2;
	return makeBlock(
		plainText,
		h.fontString,
		h.sizePx * h.lineHeight,
		h.marginTopPx,
		h.marginBottomPx,
	);
}

export function prepareH3Block(
	_inlineChildren: readonly PhrasingContent[] | undefined,
	plainText: string,
	typography: ResolvedTypography,
): BlockMeasurement {
	const h = typography.h3;
	return makeBlock(
		plainText,
		h.fontString,
		h.sizePx * h.lineHeight,
		h.marginTopPx,
		h.marginBottomPx,
	);
}

export function prepareListItemBlock(
	_inlineChildren: readonly PhrasingContent[] | undefined,
	plainText: string,
	typography: ResolvedTypography,
): BlockMeasurement {
	return makeBlock(
		plainText,
		typography.inline.normal,
		typography.body.sizePx * typography.listItem.lineHeight,
		0,
		typography.listItem.marginBottomPx,
	);
}

export function measureBlockHeight(
	measurement: BlockMeasurement,
	contentWidth: number,
): number {
	if (contentWidth <= 0) return 0;
	const {lineCount} = measureLineStats(measurement.prepared, contentWidth);
	return (
		measurement.marginTopPx +
		lineCount * measurement.lineHeightPx +
		measurement.marginBottomPx
	);
}

export function blockLineCount(
	measurement: BlockMeasurement,
	contentWidth: number,
): number {
	return measureLineStats(measurement.prepared, contentWidth).lineCount;
}

export function getBlockLines(
	measurement: BlockMeasurement,
	contentWidth: number,
): string[] {
	const lines: string[] = [];
	walkLineRanges(measurement.prepared, contentWidth, (lineRange) => {
		const line = materializeLineRange(measurement.prepared, lineRange);
		lines.push(line.text);
	});
	return lines;
}

export function splitBlockAtLines(
	measurement: BlockMeasurement,
	contentWidth: number,
	fittingLineCount: number,
): {fittingText: string; remainderText: string} {
	const lines = getBlockLines(measurement, contentWidth);
	const fitting = lines.slice(0, fittingLineCount).join(" ").trim();
	const remainder = lines.slice(fittingLineCount).join(" ").trim();
	return {fittingText: fitting, remainderText: remainder};
}
