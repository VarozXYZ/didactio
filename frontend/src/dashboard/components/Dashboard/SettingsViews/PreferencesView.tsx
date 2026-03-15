export function PreferencesView() {
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
                    <div className="rounded-2xl border border-[#E5E5E7] bg-white p-8">
                        <h2 className="mb-6 text-[18px] font-bold text-[#1D1D1F]">
                            Content Generation
                        </h2>
                        <div className="space-y-5">
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Default AI Model
                                </label>
                                <select className="w-full rounded-xl border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none">
                                    <option>GPT-4 (Recommended)</option>
                                    <option>GPT-3.5 Turbo</option>
                                    <option>Claude 3</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                    Writing Tone
                                </label>
                                <select className="w-full rounded-xl border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none">
                                    <option>Professional</option>
                                    <option>Conversational</option>
                                    <option>Academic</option>
                                </select>
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

                    <div className="rounded-2xl border border-[#E5E5E7] bg-white p-8">
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
                                    className="flex items-center justify-between rounded-xl border border-[#E5E5E7] p-4"
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
