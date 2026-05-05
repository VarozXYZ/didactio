export type HtmlPageBlock =
	| {
			type: "paragraph";
			html: string;
			text: string;
			continued: boolean;
	  }
	| {
			type: "html";
			html: string;
			text: string;
			headingLevel?: 1 | 2 | 3;
	  }
	| {
			type: "splittable_list";
			ordered: boolean;
			spread: boolean;
			items: Array<{
				html: string;
				text: string;
			}>;
			html: string;
			text: string;
	  };

function normalizeText(value: string | null | undefined): string {
	return value?.replace(/\s+/g, " ").trim() ?? "";
}

function looksLikeHtml(value: string): boolean {
	return /<\/?[a-z][\w:-]*(?:\s[^>]*)?>/i.test(value);
}

export function normalizeStoredHtml(value: string | null | undefined): string {
	return value?.trim() ?? "";
}

export function normalizeHtmlForStorage(html: string): string {
	return html.replace(/\u00a0/g, " ").trim();
}

export function htmlToPlainText(html: string | null | undefined): string {
	const parser = new DOMParser();
	const document = parser.parseFromString(html ?? "", "text/html");
	return normalizeText(document.body.textContent);
}

function headingLevelForElement(element: HTMLElement): 1 | 2 | 3 | undefined {
	if (element.tagName === "H2") return 1;
	if (element.tagName === "H3") return 2;
	if (element.tagName === "H4") return 3;
	return undefined;
}

function htmlElementToPageBlock(element: HTMLElement): HtmlPageBlock {
	const text = normalizeText(element.textContent);

	if (
		(element.tagName === "UL" || element.tagName === "OL") &&
		element.children.length > 0
	) {
		const items = Array.from(element.children)
			.filter(
				(child): child is HTMLLIElement =>
					child instanceof HTMLLIElement,
			)
			.map((item) => ({
				html: item.innerHTML.trim(),
				text: normalizeText(item.textContent),
			}))
			.filter((item) => item.html || item.text);

		if (items.length > 0) {
			return {
				type: "splittable_list",
				ordered: element.tagName === "OL",
				spread: false,
				items,
				html: element.outerHTML,
				text: items.map((item) => item.text).join(" "),
			};
		}
	}

	if (element.tagName === "P") {
		return {
			type: "paragraph",
			html: element.outerHTML,
			text,
			continued: false,
		};
	}

	return {
		type: "html",
		html: element.outerHTML,
		text,
		...(headingLevelForElement(element) ?
			{headingLevel: headingLevelForElement(element)}
		:	{}),
	};
}

export function extractHtmlBlocks(html: string): HtmlPageBlock[] {
	const normalizedHtml = normalizeStoredHtml(html);

	if (!normalizedHtml || !looksLikeHtml(normalizedHtml)) {
		return [];
	}

	const parser = new DOMParser();
	const document = parser.parseFromString(normalizedHtml, "text/html");
	return Array.from(document.body.children)
		.filter((element): element is HTMLElement => element instanceof HTMLElement)
		.map(htmlElementToPageBlock)
		.filter((block) => block.text || block.html.trim());
}

function createContextualFragment(range: Range): DocumentFragment {
	return range.cloneContents();
}

function fragmentToHtml(fragment: DocumentFragment): string {
	const wrapper = document.createElement("div");
	wrapper.appendChild(fragment);
	return wrapper.innerHTML.trim();
}

function findTextPositionForNormalizedOffset(
	root: HTMLElement,
	normalizedOffset: number,
): {node: Text; offset: number} | null {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let normalizedCount = 0;
	let inWhitespace = false;
	let lastPosition: {node: Text; offset: number} | null = null;

	while (walker.nextNode()) {
		const node = walker.currentNode as Text;
		const value = node.data;

		for (let i = 0; i < value.length; i++) {
			const isWhitespace = /\s/.test(value[i]);
			if (isWhitespace) {
				if (inWhitespace) {
					lastPosition = {node, offset: i + 1};
					continue;
				}
				inWhitespace = true;
			} else {
				inWhitespace = false;
			}

			normalizedCount += 1;
			lastPosition = {node, offset: i + 1};

			if (normalizedCount >= normalizedOffset) {
				return lastPosition;
			}
		}
	}

	return lastPosition;
}

export function wrapParagraphHtml(innerHtml: string): string {
	return `<p>${innerHtml.trim()}</p>`;
}

export function splitParagraphHtmlAtTextOffset(
	paragraphHtml: string,
	fittingTextLength: number,
): {fittingHtml: string; remainderHtml: string} {
	const parser = new DOMParser();
	const document = parser.parseFromString(paragraphHtml, "text/html");
	const paragraph = document.body.firstElementChild;

	if (!(paragraph instanceof HTMLElement) || paragraph.tagName !== "P") {
		return {
			fittingHtml: wrapParagraphHtml(""),
			remainderHtml: wrapParagraphHtml(paragraphHtml),
		};
	}

	const splitPosition = findTextPositionForNormalizedOffset(
		paragraph,
		Math.max(1, fittingTextLength),
	);

	if (!splitPosition) {
		return {
			fittingHtml: paragraph.outerHTML,
			remainderHtml: wrapParagraphHtml(""),
		};
	}

	const fittingRange = document.createRange();
	fittingRange.setStart(paragraph, 0);
	fittingRange.setEnd(splitPosition.node, splitPosition.offset);

	const remainderRange = document.createRange();
	remainderRange.setStart(splitPosition.node, splitPosition.offset);
	remainderRange.setEnd(paragraph, paragraph.childNodes.length);

	const fittingInnerHtml = fragmentToHtml(
		createContextualFragment(fittingRange),
	);
	const remainderInnerHtml = fragmentToHtml(
		createContextualFragment(remainderRange),
	);

	return {
		fittingHtml: wrapParagraphHtml(fittingInnerHtml),
		remainderHtml: wrapParagraphHtml(remainderInnerHtml),
	};
}

export function buildListHtml(block: Extract<HtmlPageBlock, {type: "splittable_list"}>): string {
	const tagName = block.ordered ? "ol" : "ul";
	const itemsHtml = block.items
		.map((item) => `<li>${item.html.trim()}</li>`)
		.join("");
	return `<${tagName}>${itemsHtml}</${tagName}>`;
}
