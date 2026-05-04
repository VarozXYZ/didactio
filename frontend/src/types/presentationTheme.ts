import type {StylePresetId} from "../dashboard/utils/typography";

export type PresentationFont =
	| "inter"
	| "lexend"
	| "eb-garamond"
	| "crimson-pro"
	| "dm-sans"
	// Legacy values kept for backward compatibility
	| "merriweather"
	| "source-serif"
	| "system-sans"
	| "system-serif"
	| "system-mono"
	| "space-grotesk"
	| "atkinson"
	| "fraunces"
	| "cormorant"
	| "literata"
	| "epilogue";

export type PresentationSizeProfile = "small" | "regular" | "large";
export type PresentationHeadingScale = "compact" | "balanced" | "display";
export type PresentationParagraphSpacing = "tight" | "normal" | "relaxed";
export type PresentationParagraphAlign =
	| "left"
	| "center"
	| "right"
	| "justify";

export interface PresentationTheme {
	stylePreset?: StylePresetId;
	bodyFont: PresentationFont;
	headingFont: PresentationFont;
	bodyFontSize: PresentationSizeProfile;
	lineHeight: number;
	bodyColor: string;
	headingColor: string;
	accentColor: string;
	blockquoteAccent: string;
	codeBackground: string;
	pageBackground: string;
	paragraphAlign: PresentationParagraphAlign;
	headingScale: PresentationHeadingScale;
	paragraphSpacing: PresentationParagraphSpacing;
	// Extended color palette (set from preset)
	numberColor?: string;
	codeAccentColor?: string;
	codeBorderColor?: string;
	codeHeaderBackground?: string;
}

export const SYSTEM_DEFAULT_THEME: PresentationTheme = {
	stylePreset: "classic",
	bodyFont: "crimson-pro",
	headingFont: "eb-garamond",
	bodyFontSize: "regular",
	lineHeight: 1.6,
	bodyColor: "#1D1D1F",
	headingColor: "#2A1A0A",
	accentColor: "#996633",
	blockquoteAccent: "#C4A070",
	codeBackground: "#F7EEE4",
	pageBackground: "#FDFAF7",
	paragraphAlign: "justify",
	headingScale: "balanced",
	paragraphSpacing: "normal",
	numberColor: "#D4B896",
	codeAccentColor: "#7A4E28",
	codeBorderColor: "#E4D0BC",
	codeHeaderBackground: "#EEE1D0",
};
