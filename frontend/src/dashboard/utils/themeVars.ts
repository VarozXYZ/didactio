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

function tableSurface(stylePreset?: string): string {
	switch (stylePreset) {
		case "modern":
			return "#F0F8F6";
		case "plain":
			return "#FAFBFC";
		case "classic":
		default:
			return "#FFF8EF";
	}
}

function tableHeaderSurface(stylePreset?: string): string {
	switch (stylePreset) {
		case "modern":
			return "#DFF3EE";
		case "plain":
			return "#F1F5F9";
		case "classic":
		default:
			return "#F3E5D3";
	}
}

function tableBorder(stylePreset?: string): string {
	switch (stylePreset) {
		case "modern":
			return "#B7DCD1";
		case "plain":
			return "#CBD5E1";
		case "classic":
		default:
			return "#DEC7AE";
	}
}

function darkTableSurface(stylePreset?: string): string {
	switch (stylePreset) {
		case "modern":
			return "#172C28";
		case "plain":
			return "#1B2230";
		case "classic":
		default:
			return "#2A211B";
	}
}

function darkTableHeaderSurface(stylePreset?: string): string {
	switch (stylePreset) {
		case "modern":
			return "#1E3A34";
		case "plain":
			return "#263142";
		case "classic":
		default:
			return "#3A2B20";
	}
}

function darkTableBorder(stylePreset?: string): string {
	switch (stylePreset) {
		case "modern":
			return "#2E5F53";
		case "plain":
			return "#3B4A60";
		case "classic":
		default:
			return "#5A4433";
	}
}

function darkDisplayTheme(theme: PresentationTheme): PresentationTheme {
	switch (theme.stylePreset) {
		case "modern":
			return {
				...theme,
				bodyColor: "#D7E4E1",
				headingColor: "#E6EAF0",
				accentColor: "#4ADE80",
				blockquoteAccent: "#2B725D",
				codeBackground: "#111B1A",
				pageBackground: "#17201F",
				numberColor: "#29594B",
				codeAccentColor: "#62D795",
				codeBorderColor: "#29453C",
				codeHeaderBackground: "#1B2B27",
			};
		case "plain":
			return {
				...theme,
				bodyColor: "#D4DAE4",
				headingColor: "#F1F4F8",
				accentColor: "#73A7FF",
				blockquoteAccent: "#445064",
				codeBackground: "#111820",
				pageBackground: "#171B22",
				numberColor: "#465064",
				codeAccentColor: "#8BB5FF",
				codeBorderColor: "#313C4D",
				codeHeaderBackground: "#202733",
			};
		case "classic":
		default:
			return {
				...theme,
				bodyColor: "#E0D7CF",
				headingColor: "#F4E8DC",
				accentColor: "#D8AF82",
				blockquoteAccent: "#755C45",
				codeBackground: "#211C18",
				pageBackground: "#1C1917",
				numberColor: "#765D46",
				codeAccentColor: "#DFB586",
				codeBorderColor: "#49392D",
				codeHeaderBackground: "#29221D",
			};
	}
}

export function resolvePresentationTheme(
	unitTheme?: PresentationTheme | null,
	userTheme?: PresentationTheme | null,
): PresentationTheme {
	return unitTheme ?? userTheme ?? SYSTEM_DEFAULT_THEME;
}

export function themeVars(theme: PresentationTheme, darkDisplay = false): CSSProperties {
	const displayTheme = darkDisplay ? darkDisplayTheme(theme) : theme;
	return {
		"--unit-body-font": fontFamily(displayTheme.bodyFont),
		"--unit-heading-font": fontFamily(displayTheme.headingFont),
		"--unit-body-size": bodySize(displayTheme.bodyFontSize, displayTheme.stylePreset),
		"--unit-line-height": String(displayTheme.lineHeight),
		"--unit-body-color": displayTheme.bodyColor,
		"--unit-heading-color": displayTheme.headingColor,
		"--unit-accent-color": displayTheme.accentColor,
		"--unit-blockquote-accent": displayTheme.blockquoteAccent,
		"--unit-code-bg": displayTheme.codeBackground,
		"--unit-page-bg": displayTheme.pageBackground,
		"--unit-paragraph-align": displayTheme.paragraphAlign,
		"--unit-heading-scale": headingScale(displayTheme.headingScale),
		"--unit-paragraph-margin": paragraphMargin(displayTheme.paragraphSpacing),
		"--unit-number-color": displayTheme.numberColor ?? "#D4B896",
		"--unit-code-accent": displayTheme.codeAccentColor ?? "#7A4E28",
		"--unit-code-border": displayTheme.codeBorderColor ?? "#E4D0BC",
		"--unit-code-header-bg": displayTheme.codeHeaderBackground ?? "#EEE1D0",
		"--unit-table-bg":
			darkDisplay ? darkTableSurface(displayTheme.stylePreset) : tableSurface(displayTheme.stylePreset),
		"--unit-table-header-bg":
			darkDisplay ? darkTableHeaderSurface(displayTheme.stylePreset) : tableHeaderSurface(displayTheme.stylePreset),
		"--unit-table-border":
			darkDisplay ? darkTableBorder(displayTheme.stylePreset) : tableBorder(displayTheme.stylePreset),
	} as CSSProperties;
}
