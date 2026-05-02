export type PresentationFont =
	| "inter"
	| "merriweather"
	| "source-serif"
	| "system-sans"
	| "system-serif"
	| "system-mono";

export type PresentationSizeProfile = "small" | "regular" | "large";
export type PresentationHeadingScale = "compact" | "balanced" | "display";
export type PresentationParagraphSpacing = "tight" | "normal" | "relaxed";
export type PresentationParagraphAlign =
	| "left"
	| "center"
	| "right"
	| "justify";

export interface PresentationTheme {
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
}

export const SYSTEM_DEFAULT_THEME: PresentationTheme = {
	bodyFont: "inter",
	headingFont: "inter",
	bodyFontSize: "regular",
	lineHeight: 1.6,
	bodyColor: "#1D1D1F",
	headingColor: "#111827",
	accentColor: "#2563EB",
	blockquoteAccent: "#CBD5E1",
	codeBackground: "#F4F4F5",
	pageBackground: "#FFFFFF",
	paragraphAlign: "left",
	headingScale: "balanced",
	paragraphSpacing: "normal",
};
