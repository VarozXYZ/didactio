import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Sparkles, X } from 'lucide-react'
import { dashboardApi } from '../../api/dashboardApi'
import { adaptDidacticUnitPlanning } from '../../adapters'
import type { PlanningDetailViewModel } from '../../types'

type DidacticUnitSetupModalProps = {
    didacticUnitId?: string | null
    onClose: () => void
    onDataChanged: () => void
    onOpenSyllabusReview: (didacticUnitId: string) => void
}

const depthOptions = [
    {
        value: 'basic' as const,
        label: 'Basic',
        description: 'More guided explanations and simpler terminology.',
    },
    {
        value: 'intermediate' as const,
        label: 'Intermediate',
        description: 'Balanced detail with accessible technical language.',
    },
    {
        value: 'technical' as const,
        label: 'Technical',
        description: 'Deeper coverage with stronger technical rigor.',
    },
]

const lengthOptions = [
    {
        value: 'intro' as const,
        label: 'Intro',
        description: 'Compact introduction.',
    },
    {
        value: 'short' as const,
        label: 'Short',
        description: 'Focused but useful coverage.',
    },
    {
        value: 'long' as const,
        label: 'Long',
        description: 'Substantial teaching sequence.',
    },
    {
        value: 'textbook' as const,
        label: 'Textbook',
        description: 'Comprehensive, extended treatment.',
    },
]

function isSyllabusStage(nextAction: string): boolean {
    return (
        nextAction === 'generate_syllabus_prompt' ||
        nextAction === 'review_syllabus_prompt' ||
        nextAction === 'review_syllabus' ||
        nextAction === 'approve_syllabus'
    )
}

export function DidacticUnitSetupModal({
    didacticUnitId,
    onClose,
    onDataChanged,
    onOpenSyllabusReview,
}: DidacticUnitSetupModalProps) {
    const [planning, setPlanning] = useState<PlanningDetailViewModel | null>(null)
    const [draftTopic, setDraftTopic] = useState('')
    const [draftAdditionalContext, setDraftAdditionalContext] = useState('')
    const [draftDepth, setDraftDepth] = useState<'basic' | 'intermediate' | 'technical'>(
        'intermediate'
    )
    const [draftLength, setDraftLength] = useState<'intro' | 'short' | 'long' | 'textbook'>(
        'short'
    )
    const [draftQuestionnaireEnabled, setDraftQuestionnaireEnabled] = useState(true)
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({})
    const [isLoading, setIsLoading] = useState(Boolean(didacticUnitId))
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeDidacticUnitId, setActiveDidacticUnitId] = useState<string | null>(
        didacticUnitId ?? null
    )

    const questionnaireCompletion = useMemo(() => {
        const questions = planning?.questionnaire?.questions ?? []
        if (questions.length === 0) {
            return 0
        }

        const answeredCount = questions.filter(
            (question) => questionnaireAnswers[question.id]?.trim()
        ).length

        return Math.round((answeredCount / questions.length) * 100)
    }, [planning?.questionnaire?.questions, questionnaireAnswers])

    const isQuestionnaireComplete = useMemo(() => {
        const questions = planning?.questionnaire?.questions ?? []
        return questions.length > 0 && questions.every((question) => questionnaireAnswers[question.id]?.trim())
    }, [planning?.questionnaire?.questions, questionnaireAnswers])

    const applyPlanningState = useCallback(
        (detail: Awaited<ReturnType<typeof dashboardApi.getDidacticUnit>>) => {
            const planningDetail = adaptDidacticUnitPlanning(detail)

            if (isSyllabusStage(planningDetail.nextAction)) {
                onOpenSyllabusReview(planningDetail.id)
                return
            }

            setPlanning(planningDetail)
            setQuestionnaireAnswers(planningDetail.questionnaire?.answers ?? {})
            setDraftAdditionalContext(planningDetail.additionalContext ?? '')
            setDraftDepth(planningDetail.depth)
            setDraftLength(planningDetail.length)
            setDraftQuestionnaireEnabled(planningDetail.questionnaireEnabled)
            setActiveDidacticUnitId(planningDetail.id)
        },
        [onOpenSyllabusReview]
    )

    useEffect(() => {
        if (!didacticUnitId) {
            return
        }

        void (async () => {
            setIsLoading(true)
            setError(null)

            try {
                let detail = await dashboardApi.getDidacticUnit(didacticUnitId)

                if (detail.nextAction === 'moderate_topic') {
                    detail = await dashboardApi.moderateDidacticUnit(didacticUnitId)
                }

                applyPlanningState(detail)
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : 'Failed to load unit.')
            } finally {
                setIsLoading(false)
            }
        })()
    }, [applyPlanningState, didacticUnitId])

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            const created = await dashboardApi.createDidacticUnit({
                topic: draftTopic.trim(),
                additionalContext: draftAdditionalContext.trim() || undefined,
                depth: draftDepth,
                length: draftLength,
                questionnaireEnabled: draftQuestionnaireEnabled,
            })

            let detail = await dashboardApi.moderateDidacticUnit(created.id)

            if (draftQuestionnaireEnabled && detail.nextAction === 'generate_questionnaire') {
                detail = await dashboardApi.generateDidacticUnitQuestionnaire(created.id, 'cheap')
            }

            onDataChanged()
            applyPlanningState(detail)
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleGenerateQuestionnaire = async () => {
        if (!planning) {
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const detail = await dashboardApi.generateDidacticUnitQuestionnaire(planning.id, 'cheap')
            onDataChanged()
            applyPlanningState(detail)
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleQuestionnaireNextStep = async () => {
        if (!planning?.questionnaire) {
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const detail = await dashboardApi.answerDidacticUnitQuestionnaire(
                planning.id,
                planning.questionnaire.questions.map((question) => ({
                    questionId: question.id,
                    value: questionnaireAnswers[question.id]?.trim() ?? '',
                }))
            )

            onDataChanged()
            onOpenSyllabusReview(detail.id)
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const renderBody = () => {
        if (!activeDidacticUnitId) {
            return (
                <form onSubmit={handleCreate} className="space-y-6">
                    <div>
                        <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                            Unit topic
                        </label>
                        <input
                            type="text"
                            value={draftTopic}
                            onChange={(event) => setDraftTopic(event.target.value)}
                            placeholder="e.g., Introduction to Calculus"
                            className="w-full rounded-[14px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                            Additional context
                        </label>
                        <textarea
                            rows={5}
                            value={draftAdditionalContext}
                            onChange={(event) => setDraftAdditionalContext(event.target.value)}
                            placeholder="Optional: learner goals, domain constraints, course angle, or audience notes."
                            className="w-full rounded-[14px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                Unit depth
                            </label>
                            <select
                                value={draftDepth}
                                onChange={(event) =>
                                    setDraftDepth(
                                        event.target.value as
                                            | 'basic'
                                            | 'intermediate'
                                            | 'technical'
                                    )
                                }
                                className="w-full rounded-[14px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                            >
                                {depthOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} - {option.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                Unit length
                            </label>
                            <select
                                value={draftLength}
                                onChange={(event) =>
                                    setDraftLength(
                                        event.target.value as
                                            | 'intro'
                                            | 'short'
                                            | 'long'
                                            | 'textbook'
                                    )
                                }
                                className="w-full rounded-[14px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                            >
                                {lengthOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} - {option.description}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-[16px] border border-[#E5E5E7] bg-white px-4 py-4">
                        <input
                            type="checkbox"
                            checked={draftQuestionnaireEnabled}
                            onChange={(event) => setDraftQuestionnaireEnabled(event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-[#D1D5DB] text-[#1D1D1F] focus:ring-[#4ADE80]"
                        />
                        <div>
                            <div className="text-[14px] font-semibold text-[#1D1D1F]">
                                Use learner questionnaire
                            </div>
                            <div className="mt-1 text-[13px] text-[#6B7280]">
                                Enabled by default. We will automatically moderate the topic and,
                                if enabled, generate a cheap-model questionnaire before syllabus
                                review.
                            </div>
                        </div>
                    </label>

                    <div className="rounded-[16px] border border-[#E5E5E7] bg-[#F9F9FA] p-4 text-[13px] text-[#86868B]">
                        <div className="font-semibold text-[#1D1D1F]">What happens next?</div>
                        <div className="mt-2 space-y-1">
                            <div>- AI profile settings choose provider, model, and tone</div>
                            <div>- This unit keeps its own depth and length targets</div>
                            <div>- Topic moderation happens automatically with the cheap model</div>
                            <div>
                                - {draftQuestionnaireEnabled
                                    ? 'A learner questionnaire is generated automatically with the cheap model'
                                    : 'Questionnaire generation is skipped for this unit'}
                            </div>
                            <div>- Syllabus review happens in a separate modal</div>
                            <div>- Editor unlocks after syllabus approval</div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-[12px] border border-[#E5E5E7] px-5 py-3 text-[14px] font-semibold text-[#1D1D1F]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!draftTopic.trim() || isSubmitting}
                            className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                            {isSubmitting ? 'Preparing...' : 'Next Step'}
                        </button>
                    </div>
                </form>
            )
        }

        if (isLoading || !planning) {
            return (
                <div className="flex min-h-[280px] items-center justify-center text-[#86868B]">
                    Loading didactic unit...
                </div>
            )
        }

        return (
            <div className="space-y-6">
                <div>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-[24px] font-bold tracking-tight text-[#1D1D1F]">
                                {planning.topic}
                            </h2>
                            <p className="mt-1 text-[13px] text-[#86868B]">
                                {planning.provider} setup flow - {planning.progressPercent}% complete
                            </p>
                        </div>
                        <div className="min-w-[180px]">
                            <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#86868B]">
                                <span>Progress</span>
                                <span>{planning.progressPercent}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#F0F0F2]">
                                <div
                                    className="h-full rounded-full bg-[#4ADE80]"
                                    style={{ width: `${planning.progressPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {(planning.improvedTopicBrief || planning.reasoningNotes || planning.additionalContext) && (
                    <section className="rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                        <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                            Generation brief
                        </h3>
                        <div className="mt-4 flex flex-wrap gap-2">
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
                        {planning.reasoningNotes && (
                            <p className="mt-3 text-[13px] text-[#6B7280]">
                                {planning.reasoningNotes}
                            </p>
                        )}
                        {planning.additionalContext && (
                            <div className="mt-4 rounded-[12px] border border-[#E5E5E7] bg-white px-4 py-3 text-[13px] text-[#4B5563]">
                                <div className="mb-1 font-semibold text-[#1D1D1F]">
                                    Additional context
                                </div>
                                <div>{planning.additionalContext}</div>
                            </div>
                        )}
                    </section>
                )}

                {planning.questionnaire && (
                    <section className="space-y-4 rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                                    Questionnaire
                                </h3>
                                <p className="text-[12px] text-[#86868B]">
                                    Completion: {questionnaireCompletion}%
                                </p>
                            </div>
                            <div className="rounded-full border border-[#E5E5E7] bg-white px-3 py-1 text-[12px] font-semibold text-[#1D1D1F]">
                                Answers save on Next Step
                            </div>
                        </div>
                        <div className="space-y-4">
                            {planning.questionnaire.questions.map((question) => (
                                <div key={question.id}>
                                    <label className="mb-2 block text-[13px] font-semibold text-[#1D1D1F]">
                                        {question.prompt}
                                    </label>
                                    {question.type === 'single_select' ? (
                                        <select
                                            value={questionnaireAnswers[question.id] ?? ''}
                                            onChange={(event) =>
                                                setQuestionnaireAnswers((previous) => ({
                                                    ...previous,
                                                    [question.id]: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                        >
                                            <option value="">Select an option</option>
                                            {question.options?.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <textarea
                                            rows={4}
                                            value={questionnaireAnswers[question.id] ?? ''}
                                            onChange={(event) =>
                                                setQuestionnaireAnswers((previous) => ({
                                                    ...previous,
                                                    [question.id]: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <div className="rounded-[16px] border border-[#E5E5E7] bg-[#F9F9FA] p-4 text-[13px] text-[#86868B]">
                    <div className="font-semibold text-[#1D1D1F]">What happens next?</div>
                    <div className="mt-2">
                        {planning.nextAction === 'generate_questionnaire' &&
                            'Generate the learner questionnaire with the cheap model.'}
                        {planning.nextAction === 'answer_questionnaire' &&
                            'Press Next Step to save the answers and move into syllabus review.'}
                    </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                    {planning.nextAction === 'generate_questionnaire' && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleGenerateQuestionnaire()}
                            className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                            {isSubmitting ? 'Generating...' : 'Generate Questionnaire'}
                        </button>
                    )}
                    {planning.nextAction === 'answer_questionnaire' && (
                        <button
                            type="button"
                            disabled={isSubmitting || !isQuestionnaireComplete}
                            onClick={() => void handleQuestionnaireNextStep()}
                            className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Next Step'}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-[2px]">
            <div className="max-h-[92vh] w-full max-w-[920px] overflow-hidden rounded-[22px] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.2)]">
                <div className="flex items-start justify-between border-b border-[#E5E5E7] px-8 py-7">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#EAF9EF]">
                            <Sparkles className="text-[#4ADE80]" size={22} />
                        </div>
                        <div>
                            <h1 className="text-[18px] font-bold text-[#1D1D1F]">
                                {activeDidacticUnitId ? 'Continue Didactic Unit' : 'Create New Unit'}
                            </h1>
                            <p className="mt-1 text-[13px] text-[#86868B]">
                                Create the unit and gather learner input before syllabus review.
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
                    {renderBody()}
                </div>
            </div>
        </div>
    )
}
