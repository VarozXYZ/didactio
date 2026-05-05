// Typography configuration — single source of truth for all font/size/margin
// values used in both the editor UI and the Pretext measurement engine.
// When adding a new font or adjusting sizes, change it here only.
// index.css prose rules reference the CSS custom properties produced by
// makeTypographyVars() so the visual output always agrees with measurements.

export const FONT_CATALOG = {
	inter: {
		label: "Inter",
		family: "Inter",
		category: "sans-serif",
		googleId: null,
	},
	lexend: {
		label: "Lexend",
		family: "Lexend",
		category: "sans-serif",
		googleId: "Lexend:wght@400;500;600;700",
	},
	ebGaramond: {
		label: "EB Garamond",
		family: "EB Garamond",
		category: "serif",
		googleId: "EB+Garamond:ital,wght@0,400;0,600;0,700;1,400",
	},
	crimsonPro: {
		label: "Crimson Pro",
		family: "Crimson Pro",
		category: "serif",
		googleId: "Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600",
	},
	dmSans: {
		label: "DM Sans",
		family: "DM Sans",
		category: "sans-serif",
		googleId: "DM+Sans:wght@400;500;600;700",
	},
} as const;

export type FontId = keyof typeof FONT_CATALOG;

export interface StylePreset {
	label: string;
	variant: string;
	heading: FontId;
	body: FontId;
	pageBackground: string;
	accentColor: string;
	headingColor: string;
	numberColor: string;
	codeBackground: string;
	codeBorderColor: string;
	codeHeaderBackground: string;
	codeAccentColor: string;
	blockquoteAccent: string;
}

export const STYLE_PRESETS: Record<string, StylePreset> = {
	modern: {
		label: "Modern",
		variant: "",
		heading: "lexend",
		body: "inter",
		pageBackground: "#F6FAFB",
		accentColor: "#4ADE80",
		headingColor: "#1A3832",
		numberColor: "#BBF7D0",
		codeBackground: "#E9F5F3",
		codeBorderColor: "#86EFAC",
		codeHeaderBackground: "#DCFCE7",
		codeAccentColor: "#22C55E",
		blockquoteAccent: "#6EE7B7",
	},
	classic: {
		label: "Classic",
		variant: "",
		heading: "ebGaramond",
		body: "crimsonPro",
		pageBackground: "#FDFAF7",
		accentColor: "#996633",
		headingColor: "#2A1A0A",
		numberColor: "#D4B896",
		codeBackground: "#F7EEE4",
		codeBorderColor: "#E4D0BC",
		codeHeaderBackground: "#EEE1D0",
		codeAccentColor: "#7A4E28",
		blockquoteAccent: "#C4A070",
	},
	plain: {
		label: "Plain",
		variant: "",
		heading: "dmSans",
		body: "dmSans",
		pageBackground: "#FFFFFF",
		accentColor: "#2563EB",
		headingColor: "#111827",
		numberColor: "#C8C8C8",
		codeBackground: "#F6F8FA",
		codeBorderColor: "#D0D7DE",
		codeHeaderBackground: "#EAEEF2",
		codeAccentColor: "#2563EB",
		blockquoteAccent: "#CBD5E1",
	},
} as const;

export type StylePresetId = "modern" | "classic" | "plain";

export type SizeProfile = "small" | "regular" | "large";

// Classic serif fonts render optically smaller; these offsets are applied to
// body font size everywhere (measurement + CSS vars) so both stay in sync.
export const CLASSIC_BODY_SIZES: Record<SizeProfile, {mobile: number; desktop: number}> = {
	small:   {mobile: 14, desktop: 15},
	regular: {mobile: 15, desktop: 17},
	large:   {mobile: 17, desktop: 19},
};

const SIZE_PROFILES: Record<
	SizeProfile,
	{
		body: {mobile: number; desktop: number};
		h1: {mobile: number; desktop: number};
		h2: {mobile: number; desktop: number};
		h3: {mobile: number; desktop: number};
	}
> = {
	small: {
		body: {mobile: 13, desktop: 14},
		h1: {mobile: 18, desktop: 20},
		h2: {mobile: 16, desktop: 17},
		h3: {mobile: 14, desktop: 16},
	},
	regular: {
		body: {mobile: 14, desktop: 16},
		h1: {mobile: 22, desktop: 24},
		h2: {mobile: 18, desktop: 20},
		h3: {mobile: 16, desktop: 18},
	},
	large: {
		body: {mobile: 16, desktop: 18},
		h1: {mobile: 24, desktop: 27},
		h2: {mobile: 20, desktop: 23},
		h3: {mobile: 18, desktop: 20},
	},
};

const LINE_HEIGHT_BODY = 1.9;
const LINE_HEIGHT_HEADING = 1.25;
const MARGIN_BOTTOM_BODY_EM = 0.8;
const MARGIN_TOP_H2_EM = 1.2;
const MARGIN_BOTTOM_H2_EM = 0.5;
const MARGIN_TOP_H3_EM = 1.0;
const MARGIN_BOTTOM_H3_EM = 0.4;
const LIST_MARGIN_TOP_EM = 0.5;
const LIST_MARGIN_BOTTOM_EM = 0.8;
const LIST_PADDING_LEFT_EM = 1.2;
const LIST_ITEM_MARGIN_EM = 0.3;
const CODE_FONT_SIZE_EM = 0.92;
const CODE_PADDING_H_EM = 0.35;
const BLOCKQUOTE_INDENT_EM = 1.0;
const BLOCKQUOTE_BORDER_PX = 4;

function cssFont(
	weight: number,
	sizePx: number,
	family: string,
	italic = false,
): string {
	return `${italic ? "italic " : ""}${weight} ${sizePx}px ${family}`;
}

export type InlineFontContext = {
	normal: string;
	bold: string;
	italic: string;
	boldItalic: string;
	code: string;
	codePaddingPx: number;
};

export type ResolvedTypography = {
	body: {
		family: string;
		sizePx: number;
		lineHeight: number;
		marginBottomPx: number;
	};
	inline: InlineFontContext;
	h1: {
		family: string;
		sizePx: number;
		lineHeight: number;
		marginTopPx: number;
		marginBottomPx: number;
		fontString: string;
	};
	h2: {
		family: string;
		sizePx: number;
		lineHeight: number;
		marginTopPx: number;
		marginBottomPx: number;
		fontString: string;
		boldFontString: string;
	};
	h3: {
		family: string;
		sizePx: number;
		lineHeight: number;
		marginTopPx: number;
		marginBottomPx: number;
		fontString: string;
		boldFontString: string;
	};
	list: {marginTopPx: number; marginBottomPx: number; paddingLeftPx: number};
	listItem: {marginBottomPx: number; lineHeight: number};
	blockquote: {paddingLeftPx: number; borderWidthPx: number};
};

export function resolveTypography(settings: {
	sizeProfile: SizeProfile;
	bodyFontId: FontId;
	headingFontId: FontId;
	isMobile: boolean;
	stylePreset?: StylePresetId;
}): ResolvedTypography {
	const {sizeProfile, bodyFontId, headingFontId, isMobile, stylePreset} = settings;
	const profile = SIZE_PROFILES[sizeProfile];
	const rawBodySz = isMobile ? profile.body.mobile : profile.body.desktop;
	const bodySz =
		stylePreset === "classic" ?
			(isMobile ?
				CLASSIC_BODY_SIZES[sizeProfile].mobile
			:	CLASSIC_BODY_SIZES[sizeProfile].desktop)
		:	rawBodySz;
	const h1Sz = isMobile ? profile.h1.mobile : profile.h1.desktop;
	const h2Sz = isMobile ? profile.h2.mobile : profile.h2.desktop;
	const h3Sz = isMobile ? profile.h3.mobile : profile.h3.desktop;

	const bodyFamily = FONT_CATALOG[bodyFontId].family;
	const headingFamily = FONT_CATALOG[headingFontId].family;

	const codeSz = bodySz * CODE_FONT_SIZE_EM;
	const codePaddingPx = bodySz * CODE_PADDING_H_EM * 2;

	return {
		body: {
			family: bodyFamily,
			sizePx: bodySz,
			lineHeight: LINE_HEIGHT_BODY,
			marginBottomPx: bodySz * MARGIN_BOTTOM_BODY_EM,
		},
		inline: {
			normal: cssFont(400, bodySz, bodyFamily),
			bold: cssFont(700, bodySz, bodyFamily),
			italic: cssFont(400, bodySz, bodyFamily, true),
			boldItalic: cssFont(700, bodySz, bodyFamily, true),
			code: cssFont(600, codeSz, "monospace"),
			codePaddingPx,
		},
		h1: {
			family: headingFamily,
			sizePx: h1Sz,
			lineHeight: LINE_HEIGHT_HEADING,
			marginTopPx: h1Sz * MARGIN_TOP_H2_EM,
			marginBottomPx: h1Sz * MARGIN_BOTTOM_H2_EM,
			fontString: cssFont(700, h1Sz, headingFamily),
		},
		h2: {
			family: headingFamily,
			sizePx: h2Sz,
			lineHeight: LINE_HEIGHT_HEADING,
			marginTopPx: h2Sz * MARGIN_TOP_H2_EM,
			marginBottomPx: h2Sz * MARGIN_BOTTOM_H2_EM,
			fontString: cssFont(700, h2Sz, headingFamily),
			boldFontString: cssFont(700, h2Sz, headingFamily),
		},
		h3: {
			family: headingFamily,
			sizePx: h3Sz,
			lineHeight: LINE_HEIGHT_HEADING,
			marginTopPx: h3Sz * MARGIN_TOP_H3_EM,
			marginBottomPx: h3Sz * MARGIN_BOTTOM_H3_EM,
			fontString: cssFont(600, h3Sz, headingFamily),
			boldFontString: cssFont(700, h3Sz, headingFamily),
		},
		list: {
			marginTopPx: bodySz * LIST_MARGIN_TOP_EM,
			marginBottomPx: bodySz * LIST_MARGIN_BOTTOM_EM,
			paddingLeftPx: bodySz * LIST_PADDING_LEFT_EM,
		},
		listItem: {
			marginBottomPx: bodySz * LIST_ITEM_MARGIN_EM,
			lineHeight: LINE_HEIGHT_BODY,
		},
		blockquote: {
			paddingLeftPx: bodySz * BLOCKQUOTE_INDENT_EM,
			borderWidthPx: BLOCKQUOTE_BORDER_PX,
		},
	};
}

// Default resolved typography for read mode (regular profile, classic preset, desktop).
export function defaultTypography(isMobile = false): ResolvedTypography {
	return resolveTypography({
		sizeProfile: "regular",
		bodyFontId: STYLE_PRESETS.classic.body,
		headingFontId: STYLE_PRESETS.classic.heading,
		isMobile,
		stylePreset: "classic",
	});
}

export const TYPO_VARS = {
	bodyFamily: "--typo-body-family",
	bodySize: "--typo-body-size",
	headingFamily: "--typo-heading-family",
	h1Size: "--typo-h1-size",
	h2Size: "--typo-h2-size",
	h3Size: "--typo-h3-size",
} as const;

export function makeTypographyVars(
	resolved: ResolvedTypography,
): Record<string, string> {
	return {
		[TYPO_VARS.bodyFamily]: resolved.body.family,
		[TYPO_VARS.bodySize]: `${resolved.body.sizePx}px`,
		[TYPO_VARS.headingFamily]: resolved.h2.family,
		[TYPO_VARS.h1Size]: `${resolved.h1.sizePx}px`,
		[TYPO_VARS.h2Size]: `${resolved.h2.sizePx}px`,
		[TYPO_VARS.h3Size]: `${resolved.h3.sizePx}px`,
	};
}

export function applyTypographyVars(
	element: HTMLElement,
	resolved: ResolvedTypography,
): void {
	element.style.setProperty(TYPO_VARS.bodyFamily, resolved.body.family);
	element.style.setProperty(TYPO_VARS.bodySize, `${resolved.body.sizePx}px`);
	element.style.setProperty(TYPO_VARS.headingFamily, resolved.h2.family);
	element.style.setProperty(TYPO_VARS.h1Size, `${resolved.h1.sizePx}px`);
	element.style.setProperty(TYPO_VARS.h2Size, `${resolved.h2.sizePx}px`);
	element.style.setProperty(TYPO_VARS.h3Size, `${resolved.h3.sizePx}px`);
	element.style.fontFamily = resolved.body.family;
	element.style.fontSize = `${resolved.body.sizePx}px`;
}
