import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type MouseEvent,
} from "react";
import {
	Flashcard,
	useFlashcard,
} from "react-quizlet-flashcard";
import "react-quizlet-flashcard/dist/index.css";
import {
	BookOpenCheck,
	BadgeQuestionMark,
	CircleAlert,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Code2,
	Copy,
	FileText,
	Layers3,
	ListChecks,
	MessageCircleQuestionMark,
	MessageSquareText,
	Pencil,
	Plus,
	RotateCcw,
	Send,
	Trash2,
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
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import {CoinAmount} from "@/components/Coin";
import {getActivityFeedbackRefillCost} from "../../utils/coinPricing";

type Answers = Record<string, unknown>;
type ActivityStylePresetId = "modern" | "classic" | "plain";
type ActivityColorTheme = {
	surface: string;
	surfaceAlt: string;
	border: string;
	borderStrong: string;
	text: string;
	muted: string;
	primary: string;
	primaryHover: string;
	accent: string;
	accentText: string;
	accentSoft: string;
	accentSofter: string;
	focus: string;
};
type VirtualFileFormatCategory =
	| "Document"
	| "Code"
	| "Data"
	| "Config"
	| "Academic"
	| "Business"
	| "Product"
	| "QA"
	| "Education"
	| "Design"
	| "Math"
	| "Science"
	| "Media"
	| "Other";
type VirtualFileFormat = {
	value: string;
	label: string;
	category: VirtualFileFormatCategory;
	aliases?: string[];
};
type VirtualFile = {
	id: string;
	name: string;
	format: string;
	content: string;
};

function resolveActivityColorTheme(stylePreset?: string): ActivityColorTheme {
	if (stylePreset === "classic") {
		return {
			surface: "#FFFDF8",
			surfaceAlt: "#FBF2E7",
			border: "#E4D0BC",
			borderStrong: "#D8B98F",
			text: "#2A1A0A",
			muted: "#6F5940",
			primary: "#2A1A0A",
			primaryHover: "#3A2410",
			accent: "#996633",
			accentText: "#7A4E28",
			accentSoft: "#F7EEE4",
			accentSofter: "#FFF8EF",
			focus: "#D8B98F",
		};
	}

	if (stylePreset === "plain") {
		return {
			surface: "#FFFFFF",
			surfaceAlt: "#F8FAFC",
			border: "#D0D7DE",
			borderStrong: "#93C5FD",
			text: "#111827",
			muted: "#4B5563",
			primary: "#2563EB",
			primaryHover: "#1D4ED8",
			accent: "#2563EB",
			accentText: "#1D4ED8",
			accentSoft: "#EFF6FF",
			accentSofter: "#F8FBFF",
			focus: "#93C5FD",
		};
	}

	return {
		surface: "#FFFFFF",
		surfaceAlt: "#FCFCFD",
		border: "#E5E5E7",
		borderStrong: "#86EFAC",
		text: "#1D1D1F",
		muted: "#6B7280",
		primary: "#1D1D1F",
		primaryHover: "#333333",
		accent: "#16A34A",
		accentText: "#15803D",
		accentSoft: "#DCFCE7",
		accentSofter: "#F0FDF4",
		focus: "#86EFAC",
	};
}

const VIRTUAL_FILE_MAX_FILES = 12;
const VIRTUAL_FILE_MAX_CHARS = 12_000;
const VIRTUAL_FILE_TOTAL_MAX_CHARS = 30_000;
const VIRTUAL_FILE_FORMATS: VirtualFileFormat[] = [
	{value: "txt", label: "Plain text", category: "Document"},
	{value: "md", label: "Markdown", category: "Document"},
	{value: "pdf_text", label: "PDF text", category: "Document", aliases: ["pdf"]},
	{value: "doc_text", label: "Document text", category: "Document", aliases: ["doc", "docx", "odt"]},
	{value: "slides", label: "Slide deck text", category: "Document", aliases: ["ppt", "pptx", "key"]},
	{value: "notes", label: "Notes", category: "Document"},
	{value: "outline", label: "Outline", category: "Document"},
	{value: "html", label: "HTML", category: "Code"},
	{value: "css", label: "CSS", category: "Code"},
	{value: "scss", label: "SCSS", category: "Code"},
	{value: "js", label: "JavaScript", category: "Code"},
	{value: "jsx", label: "JSX", category: "Code"},
	{value: "ts", label: "TypeScript", category: "Code"},
	{value: "tsx", label: "TSX", category: "Code"},
	{value: "vue", label: "Vue", category: "Code"},
	{value: "svelte", label: "Svelte", category: "Code"},
	{value: "astro", label: "Astro", category: "Code"},
	{value: "py", label: "Python", category: "Code"},
	{value: "ipynb", label: "Jupyter Notebook text", category: "Code"},
	{value: "java", label: "Java", category: "Code"},
	{value: "c", label: "C", category: "Code"},
	{value: "cpp", label: "C++", category: "Code", aliases: ["cc", "cxx", "hpp"]},
	{value: "cs", label: "C#", category: "Code"},
	{value: "go", label: "Go", category: "Code"},
	{value: "rs", label: "Rust", category: "Code"},
	{value: "php", label: "PHP", category: "Code"},
	{value: "rb", label: "Ruby", category: "Code"},
	{value: "swift", label: "Swift", category: "Code"},
	{value: "kt", label: "Kotlin", category: "Code", aliases: ["kts"]},
	{value: "dart", label: "Dart", category: "Code"},
	{value: "r", label: "R", category: "Code"},
	{value: "scala", label: "Scala", category: "Code"},
	{value: "lua", label: "Lua", category: "Code"},
	{value: "sh", label: "Shell", category: "Code", aliases: ["bash", "zsh"]},
	{value: "ps1", label: "PowerShell", category: "Code"},
	{value: "matlab", label: "MATLAB", category: "Code", aliases: ["m"]},
	{value: "jl", label: "Julia", category: "Code"},
	{value: "sol", label: "Solidity", category: "Code"},
	{value: "json", label: "JSON", category: "Data"},
	{value: "yaml", label: "YAML", category: "Data", aliases: ["yml"]},
	{value: "toml", label: "TOML", category: "Data"},
	{value: "xml", label: "XML", category: "Data"},
	{value: "csv", label: "CSV", category: "Data"},
	{value: "tsv", label: "TSV", category: "Data"},
	{value: "sql", label: "SQL", category: "Data"},
	{value: "graphql", label: "GraphQL", category: "Data", aliases: ["gql"]},
	{value: "prisma", label: "Prisma schema", category: "Data"},
	{value: "env", label: "Environment file", category: "Config"},
	{value: "dockerfile", label: "Dockerfile", category: "Config"},
	{value: "nginx", label: "Nginx config", category: "Config"},
	{value: "ini", label: "INI config", category: "Config"},
	{value: "report", label: "Report", category: "Academic"},
	{value: "essay", label: "Essay", category: "Academic"},
	{value: "case_analysis", label: "Case analysis", category: "Academic"},
	{value: "lab_report", label: "Lab report", category: "Academic"},
	{value: "research_notes", label: "Research notes", category: "Academic"},
	{value: "bibliography", label: "Bibliography", category: "Academic"},
	{value: "latex", label: "LaTeX", category: "Academic", aliases: ["tex"]},
	{value: "proposal", label: "Proposal", category: "Business"},
	{value: "business_plan", label: "Business plan", category: "Business"},
	{value: "marketing_plan", label: "Marketing plan", category: "Business"},
	{value: "financial_model", label: "Financial model notes", category: "Business"},
	{value: "requirements", label: "Requirements", category: "Product"},
	{value: "user_story", label: "User stories", category: "Product"},
	{value: "prd", label: "Product requirements doc", category: "Product"},
	{value: "test_plan", label: "Test plan", category: "QA"},
	{value: "bug_report", label: "Bug report", category: "QA"},
	{value: "lesson_plan", label: "Lesson plan", category: "Education"},
	{value: "rubric", label: "Rubric", category: "Education"},
	{value: "quiz", label: "Quiz content", category: "Education"},
	{value: "wireframe_notes", label: "Wireframe notes", category: "Design"},
	{value: "diagram", label: "Diagram description", category: "Design"},
	{value: "mermaid", label: "Mermaid diagram", category: "Design"},
	{value: "plantuml", label: "PlantUML", category: "Design"},
	{value: "svg", label: "SVG", category: "Design"},
	{value: "proof", label: "Math proof", category: "Math"},
	{value: "equations", label: "Equations", category: "Math"},
	{value: "experiment_plan", label: "Experiment plan", category: "Science"},
	{value: "data_analysis", label: "Data analysis", category: "Science"},
	{value: "script", label: "Script", category: "Media"},
	{value: "storyboard", label: "Storyboard", category: "Media"},
	{value: "transcript", label: "Transcript", category: "Media"},
	{value: "other", label: "Other", category: "Other"},
];
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

function asVirtualFiles(value: unknown): VirtualFile[] {
	return Array.isArray(value) ?
			value
				.map((item) =>
					item && typeof item === "object" && !Array.isArray(item) ?
						item as Record<string, unknown>
					:	null,
				)
				.filter((item): item is Record<string, unknown> => item !== null)
				.map((item, index) => ({
					id: asId(item.id, `virtual-file-${index + 1}`),
					name: asText(item.name),
					format: asText(item.format) || "txt",
					content: asText(item.content),
				}))
				.filter((file) => file.name.trim() && file.content.trim())
		:	[];
}

function getVirtualFileFormat(format: string): VirtualFileFormat {
	return (
		VIRTUAL_FILE_FORMATS.find((item) => item.value === format) ??
		VIRTUAL_FILE_FORMATS[VIRTUAL_FILE_FORMATS.length - 1]
	);
}

function inferVirtualFileFormat(name: string): string {
	const normalized = name.trim().toLowerCase();
	if (!normalized) return "txt";
	if (normalized === "dockerfile" || normalized.endsWith("/dockerfile")) {
		return "dockerfile";
	}
	const extension = normalized.split(".").pop() ?? "";
	const match = VIRTUAL_FILE_FORMATS.find(
		(format) =>
			format.value === extension ||
			format.aliases?.includes(extension),
	);
	return match?.value ?? "other";
}

function getVirtualFileTotalChars(files: VirtualFile[]): number {
	return files.reduce((total, file) => total + file.content.length, 0);
}

function createEmptyVirtualFile(): VirtualFile {
	return {
		id:
			typeof crypto !== "undefined" && "randomUUID" in crypto ?
				crypto.randomUUID()
			:	`virtual-file-${Date.now()}`,
		name: "",
		format: "txt",
		content: "",
	};
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

function activityTypeDescription(type: BackendLearningActivity["type"]): string {
	switch (type) {
		case "multiple_choice":
			return "A quick check is a short objective question designed to verify one concrete concept immediately. Choose the best answer and review the explanation after submitting.";
		case "short_answer":
			return "Open response questions ask you to explain concepts in your own words. They are evaluated by AI against the expected reasoning, not by exact wording.";
		case "coding_practice":
			return "Code practice focuses on writing or completing code. Submit a technical answer and get feedback about correctness, structure, and edge cases.";
		case "flashcards":
			return "Flashcards are an Anki-style review deck. Reveal each card, then mark it as learned or not yet so weaker cards keep appearing first.";
		case "matching":
			return "Matching asks you to connect related concepts, terms, or examples. It checks whether you can recognize relationships between items.";
		case "ordering":
			return "Ordering asks you to arrange items into the correct sequence. It is useful for workflows, processes, timelines, and dependency chains.";
		case "case_study":
			return "A case study gives you a specific scenario and a problem to solve. Analyze the situation, propose a solution, and receive AI feedback against the rubric.";
		case "debate_reflection":
			return "Debate reflection asks you to reason through a position, tradeoff, or argument. The goal is structured critical thinking, not one fixed answer.";
		case "cloze":
			return "Cloze exercises ask you to fill missing parts in a text. They test recall of precise terms, syntax, or concepts in context.";
		case "guided_project":
			return "A mini project asks you to produce a small deliverable. Add files as pasted text, then submit them for AI feedback against the project goal and rubric.";
		case "freeform_html":
			return "An interactive activity is a custom exercise rendered as structured interactive content for the current lesson.";
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

	useEffect(() => {
		void dashboardApi.getActivityProgress(activity.id).then(({progress}) => {
			if (!progress) return;
			setConfirmedAnswers(progress.confirmedAnswers);
			setCompleted(progress.completed);
			const answeredCount = Object.keys(progress.confirmedAnswers).length;
			if (answeredCount > 0 && !progress.completed) {
				setViewIndex(answeredCount); 
			}
		}).catch(() => {});
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
		}).catch(() => {});
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
			activeFeedback.score >= 90 ? "Good"
			: activeFeedback.score >= 50 ? "Almost there"
			: "wrong"
		:	undefined
	);
	const scoreClass =
		scoreLabel === "Perfect" || scoreLabel === "Good" ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]"
		: scoreLabel === "Almost there" ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
		:	"border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
	const scoreAccentClass =
		scoreLabel === "Perfect" || scoreLabel === "Good" ? "text-[#16A34A]"
		: scoreLabel === "Almost there" ? "text-[#D97706]"
		:	"text-[#DC2626]";
	const scoreText =
		scoreLabel === "wrong" ? "Wrong"
		: scoreLabel === "Perfect" ? "Good"
		:	scoreLabel;
	const ScoreIcon =
		scoreLabel === "Perfect" || scoreLabel === "Good" ? CheckCircle2
		: scoreLabel === "Almost there" ? CircleAlert
		:	XCircle;
	const detailTabButtonClass = (selected: boolean) =>
		cn(
			"-mb-px min-w-[96px] border border-b-2 px-4 py-3 text-center text-[12px] font-bold transition",
			selected ?
				"border-[var(--activity-border)] border-b-[var(--activity-border-strong)] bg-[var(--activity-surface)] text-[var(--activity-accent)]"
			:	"border-[var(--activity-border)] border-b-[var(--activity-border)] bg-[var(--activity-surface-alt)] text-[var(--activity-muted)] hover:border-[var(--activity-border-strong)] hover:border-b-[var(--activity-border-strong)] hover:bg-[var(--activity-accent-softer)] hover:text-[var(--activity-accent-text)]",
		);

	const visibleDetailTab = activeFeedback && detailTab === "correction" ? "correction" : "answer";

	if (items.length === 0) {
		return null;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex rounded-lg bg-[var(--activity-surface-alt)] p-1">
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
									"bg-[var(--activity-surface)] text-[var(--activity-text)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
								:	"text-[var(--activity-muted)] hover:text-[var(--activity-text)]",
							)}
						>
							Question {index + 1}
							{hasFeedback ? <span className="ml-1 text-[var(--activity-accent)]">✓</span> : null}
						</button>
					);
				})}
			</div>
			<div className="flex items-start gap-2.5 text-[14px] font-medium leading-relaxed text-[var(--activity-text)]">
				<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--activity-accent-softer)] text-[var(--activity-accent)]">
					<MessageCircleQuestionMark size={13} strokeWidth={2.25} />
				</span>
				<p>{asText(activePrompt?.prompt)}</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="flex items-end border-b border-[var(--activity-border)]">
					{(["answer", ...(activeFeedback ? ["correction" as const] : [])] as const).map((tab) => {
						const selected = visibleDetailTab === tab;
						return (
							<button
								key={tab}
								type="button"
								onClick={() => onDetailTabChange(tab)}
								className={detailTabButtonClass(selected)}
							>
								{tab === "answer" ? "Answer" : "Feedback"}
							</button>
						);
					})}
				</div>
				<div className="min-h-0 flex-1 rounded-b-[8px] border border-t-0 border-[var(--activity-border)] bg-[var(--activity-surface)] p-3 shadow-[0_10px_28px_rgba(17,24,39,0.03)]">
					{visibleDetailTab === "answer" ? (
						<textarea
							className="h-full min-h-[180px] w-full resize-none bg-transparent p-1 text-[14px] leading-relaxed text-[var(--activity-text)] outline-none placeholder:text-[#9CA3AF]"
							value={value}
							onChange={(event) => setAnswer(activeId, event.target.value)}
							placeholder="Write your answer..."
						/>
					) : activeFeedback ? (
						<div className="space-y-3 text-[12px] leading-relaxed text-[var(--activity-muted)]">
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
									className="mt-1 text-[var(--activity-text)]"
									html={activeFeedback.expectedAnswer || activeFeedback.feedback || ""}
								/>
							</div>
							<div>
								<div className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", scoreAccentClass)}>
									Why and how to improve
								</div>
								<FeedbackHtml
									className="mt-1 text-[var(--activity-muted)]"
									html={activeFeedback.improvementReason ||
										activeFeedback.improvements.join("; ") ||
										activeFeedback.feedback ||
										""}
								/>
							</div>
						</div>
					) : (
						<div className="flex h-full min-h-[180px] items-center justify-center text-center text-[12px] font-medium leading-relaxed text-[var(--activity-muted)]">
							Check your answers to see the feedback for this question.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function CaseStudyActivity({
	content,
	answers,
	setAnswer,
	latestAttempt,
	activeTab,
	onTabChange,
}: {
	content: Record<string, unknown>;
	answers: Answers;
	setAnswer: (key: string, value: unknown) => void;
	latestAttempt?: BackendLearningActivityAttempt;
	activeTab: "case" | "analysis" | "feedback";
	onTabChange: (tab: "case" | "analysis" | "feedback") => void;
}) {
	const scenario = asText(content.scenario) || asText(content.prompt);
	const questions = asArray(content.questions);
	const legacyProblem = asText(questions[0]?.prompt);
	const problem = asText(content.problem) || legacyProblem || asText(content.brief);
	const rubric = [
		...(Array.isArray(content.rubric) ? content.rubric.map(asText) : []),
		...(Array.isArray(questions[0]?.rubric) ?
			questions[0].rubric.map(asText)
		:	[]),
	].filter(Boolean);
	const response = asText(answers.response);
	const attemptRecord =
		latestAttempt as unknown as Record<string, unknown> | undefined;
	const legacyFeedback = parseLegacyFeedbackSections(latestAttempt?.feedback);
	const strengths = uniqueStrings([
		...asStringArray(attemptRecord?.strengths),
		...legacyFeedback.strengths,
	]);
	const improvements = uniqueStrings([
		...asStringArray(attemptRecord?.improvements),
		...legacyFeedback.improvements,
	]);
	const feedbackScore = latestAttempt?.score;
	const feedbackTone =
		feedbackScore === undefined ? "neutral"
		: feedbackScore >= 80 ? "good"
		: feedbackScore >= 50 ? "partial"
		:	"bad";
	const feedbackPanelClass =
		feedbackTone === "good" ?
			"border-[#BBF7D0] bg-[#F0FDF4] text-[#065F46]"
		: feedbackTone === "partial" ?
			"border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
		: feedbackTone === "bad" ?
			"border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
		:	"border-[#E5E5E7] bg-[#F8F8F9] text-[#374151]";
	const feedbackAccentClass =
		feedbackTone === "good" ? "text-[#15803D]"
		: feedbackTone === "partial" ? "text-[#D97706]"
		: feedbackTone === "bad" ? "text-[#DC2626]"
		:	"text-[#6E6E73]";
	const FeedbackIcon =
		feedbackTone === "good" ? CheckCircle2
		: feedbackTone === "partial" ? CircleAlert
		: feedbackTone === "bad" ? XCircle
		:	MessageSquareText;
	const tabButtonClass = (selected: boolean) =>
		cn(
			"-mb-px min-w-[112px] border border-b-2 px-4 py-3 text-center text-[12px] font-bold transition",
			selected ?
				"border-[var(--activity-border)] border-b-[var(--activity-border-strong)] bg-[var(--activity-surface)] text-[var(--activity-accent)]"
			:	"border-[var(--activity-border)] border-b-[var(--activity-border)] bg-[var(--activity-surface-alt)] text-[var(--activity-muted)] hover:border-[var(--activity-border-strong)] hover:border-b-[var(--activity-border-strong)] hover:bg-[var(--activity-accent-softer)] hover:text-[var(--activity-accent-text)]",
		);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex min-h-0 flex-1 flex-col">
				<div className="flex items-end border-b border-[var(--activity-border)]">
					{(["case", "analysis", ...(latestAttempt ? ["feedback" as const] : [])] as const).map((tab) => {
						const selected = activeTab === tab;
						return (
							<button
								key={tab}
								type="button"
								onClick={() => onTabChange(tab)}
								className={tabButtonClass(selected)}
							>
								{tab === "case" ? "Case" : tab === "analysis" ? "Analysis" : "Feedback"}
							</button>
						);
					})}
				</div>

				<div className="min-h-0 flex-1 rounded-b-[8px] border border-t-0 border-[var(--activity-border)] bg-[var(--activity-surface)] p-3 shadow-[0_10px_28px_rgba(17,24,39,0.03)]">
					{activeTab === "case" ? (
						<div className="grid h-full min-h-[260px] gap-3 overflow-y-auto pr-1">
							<section className="p-1">
								<div className="mb-2 flex items-center gap-2">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--activity-accent-soft)] text-[var(--activity-accent)]">
										<BookOpenCheck size={12} strokeWidth={2.25} />
									</span>
									<h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--activity-muted)]">
										Scenario
									</h4>
								</div>
								<p className="whitespace-pre-wrap text-[13px] leading-[1.6] text-[var(--activity-muted)]">
									{scenario}
								</p>
							</section>

							<section className="border-t border-[var(--activity-border)] p-1 pt-3">
								<div className="mb-2 flex items-center gap-2">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--activity-accent-softer)] text-[var(--activity-accent)]">
										<MessageCircleQuestionMark size={12} strokeWidth={2.25} />
									</span>
									<h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--activity-muted)]">
										Problem to solve
									</h4>
								</div>
								<p className="text-[13px] font-semibold leading-relaxed text-[var(--activity-text)]">
									{problem || "Resolve the case using the module concepts."}
								</p>
								{rubric.length > 0 && (
									<ul className="mt-2 grid gap-x-4 gap-y-1 text-[11.5px] leading-relaxed text-[var(--activity-muted)] sm:grid-cols-2">
										{rubric.slice(0, 4).map((item) => (
											<li key={item} className="flex gap-1.5">
												<span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-[var(--activity-accent)]" />
												<span>{item}</span>
											</li>
										))}
									</ul>
								)}
							</section>
						</div>
					) : activeTab === "analysis" ? (
						<textarea
							className="h-full min-h-[260px] w-full resize-none bg-transparent p-1 text-[14px] leading-relaxed text-[var(--activity-text)] outline-none placeholder:text-[#9CA3AF]"
							value={response}
							onChange={(event) => setAnswer("response", event.target.value)}
							placeholder="Write your analysis and proposed solution..."
						/>
					) : latestAttempt ? (
						<div className={cn("max-h-[360px] overflow-y-auto rounded-[10px] border p-3", feedbackPanelClass)}>
							<div className="flex items-center gap-2 text-[12px] font-bold">
								<FeedbackIcon size={14} />
								{latestAttempt.score !== undefined ?
									`Score: ${latestAttempt.score}%`
								:	"Feedback"}
							</div>
							<FeedbackHtml
								className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed"
								html={legacyFeedback.feedback}
							/>
							{strengths.length > 0 && (
								<div className="mt-3">
									<div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]", feedbackAccentClass)}>
										<Trophy size={13} />
										<span>Puntos fuertes</span>
									</div>
									<ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed">
										{strengths.map((strength) => (
											<li key={strength}>{strength}</li>
										))}
									</ul>
								</div>
							)}
							{improvements.length > 0 && (
								<div className="mt-3">
									<div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]", feedbackAccentClass)}>
										<CircleAlert size={13} />
										<span>Como mejorar</span>
									</div>
									<ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed">
										{improvements.map((improvement) => (
											<li key={improvement}>{improvement}</li>
										))}
									</ul>
								</div>
							)}
						</div>
					) : (
						<div className="flex h-full min-h-[260px] items-center justify-center text-center text-[12px] font-medium leading-relaxed text-[var(--activity-muted)]">
							Check your answer to see feedback.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function VirtualFileFormatIcon({format}: {format: string}) {
	const resolved = getVirtualFileFormat(format);
	const isCode = resolved.category === "Code";
	const isData = resolved.category === "Data" || resolved.category === "Config";
	const Icon =
		isCode ? Code2
		: isData ? FileText
		: resolved.category === "Design" ? Layers3
		:	FileText;

	return (
		<span
			className={cn(
				"flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold uppercase",
				isCode ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]"
				: isData ? "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]"
				:	"border-[#E5E5E7] bg-[#F5F5F7] text-[#6E6E73]",
			)}
			title={resolved.label}
		>
			<Icon size={13} />
		</span>
	);
}

function VirtualFileDialog({
	open,
	file,
	existingFiles,
	onOpenChange,
	onSave,
}: {
	open: boolean;
	file: VirtualFile | null;
	existingFiles: VirtualFile[];
	onOpenChange: (open: boolean) => void;
	onSave: (file: VirtualFile) => void;
}) {
	const [draft, setDraft] = useState<VirtualFile>(createEmptyVirtualFile);

	useEffect(() => {
		setDraft(file ?? createEmptyVirtualFile());
	}, [file, open]);

	const otherFiles = existingFiles.filter((item) => item.id !== draft.id);
	const totalCharsWithDraft =
		getVirtualFileTotalChars(otherFiles) + draft.content.length;
	const name = draft.name.trim();
	const content = draft.content.trim();
	const isOverFileLimit = draft.content.length > VIRTUAL_FILE_MAX_CHARS;
	const isOverTotalLimit = totalCharsWithDraft > VIRTUAL_FILE_TOTAL_MAX_CHARS;
	const canSave = !!name && !!content && !isOverFileLimit && !isOverTotalLimit;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[720px]">
				<DialogHeader>
					<DialogTitle>{file ? "Edit file" : "Add file"}</DialogTitle>
					<DialogDescription>
						Paste the content as text. It will be sent to the AI as part of the mini project submission.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 px-6 py-5">
					<div className="grid gap-3">
						<label className="grid gap-1.5">
							<span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6E6E73]">
								File name
							</span>
							<input
								className="h-10 rounded-[10px] border border-[#D1D5DB] bg-white px-3 text-[13px] text-[#1D1D1F] outline-none transition focus:border-[#1D1D1F] focus:ring-2 focus:ring-[#E5E5E7]"
								value={draft.name}
								onChange={(event) => {
									const nextName = event.target.value;
									setDraft((current) => ({
										...current,
										name: nextName,
										format: inferVirtualFileFormat(nextName),
									}));
								}}
								placeholder="DataList.tsx, report.md, analysis.csv..."
							/>
						</label>
					</div>

					<label className="grid gap-1.5">
						<span className="flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#6E6E73]">
							<span>Content</span>
							<span
								className={cn(
									"font-semibold tracking-normal",
									isOverFileLimit || isOverTotalLimit ?
										"text-[#DC2626]"
									:	"text-[#86868B]",
								)}
							>
								{draft.content.length.toLocaleString()} / {VIRTUAL_FILE_MAX_CHARS.toLocaleString()} chars
							</span>
						</span>
						<textarea
							className="min-h-[280px] resize-y rounded-[10px] border border-[#D1D5DB] bg-white p-3 font-mono text-[12px] leading-relaxed text-[#1D1D1F] outline-none transition placeholder:font-sans placeholder:text-[#9CA3AF] focus:border-[#1D1D1F] focus:ring-2 focus:ring-[#E5E5E7]"
							value={draft.content}
							onChange={(event) =>
								setDraft((current) => ({
									...current,
									content: event.target.value,
								}))
							}
							placeholder="Paste the file contents here..."
						/>
					</label>

					<div className="flex items-center justify-between gap-3 rounded-[10px] bg-[#F5F5F7] px-3 py-2 text-[12px] text-[#6E6E73]">
						<span>Total submission size</span>
						<span className={isOverTotalLimit ? "font-bold text-[#DC2626]" : "font-semibold"}>
							{totalCharsWithDraft.toLocaleString()} / {VIRTUAL_FILE_TOTAL_MAX_CHARS.toLocaleString()} chars
						</span>
					</div>
				</div>

				<DialogFooter>
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="rounded-full border border-[#D1D5DB] bg-white px-4 py-2 text-[13px] font-semibold text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={!canSave}
						onClick={() => {
							if (!canSave) return;
							onSave({
								...draft,
								name,
								content,
							});
							onOpenChange(false);
						}}
						className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#1D1D1F] disabled:cursor-not-allowed disabled:opacity-50"
					>
						Save file
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ActivityFeedbackPanel({
	attempt,
	className,
}: {
	attempt: BackendLearningActivityAttempt;
	className?: string;
}) {
	const legacyFeedback = parseLegacyFeedbackSections(attempt.feedback);
	const strengths = [
		...(attempt.strengths ?? []),
		...legacyFeedback.strengths,
	].map(cleanLegacyFeedbackItem).filter(Boolean);
	const improvements = [
		...(attempt.improvements ?? []),
		...legacyFeedback.improvements,
	].map(cleanLegacyFeedbackItem).filter(Boolean);
	const feedbackScore = attempt.score;
	const feedbackTone =
		feedbackScore === undefined ? "neutral"
		: feedbackScore >= 80 ? "good"
		: feedbackScore >= 50 ? "partial"
		:	"bad";
	const feedbackPanelClass =
		feedbackTone === "good" ?
			"border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
		: feedbackTone === "partial" ?
			"border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
		: feedbackTone === "bad" ?
			"border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"
		:	"border-[#E5E5E7] bg-[#FCFCFD] text-[#374151]";
	const feedbackAccentClass =
		feedbackTone === "good" ? "text-[#15803D]"
		: feedbackTone === "partial" ? "text-[#D97706]"
		: feedbackTone === "bad" ? "text-[#DC2626]"
		:	"text-[#6E6E73]";
	const FeedbackIcon =
		feedbackTone === "good" ? CheckCircle2
		: feedbackTone === "partial" ? CircleAlert
		: feedbackTone === "bad" ? XCircle
		:	MessageCircleQuestionMark;

	return (
		<div className={cn("rounded-[10px] border p-3", feedbackPanelClass, className)}>
			<div className="flex items-center gap-2 text-[12px] font-bold">
				<FeedbackIcon size={14} />
				{attempt.score !== undefined ? `Score: ${attempt.score}%` : "Feedback"}
			</div>
			<FeedbackHtml
				className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed"
				html={legacyFeedback.feedback}
			/>
			{strengths.length > 0 && (
				<div className="mt-3">
					<div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]", feedbackAccentClass)}>
						<Trophy size={13} />
						<span>Puntos fuertes</span>
					</div>
					<ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed">
						{strengths.map((strength) => (
							<li key={strength}>{strength}</li>
						))}
					</ul>
				</div>
			)}
			{improvements.length > 0 && (
				<div className="mt-3">
					<div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]", feedbackAccentClass)}>
						<CircleAlert size={13} />
						<span>Como mejorar</span>
					</div>
					<ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] leading-relaxed">
						{improvements.map((improvement) => (
							<li key={improvement}>{improvement}</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

function GuidedProjectActivity({
	content,
	answers,
	setAnswer,
	latestAttempt,
}: {
	content: Record<string, unknown>;
	answers: Answers;
	setAnswer: (key: string, value: unknown) => void;
	latestAttempt?: BackendLearningActivityAttempt;
}) {
	const goal =
		asText(content.goal) ||
		asText(content.expectedOutcome) ||
		"Build a small deliverable that applies the module concepts.";
	const brief = asText(content.brief) || asText(content.prompt);
	const steps = asStringArray(content.steps).map(stripLeadingListNumber);
	const deliverable =
		asText(content.deliverable) ||
		"Describe what you built, the main decisions you made, and anything you would improve.";
	const rubric = asStringArray(content.rubric);
	const virtualFiles = asVirtualFiles(answers.virtualFiles);
	const [fileDialogOpen, setFileDialogOpen] = useState(false);
	const [editingFile, setEditingFile] = useState<VirtualFile | null>(null);
	const [activeTab, setActiveTab] = useState<"project" | "files" | "feedback">("project");
	const latestAttemptId = latestAttempt?.id;
	const totalFileChars = getVirtualFileTotalChars(virtualFiles);
	const canAddFile =
		virtualFiles.length < VIRTUAL_FILE_MAX_FILES &&
		totalFileChars < VIRTUAL_FILE_TOTAL_MAX_CHARS;
	const updateVirtualFiles = (files: VirtualFile[]) => {
		setAnswer("virtualFiles", files);
	};
	const openNewFileDialog = () => {
		setEditingFile(null);
		setFileDialogOpen(true);
	};
	useEffect(() => {
		if (latestAttemptId) {
			setActiveTab("feedback");
		}
	}, [latestAttemptId]);
	const visibleTab = activeTab === "feedback" && !latestAttempt ? "files" : activeTab;
	const tabButtonClass = (selected: boolean) =>
		cn(
			"-mb-px border-b-2 px-4 py-2.5 text-[12px] font-bold transition",
			selected ?
				"border-[var(--activity-border-strong)] bg-[var(--activity-surface)] text-[var(--activity-accent)]"
			:	"border-transparent bg-[var(--activity-surface-alt)] text-[var(--activity-muted)] hover:bg-[var(--activity-accent-softer)] hover:text-[var(--activity-text)]",
		);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="flex shrink-0 border-b border-[#E5E5E7]">
				<button
					type="button"
					onClick={() => setActiveTab("project")}
					className={tabButtonClass(visibleTab === "project")}
				>
					Project
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("files")}
					className={tabButtonClass(visibleTab === "files")}
				>
					Files
				</button>
				{latestAttempt && (
					<button
						type="button"
						onClick={() => setActiveTab("feedback")}
						className={tabButtonClass(visibleTab === "feedback")}
					>
						Feedback
					</button>
				)}
			</div>

			{visibleTab === "project" && (
			<div className="min-h-0 overflow-y-auto pr-1">
				<div className="grid gap-3">
					<section className="rounded-[10px] border border-[var(--activity-border)] bg-[var(--activity-surface-alt)] p-3">
						<div className="mb-2 flex items-center gap-2">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--activity-accent-soft)] text-[var(--activity-accent)]">
								<Trophy size={12} strokeWidth={2.25} />
							</span>
							<h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--activity-muted)]">
								Goal
							</h4>
						</div>
						<p className="text-[13px] font-semibold leading-relaxed text-[var(--activity-text)]">
							{goal}
						</p>
						{brief && (
							<p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--activity-muted)]">
								{brief}
							</p>
						)}
					</section>

					{steps.length > 0 && (
						<section>
							<div className="mb-2 flex items-center gap-2">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--activity-accent-softer)] text-[var(--activity-accent)]">
									<ListChecks size={12} strokeWidth={2.25} />
								</span>
								<h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--activity-muted)]">
									Steps
								</h4>
							</div>
							<ol className="space-y-2">
								{steps.map((step, index) => (
									<li key={`${index}-${step}`} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[var(--activity-muted)]">
										<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--activity-border-strong)] bg-[var(--activity-surface)] text-[10px] font-bold text-[var(--activity-accent)]">
											{index + 1}
										</span>
										<span>{step}</span>
									</li>
								))}
							</ol>
						</section>
					)}

					<section className="border-t border-[var(--activity-border)] pt-3">
						<div className="mb-2 flex items-center gap-2">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--activity-accent-softer)] text-[var(--activity-accent)]">
								<CheckCircle2 size={12} strokeWidth={2.25} />
							</span>
							<h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--activity-muted)]">
								Deliverable
							</h4>
						</div>
						<p className="text-[12.5px] leading-[1.55] text-[var(--activity-muted)]">
							{deliverable}
						</p>
						{rubric.length > 0 && (
							<ul className="mt-2 grid gap-x-4 gap-y-1 text-[11.5px] leading-relaxed text-[var(--activity-muted)] sm:grid-cols-2">
								{rubric.slice(0, 4).map((item) => (
									<li key={item} className="flex gap-1.5">
										<span className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-[var(--activity-accent)]" />
										<span>{item}</span>
									</li>
								))}
							</ul>
						)}
					</section>
				</div>
			</div>
			)}

			{visibleTab === "files" && (
			<div className="rounded-[10px] border border-[var(--activity-border)] bg-[var(--activity-surface-alt)] p-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--activity-muted)]">
							Files
						</h4>
						<p className="mt-1 text-[12px] text-[var(--activity-muted)]">
							Paste source, documents, reports, diagrams, or notes as text.
						</p>
					</div>
					<button
						type="button"
						disabled={!canAddFile}
						onClick={openNewFileDialog}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--activity-primary)] px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-[var(--activity-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Plus size={13} />
						Add file
					</button>
				</div>

				{virtualFiles.length > 0 ? (
					<div className="mt-3 grid gap-2">
						{virtualFiles.map((file) => {
							const format = getVirtualFileFormat(file.format);
							return (
								<div
									key={file.id}
									className="flex min-h-12 items-center gap-3 rounded-[10px] border border-[var(--activity-border)] bg-[var(--activity-surface)] px-3 py-2.5 transition hover:border-[var(--activity-border-strong)]"
								>
									<VirtualFileFormatIcon format={file.format} />
									<div className="min-w-0 flex-1">
										<div className="truncate text-[13px] font-bold text-[var(--activity-text)]">
											{file.name}
										</div>
										<div className="mt-0.5 text-[11px] text-[var(--activity-muted)]">
											{format.label} - {file.content.length.toLocaleString()} chars
										</div>
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<button
											type="button"
											onClick={() => {
												setEditingFile(file);
												setFileDialogOpen(true);
											}}
											className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--activity-muted)] transition hover:bg-[var(--activity-accent-softer)] hover:text-[var(--activity-text)]"
											aria-label={`Edit ${file.name}`}
										>
											<Pencil size={13} />
										</button>
										<button
											type="button"
											onClick={() =>
												updateVirtualFiles(
													virtualFiles.filter((item) => item.id !== file.id),
												)
											}
											className="flex h-7 w-7 items-center justify-center rounded-md text-[#6E6E73] transition hover:bg-[#FEF2F2] hover:text-[#DC2626]"
											aria-label={`Remove ${file.name}`}
										>
											<Trash2 size={13} />
										</button>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="mt-3 rounded-[10px] border border-dashed border-[var(--activity-border)] bg-[var(--activity-surface)] px-3 py-4 text-center text-[12px] text-[var(--activity-muted)]">
						No files yet.
					</div>
				)}

				<div className="mt-2 flex justify-between gap-3 text-[11px] text-[var(--activity-muted)]">
					<span>
						{virtualFiles.length} / {VIRTUAL_FILE_MAX_FILES} files
					</span>
					<span>
						{totalFileChars.toLocaleString()} / {VIRTUAL_FILE_TOTAL_MAX_CHARS.toLocaleString()} chars
					</span>
				</div>
			</div>
			)}

			{visibleTab === "feedback" && latestAttempt && (
				<div className="min-h-0 overflow-y-auto pr-1">
					<ActivityFeedbackPanel attempt={latestAttempt} />
				</div>
			)}

			<VirtualFileDialog
				open={fileDialogOpen}
				file={editingFile}
				existingFiles={virtualFiles}
				onOpenChange={setFileDialogOpen}
				onSave={(file) => {
					const exists = virtualFiles.some((item) => item.id === file.id);
					updateVirtualFiles(
						exists ?
							virtualFiles.map((item) => item.id === file.id ? file : item)
						:	[...virtualFiles, file],
					);
				}}
			/>
		</div>
	);
}

type FlashcardProgress = {
	learnedIds: string[];
	queueIds: string[];
	revealedCardId?: string;
	revealed?: boolean;
};

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ?
			value
				.map((item) =>
					typeof item === "string" || typeof item === "number" ?
						String(item)
					:	"",
				)
				.filter(Boolean)
		:	[];
}

function uniqueStrings(values: string[]): string[] {
	return Array.from(
		new Set(values.map((value) => value.trim()).filter(Boolean)),
	);
}

function stripLeadingListNumber(value: string): string {
	return value.replace(/^\s*\d+[\).]\s+/, "").trim();
}

function cleanLegacyFeedbackItem(value: string): string {
	return value
		.replace(/\s+/g, " ")
		.replace(/\.;/g, ".")
		.replace(/;$/g, "")
		.trim();
}

function parseLegacyFeedbackSections(feedback: string | undefined): {
	feedback: string;
	strengths: string[];
	improvements: string[];
} {
	if (!feedback) {
		return {feedback: "", strengths: [], improvements: []};
	}

	const markers = [...feedback.matchAll(/(?:^|\n)\s*(Strengths|Improve):\s*/g)];
	if (markers.length === 0) {
		return {feedback, strengths: [], improvements: []};
	}

	const mainFeedback = feedback.slice(0, markers[0].index).trim();
	const sections = markers.map((marker, index) => {
		const start = (marker.index ?? 0) + marker[0].length;
		const end =
			index + 1 < markers.length ?
				markers[index + 1].index ?? feedback.length
			:	feedback.length;
		return {
			label: marker[1],
			text: feedback.slice(start, end).trim(),
		};
	});

	const splitItems = (text: string) =>
		text
			.split(/;\s*/)
			.map(cleanLegacyFeedbackItem)
			.filter(Boolean);

	return {
		feedback: mainFeedback || feedback.replace(/(?:^|\n)\s*(Strengths|Improve):[\s\S]*$/g, "").trim(),
		strengths: sections
			.filter((section) => section.label === "Strengths")
			.flatMap((section) => splitItems(section.text)),
		improvements: sections
			.filter((section) => section.label === "Improve")
			.flatMap((section) => splitItems(section.text)),
	};
}

function getSavedFlashcardProgress(
	answers: Record<string, unknown> | undefined,
): FlashcardProgress {
	const flashcards =
		answers?.flashcards &&
		typeof answers.flashcards === "object" &&
		!Array.isArray(answers.flashcards) ?
			(answers.flashcards as Record<string, unknown>)
		:	{};

	return {
		learnedIds: asStringArray(flashcards.learnedIds),
		queueIds: asStringArray(flashcards.queueIds),
		revealedCardId:
			typeof flashcards.revealedCardId === "string" ?
				flashcards.revealedCardId
			:	undefined,
		revealed: flashcards.revealed === true,
	};
}

function buildFlashcardQueue(input: {
	cardIds: string[];
	learnedIds: string[];
	queueIds: string[];
}): string[] {
	const cardIdSet = new Set(input.cardIds);
	const learnedSet = new Set(
		input.learnedIds.filter((id) => cardIdSet.has(id)),
	);
	const savedQueue = input.queueIds.filter((id) => cardIdSet.has(id));
	const missingIds = input.cardIds.filter((id) => !savedQueue.includes(id));
	const fullQueue = [...savedQueue, ...missingIds];
	const notLearned = fullQueue.filter((id) => !learnedSet.has(id));
	const learned = fullQueue.filter((id) => learnedSet.has(id));

	return [...notLearned, ...learned];
}

function FlashcardsActivity({activity}: {activity: BackendLearningActivity}) {
	const cards = useMemo(
		() =>
			asArray(activity.content.cards).map((card, index) => ({
				id: asId(card.id, `card${index + 1}`),
				front: asText(card.front),
				back: asText(card.back),
			})),
		[activity.content.cards],
	);
	const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
	const cardById = useMemo(
		() => new Map(cards.map((card) => [card.id, card])),
		[cards],
	);
	const [learnedIds, setLearnedIds] = useState<string[]>([]);
	const [queueIds, setQueueIds] = useState<string[]>(cardIds);
	const [revealedCardId, setRevealedCardId] = useState<string | undefined>();
	const [revealed, setRevealed] = useState(false);
	const [loadedActivityId, setLoadedActivityId] = useState<string | null>(null);
	const [copiedSide, setCopiedSide] = useState<"front" | "back" | null>(null);
	const flashcardFlip = useFlashcard({
		manualFlip: true,
		flipDirection: "rtl",
	});
	const {flip, resetCardState} = flashcardFlip;

	useEffect(() => {
		let mounted = true;

		void dashboardApi.getActivityProgress(activity.id).then(({progress}) => {
			if (!mounted) return;
			const saved = getSavedFlashcardProgress(progress?.answers);
			const nextQueue = buildFlashcardQueue({
				cardIds,
				learnedIds: saved.learnedIds,
				queueIds: saved.queueIds,
			});
			setLearnedIds(saved.learnedIds.filter((id) => cardIds.includes(id)));
			setQueueIds(nextQueue);
			setRevealedCardId(saved.revealedCardId);
			setRevealed(saved.revealed === true);
			setLoadedActivityId(activity.id);
		});

		return () => {
			mounted = false;
		};
	}, [activity.id, cardIds]);

	const persist = (next: FlashcardProgress) => {
		void dashboardApi.saveActivityProgress(activity.id, {
			confirmedAnswers: {},
			answers: {flashcards: next},
			completed: next.learnedIds.length >= cardIds.length && cardIds.length > 0,
		});
	};

	const visibleQueue = loadedActivityId === activity.id ? queueIds : cardIds;
	const visibleLearnedIds = loadedActivityId === activity.id ? learnedIds : [];
	const learnedSet = new Set(visibleLearnedIds);
	const nextCardId =
		visibleQueue.find((id) => !learnedSet.has(id)) ?? visibleQueue[0];
	const currentCard = nextCardId ? cardById.get(nextCardId) : undefined;
	const completed = cards.length > 0 && visibleLearnedIds.length >= cards.length;
	const isCurrentRevealed =
		revealed && revealedCardId === currentCard?.id && !completed;
	const currentQueuePosition = currentCard ?
		visibleQueue.findIndex((id) => id === currentCard.id) + 1
	:	0;

	useEffect(() => {
		resetCardState();
		if (isCurrentRevealed) {
			window.setTimeout(() => flip("back"), 0);
		}
	}, [currentCard?.id, flip, isCurrentRevealed, resetCardState]);

	const saveState = (next: FlashcardProgress) => {
		setLearnedIds(next.learnedIds);
		setQueueIds(next.queueIds);
		setRevealedCardId(next.revealedCardId);
		setRevealed(next.revealed === true);
		setLoadedActivityId(activity.id);
		persist(next);
	};

	const handleReveal = () => {
		if (!currentCard) return;
		flip("back");
		saveState({
			learnedIds: visibleLearnedIds,
			queueIds: visibleQueue,
			revealedCardId: currentCard.id,
			revealed: true,
		});
	};

	const handleHideBack = () => {
		if (!currentCard) return;
		flip("front");
		saveState({
			learnedIds: visibleLearnedIds,
			queueIds: visibleQueue,
			revealedCardId: currentCard.id,
			revealed: false,
		});
	};

	const handleCardClick = () => {
		if (isCurrentRevealed) {
			handleHideBack();
			return;
		}
		handleReveal();
	};

	const handleLearned = () => {
		if (!currentCard) return;
		resetCardState();
		const nextLearnedIds = Array.from(
			new Set([...visibleLearnedIds, currentCard.id]),
		).filter((id) => cardById.has(id));
		const nextLearnedSet = new Set(nextLearnedIds);
		const remaining = visibleQueue.filter(
			(id) => id !== currentCard.id && !nextLearnedSet.has(id),
		);
		const learnedQueue = visibleQueue.filter(
			(id) => id !== currentCard.id && nextLearnedSet.has(id),
		);
		const missingIds = cardIds.filter(
			(id) =>
				id !== currentCard.id &&
				!remaining.includes(id) &&
				!learnedQueue.includes(id) &&
				!nextLearnedSet.has(id),
		);
		saveState({
			learnedIds: nextLearnedIds,
			queueIds: [...remaining, ...missingIds, ...learnedQueue, currentCard.id],
			revealedCardId: undefined,
			revealed: false,
		});
	};

	const handleNotYet = () => {
		if (!currentCard) return;
		resetCardState();
		const nextLearnedIds = visibleLearnedIds.filter((id) => id !== currentCard.id);
		const nextLearnedSet = new Set(nextLearnedIds);
		const remaining = visibleQueue.filter(
			(id) => id !== currentCard.id && !nextLearnedSet.has(id),
		);
		const learnedQueue = visibleQueue.filter(
			(id) => id !== currentCard.id && nextLearnedSet.has(id),
		);
		saveState({
			learnedIds: nextLearnedIds,
			queueIds: [...remaining, currentCard.id, ...learnedQueue],
			revealedCardId: undefined,
			revealed: false,
		});
	};

	const handleReviewAgain = () => {
		resetCardState();
		saveState({
			learnedIds: [],
			queueIds: cardIds,
			revealedCardId: undefined,
			revealed: false,
		});
	};

	const handleCopyCardText = (
		event: MouseEvent<HTMLButtonElement>,
		side: "front" | "back",
		text: string | undefined,
	) => {
		event.preventDefault();
		event.stopPropagation();

		const value = text?.trim();
		if (!value) return;

		void navigator.clipboard.writeText(value).then(() => {
			setCopiedSide(side);
			window.setTimeout(() => {
				setCopiedSide((current) => (current === side ? null : current));
			}, 1200);
		});
	};

	if (cards.length === 0) {
		return (
			<div className="flex min-h-[220px] items-center justify-center rounded-lg border border-[#E8E8EA] bg-[#F9F9FB] text-sm font-medium text-[#6B7280]">
				No flashcards available yet.
			</div>
		);
	}

	if (completed) {
		return (
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<div className="flex h-[260px] w-full max-w-[560px] flex-col items-center justify-center rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-6 text-center shadow-[0_14px_34px_rgba(17,24,39,0.08)]">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
						<CheckCircle2 size={20} />
					</div>
					<h4 className="mt-3 text-[16px] font-bold text-[#166534]">
						Deck learned
					</h4>
					<p className="mt-1 max-w-[360px] text-[13px] leading-relaxed text-[#166534]">
						All {cards.length} flashcards are marked as learned.
					</p>
					<button
						type="button"
						onClick={handleReviewAgain}
						className="mt-5 rounded-md bg-[#16A34A] px-4 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#15803D]"
					>
						Review again
					</button>
				</div>
			</div>
		);
	}

	const cardStyle = {
		width: "100%",
		height: "260px",
		borderRadius: "10px",
		"--box-shadow": "0 14px 34px rgba(17, 24, 39, 0.08)",
		"--front-bg": "#FFFFFF",
		"--back-bg": "#F8FFF9",
	} as CSSProperties;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<div className="space-y-2">
				<div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-[#AEAEB2]">
					<span>{visibleLearnedIds.length} / {cards.length} learned</span>
					<span>{cards.length - visibleLearnedIds.length} remaining</span>
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-[#F0F0F2]">
					<div
						className="h-full rounded-full bg-[#16A34A] transition-all"
						style={{width: `${Math.round((visibleLearnedIds.length / cards.length) * 100)}%`}}
					/>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<div className="flex w-full flex-col items-center">
					<div className="mb-3 flex w-full max-w-[560px] items-center justify-between text-[11px] font-semibold text-[#86868B]">
						<span>Card {currentQueuePosition} of {cards.length}</span>
						<span>{isCurrentRevealed ? "Back side" : "Front side"}</span>
					</div>
						<div
							role="button"
							tabIndex={0}
							onClick={handleCardClick}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								handleCardClick();
							}
						}}
							className="w-full max-w-[560px] cursor-pointer rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[#86EFAC]"
							aria-label={isCurrentRevealed ? "Show card front" : "Reveal card back"}
						>
						<Flashcard
							flipHook={flashcardFlip}
							style={cardStyle}
							front={{
								html: (
									<div className="flex h-full flex-col justify-between p-5 text-left">
										<div className="flex items-center justify-between gap-3">
											<span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A1A1AA]">
												Front
											</span>
											<button
												type="button"
												onMouseDown={(event) => event.stopPropagation()}
												onClick={(event) =>
													handleCopyCardText(event, "front", currentCard?.front)
												}
												className="inline-flex items-center gap-1 rounded-md border border-[#E5E5E7] bg-white px-2 py-1 text-[10px] font-bold text-[#6E6E73] transition hover:border-[#BBF7D0] hover:text-[#16A34A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86EFAC]"
												aria-label="Copy front text"
											>
												<Copy size={12} />
												{copiedSide === "front" ? "Copied" : "Copy"}
											</button>
										</div>
										<div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-4 text-center">
											<p className="w-full max-w-[480px] whitespace-pre-wrap break-words text-[18px] font-semibold leading-relaxed text-[#1D1D1F]">
												{currentCard?.front}
											</p>
										</div>
										<span className="text-center text-[11px] font-medium text-[#AEAEB2]">
											Click the card or use the button to reveal the back.
										</span>
									</div>
								),
							}}
							back={{
								html: (
									<div className="flex h-full flex-col justify-between p-5 text-left">
										<div className="flex items-center justify-between gap-3">
											<span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
												Back
											</span>
											<button
												type="button"
												onMouseDown={(event) => event.stopPropagation()}
												onClick={(event) =>
													handleCopyCardText(event, "back", currentCard?.back)
												}
												className="inline-flex items-center gap-1 rounded-md border border-[#BBF7D0] bg-[#F8FFF9] px-2 py-1 text-[10px] font-bold text-[#15803D] transition hover:bg-[#F0FDF4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86EFAC]"
												aria-label="Copy back text"
											>
												<Copy size={12} />
												{copiedSide === "back" ? "Copied" : "Copy"}
											</button>
										</div>
										<div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-4 text-center">
											<p className="w-full max-w-[480px] whitespace-pre-wrap break-words text-[16px] leading-relaxed text-[#1D1D1F]">
												{currentCard?.back}
											</p>
										</div>
										<span className="text-center text-[11px] font-medium text-[#15803D]">
											Click the card again to see the front.
										</span>
									</div>
								),
							}}
						/>
					</div>
					{isCurrentRevealed ? (
						<div className="mt-5 grid w-full max-w-[560px] grid-cols-2 gap-2">
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									handleNotYet();
								}}
								className="rounded-md border border-[#FDBA74] bg-[#FFF7ED] px-3 py-1.5 text-[12px] font-bold text-[#C2410C] transition hover:bg-[#FFEDD5]"
							>
								Not yet
							</button>
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									handleLearned();
								}}
								className="rounded-md border border-[#16A34A] bg-[#16A34A] px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#15803D]"
							>
								Learned
							</button>
						</div>
					) : (
						<div className="mt-5 flex w-full max-w-[560px] justify-center">
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									handleReveal();
								}}
								className="rounded-md bg-[#1D1D1F] px-4 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#1F2937]"
							>
								Reveal answer
							</button>
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
	onDeleteActivity,
	stylePreset = "modern",
}: {
	activity: BackendLearningActivity;
	attempts: BackendLearningActivityAttempt[];
	isSubmitting: boolean;
	onSubmitAttempt: (activityId: string, answers: unknown) => Promise<void>;
	onRefillAttempts: (activityId: string) => Promise<void>;
	onDeleteActivity?: (activityId: string) => Promise<void>;
	stylePreset?: ActivityStylePresetId | string;
}) {
	const activityTheme = resolveActivityColorTheme(stylePreset);
	const [answers, setAnswers] = useState<Answers>({});
	const [shortAnswerDetailTab, setShortAnswerDetailTab] = useState<"answer" | "correction">("answer");
	const [caseStudyTab, setCaseStudyTab] = useState<"case" | "analysis" | "feedback">("case");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [isDeletingActivity, setIsDeletingActivity] = useState(false);
	const [shortAnswerProgressActivityId, setShortAnswerProgressActivityId] = useState<string | null>(null);
	const shortAnswerSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shortAnswerHasLocalChangesRef = useRef(false);
	const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const draftHasLocalChangesRef = useRef(false);
	const [draftProgressActivityId, setDraftProgressActivityId] = useState<string | null>(null);
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

	useEffect(() => {
		if (draftSaveTimerRef.current) {
			clearTimeout(draftSaveTimerRef.current);
			draftSaveTimerRef.current = null;
		}

		if (activity.type !== "case_study" && activity.type !== "guided_project") {
			return;
		}

		let mounted = true;
		draftHasLocalChangesRef.current = false;

		void dashboardApi.getActivityProgress(activity.id).then(({progress}) => {
			if (!mounted) return;
			if (draftHasLocalChangesRef.current) return;
			setAnswers(progress?.answers ?? {});
			setDraftProgressActivityId(activity.id);
		});

		return () => {
			mounted = false;
			if (draftSaveTimerRef.current) {
				clearTimeout(draftSaveTimerRef.current);
				draftSaveTimerRef.current = null;
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

	const scheduleDraftProgressSave = (nextAnswers: Answers, completed = false) => {
		if (activity.type !== "case_study" && activity.type !== "guided_project") return;
		if (draftSaveTimerRef.current) {
			clearTimeout(draftSaveTimerRef.current);
		}
		draftSaveTimerRef.current = setTimeout(() => {
			void dashboardApi.saveActivityProgress(activity.id, {
				confirmedAnswers: {},
				answers: nextAnswers,
				completed,
			});
			draftSaveTimerRef.current = null;
		}, 500);
	};

	const submitLabel = useMemo(() => {
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
		if (activity.type === "case_study" || activity.type === "guided_project") {
			draftHasLocalChangesRef.current = true;
			setDraftProgressActivityId(activity.id);
		}
		setAnswers((previous) => {
			const base =
				activity.type === "short_answer" && shortAnswerProgressActivityId !== activity.id ?
					{}
				: (activity.type === "case_study" || activity.type === "guided_project") && draftProgressActivityId !== activity.id ?
					{}
				:	previous;
			const next = {...base, [key]: value};
			scheduleShortAnswerProgressSave(next);
			scheduleDraftProgressSave(next);
			return next;
		});
	};

	const submitCurrentAnswers = () => {
		const currentAnswers =
			activity.type === "short_answer" && shortAnswerProgressActivityId !== activity.id ?
				{}
			: (activity.type === "case_study" || activity.type === "guided_project") && draftProgressActivityId !== activity.id ?
				{}
			:	answers;
		const payload = currentAnswers;
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
		if (activity.type === "case_study" || activity.type === "guided_project") {
			if (draftSaveTimerRef.current) {
				clearTimeout(draftSaveTimerRef.current);
				draftSaveTimerRef.current = null;
			}
			void dashboardApi.saveActivityProgress(activity.id, {
				confirmedAnswers: {},
				answers: currentAnswers,
				completed: true,
			});
			if (activity.type === "case_study") {
				setCaseStudyTab("feedback");
			}
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

	const handleDeleteActivity = async () => {
		if (!onDeleteActivity || isDeletingActivity) {
			return;
		}
		setIsDeletingActivity(true);
		try {
			await onDeleteActivity(activity.id);
			setDeleteDialogOpen(false);
		} finally {
			setIsDeletingActivity(false);
		}
	};

	const visibleAnswers =
		activity.type === "short_answer" && shortAnswerProgressActivityId !== activity.id ?
			{}
		: (activity.type === "case_study" || activity.type === "guided_project") && draftProgressActivityId !== activity.id ?
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
			return <FlashcardsActivity activity={activity} />;
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

		if (activity.type === "case_study") {
			return (
				<CaseStudyActivity
					content={content}
					answers={visibleAnswers}
					setAnswer={setAnswer}
					latestAttempt={latestAttempt}
					activeTab={caseStudyTab}
					onTabChange={setCaseStudyTab}
				/>
			);
		}

		if (activity.type === "guided_project") {
			return (
				<GuidedProjectActivity
					content={content}
					answers={visibleAnswers}
					setAnswer={setAnswer}
					latestAttempt={latestAttempt}
				/>
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
		<div
			className="group/activity flex h-full min-h-0 flex-col font-[Inter] text-[var(--activity-text)]"
			style={{
				backgroundColor: activityTheme.surface,
				color: activityTheme.text,
				"--activity-surface": activityTheme.surface,
				"--activity-surface-alt": activityTheme.surfaceAlt,
				"--activity-border": activityTheme.border,
				"--activity-border-strong": activityTheme.borderStrong,
				"--activity-text": activityTheme.text,
				"--activity-muted": activityTheme.muted,
				"--activity-primary": activityTheme.primary,
				"--activity-primary-hover": activityTheme.primaryHover,
				"--activity-accent": activityTheme.accent,
				"--activity-accent-text": activityTheme.accentText,
				"--activity-accent-soft": activityTheme.accentSoft,
				"--activity-accent-softer": activityTheme.accentSofter,
				"--activity-focus": activityTheme.focus,
			} as CSSProperties}
		>
			<div className="border-b border-[var(--activity-border)] pb-3">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--activity-primary)] text-white">
								<ActivityIcon type={activity.type} />
							</div>
							<span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--activity-muted)] opacity-70">
								{activityTypeLabel(activity.type)}
							</span>
							<HoverCard openDelay={150} closeDelay={100}>
								<HoverCardTrigger asChild>
									<button
										type="button"
										className="inline-flex items-center gap-1.5 rounded-full border border-[var(--activity-border-strong)] bg-[var(--activity-accent-softer)] px-2.5 py-1 text-[11px] font-bold text-[var(--activity-accent-text)] transition hover:bg-[var(--activity-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--activity-focus)]"
									>
										<MessageCircleQuestionMark size={12} />
										About
									</button>
								</HoverCardTrigger>
								<HoverCardContent align="start" side="bottom" sideOffset={8} className="w-[260px]">
									<div className="flex items-start gap-2.5">
										<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--activity-accent-softer)] text-[var(--activity-accent)]">
											<ActivityIcon type={activity.type} />
										</div>
										<div className="min-w-0">
											<h4 className="font-[Sora] text-[12.5px] font-bold text-[var(--activity-text)]">
												{activityTypeLabel(activity.type)}
											</h4>
											<p className="mt-1 text-[11.5px] leading-[1.55] text-[var(--activity-muted)]">
												{activityTypeDescription(activity.type)}
											</p>
										</div>
									</div>
								</HoverCardContent>
							</HoverCard>
						</div>
						<h3 className="mt-2 font-[Sora] text-[15.5px] font-bold leading-snug text-[var(--activity-text)]">
							{activity.title}
						</h3>
						{activity.type !== "short_answer" && (
							<p className="mt-1 text-[12px] leading-relaxed text-[var(--activity-muted)]">{activity.instructions}</p>
						)}
					</div>
					{onDeleteActivity && (
						<button
							type="button"
							onClick={() => setDeleteDialogOpen(true)}
							className="grid h-7 w-7 shrink-0 place-items-center rounded-full p-0 text-[#A1A1AA] opacity-0 transition hover:bg-[#FEF2F2] hover:text-[#DC2626] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#FCA5A5] group-hover/activity:opacity-100 group-focus-within/activity:opacity-100"
							aria-label={`Delete ${activity.title}`}
						>
							<Trash2 size={13} className="block" />
						</button>
					)}
				</div>
			</div>

			<div className="mt-3 flex min-h-0 flex-1 flex-col">
				{renderBody()}
			</div>

			{activity.type !== "multiple_choice" && activity.type !== "flashcards" && (
				<>
					{latestAttempt && activity.type !== "short_answer" && activity.type !== "case_study" && activity.type !== "guided_project" && (
						<ActivityFeedbackPanel
							attempt={latestAttempt}
							className="mt-3"
						/>
					)}

					<div className="mt-3 flex items-center justify-between gap-3 border-t border-[#F0F0F2] pt-3">
						{!isObjective && (
							<span className="group relative inline-flex items-center gap-1.5 text-[11px] text-[#AEAEB2]">
								<button
									type="button"
									className="flex h-4 w-4 cursor-help items-center justify-center text-[var(--activity-accent)] outline-none transition hover:text-[var(--activity-accent-text)] focus-visible:ring-2 focus-visible:ring-[var(--activity-focus)]"
									aria-describedby={`activity-attempts-tooltip-${activity.id}`}
									aria-label="AI feedback attempts"
								>
									<BadgeQuestionMark size={14} strokeWidth={2.25} />
								</button>
								<span>
									{remainingAttempts} {remainingAttempts === 1 ? "attempt" : "attempts"} left
								</span>
								<span
									id={`activity-attempts-tooltip-${activity.id}`}
									role="tooltip"
									className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-[220px] rounded-[6px] border border-[var(--activity-border-strong)] bg-[var(--activity-accent-softer)] px-3 py-2 text-[11px] font-medium leading-snug text-[var(--activity-accent-text)] opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.10)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
								>
									AI feedback uses 1 attempt. You get 3 attempts per paid feedback refill.
								</span>
							</span>
						)}
						<button
							type="button"
							disabled={!canSubmit}
							onClick={handleSubmit}
							className="ml-auto mr-8 inline-flex items-center gap-2 rounded-xl bg-[var(--activity-primary)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--activity-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
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
									You&apos;ve used all your feedback attempts for this activity. Use a coin to get 3 more attempts and keep practicing.
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
									className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--activity-primary)] px-4 text-[13px] font-semibold text-white transition hover:bg-[var(--activity-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
								>
									{isRefilling ? "Processing..." : <>Use <CoinAmount type={cost.coinType} amount={cost.amount} /></>}
								</button>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				);
			})()}

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete activity?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently delete this activity, its attempts, feedback, and saved progress. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingActivity}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeletingActivity}
							onClick={(event) => {
								event.preventDefault();
								void handleDeleteActivity();
							}}
							className="bg-[#DC2626] text-white hover:bg-[#B91C1C]"
						>
							{isDeletingActivity ? "Deleting..." : "Delete forever"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
