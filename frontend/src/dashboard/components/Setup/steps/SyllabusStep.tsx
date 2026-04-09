import type { Dispatch, SetStateAction } from 'react'
import { Sparkles } from 'lucide-react'
import type { BackendAiModelTier } from '../../../api/dashboardApi'
import type { PlanningDetailViewModel, PlanningSyllabus } from '../../../types'
import { Progress } from '@/components/ui/progress'

type PartialPlanningSyllabus = {
    title?: string
    overview?: string
    learningGoals?: string[]
    keywords?: string[]
    chapters?: Array<{
        title?: string
        overview?: string
        keyPoints?: string[]
        lessons?: Array<{
            title?: string
            contentOutline?: string[]
        }>
    }>
}

type SyllabusStepProps = {
    planning: PlanningDetailViewModel | null
    syllabusToRender: PlanningSyllabus | PartialPlanningSyllabus | null
    hasSyllabus: boolean
    isStreamingSyllabus: boolean
    activeGenerationTier: BackendAiModelTier | null
    isSubmitting: boolean
    reviewDecision: 'accept' | 'reject'
    setReviewDecision: Dispatch<SetStateAction<'accept' | 'reject'>>
    regenerationContext: string
    setRegenerationContext: Dispatch<SetStateAction<string>>
    selectedGenerationTier: BackendAiModelTier
    setSelectedGenerationTier: Dispatch<SetStateAction<BackendAiModelTier>>
    onGenerateSyllabus: (tier: BackendAiModelTier) => Promise<void>
    onStartGeneration: (tier: BackendAiModelTier) => Promise<void>
}

function SyllabusCard({ syllabus, isStreaming, activeTier }: {
    syllabus: PlanningSyllabus | PartialPlanningSyllabus
    isStreaming: boolean
    activeTier: BackendAiModelTier | null
}) {
    return (
        <div className="space-y-4 rounded-[18px] border border-[#E5E5E7] bg-white p-5">
            <div>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#4DA56A]">
                        Syllabus Draft
                    </span>
                    {isStreaming && (
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#86868B]">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#4ADE80]" />
                            Streaming {activeTier}...
                        </span>
                    )}
                </div>
                <h3 className="mt-2 text-[20px] font-bold tracking-tight text-[#1D1D1F]">
                    {syllabus.title || 'Building syllabus...'}
                </h3>
                {syllabus.overview && (
                    <p className="mt-2 text-[13px] leading-6 text-[#4B5563]">{syllabus.overview}</p>
                )}
            </div>

            {/* Learning goals + keywords */}
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#F0F0F2] bg-[#FAFAFB] p-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        Learning goals
                    </div>
                    {(syllabus.learningGoals?.length ?? 0) > 0 ? (
                        <ul className="space-y-1 text-[13px] text-[#1D1D1F]">
                            {syllabus.learningGoals?.map((goal) => (
                                <li key={goal} className="flex gap-1.5">
                                    <span className="mt-0.5 text-[#4ADE80]">-</span>
                                    {goal}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-[12px] text-[#C7C7CC]">Still streaming...</p>
                    )}
                </div>
                <div className="rounded-lg border border-[#F0F0F2] bg-[#FAFAFB] p-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                        Keywords
                    </div>
                    {(syllabus.keywords?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {syllabus.keywords?.map((kw) => (
                                <span key={kw} className="rounded-md bg-[#E5E5E7] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                                    {kw}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[12px] text-[#C7C7CC]">Still streaming...</p>
                    )}
                </div>
            </div>

            {/* Chapters */}
            {(syllabus.chapters ?? []).map((chapter, idx) => (
                <div key={`${chapter.title}-${idx}`} className="rounded-lg border border-[#F0F0F2] bg-[#FAFAFB] p-4">
                    <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E5E5E7] text-[10px] font-semibold text-[#6E6E73]">
                            {idx + 1}
                        </span>
                        <h4 className="text-[14px] font-semibold text-[#1D1D1F]">
                            {chapter.title || `Chapter ${idx + 1}`}
                        </h4>
                    </div>
                    {chapter.overview && (
                        <p className="mt-2 text-[13px] leading-6 text-[#4B5563]">{chapter.overview}</p>
                    )}
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {(chapter.keyPoints?.length ?? 0) > 0 && (
                            <div>
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                                    Key points
                                </div>
                                <ul className="space-y-0.5 text-[12px] text-[#1D1D1F]">
                                    {chapter.keyPoints?.map((pt) => (
                                        <li key={pt}>- {pt}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {(chapter.lessons?.length ?? 0) > 0 && (
                            <div>
                                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                                    Lessons
                                </div>
                                <div className="space-y-1.5">
                                    {chapter.lessons?.map((lesson, li) => (
                                        <div key={`${lesson.title}-${li}`} className="rounded-md bg-white p-2">
                                            <div className="text-[12px] font-medium text-[#1D1D1F]">
                                                {lesson.title || `Lesson ${li + 1}`}
                                            </div>
                                            {(lesson.contentOutline?.length ?? 0) > 0 && (
                                                <div className="mt-1 space-y-0.5 text-[11px] text-[#86868B]">
                                                    {lesson.contentOutline?.map((o) => (
                                                        <div key={o}>- {o}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

export function SyllabusStep({
    planning,
    syllabusToRender,
    hasSyllabus,
    isStreamingSyllabus,
    activeGenerationTier,
    isSubmitting,
    reviewDecision,
    setReviewDecision,
    regenerationContext,
    setRegenerationContext,
    selectedGenerationTier,
    setSelectedGenerationTier,
    onGenerateSyllabus,
    onStartGeneration,
}: SyllabusStepProps) {
    void planning
    const isWaiting = !hasSyllabus && !syllabusToRender

    return (
        <div className="space-y-5">
            {/* Waiting state */}
            {isWaiting && (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#EAF9EF]">
                        <Sparkles size={20} className="text-[#4ADE80]" />
                    </div>
                    <p className="mb-4 text-[14px] font-medium text-[#1D1D1F]">Generating syllabus...</p>
                    <div className="w-48">
                        <Progress value={undefined} className="h-1.5 animate-pulse" />
                    </div>
                    <p className="mt-3 text-[12px] text-[#86868B]">
                        {isStreamingSyllabus ? 'Streaming syllabus draft...' : 'Preparing syllabus generation...'}
                    </p>
                </div>
            )}

            {/* Syllabus display */}
            {syllabusToRender && (
                <SyllabusCard
                    syllabus={syllabusToRender}
                    isStreaming={isStreamingSyllabus}
                    activeTier={activeGenerationTier}
                />
            )}

            {/* Review controls */}
            {hasSyllabus && (
                <div className="rounded-[14px] border border-[#E5E5E7] bg-white p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-[#1D1D1F]">Accept this syllabus?</p>
                        <div className="inline-flex rounded-[8px] border border-[#E5E5E7] bg-[#F5F5F7] p-0.5">
                            <button
                                type="button"
                                onClick={() => setReviewDecision('accept')}
                                className={`rounded-[6px] px-3 py-1 text-[12px] font-medium transition-all ${
                                    reviewDecision === 'accept'
                                        ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                        : 'text-[#6E6E73]'
                                }`}
                            >
                                Accept
                            </button>
                            <button
                                type="button"
                                onClick={() => setReviewDecision('reject')}
                                className={`rounded-[6px] px-3 py-1 text-[12px] font-medium transition-all ${
                                    reviewDecision === 'reject'
                                        ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                        : 'text-[#6E6E73]'
                                }`}
                            >
                                Reject
                            </button>
                        </div>
                    </div>

                    {reviewDecision === 'accept' ? (
                        <div className="mt-4 flex items-center justify-between">
                            <div className="inline-flex rounded-[8px] border border-[#E5E5E7] bg-[#F5F5F7] p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setSelectedGenerationTier('cheap')}
                                    className={`rounded-[6px] px-3 py-1 text-[12px] font-medium transition-all ${
                                        selectedGenerationTier === 'cheap'
                                            ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                            : 'text-[#6E6E73]'
                                    }`}
                                >
                                    Cheap
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedGenerationTier('premium')}
                                    className={`rounded-[6px] px-3 py-1 text-[12px] font-medium transition-all ${
                                        selectedGenerationTier === 'premium'
                                            ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                            : 'text-[#6E6E73]'
                                    }`}
                                >
                                    Premium
                                </button>
                            </div>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => void onStartGeneration(selectedGenerationTier)}
                                className="rounded-[10px] bg-[#1D1D1F] px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2C2C2E] disabled:opacity-40"
                            >
                                {isSubmitting ? 'Starting...' : 'Start Generation'}
                            </button>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            <textarea
                                rows={3}
                                value={regenerationContext}
                                onChange={(e) => setRegenerationContext(e.target.value)}
                                placeholder="What would you like changed?"
                                className="w-full rounded-[10px] border border-[#E5E5E7] bg-[#FAFAFB] px-3 py-2 text-[13px] text-[#1D1D1F] placeholder:text-[#C7C7CC] focus:border-[#4ADE80] focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={isSubmitting || !regenerationContext.trim()}
                                    onClick={() => void onGenerateSyllabus('cheap')}
                                    className="rounded-[10px] border border-[#E5E5E7] px-4 py-2 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] disabled:opacity-40"
                                >
                                    {isStreamingSyllabus && activeGenerationTier === 'cheap' ? 'Regenerating...' : 'Regenerate Cheap'}
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitting || !regenerationContext.trim()}
                                    onClick={() => void onGenerateSyllabus('premium')}
                                    className="rounded-[10px] bg-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2C2C2E] disabled:opacity-40"
                                >
                                    {isStreamingSyllabus && activeGenerationTier === 'premium' ? 'Regenerating...' : 'Regenerate Premium'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    )
}
