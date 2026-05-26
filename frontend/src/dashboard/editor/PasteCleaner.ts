import {Extension} from "@tiptap/core";
import {Plugin} from "@tiptap/pm/state";

const ALLOWED_TAGS = new Set([
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
]);

const BLOCK_FALLBACKS = new Map([
	["h1", "h2"],
	["h5", "h4"],
	["h6", "h4"],
]);

function cleanNode(node: Node): Node[] {
	const document = node.ownerDocument;
	if (!document) {
		return [];
	}

	if (node.nodeType === Node.TEXT_NODE) {
		return [document.createTextNode(node.textContent ?? "")];
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return [];
	}

	const element = node as Element;
	const tagName = element.tagName.toLowerCase();
	const nextTagName = BLOCK_FALLBACKS.get(tagName) ?? tagName;

	if (!ALLOWED_TAGS.has(nextTagName)) {
		return Array.from(element.childNodes).flatMap(cleanNode);
	}

	const next = document.createElement(nextTagName);

	if (nextTagName === "a") {
		const href = element.getAttribute("href")?.trim();
		if (href && /^(https?:|mailto:|#)/i.test(href)) {
			next.setAttribute("href", href);
			next.setAttribute("rel", "noopener noreferrer");
		}
		const title = element.getAttribute("title")?.trim();
		if (title) {
			next.setAttribute("title", title);
		}
	}

	if (/^h[2-4]$/.test(nextTagName)) {
		const id = element.getAttribute("id")?.trim();
		if (id && /^[a-z0-9][a-z0-9-]*$/i.test(id)) {
			next.setAttribute("id", id.toLowerCase());
		}
	}

	if (nextTagName === "code") {
		const className = element.getAttribute("class")?.trim();
		if (className && /^language-[a-z0-9+#-]+$/i.test(className)) {
			next.setAttribute("class", className.toLowerCase());
		}
	}

	for (const child of Array.from(element.childNodes).flatMap(cleanNode)) {
		next.appendChild(child);
	}

	return [next];
}

function cleanHtml(html: string): string {
	const parser = new DOMParser();
	const document = parser.parseFromString(html, "text/html");
	const fragment = document.createDocumentFragment();

	for (const child of Array.from(document.body.childNodes).flatMap(cleanNode)) {
		fragment.appendChild(child);
	}

	const container = document.createElement("div");
	container.appendChild(fragment);
	return container.innerHTML;
}

export const PasteCleaner = Extension.create({
	name: "pasteCleaner",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					transformPastedHTML: cleanHtml,
				},
			}),
		];
	},
});
