import { useEffect, useRef } from 'react'
import {
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    type LexicalEditor,
    SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import {
    $convertFromMarkdownString,
    $convertToMarkdownString,
    TRANSFORMERS,
} from '@lexical/markdown'
import { ListItemNode, ListNode } from '@lexical/list'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { normalizeMarkdownForStorage } from '../../utils/markdown'
import type { ChapterPresentationSettings } from '../../types'

type LexicalMarkdownEditorProps = {
    baseTextStyle?: ChapterPresentationSettings
    editable: boolean
    editorId: string
    initialMarkdown: string
    onMarkdownChange?: (markdown: string) => void
    onFocusEditor?: (editor: LexicalEditor) => void
    placeholder: string
    contentClassName: string
    placeholderClassName?: string
}

const lexicalTheme = {
    heading: {
        h1: 'mb-4 text-2xl font-bold leading-tight text-[#1D1D1F]',
        h2: 'mb-4 text-xl font-bold leading-tight text-[#1D1D1F]',
        h3: 'mb-3 text-lg font-semibold leading-tight text-[#1D1D1F]',
    },
    link: 'text-[#2D8F4B] underline underline-offset-2',
    list: {
        listitem: 'my-1',
        nested: {
            listitem: 'my-1',
        },
        ol: 'my-4 list-decimal pl-6',
        ul: 'my-4 list-disc pl-6',
    },
    paragraph: 'mb-4 leading-[1.9] text-[#1D1D1F]',
    quote: 'my-4 border-l-4 border-[#E5E5E7] pl-4 italic text-[#5A5A60]',
    text: {
        bold: 'font-semibold',
        italic: 'italic',
        strikethrough: 'line-through',
        underline: 'underline',
    },
}

function MarkdownInitializer({ initialMarkdown }: { initialMarkdown: string }) {
    const [editor] = useLexicalComposerContext()
    const hasInitializedRef = useRef(false)

    useEffect(() => {
        if (hasInitializedRef.current) {
            return
        }

        editor.update(() => {
            const root = $getRoot()
            root.clear()

            const normalizedMarkdown = normalizeMarkdownForStorage(initialMarkdown)

            if (normalizedMarkdown) {
                $convertFromMarkdownString(normalizedMarkdown, TRANSFORMERS)
            } else {
                const paragraph = $createParagraphNode()
                paragraph.append($createTextNode(''))
                root.append(paragraph)
            }
        })

        hasInitializedRef.current = true
    }, [editor, initialMarkdown])

    return null
}

function EditablePlugin({ editable }: { editable: boolean }) {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        editor.setEditable(editable)
    }, [editable, editor])

    return null
}

function FocusPlugin({ onFocusEditor }: { onFocusEditor?: (editor: LexicalEditor) => void }) {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        if (!onFocusEditor) {
            return
        }

        return editor.registerCommand(
            SELECTION_CHANGE_COMMAND,
            () => {
                onFocusEditor(editor)
                return false
            },
            1
        )
    }, [editor, onFocusEditor])

    return null
}

function resolveFontFamily(value: ChapterPresentationSettings['paragraphFontFamily']) {
    switch (value) {
        case 'serif':
            return 'Georgia, serif'
        case 'mono':
            return '"Courier New", monospace'
        default:
            return 'Inter, system-ui, sans-serif'
    }
}

export function LexicalMarkdownEditor({
    baseTextStyle,
    editable,
    editorId,
    initialMarkdown,
    onMarkdownChange,
    onFocusEditor,
    placeholder,
    contentClassName,
    placeholderClassName,
}: LexicalMarkdownEditorProps) {
    const resolvedBaseTextStyle = {
        fontFamily: resolveFontFamily(baseTextStyle?.paragraphFontFamily ?? 'sans'),
        fontSize: baseTextStyle?.paragraphFontSize ?? '16px',
        textAlign: baseTextStyle?.paragraphAlign ?? 'left',
    } as const

    return (
        <LexicalComposer
            initialConfig={{
                editable,
                namespace: editorId,
                nodes: [
                    HeadingNode,
                    QuoteNode,
                    ListNode,
                    ListItemNode,
                    LinkNode,
                    CodeNode,
                ],
                onError: (error) => {
                    throw error
                },
                theme: lexicalTheme,
            }}
        >
            <MarkdownInitializer initialMarkdown={initialMarkdown} />
            <EditablePlugin editable={editable} />
            <FocusPlugin onFocusEditor={onFocusEditor} />
            <RichTextPlugin
                contentEditable={
                    <ContentEditable
                        className={contentClassName}
                        spellCheck={editable}
                        style={resolvedBaseTextStyle}
                    />
                }
                placeholder={
                    editable ? (
                        <div
                            className={
                                placeholderClassName ??
                                'pointer-events-none absolute inset-0 p-0 text-sm italic text-[#86868B]'
                            }
                        >
                            {placeholder}
                        </div>
                    ) : null
                }
                ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            {editable && <MarkdownShortcutPlugin transformers={TRANSFORMERS} />}
            {onMarkdownChange && editable && (
                <OnChangePlugin
                    ignoreSelectionChange
                    onChange={(editorState) => {
                        editorState.read(() => {
                            onMarkdownChange(
                                normalizeMarkdownForStorage($convertToMarkdownString(TRANSFORMERS))
                            )
                        })
                    }}
                />
            )}
        </LexicalComposer>
    )
}
