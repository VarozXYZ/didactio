import {useEffect, useMemo, useRef, useState} from "react";
import {
	BookOpenCheck,
	BadgeQuestionMark,
	CircleAlert,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Code2,
	Layers3,
	ListChecks,
	MessageCircleQuestionMark,
	MessageSquareText,
	RotateCcw,
	Send,
	Trophy,
	XCircle,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {dashboardApi} from "../../api/dashboardApi";
import type {
	BackendLearningActivity,
	BackendLearningActivityAttempt,
} from "../../api/dashboardApi";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {CoinAmount} from "@/components/Coin";
import {getActivityFeedbackRefillCost} from "../../utils/coinPricing";

type Answers = Record<string, unknown>;

const OBJECTIVE_TYPES = new Set([
	"multiple_choice",
	"flashcards",
	"matching",
	"ordering",
	"cloze",
]);

function asArray(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ?
			value.filter(
				(item): item is Record<string, unknown> =>
					!!item && typeof item === "object" && !Array.isArray(item),
			)
		:	[];
}

function asText(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function asId(value: unknown, fallback: string): string {
	return typeof value === "string" || typeof value === "number" ?
			String(value)
		:	fallback;
}

function looksLikeHtml(value: string): boolean {
	return /<\/?[a-z][\w:-]*(?:\s[^>]*)?>/i.test(value);
}

function FeedbackHtml({
	html,
	className,
}: {
	html: string;
	className?: string;
}) {
	if (!looksLikeHtml(html)) {
		return <p className={className}>{html}</p>;
	}

	return (
		<div
			className={cn(
				"[&_code]:rounded [&_code]:bg-black/[0.06] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_em]:italic [&_li]:ml-4 [&_mark]:rounded [&_mark]:bg-[#FEF3C7] [&_mark]:px-1 [&_ol]:list-decimal [&_p+ p]:mt-2 [&_strong]:font-bold [&_ul]:list-disc",
				className,
			)}
			dangerouslySetInnerHTML={{__html: html}}
		/>
	);
}

function activityTypeLabel(type: BackendLearningActivity["type"]): string {
	switch (type) {
		case "multiple_choice":
			return "Quick check";
		case "short_answer":
			return "Open response questions";
		case "coding_practice":
			return "Code practice";
		case "flashcards":
			return "Flashcards";
		case "matching":
			return "Matching";
		case "ordering":
			return "Ordering";
		case "case_study":
			return "Case study";
		case "debate_reflection":
			return "Debate reflection";
		case "cloze":
			return "Cloze";
		case "guided_project":
			return "Mini project";
		case "freeform_html":
			return "Interactive";
	}
}

function ActivityIcon({type}: {type: BackendLearningActivity["type"]}) {
	const Icon =
		type === "coding_practice" ? Code2
		: type === "flashcards" ? Layers3
		: type === "debate_reflection" ? MessageSquareText
		: type === "short_answer" || type === "case_study" ? BookOpenCheck
		:	ListChecks;
	return <Icon size={18} />;
}

interface ConfirmedAnswer {
	selectedOptionId: string;
	isCorrect: boolean;
	correctOptionId: string;
	explanation: string;
}

function MultipleChoiceActivity({
	activity,
	onSubmitAttempt,
}: {
	activity: BackendLearningActivity;
	onSubmitAttempt: (activityId: string, answers: unknown) => Promise<void>;
}) {
	const questions = asArray(activity.content.questions);
	const [viewIndex, setViewIndex] = useState(0);
	const [pendingAnswer, setPendingAnswer] = useState<string | null>(null);
	const [confirmedAnswers, setConfirmedAnswers] = useState<Record<string, ConfirmedAnswer>>({});
	const [completed, setCompleted] = useState(false);

	// Load persisted progress on mount
	useEffect(() => {
		void dashboardApi.getActivityProgress(activity.id).then(({progress}) => {
			if (!progress) return;
			setConfirmedAnswers(progress.confirmedAnswers);
			setCompleted(progress.completed);
			const answeredCount = Object.keys(progress.confirmedAnswers).length;
			if (answeredCount > 0 && !progress.completed) {
				setViewIndex(answeredCount); // resume at next unanswered question
			}
		}).catch(() => {/* ignore — no saved progress */});
	}, [activity.id]);

	const activeQuestionIndex = Object.keys(confirmedAnswers).length;
	const currentQuestion = questions[viewIndex];
	const questionId = asText(currentQuestion?.id) || `q${viewIndex + 1}`;
	const confirmed = confirmedAnswers[questionId];
	const isCurrentInteractive = viewIndex === activeQuestionIndex && !completed;

	const correctCount = Object.values(confirmedAnswers).filter((a) => a.isCorrect).length;

	const saveProgress = (nextConfirmed: Record<string, ConfirmedAnswer>, isCompleted: boolean) => {
		void dashboardApi.saveActivityProgress(activity.id, {
			confirmedAnswers: nextConfirmed,
			completed: isCompleted,
		}).catch(() => {/* silent — non-critical */});
	};

	const handleConfirm = () => {
		if (!pendingAnswer || !currentQuestion) return;
		const correctOptionId = asText(currentQuestion.correctOptionId);
		const isCorrect = pendingAnswer === correctOptionId;
		const next: ConfirmedAnswer = {
			selectedOptionId: pendingAnswer,
			isCorrect,
			correctOptionId,
			explanation: asText(currentQuestion.explanation),
		};
		const nextConfirmed = {...confirmedAnswers, [questionId]: next};
		setConfirmedAnswers(nextConfirmed);
		setPendingAnswer(null);

		const isNowCompleted = Object.keys(nextConfirmed).length === questions.length;
		saveProgress(nextConfirmed, isNowCompleted);

		if (isNowCompleted) {
			const payload: Record<string, string> = {};
			for (const [qId, ans] of Object.entries(nextConfirmed)) {
				payload[qId] = ans.selectedOptionId;
			}
			void onSubmitAttempt(activity.id, payload);
			setCompleted(true);
		}
	};

	const handleNext = () => {
		if (viewIndex < questions.length - 1) setViewIndex(viewIndex + 1);
	};

	const handleRepeat = () => {
		setConfirmedAnswers({});
		setPendingAnswer(null);
		setViewIndex(0);
		setCompleted(false);
		saveProgress({}, false);
	};

	if (completed) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center">
				<div className={cn(
					"flex h-16 w-16 items-center justify-center rounded-full",
					correctCount === questions.length ? "bg-[#DCFCE7]" : "bg-[#FEF3C7]",
				)}>
					<Trophy
						size={28}
						className={correctCount === questions.length ? "text-[#16A34A]" : "text-[#D97706]"}
					/>
				</div>
				<div>
					<h3 className="text-[17px] font-bold text-[#1D1D1F]">Actividad finalizada</h3>
					<p className="mt-1 text-[14px] text-[#6B7280]">
						<span className="font-semibold text-[#1D1D1F]">{correctCount}</span>
						{" de "}
						<span className="font-semibold text-[#1D1D1F]">{questions.length}</span>
						{" respuestas correctas"}
					</p>
				</div>

				<div className="w-full max-w-[320px] space-y-1.5">
					{questions.map((q, i) => {
						const qId = asText(q.id) || `q${i + 1}`;
						const ans = confirmedAnswers[qId];
						return (
							<div
								key={qId}
								className={cn(
									"flex items-center gap-2 rounded-xl px-3 py-2 text-[12px]",
									ans?.isCorrect ? "bg-[#F0FDF4] text-[#166534]" : "bg-[#FEF2F2] text-[#991B1B]",
								)}
							>
								{ans?.isCorrect ?
									<CheckCircle2 size={13} className="shrink-0" />
								:	<XCircle size={13} className="shrink-0" />
								}
								<span className="truncate">{asText(q.prompt)}</span>
							</div>
						);
					})}
				</div>

				<button
					type="button"
					onClick={handleRepeat}
					className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#E5E5E7] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#374151] transition hover:border-[#C7C7CC] hover:bg-[#F9F9FB]"
				>
					<RotateCcw size={14} />
					Repetir actividad
				</button>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			{/* Progress stepper */}
			<div className="mb-3 flex items-center gap-1.5">
				{questions.map((_, i) => {
					const qId = asText(questions[i]?.id) || `q${i + 1}`;
					const isConfirmed = !!confirmedAnswers[qId];
					const isConfirmedCorrect = confirmedAnswers[qId]?.isCorrect;
					const isActive = i === viewIndex;
					return (
						<button
							key={i}
							type="button"
							onClick={() => {
								if (i <= activeQuestionIndex) setViewIndex(i);
							}}
							disabled={i > activeQuestionIndex}
							className={cn(
								"h-1.5 flex-1 rounded-full transition-all",
								isConfirmed ?
									isConfirmedCorrect ? "bg-[#4ADE80]" : "bg-[#F87171]"
								: isActive ? "bg-[#D1D5DB]"
								: "bg-[#E8E8EA]",
							)}
						/>
					);
				})}
			</div>

			{/* Question counter + nav */}
			<div className="mb-2 flex items-center justify-between">
				<span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#AEAEB2]">
					Pregunta {viewIndex + 1} de {questions.length}
				</span>
				<div className="flex items-center gap-1">
					<button
						type="button"
						disabled={viewIndex === 0}
						onClick={() => setViewIndex(viewIndex - 1)}
						className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#E8E8EA] text-[#6B7280] transition hover:border-[#C7C7CC] disabled:opacity-30"
					>
						<ChevronLeft size={13} />
					</button>
					<button
						type="button"
						disabled={viewIndex >= activeQuestionIndex}
						onClick={() => setViewIndex(viewIndex + 1)}
						className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#E8E8EA] text-[#6B7280] transition hover:border-[#C7C7CC] disabled:opacity-30"
					>
						<ChevronRight size={13} />
					</button>
				</div>
			</div>

			{/* Question + options */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				{currentQuestion && (
					<div>
						<p className="text-[14.5px] font-semibold leading-snug text-[#1D1D1F]">
							{asText(currentQuestion.prompt)}
						</p>
						<div className="mt-3 grid gap-2">
							{asArray(currentQuestion.options).map((option, optionIndex) => {
								const optionId = asText(option.id) || String(optionIndex);
								const isSelected =
									confirmed ?
										optionId === confirmed.selectedOptionId
									:	pendingAnswer === optionId;
								const isCorrectOption = confirmed && optionId === confirmed.correctOptionId;
								const isWrongSelected = confirmed && isSelected && !confirmed.isCorrect;

								return (
									<label
										key={optionId}
										className={cn(
											"flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-all",
											confirmed ?
												isCorrectOption ? "border-[#4ADE80] bg-[#F0FDF4]"
												: isWrongSelected ? "border-[#F87171] bg-[#FEF2F2]"
												: "border-[#E8E8EA] bg-white opacity-50"
											: isSelected ? "border-[#4ADE80] bg-[#F0FDF4]"
											: "border-[#E8E8EA] bg-white hover:border-[#C7C7CC] hover:bg-[#FAFAFA]",
										)}
									>
										<input
											type="radio"
											name={questionId}
											className="sr-only"
											checked={isSelected}
											disabled={!!confirmed || !isCurrentInteractive}
											onChange={() => {
												if (!confirmed && isCurrentInteractive) setPendingAnswer(optionId);
											}}
										/>
										<span
											className={cn(
												"flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all",
												confirmed ?
													isCorrectOption ? "border-[#16A34A]"
													: isWrongSelected ? "border-[#DC2626]"
													: "border-[#D1D5DB]"
												: isSelected ? "border-[#16A34A]"
												: "border-[#C7C7CC]",
											)}
										>
											{(confirmed ? isCorrectOption || isWrongSelected : isSelected) && (
												<span
													className={cn(
														"h-2 w-2 rounded-full",
														confirmed ?
															isCorrectOption ? "bg-[#16A34A]"
															: "bg-[#DC2626]"
														:	"bg-[#16A34A]",
													)}
												/>
											)}
										</span>
										<span className={cn(
											"text-[13.5px] leading-snug",
											confirmed ?
												isCorrectOption ? "font-medium text-[#166534]"
												: isWrongSelected ? "font-medium text-[#991B1B]"
												: "text-[#9CA3AF]"
											: isSelected ? "font-medium text-[#166534]"
											: "text-[#374151]",
										)}>
											{asText(option.text)}
										</span>
									</label>
								);
							})}
						</div>

						{/* Per-question feedback */}
						{confirmed && (
							<div className={cn(
								"mt-3 rounded-md border p-3",
								confirmed.isCorrect ?
									"border-[#BBF7D0] bg-[#F0FDF4]"
								:	"border-[#FECACA] bg-[#FEF2F2]",
							)}>
								<div className={cn(
									"flex items-center gap-1.5 text-[12px] font-bold",
									confirmed.isCorrect ? "text-[#166534]" : "text-[#991B1B]",
								)}>
									{confirmed.isCorrect ?
										<CheckCircle2 size={13} />
									:	<XCircle size={13} />
									}
									{confirmed.isCorrect ? "¡Correcto!" : "Incorrecto"}
								</div>
								{confirmed.explanation && (
									<p className="mt-1.5 text-[12px] leading-relaxed text-[#374151]">
										{confirmed.explanation}
									</p>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			{/* Footer actions */}
			<div className="mt-3 border-t border-[#F0F0F2] pt-3">
				{isCurrentInteractive && !confirmed && (
					<button
						type="button"
						disabled={!pendingAnswer}
						onClick={handleConfirm}
						className="w-full rounded-xl bg-[#1D1D1F] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-40"
					>
						Confirm answer
					</button>
				)}
				{confirmed && viewIndex < questions.length - 1 && (
					<button
						type="button"
						onClick={handleNext}
						className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D1D1F] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1F2937]"
					>
						Siguiente pregunta
						<ChevronRight size={15} />
					</button>
				)}
			</div>
		</div>
	);
}

function ShortAnswerActivity({
	content,
	answers,
	setAnswer,
	latestAttempt,
	detailTab,
	onDetailTabChange,
}: {
	content: Record<string, unknown>;
	answers: Answers;
	setAnswer: (key: string, value: unknown) => void;
	latestAttempt?: BackendLearningActivityAttempt;
	detailTab: "answer" | "correction";
	onDetailTabChange: (tab: "answer" | "correction") => void;
}) {
	const [activeIndex, setActiveIndex] = useState(0);
	const prompts = asArray(content.prompts);
	const fallbackPrompt = asText(content.prompt) || asText(content.question);
	const items = prompts.length > 0 ?
		prompts.slice(0, 3)
	:	fallbackPrompt ?
			[{id: "response", prompt: fallbackPrompt}]
		:	[];
	const activePrompt = items[Math.min(activeIndex, items.length - 1)];
	const activeId = asId(activePrompt?.id, `prompt${activeIndex + 1}`);
	const value = asText(answers[activeId] ?? answers.response);
	const activeFeedback =
		latestAttempt?.questionFeedback?.find((item) => item.id === activeId) ??
		latestAttempt?.questionFeedback?.[activeIndex];
	const scoreLabel = activeFeedback?.simplifiedScore ?? (
		activeFeedback?.score !== undefined ?
			activeFeedback.score >= 90 ? "Perfect"
			: activeFeedback.score >= 50 ? "Almost there"
			: "wrong"
		:	undefined
	);
	const scoreClass =
		scoreLabel === "Perfect" ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
		: scoreLabel === "Almost there" ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
		:	"border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
	const scoreAccentClass =
		scoreLabel === "Perfect" ? "text-[#16A34A]"
		: scoreLabel === "Almost there" ? "text-[#D97706]"
		:	"text-[#DC2626]";
	const scoreText = scoreLabel === "wrong" ? "Wrong" : scoreLabel;
	const ScoreIcon =
		scoreLabel === "Perfect" ? CheckCircle2
		: scoreLabel === "Almost there" ? CircleAlert
		:	XCircle;

	const visibleDetailTab = activeFeedback && detailTab === "correction" ? "correction" : "answer";

	if (items.length === 0) {
		return null;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex rounded-lg bg-[#F5F5F7] p-1">
				{items.map((prompt, index) => {
					const id = asId(prompt.id, `prompt${index + 1}`);
					const hasFeedback = !!latestAttempt && (
						latestAttempt.questionFeedback?.some((item) => item.id === id) ||
						!!latestAttempt.questionFeedback?.[index]
					);
					return (
						<button
							key={id}
							type="button"
							onClick={() => setActiveIndex(index)}
							className={cn(
								"flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition",
								index === activeIndex ?
									"bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
								:	"text-[#6B7280] hover:text-[#1D1D1F]",
							)}
						>
							Question {index + 1}
							{hasFeedback ? <span className="ml-1 text-[#16A34A]">✓</span> : null}
						</button>
					);
				})}
			</div>
			<div className="flex items-start gap-2.5 text-[14px] font-medium leading-relaxed text-[#1D1D1F]">
				<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F0FDF4] text-[#16A34A]">
					<MessageCircleQuestionMark size={13} strokeWidth={2.25} />
				</span>
				<p>{asText(activePrompt?.prompt)}</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="flex items-end border-b border-[#E5E5E7]">
					{(["answer", ...(activeFeedback ? ["correction" as const] : [])] as const).map((tab) => {
						const selected = visibleDetailTab === tab;
						return (
							<button
								key={tab}
								type="button"
								onClick={() => onDetailTabChange(tab)}
								className={cn(
									"-mb-px min-w-[96px] border-b-2 px-4 py-3 text-center text-[12px] font-bold transition",
									selected ?
										"border-[#4ADE80] bg-white text-[#16A34A]"
									:	"border-transparent bg-[#F8F8F9] text-[#8A8F98] hover:bg-white hover:text-[#1D1D1F]",
								)}
							>
								{tab === "answer" ? "Answer" : "Correction"}
							</button>
						);
					})}
				</div>
				<div className="min-h-0 flex-1 rounded-b-[8px] rounded-tr-[8px] border border-t-0 border-[#E5E5E7] bg-white p-3 shadow-[0_10px_28px_rgba(17,24,39,0.03)]">
					{visibleDetailTab === "answer" ? (
						<textarea
							className="h-full min-h-[180px] w-full resize-none bg-transparent p-1 text-[14px] leading-relaxed text-[#1D1D1F] outline-none placeholder:text-[#9CA3AF]"
							value={value}
							onChange={(event) => setAnswer(activeId, event.target.value)}
							placeholder="Write your answer..."
						/>
					) : activeFeedback ? (
						<div className="space-y-3 text-[12px] leading-relaxed text-[#374151]">
							{scoreLabel ? (
								<span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold", scoreClass)}>
									<ScoreIcon size={12} />
									{scoreText}
								</span>
							) : null}
							<div>
								<div className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", scoreAccentClass)}>
									Expected answer
								</div>
								<FeedbackHtml
									className="mt-1 text-[#1D1D1F]"
									html={activeFeedback.expectedAnswer || activeFeedback.feedback}
								/>
							</div>
							<div>
								<div className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", scoreAccentClass)}>
									Why and how to improve
								</div>
								<FeedbackHtml
									className="mt-1 text-[#374151]"
									html={activeFeedback.improvementReason ||
										activeFeedback.improvements.join("; ") ||
										activeFeedback.feedback}
								/>
							</div>
						</div>
					) : (
						<div className="flex h-full min-h-[180px] items-center justify-center text-center text-[12px] font-medium leading-relaxed text-[#86868B]">
							Check your answers to see the correction for this question.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export function LearningActivityRenderer({
	activity,
	attempts,
	isSubmitting,
	onSubmitAttempt,
	onRefillAttempts,
}: {
	activity: BackendLearningActivity;
	attempts: BackendLearningActivityAttempt[];
	isSubmitting: boolean;
	onSubmitAttempt: (activityId: string, answers: unknown) => Promise<void>;
	onRefillAttempts: (activityId: string) => Promise<void>;
}) {
	const [answers, setAnswers] = useState<Answers>({});
	const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
	const [shortAnswerDetailTab, setShortAnswerDetailTab] = useState<"answer" | "correction">("answer");
	const [shortAnswerProgressActivityId, setShortAnswerProgressActivityId] = useState<string | null>(null);
	const shortAnswerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shortAnswerHasLocalChangesRef = useRef(false);
	const [outOfAttemptsOpen, setOutOfAttemptsOpen] = useState(false);
	const [isRefilling, setIsRefilling] = useState(false);
	const latestAttempt = attempts.at(-1);
	const remainingAttempts = Math.max(0, activity.feedbackAttemptLimit - attempts.length);
	const content = activity.content;
	const canSubmit = !isSubmitting;
	const isObjective = OBJECTIVE_TYPES.has(activity.type);

	useEffect(() => {
		if (shortAnswerSaveTimerRef.current) {
			clearTimeout(shortAnswerSaveTimerRef.current);
			shortAnswerSaveTimerRef.current = null;
		}

		if (activity.type !== "short_answer") {
			return;
		}

		let mounted = true;
		shortAnswerHasLocalChangesRef.current = false;

		void dashboardApi.getActivityProgress(activity.id).then(({progress}) => {
			if (!mounted) return;
			if (shortAnswerHasLocalChangesRef.current) return;
			setAnswers(progress?.answers ?? {});
			setShortAnswerProgressActivityId(activity.id);
			setShortAnswerDetailTab("answer");
		});

		return () => {
			mounted = false;
			if (shortAnswerSaveTimerRef.current) {
				clearTimeout(shortAnswerSaveTimerRef.current);
				shortAnswerSaveTimerRef.current = null;
			}
		};
	}, [activity.id, activity.type]);

	const scheduleShortAnswerProgressSave = (nextAnswers: Answers, completed = false) => {
		if (activity.type !== "short_answer") return;
		if (shortAnswerSaveTimerRef.current) {
			clearTimeout(shortAnswerSaveTimerRef.current);
		}
		shortAnswerSaveTimerRef.current = setTimeout(() => {
			void dashboardApi.saveActivityProgress(activity.id, {
				confirmedAnswers: {},
				answers: nextAnswers,
				completed,
			});
			shortAnswerSaveTimerRef.current = null;
		}, 500);
	};

	const submitLabel = useMemo(() => {
		if (activity.type === "flashcards") return "Mark reviewed";
		if (
			activity.type === "short_answer" ||
			activity.type === "coding_practice" ||
			activity.type === "case_study" ||
			activity.type === "debate_reflection" ||
			activity.type === "guided_project"
		) return "Check answer";
		return "Check answers";
	}, [activity.type]);

	const setAnswer = (key: string, value: unknown) => {
		if (activity.type === "short_answer") {
			shortAnswerHasLocalChangesRef.current = true;
			setShortAnswerProgressActivityId(activity.id);
		}
		setAnswers((previous) => {
			const base =
				activity.type === "short_answer" && shortAnswerProgressActivityId !== activity.id ?
					{}
				:	previous;
			const next = {...base, [key]: value};
			scheduleShortAnswerProgressSave(next);
			return next;
		});
	};

	const submitCurrentAnswers = () => {
		const currentAnswers =
			activity.type === "short_answer" && shortAnswerProgressActivityId !== activity.id ?
				{}
			:	answers;
		const payload = activity.type === "flashcards" ? {reviewedCount: flippedCards.size} : currentAnswers;
		if (activity.type === "short_answer") {
			setShortAnswerDetailTab("correction");
			if (shortAnswerSaveTimerRef.current) {
				clearTimeout(shortAnswerSaveTimerRef.current);
				shortAnswerSaveTimerRef.current = null;
			}
			void dashboardApi.saveActivityProgress(activity.id, {
				confirmedAnswers: {},
				answers: currentAnswers,
				completed: true,
			});
		}
		void onSubmitAttempt(activity.id, payload);
	};

	const handleSubmit = () => {
		if (remainingAttempts === 0) {
			setOutOfAttemptsOpen(true);
			return;
		}
		submitCurrentAnswers();
	};

	const visibleAnswers =
		activity.type === "short_answer" && shortAnswerProgressActivityId !== activity.id ?
			{}
		:	answers;

	const renderBody = () => {
		if (activity.type === "multiple_choice") {
			return (
				<MultipleChoiceActivity
					activity={activity}
					onSubmitAttempt={onSubmitAttempt}
				/>
			);
		}

		if (activity.type === "flashcards") {
			return (
				<div className="grid grid-cols-2 gap-2">
					{asArray(content.cards).map((card, index) => {
						const id = asText(card.id) || `card${index + 1}`;
						const flipped = flippedCards.has(id);
						return (
							<button
								key={id}
								type="button"
								onClick={() =>
									setFlippedCards((previous) => {
										const next = new Set(previous);
										next.add(id);
										return next;
									})
								}
								className={cn(
									"min-h-24 rounded-xl border p-3 text-left text-sm transition",
									flipped ?
										"border-[#4ADE80] bg-[#F0FDF4]"
									:	"border-[#E8E8EA] bg-white hover:border-[#C7C7CC]",
								)}
							>
								<span className="block text-[10px] font-bold uppercase tracking-wide text-[#86868B]">
									{flipped ? "Back" : "Front"}
								</span>
								<span className="mt-2 block text-[#1D1D1F]">
									{flipped ? asText(card.back) : asText(card.front)}
								</span>
							</button>
						);
					})}
				</div>
			);
		}

		if (activity.type === "matching") {
			return (
				<div className="space-y-2">
					{asArray(content.pairs).map((pair, index) => {
						const id = asText(pair.id) || `pair${index + 1}`;
						return (
							<div key={id} className="rounded-xl border border-[#E8E8EA] bg-white p-3">
								<p className="text-[13.5px] font-semibold text-[#1D1D1F]">{asText(pair.left)}</p>
								<input
									className="mt-2 w-full rounded-lg border border-[#E8E8EA] bg-[#F9F9FB] px-3 py-2 text-sm outline-none transition focus:border-[#1D1D1F] focus:bg-white"
									value={asText(answers[id])}
									onChange={(event) => setAnswer(id, event.target.value)}
									placeholder="Match..."
								/>
							</div>
						);
					})}
				</div>
			);
		}

		if (activity.type === "ordering") {
			const items = asArray(content.items);
			return (
				<div className="space-y-2">
					{items.map((item, index) => {
						const id = asText(item.id) || `item${index + 1}`;
						return (
							<div key={id} className="flex items-center gap-3 rounded-xl border border-[#E8E8EA] bg-white p-3">
								<input
									className="w-14 rounded-lg border border-[#E8E8EA] bg-[#F9F9FB] px-2 py-1.5 text-center text-sm outline-none focus:border-[#1D1D1F]"
									type="number"
									min={1}
									max={items.length}
									onChange={(event) => {
										const order = [...(Array.isArray(answers.order) ? answers.order : [])];
										order[Number(event.target.value) - 1] = id;
										setAnswer("order", order);
									}}
								/>
								<span className="text-[13.5px] text-[#374151]">{asText(item.text)}</span>
							</div>
						);
					})}
				</div>
			);
		}

		if (activity.type === "cloze") {
			return (
				<div className="space-y-3">
					<p className="rounded-xl border border-[#E8E8EA] bg-[#F9F9FB] p-4 text-[13.5px] leading-relaxed text-[#374151]">
						{asText(content.textWithBlanks)}
					</p>
					<div className="grid grid-cols-2 gap-2">
						{asArray(content.blanks).map((blank, index) => {
							const id = asText(blank.id) || `blank${index + 1}`;
							return (
								<input
									key={id}
									className="rounded-xl border border-[#E8E8EA] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1D1D1F]"
									placeholder={asText(blank.hint) || id}
									value={asText(answers[id])}
									onChange={(event) => setAnswer(id, event.target.value)}
								/>
							);
						})}
					</div>
				</div>
			);
		}

		if (activity.type === "coding_practice") {
			return (
				<div className="space-y-3">
					<p className="text-[13.5px] leading-relaxed text-[#374151]">{asText(content.prompt)}</p>
					<textarea
						className="h-40 w-full resize-none rounded-xl border border-[#E8E8EA] bg-[#1D1D1F] p-4 font-mono text-xs text-white outline-none focus:border-[#4ADE80]"
						defaultValue={asText(content.starterCode)}
						onChange={(event) => setAnswer("code", event.target.value)}
					/>
				</div>
			);
		}

		if (activity.type === "short_answer") {
			return (
				<ShortAnswerActivity
					content={content}
					answers={visibleAnswers}
					setAnswer={setAnswer}
					latestAttempt={latestAttempt}
					detailTab={shortAnswerDetailTab}
					onDetailTabChange={setShortAnswerDetailTab}
				/>
			);
		}

		if (activity.type === "guided_project") {
			return (
				<div className="space-y-3">
					<p className="text-[13.5px] leading-relaxed text-[#374151]">{asText(content.brief)}</p>
					<ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-[#374151]">
						{(Array.isArray(content.steps) ? content.steps : []).map((step, index) => (
							<li key={index}>{asText(step)}</li>
						))}
					</ol>
					<textarea
						className="h-28 w-full resize-none rounded-xl border border-[#E8E8EA] bg-white p-3 text-sm outline-none transition focus:border-[#1D1D1F]"
						onChange={(event) => setAnswer("response", event.target.value)}
						placeholder="Describe your deliverable..."
					/>
				</div>
			);
		}

		return (
			<div className="flex min-h-0 flex-1 flex-col gap-3">
				<p className="rounded-lg border border-[#E8E8EA] bg-[#F9F9FB] p-4 text-[13.5px] leading-relaxed text-[#374151]">
					{asText(content.scenario) || asText(content.prompt) || asText(content.brief) || activity.instructions}
				</p>
				<textarea
					className="min-h-[180px] flex-1 resize-none rounded-lg border border-[#E8E8EA] bg-white p-3 text-sm outline-none transition focus:border-[#1D1D1F]"
					onChange={(event) => setAnswer("response", event.target.value)}
					placeholder="Write your answer..."
				/>
			</div>
		);
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-white text-[#1D1D1F]">
			{/* Header */}
			<div className="border-b border-[#F0F0F2] pb-3">
				<div className="flex items-center gap-2">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1D1D1F] text-white">
						<ActivityIcon type={activity.type} />
					</div>
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AEAEB2]">
						{activityTypeLabel(activity.type)}
					</span>
				</div>
				<h3 className="mt-2 text-[15.5px] font-bold leading-snug text-[#1D1D1F]">
					{activity.title}
				</h3>
				{activity.type !== "short_answer" && (
					<p className="mt-1 text-[12px] leading-relaxed text-[#6B7280]">{activity.instructions}</p>
				)}
			</div>

			{/* Body */}
			<div className="mt-3 flex min-h-0 flex-1 flex-col">
				{renderBody()}
			</div>

			{/* Footer — only for non-multiple_choice types */}
			{activity.type !== "multiple_choice" && (
				<>
					{latestAttempt && activity.type !== "short_answer" && (
						<div className="mt-3 rounded-[12px] border border-emerald-200 bg-emerald-50 p-3">
							<div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
								<CheckCircle2 size={13} />
								{latestAttempt.score !== undefined ? `Score: ${latestAttempt.score}%` : "Feedback"}
							</div>
							<p className="mt-1.5 text-xs leading-relaxed text-emerald-900 whitespace-pre-line">
								{latestAttempt.feedback}
							</p>
						</div>
					)}

					<div className="mt-3 flex items-center justify-between gap-3 border-t border-[#F0F0F2] pt-3">
						{!isObjective && (
							<span className="group relative inline-flex items-center gap-1.5 text-[11px] text-[#AEAEB2]">
								<button
									type="button"
									className="flex h-4 w-4 cursor-help items-center justify-center text-[#16A34A] outline-none transition hover:text-[#15803D] focus-visible:ring-2 focus-visible:ring-[#86EFAC]"
									aria-describedby={`activity-attempts-tooltip-${activity.id}`}
									aria-label="AI correction attempts"
								>
									<BadgeQuestionMark size={14} strokeWidth={2.25} />
								</button>
								<span>
									{remainingAttempts} {remainingAttempts === 1 ? "attempt" : "attempts"} left
								</span>
								<span
									id={`activity-attempts-tooltip-${activity.id}`}
									role="tooltip"
									className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-[220px] rounded-[6px] border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-[11px] font-medium leading-snug text-[#166534] opacity-0 shadow-[0_8px_20px_rgba(22,163,74,0.14)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
								>
									AI feedback uses 1 attempt. You get 3 attempts per paid correction.
								</span>
							</span>
						)}
						<button
							type="button"
							disabled={!canSubmit}
							onClick={handleSubmit}
							className="ml-auto mr-8 inline-flex items-center gap-2 rounded-xl bg-[#1D1D1F] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-40"
						>
							{isSubmitting ? "Checking..." : submitLabel}
							<Send size={12} />
						</button>
					</div>
				</>
			)}

			{!isObjective && (() => {
				const cost = getActivityFeedbackRefillCost({quality: activity.quality});
				return (
					<AlertDialog open={outOfAttemptsOpen} onOpenChange={setOutOfAttemptsOpen}>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>No attempts remaining</AlertDialogTitle>
								<AlertDialogDescription>
									You&apos;ve used all your correction attempts for this activity. Use a coin to get 3 more attempts and keep practicing.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<button
									type="button"
									onClick={() => setOutOfAttemptsOpen(false)}
									className="inline-flex h-9 items-center justify-center rounded-xl border border-[#E5E5E7] bg-white px-4 text-[13px] font-semibold text-[#374151] transition hover:border-[#C7C7CC] hover:bg-[#F9F9FB]"
								>
									Not now
								</button>
								<button
									type="button"
									disabled={isRefilling}
									onClick={async () => {
										setIsRefilling(true);
										try {
											await onRefillAttempts(activity.id);
											setOutOfAttemptsOpen(false);
											submitCurrentAnswers();
										} finally {
											setIsRefilling(false);
										}
									}}
									className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#1D1D1F] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-40"
								>
									{isRefilling ? "Processing..." : <>Use <CoinAmount type={cost.coinType} amount={cost.amount} /></>}
								</button>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				);
			})()}
		</div>
	);
}
