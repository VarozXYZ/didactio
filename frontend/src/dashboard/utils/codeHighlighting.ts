import type {StylePresetId} from "@/shared/presentation/typography";

export const CODE_THEME_MAP: Record<StylePresetId, string> = {
	modern: "slack-ochin",
	classic: "everforest-light",
	plain: "github-light-default",
};

export const DARK_CODE_THEME = "github-dark-default";

export const CODE_LANGUAGE_ALIASES: Record<string, string> = {
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

export async function getCodeHighlighter() {
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
			import("@shikijs/themes/github-light-default"),
			import("@shikijs/themes/slack-ochin"),
			import("@shikijs/themes/github-dark-default"),
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
				githubLightDefault,
				slackOchin,
				githubDarkDefault,
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
						githubLightDefault.default,
						slackOchin.default,
						githubDarkDefault.default,
					],
				}),
		);
	}

	return highlighterPromise;
}
