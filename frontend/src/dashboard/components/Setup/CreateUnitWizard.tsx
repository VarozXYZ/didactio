import {useCallback, useEffect, useMemo, useState} from "react";
import {toastError} from "@/hooks/use-toast";
import {Check, X} from "lucide-react";
import {
	type BackendFolder,
	type BackendGenerationQuality,
	dashboardApi,
	getDashboardErrorMessage,
} from "../../api/dashboardApi";
import {useAuth} from "../../../auth/AuthProvider";
import {adaptDidacticUnitPlanning} from "../../adapters";
import type {PlanningDetailViewModel, PlanningSyllabus} from "../../types";
import {TopicStep} from "./steps/TopicStep";
import {QuestionnaireStep} from "./steps/QuestionnaireStep";
import {SyllabusStep} from "./steps/SyllabusStep";
import {getUnitGenerationCost} from "../../utils/coinPricing";
import {
	buildGenerationModelOptions,
	type GenerationModelOption,
} from "../../utils/modelOptions";

export type WizardStep = 0 | 1 | 2;

type PartialPlanningSyllabus = {
	title?: string;
	overview?: string;
	learningGoals?: string[];
	keywords?: string[];
	chapters?: Array<{
		title?: string;
		overview?: string;
		keyPoints?: string[];
		lessons?: Array<{
			title?: string;
			contentOutline?: string[];
		}>;
	}>;
};

type PartialReferenceSyllabus = {
	title?: string;
	description?: string;
	keywords?: string | string[];
	modules?: Array<{
		title?: string;
		overview?: string;
		lessons?: Array<{
			title?: string;
			contentOutline?: string[];
		}>;
	}>;
};

function normalizeKeywords(
	value: string | string[] | undefined,
): string[] | undefined {
	if (Array.isArray(value))
		return value.filter((k) => typeof k === "string" && k.trim());
	if (typeof value === "string") {
		const byDelimiter = value
			.split(/[,\n;]/)
			.map((k) => k.trim())
			.filter(Boolean);
		if (byDelimiter.length <= 1 && value.includes(" ")) {
			return value
				.split(/\s+/)
				.map((k) => k.trim())
				.filter(Boolean);
		}
		return byDelimiter;
	}
	return undefined;
}

function deriveKeyPointsFromLessons(
	lessons: Array<{title?: string; contentOutline?: string[]}> | undefined,
): string[] | undefined {
	const outlines = (lessons ?? [])
		.flatMap((l) => l.contentOutline ?? [])
		.filter((i) => typeof i === "string" && i.trim());
	if (outlines.length > 0) return outlines.slice(0, 3);
	const titles = (lessons ?? [])
		.map((l) => l.title?.trim())
		.filter((t): t is string => Boolean(t));
	return titles.length > 0 ? titles.slice(0, 3) : undefined;
}

function deriveLearningGoalsFromModules(
	modules:
		| Array<{
				title?: string;
				lessons?: Array<{title?: string; contentOutline?: string[]}>;
		  }>
		| undefined,
): string[] | undefined {
	const outlines = (modules ?? [])
		.flatMap((m) => m.lessons ?? [])
		.flatMap((l) => l.contentOutline ?? [])
		.filter((i) => typeof i === "string" && i.trim());
	if (outlines.length > 0) return outlines.slice(0, 3);
	const titles = (modules ?? [])
		.map((m) => m.title?.trim())
		.filter((t): t is string => Boolean(t))
		.map((t) => `Understand ${t}`);
	return titles.length > 0 ? titles.slice(0, 3) : undefined;
}

export function normalizeStreamedSyllabusPreview(
	value:
		| PartialPlanningSyllabus
		| PartialReferenceSyllabus
		| null
		| undefined,
): PartialPlanningSyllabus | null {
	if (!value || typeof value !== "object") return null;

	if (
		"chapters" in value ||
		"overview" in value ||
		"learningGoals" in value
	) {
		return {
			...value,
			keywords: normalizeKeywords(
				(value as PartialPlanningSyllabus).keywords,
			),
			chapters: (value as PartialPlanningSyllabus).chapters?.map(
				(ch) => ({
					...ch,
					keyPoints:
						Array.isArray(ch.keyPoints) ?
							ch.keyPoints.filter(
								(p) => typeof p === "string" && p.trim(),
							)
						:	ch.keyPoints,
					lessons: ch.lessons?.map((l) => ({
						...l,
						contentOutline:
							Array.isArray(l.contentOutline) ?
								l.contentOutline.filter(
									(o) => typeof o === "string" && o.trim(),
								)
							:	l.contentOutline,
					})),
				}),
			),
		};
	}

	const ref = value as PartialReferenceSyllabus;
	const normalizedModules = ref.modules?.map((m) => ({
		title: m.title,
		overview: m.overview,
		keyPoints: deriveKeyPointsFromLessons(m.lessons),
		lessons: m.lessons?.map((l) => ({
			title: l.title,
			contentOutline: l.contentOutline?.filter(
				(o) => typeof o === "string" && o.trim(),
			),
		})),
	}));

	return {
		title: ref.title,
		overview: ref.description,
		keywords: normalizeKeywords(ref.keywords),
		learningGoals: deriveLearningGoalsFromModules(ref.modules),
		chapters: normalizedModules,
	};
}

const STEPS = [
	{
		label: "Topic",
		mobileLabel: "Topic",
		title: "What do you want to learn?",
		subtitle: "Start with a topic. You can refine it in the next step.",
		description:
			"Tell us what you want to learn and how deep you want to go.",
	},
	{
		label: "Questionnaire",
		mobileLabel: "Questions",
		title: "A few quick questions",
		subtitle: "Help us match the unit to your level and goals.",
		description:
			"A few quick questions so we can match the content to your level.",
	},
	{
		label: "Syllabus",
		mobileLabel: "Syllabus",
		title: "Review your syllabus",
		subtitle: "Check the plan before generating the full unit.",
		description:
			"See what your unit will cover and give it the green light.",
	},
] as const;

function isSyllabusStage(nextAction: string): boolean {
	return (
		nextAction === "generate_syllabus_prompt" ||
		nextAction === "review_syllabus_prompt" ||
		nextAction === "review_syllabus" ||
		nextAction === "approve_syllabus"
	);
}

function resolveStepFromNextAction(nextAction: string): WizardStep {
	if (isSyllabusStage(nextAction)) return 2;
	if (nextAction === "answer_questionnaire") return 1;
	return 0;
}

export type CreateUnitWizardProps = {
	didacticUnitId?: string | null;
	onClose: () => void;
	onDataChanged: () => void;
	onOpenEditor: (didacticUnitId: string) => void;
};

export function CreateUnitWizard({
	didacticUnitId,
	onClose,
	onDataChanged,
	onOpenEditor,
}: CreateUnitWizardProps) {
	const [currentStep, setCurrentStep] = useState<WizardStep>(0);

	const [planning, setPlanning] = useState<PlanningDetailViewModel | null>(
		null,
	);
	const [activeUnitId, setActiveUnitId] = useState<string | null>(
		didacticUnitId ?? null,
	);
	const [availableFolders, setAvailableFolders] = useState<BackendFolder[]>(
		[],
	);
	const [generationModelOptions, setGenerationModelOptions] = useState<
		GenerationModelOption[]
	>(() => buildGenerationModelOptions(null, null));

	const [draftTopic, setDraftTopic] = useState("");
	const [draftAdditionalContext, setDraftAdditionalContext] = useState("");
	const [draftLearningProfile, setDraftLearningProfile] = useState<
		"beginner" | "intermediate" | "advanced"
	>("beginner");
	const [draftLength, setDraftLength] = useState<
		"intro" | "short" | "long" | "textbook"
	>("short");
	const [draftFolderId, setDraftFolderId] = useState<string | null>(null);

	const [questionnaireAnswers, setQuestionnaireAnswers] = useState<
		Record<string, string>
	>({});

	const [streamedSyllabusPreview, setStreamedSyllabusPreview] =
		useState<PartialPlanningSyllabus | null>(null);
	const [isStreamingSyllabus, setIsStreamingSyllabus] = useState(false);
	const [activeGenerationTier, setActiveGenerationTier] =
		useState<BackendGenerationQuality | null>(null);
	const [reviewDecision, setReviewDecision] = useState<"accept" | "reject">(
		"accept",
	);
	const [regenerationContext, setRegenerationContext] = useState("");
	const [selectedGenerationTier, setSelectedGenerationTier] =
		useState<BackendGenerationQuality>("gold");
	const {user, refreshUser} = useAuth();

	const [isLoading, setIsLoading] = useState(Boolean(didacticUnitId));
	const [isSubmitting, setIsSubmitting] = useState(false);

	const applyPlanningState = useCallback(
		(detail: Awaited<ReturnType<typeof dashboardApi.getDidacticUnit>>) => {
			const pd = adaptDidacticUnitPlanning(detail);
			setPlanning(pd);
			setQuestionnaireAnswers(pd.questionnaire?.answers ?? {});
			setDraftAdditionalContext(pd.additionalContext ?? "");
			setDraftLearningProfile(pd.learningProfile ?? pd.level);
			setDraftLength(pd.length === "intro" ? "short" : pd.length);
			setDraftFolderId(pd.folder.id);
			setActiveUnitId(pd.id);

			const targetStep =
				pd.status === "questionnaire_pending_moderation" ||
				pd.status === "moderation_failed" ?
					1
				:	resolveStepFromNextAction(pd.nextAction);
			setCurrentStep(targetStep);
		},
		[],
	);

	useEffect(() => {
		void (async () => {
			try {
				const [response, config, catalog] = await Promise.all([
					dashboardApi.listFolders(),
					dashboardApi.getAiConfig(),
					dashboardApi.getAiConfigCatalog(),
				]);
				setAvailableFolders(response.folders);
				setGenerationModelOptions(
					buildGenerationModelOptions(config, catalog),
				);
			} catch (e) {
				toastError(
					e instanceof Error ? e.message : "Failed to load folders.",
				);
			}
		})();
	}, []);

	useEffect(() => {
		if (!didacticUnitId) return;
		void (async () => {
			setIsLoading(true);
			try {
				let detail = await dashboardApi.getDidacticUnit(didacticUnitId);
				if (
					detail.nextAction === "moderate_topic" &&
					detail.status !== "moderation_rejected" &&
					detail.status !== "moderation_failed"
				) {
					detail =
						await dashboardApi.moderateDidacticUnit(didacticUnitId);
				}
				applyPlanningState(detail);
			} catch (e) {
				toastError(
					e instanceof Error ? e.message : "Failed to load unit.",
				);
			} finally {
				setIsLoading(false);
			}
		})();
	}, [applyPlanningState, didacticUnitId]);

	const handleTopicSubmit = useCallback(async () => {
		setIsSubmitting(true);
		try {
			const created = await dashboardApi.createDidacticUnit({
				topic: draftTopic.trim(),
				additionalContext: draftAdditionalContext.trim() || undefined,
				learningProfile: draftLearningProfile,
				length: draftLength,
				questionnaireEnabled: true,
				folderSelection:
					draftFolderId ?
						{mode: "manual", folderId: draftFolderId}
					:	{mode: "auto"},
			});

			onDataChanged();
			const pd = adaptDidacticUnitPlanning(created);
			setPlanning(pd);
			setQuestionnaireAnswers(pd.questionnaire?.answers ?? {});
			setActiveUnitId(pd.id);

			if (isSyllabusStage(pd.nextAction)) {
				setCurrentStep(2);
			} else {
				setCurrentStep(1);
			}
		} catch (e) {
			toastError(getDashboardErrorMessage(e, "Action failed."));
		} finally {
			setIsSubmitting(false);
		}
	}, [
		draftTopic,
		draftAdditionalContext,
		draftLearningProfile,
		draftLength,
		draftFolderId,
		onDataChanged,
	]);

	useEffect(() => {
		if (
			!activeUnitId ||
			planning?.status !== "questionnaire_pending_moderation"
		) {
			return;
		}

		let cancelled = false;
		const pollModeration = async () => {
			try {
				const detail = await dashboardApi.getDidacticUnit(activeUnitId);
				if (cancelled) return;
				const pd = adaptDidacticUnitPlanning(detail);
				setPlanning(pd);
				setQuestionnaireAnswers((prev) => ({
					...(pd.questionnaire?.answers ?? {}),
					...prev,
				}));

				if (pd.status === "moderation_rejected") {
					toastError(
						pd.moderationError ??
							"This topic could not be approved. Please adjust it and try again.",
					);
					setCurrentStep(0);
				} else if (pd.status === "moderation_failed") {
					toastError(
						pd.moderationError ??
							"Moderation failed. You can retry or edit the topic.",
					);
				}
			} catch (e) {
				if (!cancelled) {
					toastError(
						e instanceof Error ?
							e.message
						:	"Failed to refresh moderation status.",
					);
				}
			}
		};

		const interval = window.setInterval(() => {
			void pollModeration();
		}, 1200);
		void pollModeration();

		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [activeUnitId, planning?.status]);

	const handleQuestionnaireSubmit = useCallback(async () => {
		if (!planning?.questionnaire) return;
		if (planning.status === "questionnaire_pending_moderation") return;
		const missingAnswer = planning.questionnaire.questions.find((q) => {
			const value = questionnaireAnswers[q.id]?.trim() ?? "";
			return !value || value === "__other__";
		});

		if (missingAnswer) {
			toastError("Answer all questions or skip the questionnaire.");
			return;
		}
		setIsSubmitting(true);
		try {
			const detail = await dashboardApi.answerDidacticUnitQuestionnaire(
				planning.id,
				planning.questionnaire.questions.map((q) => ({
					questionId: q.id,
					value: questionnaireAnswers[q.id]?.trim() ?? "",
				})),
			);
			onDataChanged();
			const pd = adaptDidacticUnitPlanning(detail);
			setPlanning(pd);
			setCurrentStep(2);
		} catch (e) {
			toastError(getDashboardErrorMessage(e, "Action failed."));
		} finally {
			setIsSubmitting(false);
		}
	}, [planning, questionnaireAnswers, onDataChanged]);

	const handleQuestionnaireSkip = useCallback(async () => {
		if (!planning) return;
		if (planning.status === "questionnaire_pending_moderation") return;
		setIsSubmitting(true);
		try {
			const detail = await dashboardApi.answerDidacticUnitQuestionnaire(
				planning.id,
				[],
			);
			onDataChanged();
			const pd = adaptDidacticUnitPlanning(detail);
			setPlanning(pd);
			setCurrentStep(2);
		} catch (e) {
			toastError(getDashboardErrorMessage(e, "Action failed."));
		} finally {
			setIsSubmitting(false);
		}
	}, [planning, onDataChanged]);

	const handleModerationRetry = useCallback(async () => {
		if (!planning) return;
		setIsSubmitting(true);
		try {
			const detail = await dashboardApi.moderateDidacticUnit(planning.id);
			const pd = adaptDidacticUnitPlanning(detail);
			setPlanning(pd);
			setCurrentStep(pd.status === "moderation_rejected" ? 0 : 1);
			if (pd.status === "moderation_rejected") {
				toastError(
					pd.moderationError ??
						"This topic could not be approved. Please adjust it and try again.",
				);
			}
		} catch (e) {
			toastError(getDashboardErrorMessage(e, "Action failed."));
		} finally {
			setIsSubmitting(false);
		}
	}, [planning]);

	const handleGenerateSyllabus = useCallback(
		async (tier: BackendGenerationQuality) => {
			if (!planning) return;
			setIsSubmitting(true);
			setIsStreamingSyllabus(true);
			setActiveGenerationTier(tier);
			setStreamedSyllabusPreview(null);
			try {
				const detail = await dashboardApi.streamDidacticUnitSyllabus(
					planning.id,
					tier,
					{
						onPartialStructured: (event) => {
							const partial = event.data as
								| {syllabus?: PartialPlanningSyllabus}
								| PartialPlanningSyllabus;
							setStreamedSyllabusPreview(
								normalizeStreamedSyllabusPreview(
									"syllabus" in partial && partial.syllabus ?
										partial.syllabus
									:	(partial as PartialPlanningSyllabus),
								),
							);
						},
					},
					reviewDecision === "reject" ?
						{context: regenerationContext.trim() || undefined}
					:	undefined,
				);
				const pd = adaptDidacticUnitPlanning(detail);
				setPlanning(pd);
				setStreamedSyllabusPreview(null);
				setRegenerationContext("");
				if (pd.syllabus) setReviewDecision("accept");
				onDataChanged();
				await refreshUser();
			} catch (e) {
				toastError(getDashboardErrorMessage(e, "Action failed."));
				await refreshUser();
			} finally {
				setIsSubmitting(false);
				setIsStreamingSyllabus(false);
				setActiveGenerationTier(null);
			}
		},
		[planning, reviewDecision, regenerationContext, onDataChanged],
	);

	const handleStartGeneration = useCallback(
		async (tier: BackendGenerationQuality) => {
			if (!planning?.syllabus) return;
			setIsSubmitting(true);
			try {
				let detail = await dashboardApi.getDidacticUnit(planning.id);
				if (isSyllabusStage(detail.nextAction)) {
					detail = await dashboardApi.approveDidacticUnitSyllabus(
						planning.id,
						tier,
					);
				}
				onDataChanged();
				await refreshUser();
				onOpenEditor(detail.id);
			} catch (e) {
				toastError(getDashboardErrorMessage(e, "Action failed."));
				await refreshUser();
			} finally {
				setIsSubmitting(false);
			}
		},
		[planning, onDataChanged, onOpenEditor],
	);

	const hasSyllabus = Boolean(planning?.syllabus);
	const hasStreamPreview = Boolean(
		streamedSyllabusPreview &&
		(streamedSyllabusPreview.title?.trim() ||
			(streamedSyllabusPreview.chapters?.length ?? 0) > 0),
	);
	const syllabusToRender: PlanningSyllabus | PartialPlanningSyllabus | null =
		isStreamingSyllabus && hasStreamPreview ?
			streamedSyllabusPreview
		:	(planning?.syllabus ??
			(hasStreamPreview ? streamedSyllabusPreview : null));

	const needsInitialSyllabusGeneration = useMemo(() => {
		if (
			!planning ||
			planning.syllabus ||
			isStreamingSyllabus ||
			isSubmitting
		)
			return false;
		return (
			planning.nextAction === "generate_syllabus_prompt" ||
			planning.nextAction === "review_syllabus_prompt"
		);
	}, [planning, isStreamingSyllabus, isSubmitting]);

	useEffect(() => {
		if (needsInitialSyllabusGeneration && currentStep === 2) {
			void handleGenerateSyllabus("silver");
		}
	}, [needsInitialSyllabusGeneration, currentStep, handleGenerateSyllabus]);

	const selectedUnitCost = getUnitGenerationCost({
		quality: selectedGenerationTier,
		length: draftLength,
	});
	const canPaySelectedUnit =
		user?.role === "admin" ||
		(user?.credits[selectedUnitCost.coinType] ?? 0) >= selectedUnitCost.amount;
	const currentStepMeta = STEPS[currentStep];

	if (isLoading) {
		return (
			<div
				className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
				onClick={onClose}
			>
				<div
					className="rounded-[18px] bg-white/95 px-10 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.18)] backdrop-blur-xl"
					onClick={(event) => event.stopPropagation()}
				>
					<div className="text-[14px] text-[#86868B]">
						Loading unit...
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden px-4 py-3 sm:py-6"
			onClick={onClose}
			style={{
				background:
					"radial-gradient(ellipse at 60% 40%, rgba(17,160,125,0.18) 0%, rgba(52,52,195,0.12) 40%, rgba(239,160,71,0.10) 70%, rgba(0,0,0,0.45) 100%)",
				backdropFilter: "blur(20px)",
			}}
		>
			<div
				className="flex min-h-0 max-h-[calc(100dvh-0.75rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-[22px] md:max-w-[920px] md:flex-row md:max-h-[calc(100dvh-1.5rem)]"
				onClick={(event) => event.stopPropagation()}
				style={{
					background: "rgba(255,255,255,0.72)",
					backdropFilter: "blur(40px) saturate(1.6)",
					boxShadow:
						"0 2px 0 rgba(255,255,255,0.8) inset, 0 32px_80px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.5)",
					border: "1px solid rgba(255,255,255,0.55)",
				}}
			>
				<div
					className="hidden w-[232px] shrink-0 flex-col md:flex"
					style={{
						background: "rgba(248,248,250,0.7)",
						borderRight: "1px solid rgba(0,0,0,0.06)",
					}}
				>
					<div className="px-5 pt-5 pb-4 shrink-0">
						<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#AEAEB2]">
							New Unit
						</p>
					</div>

					<nav className="flex flex-1 flex-col">
						{STEPS.map((step, index) => {
							const isCompleted = index < currentStep;
							const isCurrent = index === currentStep;

							return (
								<div
									key={step.label}
									className={`relative flex flex-1 flex-col px-6 py-6 transition-all ${
										index < STEPS.length - 1 ?
											"border-b border-black/[0.05]"
										:	""
									} ${isCurrent ? "bg-white/60" : ""}`}
								>
									<div
										className={`absolute left-0 top-0 bottom-0 w-[3px] transition-all ${
											isCurrent ? "bg-[#1D1D1F]"
											: isCompleted ? "bg-[#11A07D]/60"
											: "bg-transparent"
										}`}
									/>

									<span
										className={`mb-3.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold transition-all ${
											isCompleted ?
												"bg-[#11A07D] text-white"
											: isCurrent ?
												"bg-[#1D1D1F] text-white"
											:	"bg-black/[0.06] text-[#C7C7CC]"
										}`}
									>
										{isCompleted ?
											<Check size={11} strokeWidth={3} />
										:	index + 1}
									</span>

									<span
										className={`mb-2.5 block text-[14px] font-semibold leading-tight transition-all ${
											isCurrent ? "text-[#1D1D1F]"
											: isCompleted ? "text-[#6E6E73]"
											: "text-[#C7C7CC]"
										}`}
									>
										{step.label}
									</span>

									<p
										className={`text-[12.5px] leading-relaxed transition-all ${
											isCurrent ? "text-[#6E6E73]"
											: isCompleted ? "text-[#AEAEB2]"
											: "text-[#D1D1D6]"
										}`}
									>
										{step.description}
									</p>
								</div>
							);
						})}
					</nav>
				</div>

				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
					<div className="shrink-0 border-b border-black/[0.06] px-5 pb-4 pt-5 md:hidden">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#AEAEB2]">
									New Unit
								</p>
								<h2 className="mt-4 text-[27px] font-bold leading-tight tracking-tight text-[#1D1D1F]">
									{currentStepMeta.title}
								</h2>
								<p className="mt-3 text-[15px] font-medium leading-relaxed text-[#7A7A7F]">
									{currentStepMeta.subtitle}
								</p>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#8E8E93] transition-colors hover:bg-black/[0.06] hover:text-[#1D1D1F]"
								aria-label="Close wizard"
							>
								<X size={18} />
							</button>
						</div>
					</div>

					<div className="w-full min-w-0 shrink-0 overflow-hidden px-5 pb-4 pt-2 md:hidden">
						<div className="grid overflow-hidden rounded-[16px] border border-black/[0.08] bg-black/[0.05] p-0.5 grid-cols-3">
						{STEPS.map((step, index) => {
							const isCompleted = index < currentStep;
							const isCurrent = index === currentStep;

							return (
								<div
									key={step.label}
									className={`flex min-w-0 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-bold transition ${
										isCurrent ?
											"rounded-[13px] bg-[#1D1D1F] text-white"
										: isCompleted ?
											"text-[#0A9068]"
										:	"text-[#AEAEB2]"
									} ${!isCurrent && index > 0 ? "border-l border-black/[0.08]" : ""}`}
								>
									<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px]">
										{isCompleted ?
											<Check size={10} strokeWidth={3} />
										:	index + 1}
									</span>
									<span className="truncate">{step.mobileLabel}</span>
								</div>
							);
						})}
						</div>
					</div>

					<div
						className={`hidden shrink-0 items-center justify-end px-6 pt-5 md:flex ${
							currentStep === 2 ?
								"absolute right-0 top-0 z-10 px-4 pt-4"
							:	"absolute right-0 top-0 z-10 px-4 pt-4"
						}`}
					>
						<button
							type="button"
							onClick={onClose}
							className="flex h-7 w-7 items-center justify-center rounded-full text-[#AEAEB2] transition-colors hover:bg-black/[0.06] hover:text-[#1D1D1F]"
						>
							<X size={15} />
						</button>
					</div>
					<div
						className={`min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pb-5 pt-4 md:px-6 md:pt-4 ${
							currentStep === 2 ? "pt-4" : ""
						}`}
					>
						{currentStep === 0 && (
							<TopicStep
								draftTopic={draftTopic}
								setDraftTopic={setDraftTopic}
								draftAdditionalContext={draftAdditionalContext}
								setDraftAdditionalContext={
									setDraftAdditionalContext
								}
								draftLearningProfile={draftLearningProfile}
								setDraftLearningProfile={
									setDraftLearningProfile
								}
								draftLength={draftLength}
								setDraftLength={setDraftLength}
								draftFolderId={draftFolderId}
								setDraftFolderId={setDraftFolderId}
								availableFolders={availableFolders}
								onCreateFolder={async (name, icon, color) => {
									const created =
										await dashboardApi.createFolder({
											name,
											icon,
											color,
										});
									setAvailableFolders((prev) => [
										...prev,
										created,
									]);
									return created;
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
								setQuestionnaireAnswers={
									setQuestionnaireAnswers
								}
								isSubmitting={isSubmitting}
								onSubmit={handleQuestionnaireSubmit}
								onSkip={handleQuestionnaireSkip}
								onRetryModeration={handleModerationRetry}
								onEditTopic={() => setCurrentStep(0)}
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
								setSelectedGenerationTier={
									setSelectedGenerationTier
								}
								onGenerateSyllabus={handleGenerateSyllabus}
								onStartGeneration={handleStartGeneration}
								credits={user?.credits ?? {bronze: 0, silver: 0, gold: 0}}
								canPaySelectedUnit={canPaySelectedUnit}
								modelOptions={generationModelOptions}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
