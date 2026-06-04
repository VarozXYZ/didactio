import {type Extension} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {StreamLanguage} from "@codemirror/language";
import {javascript} from "@codemirror/lang-javascript";
import {python} from "@codemirror/lang-python";
import {html} from "@codemirror/lang-html";
import {css} from "@codemirror/lang-css";
import {json} from "@codemirror/lang-json";
import {java} from "@codemirror/lang-java";
import {cpp} from "@codemirror/lang-cpp";
import {go} from "@codemirror/legacy-modes/mode/go";
import {shell} from "@codemirror/legacy-modes/mode/shell";
import {githubDark} from "@ddietr/codemirror-themes/github-dark";
import {githubLight} from "@ddietr/codemirror-themes/github-light";

export function getCodePracticeLanguageExtensions(language: string): Extension[] {
	const normalizedLanguage = language.toLowerCase().trim();

	if (["javascript", "js", "node"].includes(normalizedLanguage)) {
		return [javascript()];
	}

	if (["typescript", "ts"].includes(normalizedLanguage)) {
		return [javascript({typescript: true})];
	}

	if (["jsx", "react"].includes(normalizedLanguage)) {
		return [javascript({jsx: true})];
	}

	if (["tsx", "react-ts", "react-typescript"].includes(normalizedLanguage)) {
		return [javascript({jsx: true, typescript: true})];
	}

	if (["python", "py"].includes(normalizedLanguage)) {
		return [python()];
	}

	if (["html", "xml"].includes(normalizedLanguage)) {
		return [html()];
	}

	if (["css", "scss", "sass"].includes(normalizedLanguage)) {
		return [css()];
	}

	if (normalizedLanguage === "json") {
		return [json()];
	}

	if (normalizedLanguage === "java") {
		return [java()];
	}

	if (["c", "cpp", "c++"].includes(normalizedLanguage)) {
		return [cpp()];
	}

	if (["go", "golang"].includes(normalizedLanguage)) {
		return [StreamLanguage.define(go)];
	}

	if (["bash", "shell", "sh", "zsh"].includes(normalizedLanguage)) {
		return [StreamLanguage.define(shell)];
	}

	return [];
}

export function getCodePracticeThemeExtension(darkDisplay: boolean): Extension {
	return darkDisplay ? githubDark : githubLight;
}

export function createCodePracticeLayoutTheme(input: {
	codeBackground: string;
	codeBorderColor: string;
	focusColor: string;
}): Extension {
	return EditorView.theme({
		"&": {
			backgroundColor: input.codeBackground,
			fontSize: "12.5px",
			height: "100%",
			minHeight: "260px",
		},
		"&.cm-focused": {
			outline: "none",
		},
		".cm-content": {
			caretColor: input.focusColor,
			fontFamily: "ui-monospace, 'SF Mono', 'Fira Code', monospace",
			fontVariantLigatures: "none",
			minHeight: "260px",
			padding: "12px",
		},
		".cm-cursor, .cm-dropCursor": {
			borderLeftColor: input.focusColor,
		},
		".cm-editor": {
			height: "100%",
		},
		".cm-gutters": {
			backgroundColor: "transparent",
			borderRightColor: input.codeBorderColor,
			fontFamily: "ui-monospace, 'SF Mono', 'Fira Code', monospace",
			fontSize: "11px",
			paddingTop: "12px",
		},
		".cm-line": {
			padding: "0 0 0 4px",
		},
		".cm-scroller": {
			fontFamily: "ui-monospace, 'SF Mono', 'Fira Code', monospace",
			lineHeight: "1.65",
			overflow: "auto",
		},
	});
}

export function stopCodeEditorKeyPropagation(
	event: globalThis.KeyboardEvent,
): boolean {
	if (
		event.key.startsWith("Arrow") ||
		event.key === "PageUp" ||
		event.key === "PageDown" ||
		event.key === "Home" ||
		event.key === "End" ||
		event.key === "Tab"
	) {
		event.stopPropagation();
	}

	return false;
}
