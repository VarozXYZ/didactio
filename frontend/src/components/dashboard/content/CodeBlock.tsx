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
	stylePreset?: StylePresetId;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function CodeBlock({
	code,
	language,
	continuation,
	noteIds = [],
	stylePreset = "classic",
}: CodeBlockProps) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const {resolvedMode} = useAppearance();
	const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);
	const theme = resolvedMode === "dark" ? DARK_CODE_THEME : CODE_THEME_MAP[stylePreset];

	useEffect(() => {
		let cancelled = false;
		// Clear stale highlighting while the async highlighter recomputes.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setHighlightedHtml(null);

		const normalizedLanguage = language?.toLowerCase().trim() ?? "";
		const lang = CODE_LANGUAGE_ALIASES[normalizedLanguage] ?? "text";

		void getCodeHighlighter()
			.then((highlighter) => highlighter.codeToHtml(code, {lang, theme}))
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
