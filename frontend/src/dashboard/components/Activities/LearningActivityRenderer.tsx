import {useEffect, useMemo, useState} from "react";
import {
	BookOpenCheck,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Code2,
	Layers3,
	ListChecks,
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
					<h3 className="text-[17px] font-bold text-[#111827]">Actividad finalizada</h3>
					<p className="mt-1 text-[14px] text-[#6B7280]">
						<span className="font-semibold text-[#111827]">{correctCount}</span>
						{" de "}
						<span className="font-semibold text-[#111827]">{questions.length}</span>
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
			<div className="mb-4 flex items-center gap-1.5">
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
			<div className="mb-3 flex items-center justify-between">
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
						<p className="text-[14.5px] font-semibold leading-snug text-[#111827]">
							{asText(currentQuestion.prompt)}
						</p>
						<div className="mt-3 space-y-2">
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
											"flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all",
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
						className="w-full rounded-xl bg-[#111827] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-40"
					>
						Confirmar respuesta
					</button>
				)}
				{confirmed && viewIndex < questions.length - 1 && (
					<button
						type="button"
						onClick={handleNext}
						className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1F2937]"
					>
						Siguiente pregunta
						<ChevronRight size={15} />
					</button>
				)}
			</div>
		</div>
	);
}

export function LearningActivityRenderer({
	activity,
	attempts,
	isSubmitting,
	onSubmitAttempt,
}: {
	activity: BackendLearningActivity;
	attempts: BackendLearningActivityAttempt[];
	isSubmitting: boolean;
	onSubmitAttempt: (activityId: string, answers: unknown) => Promise<void>;
}) {
	const [answers, setAnswers] = useState<Answers>({});
	const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
	const latestAttempt = attempts.at(-1);
	const remainingAttempts = Math.max(0, activity.feedbackAttemptLimit - attempts.length);
	const content = activity.content;
	const canSubmit = remainingAttempts > 0 && !isSubmitting;
	const isObjective = OBJECTIVE_TYPES.has(activity.type);

	const submitLabel = useMemo(() => {
		if (activity.type === "flashcards") return "Mark reviewed";
		if (
			activity.type === "short_answer" ||
			activity.type === "coding_practice" ||
			activity.type === "case_study" ||
			activity.type === "debate_reflection" ||
			activity.type === "guided_project"
		) return "Get AI feedback";
		return "Check answers";
	}, [activity.type]);

	const setAnswer = (key: string, value: unknown) => {
		setAnswers((previous) => ({...previous, [key]: value}));
	};

	const handleSubmit = () => {
		const payload = activity.type === "flashcards" ? {reviewedCount: flippedCards.size} : answers;
		void onSubmitAttempt(activity.id, payload);
	};

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
								<span className="mt-2 block text-[#111827]">
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
								<p className="text-[13.5px] font-semibold text-[#111827]">{asText(pair.left)}</p>
								<input
									className="mt-2 w-full rounded-lg border border-[#E8E8EA] bg-[#F9F9FB] px-3 py-2 text-sm outline-none transition focus:border-[#111827] focus:bg-white"
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
									className="w-14 rounded-lg border border-[#E8E8EA] bg-[#F9F9FB] px-2 py-1.5 text-center text-sm outline-none focus:border-[#111827]"
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
									className="rounded-xl border border-[#E8E8EA] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#111827]"
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
						className="h-40 w-full resize-none rounded-xl border border-[#E8E8EA] bg-[#111827] p-4 font-mono text-xs text-white outline-none focus:border-[#4ADE80]"
						defaultValue={asText(content.starterCode)}
						onChange={(event) => setAnswer("code", event.target.value)}
					/>
				</div>
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
						className="h-28 w-full resize-none rounded-xl border border-[#E8E8EA] bg-white p-3 text-sm outline-none transition focus:border-[#111827]"
						onChange={(event) => setAnswer("response", event.target.value)}
						placeholder="Describe your deliverable..."
					/>
				</div>
			);
		}

		return (
			<div className="space-y-3">
				<p className="rounded-xl border border-[#E8E8EA] bg-[#F9F9FB] p-4 text-[13.5px] leading-relaxed text-[#374151]">
					{asText(content.scenario) || asText(content.prompt) || asText(content.brief) || activity.instructions}
				</p>
				<textarea
					className="h-32 w-full resize-none rounded-xl border border-[#E8E8EA] bg-white p-3 text-sm outline-none transition focus:border-[#111827]"
					onChange={(event) => setAnswer("response", event.target.value)}
					placeholder="Write your answer..."
				/>
			</div>
		);
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-white p-5 text-[#111827]">
			{/* Header */}
			<div className="border-b border-[#F0F0F2] pb-4">
				<div className="flex items-center gap-2">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#111827] text-white">
						<ActivityIcon type={activity.type} />
					</div>
					<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#AEAEB2]">
						Interactive activity
					</span>
				</div>
				<h3 className="mt-2 text-[15.5px] font-bold leading-snug text-[#111827]">
					{activity.title}
				</h3>
				<p className="mt-1 text-[12px] leading-relaxed text-[#6B7280]">{activity.instructions}</p>
			</div>

			{/* Body */}
			<div className="mt-4 flex min-h-0 flex-1 flex-col">
				{renderBody()}
			</div>

			{/* Footer — only for non-multiple_choice types */}
			{activity.type !== "multiple_choice" && (
				<>
					{latestAttempt && (
						<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
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
							<span className="text-[11px] text-[#AEAEB2]">
								{remainingAttempts} {remainingAttempts === 1 ? "attempt" : "attempts"} left
							</span>
						)}
						<button
							type="button"
							disabled={!canSubmit}
							onClick={handleSubmit}
							className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-40"
						>
							{isSubmitting ? "Checking..." : submitLabel}
							<Send size={12} />
						</button>
					</div>
				</>
			)}
		</div>
	);
}
