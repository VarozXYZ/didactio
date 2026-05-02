import {useEffect, useMemo, useState} from "react";

export const SHIKI_THEME = "min-light";

type CodeBlockProps = {
	code: string;
	language?: string;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function CodeBlock({code, language}: CodeBlockProps) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
	const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);

	useEffect(() => {
		let cancelled = false;
		setHighlightedHtml(null);

		void import("shiki")
			.then(({codeToHtml}) =>
				codeToHtml(code, {
					lang: language || "text",
					theme: SHIKI_THEME,
				}),
			)
			.then((html) => {
				if (!cancelled) {
					setHighlightedHtml(html);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHighlightedHtml(
						`<pre><code>${escapeHtml(code)}</code></pre>`,
					);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [code, language]);

	if (!highlightedHtml) {
		return (
			<pre
				className="code-block-skeleton"
				aria-busy="true"
				style={{minHeight: `${lineCount * 1.5 + 2}em`}}
			>
				<code>{code}</code>
			</pre>
		);
	}

	return (
		<div
			className="code-block-highlight"
			// Shiki returns a pre/code tree generated from backend-sanitized text.
			dangerouslySetInnerHTML={{__html: highlightedHtml}}
		/>
	);
}
