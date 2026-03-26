import { useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import {
    type BackendAiConfig,
    type BackendAiModelConfig,
    type BackendAuthoringConfig,
    dashboardApi,
} from '../../../api/dashboardApi'

type ModelTier = 'cheap' | 'premium'

const tierLabels: Record<ModelTier, { title: string; description: string }> = {
    cheap: {
        title: 'Cheap Model',
        description: 'Faster, lower-cost default for routine generation.',
    },
    premium: {
        title: 'Premium Model',
        description: 'Higher-quality option for the moments when you want the best output.',
    },
}

function ModelConfigCard(props: {
    tier: ModelTier
    value: BackendAiModelConfig
    onChange: (next: BackendAiModelConfig) => void
}) {
    const meta = tierLabels[props.tier]

    return (
        <div className="rounded-[14px] border border-[#E5E5E7] bg-white p-5">
            <div className="mb-4">
                <h3 className="text-[16px] font-semibold text-[#1D1D1F]">{meta.title}</h3>
                <p className="mt-1 text-[12px] text-[#86868B]">{meta.description}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                        Provider
                    </label>
                    <input
                        type="text"
                        value={props.value.provider}
                        onChange={(event) =>
                            props.onChange({
                                ...props.value,
                                provider: event.target.value,
                            })
                        }
                        placeholder="e.g. deepseek"
                        className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                        Model
                    </label>
                    <input
                        type="text"
                        value={props.value.model}
                        onChange={(event) =>
                            props.onChange({
                                ...props.value,
                                model: event.target.value,
                            })
                        }
                        placeholder="e.g. deepseek-reasoner"
                        className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                    />
                </div>
            </div>
        </div>
    )
}

function AuthoringConfigCard(props: {
    value: BackendAuthoringConfig
    onChange: (next: BackendAuthoringConfig) => void
}) {
    return (
        <div className="rounded-[14px] border border-[#E5E5E7] bg-white p-5">
            <div className="mb-4">
                <h3 className="text-[16px] font-semibold text-[#1D1D1F]">Authoring Style</h3>
                <p className="mt-1 text-[12px] text-[#86868B]">
                    These settings shape the global authoring voice used across generation.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                        Language
                    </label>
                    <input
                        type="text"
                        value={props.value.language}
                        onChange={(event) =>
                            props.onChange({
                                ...props.value,
                                language: event.target.value,
                            })
                        }
                        placeholder="e.g. English"
                        className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">
                        Tone
                    </label>
                    <select
                        value={props.value.tone}
                        onChange={(event) =>
                            props.onChange({
                                ...props.value,
                                tone: event.target.value as BackendAuthoringConfig['tone'],
                            })
                        }
                        className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                    >
                        <option value="friendly">Friendly</option>
                        <option value="neutral">Neutral</option>
                        <option value="professional">Professional</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

export function PreferencesView() {
    const [config, setConfig] = useState<BackendAiConfig | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedNotice, setSavedNotice] = useState<string | null>(null)

    useEffect(() => {
        const loadConfig = async () => {
            setIsLoading(true)
            setError(null)

            try {
                setConfig(await dashboardApi.getAiConfig())
            } catch (loadError) {
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : 'Failed to load AI configuration.'
                )
            } finally {
                setIsLoading(false)
            }
        }

        void loadConfig()
    }, [])

    const handleSave = async () => {
        if (!config) {
            return
        }

        setIsSaving(true)
        setError(null)
        setSavedNotice(null)

        try {
            const nextConfig = await dashboardApi.updateAiConfig(config)
            setConfig(nextConfig)
            setSavedNotice('AI profile saved in memory for this session.')
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : 'Failed to save AI configuration.'
            )
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-[80px] shrink-0 items-center border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
                <div>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
                        Preferences
                    </h1>
                    <p className="mt-0.5 text-[13px] text-[#86868B]">
                        Configure the cheap/premium AI profiles and the shared authoring tone
                    </p>
                </div>
            </header>

            <div className="p-8">
                <div className="max-w-[920px] space-y-6">
                    {error && (
                        <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                            {error}
                        </div>
                    )}
                    {savedNotice && (
                        <div className="rounded-[12px] border border-[#D6F3DB] bg-[#F4FFF6] px-4 py-3 text-[13px] text-[#2F7A45]">
                            {savedNotice}
                        </div>
                    )}

                    <div className="rounded-[12px] border border-[#E5E5E7] bg-[#FAFAFB] p-6">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-[18px] font-bold text-[#1D1D1F]">
                                    AI Profile
                                </h2>
                                <p className="mt-1 text-[13px] text-[#6B7280]">
                                    These settings default from `.env`, and right now they are stored
                                    in backend memory for the current server session.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleSave()}
                                disabled={!config || isLoading || isSaving}
                                className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {isSaving ? 'Saving...' : 'Save AI Profile'}
                            </button>
                        </div>
                    </div>

                    {isLoading && (
                        <div className="flex min-h-[240px] items-center justify-center rounded-[12px] border border-[#E5E5E7] bg-white text-[#86868B]">
                            Loading AI configuration...
                        </div>
                    )}

                    {config && (
                        <div className="grid gap-5">
                            <AuthoringConfigCard
                                value={config.authoring}
                                onChange={(nextValue) =>
                                    setConfig((previous) =>
                                        previous
                                            ? {
                                                  ...previous,
                                                  authoring: nextValue,
                                              }
                                            : previous
                                    )
                                }
                            />
                            {(['cheap', 'premium'] as ModelTier[]).map((tier) => (
                                <ModelConfigCard
                                    key={tier}
                                    tier={tier}
                                    value={config[tier]}
                                    onChange={(nextValue) =>
                                        setConfig((previous) =>
                                            previous
                                                ? {
                                                      ...previous,
                                                      [tier]: nextValue,
                                                  }
                                                : previous
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
