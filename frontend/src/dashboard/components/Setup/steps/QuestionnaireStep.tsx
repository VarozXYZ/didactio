import { type Dispatch, type SetStateAction } from 'react'
import { Loader2 } from 'lucide-react'
import type { PlanningDetailViewModel } from '../../../types'
import { Progress } from '@/components/ui/progress'

type QuestionnaireStepProps = {
    planning: PlanningDetailViewModel | null
    questionnaireAnswers: Record<string, string>
    setQuestionnaireAnswers: Dispatch<SetStateAction<Record<string, string>>>
    isSubmitting: boolean
    onSubmit: () => Promise<void>
    onSkip: () => Promise<void>
}

export function QuestionnaireStep({
    planning,
    questionnaireAnswers,
    setQuestionnaireAnswers,
    isSubmitting,
    onSubmit,
    onSkip,
}: QuestionnaireStepProps) {
    const questions = planning?.questionnaire?.questions ?? []
    const isGenerating = planning?.nextAction === 'generate_questionnaire'


    if (isGenerating || questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={28} className="mb-4 animate-spin text-[#4ADE80]" />
                <p className="mb-6 text-[14px] font-medium text-[#1D1D1F]">Generating questionnaire...</p>
                <div className="w-48">
                    <Progress value={undefined} className="h-1.5 animate-pulse" />
                </div>
                <p className="mt-3 text-[12px] text-[#86868B]">This usually takes a few seconds</p>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[13px] text-[#86868B]">
                        Answer these questions to personalize your unit.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {questions.map((question, index) => (
                    <div key={question.id} className="rounded-[14px] border border-[#E5E5E7] bg-white p-4">
                        <label className="mb-2 block text-[13px] font-medium text-[#1D1D1F]">
                            <span className="mr-1.5 text-[12px] text-[#86868B]">{index + 1}.</span>
                            {question.prompt}
                        </label>
                        {question.type === 'single_select' ? (
                            <div className="flex flex-col gap-1.5 mt-1">
                                {question.options?.map((option, optIndex) => {
                                    const letter = String.fromCharCode(97 + optIndex)
                                    const isSelected = questionnaireAnswers[question.id] === option.value
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() =>
                                                setQuestionnaireAnswers((prev) => ({
                                                    ...prev,
                                                    [question.id]: option.value,
                                                }))
                                            }
                                            className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] transition-all ${
                                                isSelected
                                                    ? 'bg-[#1D1D1F] text-white'
                                                    : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EBEBED]'
                                            }`}
                                        >
                                            <span className={`shrink-0 text-[12px] font-semibold ${isSelected ? 'text-white/60' : 'text-[#86868B]'}`}>
                                                {letter}.
                                            </span>
                                            {option.label}
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <textarea
                                rows={3}
                                value={questionnaireAnswers[question.id] ?? ''}
                                onChange={(e) =>
                                    setQuestionnaireAnswers((prev) => ({
                                        ...prev,
                                        [question.id]: e.target.value,
                                    }))
                                }
                                placeholder="Your answer..."
                                className="w-full rounded-[10px] border border-[#E5E5E7] bg-[#FAFAFB] px-3 py-2 text-[13px] text-[#1D1D1F] placeholder:text-[#C7C7CC] focus:border-[#4ADE80] focus:outline-none"
                            />
                        )}
                    </div>
                ))}
            </div>

            {isSubmitting && (
                <div className="space-y-2">
                    <Progress value={60} className="h-1.5 animate-pulse" />
                    <p className="text-center text-[12px] text-[#86868B]">Submitting answers...</p>
                </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
                <div className="flex gap-3">
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void onSkip()}
                        className="rounded-[10px] border border-[#E5E5E7] px-4 py-2 text-[13px] font-medium text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F] disabled:opacity-40"
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void onSubmit()}
                        className="rounded-[10px] bg-[#1D1D1F] px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2C2C2E] disabled:opacity-40"
                    >
                        {isSubmitting ? 'Saving...' : 'Continue'}
                    </button>
                </div>
            </div>
        </div>
    )
}
