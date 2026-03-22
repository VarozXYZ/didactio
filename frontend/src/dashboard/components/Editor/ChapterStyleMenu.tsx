import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Check, ChevronDown, Settings2, Type } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChapterPresentationSettings } from '../../types'

type ChapterStyleMenuProps = {
    value: ChapterPresentationSettings
    onChange: (value: ChapterPresentationSettings) => void
}

const FONT_FAMILY_OPTIONS: Array<{
    value: ChapterPresentationSettings['paragraphFontFamily']
    label: string
    previewFontFamily: string
}> = [
    { value: 'sans', label: 'Sans', previewFontFamily: 'Inter, system-ui, sans-serif' },
    { value: 'serif', label: 'Serif', previewFontFamily: 'Georgia, serif' },
    { value: 'mono', label: 'Mono', previewFontFamily: '"Courier New", monospace' },
]

const FONT_SIZE_OPTIONS: Array<{
    value: ChapterPresentationSettings['paragraphFontSize']
    label: string
}> = [
    { value: '14px', label: '14px' },
    { value: '16px', label: '16px' },
    { value: '18px', label: '18px' },
    { value: '20px', label: '20px' },
]

const ALIGN_OPTIONS: Array<{
    value: ChapterPresentationSettings['paragraphAlign']
    label: string
    icon: typeof AlignLeft
}> = [
    { value: 'left', label: 'Left', icon: AlignLeft },
    { value: 'center', label: 'Center', icon: AlignCenter },
    { value: 'right', label: 'Right', icon: AlignRight },
    { value: 'justify', label: 'Justify', icon: AlignJustify },
]

function SectionLabel({ children }: { children: string }) {
    return (
        <div className="px-1 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A8578]">
            {children}
        </div>
    )
}

function OptionButton({
    active,
    children,
    onClick,
}: {
    active?: boolean
    children: ReactNode
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[12px] transition-colors ${
                active ? 'bg-[#F5F1E7] text-[#1D1D1F]' : 'text-[#4B4B52] hover:bg-[#F8F6F1]'
            }`}
        >
            <span className="flex items-center gap-2">{children}</span>
            {active ? <Check size={14} className="text-[#2E7D32]" /> : null}
        </button>
    )
}

export function ChapterStyleMenu({ value, onChange }: ChapterStyleMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className={`flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-medium transition-all ${
                    isOpen
                        ? 'border-[#D9D1C1] bg-[#F7F4EC] text-[#1D1D1F]'
                        : 'border-transparent text-[#1D1D1F] hover:border-[#E3E1DA] hover:bg-[#F7F4EC]'
                }`}
            >
                <Settings2 size={15} />
                <span>Chapter Style</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen ? (
                <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-[280px] rounded-3xl border border-[#E7E1D6] bg-white p-3 shadow-[0_18px_48px_rgba(28,24,18,0.12)]">
                    <SectionLabel>Body font</SectionLabel>
                    <div className="space-y-1">
                        {FONT_FAMILY_OPTIONS.map((option) => (
                            <OptionButton
                                key={option.value}
                                active={value.paragraphFontFamily === option.value}
                                onClick={() =>
                                    onChange({
                                        ...value,
                                        paragraphFontFamily: option.value,
                                    })
                                }
                            >
                                <Type size={15} />
                                <span style={{ fontFamily: option.previewFontFamily }}>
                                    {option.label}
                                </span>
                            </OptionButton>
                        ))}
                    </div>

                    <div className="mt-3 border-t border-[#EEE8DC] pt-3">
                        <SectionLabel>Body size</SectionLabel>
                        <div className="grid grid-cols-2 gap-2">
                            {FONT_SIZE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() =>
                                        onChange({
                                            ...value,
                                            paragraphFontSize: option.value,
                                        })
                                    }
                                    className={`rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors ${
                                        value.paragraphFontSize === option.value
                                            ? 'border-[#D9D1C1] bg-[#F5F1E7] text-[#1D1D1F]'
                                            : 'border-[#ECE7DE] text-[#4B4B52] hover:bg-[#F8F6F1]'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 border-t border-[#EEE8DC] pt-3">
                        <SectionLabel>Alignment</SectionLabel>
                        <div className="grid grid-cols-2 gap-2">
                            {ALIGN_OPTIONS.map((option) => {
                                const Icon = option.icon
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            onChange({
                                                ...value,
                                                paragraphAlign: option.value,
                                            })
                                        }
                                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors ${
                                            value.paragraphAlign === option.value
                                                ? 'border-[#D9D1C1] bg-[#F5F1E7] text-[#1D1D1F]'
                                                : 'border-[#ECE7DE] text-[#4B4B52] hover:bg-[#F8F6F1]'
                                        }`}
                                    >
                                        <Icon size={15} />
                                        <span>{option.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
