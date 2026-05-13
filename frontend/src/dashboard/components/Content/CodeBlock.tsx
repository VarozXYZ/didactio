import {Check, Copy} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import type {StylePresetId} from "../../utils/typography";

const THEME_MAP: Record<StylePresetId, string> = {
	modern: "slack-ochin",
	classic: "everforest-light",
	plain: "github-light",
};

const LANGUAGE_ALIASES: Record<string, string> = {
	bash: "bash",
	c: "c",
	cpp: "cpp",
	css: "css",
	html: "html",
	java: "java",
	javascript: "javascript",
	js: "javascript",
	json: "json",
	jsx: "jsx",
	python: "python",
	py: "python",
	sh: "bash",
	shell: "shellscript",
	shellscript: "shellscript",
	ts: "typescript",
	tsx: "tsx",
	typescript: "typescript",
};

let highlighterPromise: Promise<{
	codeToHtml: (code: string, options: {lang: string; theme: string}) => string;
}> | null = null;

type CodeBlockProps = {
	code: string;
	language?: string;
	continuation?: "continued" | "continues-next";
	stylePreset?: StylePresetId;
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

async function getCodeHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = Promise.all([
			import("@shikijs/core"),
			import("@shikijs/engine-javascript"),
			import("@shikijs/langs/bash"),
			import("@shikijs/langs/c"),
			import("@shikijs/langs/cpp"),
			import("@shikijs/langs/css"),
			import("@shikijs/langs/html"),
			import("@shikijs/langs/java"),
			import("@shikijs/langs/javascript"),
			import("@shikijs/langs/json"),
			import("@shikijs/langs/jsx"),
			import("@shikijs/langs/python"),
			import("@shikijs/langs/shellscript"),
			import("@shikijs/langs/tsx"),
			import("@shikijs/langs/typescript"),
			import("@shikijs/themes/everforest-light"),
			import("@shikijs/themes/github-light"),
			import("@shikijs/themes/slack-ochin"),
		]).then(
			([
				{createHighlighterCore},
				{createJavaScriptRegexEngine},
				bash,
				c,
				cpp,
				css,
				html,
				java,
				javascript,
				json,
				jsx,
				python,
				shellscript,
				tsx,
				typescript,
				everforestLight,
				githubLight,
				slackOchin,
			]) =>
				createHighlighterCore({
					engine: createJavaScriptRegexEngine(),
					langs: [
						bash.default,
						c.default,
						cpp.default,
						css.default,
						html.default,
						java.default,
						javascript.default,
						json.default,
						jsx.default,
						python.default,
						shellscript.default,
						tsx.default,
						typescript.default,
					],
					themes: [
						everforestLight.default,
						githubLight.default,
						slackOchin.default,
					],
				}),
		);
	}

	return highlighterPromise;
}

export function CodeBlock({
	code,
	language,
	continuation,
	stylePreset = "classic",
}: CodeBlockProps) {
	const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const lineCount = useMemo(() => Math.max(1, code.split("\n").length), [code]);
	const theme = THEME_MAP[stylePreset];

	useEffect(() => {
		let cancelled = false;
		setHighlightedHtml(null);

		const normalizedLanguage = language?.toLowerCase().trim() ?? "";
		const lang = LANGUAGE_ALIASES[normalizedLanguage] ?? "text";

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
			<div className="code-block-header">
				<div className="flex items-center gap-2">
					<span className="code-block-lang">{langLabel}</span>
					{continuation === "continued" ?
						<span className="code-block-continuation">
							continued
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
				<div className="code-block-continues-next">next page</div>
			:	null}
		</div>
	);
}
