import {
	SYSTEM_DEFAULT_THEME,
	type PresentationFont,
	type PresentationHeadingScale,
	type PresentationParagraphAlign,
	type PresentationParagraphSpacing,
	type PresentationSizeProfile,
	type PresentationTheme,
	type StylePresetId,
} from "./types.js";

const FONTS: PresentationFont[] = [
	"inter",
	"lexend",
	"eb-garamond",
	"crimson-pro",
	"dm-sans",
	// Legacy values kept for backward compatibility
	"merriweather",
	"source-serif",
	"system-sans",
	"system-serif",
	"system-mono",
	"space-grotesk",
	"atkinson",
	"fraunces",
	"cormorant",
	"literata",
	"epilogue",
];

const STYLE_PRESETS: StylePresetId[] = [
	"modern",
	"classic",
	"plain",
];
const SIZE_PROFILES: PresentationSizeProfile[] = ["small", "regular", "large"];
const HEADING_SCALES: PresentationHeadingScale[] = [
	"compact",
	"balanced",
	"display",
];
const PARAGRAPH_SPACINGS: PresentationParagraphSpacing[] = [
	"tight",
	"normal",
	"relaxed",
];
const PARAGRAPH_ALIGNS: PresentationParagraphAlign[] = [
	"left",
	"center",
	"right",
	"justify",
];
const NAMED_COLORS = new Set([
	"black",
	"white",
	"transparent",
	"currentcolor",
	"red",
	"green",
	"blue",
	"gray",
	"grey",
	"slategray",
	"rebeccapurple",
]);

function parseEnum<T extends string>(
	value: unknown,
	fieldName: string,
	allowed: readonly T[],
): T {
	if (typeof value !== "string" || !allowed.includes(value as T)) {
		throw new Error(`${fieldName} is invalid.`);
	}

	return value as T;
}

function parseLineHeight(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error("lineHeight must be a number.");
	}
	if (value < 1.2 || value > 2) {
		throw new Error("lineHeight must be between 1.2 and 2.0.");
	}

	return value;
}

function parseColor(value: unknown, fieldName: string): string {
	if (typeof value !== "string") {
		throw new Error(`${fieldName} must be a color string.`);
	}

	const color = value.trim();
	const lower = color.toLowerCase();
	if (
		/[<>&]/.test(color) ||
		lower.includes("url(") ||
		lower.includes("expression(") ||
		lower.includes("var(")
	) {
		throw new Error(`${fieldName} is invalid.`);
	}

	if (
		/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) ||
		/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color) ||
		/^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color) ||
		NAMED_COLORS.has(lower)
	) {
		return color;
	}

	throw new Error(`${fieldName} is invalid.`);
}

export function parsePresentationTheme(value: unknown): PresentationTheme {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("presentationTheme must be a JSON object.");
	}

	const payload = value as Record<string, unknown>;
	const stylePreset =
		payload.stylePreset !== undefined &&
		payload.stylePreset !== null ?
			parseEnum(payload.stylePreset, "stylePreset", STYLE_PRESETS)
		:	undefined;
	return {
		...(stylePreset !== undefined ? {stylePreset} : {}),
		bodyFont: parseEnum(payload.bodyFont, "bodyFont", FONTS),
		headingFont: parseEnum(payload.headingFont, "headingFont", FONTS),
		bodyFontSize: parseEnum(
			payload.bodyFontSize,
			"bodyFontSize",
			SIZE_PROFILES,
		),
		lineHeight: parseLineHeight(payload.lineHeight),
		bodyColor: parseColor(payload.bodyColor, "bodyColor"),
		headingColor: parseColor(payload.headingColor, "headingColor"),
		accentColor: parseColor(payload.accentColor, "accentColor"),
		blockquoteAccent: parseColor(
			payload.blockquoteAccent,
			"blockquoteAccent",
		),
		codeBackground: parseColor(payload.codeBackground, "codeBackground"),
		pageBackground: parseColor(payload.pageBackground, "pageBackground"),
		paragraphAlign: parseEnum(
			payload.paragraphAlign,
			"paragraphAlign",
			PARAGRAPH_ALIGNS,
		),
		headingScale: parseEnum(
			payload.headingScale,
			"headingScale",
			HEADING_SCALES,
		),
		paragraphSpacing: parseEnum(
			payload.paragraphSpacing,
			"paragraphSpacing",
			PARAGRAPH_SPACINGS,
		),
		...(payload.numberColor ?
			{numberColor: parseColor(payload.numberColor, "numberColor")}
		:	{}),
		...(payload.codeAccentColor ?
			{
				codeAccentColor: parseColor(
					payload.codeAccentColor,
					"codeAccentColor",
				),
			}
		:	{}),
		...(payload.codeBorderColor ?
			{
				codeBorderColor: parseColor(
					payload.codeBorderColor,
					"codeBorderColor",
				),
			}
		:	{}),
		...(payload.codeHeaderBackground ?
			{
				codeHeaderBackground: parseColor(
					payload.codeHeaderBackground,
					"codeHeaderBackground",
				),
			}
		:	{}),
	};
}

export function normalizePresentationTheme(
	value: PresentationTheme | undefined,
): PresentationTheme {
	return value ? parsePresentationTheme(value) : {...SYSTEM_DEFAULT_THEME};
}
