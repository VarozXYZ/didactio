import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

const QUICK_EMOJIS = [
    '📚', '💻', '📐', '⚛️', '🧪', '🔬', '🌍', '📜',
    '✍️', '🎨', '🔭', '🎵', '💡', '🎯', '🧩', '📁',
]

const MORE_EMOJIS = [
    // Science & Nature
    '🧬', '🧫', '⚗️', '🌡️', '🧲', '🔋', '🌿', '🌳',
    '🌊', '🏔️', '🌋', '🌸', '🌙', '⭐', '🦋', '🐬',
    // Arts & Culture
    '🖌️', '🎭', '🎬', '🎶', '🎸', '🎹', '🎤', '🖼️',
    '🎺', '🥁', '👑', '🏛️', '⚔️', '🏺', '📸', '🏆',
    // Tech & Computing
    '🖥️', '⌨️', '🖱️', '💾', '📱', '🤖', '🔌', '💿',
    '📡', '🛸', '🔐', '💎', '🔍', '🧮', '📊', '📈',
    // Work & Learning
    '📖', '📝', '✏️', '📓', '📔', '📕', '📗', '📘',
    '📙', '📄', '💼', '📋', '🗂️', '📌', '📎', '🗒️',
    // Sports & Lifestyle
    '⚽', '🏀', '🎾', '🏊', '🏃', '🧘', '🏋️', '🚴',
    '🍎', '🌈', '❤️', '⚡', '🔥', '💫', '🎁', '🌺',
]

type Props = {
    open: boolean
    mode: 'create' | 'edit'
    initialName?: string
    initialIcon?: string
    initialColor?: string
    onClose: () => void
    onSubmit: (name: string, icon: string, color: string) => Promise<void>
}

export function FolderFormModal({
    open,
    mode,
    initialName = '',
    initialIcon = '📁',
    initialColor = '#6B7280',
    onClose,
    onSubmit,
}: Props) {
    const [name, setName] = useState(initialName)
    const [selectedIcon, setSelectedIcon] = useState(initialIcon)
    const [selectedColor, setSelectedColor] = useState(initialColor)
    const [showMore, setShowMore] = useState(false)
    const [showPicker, setShowPicker] = useState(false)
    const pickerRef = useRef<HTMLDivElement>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!showPicker) return
        const handleClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setShowPicker(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [showPicker])

    useEffect(() => {
        if (open) {
            setName(initialName)
            setSelectedIcon(initialIcon)
            setSelectedColor(initialColor)
            setShowMore(false)
        }
    }, [open, initialName, initialIcon, initialColor])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || isSubmitting) return
        setIsSubmitting(true)
        try {
            await onSubmit(name.trim(), selectedIcon, selectedColor)
            onClose()
        } finally {
            setIsSubmitting(false)
        }
    }

    const isCreate = mode === 'create'
    const allEmojis = showMore ? [...QUICK_EMOJIS, ...MORE_EMOJIS] : QUICK_EMOJIS
    const SWATCHES = [
        '#3B82F6', // blue
        '#8B5CF6', // violet
        '#EC4899', // pink
        '#EF4444', // red
        '#F97316', // orange
        '#EAB308', // yellow
        '#22C55E', // green
        '#14B8A6', // teal
    ]

    return (
        <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onClose() }}>
            <DialogContent className="max-w-[400px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isCreate ? 'New Folder' : 'Edit Folder'}</DialogTitle>
                        <DialogDescription>
                            {isCreate
                                ? 'Choose a name and icon for your folder.'
                                : 'Update the folder name or icon.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-5 py-4 space-y-4">
                        <div>
                            <label className="mb-1.5 block text-[12px] font-medium text-[#86868B] uppercase tracking-wide">
                                Folder name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Computer Science"
                                autoFocus
                                className="w-full rounded-[10px] border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#1D1D1F] outline-none transition-colors focus:border-[#1D1D1F] focus:bg-white"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-[12px] font-medium text-[#86868B] uppercase tracking-wide">
                                Icon
                            </label>
                            <div className={`grid grid-cols-8 gap-1 ${showMore ? 'max-h-52 overflow-y-auto pr-0.5' : ''}`}>
                                {allEmojis.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setSelectedIcon(emoji)}
                                        className={`flex items-center justify-center rounded-[8px] p-2 text-xl transition-all ${
                                            selectedIcon === emoji
                                                ? 'bg-[#E8E8ED] outline outline-2 outline-[#1D1D1F]'
                                                : 'bg-[#F5F5F7] hover:bg-[#E5E5E7]'
                                        }`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                                {!showMore && (
                                    <button
                                        type="button"
                                        onClick={() => setShowMore(true)}
                                        className="flex items-center justify-center rounded-[8px] bg-[#F5F5F7] p-2 text-[#86868B] transition-all hover:bg-[#E5E5E7] hover:text-[#1D1D1F]"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-[12px] font-medium text-[#86868B] uppercase tracking-wide">
                                Color
                            </label>
                            <div className="relative" ref={pickerRef}>
                                {/* Swatches + custom toggle + hex — all one row */}
                                <div className="flex items-center gap-2">
                                    {SWATCHES.map((hex) => {
                                        const isSelected = selectedColor.toLowerCase() === hex.toLowerCase()
                                        return (
                                            <button
                                                key={hex}
                                                type="button"
                                                onClick={() => { setSelectedColor(hex); setShowPicker(false) }}
                                                className={`h-6 w-6 shrink-0 rounded-full border transition-all ${
                                                    isSelected
                                                        ? 'border-[#1D1D1F] outline outline-2 outline-[#1D1D1F]/20'
                                                        : 'border-black/[0.08] hover:border-black/[0.18]'
                                                }`}
                                                style={{ backgroundColor: hex }}
                                                aria-label={hex}
                                            />
                                        )
                                    })}

                                    <div className="ml-auto flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setShowPicker((v) => !v)}
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                                showPicker
                                                    ? 'border-[#1D1D1F] bg-white'
                                                    : 'border-[#E5E5E7] bg-[#FAFAFA] hover:bg-white'
                                            }`}
                                            aria-label="Custom color"
                                            title="Custom color"
                                        >
                                            <span
                                                className="h-3 w-3 rounded-full border border-black/10 shadow-sm"
                                                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(selectedColor) ? selectedColor : '#6B7280' }}
                                            />
                                        </button>
                                        <input
                                            value={selectedColor}
                                            onChange={(e) => setSelectedColor(e.target.value)}
                                            className="w-[88px] rounded-lg border border-[#E5E5E7] bg-[#FAFAFA] px-2 py-1 font-mono text-[12px] text-[#1D1D1F] outline-none transition-colors focus:border-[#1D1D1F] focus:bg-white"
                                            placeholder="#6B7280"
                                            spellCheck={false}
                                        />
                                    </div>
                                </div>

                                {showPicker && (
                                    <div className="absolute bottom-full left-0 z-50 mb-2 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
                                        <HexColorPicker
                                            color={/^#[0-9a-fA-F]{6}$/.test(selectedColor) ? selectedColor : '#6B7280'}
                                            onChange={setSelectedColor}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!name.trim() || isSubmitting || !/^#[0-9a-fA-F]{6}$/.test(selectedColor.trim())}
                        >
                            {isSubmitting
                                ? isCreate ? 'Creating…' : 'Saving…'
                                : isCreate ? 'Create Folder' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
