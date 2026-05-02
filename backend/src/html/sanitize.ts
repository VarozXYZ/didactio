import sanitizeHtml from "sanitize-html";

export interface SanitizeResult {
	html: string;
	isEmpty: boolean;
}

const ALLOWED_TAGS = [
	"h2",
	"h3",
	"h4",
	"p",
	"ul",
	"ol",
	"li",
	"blockquote",
	"pre",
	"code",
	"table",
	"thead",
	"tbody",
	"tr",
	"th",
	"td",
	"hr",
	"br",
	"strong",
	"em",
	"u",
	"a",
	"sub",
	"sup",
	"mark",
];

const INLINE_TAGS = new Set([
	"strong",
	"em",
	"u",
	"code",
	"a",
	"sub",
	"sup",
	"mark",
]);

function slugifyHeading(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function getInternalHosts(): Set<string> {
	return new Set(
		(process.env.INTERNAL_HOSTS ?? "")
			.split(",")
			.map((host) => host.trim().toLowerCase())
			.filter(Boolean),
	);
}

function normalizeHref(href: string | undefined): string | undefined {
	const trimmed = href?.trim();
	if (!trimmed) {
		return undefined;
	}

	if (trimmed.startsWith("#")) {
		return trimmed;
	}

	try {
		const parsed = new URL(trimmed);
		if (
			parsed.protocol === "http:" ||
			parsed.protocol === "https:" ||
			parsed.protocol === "mailto:"
		) {
			return trimmed;
		}
	} catch {
		return undefined;
	}

	return undefined;
}

function isExternalHref(href: string): boolean {
	if (href.startsWith("#") || href.startsWith("mailto:")) {
		return false;
	}

	try {
		const parsed = new URL(href);
		return !getInternalHosts().has(parsed.hostname.toLowerCase());
	} catch {
		return false;
	}
}

function createHeadingTransformer(tagName: "h2" | "h3" | "h4") {
	const usedIds = new Map<string, number>();
	let fallbackIndex = 1;

	return (
		_tagName: string,
		attribs: sanitizeHtml.Attributes,
	): sanitizeHtml.Tag => {
		const rawId = typeof attribs.id === "string" ? attribs.id.trim() : "";
		const validId = /^[a-z0-9][a-z0-9-]*$/.test(rawId) ? rawId : "";
		const baseId = validId || `section-${fallbackIndex}`;
		fallbackIndex += validId ? 0 : 1;
		const seen = usedIds.get(baseId) ?? 0;
		usedIds.set(baseId, seen + 1);

		return {
			tagName,
			attribs: {
				id: seen === 0 ? baseId : `${baseId}-${seen + 1}`,
			},
		};
	};
}

export function sanitizeChapterHtml(rawHtml: string): SanitizeResult {
	const headingTransformers = {
		h2: createHeadingTransformer("h2"),
		h3: createHeadingTransformer("h3"),
		h4: createHeadingTransformer("h4"),
	};

	const html = sanitizeHtml(rawHtml, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			a: ["href", "title", "target", "rel"],
			code: ["class"],
			h2: ["id"],
			h3: ["id"],
			h4: ["id"],
			th: ["scope", "colspan", "rowspan"],
			td: ["colspan", "rowspan"],
		},
		allowedClasses: {
			code: [/^language-[a-z0-9+#-]+$/],
		},
		allowedSchemes: ["http", "https", "mailto"],
		disallowedTagsMode: "discard",
		enforceHtmlBoundary: false,
		transformTags: {
			h1: "h2",
			h5: "h4",
			h6: "h4",
			s: "span",
			strike: "span",
			del: "span",
			ins: "span",
			div: "span",
			section: "span",
			article: "span",
			span: "span",
			h2: headingTransformers.h2,
			h3: headingTransformers.h3,
			h4: headingTransformers.h4,
			a: (_tagName, attribs) => {
				const href = normalizeHref(
					typeof attribs.href === "string" ? attribs.href : undefined,
				);
				const nextAttribs: sanitizeHtml.Attributes = {};

				if (href) {
					nextAttribs.href = href;
				}

				if (typeof attribs.title === "string" && attribs.title.trim()) {
					nextAttribs.title = attribs.title.trim();
				}

				if (href && isExternalHref(href)) {
					nextAttribs.target = "_blank";
					nextAttribs.rel = "noopener noreferrer";
				}

				return {
					tagName: "a",
					attribs: nextAttribs,
				};
			},
			code: (_tagName, attribs) => {
				const className =
					typeof attribs.class === "string" ? attribs.class.trim() : "";
				const nextAttribs: sanitizeHtml.Attributes = {};
				if (/^language-[a-z0-9+#-]+$/.test(className)) {
					nextAttribs.class = className;
				}
				return {
					tagName: "code",
					attribs: nextAttribs,
				};
			},
		},
		exclusiveFilter(frame) {
			if (
				(frame.tag === "p" || INLINE_TAGS.has(frame.tag)) &&
				!frame.text.trim()
			) {
				return true;
			}
			return false;
		},
	});

	const normalizedHtml = html.replace(/\s+\n/g, "\n").trim();

	return {
		html: normalizedHtml,
		isEmpty: normalizedHtml.length === 0,
	};
}
