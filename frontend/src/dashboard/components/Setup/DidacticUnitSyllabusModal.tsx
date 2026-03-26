import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Streamdown } from 'streamdown'
import { type BackendAiModelTier, dashboardApi } from '../../api/dashboardApi'
import { adaptDidacticUnitPlanning } from '../../adapters'
import type { PlanningDetailViewModel } from '../../types'

type DidacticUnitSyllabusModalProps = {
    didacticUnitId: string
    onClose: () => void
    onDataChanged: () => void
    onOpenEditor: (didacticUnitId: string) => void
    onOpenSetup: (didacticUnitId: string) => void
}

type ReviewDecision = 'accept' | 'reject'

function isSyllabusStage(nextAction: string): boolean {
    return (
        nextAction === 'generate_syllabus_prompt' ||
        nextAction === 'review_syllabus_prompt' ||
        nextAction === 'review_syllabus' ||
        nextAction === 'approve_syllabus'
    )
}

function needsInitialSyllabusGeneration(nextAction: string): boolean {
    return (
        nextAction === 'generate_syllabus_prompt' ||
        nextAction === 'review_syllabus_prompt'
    )
}

export function DidacticUnitSyllabusModal({
    didacticUnitId,
    onClose,
    onDataChanged,
    onOpenEditor,
    onOpenSetup,
}: DidacticUnitSyllabusModalProps) {
    const [planning, setPlanning] = useState<PlanningDetailViewModel | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [streamedSyllabusMarkdown, setStreamedSyllabusMarkdown] = useState('')
    const [isStreamingSyllabus, setIsStreamingSyllabus] = useState(false)
    const [activeGenerationTier, setActiveGenerationTier] = useState<BackendAiModelTier | null>(null)
    const [selectedGenerationTier, setSelectedGenerationTier] =
        useState<BackendAiModelTier>('premium')
    const [reviewDecision, setReviewDecision] = useState<ReviewDecision>('accept')
    const [regenerationContext, setRegenerationContext] = useState('')

    const hasSyllabus = Boolean(planning?.syllabus)

    const applyPlanningState = useCallback(
        (detail: Awaited<ReturnType<typeof dashboardApi.getDidacticUnit>>) => {
            const planningDetail = adaptDidacticUnitPlanning(detail)

            if (
                planningDetail.nextAction === 'moderate_topic' ||
                planningDetail.nextAction === 'generate_questionnaire' ||
                planningDetail.nextAction === 'answer_questionnaire'
            ) {
                onOpenSetup(planningDetail.id)
                return
            }

            setPlanning(planningDetail)
            setRegenerationContext('')
            if (planningDetail.syllabus) {
                setReviewDecision('accept')
            }
        },
        [onOpenSetup]
    )

    useEffect(() => {
        void (async () => {
            setIsLoading(true)
            setError(null)

            try {
                const detail = await dashboardApi.getDidacticUnit(didacticUnitId)
                applyPlanningState(detail)
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load unit.')
            } finally {
                setIsLoading(false)
            }
        })()
    }, [applyPlanningState, didacticUnitId])

    const progressPercent = useMemo(() => planning?.progressPercent ?? 0, [planning?.progressPercent])

    const handleGenerateSyllabus = useCallback(
        async (tier: BackendAiModelTier) => {
            if (!planning) {
                return
            }

            setIsSubmitting(true)
            setIsStreamingSyllabus(true)
            setActiveGenerationTier(tier)
            setStreamedSyllabusMarkdown('')
            setError(null)

            try {
                const detail = await dashboardApi.streamDidacticUnitSyllabus(
                    planning.id,
                    tier,
                    {
                        onPartialMarkdown: (event) => {
                            setStreamedSyllabusMarkdown(event.markdown)
                        },
                    },
                    reviewDecision === 'reject'
                        ? { context: regenerationContext.trim() || undefined }
                        : undefined
                )

                applyPlanningState(detail)
                onDataChanged()
            } catch (actionError) {
                setError(actionError instanceof Error ? actionError.message : 'Action failed.')
            } finally {
                setIsSubmitting(false)
                setIsStreamingSyllabus(false)
                setActiveGenerationTier(null)
            }
        },
        [applyPlanningState, onDataChanged, planning, regenerationContext, reviewDecision]
    )

    useEffect(() => {
        if (
            !planning ||
            planning.syllabus ||
            isStreamingSyllabus ||
            isSubmitting ||
            !needsInitialSyllabusGeneration(planning.nextAction)
        ) {
            return
        }

        void handleGenerateSyllabus('cheap')
    }, [handleGenerateSyllabus, isStreamingSyllabus, isSubmitting, planning])

    const handleStartGeneration = async (tier: BackendAiModelTier) => {
        if (!planning || !planning.syllabus) {
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            let detail = await dashboardApi.getDidacticUnit(planning.id)
            if (isSyllabusStage(detail.nextAction)) {
                detail = await dashboardApi.approveDidacticUnitSyllabus(planning.id, tier)
            }

            onDataChanged()
            onOpenEditor(detail.id)
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const renderSyllabus = () => {
        if (!planning?.syllabus) {
            return null
        }

        const syllabus = planning.syllabus

        return (
            <section className="space-y-5 rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                <div>
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#4DA56A]">
                        Syllabus Draft
                    </div>
                    <h3 className="mt-2 text-[24px] font-bold tracking-tight text-[#1D1D1F]">
                        {syllabus.title}
                    </h3>
                    <p className="mt-3 text-[14px] leading-7 text-[#4B5563]">
                        {syllabus.overview}
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[14px] border border-[#E5E5E7] bg-white p-4">
                        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                            Learning goals
                        </div>
                        <div className="mt-3 space-y-2 text-[14px] text-[#1D1D1F]">
                            {syllabus.learningGoals.map((goal) => (
                                <div key={goal}>- {goal}</div>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-[14px] border border-[#E5E5E7] bg-white p-4">
                        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                            Course metadata
                        </div>
                        <div className="mt-3 space-y-2 text-[14px] text-[#1D1D1F]">
                            <div>Duration: {syllabus.estimatedDurationMinutes} minutes</div>
                            <div>Keywords: {syllabus.keywords.join(', ')}</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {syllabus.chapters.map((chapter, index) => (
                        <article
                            key={`${chapter.title}-${index}`}
                            className="rounded-[16px] border border-[#E5E5E7] bg-white p-5"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                                        Chapter {index + 1}
                                    </div>
                                    <h4 className="mt-2 text-[18px] font-semibold text-[#1D1D1F]">
                                        {chapter.title}
                                    </h4>
                                </div>
                                <div className="rounded-full border border-[#E5E5E7] bg-[#FAFAFB] px-3 py-1 text-[12px] font-semibold text-[#4B5563]">
                                    {chapter.estimatedDurationMinutes} min
                                </div>
                            </div>
                            <p className="mt-3 text-[14px] leading-7 text-[#4B5563]">
                                {chapter.overview}
                            </p>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                                        Key points
                                    </div>
                                    <div className="mt-2 space-y-2 text-[14px] text-[#1D1D1F]">
                                        {chapter.keyPoints.map((point) => (
                                            <div key={point}>- {point}</div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
                                        Lessons
                                    </div>
                                    <div className="mt-2 space-y-3">
                                        {chapter.lessons.map((lesson) => (
                                            <div key={lesson.title} className="rounded-[12px] border border-[#EEF0F2] bg-[#FAFAFB] p-3">
                                                <div className="text-[13px] font-semibold text-[#1D1D1F]">
                                                    {lesson.title}
                                                </div>
                                                <div className="mt-2 space-y-1 text-[13px] text-[#4B5563]">
                                                    {lesson.contentOutline.map((outline) => (
                                                        <div key={outline}>- {outline}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        )
    }

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-[2px]">
            <div className="max-h-[92vh] w-full max-w-[1040px] overflow-hidden rounded-[22px] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.2)]">
                <div className="flex items-start justify-between border-b border-[#E5E5E7] px-8 py-7">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#EAF9EF]">
                            <Sparkles className="text-[#4ADE80]" size={22} />
                        </div>
                        <div>
                            <h1 className="text-[18px] font-bold text-[#1D1D1F]">
                                Review Syllabus
                            </h1>
                            <p className="mt-1 text-[13px] text-[#86868B]">
                                Generate a syllabus draft, then accept it or reject it with clearer guidance.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-[#86868B] transition-all hover:bg-[#F5F5F7]"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[calc(92vh-96px)] overflow-y-auto px-8 py-6">
                    {error && (
                        <div className="mb-5 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                            {error}
                        </div>
                    )}

                    {isLoading || !planning ? (
                        <div className="flex min-h-[280px] items-center justify-center text-[#86868B]">
                            Loading syllabus review...
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-[24px] font-bold tracking-tight text-[#1D1D1F]">
                                        {planning.topic}
                                    </h2>
                                    <p className="mt-1 text-[13px] text-[#86868B]">
                                        {planning.provider} syllabus flow - {progressPercent}% complete
                                    </p>
                                </div>
                                <div className="min-w-[180px]">
                                    <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#86868B]">
                                        <span>Progress</span>
                                        <span>{progressPercent}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-[#F0F0F2]">
                                        <div
                                            className="h-full rounded-full bg-[#4ADE80]"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {(planning.improvedTopicBrief || planning.additionalContext) && (
                                <section className="rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                                    <div className="flex flex-wrap gap-2">
                                        <div className="rounded-full border border-[#DCEBDD] bg-white px-3 py-1 text-[12px] font-semibold text-[#34614A]">
                                            Depth: {planning.depth}
                                        </div>
                                        <div className="rounded-full border border-[#DCEBDD] bg-white px-3 py-1 text-[12px] font-semibold text-[#34614A]">
                                            Length: {planning.length}
                                        </div>
                                    </div>
                                    {planning.improvedTopicBrief && (
                                        <p className="mt-4 text-[14px] leading-7 text-[#1D1D1F]">
                                            {planning.improvedTopicBrief}
                                        </p>
                                    )}
                                    {planning.additionalContext && (
                                        <div className="mt-4 rounded-[12px] border border-[#E5E5E7] bg-white px-4 py-3 text-[13px] text-[#4B5563]">
                                            <div className="mb-1 font-semibold text-[#1D1D1F]">
                                                Starting context
                                            </div>
                                            <div>{planning.additionalContext}</div>
                                        </div>
                                    )}
                                </section>
                            )}

                            {!hasSyllabus && (
                                <section className="rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                                    <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                                        Preparing your syllabus
                                    </h3>
                                    <p className="mt-2 text-[13px] text-[#6B7280]">
                                        The syllabus is being generated automatically with the cheap model. As soon as it is ready, you can accept it or reject it with extra context.
                                    </p>
                                    <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#DCE8E0] bg-white px-4 py-2 text-[13px] font-semibold text-[#34614A]">
                                        <Sparkles size={14} />
                                        {isStreamingSyllabus
                                            ? 'Generating cheap-model syllabus...'
                                            : 'Waiting for syllabus draft...'}
                                    </div>
                                </section>
                            )}

                            {(isStreamingSyllabus || streamedSyllabusMarkdown) && (
                                <section className="rounded-[18px] border border-[#DCEEDD] bg-[#F7FFF8] p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                                                Live syllabus generation
                                            </h3>
                                            <p className="text-[12px] text-[#5F6B63]">
                                                Markdown is rendered as it streams in.
                                            </p>
                                        </div>
                                        <div className="text-[12px] font-semibold text-[#4DA56A]">
                                            {isStreamingSyllabus
                                                ? `Streaming ${activeGenerationTier ?? 'selected'}...`
                                                : 'Complete'}
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-[14px] border border-[#E3EFE6] bg-white p-4">
                                        <Streamdown className="text-[14px] leading-7 text-[#1D1D1F]">
                                            {streamedSyllabusMarkdown || 'Waiting for markdown...'}
                                        </Streamdown>
                                    </div>
                                </section>
                            )}

                            {renderSyllabus()}

                            {hasSyllabus && (
                                <section className="rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                                    <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                                        Do you want to accept this syllabus?
                                    </h3>
                                    <div className="mt-4 inline-flex rounded-[14px] border border-[#E5E5E7] bg-white p-1">
                                        <button
                                            type="button"
                                            onClick={() => setReviewDecision('accept')}
                                            className={`rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors ${
                                                reviewDecision === 'accept'
                                                    ? 'bg-[#1D1D1F] text-white'
                                                    : 'text-[#1D1D1F]'
                                            }`}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setReviewDecision('reject')}
                                            className={`rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors ${
                                                reviewDecision === 'reject'
                                                    ? 'bg-[#1D1D1F] text-white'
                                                    : 'text-[#1D1D1F]'
                                            }`}
                                        >
                                            Reject
                                        </button>
                                    </div>

                                    {reviewDecision === 'accept' ? (
                                        <div className="mt-5 flex justify-end">
                                            <div className="space-y-3">
                                                <p className="text-[13px] text-[#6B7280]">
                                                    Choose the model tier for the full unit. Chapter generation will begin as soon as the editor opens.
                                                </p>
                                                <div className="flex items-center justify-end gap-3">
                                                    <div className="inline-flex rounded-[14px] border border-[#E5E5E7] bg-white p-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedGenerationTier('cheap')}
                                                            className={`rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors ${
                                                                selectedGenerationTier === 'cheap'
                                                                    ? 'bg-[#1D1D1F] text-white'
                                                                    : 'text-[#1D1D1F]'
                                                            }`}
                                                        >
                                                            Cheap
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedGenerationTier('premium')}
                                                            className={`rounded-[10px] px-4 py-2 text-[14px] font-semibold transition-colors ${
                                                                selectedGenerationTier === 'premium'
                                                                    ? 'bg-[#1D1D1F] text-white'
                                                                    : 'text-[#1D1D1F]'
                                                            }`}
                                                        >
                                                            Premium
                                                        </button>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={isSubmitting}
                                                        className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                                                        onClick={() =>
                                                            void handleStartGeneration(selectedGenerationTier)
                                                        }
                                                    >
                                                        {isSubmitting ? 'Starting...' : 'Start Generation'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-5 space-y-4">
                                            <div>
                                                <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                                    What would you like to be changed?
                                                </label>
                                                <textarea
                                                    rows={5}
                                                    value={regenerationContext}
                                                    onChange={(event) => setRegenerationContext(event.target.value)}
                                                    placeholder="Ask for a different emphasis, audience level, structure, pacing, practical focus, or anything else you want adjusted."
                                                    className="w-full rounded-[12px] border border-[#E5E5E7] bg-white px-4 py-3 text-[14px] text-[#1D1D1F] focus:border-[#4ADE80] focus:outline-none"
                                                />
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-3">
                                                <button
                                                    type="button"
                                                    disabled={isSubmitting || !regenerationContext.trim()}
                                                    onClick={() => void handleGenerateSyllabus('cheap')}
                                                    className="rounded-[12px] border border-[#D4D7DD] bg-white px-5 py-3 text-[14px] font-semibold text-[#1D1D1F] disabled:opacity-50"
                                                >
                                                    {isStreamingSyllabus && activeGenerationTier === 'cheap'
                                                        ? 'Regenerating Cheap...'
                                                        : 'Regenerate Cheap'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isSubmitting || !regenerationContext.trim()}
                                                    onClick={() => void handleGenerateSyllabus('premium')}
                                                    className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                                                >
                                                    {isStreamingSyllabus && activeGenerationTier === 'premium'
                                                        ? 'Regenerating Premium...'
                                                        : 'Regenerate Premium'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
