import { $createCodeNode } from '@lexical/code'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { $patchStyleText, $setBlocksType } from '@lexical/selection'
import { $createHeadingNode } from '@lexical/rich-text'
import {
    $createParagraphNode,
    $getSelection,
    $isRangeSelection,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    FORMAT_TEXT_COMMAND,
    REDO_COMMAND,
    type LexicalEditor,
    UNDO_COMMAND,
} from 'lexical'
import {
    Bold,
    Check,
    ChevronDown,
    Code2,
    Italic,
    Link2,
    List,
    ListOrdered,
    Palette,
    Redo2,
    Type,
    Underline,
    Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type LexicalToolbarProps = {
    activeEditor: LexicalEditor | null
}

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'code'
type ToolbarMenuId = 'blockType' | 'fontColor' | null

const BLOCK_TYPE_OPTIONS: Array<{ value: BlockType; label: string }> = [
    { value: 'paragraph', label: 'Paragraph' },
    { value: 'h1', label: 'Heading 1' },
    { value: 'h2', label: 'Heading 2' },
    { value: 'h3', label: 'Heading 3' },
    { value: 'code', label: 'Code block' },
]

const COLOR_SWATCHES = ['#1D1D1F', '#404040', '#6D28D9', '#2563EB', '#059669', '#DC2626']

function ToolbarButton({
    disabled = false,
    label,
    icon,
    onClick,
}: {
    disabled?: boolean
    label: string
    icon: ReactNode
    onClick: () => void
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="flex h-9 items-center gap-2 rounded-full border border-transparent px-3 text-[12px] font-medium text-[#1D1D1F] transition-all hover:border-[#E3E1DA] hover:bg-[#F7F4EC] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent"
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}

function ToolbarDivider() {
    return <div className="mx-1 hidden h-6 w-px bg-[#E5DED0] sm:block" />
}

function ToolbarMenuButton({
    icon,
    label,
    isOpen,
    onClick,
}: {
    icon: ReactNode
    label: string
    isOpen: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-medium transition-all ${
                isOpen
                    ? 'border-[#D9D1C1] bg-[#F7F4EC] text-[#1D1D1F]'
                    : 'border-transparent text-[#1D1D1F] hover:border-[#E3E1DA] hover:bg-[#F7F4EC]'
            }`}
        >
            {icon}
            <span>{label}</span>
            <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
    )
}

function ToolbarMenu({
    isOpen,
    anchor,
    children,
}: {
    isOpen: boolean
    anchor: ReactNode
    children: ReactNode
}) {
    return (
        <div className="relative">
            {anchor}
            {isOpen ? (
                <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 min-w-[180px] rounded-2xl border border-[#E7E1D6] bg-white p-2 shadow-[0_18px_48px_rgba(28,24,18,0.12)]">
                    {children}
                </div>
            ) : null}
        </div>
    )
}

function ToolbarMenuItem({
    active = false,
    icon,
    label,
    onClick,
    trailing,
}: {
    active?: boolean
    icon?: ReactNode
    label: string
    onClick: () => void
    trailing?: ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[12px] transition-colors ${
                active ? 'bg-[#F5F1E7] text-[#1D1D1F]' : 'text-[#4B4B52] hover:bg-[#F8F6F1]'
            }`}
        >
            <span className="flex items-center gap-2">
                {icon}
                <span>{label}</span>
            </span>
            <span className="flex items-center gap-2 text-[#8B8B94]">
                {trailing}
                {active ? <Check size={14} className="text-[#2E7D32]" /> : null}
            </span>
        </button>
    )
}

export function LexicalToolbar({ activeEditor }: LexicalToolbarProps) {
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)
    const [blockType, setBlockType] = useState<BlockType>('paragraph')
    const [fontColor, setFontColor] = useState('#1D1D1F')
    const [openMenu, setOpenMenu] = useState<ToolbarMenuId>(null)
    const toolbarRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!activeEditor) {
            return
        }

        return activeEditor.registerCommand(
            CAN_UNDO_COMMAND,
            (payload) => {
                setCanUndo(payload)
                return false
            },
            1
        )
    }, [activeEditor])

    useEffect(() => {
        if (!activeEditor) {
            return
        }

        return activeEditor.registerCommand(
            CAN_REDO_COMMAND,
            (payload) => {
                setCanRedo(payload)
                return false
            },
            1
        )
    }, [activeEditor])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!toolbarRef.current?.contains(event.target as Node)) {
                setOpenMenu(null)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const resolvedCanUndo = activeEditor ? canUndo : false
    const resolvedCanRedo = activeEditor ? canRedo : false
    const resolvedBlockType = activeEditor ? blockType : 'paragraph'

    const applyBlockType = (nextType: BlockType) => {
        if (!activeEditor) {
            return
        }

        activeEditor.update(() => {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) {
                return
            }

            if (nextType === 'paragraph') {
                $setBlocksType(selection, () => $createParagraphNode())
                return
            }

            if (nextType === 'code') {
                $setBlocksType(selection, () => $createCodeNode())
                return
            }

            $setBlocksType(selection, () => $createHeadingNode(nextType))
        })

        setBlockType(nextType)
        setOpenMenu(null)
    }

    const applyTextStyle = (styles: Record<string, string>) => {
        if (!activeEditor) {
            return
        }

        activeEditor.update(() => {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) {
                return
            }

            $patchStyleText(selection, styles)
        })
    }

    const toggleLink = () => {
        if (!activeEditor) {
            return
        }

        const url = window.prompt('Enter link URL')
        if (url === null) {
            return
        }

        activeEditor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim() || null)
    }

    return (
        <div
            ref={toolbarRef}
            className="flex flex-wrap items-center justify-center gap-1.5"
        >
            <ToolbarButton
                disabled={!activeEditor || !resolvedCanUndo}
                icon={<Undo2 size={15} />}
                label="Undo"
                onClick={() => activeEditor?.dispatchCommand(UNDO_COMMAND, undefined)}
            />
            <ToolbarButton
                disabled={!activeEditor || !resolvedCanRedo}
                icon={<Redo2 size={15} />}
                label="Redo"
                onClick={() => activeEditor?.dispatchCommand(REDO_COMMAND, undefined)}
            />

            <ToolbarDivider />

            <ToolbarMenu
                isOpen={openMenu === 'blockType'}
                anchor={
                    <ToolbarMenuButton
                        icon={<Type size={15} />}
                        label={BLOCK_TYPE_OPTIONS.find((option) => option.value === resolvedBlockType)?.label ?? 'Paragraph'}
                        isOpen={openMenu === 'blockType'}
                        onClick={() =>
                            setOpenMenu((current) => (current === 'blockType' ? null : 'blockType'))
                        }
                    />
                }
            >
                {BLOCK_TYPE_OPTIONS.map((option) => (
                    <ToolbarMenuItem
                        key={option.value}
                        active={option.value === resolvedBlockType}
                        label={option.label}
                        onClick={() => applyBlockType(option.value)}
                    />
                ))}
            </ToolbarMenu>

            <ToolbarMenu
                isOpen={openMenu === 'fontColor'}
                anchor={
                    <ToolbarMenuButton
                        icon={<Palette size={15} />}
                        label="Color"
                        isOpen={openMenu === 'fontColor'}
                        onClick={() =>
                            setOpenMenu((current) => (current === 'fontColor' ? null : 'fontColor'))
                        }
                    />
                }
            >
                <div className="grid grid-cols-3 gap-2 p-1">
                    {COLOR_SWATCHES.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-label={`Use color ${color}`}
                            onClick={() => {
                                setFontColor(color)
                                applyTextStyle({ color })
                                setOpenMenu(null)
                            }}
                            className={`h-9 w-9 rounded-full border transition-transform hover:scale-105 ${
                                color === fontColor ? 'border-[#1D1D1F]' : 'border-[#E7E1D6]'
                            }`}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
                <div className="mt-2 border-t border-[#EEE8DC] px-2 pt-2">
                    <label className="flex items-center justify-between gap-3 rounded-xl px-2 py-1 text-[12px] text-[#4B4B52] hover:bg-[#F8F6F1]">
                        <span>Custom</span>
                        <input
                            type="color"
                            value={fontColor}
                            onChange={(event) => {
                                const nextColor = event.target.value
                                setFontColor(nextColor)
                                applyTextStyle({ color: nextColor })
                            }}
                            className="h-8 w-10 cursor-pointer rounded-lg border border-[#E7E1D6] bg-transparent p-1"
                        />
                    </label>
                </div>
            </ToolbarMenu>

            <ToolbarDivider />

            <ToolbarButton
                icon={<Bold size={15} />}
                label="Bold"
                onClick={() => activeEditor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
            />
            <ToolbarButton
                icon={<Italic size={15} />}
                label="Italic"
                onClick={() => activeEditor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
            />
            <ToolbarButton
                icon={<Underline size={15} />}
                label="Underline"
                onClick={() => activeEditor?.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
            />
            <ToolbarButton icon={<Link2 size={15} />} label="Link" onClick={toggleLink} />
            <ToolbarButton
                icon={<List size={15} />}
                label="Bullets"
                onClick={() =>
                    activeEditor?.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
                }
            />
            <ToolbarButton
                icon={<ListOrdered size={15} />}
                label="Numbered"
                onClick={() =>
                    activeEditor?.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
                }
            />
            <ToolbarButton
                icon={<Code2 size={15} />}
                label="Code"
                onClick={() => applyBlockType('code')}
            />
        </div>
    )
}
