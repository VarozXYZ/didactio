import { useEffect, useRef } from 'react'
import {
    $createParagraphNode,
    $createTextNode,
    $isDecoratorNode,
    $isElementNode,
    $isTextNode,
    $getRoot,
    type LexicalNode,
    type LexicalEditor,
    SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html'
import { CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import {
    TRANSFORMERS,
} from '@lexical/markdown'
import { ListItemNode, ListNode } from '@lexical/list'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import {
    htmlToStoredMarkdown,
    markdownToDom,
    normalizeMarkdownForStorage,
} from '../../utils/markdown'
import type { ChapterPresentationSettings } from '../../types'
import { resolveTypography, makeTypographyVars, type FontId, type SizeProfile } from '../../utils/typography'
import { loadFonts } from '../../utils/fontLoader'

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
        // Font-size and font-family come from the .typography-scope CSS vars set on the wrapper.
        h1: 'mb-4 font-bold leading-tight text-[#1D1D1F]',
        h2: 'mb-4 font-bold leading-tight text-[#1D1D1F]',
        h3: 'mb-3 font-semibold leading-tight text-[#1D1D1F]',
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
    hr: 'lexical-horizontal-rule',
    table: 'lexical-table',
    tableScrollableWrapper: 'lexical-table-scrollable-wrapper',
    tableCell: 'lexical-table-cell',
    tableCellHeader: 'lexical-table-cell-header',
    tableRow: 'lexical-table-row',
    text: {
        bold: 'font-semibold',
        italic: 'italic',
        strikethrough: 'line-through',
        underline: 'underline',
    },
}

function appendRootSafeNodes(root: ReturnType<typeof $getRoot>, nodes: LexicalNode[]): boolean {
    const rootSafeNodes: LexicalNode[] = []
    let inlineBuffer: LexicalNode[] = []

    const flushInlineBuffer = () => {
        if (inlineBuffer.length === 0) {
            return
        }

        const paragraph = $createParagraphNode()
        paragraph.append(...inlineBuffer)
        rootSafeNodes.push(paragraph)
        inlineBuffer = []
    }

    nodes.forEach((node) => {
        if ($isTextNode(node) && node.getTextContent().trim().length === 0) {
            return
        }

        if ($isElementNode(node) || $isDecoratorNode(node)) {
            flushInlineBuffer()
            rootSafeNodes.push(node)
            return
        }

        inlineBuffer.push(node)
    })

    flushInlineBuffer()

    if (rootSafeNodes.length === 0) {
        return false
    }

    root.append(...rootSafeNodes)
    return true
}

function applyMarkdownToEditor(editor: LexicalEditor, markdown: string) {
    editor.update(() => {
        const root = $getRoot()
        root.clear()

        const normalizedMarkdown = normalizeMarkdownForStorage(markdown)

        if (normalizedMarkdown) {
            const document = markdownToDom(normalizedMarkdown)
            const nodes = $generateNodesFromDOM(editor, document)

            if (nodes.length > 0 && appendRootSafeNodes(root, nodes)) {
                return
            }

            const paragraph = $createParagraphNode()
            paragraph.append($createTextNode(normalizedMarkdown))
            root.append(paragraph)
            return
        }

        const paragraph = $createParagraphNode()
        paragraph.append($createTextNode(''))
        root.append(paragraph)
    })
}

function MarkdownInitializer({
    editable,
    initialMarkdown,
}: {
    editable: boolean
    initialMarkdown: string
}) {
    const [editor] = useLexicalComposerContext()
    const hasInitializedRef = useRef(false)
    const lastAppliedMarkdownRef = useRef<string | null>(null)

    useEffect(() => {
        const normalizedMarkdown = normalizeMarkdownForStorage(initialMarkdown)

        if (editable && hasInitializedRef.current) {
            return
        }

        if (!editable && lastAppliedMarkdownRef.current === normalizedMarkdown) {
            return
        }

        applyMarkdownToEditor(editor, normalizedMarkdown)

        hasInitializedRef.current = true
        lastAppliedMarkdownRef.current = normalizedMarkdown
    }, [editable, editor, initialMarkdown])

    return null
}

function MarkdownSyncPlugin({ onMarkdownChange }: { onMarkdownChange: (markdown: string) => void }) {
    const [editor] = useLexicalComposerContext()

    useEffect(() => {
        return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
            if (dirtyElements.size === 0 && dirtyLeaves.size === 0) {
                return
            }

            editorState.read(() => {
                const html = $generateHtmlFromNodes(editor)
                onMarkdownChange(normalizeMarkdownForStorage(htmlToStoredMarkdown(html)))
            })
        })
    }, [editor, onMarkdownChange])

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
    const resolved = resolveTypography({
        sizeProfile: (baseTextStyle?.sizeProfile ?? 'regular') as SizeProfile,
        bodyFontId: (baseTextStyle?.bodyFontFamily ?? 'inter') as FontId,
        headingFontId: (baseTextStyle?.headingFontFamily ?? 'inter') as FontId,
        isMobile: false,  // editor always renders at desktop sizes
    })

    // Load selected fonts so previews and rendering are correct.
    useEffect(() => {
        const fontsToLoad: FontId[] = []
        if (baseTextStyle?.bodyFontFamily) fontsToLoad.push(baseTextStyle.bodyFontFamily as FontId)
        if (baseTextStyle?.headingFontFamily) fontsToLoad.push(baseTextStyle.headingFontFamily as FontId)
        if (fontsToLoad.length > 0) void loadFonts(fontsToLoad)
    }, [baseTextStyle?.bodyFontFamily, baseTextStyle?.headingFontFamily])

    const contentStyle = {
        fontFamily: resolved.body.family,
        fontSize: `${resolved.body.sizePx}px`,
        textAlign: (baseTextStyle?.paragraphAlign ?? 'left') as 'left' | 'center' | 'right' | 'justify',
    }

    const typographyVars = makeTypographyVars(resolved)

    return (
        <div className="typography-scope" style={typographyVars}>
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
                    HorizontalRuleNode,
                    TableNode,
                    TableRowNode,
                    TableCellNode,
                ],
                onError: (error) => {
                    throw error
                },
                theme: lexicalTheme,
            }}
        >
            <MarkdownInitializer editable={editable} initialMarkdown={initialMarkdown} />
            <EditablePlugin editable={editable} />
            <FocusPlugin onFocusEditor={onFocusEditor} />
            <RichTextPlugin
                contentEditable={
                    <ContentEditable
                        className={contentClassName}
                        spellCheck={editable}
                        style={contentStyle}
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
            <TablePlugin hasHorizontalScroll />
            {editable && <MarkdownShortcutPlugin transformers={TRANSFORMERS} />}
            {onMarkdownChange && editable && (
                <MarkdownSyncPlugin onMarkdownChange={onMarkdownChange} />
            )}
        </LexicalComposer>
        </div>
    )
}
