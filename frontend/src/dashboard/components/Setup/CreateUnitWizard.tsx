import { useCallback, useEffect, useMemo, useState } from 'react'
import { toastError } from '@/hooks/use-toast'
import { Check, X } from 'lucide-react'
import { type BackendFolder, type BackendAiModelTier, dashboardApi } from '../../api/dashboardApi'
import { adaptDidacticUnitPlanning } from '../../adapters'
import type { PlanningDetailViewModel, PlanningSyllabus } from '../../types'
import { TopicStep } from './steps/TopicStep'
import { QuestionnaireStep } from './steps/QuestionnaireStep'
import { SyllabusStep } from './steps/SyllabusStep'

export type WizardStep = 0 | 1 | 2

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

type PartialReferenceSyllabus = {
    title?: string
    description?: string
    keywords?: string | string[]
    modules?: Array<{
        title?: string
        overview?: string
        lessons?: Array<{
            title?: string
            contentOutline?: string[]
        }>
    }>
}

function normalizeKeywords(value: string | string[] | undefined): string[] | undefined {
    if (Array.isArray(value)) return value.filter((k) => typeof k === 'string' && k.trim())
    if (typeof value === 'string') return value.split(/[,\n;]/).map((k) => k.trim()).filter(Boolean)
    return undefined
}

function deriveKeyPointsFromLessons(
    lessons: Array<{ title?: string; contentOutline?: string[] }> | undefined
): string[] | undefined {
    const outlines = (lessons ?? []).flatMap((l) => l.contentOutline ?? []).filter((i) => typeof i === 'string' && i.trim())
    if (outlines.length > 0) return outlines.slice(0, 3)
    const titles = (lessons ?? []).map((l) => l.title?.trim()).filter((t): t is string => Boolean(t))
    return titles.length > 0 ? titles.slice(0, 3) : undefined
}

function deriveLearningGoalsFromModules(
    modules: Array<{ title?: string; lessons?: Array<{ title?: string; contentOutline?: string[] }> }> | undefined
): string[] | undefined {
    const outlines = (modules ?? []).flatMap((m) => m.lessons ?? []).flatMap((l) => l.contentOutline ?? []).filter((i) => typeof i === 'string' && i.trim())
    if (outlines.length > 0) return outlines.slice(0, 3)
    const titles = (modules ?? []).map((m) => m.title?.trim()).filter((t): t is string => Boolean(t)).map((t) => `Understand ${t}`)
    return titles.length > 0 ? titles.slice(0, 3) : undefined
}

export function normalizeStreamedSyllabusPreview(
    value: PartialPlanningSyllabus | PartialReferenceSyllabus | null | undefined
): PartialPlanningSyllabus | null {
    if (!value || typeof value !== 'object') return null

    if ('chapters' in value || 'overview' in value || 'learningGoals' in value) {
        return {
            ...value,
            keywords: normalizeKeywords((value as PartialPlanningSyllabus).keywords),
            chapters: (value as PartialPlanningSyllabus).chapters?.map((ch) => ({
                ...ch,
                keyPoints: Array.isArray(ch.keyPoints) ? ch.keyPoints.filter((p) => typeof p === 'string' && p.trim()) : ch.keyPoints,
                lessons: ch.lessons?.map((l) => ({
                    ...l,
                    contentOutline: Array.isArray(l.contentOutline) ? l.contentOutline.filter((o) => typeof o === 'string' && o.trim()) : l.contentOutline,
                })),
            })),
        }
    }

    const ref = value as PartialReferenceSyllabus
    const normalizedModules = ref.modules?.map((m) => ({
        title: m.title,
        overview: m.overview,
        keyPoints: deriveKeyPointsFromLessons(m.lessons),
        lessons: m.lessons?.map((l) => ({ title: l.title, contentOutline: l.contentOutline?.filter((o) => typeof o === 'string' && o.trim()) })),
    }))

    return {
        title: ref.title,
        overview: ref.description,
        keywords: normalizeKeywords(ref.keywords),
        learningGoals: deriveLearningGoalsFromModules(ref.modules),
        chapters: normalizedModules,
    }
}

const STEPS = [
    { label: 'Topic', subtitle: 'Define your unit' },
    { label: 'Questionnaire', subtitle: 'Learner input' },
    { label: 'Syllabus', subtitle: 'Review & approve' },
] as const

function isSyllabusStage(nextAction: string): boolean {
    return (
        nextAction === 'generate_syllabus_prompt' ||
        nextAction === 'review_syllabus_prompt' ||
        nextAction === 'review_syllabus' ||
        nextAction === 'approve_syllabus'
    )
}

function resolveStepFromNextAction(nextAction: string): WizardStep {
    if (isSyllabusStage(nextAction)) return 2
    if (nextAction === 'answer_questionnaire') return 1
    if (nextAction === 'generate_questionnaire') return 1
    return 0
}

export type CreateUnitWizardProps = {
    didacticUnitId?: string | null
    onClose: () => void
    onDataChanged: () => void
    onOpenEditor: (didacticUnitId: string) => void
}

export function CreateUnitWizard({
    didacticUnitId,
    onClose,
    onDataChanged,
    onOpenEditor,
}: CreateUnitWizardProps) {
    const [currentStep, setCurrentStep] = useState<WizardStep>(0)

    const [planning, setPlanning] = useState<PlanningDetailViewModel | null>(null)
    const [activeUnitId, setActiveUnitId] = useState<string | null>(didacticUnitId ?? null)
    const [availableFolders, setAvailableFolders] = useState<BackendFolder[]>([])

    const [draftTopic, setDraftTopic] = useState('')
    const [draftAdditionalContext, setDraftAdditionalContext] = useState('')
    const [draftLevel, setDraftLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
    const [draftDepth, setDraftDepth] = useState<'basic' | 'intermediate' | 'technical'>('intermediate')
    const [draftLength, setDraftLength] = useState<'intro' | 'short' | 'long' | 'textbook'>('short')
    const [draftFolderId, setDraftFolderId] = useState<string | null>(null)

    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({})

    const [streamedSyllabusPreview, setStreamedSyllabusPreview] = useState<PartialPlanningSyllabus | null>(null)
    const [isStreamingSyllabus, setIsStreamingSyllabus] = useState(false)
    const [activeGenerationTier, setActiveGenerationTier] = useState<BackendAiModelTier | null>(null)
    const [reviewDecision, setReviewDecision] = useState<'accept' | 'reject'>('accept')
    const [regenerationContext, setRegenerationContext] = useState('')
    const [selectedGenerationTier, setSelectedGenerationTier] = useState<BackendAiModelTier>('premium')

    const [isLoading, setIsLoading] = useState(Boolean(didacticUnitId))
    const [isSubmitting, setIsSubmitting] = useState(false)

    const applyPlanningState = useCallback(
        (detail: Awaited<ReturnType<typeof dashboardApi.getDidacticUnit>>) => {
            const pd = adaptDidacticUnitPlanning(detail)
            setPlanning(pd)
            setQuestionnaireAnswers(pd.questionnaire?.answers ?? {})
            setDraftAdditionalContext(pd.additionalContext ?? '')
            setDraftLevel(pd.level)
            setDraftDepth(pd.depth)
            setDraftLength(pd.length)
            setDraftFolderId(pd.folder.id)
            setActiveUnitId(pd.id)

            const targetStep = resolveStepFromNextAction(pd.nextAction)
            setCurrentStep(targetStep)
        },
        []
    )

    useEffect(() => {
        void (async () => {
            try {
                const response = await dashboardApi.listFolders()
                setAvailableFolders(response.folders)
            } catch (e) {
                toastError(e instanceof Error ? e.message : 'Failed to load folders.')
            }
        })()
    }, [])

    useEffect(() => {
        if (!didacticUnitId) return
        void (async () => {
            setIsLoading(true)
            try {
                let detail = await dashboardApi.getDidacticUnit(didacticUnitId)
                if (detail.nextAction === 'moderate_topic') {
                    detail = await dashboardApi.moderateDidacticUnit(didacticUnitId)
                }
                applyPlanningState(detail)
            } catch (e) {
                toastError(e instanceof Error ? e.message : 'Failed to load unit.')
            } finally {
                setIsLoading(false)
            }
        })()
    }, [applyPlanningState, didacticUnitId])

    const handleTopicSubmit = useCallback(async () => {
        setIsSubmitting(true)
        try {
            const created = await dashboardApi.createDidacticUnit({
                topic: draftTopic.trim(),
                additionalContext: draftAdditionalContext.trim() || undefined,
                level: draftLevel,
                depth: draftDepth,
                length: draftLength,
                questionnaireEnabled: true,
                folderSelection: draftFolderId
                    ? { mode: 'manual', folderId: draftFolderId }
                    : { mode: 'auto' },
            })

            let detail = await dashboardApi.moderateDidacticUnit(created.id)
            if (detail.nextAction === 'generate_questionnaire') {
                detail = await dashboardApi.generateDidacticUnitQuestionnaire(created.id, 'cheap')
            }

            onDataChanged()
            const pd = adaptDidacticUnitPlanning(detail)
            setPlanning(pd)
            setQuestionnaireAnswers(pd.questionnaire?.answers ?? {})
            setActiveUnitId(pd.id)

            if (isSyllabusStage(pd.nextAction)) {
                setCurrentStep(2)
            } else {
                setCurrentStep(1)
            }
        } catch (e) {
            toastError(e instanceof Error ? e.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }, [draftTopic, draftAdditionalContext, draftLevel, draftDepth, draftLength, draftFolderId, onDataChanged])

    const handleQuestionnaireSubmit = useCallback(async () => {
        if (!planning?.questionnaire) return
        setIsSubmitting(true)
        try {
            const detail = await dashboardApi.answerDidacticUnitQuestionnaire(
                planning.id,
                planning.questionnaire.questions.map((q) => ({
                    questionId: q.id,
                    value: questionnaireAnswers[q.id]?.trim() ?? '',
                }))
            )
            onDataChanged()
            const pd = adaptDidacticUnitPlanning(detail)
            setPlanning(pd)
            setCurrentStep(2)
        } catch (e) {
            toastError(e instanceof Error ? e.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }, [planning, questionnaireAnswers, onDataChanged])

    const handleQuestionnaireSkip = useCallback(async () => {
        if (!planning) return
        setIsSubmitting(true)
        try {
            const detail = await dashboardApi.answerDidacticUnitQuestionnaire(planning.id, [])
            onDataChanged()
            const pd = adaptDidacticUnitPlanning(detail)
            setPlanning(pd)
            setCurrentStep(2)
        } catch (e) {
            toastError(e instanceof Error ? e.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }, [planning, onDataChanged])

    const handleGenerateSyllabus = useCallback(
        async (tier: BackendAiModelTier) => {
            if (!planning) return
            setIsSubmitting(true)
            setIsStreamingSyllabus(true)
            setActiveGenerationTier(tier)
            setStreamedSyllabusPreview(null)
            try {
                const detail = await dashboardApi.streamDidacticUnitSyllabus(
                    planning.id,
                    tier,
                    {
                        onPartialStructured: (event) => {
                            const partial = event.data as { syllabus?: PartialPlanningSyllabus } | PartialPlanningSyllabus
                            setStreamedSyllabusPreview(
                                normalizeStreamedSyllabusPreview(
                                    'syllabus' in partial && partial.syllabus ? partial.syllabus : (partial as PartialPlanningSyllabus)
                                )
                            )
                        },
                    },
                    reviewDecision === 'reject' ? { context: regenerationContext.trim() || undefined } : undefined
                )
                const pd = adaptDidacticUnitPlanning(detail)
                setPlanning(pd)
                setStreamedSyllabusPreview(null)
                setRegenerationContext('')
                if (pd.syllabus) setReviewDecision('accept')
                onDataChanged()
            } catch (e) {
                toastError(e instanceof Error ? e.message : 'Action failed.')
            } finally {
                setIsSubmitting(false)
                setIsStreamingSyllabus(false)
                setActiveGenerationTier(null)
            }
        },
        [planning, reviewDecision, regenerationContext, onDataChanged]
    )

    const handleStartGeneration = useCallback(
        async (tier: BackendAiModelTier) => {
            if (!planning?.syllabus) return
            setIsSubmitting(true)
            try {
                let detail = await dashboardApi.getDidacticUnit(planning.id)
                if (isSyllabusStage(detail.nextAction)) {
                    detail = await dashboardApi.approveDidacticUnitSyllabus(planning.id, tier)
                }
                onDataChanged()
                onOpenEditor(detail.id)
            } catch (e) {
                toastError(e instanceof Error ? e.message : 'Action failed.')
            } finally {
                setIsSubmitting(false)
            }
        },
        [planning, onDataChanged, onOpenEditor]
    )

    const hasSyllabus = Boolean(planning?.syllabus)
    const hasStreamPreview = Boolean(
        streamedSyllabusPreview &&
        ((streamedSyllabusPreview.title?.trim()) || (streamedSyllabusPreview.chapters?.length ?? 0) > 0)
    )
    const syllabusToRender: PlanningSyllabus | PartialPlanningSyllabus | null =
        isStreamingSyllabus && hasStreamPreview
            ? streamedSyllabusPreview
            : planning?.syllabus ?? (hasStreamPreview ? streamedSyllabusPreview : null)

    const needsInitialSyllabusGeneration = useMemo(() => {
        if (!planning || planning.syllabus || isStreamingSyllabus || isSubmitting) return false
        return planning.nextAction === 'generate_syllabus_prompt' || planning.nextAction === 'review_syllabus_prompt'
    }, [planning, isStreamingSyllabus, isSubmitting])

    useEffect(() => {
        if (needsInitialSyllabusGeneration && currentStep === 2) {
            void handleGenerateSyllabus('cheap')
        }
    }, [needsInitialSyllabusGeneration, currentStep, handleGenerateSyllabus])


    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="rounded-[18px] bg-white/95 px-10 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                    <div className="text-[14px] text-[#86868B]">Loading unit...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-3 sm:py-6"
             style={{ background: 'radial-gradient(ellipse at 60% 40%, rgba(17,160,125,0.18) 0%, rgba(52,52,195,0.12) 40%, rgba(239,160,71,0.10) 70%, rgba(0,0,0,0.45) 100%)', backdropFilter: 'blur(20px)' }}>
            <div className="flex min-h-0 max-h-[calc(100dvh-0.75rem)] w-full max-w-[920px] overflow-hidden rounded-[22px] sm:max-h-[calc(100dvh-1.5rem)]"
                 style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(40px) saturate(1.6)', boxShadow: '0 2px 0 rgba(255,255,255,0.8) inset, 0 32px_80px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.55)' }}>
                {/* Stepper sidebar */}
                <div className="flex w-[196px] shrink-0 flex-col px-5 py-7"
                     style={{ background: 'rgba(255,255,255,0.45)', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                    <div className="mb-7">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#86868B]">New Unit</p>
                    </div>

                    <nav className="flex flex-1 flex-col gap-0.5">
                        {STEPS.map((step, index) => {
                            const isCompleted = index < currentStep
                            const isCurrent = index === currentStep

                            return (
                                <div
                                    key={step.label}
                                    className={`flex items-center gap-3 rounded-[12px] px-3 py-2.5 transition-all ${
                                        isCurrent
                                            ? 'shadow-[0_1px_4px_rgba(0,0,0,0.10)]'
                                            : !isCompleted
                                              ? 'opacity-30'
                                              : 'opacity-60'
                                    }`}
                                    style={isCurrent ? { background: 'rgba(255,255,255,0.80)' } : undefined}
                                >
                                    <span
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                                            isCompleted
                                                ? 'bg-[#11A07D] text-white'
                                                : isCurrent
                                                  ? 'bg-[#1D1D1F] text-white'
                                                  : 'bg-black/10 text-[#86868B]'
                                        }`}
                                    >
                                        {isCompleted ? (
                                            <Check size={11} strokeWidth={3} />
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    <div className="min-w-0">
                                        <div className={`text-[13px] font-semibold ${isCurrent ? 'text-[#1D1D1F]' : 'text-[#6E6E73]'}`}>
                                            {step.label}
                                        </div>
                                        <div className="text-[11px] text-[#86868B]">{step.subtitle}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </nav>
                </div>

                {/* Content area */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex items-center justify-between px-6 py-4"
                         style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-[16px] font-semibold text-[#1D1D1F]">
                                    {STEPS[currentStep].label}
                                </h1>
                                {currentStep === 1 && (
                                    <span
                                        className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                                        style={{ background: 'rgba(17,160,125,0.10)', color: '#0A8A6A' }}
                                    >
                                        Optional
                                    </span>
                                )}
                            </div>
                            <p className="text-[12px] text-[#86868B]">
                                Step {currentStep + 1} of {STEPS.length}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-1.5 text-[#86868B] transition-colors hover:bg-black/[0.06] hover:text-[#1D1D1F]"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                        {currentStep === 0 && (
                            <TopicStep
                                draftTopic={draftTopic}
                                setDraftTopic={setDraftTopic}
                                draftAdditionalContext={draftAdditionalContext}
                                setDraftAdditionalContext={setDraftAdditionalContext}
                                draftLevel={draftLevel}
                                setDraftLevel={setDraftLevel}
                                draftDepth={draftDepth}
                                setDraftDepth={setDraftDepth}
                                draftLength={draftLength}
                                setDraftLength={setDraftLength}
                                draftFolderId={draftFolderId}
                                setDraftFolderId={setDraftFolderId}
                                availableFolders={availableFolders}
                                onCreateFolder={async (name, icon, color) => {
                                    const created = await dashboardApi.createFolder({ name, icon, color })
                                    setAvailableFolders((prev) => [...prev, created])
                                    return created
                                }}
                                isSubmitting={isSubmitting}
                                isResumed={Boolean(activeUnitId)}
                                onSubmit={handleTopicSubmit}
                                onCancel={onClose}
                            />
                        )}

                        {currentStep === 1 && (
                            <QuestionnaireStep
                                planning={planning}
                                questionnaireAnswers={questionnaireAnswers}
                                setQuestionnaireAnswers={setQuestionnaireAnswers}
                                isSubmitting={isSubmitting}
                                onSubmit={handleQuestionnaireSubmit}
                                onSkip={handleQuestionnaireSkip}
                            />
                        )}

                        {currentStep === 2 && (
                            <SyllabusStep
                                planning={planning}
                                syllabusToRender={syllabusToRender}
                                hasSyllabus={hasSyllabus}
                                isStreamingSyllabus={isStreamingSyllabus}
                                activeGenerationTier={activeGenerationTier}
                                isSubmitting={isSubmitting}
                                reviewDecision={reviewDecision}
                                setReviewDecision={setReviewDecision}
                                regenerationContext={regenerationContext}
                                setRegenerationContext={setRegenerationContext}
                                selectedGenerationTier={selectedGenerationTier}
                                setSelectedGenerationTier={setSelectedGenerationTier}
                                onGenerateSyllabus={handleGenerateSyllabus}
                                onStartGeneration={handleStartGeneration}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
