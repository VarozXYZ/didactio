import {Check, Copy} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import type {StylePresetId} from "@/shared/presentation/typography";
import {
	CODE_LANGUAGE_ALIASES,
	CODE_THEME_MAP,
	DARK_CODE_THEME,
	getCodeHighlighter,
} from "@/dashboard/utils/codeHighlighting";
import {useAppearance} from "@/theme/useAppearance";

type CodeBlockProps = {
	code: string;
	language?: string;
	continuation?: "continued" | "continues-next";
	noteIds?: string[];
	searchHighlights?: Array<{endOffset: number; startOffset: number}>;
	stylePreset?: StylePresetId;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

type TextPosition = {
	node: Text;
	offset: number;
	normalizedOffset: number;
};

function walkTextPositions(
	root: HTMLElement,
	visit: (position: TextPosition) => boolean | void,
): void {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let normalizedOffset = 0;
	let inWhitespace = false;

	while (walker.nextNode()) {
		const node = walker.currentNode as Text;
		const value = node.data;

		for (let offset = 0; offset <= value.length; offset += 1) {
			if (visit({node, offset, normalizedOffset}) === false) {
				return;
			}
			if (offset === value.length) {
				continue;
			}
			const char = value[offset];
			if (/\s/.test(char)) {
				if (inWhitespace) {
					continue;
				}
				inWhitespace = true;
			} else {
				inWhitespace = false;
			}
			normalizedOffset += 1;
		}
	}
}

function findTextPositionForNormalizedOffset(
	root: HTMLElement,
	targetOffset: number,
): {node: Text; offset: number} | null {
	let result: {node: Text; offset: number} | null = null;
	walkTextPositions(root, ({node, offset, normalizedOffset}) => {
		result = {node, offset};
		if (normalizedOffset >= targetOffset) {
			return false;
		}
		return undefined;
	});
	return result;
}

function wrapTextNodeSegment(input: {
	document: Document;
	endOffset: number;
	node: Text;
	startOffset: number;
}): void {
	const startOffset = Math.max(0, Math.min(input.startOffset, input.node.length));
	const endOffset = Math.max(
		startOffset,
		Math.min(input.endOffset, input.node.length),
	);

	if (!input.node.parentNode || endOffset <= startOffset) {
		return;
	}

	let target = input.node;
	if (endOffset < target.length) {
		target.splitText(endOffset);
	}
	if (startOffset > 0) {
		target = target.splitText(startOffset);
	}
	if (!target.data.trim()) {
		return;
	}

	const mark = input.document.createElement("mark");
	mark.className = "didactio-search-hit";
	mark.dataset.searchHit = "true";
	target.parentNode?.insertBefore(mark, target);
	mark.appendChild(target);
}

function wrapTextPositions(input: {
	document: Document;
	end: {node: Text; offset: number};
	root: HTMLElement;
	start: {node: Text; offset: number};
}): void {
	const textNodes: Text[] = [];
	const walker = input.document.createTreeWalker(
		input.root,
		NodeFilter.SHOW_TEXT,
	);
	while (walker.nextNode()) {
		textNodes.push(walker.currentNode as Text);
	}

	const startIndex = textNodes.indexOf(input.start.node);
	const endIndex = textNodes.indexOf(input.end.node);
	if (startIndex < 0 || endIndex < startIndex) {
		return;
	}

	for (let index = endIndex; index >= startIndex; index -= 1) {
		const node = textNodes[index];
		wrapTextNodeSegment({
			node,
			startOffset: index === startIndex ? input.start.offset : 0,
			endOffset: index === endIndex ? input.end.offset : node.length,
			document: input.document,
		});
	}
}

function applyCodeSearchHighlights(
	html: string,
	highlights: Array<{endOffset: number; startOffset: number}>,
): string {
	if (highlights.length === 0) {
		return html;
	}

	const parser = new DOMParser();
	const document = parser.parseFromString(html, "text/html");
	const root = document.body;

	for (const highlight of [...highlights].sort(
		(left, right) => right.startOffset - left.startOffset,
	)) {
		const start = findTextPositionForNormalizedOffset(
			root,
			highlight.startOffset,
		);
		const end = findTextPositionForNormalizedOffset(root, highlight.endOffset);
		if (!start || !end) {
			continue;
		}
		try {
			wrapTextPositions({root, start, end, document});
		} catch {
			continue;
		}
	}

	return root.innerHTML;
}

export function CodeBlock({
	code,
	language,
	continuation,
	noteIds = [],
	searchHighlights = [],
	stylePreset = "classic",
}: CodeBlockProps) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const {resolvedMode} = useAppearance();
	const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);
	const theme = resolvedMode === "dark" ? DARK_CODE_THEME : CODE_THEME_MAP[stylePreset];
	const searchHighlightsKey = useMemo(
		() =>
			searchHighlights
				.map((highlight) => `${highlight.startOffset}:${highlight.endOffset}`)
				.join("|"),
		[searchHighlights],
	);
	const stableSearchHighlights = useMemo(
		() => searchHighlights,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[searchHighlightsKey],
	);

	useEffect(() => {
		let cancelled = false;
		// Clear stale highlighting while the async highlighter recomputes.
		setHighlightedHtml(null);

		const normalizedLanguage = language?.toLowerCase().trim() ?? "";
		const lang = CODE_LANGUAGE_ALIASES[normalizedLanguage] ?? "text";

		void getCodeHighlighter()
			.then((highlighter) => highlighter.codeToHtml(code, {lang, theme}))
			.then((html) => {
				if (!cancelled) {
					setHighlightedHtml(
						applyCodeSearchHighlights(html, stableSearchHighlights),
					);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHighlightedHtml(
						applyCodeSearchHighlights(
							`<pre><code>${escapeHtml(code)}</code></pre>`,
							stableSearchHighlights,
						),
					);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [code, language, stableSearchHighlights, theme]);

	const handleCopy = () => {
		void navigator.clipboard.writeText(code).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	const langLabel = language || "plaintext";

	return (
		<div className="code-block-wrapper">
			<div className="code-block-header" data-unit-note-ignore="true">
				<div className="flex items-center gap-2">
					<span className="code-block-lang">{langLabel}</span>
					{continuation === "continued" ?
						<span className="code-block-continuation">
							continued
						</span>
					:	null}
					{noteIds.length > 0 ?
						<span className="code-block-notes" aria-label="Code notes">
							{noteIds.map((noteId) => (
								<button
									key={noteId}
									aria-label="Open code note"
									className="code-block-note-dot"
									data-note-id={noteId}
									type="button"
								/>
							))}
						</span>
					:	null}
				</div>
				<button
					className="code-block-copy"
					onClick={handleCopy}
					type="button"
					aria-label="Copy code"
				>
					{copied ?
						<Check size={12} />
					:	<Copy size={12} />}
					<span>{copied ? "Copied" : "Copy"}</span>
				</button>
			</div>
			{highlightedHtml ?
				<div
					className="code-block-highlight"
					dangerouslySetInnerHTML={{__html: highlightedHtml}}
				/>
			:	<pre
					className="code-block-skeleton"
					aria-busy="true"
					style={{minHeight: `${lineCount * 1.5 + 2}em`}}
				>
					<code>{code}</code>
				</pre>
			}
			{continuation === "continues-next" ?
				<div className="code-block-continues-next" data-unit-note-ignore="true">
					next page
				</div>
			:	null}
		</div>
	);
}
