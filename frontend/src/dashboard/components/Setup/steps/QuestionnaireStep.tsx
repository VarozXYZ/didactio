import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import {
    AlertCircle,
    BookOpen,
    Brain,
    Briefcase,
    CircleDashed,
    Code2,
    FolderKanban,
    GitCompare,
    GraduationCap,
    Hammer,
    ListChecks,
    Loader2,
    Newspaper,
    Plus,
    Presentation,
    Puzzle,
    Route,
    School,
    Search,
    User,
    type LucideIcon,
} from 'lucide-react'
import type { PlanningDetailViewModel } from '../../../types'
import { Progress } from '@/components/ui/progress'

type QuestionnaireStepProps = {
    planning: PlanningDetailViewModel | null
    questionnaireAnswers: Record<string, string>
    setQuestionnaireAnswers: Dispatch<SetStateAction<Record<string, string>>>
    isSubmitting: boolean
    onSubmit: () => Promise<void>
    onSkip: () => Promise<void>
    onRetryModeration: () => Promise<void>
    onEditTopic: () => void
}

const OTHER_SENTINEL = '__other__'
const MODERATION_MESSAGES = [
    'Polishing your brief',
    'Checking the learning angle',
    'Tightening the context',
    'Sorting the right path',
    'Making sure it all fits',
]

const OPTION_ICONS: Record<string, LucideIcon> = {
    solve_problems: Puzzle,
    create_project: Hammer,
    understand_theory: BookOpen,
    prepare_exam: GraduationCap,
    apply_at_work: Briefcase,
    academic: School,
    professional: Briefcase,
    personal: User,
    specific_project: FolderKanban,
    research: Search,
    teaching: Presentation,
    practical_exercises: ListChecks,
    conceptual: Brain,
    real_cases: Newspaper,
    guided_project: Route,
    comparative: GitCompare,
    technical: Code2,
    no_preference: CircleDashed,
    other: Plus,
}

export function QuestionnaireStep({
    planning,
    questionnaireAnswers,
    setQuestionnaireAnswers,
    isSubmitting,
    onSubmit,
    onSkip,
    onRetryModeration,
    onEditTopic,
}: QuestionnaireStepProps) {
    const questions = planning?.questionnaire?.questions ?? []
    const isModerating = planning?.status === 'questionnaire_pending_moderation'
    const moderationFailed = planning?.status === 'moderation_failed'
    const [moderationMessageIndex, setModerationMessageIndex] = useState(0)

    useEffect(() => {
        if (!isModerating) {
            setModerationMessageIndex(0)
            return
        }

        const interval = window.setInterval(() => {
            setModerationMessageIndex((current) => (current + 1) % MODERATION_MESSAGES.length)
        }, 1800)

        return () => window.clearInterval(interval)
    }, [isModerating])


    if (questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <Loader2 size={28} className="mb-4 animate-spin text-[#4ADE80]" />
                <p className="mb-6 text-[14px] font-medium text-[#1D1D1F]">Preparing questionnaire...</p>
                <div className="w-48">
                    <Progress value={undefined} className="h-1.5 animate-pulse" />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {moderationFailed && (
                <div className="rounded-[12px] border border-[#FFE1D6] bg-[#FFF7F4] px-3.5 py-3">
                    <div className="flex items-center gap-2 text-[13px] font-medium text-[#1D1D1F]">
                        <AlertCircle size={15} className="text-[#FF6B4A]" />
                        Moderation failed
                    </div>
                    <p className="mt-1 text-[12px] text-[#6E6E73]">
                        {planning?.moderationError ?? 'Try again, or go back and adjust the topic.'}
                    </p>
                </div>
            )}

            <div className="space-y-4">
                {questions.map((question, index) => (
                    <div key={question.id} className="rounded-[14px] border border-[#E5E5E7] bg-white p-4">
                        <label className="mb-2 block text-[13px] font-medium text-[#1D1D1F]">
                            <span className="mr-1.5 text-[12px] text-[#86868B]">{index + 1}.</span>
                            {question.prompt}
                        </label>
                        {question.type === 'single_select' ? (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {question.options?.map((option) => {
                                    const currentValue = questionnaireAnswers[question.id] ?? ''
                                    const optionValues = question.options?.map((candidate) => candidate.value) ?? []
                                    const isCustomValue = Boolean(currentValue) && currentValue !== OTHER_SENTINEL && !optionValues.includes(currentValue)
                                    const isOther = option.value === 'other'
                                    const isSelected = isOther
                                        ? currentValue === OTHER_SENTINEL || isCustomValue
                                        : currentValue === option.value
                                    const OptionIcon = OPTION_ICONS[option.value] ?? CircleDashed
                                    return (
                                        <div key={option.value} className={`${isOther && isSelected ? 'inline-flex flex-wrap items-center' : 'inline-flex flex-col'} min-w-0 gap-1.5`}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setQuestionnaireAnswers((prev) => ({
                                                        ...prev,
                                                        [question.id]: isOther ? OTHER_SENTINEL : option.value,
                                                    }))
                                                }
                                                className={`inline-flex min-h-9 w-fit max-w-full items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[12.5px] leading-snug transition-all ${
                                                    isSelected
                                                        ? 'bg-[#1D1D1F] text-white'
                                                        : 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#EBEBED]'
                                                }`}
                                            >
                                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${isSelected ? 'text-white/65' : 'text-[#86868B]'}`}>
                                                    <OptionIcon size={14} strokeWidth={2} />
                                                </span>
                                                <span className="min-w-0 break-words">
                                                    {option.label}
                                                </span>
                                            </button>
                                            {isOther && isSelected && (
                                                <input
                                                    value={isCustomValue ? currentValue : ''}
                                                    onChange={(e) =>
                                                        setQuestionnaireAnswers((prev) => ({
                                                            ...prev,
                                                            [question.id]: e.target.value,
                                                        }))
                                                    }
                                                    placeholder="Write your own answer..."
                                                    className="h-9 w-[240px] max-w-full rounded-[10px] border border-[#D1D1D6] bg-white px-3 text-[12.5px] text-[#1D1D1F] shadow-sm placeholder:text-[#C7C7CC] focus:border-[#4ADE80] focus:outline-none"
                                                />
                                            )}
                                        </div>
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

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                {isModerating ? (
                    <div className="ml-auto min-w-0 rounded-[10px] border border-[#D8F3E1] bg-[#F2FBF5] px-3 py-2">
                        <div className="flex items-center gap-2 text-[12px] font-medium text-[#1D1D1F]">
                            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#32D074]/40">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#32D074]" />
                                <span className="absolute h-1.5 w-1.5 animate-spin rounded-full bg-[#32D074] [transform-origin:8px_8px] [translate:0_-5px]" />
                            </span>
                            <span key={moderationMessageIndex} className="animate-in fade-in slide-in-from-bottom-0.5 duration-300">
                                {MODERATION_MESSAGES[moderationMessageIndex]}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        <button
                            type="button"
                            disabled={isSubmitting || moderationFailed}
                            onClick={() => void onSkip()}
                            className="rounded-[10px] border border-[#C7C7CC] bg-white px-4 py-2 text-[13px] font-semibold text-[#1D1D1F] transition-colors hover:border-[#8E8E93] hover:bg-[#F5F5F7] disabled:opacity-40"
                        >
                            Skip
                        </button>
                        {moderationFailed && (
                            <>
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={onEditTopic}
                                    className="rounded-[10px] border border-[#E5E5E7] px-4 py-2 text-[13px] font-medium text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F] disabled:opacity-40"
                                >
                                    Edit topic
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => void onRetryModeration()}
                                    className="rounded-[10px] border border-[#1D1D1F] px-4 py-2 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] disabled:opacity-40"
                                >
                                    Retry
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            disabled={isSubmitting || moderationFailed}
                            onClick={() => void onSubmit()}
                            className="rounded-[10px] bg-[#1D1D1F] px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2C2C2E] disabled:opacity-40"
                        >
                            {isSubmitting ? 'Saving...' : 'Continue'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
