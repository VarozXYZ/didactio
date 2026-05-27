import * as parse5 from "parse5";

function textContent(node: unknown): string {
	const record = node as {value?: string; childNodes?: unknown[]};
	if (typeof record.value === "string") {
		return record.value;
	}
	return (record.childNodes ?? []).map((child) => textContent(child)).join("");
}

function collapse(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function extractContinuitySummary(sanitizedHtml: string): string {
	const fragment = parse5.parseFragment(sanitizedHtml);
	const topLevel = fragment.childNodes.filter((node) => {
		const record = node as {nodeName: string; value?: string};
		return record.nodeName !== "#text" || Boolean(record.value?.trim());
	});

	if (topLevel.length === 0) {
		return "";
	}

	const lastParagraph = [...topLevel]
		.reverse()
		.find((node) => (node as {tagName?: string}).tagName === "p");
	const source = lastParagraph ?? topLevel.at(-1);
	const summary = collapse(source ? textContent(source) : "");

	return summary.length > 800 ? `${summary.slice(0, 800).trimEnd()}` : summary;
}
