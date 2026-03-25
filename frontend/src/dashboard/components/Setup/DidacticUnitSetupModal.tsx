import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Sparkles, X } from 'lucide-react'
import { Streamdown } from 'streamdown'
import { dashboardApi } from '../../api/dashboardApi'
import { adaptDidacticUnitPlanning } from '../../adapters'
import type { PlanningDetailViewModel, PlanningSyllabus } from '../../types'

type DidacticUnitSetupModalProps = {
    didacticUnitId?: string | null
    onClose: () => void
    onDataChanged: () => void
    onOpenEditor: (didacticUnitId: string) => void
}

function cloneSyllabus(syllabus: PlanningSyllabus): PlanningSyllabus {
    return {
        title: syllabus.title,
        overview: syllabus.overview,
        learningGoals: [...syllabus.learningGoals],
        chapters: syllabus.chapters.map((chapter) => ({
            title: chapter.title,
            overview: chapter.overview,
            keyPoints: [...chapter.keyPoints],
        })),
    }
}

export function DidacticUnitSetupModal({
    didacticUnitId,
    onClose,
    onDataChanged,
    onOpenEditor,
}: DidacticUnitSetupModalProps) {
    const [planning, setPlanning] = useState<PlanningDetailViewModel | null>(null)
    const [draftTopic, setDraftTopic] = useState('')
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({})
    const [draftSyllabus, setDraftSyllabus] = useState<PlanningSyllabus | null>(null)
    const [isLoading, setIsLoading] = useState(Boolean(didacticUnitId))
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeDidacticUnitId, setActiveDidacticUnitId] = useState<string | null>(
        didacticUnitId ?? null
    )
    const [streamedSyllabusMarkdown, setStreamedSyllabusMarkdown] = useState('')
    const [isStreamingSyllabus, setIsStreamingSyllabus] = useState(false)

    const loadPlanning = async (id: string) => {
        setIsLoading(true)
        setError(null)

        try {
            let detail = await dashboardApi.getDidacticUnit(id)

            if (detail.nextAction === 'moderate_topic') {
                detail = await dashboardApi.moderateDidacticUnit(id)
            }

            const planningDetail = adaptDidacticUnitPlanning(detail)
            setPlanning(planningDetail)
            setQuestionnaireAnswers(planningDetail.questionnaire?.answers ?? {})
            setDraftSyllabus(
                planningDetail.syllabus ? cloneSyllabus(planningDetail.syllabus) : null
            )
            setActiveDidacticUnitId(id)
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load unit.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (!didacticUnitId) {
            return
        }

        void loadPlanning(didacticUnitId)
    }, [didacticUnitId])

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

    const runAction = async (action: () => Promise<{ id: string } | void>) => {
        setIsSubmitting(true)
        setError(null)

        try {
            const result = await action()
            const nextId = (result as { id?: string } | undefined)?.id ?? activeDidacticUnitId
            if (nextId) {
                await loadPlanning(nextId)
            }
            onDataChanged()
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        await runAction(async () =>
            dashboardApi.createDidacticUnit({ topic: draftTopic.trim() })
        )
    }

    const handleSaveAnswers = async () => {
        if (!planning?.questionnaire) {
            return
        }

        await runAction(async () => {
            await dashboardApi.answerDidacticUnitQuestionnaire(
                planning.id,
                planning.questionnaire!.questions.map((question) => ({
                    questionId: question.id,
                    value: questionnaireAnswers[question.id]?.trim() ?? '',
                }))
            )
        })
    }

    const handleSaveSyllabus = async () => {
        if (!planning || !draftSyllabus) {
            return
        }

        await runAction(async () => {
            await dashboardApi.updateDidacticUnitSyllabus(planning.id, draftSyllabus)
        })
    }

    const handleGenerateSyllabus = async () => {
        if (!planning) {
            return
        }

        setIsSubmitting(true)
        setIsStreamingSyllabus(true)
        setStreamedSyllabusMarkdown('')
        setError(null)

        try {
            const detail = await dashboardApi.streamDidacticUnitSyllabus(planning.id, {
                onPartialMarkdown: (event) => {
                    setStreamedSyllabusMarkdown(event.markdown)
                },
            })

            const planningDetail = adaptDidacticUnitPlanning(detail)
            setPlanning(planningDetail)
            setDraftSyllabus(
                planningDetail.syllabus ? cloneSyllabus(planningDetail.syllabus) : null
            )
            onDataChanged()
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : 'Action failed.')
        } finally {
            setIsSubmitting(false)
            setIsStreamingSyllabus(false)
        }
    }

    const handleApproveAndStart = async () => {
        if (!planning) {
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            let workingUnitId = planning.id

            if (planning.nextAction === 'approve_syllabus') {
                const approved = await dashboardApi.approveDidacticUnitSyllabus(planning.id)
                workingUnitId = approved.id
            }

            onDataChanged()
            onOpenEditor(workingUnitId)
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

                    <div className="rounded-[16px] border border-[#E5E5E7] bg-[#F9F9FA] p-4 text-[13px] text-[#86868B]">
                        <div className="font-semibold text-[#1D1D1F]">What happens next?</div>
                        <div className="mt-2 space-y-1">
                            <div>- AI profile settings choose provider and model</div>
                            <div>- Questionnaire generation</div>
                            <div>- Streaming syllabus generation and review</div>
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
                            {isSubmitting ? 'Creating...' : 'Create Unit'}
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
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleSaveAnswers}
                                className="rounded-[10px] border border-[#E5E5E7] px-4 py-2 text-[13px] font-semibold text-[#1D1D1F] disabled:opacity-50"
                            >
                                Save Answers
                            </button>
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

                {planning.syllabusPrompt && (
                    <section className="rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                        <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                            Syllabus prompt
                        </h3>
                        <textarea
                            readOnly
                            rows={8}
                            value={planning.syllabusPrompt}
                            className="mt-4 w-full rounded-[12px] border border-[#E5E5E7] bg-white px-4 py-3 text-[13px] text-[#1D1D1F]"
                        />
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
                                {isStreamingSyllabus ? 'Streaming...' : 'Complete'}
                            </div>
                        </div>
                        <div className="mt-4 rounded-[14px] border border-[#E3EFE6] bg-white p-4">
                            <Streamdown className="text-[14px] leading-7 text-[#1D1D1F]">
                                {streamedSyllabusMarkdown || 'Waiting for markdown...'}
                            </Streamdown>
                        </div>
                    </section>
                )}

                {draftSyllabus && (
                    <section className="space-y-4 rounded-[18px] border border-[#E5E5E7] bg-[#FAFAFB] p-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[16px] font-semibold text-[#1D1D1F]">
                                Syllabus
                            </h3>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleSaveSyllabus}
                                className="rounded-[10px] border border-[#E5E5E7] px-4 py-2 text-[13px] font-semibold text-[#1D1D1F] disabled:opacity-50"
                            >
                                Save Syllabus
                            </button>
                        </div>

                        <input
                            type="text"
                            value={draftSyllabus.title}
                            onChange={(event) =>
                                setDraftSyllabus((previous) =>
                                    previous ? { ...previous, title: event.target.value } : previous
                                )
                            }
                            className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                        />
                        <textarea
                            rows={4}
                            value={draftSyllabus.overview}
                            onChange={(event) =>
                                setDraftSyllabus((previous) =>
                                    previous
                                        ? { ...previous, overview: event.target.value }
                                        : previous
                                )
                            }
                            className="w-full rounded-[12px] border border-[#E5E5E7] px-4 py-3 text-[14px] focus:border-[#4ADE80] focus:outline-none"
                        />
                    </section>
                )}

                <div className="rounded-[16px] border border-[#E5E5E7] bg-[#F9F9FA] p-4 text-[13px] text-[#86868B]">
                    <div className="font-semibold text-[#1D1D1F]">What happens next?</div>
                    <div className="mt-2">
                        {planning.nextAction === 'moderate_topic' &&
                            'AI is validating the requested topic automatically.'}
                        {planning.nextAction === 'generate_questionnaire' &&
                            'Generate the learner questionnaire.'}
                        {planning.nextAction === 'answer_questionnaire' &&
                            'Complete and save all questionnaire answers.'}
                        {planning.nextAction === 'generate_syllabus_prompt' &&
                            'Generate the syllabus prompt from the answers.'}
                        {planning.nextAction === 'review_syllabus_prompt' &&
                            'Stream the syllabus generation preview.'}
                        {planning.nextAction === 'review_syllabus' &&
                            'Review and refine the generated syllabus.'}
                        {planning.nextAction === 'approve_syllabus' &&
                            'Approve the syllabus, then continue into the editor.'}
                        {planning.nextAction === 'view_didactic_unit' &&
                            'Open the editor and start chapter generation there.'}
                    </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                    {planning.nextAction === 'generate_questionnaire' && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() =>
                                void runAction(async () => {
                                    await dashboardApi.generateDidacticUnitQuestionnaire(
                                        planning.id
                                    )
                                })
                            }
                            className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                            Generate Questionnaire
                        </button>
                    )}
                    {planning.nextAction === 'generate_syllabus_prompt' && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() =>
                                void runAction(async () => {
                                    await dashboardApi.generateDidacticUnitSyllabusPrompt(
                                        planning.id
                                    )
                                })
                            }
                            className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                            Generate Syllabus Prompt
                        </button>
                    )}
                    {planning.nextAction === 'review_syllabus_prompt' && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleGenerateSyllabus()}
                            className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                            {isStreamingSyllabus ? 'Streaming Syllabus...' : 'Generate Syllabus'}
                        </button>
                    )}
                    {(planning.nextAction === 'approve_syllabus' ||
                        planning.nextAction === 'view_didactic_unit') && (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleApproveAndStart()}
                            className="rounded-[12px] bg-[#1D1D1F] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
                        >
                            {planning.nextAction === 'approve_syllabus'
                                ? 'Approve and Open Editor'
                                : 'Open Editor'}
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
                                AI will guide the unit from topic to generated chapters.
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
