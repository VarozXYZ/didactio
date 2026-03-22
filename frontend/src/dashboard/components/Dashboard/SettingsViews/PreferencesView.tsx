import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type SelectOption = {
    label: string
    value: string
}

type CustomSelectProps = {
    options: SelectOption[]
    value: string
    onChange: (value: string) => void
}

function CustomSelect({ options, value, onChange }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const selectedOption = options.find((option) => option.value === value) ?? options[0]

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        window.addEventListener('mousedown', handlePointerDown)
        return () => window.removeEventListener('mousedown', handlePointerDown)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className={`flex w-full items-center justify-between rounded-[8px] border px-4 py-3 text-left text-[14px] transition-colors ${
                    isOpen
                        ? 'border-[#4ADE80] bg-[#F8FFF9]'
                        : 'border-[#E5E5E7] bg-white hover:border-[#D4D4D8]'
                }`}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="text-[#1D1D1F]">{selectedOption.label}</span>
                <ChevronDown
                    size={16}
                    className={`text-[#86868B] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[10px] border border-[#E5E5E7] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
                    <div role="listbox" className="py-1">
                        {options.map((option) => {
                            const isSelected = option.value === value

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value)
                                        setIsOpen(false)
                                    }}
                                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-[14px] transition-colors ${
                                        isSelected
                                            ? 'bg-[#F1FBF3] text-[#1D1D1F]'
                                            : 'text-[#4B5563] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
                                    }`}
                                >
                                    <span>{option.label}</span>
                                    {isSelected && <Check size={16} className="text-[#4ADE80]" />}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

const modelOptions: SelectOption[] = [
    { value: 'gpt-4', label: 'GPT-4 (Recommended)' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'claude-3', label: 'Claude 3' },
]

const toneOptions: SelectOption[] = [
    { value: 'professional', label: 'Professional' },
    { value: 'conversational', label: 'Conversational' },
    { value: 'academic', label: 'Academic' },
]

export function PreferencesView() {
    const [selectedModel, setSelectedModel] = useState(modelOptions[0].value)
    const [selectedTone, setSelectedTone] = useState(toneOptions[0].value)

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
                        Preferences
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[#86868B]">
                        Customize your Didactio experience
                    </p>
                </div>
            </header>

            <div className="p-8">
                <div className="max-w-[700px] space-y-6">
                    <div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Content Generation
                        </h2>
                        <div className="space-y-5">
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Default AI Model
                                </label>
                                <CustomSelect
                                    options={modelOptions}
                                    value={selectedModel}
                                    onChange={setSelectedModel}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Writing Tone
                                </label>
                                <CustomSelect
                                    options={toneOptions}
                                    value={selectedTone}
                                    onChange={setSelectedTone}
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Content Verbosity
                                </label>
                                <div className="flex items-center gap-4">
                                    <input type="range" min="1" max="3" defaultValue="2" className="flex-1" />
                                    <span className="min-w-[80px] text-[13px] text-[#86868B]">
                                        Medium
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[12px] border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Editor Settings
                        </h2>
                        <div className="space-y-4">
                            {[
                                { label: 'Auto-save changes', desc: 'Automatically save your edits' },
                                { label: 'Dark mode for editor', desc: 'Use dark theme in the book view' },
                                { label: 'Show reading time estimates', desc: 'Display time to read each chapter' },
                            ].map((setting, index) => (
                                <div
                                    key={setting.label}
                                    className="flex items-center justify-between rounded-[10px] border border-[#E5E5E7] p-4"
                                >
                                    <div>
                                        <div className="text-[14px] font-semibold text-[#1D1D1F]">
                                            {setting.label}
                                        </div>
                                        <div className="text-[12px] text-[#86868B]">{setting.desc}</div>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            defaultChecked={index === 0}
                                            className="peer sr-only"
                                        />
                                        <div className="peer h-6 w-11 rounded-full bg-[#E5E5E7] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#4ADE80] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
