import {useEffect} from "react";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Highlight from "@tiptap/extension-highlight";
import {Table} from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import StarterKit from "@tiptap/starter-kit";
import {EditorContent, type Editor, useEditor} from "@tiptap/react";
import {common, createLowlight} from "lowlight";
import type {EditorTextStyle} from "../../types";
import {
	makeTypographyVars,
	resolveTypography,
	STYLE_PRESETS,
	type FontId,
} from "../../utils/typography";
import {cn} from "@/lib/utils";
import {HeadingWithId} from "./HeadingWithId";
import {PasteCleaner} from "./PasteCleaner";

const lowlight = createLowlight(common);

type TiptapHtmlEditorProps = {
	baseTextStyle?: EditorTextStyle;
	contentClassName?: string;
	editable?: boolean;
	editorId: string;
	initialHtml: string;
	onFocusEditor?: (editor: Editor | null) => void;
	onHtmlChange?: (html: string) => void;
	placeholder?: string;
};

export function TiptapHtmlEditor({
	baseTextStyle,
	contentClassName,
	editable = true,
	editorId,
	initialHtml,
	onFocusEditor,
	onHtmlChange,
	placeholder,
}: TiptapHtmlEditorProps) {
	const editor = useEditor({
		content: initialHtml,
		editable,
		extensions: [
			StarterKit.configure({
				codeBlock: false,
				heading: false,
				strike: false,
			}),
			HeadingWithId,
			Underline,
			Subscript,
			Superscript,
			Highlight.configure({multicolor: false}),
			Link.configure({
				autolink: true,
				openOnClick: false,
				validate: (href) => /^(https?:|mailto:|#)/i.test(href),
				HTMLAttributes: {rel: "noopener noreferrer"},
			}),
			Table.configure({resizable: false}),
			TableRow,
			TableHeader,
			TableCell,
			CodeBlockLowlight.configure({lowlight}),
			PasteCleaner,
		],
		editorProps: {
			attributes: {
				"aria-label": placeholder ?? "Module content",
				class: cn(
					"unit-page-scope tiptap-editor",
					contentClassName,
				),
				id: editorId,
				spellcheck: "true",
			},
		},
		onBlur: () => onFocusEditor?.(null),
		onFocus: ({editor: focusedEditor}) => onFocusEditor?.(focusedEditor),
		onUpdate: ({editor: updatedEditor}) => {
			onHtmlChange?.(updatedEditor.getHTML());
		},
	});

	useEffect(() => {
		if (!editor || editor.getHTML() === initialHtml) {
			return;
		}

		editor.commands.setContent(initialHtml, {emitUpdate: false});
	}, [editor, initialHtml]);

	useEffect(() => {
		editor?.setEditable(editable);
	}, [editable, editor]);

	if (!editor) {
		return null;
	}

	const preset = STYLE_PRESETS[baseTextStyle?.stylePreset ?? "classic"];
	const typographyVars = makeTypographyVars(
		resolveTypography({
			bodyFontId: preset.body as FontId,
			headingFontId: preset.heading as FontId,
			isMobile: false,
			sizeProfile: baseTextStyle?.sizeProfile ?? "regular",
		}),
	);

	return (
		<div style={typographyVars}>
			<EditorContent editor={editor} />
		</div>
	);
}
