import type {CSSProperties} from "react";
import {
	SYSTEM_DEFAULT_THEME,
	type PresentationTheme,
} from "../../types/presentationTheme";
import {FONT_CATALOG, CLASSIC_BODY_SIZES, type FontId} from "./typography";

function fontFamily(font: string): string {
	if (font in FONT_CATALOG) {
		return FONT_CATALOG[font as FontId].family;
	}

	switch (font) {
		case "eb-garamond":
			return "EB Garamond, Georgia, serif";
		case "crimson-pro":
			return "Crimson Pro, Georgia, serif";
		case "dm-sans":
			return "DM Sans, sans-serif";
		case "system-serif":
			return "Georgia, Cambria, serif";
		case "system-mono":
			return "ui-monospace, SFMono-Regular, Menlo, monospace";
		case "source-serif":
		case "merriweather":
			return "Merriweather, Georgia, serif";
		case "space-grotesk":
			return "Space Grotesk, sans-serif";
		case "fraunces":
			return "Source Serif 4, serif";
		case "cormorant":
			return "Cormorant Garamond, serif";
		case "literata":
			return "Literata, serif";
		case "epilogue":
			return "Epilogue, sans-serif";
		case "atkinson":
			return "Atkinson Hyperlegible, sans-serif";
		case "system-sans":
		default:
			return FONT_CATALOG.inter.family;
	}
}

function bodySize(size: PresentationTheme["bodyFontSize"], stylePreset?: string): string {
	if (stylePreset === "classic") {
		return `${CLASSIC_BODY_SIZES[size as keyof typeof CLASSIC_BODY_SIZES]?.desktop ?? 17}px`;
	}
	switch (size) {
		case "small":  return "14px";
		case "large":  return "18px";
		default:       return "16px";
	}
}

function headingScale(scale: PresentationTheme["headingScale"]): string {
	switch (scale) {
		case "compact":
			return "0.92";
		case "display":
			return "1.12";
		case "balanced":
		default:
			return "1";
	}
}

function paragraphMargin(
	spacing: PresentationTheme["paragraphSpacing"],
): string {
	switch (spacing) {
		case "tight":
			return "0.45em 0";
		case "relaxed":
			return "0.9em 0";
		case "normal":
		default:
			return "0.65em 0";
	}
}

export function resolvePresentationTheme(
	unitTheme?: PresentationTheme | null,
	userTheme?: PresentationTheme | null,
): PresentationTheme {
	return unitTheme ?? userTheme ?? SYSTEM_DEFAULT_THEME;
}

export function themeVars(theme: PresentationTheme): CSSProperties {
	return {
		"--unit-body-font": fontFamily(theme.bodyFont),
		"--unit-heading-font": fontFamily(theme.headingFont),
		"--unit-body-size": bodySize(theme.bodyFontSize, theme.stylePreset),
		"--unit-line-height": String(theme.lineHeight),
		"--unit-body-color": theme.bodyColor,
		"--unit-heading-color": theme.headingColor,
		"--unit-accent-color": theme.accentColor,
		"--unit-blockquote-accent": theme.blockquoteAccent,
		"--unit-code-bg": theme.codeBackground,
		"--unit-page-bg": theme.pageBackground,
		"--unit-paragraph-align": theme.paragraphAlign,
		"--unit-heading-scale": headingScale(theme.headingScale),
		"--unit-paragraph-margin": paragraphMargin(theme.paragraphSpacing),
		"--unit-number-color": theme.numberColor ?? "#D4B896",
		"--unit-code-accent": theme.codeAccentColor ?? "#7A4E28",
		"--unit-code-border": theme.codeBorderColor ?? "#E4D0BC",
		"--unit-code-header-bg": theme.codeHeaderBackground ?? "#EEE1D0",
	} as CSSProperties;
}
