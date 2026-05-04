import {Check, Copy} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import type {StylePresetId} from "../../utils/typography";

const THEME_MAP: Record<StylePresetId, string> = {
	modern: "slack-ochin",
	classic: "everforest-light",
	plain: "github-light",
};

type CodeBlockProps = {
	code: string;
	language?: string;
	stylePreset?: StylePresetId;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function CodeBlock({code, language, stylePreset = "classic"}: CodeBlockProps) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);
	const theme = THEME_MAP[stylePreset];

	useEffect(() => {
		let cancelled = false;
		setHighlightedHtml(null);

		void import("shiki")
			.then(({codeToHtml}) =>
				codeToHtml(code, {
					lang: language || "text",
					theme,
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
	}, [code, language, theme]);

	const handleCopy = () => {
		void navigator.clipboard.writeText(code).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	const langLabel = language || "plaintext";

	return (
		<div className="code-block-wrapper">
			<div className="code-block-header">
				<span className="code-block-lang">{langLabel}</span>
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
		</div>
	);
}
