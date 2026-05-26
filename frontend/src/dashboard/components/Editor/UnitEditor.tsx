import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import confetti from "canvas-confetti";
import {
	AlertCircle,
	BookOpenCheck,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	CirclePlus,
	Code2,
	Download,
	Dumbbell,
	Edit3,
	FileQuestion,
	Layers3,
	History,
	Loader2,
	MoreHorizontal,
	Brain,
	Printer,
	PartyPopper,
	Undo2,
	RotateCcw,
	Settings,
	Share2,
	StickyNote,
	Trash2,
	WandSparkles,
	X,
} from "lucide-react";
import type {Editor} from "@tiptap/react";
import {AnimatePresence, motion as Motion} from "motion/react";
import {clsx} from "clsx";
import {twMerge} from "tailwind-merge";
import {toastError} from "@/hooks/use-toast";
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
import {Button} from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	DidactioWheelPicker,
	type WheelPickerOption,
} from "@/components/ui/wheel-picker";
import {useNavigate} from "react-router-dom";
import {
	type BackendDidacticUnitReadingProgressResponse,
	type BackendGenerationQuality,
	type BackendDidacticUnitNote,
	type BackendDidacticUnitNoteAnchor,
	type BackendDidacticUnitChapterDetail,
	type BackendGenerationRun,
	type BackendLearningActivity,
	type BackendLearningActivityAttempt,
	type BackendLearningActivityScope,
	type BackendLearningActivityType,
	DashboardApiError,
	dashboardApi,
	getDashboardErrorMessage,
} from "../../api/dashboardApi";
import {
	adaptDidacticUnitEditor,
	adaptDidacticUnitRevisions,
} from "../../adapters";
import {loadFonts} from "../../utils/fontLoader";
import {
	calculateSpreadMetrics,
	getReadTextOffsetForSpread,
	measurePages,
	type MeasuredModulePage,
} from "../../pageLayout";
import {TiptapHtmlEditor} from "./TiptapHtmlEditor";
import {ChapterRenderer} from "../Content/ChapterRenderer";
import {ChapterStyleMenu} from "./ChapterStyleMenu";
import {EditorToolbar} from "./EditorToolbar";
import {LearningActivityRenderer} from "../Activities/LearningActivityRenderer";
import type {
	EditorTextStyle,
	DidacticUnitEditorChapter,
	DidacticUnitEditorViewModel,
	DidacticUnitRevisionViewModel,
} from "../../types";
import {formatRelativeTimestamp} from "../../utils/topicMetadata";
import {
	normalizeHtmlForStorage,
	normalizeStoredHtml,
} from "../../utils/htmlContent";
import {getFolderEmoji} from "../../utils/folderDisplay";
import {useAuth} from "../../../auth/AuthProvider";
import {useAppearance} from "../../../theme/AppearanceProvider";
import {CoinAmount, CoinIcon} from "@/components/Coin";
import {
	getActivityGenerationCost,
	getModuleRegenerationCost,
} from "../../utils/coinPricing";
import {
	buildGenerationModelOptions,
	type GenerationModelOption,
} from "../../utils/modelOptions";
import {
	resolvePresentationTheme,
	themeVars,
} from "../../utils/themeVars";
import {
	buildActivitiesHtmlDocument,
	buildUnitExportSnapshot,
	downloadTextFile,
	sanitizeExportFilename,
	type UnitExportSnapshot,
} from "../../export/unitExport";
import type {PresentationTheme} from "../../../types/presentationTheme";
import {
	FONT_CATALOG,
	STYLE_PRESETS,
	resolveBodyLineHeight,
	type FontId,
} from "../../utils/typography";
import {UnitExportPrintView} from "./UnitExportPrintView";
import {
	applyNoteMarksToPageHtml,
	buildNoteAnchorFromSelection,
	getValidUnitNotesForChapter,
} from "../../utils/unitNotes";

const VISIBLE_COIN_TYPES = ["bronze", "silver", "gold"] as const;
const EDITOR_GUIDE_STORAGE_KEY = "didactio.editor.guide.v1";

function HeaderCoinBalance({
	credits,
	onOpenSubscription,
}: {
	credits: Record<(typeof VISIBLE_COIN_TYPES)[number], number>;
	onOpenSubscription: () => void;
}) {
	return (
		<div
			className="flex shrink-0 items-center gap-2 rounded-full border border-[#E5E5E7] bg-white px-3 py-1.5"
			aria-label="Available credits"
			title="Available credits"
		>
			{VISIBLE_COIN_TYPES.map((coinType) => (
				<span
					key={coinType}
					className="inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums text-[#3A3A3C]"
				>
					<span>{credits[coinType]}</span>
					<CoinIcon type={coinType} size={18} />
				</span>
			))}
			<button
				aria-label="Open subscription and credits"
				className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#1D1D1F] transition-all hover:bg-[#F7FFF9] hover:text-[#34C759] active:text-[#34C759]"
				onClick={onOpenSubscription}
				title="Open subscription and credits"
				type="button"
			>
				<CirclePlus size={14} />
			</button>
		</div>
	);
}

function HeaderControlTooltip({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	return (
		<div className="group/header-control relative shrink-0">
			{children}
			<div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[80] -translate-x-1/2 whitespace-nowrap rounded-md border border-[#E5E5E7] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1D1D1F] opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-opacity group-hover/header-control:opacity-100 group-focus-within/header-control:opacity-100">
				{label}
			</div>
		</div>
	);
}

function EditorFirstRunGuide({
	open,
	onOpenChange,
	isMobile,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isMobile: boolean;
}) {
	const steps = useMemo(
		() =>
			isMobile ?
				[
					{
						selector: "[data-editor-tour='mobile-content']",
						title: "Read the module",
						description:
							"This is the current module content. Scroll naturally and use the tabs below when you need another tool.",
					},
					{
						selector: "[data-editor-tour='mobile-nav']",
						title: "Switch sections",
						description:
							"Use these tabs to move between modules, content, exercises, and settings.",
					},
					{
						selector: "[data-editor-tour='mobile-actions']",
						title: "Module actions",
						description:
							"Open notes, version history, regenerate the module, or change the reading style from here.",
					},
					{
						selector: "[data-editor-tour='mobile-exercises-tab']",
						title: "Practice",
						description:
							"Create exercises for the module and review your attempts from the Exercises tab.",
					},
				]
			:	[
					{
						selector: "[data-editor-tour='modules']",
						title: "Module outline",
						description:
							"Use the sidebar to jump between modules and sections. Progress is tracked as you read.",
					},
					{
						selector: "[data-editor-tour='content']",
						title: "Learning pages",
						description:
							"This sheet is the generated lesson. Select text to create notes or ask AI for help.",
					},
					{
						selector: "[data-editor-tour='page-controls']",
						title: "Page controls",
						description:
							"Move through pages here. The page picker also lets you jump directly to another page.",
					},
					{
						selector: "[data-editor-tour='header-actions']",
						title: "Tools",
						description:
							"Use these controls for notes, version history, regeneration, reading style, and editing.",
					},
					{
						selector: "[data-editor-tour='sidebar-actions']",
						title: "Unit actions",
						description:
							"Return to the dashboard, export the unit, reopen this tutorial, or go to settings.",
					},
				],
		[isMobile],
	);
	const [stepIndex, setStepIndex] = useState(0);
	const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
	const cardRef = useRef<HTMLDivElement | null>(null);
	const [cardSize, setCardSize] = useState({height: 196, width: 320});
	const activeStep = steps[Math.min(stepIndex, steps.length - 1)];

	useEffect(() => {
		if (!open) {
			return;
		}

		setStepIndex(0);
	}, [open, isMobile]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const updateTargetRect = () => {
			const element = document.querySelector(activeStep.selector);
			setTargetRect(element?.getBoundingClientRect() ?? null);
			const card = cardRef.current;
			if (card) {
				setCardSize({
					height: card.offsetHeight,
					width: card.offsetWidth,
				});
			}
		};

		updateTargetRect();
		window.addEventListener("resize", updateTargetRect);
		window.addEventListener("scroll", updateTargetRect, true);
		return () => {
			window.removeEventListener("resize", updateTargetRect);
			window.removeEventListener("scroll", updateTargetRect, true);
		};
	}, [activeStep.selector, open]);

	if (!open) {
		return null;
	}

	const fallbackRect = {
		bottom: window.innerHeight / 2 + 80,
		height: 160,
		left: 24,
		right: window.innerWidth - 24,
		top: window.innerHeight / 2 - 80,
		width: window.innerWidth - 48,
	} as DOMRect;
	const rect = targetRect ?? fallbackRect;
	const padding = 8;
	const spotlightStyle: CSSProperties = {
		height: rect.height + padding * 2,
		left: rect.left - padding,
		top: rect.top - padding,
		width: rect.width + padding * 2,
	};
	const viewportMargin = 16;
	const tooltipGap = 18;
	const target = {
		bottom: rect.bottom + padding,
		left: rect.left - padding,
		right: rect.right + padding,
		top: rect.top - padding,
	};
	const positions = [
		{
			fits: target.bottom + tooltipGap + cardSize.height <= window.innerHeight - viewportMargin,
			left: Math.min(
				Math.max(viewportMargin, target.left),
				window.innerWidth - cardSize.width - viewportMargin,
			),
			top: target.bottom + tooltipGap,
		},
		{
			fits: target.top - tooltipGap - cardSize.height >= viewportMargin,
			left: Math.min(
				Math.max(viewportMargin, target.left),
				window.innerWidth - cardSize.width - viewportMargin,
			),
			top: target.top - tooltipGap - cardSize.height,
		},
		{
			fits: target.right + tooltipGap + cardSize.width <= window.innerWidth - viewportMargin,
			left: target.right + tooltipGap,
			top: Math.min(
				Math.max(viewportMargin, target.top),
				window.innerHeight - cardSize.height - viewportMargin,
			),
		},
		{
			fits: target.left - tooltipGap - cardSize.width >= viewportMargin,
			left: target.left - tooltipGap - cardSize.width,
			top: Math.min(
				Math.max(viewportMargin, target.top),
				window.innerHeight - cardSize.height - viewportMargin,
			),
		},
	];
	const cardPosition =
		positions.find((position) => position.fits) ??
		{
			left: viewportMargin,
			top: Math.max(
				viewportMargin,
				Math.min(window.innerHeight - cardSize.height - viewportMargin, target.top),
			),
		};
	const isLastStep = stepIndex === steps.length - 1;
	const closeGuide = () => onOpenChange(false);

	return (
		<div className="fixed inset-0 z-[90]">
			<div
				className="pointer-events-none absolute rounded-[22px] border-2 border-[#4ADE80] bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_18px_70px_rgba(0,0,0,0.35)] transition-all duration-200"
				style={spotlightStyle}
			/>
			<div
				ref={cardRef}
				className="app-editor-guide-dialog absolute w-[min(320px,calc(100vw-32px))] rounded-[18px] border border-[#E5E5E7] bg-white p-4 shadow-[0_24px_70px_rgba(0,0,0,0.26)]"
				style={{left: cardPosition.left, top: cardPosition.top}}
			>
				<button
					aria-label="Close tutorial"
					className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[#86868B] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
					onClick={closeGuide}
					type="button"
				>
					<X size={14} />
				</button>
				<div className="pr-8">
					<div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
						Editor guide
					</div>
					<h2 className="mt-2 text-[18px] font-bold tracking-tight text-[#0F0F12]">
						{activeStep.title}
					</h2>
					<p className="mt-2 text-[13px] leading-relaxed text-[#6B7280]">
						{activeStep.description}
					</p>
				</div>
				<div className="mt-4 flex items-center justify-between gap-3">
					<div className="flex items-center gap-1.5">
						{steps.map((step, index) => (
							<span
								key={step.title}
								className={cn(
									"h-1.5 rounded-full transition-all",
									index === stepIndex ?
										"w-5 bg-[#16A34A]"
									:	"w-1.5 bg-[#D1D5DB]",
								)}
							/>
						))}
					</div>
					<div className="flex items-center gap-2">
						<button
							className="rounded-full px-3 py-2 text-[12px] font-bold text-[#6B7280] transition hover:bg-[#F5F5F7] disabled:opacity-40"
							disabled={stepIndex === 0}
							onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
							type="button"
						>
							Back
						</button>
						<button
							className="rounded-full bg-[#0F0F12] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#2A2A2D]"
							onClick={() => {
								if (isLastStep) {
									closeGuide();
									return;
								}
								setStepIndex((value) => value + 1);
							}}
							type="button"
						>
							{isLastStep ? "Done" : "Next"}
						</button>
					</div>
				</div>
				<button
					className="mt-3 text-[12px] font-bold text-[#86868B] transition hover:text-[#1D1D1F]"
					onClick={closeGuide}
					type="button"
				>
					Skip tutorial
				</button>
			</div>
		</div>
	);
}

function ChapterStatusIcon({
	status,
	isCompleted,
	isGenerating,
	progress,
}: {
	status: "pending" | "ready" | "failed";
	isCompleted: boolean;
	isGenerating: boolean;
	progress: number;
}) {
	const S = 14;
	const SW = 1.5;
	const r = S / 2 - SW / 2; // 6.25
	const circ = 2 * Math.PI * r; // ≈ 39.27
	const cx = S / 2;
	const cy = S / 2;

	if (isGenerating) {
		return (
			<svg
				width={S}
				height={S}
				viewBox={`0 0 ${S} ${S}`}
				className="animate-spin"
				aria-hidden
			>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#E5E5E7"
					strokeWidth={SW}
				/>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#4ADE80"
					strokeWidth={SW}
					strokeDasharray={`${circ * 0.28} ${circ * 0.72}`}
					strokeLinecap="round"
					transform={`rotate(-90 ${cx} ${cy})`}
				/>
			</svg>
		);
	}

	if (status === "failed") {
		return (
			<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#F87171"
					strokeWidth={SW}
				/>
				<line
					x1="4.8"
					y1="4.8"
					x2="9.2"
					y2="9.2"
					stroke="#F87171"
					strokeWidth={SW}
					strokeLinecap="round"
				/>
				<line
					x1="9.2"
					y1="4.8"
					x2="4.8"
					y2="9.2"
					stroke="#F87171"
					strokeWidth={SW}
					strokeLinecap="round"
				/>
			</svg>
		);
	}

	if (status === "pending") {
		return (
			<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#C7C7CC"
					strokeWidth={SW}
					strokeDasharray="2.5 2.2"
				/>
			</svg>
		);
	}

	if (isCompleted) {
		return (
			<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#4ADE80"
					strokeWidth={SW}
				/>
				<path
					d="M4 7.3L6.1 9.4L10 5.2"
					fill="none"
					stroke="#4ADE80"
					strokeWidth={SW}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	}

	return (
		<svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
			<circle
				cx={cx}
				cy={cy}
				r={r}
				fill="none"
				stroke="#C7C7CC"
				strokeWidth={SW}
			/>
			{progress > 0 && (
				<circle
					cx={cx}
					cy={cy}
					r={r}
					fill="none"
					stroke="#4ADE80"
					strokeWidth={SW}
					strokeDasharray={`${circ * Math.min(progress, 1)} ${circ}`}
					strokeLinecap="round"
					transform={`rotate(-90 ${cx} ${cy})`}
				/>
			)}
		</svg>
	);
}

type UnitEditorProps = {
	didacticUnitId: string;
	onDataChanged: () => void;
};

type ChapterDraft = {
	chapterIndex: number;
	title: string;
	htmlDraft: string;
	textStyle: EditorTextStyle;
};

type PendingNoteSelection = {
	chapterIndex: number;
	selectedText: string;
	anchor: BackendDidacticUnitNoteAnchor;
	x: number;
	y: number;
};

function cn(...inputs: Array<string | false | null | undefined>) {
	return twMerge(clsx(inputs));
}

const STREAMING_HTML_FLUSH_MS = 350;

function isMeasuredContentPage(
	page: {kind: string},
): page is Extract<
	MeasuredModulePage,
	{kind: "content" | "content_with_actions"}
> {
	return page.kind === "content" || page.kind === "content_with_actions";
}

type ModuleOutlineItem = {
	id: string;
	kind: "section" | "activity";
	icon?: typeof FileQuestion;
	level: 2 | 3;
	number: string;
	pageIndex: number;
	parentId?: string;
	title: string;
};

function parseHeadingFromHtml(
	html: string,
): {level: 2 | 3 | 4; title: string} | null {
	const parser = new DOMParser();
	const document = parser.parseFromString(html, "text/html");
	const heading = document.body.firstElementChild;

	if (!(heading instanceof HTMLElement)) {
		return null;
	}

	const tagName = heading.tagName.toUpperCase();
	if (tagName !== "H2" && tagName !== "H3" && tagName !== "H4") {
		return null;
	}

	const level =
		tagName === "H2" ? 2
		: tagName === "H3" ? 3
		: 4;
	const title = (heading.textContent ?? "").replace(/\s+/g, " ").trim();

	if (!title) {
		return null;
	}

	return {level, title};
}

function stripLeadingHeadingNumber(title: string): string {
	return title
		.replace(/^\s*\d+(?:\.\d+)+(?:[.)])?\s+/, "")
		.replace(/^\s*\d+[.)]\s+/, "")
		.trim();
}

function findMeasuredPageIndexForOffset(
	pages: MeasuredModulePage[],
	characterOffset: number,
): number {
	const exactIndex = pages.findIndex(
		(page) =>
			isMeasuredContentPage(page) &&
			characterOffset >= page.startCharacterOffset &&
			characterOffset < page.endCharacterOffset,
	);

	if (exactIndex >= 0) {
		return exactIndex;
	}

	const fallbackIndex = pages.findIndex(
		(page) =>
			isMeasuredContentPage(page) &&
			characterOffset <= page.endCharacterOffset,
	);

	return Math.max(0, fallbackIndex);
}

function buildModuleOutline(
	chapter: DidacticUnitEditorChapter,
	pages: MeasuredModulePage[],
): ModuleOutlineItem[] {
	if (chapter.status !== "ready" || pages.length === 0) {
		return [];
	}

	let section = 0;
	let subsection = 0;
	let currentSectionId: string | null = null;

	return chapter.htmlBlocks.flatMap((block): ModuleOutlineItem[] => {
		if (block.type !== "heading") {
			return [];
		}

		const heading = parseHeadingFromHtml(block.html);
		if (!heading || heading.level === 4) {
			return [];
		}

		if (heading.level === 2) {
			section += 1;
			subsection = 0;
			currentSectionId = block.id;
		} else {
			if (section === 0) {
				section = 1;
			}
			subsection += 1;
		}

		const number =
			heading.level === 2 ? `${section}` : `${section}.${subsection}`;
		const title = stripLeadingHeadingNumber(heading.title);

		return [
			{
				id: block.id,
				kind: "section",
				level: heading.level,
				number,
				pageIndex: findMeasuredPageIndexForOffset(
					pages,
					block.textStartOffset,
				),
				parentId: heading.level === 3 ? currentSectionId ?? undefined : undefined,
				title: title || heading.title,
			},
		];
	});
}

function activityTypeOutlineLabel(type: BackendLearningActivityType): string {
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

function activityTypeOutlineIcon(
	type: BackendLearningActivityType,
): typeof FileQuestion {
	switch (type) {
		case "multiple_choice":
			return FileQuestion;
		case "short_answer":
			return BookOpenCheck;
		case "coding_practice":
			return Code2;
		case "flashcards":
			return Layers3;
		case "matching":
		case "ordering":
		case "case_study":
			return Edit3;
		case "debate_reflection":
		case "cloze":
		case "guided_project":
		case "freeform_html":
			return WandSparkles;
	}
}

function buildActivityOutlineItems(
	pages: ReadPage[],
): ModuleOutlineItem[] {
	return pages.flatMap((page, pageIndex): ModuleOutlineItem[] =>
		page.kind === "learning_activity" ?
			[
				{
					id: `activity-${page.activity.id}`,
					kind: "activity",
					icon: activityTypeOutlineIcon(page.activity.type),
					level: 2,
					number: "Ex.",
					pageIndex,
					title: activityTypeOutlineLabel(page.activity.type),
				},
			]
		:	[],
	);
}

function findLearningActivityPageIndex(
	pages: ReadPage[],
	activityId: string,
): number {
	return pages.findIndex(
		(page) =>
			page.kind === "learning_activity" && page.activity.id === activityId,
	);
}

function buildReadPages(
	measuredPages: MeasuredModulePage[],
	activities: BackendLearningActivity[],
): ReadPage[] {
	if (activities.length === 0) {
		return measuredPages;
	}

	const activityPages = activities.map((activity) => ({
		kind: "learning_activity" as const,
		activity,
	}));

	const postModuleIndex = measuredPages.findIndex(
		(page) =>
			page.kind === "post_module_actions" ||
			page.kind === "content_with_actions",
	);

	if (postModuleIndex !== -1) {
		const modulePage = measuredPages[postModuleIndex];

		if (modulePage.kind === "content_with_actions") {
			const contentOnly = {
				...modulePage,
				kind: "content" as const,
			};
			const postModulePage = {
				kind: "post_module_actions" as const,
				startCharacterOffset: modulePage.startCharacterOffset,
				endCharacterOffset: modulePage.endCharacterOffset,
				hasNextModule: modulePage.hasNextModule,
				primaryActionLabel: modulePage.primaryActionLabel,
			};
			return [
				...measuredPages.slice(0, postModuleIndex),
				contentOnly,
				...activityPages,
				postModulePage,
			];
		}

		return [
			...measuredPages.slice(0, postModuleIndex),
			...activityPages,
			...measuredPages.slice(postModuleIndex),
		];
	}

	return [...measuredPages, ...activityPages];
}

function calculateUnitStudyProgressPercent(
	chapters: DidacticUnitEditorChapter[],
	input: {
		chapterIndex: number;
		readBlockIndex: number;
		totalBlocks: number;
		isCompleted?: boolean;
	},
): number {
	const totals = chapters.reduce(
		(result, chapter) => {
			const readBlockCount =
				chapter.chapterIndex === input.chapterIndex ?
					(input.isCompleted ?
						input.totalBlocks
					:	input.totalBlocks > 0 ?
						Math.max(chapter.readBlockIndex, input.readBlockIndex) + 1
					:	0)
				:	chapter.isCompleted ?
					chapter.totalBlocks
				:	chapter.totalBlocks > 0 ?
					chapter.readBlockIndex + 1
				:	0;
			const totalBlocks =
				chapter.chapterIndex === input.chapterIndex ?
					input.totalBlocks
				:	chapter.totalBlocks;

			return {
				readBlockCount: result.readBlockCount + readBlockCount,
				totalBlocks: result.totalBlocks + totalBlocks,
			};
		},
		{
			readBlockCount: 0,
			totalBlocks: 0,
		},
	);

	if (totals.totalBlocks === 0) {
		return 0;
	}

	return Math.round(
		(totals.readBlockCount / totals.totalBlocks) * 100,
	);
}

function buildDraft(
	chapter: DidacticUnitEditorChapter,
	detail: BackendDidacticUnitChapterDetail | undefined,
): ChapterDraft {
	return {
		chapterIndex: chapter.chapterIndex,
		title: detail?.title ?? chapter.title,
		htmlDraft: normalizeStoredHtml(
			detail?.html ?? chapter.html,
		),
		textStyle: chapter.textStyle,
	};
}

const EDITOR_TEXT_SIZE_PREFERENCE_STORAGE_KEY =
	"didactio:editor-text-size-preferences";

function readEditorTextSizePreferences(): Record<string, true> {
	if (typeof window === "undefined") {
		return {};
	}

	try {
		const parsed = JSON.parse(
			window.localStorage.getItem(
				EDITOR_TEXT_SIZE_PREFERENCE_STORAGE_KEY,
			) ?? "{}",
		);
		return parsed && typeof parsed === "object" ?
				(parsed as Record<string, true>)
			:	{};
	} catch {
		return {};
	}
}

function hasEditorTextSizePreference(didacticUnitId: string): boolean {
	return readEditorTextSizePreferences()[didacticUnitId] === true;
}

function markEditorTextSizePreference(didacticUnitId: string): void {
	if (typeof window === "undefined") {
		return;
	}

	const preferences = readEditorTextSizePreferences();
	preferences[didacticUnitId] = true;
	window.localStorage.setItem(
		EDITOR_TEXT_SIZE_PREFERENCE_STORAGE_KEY,
		JSON.stringify(preferences),
	);
}

function applyCompactDesktopDefaultTextStyle(
	textStyle: EditorTextStyle,
	useCompactDefault: boolean,
): EditorTextStyle {
	if (!useCompactDefault || textStyle.sizeProfile !== "regular") {
		return textStyle;
	}

	return {...textStyle, sizeProfile: "small"};
}

function getInitialEditorChapterIndex(
	workspace: DidacticUnitEditorViewModel,
): number {
	const chapters = workspace.chapters;
	if (chapters.length === 0) {
		return 0;
	}

	const firstIncompleteReady = chapters.find(
		(chapter) => chapter.status === "ready" && !chapter.isCompleted,
	);
	if (firstIncompleteReady) {
		return firstIncompleteReady.chapterIndex;
	}

	const lastReady = [...chapters]
		.reverse()
		.find((chapter) => chapter.status === "ready");
	return lastReady?.chapterIndex ?? chapters[0].chapterIndex;
}

const FONT_ID_TO_PRESENTATION: Partial<
	Record<FontId, PresentationTheme["bodyFont"]>
> = {
	ebGaramond: "eb-garamond",
	crimsonPro: "crimson-pro",
	dmSans: "dm-sans",
};

function fontIdToPresFont(id: FontId): PresentationTheme["bodyFont"] {
	return (
		FONT_ID_TO_PRESENTATION[id] ??
		(id as unknown as PresentationTheme["bodyFont"])
	);
}

function themeFromTextStyle(
	_currentTheme: PresentationTheme,
	settings: EditorTextStyle,
): PresentationTheme {
	const presetId = settings.stylePreset ?? "classic";
	const preset = STYLE_PRESETS[presetId];
	return {
		stylePreset: presetId,
		bodyFont: fontIdToPresFont(preset.body),
		headingFont: fontIdToPresFont(preset.heading),
		bodyFontSize: settings.sizeProfile,
		lineHeight: resolveBodyLineHeight(presetId),
		bodyColor: "#1D1D1F",
		headingColor: preset.headingColor,
		accentColor: preset.accentColor,
		blockquoteAccent: preset.blockquoteAccent,
		codeBackground: preset.codeBackground,
		pageBackground: preset.pageBackground,
		paragraphAlign: "justify",
		headingScale: "balanced",
		paragraphSpacing: "normal",
		numberColor: preset.numberColor,
		codeAccentColor: preset.codeAccentColor,
		codeBorderColor: preset.codeBorderColor,
		codeHeaderBackground: preset.codeHeaderBackground,
	};
}

function mapVisibleTextOffsetToBlockProgress(
	chapter: DidacticUnitEditorChapter,
	visibleTextOffset: number,
): {readBlockIndex: number; readBlockOffset?: number} {
	const blocks = chapter.htmlBlocks;
	if (blocks.length === 0) {
		return {readBlockIndex: 0};
	}
	const lastBlock = blocks[blocks.length - 1];
	if (visibleTextOffset >= lastBlock.textEndOffset) {
		return {
			readBlockIndex: blocks.length - 1,
			readBlockOffset: lastBlock.textLength,
		};
	}
	const blockIndex = Math.max(
		0,
		blocks.findIndex((block) => visibleTextOffset <= block.textEndOffset),
	);
	const block = blocks[blockIndex] ?? blocks[0];
	return {
		readBlockIndex: blockIndex,
		readBlockOffset: Math.max(
			0,
			visibleTextOffset - block.textStartOffset,
		),
	};
}

function sourceLabel(source: DidacticUnitRevisionViewModel["source"]): string {
	switch (source) {
		case "ai_generation":
			return "AI generation";
		case "ai_regeneration":
			return "AI regeneration";
		case "manual_edit":
			return "Manual edit";
	}
}

function formatRunLabel(run: BackendGenerationRun): string {
	if (run.stage === "syllabus") {
		return "Syllabus generation";
	}

	return `Module ${run.chapterIndex !== undefined ? run.chapterIndex + 1 : "-"}`;
}

type ActivityPage = {
	kind: "learning_activity";
	activity: BackendLearningActivity;
};

type ReadPage = MeasuredModulePage | ActivityPage;

const ACTIVITY_OPTIONS: Array<{
	type: BackendLearningActivityType;
	label: string;
	description: string;
	icon: typeof FileQuestion;
}> = [
	{
		type: "multiple_choice",
		label: "Quick check",
		description: "Fast concept checks",
		icon: FileQuestion,
	},
	{
		type: "short_answer",
		label: "Open response questions",
		description: "Explain in your words",
		icon: BookOpenCheck,
	},
	{
		type: "coding_practice",
		label: "Code practice",
		description: "Practice with starter code",
		icon: Code2,
	},
	{
		type: "flashcards",
		label: "Flashcards",
		description: "Review key ideas",
		icon: Layers3,
	},
	{
		type: "case_study",
		label: "Case study",
		description: "Apply to a scenario",
		icon: Edit3,
	},
	{
		type: "guided_project",
		label: "Mini project",
		description: "Build a small deliverable",
		icon: WandSparkles,
	},
];

function resolvePostModuleCompletionStyle(presetId: string | undefined, dark = false) {
	const resolvedPresetId = presetId ?? "classic";
	const headingFamily = "Sora";
	const bodyFamily = "Inter";

	if (dark) {
		if (resolvedPresetId === "classic") {
			return {
				headingFamily, bodyFamily, panelBorder: "#49392D",
				panelBackground: "linear-gradient(135deg,#1C1917 0%,#211C18 100%)",
				panelShadow: "none", accent: "#D8AF82", accentSoft: "#332920",
				accentText: "#E4BE94", headingColor: "#F4E8DC", bodyColor: "#E0D7CF",
				primaryBackground: "#765D46", primaryHover: "#936F4F",
				primaryIconBackground: "#332920", secondaryIconBackground: "#29221D",
				badgeBackground: "#29221D", tipBackground: "#29221D", tipBorder: "#49392D",
			};
		}
		if (resolvedPresetId === "plain") {
			return {
				headingFamily, bodyFamily, panelBorder: "#313C4D",
				panelBackground: "linear-gradient(135deg,#171B22 0%,#202733 100%)",
				panelShadow: "none", accent: "#73A7FF", accentSoft: "#202F47",
				accentText: "#9CC1FF", headingColor: "#F1F4F8", bodyColor: "#D4DAE4",
				primaryBackground: "#356BCE", primaryHover: "#477CDD",
				primaryIconBackground: "#202F47", secondaryIconBackground: "#202733",
				badgeBackground: "#202733", tipBackground: "#202733", tipBorder: "#313C4D",
			};
		}
		return {
			headingFamily, bodyFamily, panelBorder: "#29453C",
			panelBackground: "linear-gradient(135deg,#17201F 0%,#1F2B29 100%)",
			panelShadow: "none", accent: "#4ADE80", accentSoft: "#203B2E",
			accentText: "#6FE39B", headingColor: "#E6EAF0", bodyColor: "#D7E4E1",
			primaryBackground: "#237D4A", primaryHover: "#2D995C",
			primaryIconBackground: "#203B2E", secondaryIconBackground: "#1F2B29",
			badgeBackground: "#1F2B29", tipBackground: "#1F2B29", tipBorder: "#29453C",
		};
	}

	if (resolvedPresetId === "classic") {
		return {
			headingFamily,
			bodyFamily,
			panelBorder: "#D8B98F",
			panelBackground:
				"linear-gradient(135deg,#FFFDF8 0%,#FFFFFF 58%,#FBF2E7 100%)",
			panelShadow: "none",
			accent: "#996633",
			accentSoft: "#F7EEE4",
			accentText: "#7A4E28",
			headingColor: "#2A1A0A",
			bodyColor: "#5B4630",
			primaryBackground: "#2A1A0A",
			primaryHover: "#3A2410",
			primaryIconBackground: "rgba(216,185,143,0.22)",
			secondaryIconBackground: "#F7EEE4",
			badgeBackground: "#F7EEE4",
			tipBackground: "rgba(255,255,255,0.78)",
			tipBorder: "#EAD8C2",
		};
	}

	if (resolvedPresetId === "plain") {
		return {
			headingFamily,
			bodyFamily,
			panelBorder: "#BFDBFE",
			panelBackground:
				"linear-gradient(135deg,#F8FBFF 0%,#FFFFFF 58%,#EFF6FF 100%)",
			panelShadow: "none",
			accent: "#2563EB",
			accentSoft: "#EFF6FF",
			accentText: "#1D4ED8",
			headingColor: "#1D1D1F",
			bodyColor: "#4B5563",
			primaryBackground: "#1D1D1F",
			primaryHover: "#333333",
			primaryIconBackground: "rgba(37,99,235,0.20)",
			secondaryIconBackground: "#EFF6FF",
			badgeBackground: "#EFF6FF",
			tipBackground: "rgba(255,255,255,0.86)",
			tipBorder: "#DBEAFE",
		};
	}

	return {
		headingFamily,
		bodyFamily,
		panelBorder: "#86EFAC",
		panelBackground:
			"linear-gradient(135deg,#F8FFFB 0%,#FFFFFF 58%,#F0FFF7 100%)",
		panelShadow: "none",
		accent: "#16A34A",
		accentSoft: "#DCFCE7",
		accentText: "#15803D",
		headingColor: "#1D1D1F",
		bodyColor: "#4B5563",
		primaryBackground: "#1D1D1F",
		primaryHover: "#333333",
		primaryIconBackground: "rgba(16,185,129,0.20)",
		secondaryIconBackground: "#ECFDF5",
		badgeBackground: "#ECFDF5",
		tipBackground: "rgba(255,255,255,0.80)",
		tipBorder: "#DCFCE7",
	};
}

function resolveActivityPageSurface(presetId: string | undefined, dark = false) {
	if (dark) {
		return presetId === "classic" ? "#1C1917" : presetId === "plain" ? "#171B22" : "#17201F";
	}
	if (presetId === "classic") {
		return "#FFFDF8";
	}
	return "#FFFFFF";
}

type MobileEditorTab = "modules" | "content" | "exercises" | "settings";

type MobileUnitEditorProps = {
	workspace: DidacticUnitEditorViewModel;
	activeChapter: DidacticUnitEditorChapter;
	activeChapterIndex: number;
	activeContentHtml: string;
	learningActivitiesByChapter: Record<number, BackendLearningActivity[]>;
	activityAttempts: Record<string, BackendLearningActivityAttempt[]>;
	activityContentScale: number;
	canRegenerate: boolean;
	canEdit: boolean;
	isActivityAttemptSubmitting: boolean;
	isActivityLoading: boolean;
	isFinishUnitPending: boolean;
	onBackToDashboard: () => void;
	onCreateActivity: () => void;
	onDeleteActivity: (activityId: string) => Promise<void>;
	onEdit: () => void;
	onFinishUnit: () => void;
	onOpenExport: () => void;
	onOpenHistory: () => void;
	onOpenNotes: () => void;
	onOpenPreferences: () => void;
	onOpenTutorial: () => void;
	onTextStyleChange: (textStyle: EditorTextStyle) => void;
	onRegenerate: () => void;
	onRefillActivityAttempts: (activityId: string) => Promise<void>;
	onSelectChapter: (chapterIndex: number) => void;
	onSubmitActivityAttempt: (activityId: string, answers: unknown) => Promise<void>;
	resolvedThemeVars: CSSProperties;
	stylePreset: EditorTextStyle["stylePreset"];
	textStyle: EditorTextStyle;
};

type MobileInlineHtmlEditorProps = {
	html: string;
	onChange: (html: string) => void;
	style?: CSSProperties;
};

function MobileInlineHtmlEditor({
	html,
	onChange,
	style,
}: MobileInlineHtmlEditorProps) {
	const editorRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (editorRef.current && editorRef.current.innerHTML !== html) {
			editorRef.current.innerHTML = html;
		}
	}, [html]);

	return (
		<div
			ref={editorRef}
			className="unit-page-scope mobile-inline-editor min-h-[calc(100dvh-168px)] max-w-full overflow-x-hidden rounded-[16px] bg-white px-4 py-4 text-[#1D1D1F] outline-none"
			contentEditable
			onInput={(event) =>
				onChange((event.currentTarget as HTMLDivElement).innerHTML)
			}
			role="textbox"
			spellCheck
			style={style}
			suppressContentEditableWarning
		/>
	);
}

function MobileUnitEditor({
	workspace,
	activeChapter,
	activeChapterIndex,
	activeContentHtml,
	learningActivitiesByChapter,
	activityAttempts,
	activityContentScale,
	canRegenerate,
	isActivityAttemptSubmitting,
	isActivityLoading,
	isFinishUnitPending,
	onBackToDashboard,
	onCreateActivity,
	onDeleteActivity,
	onFinishUnit,
	onOpenExport,
	onOpenHistory,
	onOpenNotes,
	onOpenPreferences,
	onOpenTutorial,
	onTextStyleChange,
	onRegenerate,
	onRefillActivityAttempts,
	onSelectChapter,
	onSubmitActivityAttempt,
	resolvedThemeVars,
	stylePreset,
	textStyle,
}: MobileUnitEditorProps) {
	const [activeTab, setActiveTab] = useState<MobileEditorTab>("content");
	const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
		null,
	);
	const [isFloatingActionsOpen, setIsFloatingActionsOpen] = useState(false);
	const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
	const [selectedExerciseChapterIndex, setSelectedExerciseChapterIndex] =
		useState<number | null>(null);
	const floatingActionsRef = useRef<HTMLDivElement | null>(null);
	const contentScrollRef = useRef<HTMLDivElement | null>(null);
	const allLearningActivities = useMemo(
		() => Object.values(learningActivitiesByChapter).flat(),
		[learningActivitiesByChapter],
	);
	const selectedActivity =
		selectedActivityId ?
			allLearningActivities.find(
				(activity) => activity.id === selectedActivityId,
			) ?? null
		:	null;
	const shouldRenderActiveContent =
		activeChapter.status === "ready" || activeContentHtml.trim().length > 0;
	const shouldShowMobilePostContentActions =
		activeChapter.status === "ready";
	const activeChapterNumber = activeChapter.chapterIndex + 1;
	const nextChapter = workspace.chapters.find(
		(chapter) => chapter.chapterIndex > activeChapter.chapterIndex,
	);
	const mobileSurface =
		(resolvedThemeVars as Record<string, string | undefined>)[
			"--unit-page-bg"
		] ?? "#FFFFFF";
	const stylePresetOptions = ["modern", "classic", "plain"] as const;
	const sizeProfileOptions = [
		{value: "small", label: "Small", sampleSize: 12},
		{value: "regular", label: "Regular", sampleSize: 14},
		{value: "large", label: "Large", sampleSize: 17},
	] as const;

	const selectChapter = (chapterIndex: number) => {
		onSelectChapter(chapterIndex);
		setSelectedActivityId(null);
		setActiveTab("content");
		window.requestAnimationFrame(() => {
			contentScrollRef.current?.scrollTo({top: 0, left: 0});
		});
	};

	useEffect(() => {
		if (activeTab !== "content") return;
		contentScrollRef.current?.scrollTo({top: 0, left: 0});
	}, [activeChapterIndex, activeTab]);

	useEffect(() => {
		if (!isFloatingActionsOpen) return;

		const handlePointerDown = (event: PointerEvent) => {
			if (
				floatingActionsRef.current &&
				!floatingActionsRef.current.contains(event.target as Node)
			) {
				setIsFloatingActionsOpen(false);
			}
		};

		document.addEventListener("pointerdown", handlePointerDown);
		return () =>
			document.removeEventListener("pointerdown", handlePointerDown);
	}, [isFloatingActionsOpen]);

	const navItems: Array<{
		value: MobileEditorTab;
		label: string;
		icon: typeof BookOpenCheck;
	}> = [
		{value: "modules", label: "Modules", icon: Layers3},
		{value: "content", label: "Content", icon: BookOpenCheck},
		{value: "exercises", label: "Exercises", icon: Dumbbell},
		{value: "settings", label: "Settings", icon: Settings},
	];

	return (
		<div
			className="flex h-screen flex-col overflow-hidden font-sans text-[#1D1D1F] md:hidden"
			style={{backgroundColor: mobileSurface}}
		>
			<button
				aria-label="Back"
				className="fixed left-4 top-4 z-40 grid h-8 w-8 place-items-center rounded-full border border-black/20 bg-white text-[#0F0F12] shadow-[0_10px_24px_rgba(17,24,39,0.18)] backdrop-blur-md active:scale-95"
				onClick={() => {
					if (activeTab !== "modules") {
						setSelectedActivityId(null);
						setSelectedExerciseChapterIndex(null);
						setActiveTab("modules");
						return;
					}

					onBackToDashboard();
				}}
				type="button"
			>
				<ChevronLeft size={20} strokeWidth={2.8} />
			</button>
			<div
				ref={floatingActionsRef}
				className="fixed right-4 top-4 z-40 flex flex-col items-end"
				data-editor-tour="mobile-actions"
			>
				<button
					aria-label="More actions"
					className="grid h-8 w-8 place-items-center rounded-full border border-black/20 bg-white text-[#0F0F12] shadow-[0_10px_24px_rgba(17,24,39,0.18)] backdrop-blur-md active:scale-95"
					onClick={() => setIsFloatingActionsOpen((open) => !open)}
					type="button"
				>
					<MoreHorizontal size={20} strokeWidth={2.8} />
				</button>
				<AnimatePresence>
					{isFloatingActionsOpen && (
						<Motion.div
							animate={{
								opacity: 1,
								transition: {
									staggerChildren: 0.035,
									delayChildren: 0.015,
								},
							}}
							className="mt-2 flex flex-col items-end gap-2"
							exit={{
								opacity: 0,
								transition: {
									staggerChildren: 0.02,
									staggerDirection: -1,
								},
							}}
							initial={{opacity: 0}}
						>
							{[
								{
									ariaLabel: "Notes",
									icon: <StickyNote size={17} />,
									onClick: onOpenNotes,
								},
								{
									ariaLabel: "Version history",
									icon: <History size={17} />,
									onClick: onOpenHistory,
								},
								{
									ariaLabel: "Regenerate module",
									icon: <RotateCcw size={17} />,
									onClick: onRegenerate,
									disabled: !canRegenerate,
								},
								{
									ariaLabel: "Reading style",
									icon: (
										<span className="flex h-[17px] w-[17px] items-center justify-center text-[12px] font-extrabold leading-none">
											Aa
										</span>
									),
									onClick: () => setIsStyleDialogOpen(true),
								},
								{
									ariaLabel: "Preferences",
									icon: <Settings size={17} />,
									onClick: onOpenPreferences,
								},
							].map((action) => (
								<Motion.button
									key={action.ariaLabel}
									aria-label={action.ariaLabel}
									className="app-mobile-editor-action-button grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white/90 text-[#1D1D1F] shadow-[0_8px_20px_rgba(17,24,39,0.10)] backdrop-blur-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
									disabled={action.disabled}
									exit={{opacity: 0, scale: 0.8, y: -8}}
									initial={{opacity: 0, scale: 0.72, y: -12}}
									animate={{
										opacity: 1,
										scale: 1,
										y: 0,
										transition: {
											type: "spring",
											stiffness: 520,
											damping: 28,
										},
									}}
									onClick={() => {
										setIsFloatingActionsOpen(false);
										action.onClick();
									}}
									type="button"
									whileTap={{scale: 0.92}}
								>
									{action.icon}
								</Motion.button>
							))}
						</Motion.div>
					)}
				</AnimatePresence>
			</div>
			<Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
				<DialogContent className="w-[calc(100vw-40px)] max-w-[340px] rounded-[20px] p-0">
					<DialogHeader className="border-b border-[#E5E5E7] px-5 pb-4 pt-5 text-left">
						<DialogTitle>Style</DialogTitle>
						<DialogDescription>
							Adjust how this unit reads.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-5 px-5 py-5">
						<section>
							<div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
								Style
							</div>
							<div className="grid grid-cols-3 gap-2">
								{stylePresetOptions.map((presetId) => {
									const preset = STYLE_PRESETS[presetId];
									const isActive = textStyle.stylePreset === presetId;

									return (
										<button
											key={presetId}
											type="button"
											onClick={() =>
												onTextStyleChange({
													...textStyle,
													stylePreset: presetId,
												})
											}
											className={cn(
												"rounded-[12px] border px-2 py-3 text-[12px] font-bold transition-colors",
												isActive ?
													"border-[#1D1D1F] bg-[#1D1D1F] text-white"
												:	"border-[#D4D7DD] bg-white text-[#1D1D1F]",
											)}
										>
											{preset.label}
										</button>
									);
								})}
							</div>
						</section>
						<section>
							<div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
								Text size
							</div>
							<div className="grid grid-cols-3 gap-2">
								{sizeProfileOptions.map((profile) => {
									const isActive =
										textStyle.sizeProfile === profile.value;

									return (
										<button
											key={profile.value}
											type="button"
											onClick={() =>
												onTextStyleChange({
													...textStyle,
													sizeProfile: profile.value,
												})
											}
											className={cn(
												"rounded-[12px] border px-2 py-3 text-center font-bold transition-colors",
												isActive ?
													"border-[#1D1D1F] bg-[#1D1D1F] text-white"
												:	"border-[#D4D7DD] bg-white text-[#1D1D1F]",
											)}
										>
											<span style={{fontSize: profile.sampleSize}}>
												Aa
											</span>
											<span className="mt-1 block text-[10px]">
												{profile.label}
											</span>
										</button>
									);
								})}
							</div>
						</section>
					</div>
				</DialogContent>
			</Dialog>

			<main className="min-h-0 flex-1 overflow-hidden">
				{activeTab === "modules" && (
					<div className="h-full overflow-y-auto px-4 pb-24 pt-16">
						<div className="mb-4">
							<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8E8E93]">
								Unit
							</div>
							<h2 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-[#1D1D1F]">
								{workspace.title}
							</h2>
						</div>
						<div className="mb-4">
							<div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-[#8E8E93]">
								<span>Overall progress</span>
								<span>{workspace.progress}%</span>
							</div>
							<div className="h-1.5 overflow-hidden rounded-full bg-[#E5E5E7]">
								<div
									className="h-full rounded-full bg-[#34C759]"
									style={{width: `${workspace.progress}%`}}
								/>
							</div>
						</div>

						<div className="space-y-2">
							{workspace.chapters.map((chapter) => {
								const selected =
									chapter.chapterIndex === activeChapterIndex;
								const isGenerating =
									chapter.status === "pending";
								const progress =
									chapter.totalBlocks > 0 ?
										Math.min(
											100,
											Math.round(
												((chapter.readBlockIndex + 1) /
													chapter.totalBlocks) *
													100,
											),
										)
									:	0;
								return (
									<button
										key={chapter.chapterIndex}
										className={cn(
											"w-full rounded-[14px] border bg-white p-3 text-left transition active:scale-[0.99]",
											selected ?
												"border-[#34C759] shadow-[0_10px_24px_rgba(52,199,89,0.10)]"
											:	"border-[#E5E5E7]",
										)}
										onClick={() =>
											selectChapter(chapter.chapterIndex)
										}
										type="button"
									>
										<div className="flex items-start gap-3">
											<span
												className={cn(
													"flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold",
													selected ?
														"bg-[#DCFCE7] text-[#15803D]"
													:	"bg-[#F5F5F7] text-[#6E6E73]",
												)}
											>
												{chapter.chapterIndex + 1}
											</span>
											<div className="min-w-0 flex-1">
												<div className="line-clamp-2 text-[14px] font-bold leading-snug">
													{chapter.title}
												</div>
												<div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-[#8E8E93]">
													<span>
														{isGenerating ?
															"Generating"
														: chapter.status ===
															"failed" ?
															"Failed"
														: chapter.isCompleted ?
															"Completed"
														:	`${progress}% read`}
													</span>
													{chapter.isCompleted && (
														<CheckCircle2
															size={13}
															className="text-[#34C759]"
														/>
													)}
												</div>
											</div>
										</div>
									</button>
								);
							})}
						</div>
					</div>
				)}

				{activeTab === "content" && (
					<div
						ref={contentScrollRef}
						className="h-full overflow-y-auto px-5 pb-24 pt-16"
						style={{backgroundColor: mobileSurface}}
					>
						<div
							className="mb-5 flex items-start justify-between gap-4"
							data-editor-tour="mobile-content"
						>
							<div className="min-w-0">
								<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8E8E93]">
									Module {activeChapterNumber}
								</div>
								<h2 className="mt-2 text-[24px] font-extrabold leading-tight tracking-tight">
									{activeChapter.title}
								</h2>
							</div>
							<span className="shrink-0 text-[34px] font-extrabold leading-none text-[#BBF7D0]">
								{String(activeChapterNumber).padStart(2, "0")}
							</span>
						</div>

						{activeChapter.summary && (
							<p className="mb-5 border-l-2 border-[#BBF7D0] pl-3 text-[13px] italic leading-relaxed text-[#6E6E73]">
								{activeChapter.summary}
							</p>
						)}

						{shouldRenderActiveContent ?
							<ChapterRenderer
								html={activeContentHtml}
								className="unit-page-scope mobile-unit-content text-[#1D1D1F]"
								style={resolvedThemeVars}
								stylePreset={stylePreset}
							/>
						:	<div className="rounded-[14px] border border-[#E5E5E7] bg-[#F9FAFB] p-4 text-[13px] font-medium text-[#6E6E73]">
								{activeChapter.status === "pending" ?
									"This module is still generating."
								:	"This module could not be generated."}
							</div>
						}
						{shouldShowMobilePostContentActions && (
							<div className="mt-8 space-y-3 border-t border-[#E5E5E7] pt-5">
								<button
									className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#1D1D1F] px-4 py-3 text-[14px] font-bold text-white active:scale-[0.99]"
									onClick={() => {
										setSelectedActivityId(null);
										setActiveTab("exercises");
									}}
									type="button"
								>
									<Dumbbell size={17} />
									Practice with exercises
								</button>
								{nextChapter ?
									<button
										className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#1D1D1F] bg-white px-4 py-3 text-[14px] font-bold text-[#1D1D1F] active:scale-[0.99]"
										onClick={() => {
											selectChapter(nextChapter.chapterIndex);
										}}
										type="button"
									>
										Continue to next module
										<ChevronRight size={17} />
									</button>
								:	(
									<button
										className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#16A34A] px-4 py-3 text-[14px] font-bold text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
										disabled={isFinishUnitPending}
										onClick={onFinishUnit}
										type="button"
									>
										<PartyPopper size={17} />
										Finish unit 🎉
									</button>
									)}
							</div>
						)}
					</div>
				)}

				{activeTab === "exercises" && (
					<div className="h-full overflow-y-auto px-4 pb-24 pt-16">
						{selectedActivity ?
							<div className="overflow-x-auto">
								<button
									className="mb-3 flex items-center gap-1 text-[13px] font-semibold text-[#6E6E73]"
									onClick={() => setSelectedActivityId(null)}
									type="button"
								>
									<ChevronLeft size={17} />
									Exercises
								</button>
								<LearningActivityRenderer
									activity={selectedActivity}
									attempts={
										activityAttempts[selectedActivity.id] ?? []
									}
									contentScale={activityContentScale}
									isSubmitting={isActivityAttemptSubmitting}
									onDeleteActivity={onDeleteActivity}
									onRefillAttempts={onRefillActivityAttempts}
									onSubmitAttempt={onSubmitActivityAttempt}
									stylePreset={stylePreset}
									surfaceColor={mobileSurface}
								/>
							</div>
						: selectedExerciseChapterIndex !== null ?
							<div>
								<button
									className="mb-4 flex items-center gap-1 text-[13px] font-semibold text-[#6E6E73]"
									onClick={() => setSelectedExerciseChapterIndex(null)}
									type="button"
								>
									<ChevronLeft size={17} />
									Exercises
								</button>
								<div className="mb-4">
									<div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8E8E93]">
										Module {selectedExerciseChapterIndex + 1}
									</div>
									<h2 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight">
										{workspace.chapters.find(
											(chapter) =>
												chapter.chapterIndex ===
												selectedExerciseChapterIndex,
										)?.title ?? "Exercises"}
									</h2>
								</div>
								<div className="space-y-2">
									{(
										learningActivitiesByChapter[
											selectedExerciseChapterIndex
										] ?? []
									).map((activity) => (
										<button
											key={activity.id}
											className="flex w-full items-center gap-3 rounded-[14px] border border-[#E5E5E7] bg-white p-3 text-left"
											onClick={() => setSelectedActivityId(activity.id)}
											type="button"
										>
											<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#ECFDF3] text-[#15803D]">
												{(() => {
													const Icon = activityTypeOutlineIcon(
														activity.type,
													);
													return <Icon size={18} />;
												})()}
											</span>
											<span className="min-w-0 flex-1">
												<span className="block text-[14px] font-bold">
													{activityTypeOutlineLabel(activity.type)}
												</span>
												<span className="mt-0.5 block truncate text-[12px] text-[#6E6E73]">
													{activityAttempts[activity.id]?.length ?? 0} attempts
												</span>
											</span>
											<ChevronRight
												size={18}
												className="text-[#8E8E93]"
											/>
										</button>
									))}
								</div>
							</div>
						:	<>
								<div className="mb-4 flex items-center justify-between gap-3">
									<div>
										<h2 className="text-[22px] font-extrabold tracking-tight">
											Exercises
										</h2>
										<p className="mt-1 text-[12px] text-[#6E6E73]">
											Practice for the current module.
										</p>
									</div>
									<button
										className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
										disabled={isActivityLoading}
										onClick={onCreateActivity}
										type="button"
									>
										{isActivityLoading ? "Creating..." : "Create"}
									</button>
								</div>
								{allLearningActivities.length === 0 ?
									<div className="rounded-[16px] border border-dashed border-[#D1D1D6] bg-white p-6 text-center">
										<Dumbbell
											size={24}
											className="mx-auto text-[#34C759]"
										/>
										<div className="mt-3 text-[15px] font-bold">
											No exercises yet
										</div>
										<p className="mt-1 text-[12px] leading-relaxed text-[#6E6E73]">
											Create one from this module when you are ready.
										</p>
									</div>
								:	<div className="space-y-2">
										{workspace.chapters
											.filter(
												(chapter) =>
													(learningActivitiesByChapter[
														chapter.chapterIndex
													]?.length ?? 0) > 0,
											)
											.map((chapter) => (
											<button
												key={chapter.chapterIndex}
												className="flex w-full items-center gap-3 rounded-[14px] border border-[#E5E5E7] bg-white p-3 text-left"
												onClick={() =>
													setSelectedExerciseChapterIndex(
														chapter.chapterIndex,
													)
												}
												type="button"
											>
												<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#ECFDF3] text-[#15803D]">
													{chapter.chapterIndex + 1}
												</span>
												<span className="min-w-0 flex-1">
													<span className="block text-[14px] font-bold">
														Module {chapter.chapterIndex + 1}
													</span>
													<span className="mt-0.5 block truncate text-[12px] text-[#6E6E73]">
														{
															learningActivitiesByChapter[
																chapter.chapterIndex
															]?.length
														} exercises · {chapter.title}
													</span>
												</span>
												<ChevronRight
													size={18}
													className="text-[#8E8E93]"
												/>
											</button>
										))}
									</div>
								}
							</>
						}
					</div>
				)}

				{activeTab === "settings" && (
					<div className="h-full overflow-y-auto px-4 pb-24 pt-16">
						<div className="space-y-2">
							<button
								className="flex w-full items-center gap-3 rounded-[14px] border border-[#E5E5E7] bg-white p-4 text-left text-[14px] font-bold"
								onClick={onBackToDashboard}
								type="button"
							>
								<Undo2 size={18} />
								Back to Dashboard
							</button>
							<button
								className="flex w-full items-center gap-3 rounded-[14px] border border-[#E5E5E7] bg-white p-4 text-left text-[14px] font-bold"
								onClick={onOpenExport}
								type="button"
							>
								<Share2 size={18} />
								Export unit
							</button>
							<button
								className="flex w-full items-center gap-3 rounded-[14px] border border-[#E5E5E7] bg-white p-4 text-left text-[14px] font-bold"
								onClick={() => {
									setSelectedActivityId(null);
									setSelectedExerciseChapterIndex(null);
									setActiveTab("content");
									onOpenTutorial();
								}}
								type="button"
							>
								<WandSparkles size={18} />
								Show tutorial
							</button>
							<button
								className="flex w-full items-center gap-3 rounded-[14px] border border-[#E5E5E7] bg-white p-4 text-left text-[14px] font-bold"
								onClick={onOpenPreferences}
								type="button"
							>
								<Settings size={18} />
								Settings
							</button>
						</div>
					</div>
				)}
			</main>

			<nav
				className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#E5E5E7] bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur"
				data-editor-tour="mobile-nav"
			>
				{navItems.map((item) => {
					const Icon = item.icon;
					const selected = activeTab === item.value;
					return (
						<button
							key={item.value}
							className={cn(
								"flex flex-col items-center gap-1 rounded-[12px] py-1.5 text-[11px] font-semibold transition",
								selected ? "text-[#16A34A]" : "text-[#8E8E93]",
							)}
							data-editor-tour={
								item.value === "exercises" ?
									"mobile-exercises-tab"
								:	undefined
							}
							onClick={() => {
								setSelectedActivityId(null);
								setActiveTab(item.value);
							}}
							type="button"
						>
							<Icon size={21} strokeWidth={selected ? 2.4 : 2} />
							<span>{item.label}</span>
						</button>
					);
				})}
			</nav>
		</div>
	);
}

export function UnitEditor({didacticUnitId, onDataChanged}: UnitEditorProps) {
	const navigate = useNavigate();
	const [workspace, setWorkspace] =
		useState<DidacticUnitEditorViewModel | null>(null);
	const [chapterDetails, setChapterDetails] = useState<
		Record<number, BackendDidacticUnitChapterDetail>
	>({});
	const [revisions, setRevisions] = useState<DidacticUnitRevisionViewModel[]>(
		[],
	);
	const [activeChapterIndex, setActiveChapterIndex] = useState(0);
	const [draft, setDraft] = useState<ChapterDraft | null>(null);
	const [, setIsSaving] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isPostModuleActionPending, setIsPostModuleActionPending] =
		useState(false);
	const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
	const [isUnitCompleteModalOpen, setIsUnitCompleteModalOpen] =
		useState(false);
	const [isMobileEditOpen, setIsMobileEditOpen] = useState(false);
	const [learningActivities, setLearningActivities] = useState<
		Record<number, BackendLearningActivity[]>
	>({});
	const [activityAttempts, setActivityAttempts] = useState<
		Record<string, BackendLearningActivityAttempt[]>
	>({});
	const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
	const [printSnapshot, setPrintSnapshot] =
		useState<UnitExportSnapshot | null>(null);
	const [isPrintingTheory, setIsPrintingTheory] = useState(false);
	const [isDownloadingActivities, setIsDownloadingActivities] =
		useState(false);
	const [unitNotes, setUnitNotes] = useState<BackendDidacticUnitNote[]>([]);
	const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
	const [pendingNoteSelection, setPendingNoteSelection] =
		useState<PendingNoteSelection | null>(null);
	const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
	const [noteDraftContent, setNoteDraftContent] = useState("");
	const [noteQuestionDraft, setNoteQuestionDraft] = useState("");
	const [isNoteAiPromptOpen, setIsNoteAiPromptOpen] = useState(false);
	const [isNoteSaving, setIsNoteSaving] = useState(false);
	const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
	const [noteEditContent, setNoteEditContent] = useState("");
	const [noteEditQuestion, setNoteEditQuestion] = useState("");
	const noteAutoSaveRequestRef = useRef(0);
	const [activityScope, setActivityScope] =
		useState<BackendLearningActivityScope>("current_module");
	const [activityType, setActivityType] =
		useState<BackendLearningActivityType>("multiple_choice");
	const [activityQuality, setActivityQuality] =
		useState<BackendGenerationQuality>("silver");
	const {resolvedMode} = useAppearance();
	const [generationModelOptions, setGenerationModelOptions] = useState<
		GenerationModelOption[]
	>(() => buildGenerationModelOptions(null, null, resolvedMode));
	const [isActivityLoading, setIsActivityLoading] = useState(false);
	const [isActivityAttemptSubmitting, setIsActivityAttemptSubmitting] =
		useState(false);
	const [isEditorGuideOpen, setIsEditorGuideOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
	const [currentSpread, setCurrentSpread] = useState(0);
	const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
	const [collapsedOutlineChapterIndex, setCollapsedOutlineChapterIndex] =
		useState<number | null>(null);
	const [expandedOutlineSectionIds, setExpandedOutlineSectionIds] = useState<
		string[]
	>([]);

	useEffect(() => {
		void Promise.all([
			dashboardApi.getAiConfig(),
			dashboardApi.getAiConfigCatalog(),
		])
			.then(([config, catalog]) => {
				setGenerationModelOptions(
					buildGenerationModelOptions(config, catalog, resolvedMode),
				);
			})
			.catch(() => {
				setGenerationModelOptions(
					buildGenerationModelOptions(null, null, resolvedMode),
				);
			});
	}, [resolvedMode]);

	useEffect(() => {
		if (editorGuideCheckedRef.current || !workspace) {
			return;
		}

		editorGuideCheckedRef.current = true;

		try {
			if (
				typeof window !== "undefined" &&
				window.localStorage.getItem(EDITOR_GUIDE_STORAGE_KEY) !== "seen"
			) {
				setIsEditorGuideOpen(true);
			}
		} catch {
			setIsEditorGuideOpen(true);
		}
	}, [workspace]);

	const handleEditorGuideOpenChange = useCallback((open: boolean) => {
		setIsEditorGuideOpen(open);

		if (!open) {
			try {
				window.localStorage.setItem(EDITOR_GUIDE_STORAGE_KEY, "seen");
			} catch {
				// Ignore storage errors; the guide can reappear if persistence fails.
			}
		}
	}, []);
	const [openChapterActionsIndex, setOpenChapterActionsIndex] = useState<
		number | null
	>(null);
	const [selectedOutlineItemId, setSelectedOutlineItemId] = useState<
		string | null
	>(null);
	const [activeChapterActivation, setActiveChapterActivation] = useState({
		chapterIndex: 0,
		key: 0,
	});
	const [lastRestoredActivationKey, setLastRestoredActivationKey] = useState<
		number | null
	>(null);
	const [contentPageDrafts, setContentPageDrafts] = useState<string[]>([]);
	const [activeHtmlEditor, setActiveHtmlEditor] = useState<Editor | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [streamingHtml, setStreamingHtml] = useState("");
	const [isStreamingGeneration, setIsStreamingGeneration] = useState(false);
	const [unitGenerationTier, setUnitGenerationTier] =
		useState<BackendGenerationQuality | null>(null);
	const {user, refreshUser} = useAuth();
	const [viewport, setViewport] = useState(() => ({
		height: typeof window !== "undefined" ? window.innerHeight : 900,
		width: typeof window !== "undefined" ? window.innerWidth : 1440,
	}));
	const usesCompactDesktopTextSize =
		viewport.width >= 768 && viewport.width < 1600;
	const [hasUserTextSizePreference, setHasUserTextSizePreference] =
		useState(() => hasEditorTextSizePreference(didacticUnitId));
	const shouldUseCompactDesktopTextSizeDefault =
		usesCompactDesktopTextSize && !hasUserTextSizePreference;
	const resolvedTheme = useMemo(
		() =>
			resolvePresentationTheme(
				workspace?.presentationTheme,
				user?.defaultPresentationTheme,
			),
		[workspace?.presentationTheme, user?.defaultPresentationTheme],
	);
	const displayTextStyle = useMemo(
		() =>
			draft ?
				applyCompactDesktopDefaultTextStyle(
					draft.textStyle,
					shouldUseCompactDesktopTextSizeDefault,
				)
			:	undefined,
		[draft?.textStyle, shouldUseCompactDesktopTextSizeDefault],
	);
	useEffect(() => {
		setHasUserTextSizePreference(
			hasEditorTextSizePreference(didacticUnitId),
		);
	}, [didacticUnitId]);
	const effectiveTheme = useMemo(
		() =>
			displayTextStyle ?
				themeFromTextStyle(resolvedTheme, displayTextStyle)
			:	resolvedTheme,
		[resolvedTheme, displayTextStyle],
	);
	const resolvedThemeVars = useMemo(
		() => themeVars(effectiveTheme, resolvedMode === "dark"),
		[effectiveTheme, resolvedMode],
	);
	const [activeGeneratingChapterIndex, setActiveGeneratingChapterIndex] =
		useState<number | null>(null);
	const [activeRunId, setActiveRunId] = useState<string | null>(null);
	const [isCancellingGeneration, setIsCancellingGeneration] = useState(false);
	const [fontsReady, setFontsReady] = useState(() =>
		typeof document !== "undefined" ?
			document.fonts.status === "loaded"
		:	false,
	);
	const saveTimeoutRef = useRef<number | null>(null);
	const preserveViewOnNextWorkspaceRef = useRef(false);
	const activeChapterIndexRef = useRef(0);
	const isEditModeRef = useRef(false);
	const generationQueueBlockedRef = useRef(false);
	const isGenerationQueueRunningRef = useRef(false);
	const readingProgressRequestIdRef = useRef(0);
	const editorGuideCheckedRef = useRef(false);
	const lastVisitedPageByChapterRef = useRef<Record<number, number | undefined>>(
		{},
	);
	const isReadingProgressSaveInFlightRef = useRef(false);
	const pendingReadingProgressSaveRef = useRef<{
		chapter: DidacticUnitEditorChapter;
		visibleTextOffset: number;
		lastVisitedPageIndex?: number;
		resolve: (didPersist: boolean) => void;
	} | null>(null);
	const requestPrint = useCallback(() => {
		window.requestAnimationFrame(() => {
			window.setTimeout(() => {
				const previousTitle = document.title;
				const restoreTitle = () => {
					document.title = previousTitle;
					window.removeEventListener("afterprint", restoreTitle);
				};
				document.title = " ";
				window.addEventListener("afterprint", restoreTitle);
				window.print();
				window.setTimeout(restoreTitle, 1000);
			}, 80);
		});
	}, []);
	const lastReadingProgressPayloadRef = useRef<string | null>(null);
	const streamingHtmlBufferRef = useRef("");
	const streamingHtmlFlushTimeoutRef = useRef<number | null>(null);
	const isCancellingGenerationRef = useRef(false);
	const measuredReadPagesCacheRef = useRef<{
		chapterIndex: number;
		measureKey: string;
		pages: MeasuredModulePage[];
	} | null>(null);

	const activeChapter = useMemo(
		() =>
			workspace?.chapters.find(
				(chapter) => chapter.chapterIndex === activeChapterIndex,
			) ??
			workspace?.chapters[0] ??
			null,
		[activeChapterIndex, workspace],
	);
	const activeChapterDetail =
		activeChapter ? chapterDetails[activeChapter.chapterIndex] : undefined;
	const validUnitNotes = useMemo(
		() =>
			workspace ?
				workspace.chapters.flatMap((chapter) =>
					getValidUnitNotesForChapter(unitNotes, chapter),
				)
			:	[],
		[unitNotes, workspace],
	);
	const activeChapterNotes = useMemo(
		() =>
			activeChapter ?
				getValidUnitNotesForChapter(unitNotes, activeChapter)
			:	[],
		[activeChapter, unitNotes],
	);
	const activeNote =
		activeNoteId ?
			validUnitNotes.find((note) => note.id === activeNoteId) ?? null
		:	null;
	const deleteNote =
		deleteNoteId ?
			unitNotes.find((note) => note.id === deleteNoteId) ?? null
		:	null;
	const isActiveChapterStreaming =
		isStreamingGeneration &&
		activeChapter !== null &&
		activeGeneratingChapterIndex !== null &&
		activeGeneratingChapterIndex === activeChapter.chapterIndex;
	const activeChapterLayoutSnapshot = useMemo(
		() =>
			activeChapter ?
				{
					chapterIndex: activeChapter.chapterIndex,
					title: activeChapter.title,
					summary: activeChapter.summary,
					status: activeChapter.status,
					readingTime: activeChapter.readingTime,
					level: activeChapter.level,
				}
			:	null,
		[
			activeChapter?.chapterIndex,
			activeChapter?.title,
			activeChapter?.summary,
			activeChapter?.status,
			activeChapter?.readingTime,
			activeChapter?.level,
		],
	);
	const isDraftForActiveChapter =
		draft !== null &&
		activeChapter !== null &&
		draft.chapterIndex === activeChapter.chapterIndex;
	const activeDraftContent =
		isDraftForActiveChapter ?
			draft.htmlDraft
		: 	normalizeStoredHtml(
				activeChapterDetail?.html ?? activeChapter?.html ?? "",
			);
	const hasNextActiveModule = useMemo(
		() =>
			activeChapter ?
				activeChapter.chapterIndex <
				(workspace?.chapters.length ?? 0) - 1
			:	false,
		[activeChapter?.chapterIndex, workspace?.chapters.length],
	);
	const activeRuns = [] as BackendGenerationRun[];

	const activeLearningActivities =
		activeChapter ? learningActivities[activeChapter.chapterIndex] ?? [] : [];

	useEffect(() => {
		if (!activeChapter || activeChapter.status !== "ready") {
			return;
		}

		let cancelled = false;
		void dashboardApi
			.listLearningActivities(didacticUnitId, activeChapter.chapterIndex)
			.then(async ({activities}) => {
				if (cancelled) return;
				setLearningActivities((previous) => ({
					...previous,
					[activeChapter.chapterIndex]: activities,
				}));
				const attemptsEntries = await Promise.all(
					activities.map(async (activity) => {
						const {attempts} = await dashboardApi.listLearningActivityAttempts(activity.id);
						return [activity.id, attempts] as const;
					}),
				);
				if (cancelled) return;
				setActivityAttempts((previous) => ({
					...previous,
					...Object.fromEntries(attemptsEntries),
				}));
			})
			.catch((error) => {
				if (!cancelled) {
					toastError(
						error instanceof Error ?
							error.message
						:	"Could not load learning activities.",
					);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [activeChapter?.chapterIndex, activeChapter?.status, didacticUnitId]);

	useEffect(() => {
		if (!workspace || viewport.width >= 768) {
			return;
		}

		const missingChapters = workspace.chapters.filter(
			(chapter) =>
				chapter.status === "ready" &&
				!Object.prototype.hasOwnProperty.call(
					learningActivities,
					chapter.chapterIndex,
				),
		);
		if (missingChapters.length === 0) {
			return;
		}

		let cancelled = false;
		void Promise.all(
			missingChapters.map(async (chapter) => {
				const {activities} = await dashboardApi.listLearningActivities(
					didacticUnitId,
					chapter.chapterIndex,
				);
				const attemptsEntries = await Promise.all(
					activities.map(async (activity) => {
						const {attempts} =
							await dashboardApi.listLearningActivityAttempts(activity.id);
						return [activity.id, attempts] as const;
					}),
				);
				return {
					activities,
					attemptsEntries,
					chapterIndex: chapter.chapterIndex,
				};
			}),
		)
			.then((results) => {
				if (cancelled) return;
				setLearningActivities((previous) => ({
					...previous,
					...Object.fromEntries(
						results.map((result) => [
							result.chapterIndex,
							result.activities,
						]),
					),
				}));
				setActivityAttempts((previous) => ({
					...previous,
					...Object.fromEntries(
						results.flatMap((result) => result.attemptsEntries),
					),
				}));
			})
			.catch((error) => {
				if (!cancelled) {
					toastError(
						error instanceof Error ?
							error.message
						:	"Could not load learning activities.",
					);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [didacticUnitId, learningActivities, viewport.width, workspace]);

	const loadRevisions = useCallback(
		async (chapterIndex: number) => {
			try {
				const response =
					await dashboardApi.listDidacticUnitChapterRevisions(
						didacticUnitId,
						chapterIndex,
					);
				setRevisions(adaptDidacticUnitRevisions(response.revisions));
			} catch (loadError) {
				if (
					loadError instanceof DashboardApiError &&
					loadError.status === 404
				) {
					setRevisions([]);
					return;
				}

				throw loadError;
			}
		},
		[didacticUnitId],
	);

	const loadWorkspace = useCallback(
		async (
			preferredChapterIndex?: number,
			options: {silent?: boolean; preserveSpread?: boolean} = {},
		) => {
			if (!options.silent) {
				setIsLoading(true);
			}

			try {
				const [unit, chaptersResponse, notesResponse] = await Promise.all([
					dashboardApi.getDidacticUnit(didacticUnitId),
					dashboardApi.listDidacticUnitChapters(didacticUnitId),
					dashboardApi.listDidacticUnitNotes(didacticUnitId),
				]);

				const detailResponses = await Promise.all(
					chaptersResponse.chapters.map((chapter) =>
						dashboardApi.getDidacticUnitChapter(
							didacticUnitId,
							chapter.chapterIndex,
						),
					),
				);

				const detailsRecord = Object.fromEntries(
					detailResponses.map((detail) => [
						detail.chapterIndex,
						detail,
					]),
				) as Record<number, BackendDidacticUnitChapterDetail>;
				const detailMap = new Map(
					detailResponses.map(
						(detail) => [detail.chapterIndex, detail] as const,
					),
				);
				const nextWorkspace = adaptDidacticUnitEditor({
					unit,
					chapterSummaries: chaptersResponse.chapters,
					chapterDetails: detailMap,
				});
				nextWorkspace.chapters.forEach((chapter) => {
					if (chapter.lastVisitedPageIndex !== undefined) {
						lastVisitedPageByChapterRef.current[
							chapter.chapterIndex
						] = chapter.lastVisitedPageIndex;
					}
				});

				const nextActiveChapter =
					nextWorkspace.chapters.find(
						(chapter) =>
							chapter.chapterIndex ===
							(
								preferredChapterIndex ??
								(
									options.silent ?
										activeChapterIndexRef.current
									:	getInitialEditorChapterIndex(nextWorkspace)
								)
							),
					) ??
					nextWorkspace.chapters[0] ??
					null;

				setWorkspace(nextWorkspace);
				setUnitGenerationTier(
					(previousTier) =>
						unit.generationQuality ??
						unit.generationTier ??
						previousTier ??
						null,
				);
				setChapterDetails(detailsRecord);
				setUnitNotes(notesResponse.notes);
				setActiveChapterIndex(nextActiveChapter?.chapterIndex ?? 0);
				preserveViewOnNextWorkspaceRef.current = Boolean(
					options.preserveSpread,
				);

				if (!options.preserveSpread) {
					setCurrentSpread(0);
				}

				if (nextActiveChapter) {
					setDraft(
						buildDraft(
							nextActiveChapter,
							detailsRecord[nextActiveChapter.chapterIndex],
						),
					);
					await loadRevisions(nextActiveChapter.chapterIndex);
				} else {
					setDraft(null);
					setRevisions([]);
				}
			} catch (loadError) {
				toastError(
					loadError instanceof Error ?
						loadError.message
					:	"Failed to load didactic unit.",
				);
			} finally {
				if (!options.silent) {
					setIsLoading(false);
				}
			}
		},
		[didacticUnitId, loadRevisions],
	);

	useEffect(() => {
		void loadWorkspace();
	}, [loadWorkspace]);

	useEffect(() => {
		activeChapterIndexRef.current = activeChapterIndex;
		setCollapsedOutlineChapterIndex(null);
		setSelectedOutlineItemId(null);
		setActiveChapterActivation((previousActivation) => ({
			chapterIndex: activeChapterIndex,
			key: previousActivation.key + 1,
		}));
	}, [activeChapterIndex]);

	useEffect(() => {
		if (!isUnitCompleteModalOpen) {
			return;
		}

		const isMobileConfetti = viewport.width < 768;
		const duration = isMobileConfetti ? 900 : 2400;
		const animationEnd = Date.now() + duration;
		const colors = ["#4ADE80", "#22C55E", "#FACC15", "#60A5FA", "#F472B6"];
		const randomInRange = (min: number, max: number) =>
			Math.random() * (max - min) + min;

		const frame = () => {
			if (Date.now() > animationEnd) {
				return;
			}

			confetti({
				particleCount: isMobileConfetti ? 1 : 3,
				angle: 60,
				spread: isMobileConfetti ? 36 : 55,
				startVelocity: isMobileConfetti ? 30 : 48,
				origin: {x: 0, y: randomInRange(0.45, 0.7)},
				colors,
				zIndex: 70,
				disableForReducedMotion: true,
			});
			confetti({
				particleCount: isMobileConfetti ? 1 : 3,
				angle: 120,
				spread: isMobileConfetti ? 36 : 55,
				startVelocity: isMobileConfetti ? 30 : 48,
				origin: {x: 1, y: randomInRange(0.45, 0.7)},
				colors,
				zIndex: 70,
				disableForReducedMotion: true,
			});

			window.requestAnimationFrame(frame);
		};

		frame();
	}, [isUnitCompleteModalOpen, viewport.width]);

	useEffect(() => {
		isEditModeRef.current = isEditMode;
	}, [isEditMode]);

	const captureNoteSelection = useCallback(
		(event?: {clientX: number; clientY: number; preventDefault?: () => void}) => {
			if (isEditMode || !activeChapter || activeChapter.status !== "ready") {
				setPendingNoteSelection(null);
				return false;
			}
			const selection = window.getSelection();
			if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
				setPendingNoteSelection(null);
				return false;
			}
			const range = selection.getRangeAt(0);
			const pageRoot =
				(range.commonAncestorContainer instanceof Element ?
					range.commonAncestorContainer
				:	range.commonAncestorContainer.parentElement
				)?.closest<HTMLElement>("[data-unit-note-page='true']");
			if (!pageRoot) {
				setPendingNoteSelection(null);
				return false;
			}
			const pageStartOffset = Number(pageRoot.dataset.pageStartOffset ?? "0");
			const selectionAnchor = buildNoteAnchorFromSelection({
				range,
				pageRoot,
				pageStartOffset,
				chapter: activeChapter,
			});
			if (!selectionAnchor) {
				setPendingNoteSelection(null);
				return false;
			}
			const rect = range.getBoundingClientRect();
			setPendingNoteSelection({
				chapterIndex: activeChapter.chapterIndex,
				selectedText: selectionAnchor.selectedText,
				anchor: selectionAnchor.anchor,
				x: event?.clientX ?? rect.left + rect.width / 2,
				y: event?.clientY ?? rect.top,
			});
			return true;
		},
		[activeChapter, isEditMode],
	);

	const openNoteDialog = useCallback(() => {
		if (!pendingNoteSelection) {
			return;
		}
		setNoteDraftContent("");
		setNoteQuestionDraft("");
		setIsNoteAiPromptOpen(false);
		setActiveNoteId(null);
		setEditingNoteId(null);
		setIsNoteDialogOpen(true);
	}, [pendingNoteSelection]);

	const handleNoteMouseUp = useCallback(() => {
		window.setTimeout(() => {
			captureNoteSelection();
		}, 0);
	}, [captureNoteSelection]);

	const handleNoteContextMenu = useCallback(
		(event: React.MouseEvent) => {
			if (captureNoteSelection(event)) {
				event.preventDefault();
			}
		},
		[captureNoteSelection],
	);

	const handleNoteContentClick = useCallback((event: React.MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}
		const mark = target.closest<HTMLElement>("[data-note-id]");
		if (!mark?.dataset.noteId) {
			return;
		}
		const note = validUnitNotes.find((item) => item.id === mark.dataset.noteId);
		if (!note) {
			return;
		}
		setPendingNoteSelection(null);
		setActiveNoteId(note.id);
		setEditingNoteId(note.id);
		setNoteDraftContent(note.content);
		setNoteQuestionDraft(note.question ?? "");
		setIsNoteAiPromptOpen(Boolean(note.question));
		setIsNoteDialogOpen(true);
	}, [validUnitNotes]);

	const handleSaveCurrentNote = useCallback(async () => {
		if (!noteDraftContent.trim()) {
			return;
		}
		setIsNoteSaving(true);
		try {
			if (activeNote) {
				const {note} = await dashboardApi.updateDidacticUnitNote(
					didacticUnitId,
					activeNote.id,
					{
						content: noteDraftContent,
						question: noteQuestionDraft,
					},
				);
				setUnitNotes((previous) =>
					previous.map((item) => (item.id === note.id ? note : item)),
				);
			} else if (pendingNoteSelection) {
				const {note} = await dashboardApi.createDidacticUnitNote(didacticUnitId, {
					chapterIndex: pendingNoteSelection.chapterIndex,
					selectedText: pendingNoteSelection.selectedText,
					content: noteDraftContent,
					anchor: pendingNoteSelection.anchor,
				});
				setUnitNotes((previous) => [...previous, note]);
				setActiveNoteId(note.id);
			}
			setIsNoteDialogOpen(false);
			setPendingNoteSelection(null);
			setEditingNoteId(null);
			window.getSelection()?.removeAllRanges();
		} catch (error) {
			toastError(
				error instanceof Error ? error.message : "Failed to save note.",
			);
		} finally {
			setIsNoteSaving(false);
		}
	}, [
		activeNote,
		didacticUnitId,
		noteDraftContent,
		noteQuestionDraft,
		pendingNoteSelection,
	]);

	useEffect(() => {
		if (!isNoteDialogOpen || !activeNote || !noteDraftContent.trim()) {
			return;
		}

		const nextQuestion = noteQuestionDraft;
		const hasChanges =
			noteDraftContent !== activeNote.content ||
			nextQuestion !== (activeNote.question ?? "");
		if (!hasChanges) {
			return;
		}

		const requestId = noteAutoSaveRequestRef.current + 1;
		noteAutoSaveRequestRef.current = requestId;
		const timeoutId = window.setTimeout(() => {
			setIsNoteSaving(true);
			void dashboardApi
				.updateDidacticUnitNote(didacticUnitId, activeNote.id, {
					content: noteDraftContent,
					question: nextQuestion,
				})
				.then(({note}) => {
					if (noteAutoSaveRequestRef.current !== requestId) {
						return;
					}
					setUnitNotes((previous) =>
						previous.map((item) => (item.id === note.id ? note : item)),
					);
				})
				.catch((error) => {
					if (noteAutoSaveRequestRef.current !== requestId) {
						return;
					}
					toastError(
						error instanceof Error ?
							error.message
						:	"Failed to auto-save note.",
					);
				})
				.finally(() => {
					if (noteAutoSaveRequestRef.current === requestId) {
						setIsNoteSaving(false);
					}
				});
		}, 650);

		return () => window.clearTimeout(timeoutId);
	}, [
		activeNote,
		didacticUnitId,
		isNoteDialogOpen,
		noteDraftContent,
		noteQuestionDraft,
	]);

	const handleGenerateNote = useCallback(async () => {
		const sourceSelection =
			pendingNoteSelection ??
			(activeNote ?
				{
					chapterIndex: activeNote.chapterIndex,
					selectedText: activeNote.selectedText,
					anchor: activeNote.anchor,
				}
			:	null);
		if (!sourceSelection) {
			return;
		}
		setIsNoteSaving(true);
		try {
			const {note} = await dashboardApi.generateDidacticUnitNote(didacticUnitId, {
				chapterIndex: sourceSelection.chapterIndex,
				selectedText: sourceSelection.selectedText,
				question: noteQuestionDraft.trim() || undefined,
				quality: "silver",
				anchor: sourceSelection.anchor,
			});
			if (activeNote) {
				await dashboardApi.deleteDidacticUnitNote(didacticUnitId, activeNote.id);
				setUnitNotes((previous) => [
					...previous.filter((item) => item.id !== activeNote.id),
					note,
				]);
			} else {
				setUnitNotes((previous) => [...previous, note]);
			}
			setActiveNoteId(note.id);
			setEditingNoteId(note.id);
			setNoteDraftContent(note.content);
			setNoteQuestionDraft(note.question ?? "");
			setPendingNoteSelection(null);
			window.getSelection()?.removeAllRanges();
			await refreshUser();
		} catch (error) {
			toastError(
				getDashboardErrorMessage(error, "Failed to generate note."),
			);
		} finally {
			setIsNoteSaving(false);
		}
	}, [
		didacticUnitId,
		activeNote,
		noteQuestionDraft,
		pendingNoteSelection,
		refreshUser,
	]);

	const startEditingNote = useCallback((note: BackendDidacticUnitNote) => {
		setEditingNoteId(note.id);
		setNoteEditContent(note.content);
		setNoteEditQuestion(note.question ?? "");
	}, []);

	const handleSaveNoteEdit = useCallback(async () => {
		if (!editingNoteId || !noteEditContent.trim()) {
			return;
		}
		setIsNoteSaving(true);
		try {
			const {note} = await dashboardApi.updateDidacticUnitNote(
				didacticUnitId,
				editingNoteId,
				{
					content: noteEditContent,
					question: noteEditQuestion,
				},
			);
			setUnitNotes((previous) =>
				previous.map((item) => (item.id === note.id ? note : item)),
			);
			setEditingNoteId(null);
		} catch (error) {
			toastError(
				error instanceof Error ? error.message : "Failed to update note.",
			);
		} finally {
			setIsNoteSaving(false);
		}
	}, [didacticUnitId, editingNoteId, noteEditContent, noteEditQuestion]);

	const handleDeleteNote = useCallback(async () => {
		if (!deleteNoteId) {
			return;
		}
		try {
			await dashboardApi.deleteDidacticUnitNote(didacticUnitId, deleteNoteId);
			setUnitNotes((previous) =>
				previous.filter((note) => note.id !== deleteNoteId),
			);
			if (activeNoteId === deleteNoteId) {
				setActiveNoteId(null);
			}
			if (editingNoteId === deleteNoteId) {
				setEditingNoteId(null);
			}
			setDeleteNoteId(null);
		} catch (error) {
			toastError(
				error instanceof Error ? error.message : "Failed to delete note.",
			);
		}
	}, [activeNoteId, deleteNoteId, didacticUnitId, editingNoteId]);

	useEffect(() => {
		if (!activeChapter) {
			return;
		}

		void loadRevisions(activeChapter.chapterIndex);
	}, [activeChapter?.chapterIndex, loadRevisions]);

	useEffect(() => {
		lastReadingProgressPayloadRef.current = null;
	}, [activeChapter?.chapterIndex, activeChapter?.totalBlocks]);

	useEffect(() => {
		if (!activeChapter) {
			return;
		}

		setDraft(buildDraft(activeChapter, activeChapterDetail));

		if (preserveViewOnNextWorkspaceRef.current) {
			preserveViewOnNextWorkspaceRef.current = false;
			return;
		}

		setIsEditMode(false);
		setActiveHtmlEditor(null);
	}, [
		activeChapter?.chapterIndex,
		activeChapter?.title,
		activeChapter?.html,
		activeChapter?.textStyle,
		activeChapterDetail?.title,
		activeChapterDetail?.html,
	]);

	useEffect(() => {
		if (
			!isStreamingGeneration ||
			activeGeneratingChapterIndex === null ||
			activeGeneratingChapterIndex !== activeChapterIndex
		) {
			return;
		}

		setDraft((currentDraft) =>
			currentDraft ?
				{
					...currentDraft,
					htmlDraft: streamingHtml,
				}
			:	currentDraft,
		);
	}, [
		activeChapterIndex,
		activeGeneratingChapterIndex,
		isStreamingGeneration,
		streamingHtml,
	]);

	useEffect(() => {
		const updateViewport = () => {
			setViewport({
				height: window.innerHeight,
				width: window.innerWidth,
			});
		};

		updateViewport();
		window.addEventListener("resize", updateViewport);

		return () => window.removeEventListener("resize", updateViewport);
	}, []);

	useEffect(
		() => () => {
			if (saveTimeoutRef.current) {
				window.clearTimeout(saveTimeoutRef.current);
			}
			if (streamingHtmlFlushTimeoutRef.current) {
				window.clearTimeout(streamingHtmlFlushTimeoutRef.current);
			}
		},
		[],
	);

	const storedActiveDraftSettings =
		isDraftForActiveChapter ?
			draft.textStyle
		: 	activeChapter?.textStyle;
	const activeDraftSettings =
		storedActiveDraftSettings ?
			applyCompactDesktopDefaultTextStyle(
				storedActiveDraftSettings,
				shouldUseCompactDesktopTextSizeDefault,
			)
		:	undefined;
	const activeTextStyleKey = [
		activeDraftSettings?.stylePreset ?? "classic",
		activeDraftSettings?.sizeProfile ?? "regular",
	].join(":");

	useEffect(() => {
		if (fontsReady) return;
		void document.fonts.ready.then(() => setFontsReady(true));
	}, [fontsReady]);

	useEffect(() => {
		const presetId = activeDraftSettings?.stylePreset ?? "classic";
		const preset = STYLE_PRESETS[presetId];
		setFontsReady(false);
		void loadFonts([preset.body, preset.heading] as FontId[]).then(() =>
			setFontsReady(true),
		);
	}, [activeDraftSettings?.stylePreset]);

	const spreadMetrics = useMemo(
		() =>
			calculateSpreadMetrics({
				viewportHeight: viewport.height,
				viewportWidth: viewport.width,
			}),
		[viewport.height, viewport.width],
	);
	const compactModuleTitle = viewport.width < 1600;
	const moduleTitleSizePx = compactModuleTitle ?
		Math.min(27, Math.max(20, viewport.width * 0.02))
	:	Math.min(36, Math.max(24, viewport.width * 0.035));
	const pageMeasureKey = [
		activeChapterLayoutSnapshot?.chapterIndex ?? "none",
		activeTextStyleKey,
		spreadMetrics.pageWidth,
		spreadMetrics.pageHeight,
		moduleTitleSizePx,
	].join(":");
	const rawMeasuredReadPages = useMemo(
		() =>
			fontsReady && activeChapterLayoutSnapshot && activeDraftContent ?
				measurePages({
					activeChapter: activeChapterLayoutSnapshot,
					chapterIndex: activeChapterLayoutSnapshot.chapterIndex,
					compactModuleTitle,
					content: activeDraftContent,
					hasNextModule: hasNextActiveModule,
					moduleTitleSizePx,
					pageHeight: spreadMetrics.pageHeight,
					pageWidth: spreadMetrics.pageWidth,
					textStyle: activeDraftSettings,
				})
			:	[],
		[
			fontsReady,
			activeChapterLayoutSnapshot,
			activeDraftContent,
			hasNextActiveModule,
			compactModuleTitle,
			moduleTitleSizePx,
			spreadMetrics.pageHeight,
			spreadMetrics.pageWidth,
			activeDraftSettings?.stylePreset,
			activeDraftSettings?.sizeProfile,
			pageMeasureKey,
		],
	);
	useEffect(() => {
		if (!activeChapter) {
			measuredReadPagesCacheRef.current = null;
			return;
		}
		if (rawMeasuredReadPages.length > 0) {
			measuredReadPagesCacheRef.current = {
				chapterIndex: activeChapter.chapterIndex,
				measureKey: pageMeasureKey,
				pages: rawMeasuredReadPages,
			};
		}
	}, [activeChapter?.chapterIndex, pageMeasureKey, rawMeasuredReadPages]);
	const measuredReadPages = useMemo(() => {
		if (rawMeasuredReadPages.length > 0 || !activeChapter) {
			return rawMeasuredReadPages;
		}
		const cached = measuredReadPagesCacheRef.current;
		return cached?.chapterIndex === activeChapter.chapterIndex &&
			cached.measureKey === pageMeasureKey ?
				cached.pages
			:	rawMeasuredReadPages;
	}, [activeChapter, pageMeasureKey, rawMeasuredReadPages]);
	const readPages: ReadPage[] = useMemo(
		() => buildReadPages(measuredReadPages, activeLearningActivities),
		[activeLearningActivities, measuredReadPages],
	);
	const paginatedContentPages = useMemo(
		() =>
			measuredReadPages
				.filter(isMeasuredContentPage)
				.map((page) => page.html),
		[measuredReadPages],
	);

	const moduleOutline = useMemo(
		() => {
			if (!activeChapter || isEditMode) {
				return [];
			}

			return [
				...buildModuleOutline(activeChapter, measuredReadPages),
				...buildActivityOutlineItems(readPages),
			];
		},
		[activeChapter, isEditMode, measuredReadPages, readPages],
	);
	const visibleEditablePages =
		isEditMode && contentPageDrafts.length > 0 ?
			contentPageDrafts
		:	paginatedContentPages;

	useEffect(() => {
		if (!isEditMode) {
			setContentPageDrafts([]);
			return;
		}

		setContentPageDrafts(
			paginatedContentPages.length > 0 ? paginatedContentPages : [""],
		);
	}, [
		isEditMode,
		activeChapter?.chapterIndex,
		paginatedContentPages,
		spreadMetrics.pageHeight,
		spreadMetrics.pageWidth,
	]);

	useEffect(() => {
		if (isEditMode) {
			return;
		}

		if (!activeChapter || readPages.length === 0) {
			setCurrentSpread(0);
			return;
		}

		if (
			activeChapterActivation.chapterIndex !== activeChapter.chapterIndex ||
			lastRestoredActivationKey === activeChapterActivation.key
		) {
			return;
		}

		const savedLastVisitedPageIndex =
			lastVisitedPageByChapterRef.current[activeChapter.chapterIndex] ??
			activeChapter.lastVisitedPageIndex ??
			0;

		if (
			savedLastVisitedPageIndex > 0 &&
			readPages.length <= savedLastVisitedPageIndex
		) {
			return;
		}

		const lastVisitedPageIndex = Math.max(
			0,
			Math.min(savedLastVisitedPageIndex, readPages.length - 1),
		);
		setCurrentSpread(
			Math.floor(lastVisitedPageIndex / spreadMetrics.pagesPerSpread),
		);
		setLastRestoredActivationKey(activeChapterActivation.key);
	}, [
		activeChapter?.chapterIndex,
		activeChapter?.lastVisitedPageIndex,
		activeChapterActivation,
		isEditMode,
		lastRestoredActivationKey,
		readPages.length,
		spreadMetrics.pagesPerSpread,
	]);

	const runAction = async (
		action: () => Promise<unknown>,
		options: {
			chapterIndex?: number;
			closeEditMode?: boolean;
			silentRefresh?: boolean;
			preserveSpread?: boolean;
		} = {},
	) => {
		setIsSubmitting(true);

		try {
			await action();
			onDataChanged();
			await loadWorkspace(options.chapterIndex ?? activeChapterIndex, {
				silent: options.silentRefresh,
				preserveSpread: options.preserveSpread,
			});

			if (options.closeEditMode) {
				setIsEditMode(false);
			}

			setIsSaving(true);
			if (saveTimeoutRef.current) {
				window.clearTimeout(saveTimeoutRef.current);
			}
			saveTimeoutRef.current = window.setTimeout(
				() => setIsSaving(false),
				1200,
			);
		} catch (actionError) {
			toastError(
				actionError instanceof Error ?
					actionError.message
				:	"Didactic unit action failed.",
			);
			setIsSaving(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const applyReadingProgressLocally = useCallback(
		(input: {
			chapterIndex: number;
			readBlockIndex: number;
			readBlockOffset?: number;
			readBlocksVersion: number;
			totalBlocks: number;
			lastVisitedPageIndex?: number;
			studyProgressPercent?: number;
			isCompleted?: boolean;
			completedAt?: string;
		}) => {
			if (input.lastVisitedPageIndex !== undefined) {
				lastVisitedPageByChapterRef.current[input.chapterIndex] =
					input.lastVisitedPageIndex;
			}

			setChapterDetails((currentDetails) => {
				const currentDetail = currentDetails[input.chapterIndex];

				if (!currentDetail) {
					return currentDetails;
				}

				const isCompleted =
					input.isCompleted ?? currentDetail.isCompleted;
				const readBlockIndex = Math.max(
					currentDetail.readBlockIndex,
					input.readBlockIndex,
				);
				const nextDetail = {
					...currentDetail,
					readBlockIndex,
					readBlockOffset:
						readBlockIndex === input.readBlockIndex ?
							input.readBlockOffset
						:	currentDetail.readBlockOffset,
					readBlocksVersion: input.readBlocksVersion,
					totalBlocks: input.totalBlocks,
					lastVisitedPageIndex:
						input.lastVisitedPageIndex ??
						currentDetail.lastVisitedPageIndex,
					isCompleted,
					completedAt:
						isCompleted ?
							(input.completedAt ?? currentDetail.completedAt)
						: 	undefined,
				};

				if (
					currentDetail.readBlockIndex ===
						nextDetail.readBlockIndex &&
					currentDetail.readBlockOffset ===
						nextDetail.readBlockOffset &&
					currentDetail.readBlocksVersion ===
						nextDetail.readBlocksVersion &&
					currentDetail.totalBlocks === nextDetail.totalBlocks &&
					currentDetail.lastVisitedPageIndex ===
						nextDetail.lastVisitedPageIndex &&
					currentDetail.isCompleted === nextDetail.isCompleted &&
					currentDetail.completedAt === nextDetail.completedAt
				) {
					return currentDetails;
				}

				return {
					...currentDetails,
					[input.chapterIndex]: nextDetail,
				};
			});

			setWorkspace((currentWorkspace) => {
				if (!currentWorkspace) {
					return currentWorkspace;
				}

				let didChapterChange = false;
				const chapters = currentWorkspace.chapters.map((chapter) => {
					if (chapter.chapterIndex !== input.chapterIndex) {
						return chapter;
					}

					const isCompleted =
						input.isCompleted ?? chapter.isCompleted;
					const readBlockIndex = Math.max(
						chapter.readBlockIndex,
						input.readBlockIndex,
					);
					const nextChapter = {
						...chapter,
						readBlockIndex,
						readBlockOffset:
							readBlockIndex === input.readBlockIndex ?
								input.readBlockOffset
							:	chapter.readBlockOffset,
						readBlocksVersion: input.readBlocksVersion,
						totalBlocks: input.totalBlocks,
						lastVisitedPageIndex:
							input.lastVisitedPageIndex ??
							chapter.lastVisitedPageIndex,
						isCompleted,
						completedAt:
							isCompleted ?
								(input.completedAt ?? chapter.completedAt)
							: 	undefined,
					};

					didChapterChange =
						chapter.readBlockIndex !== nextChapter.readBlockIndex ||
						chapter.readBlockOffset !==
							nextChapter.readBlockOffset ||
						chapter.readBlocksVersion !==
							nextChapter.readBlocksVersion ||
						chapter.totalBlocks !== nextChapter.totalBlocks ||
						chapter.lastVisitedPageIndex !==
							nextChapter.lastVisitedPageIndex ||
						chapter.isCompleted !== nextChapter.isCompleted ||
						chapter.completedAt !== nextChapter.completedAt;

					return didChapterChange ? nextChapter : chapter;
				});
				const progress =
					input.studyProgressPercent ??
					calculateUnitStudyProgressPercent(chapters, {
						chapterIndex: input.chapterIndex,
						readBlockIndex: input.readBlockIndex,
						totalBlocks: input.totalBlocks,
						isCompleted: input.isCompleted,
					});

				if (!didChapterChange && currentWorkspace.progress === progress) {
					return currentWorkspace;
				}

				return {
					...currentWorkspace,
					progress,
					chapters,
				};
			});
		},
		[],
	);

	const reconcileReadingProgress = useCallback(
		(response: BackendDidacticUnitReadingProgressResponse) => {
			if (!response.module) {
				return;
			}

			applyReadingProgressLocally({
				chapterIndex: response.module.chapterIndex,
				readBlockIndex: response.module.readBlockIndex,
				readBlockOffset: response.module.readBlockOffset,
				readBlocksVersion: response.module.readBlocksVersion,
				totalBlocks: response.module.totalBlocks,
				lastVisitedPageIndex: response.module.lastVisitedPageIndex,
				studyProgressPercent:
					response.studyProgress.studyProgressPercent,
				isCompleted: response.module.isCompleted,
				completedAt: response.module.completedAt,
			});
		},
		[applyReadingProgressLocally],
	);

	const pulseSavedState = () => {
		setIsSaving(true);
		if (saveTimeoutRef.current) {
			window.clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = window.setTimeout(
			() => setIsSaving(false),
			1200,
		);
	};

	const clearStreamingHtmlFlush = useCallback(() => {
		if (streamingHtmlFlushTimeoutRef.current) {
			window.clearTimeout(streamingHtmlFlushTimeoutRef.current);
			streamingHtmlFlushTimeoutRef.current = null;
		}
	}, []);

	const flushStreamingHtml = useCallback(() => {
		clearStreamingHtmlFlush();
		setStreamingHtml(streamingHtmlBufferRef.current);
	}, [clearStreamingHtmlFlush]);

	const resetStreamingHtml = useCallback(() => {
		clearStreamingHtmlFlush();
		streamingHtmlBufferRef.current = "";
		setStreamingHtml("");
	}, [clearStreamingHtmlFlush]);

	const queueStreamingHtmlBlock = useCallback(
		(block: {html: string}) => {
			streamingHtmlBufferRef.current = [
				streamingHtmlBufferRef.current,
				block.html,
			]
				.filter(Boolean)
				.join("\n");

			if (streamingHtmlFlushTimeoutRef.current !== null) {
				return;
			}

			streamingHtmlFlushTimeoutRef.current = window.setTimeout(
				flushStreamingHtml,
				STREAMING_HTML_FLUSH_MS,
			);
		},
		[flushStreamingHtml],
	);

	const refreshWorkspaceAfterGeneration = useCallback(async () => {
		onDataChanged();

		if (!isEditModeRef.current) {
			await loadWorkspace(activeChapterIndexRef.current, {
				silent: true,
				preserveSpread: true,
			});
		}

		pulseSavedState();
	}, [loadWorkspace, onDataChanged]);

	const streamChapterContent = useCallback(
		async (
			chapter: DidacticUnitEditorChapter,
			tier: BackendGenerationQuality,
		) => {
			generationQueueBlockedRef.current = false;
			setActiveChapterIndex(chapter.chapterIndex);
			setCurrentSpread(0);
			setIsEditMode(false);
			setActiveHtmlEditor(null);
			setIsSubmitting(true);
			setIsStreamingGeneration(true);
			setActiveGeneratingChapterIndex(chapter.chapterIndex);
			resetStreamingHtml();

			try {
				const {runId} = await dashboardApi.createGenerationRun(
					didacticUnitId,
					chapter.chapterIndex,
				);
				setActiveRunId(runId);
				await dashboardApi.streamGenerationRun(runId, {
					onPartialHtmlBlock: ({block}) => {
						queueStreamingHtmlBlock(block);
					},
				});

				flushStreamingHtml();
				setUnitGenerationTier((previousTier) => previousTier ?? tier);
				await refreshWorkspaceAfterGeneration();
				await refreshUser();
			} catch (actionError) {
				if (!isCancellingGenerationRef.current) {
					toastError(
						getDashboardErrorMessage(
							actionError,
							"Didactic unit action failed.",
						),
					);
				}
				setIsSaving(false);
				await refreshUser();
			} finally {
				isCancellingGenerationRef.current = false;
				setIsSubmitting(false);
				setIsStreamingGeneration(false);
				setActiveGeneratingChapterIndex(null);
				setActiveRunId(null);
				resetStreamingHtml();
			}
		},
		[
			didacticUnitId,
			flushStreamingHtml,
			queueStreamingHtmlBlock,
			refreshWorkspaceAfterGeneration,
			refreshUser,
			resetStreamingHtml,
		],
	);

	const handlePrimaryGeneration = async (
		tierOverride?: BackendGenerationQuality,
	) => {
		const tier = tierOverride ?? unitGenerationTier;

		if (!activeChapter || !tier) {
			return;
		}

		await streamChapterContent(activeChapter, tier);
	};

	const handleStopActiveGeneration = useCallback(async () => {
		if (!activeRunId || isCancellingGeneration) {
			return;
		}

		setIsCancellingGeneration(true);
		generationQueueBlockedRef.current = true;

		try {
			isCancellingGenerationRef.current = true;
			await dashboardApi.cancelGenerationRun(activeRunId);
			await refreshWorkspaceAfterGeneration();
		} catch (actionError) {
			toastError(
				actionError instanceof Error ?
					actionError.message
				:	"Failed to stop module generation.",
			);
		} finally {
			setIsCancellingGeneration(false);
		}
	}, [
		activeRunId,
		isCancellingGeneration,
		refreshWorkspaceAfterGeneration,
	]);

	const startUnitGenerationQueue = useCallback(async () => {
		if (
			!workspace ||
			!unitGenerationTier ||
			generationQueueBlockedRef.current ||
			isGenerationQueueRunningRef.current
		) {
			return;
		}

		const pendingChapters = workspace.chapters
			.filter((chapter) => chapter.status === "pending")
			.sort((left, right) => left.chapterIndex - right.chapterIndex);

		if (pendingChapters.length === 0) {
			return;
		}

		isGenerationQueueRunningRef.current = true;
		setIsSubmitting(true);
		setIsStreamingGeneration(true);

		try {
			for (const chapter of pendingChapters) {
				setActiveGeneratingChapterIndex(chapter.chapterIndex);
				resetStreamingHtml();

				try {
					const {runId} = await dashboardApi.createGenerationRun(
						didacticUnitId,
						chapter.chapterIndex,
					);
					setActiveRunId(runId);
					await dashboardApi.streamGenerationRun(runId, {
						onPartialHtmlBlock: ({block}) => {
							queueStreamingHtmlBlock(block);
						},
					});

					flushStreamingHtml();
				} catch (actionError) {
					if (!isCancellingGenerationRef.current) {
						toastError(
							actionError instanceof Error ?
								actionError.message
							:	"Module generation failed.",
						);
					}
				} finally {
					isCancellingGenerationRef.current = false;
					await refreshWorkspaceAfterGeneration();
				}

				if (generationQueueBlockedRef.current) {
					break;
				}
			}
		} catch (actionError) {
			generationQueueBlockedRef.current = true;
			if (!isCancellingGenerationRef.current) {
				toastError(
					actionError instanceof Error ?
						actionError.message
					:	"Didactic unit generation failed.",
				);
			}
			isCancellingGenerationRef.current = false;
			setIsSaving(false);
		} finally {
			isGenerationQueueRunningRef.current = false;
			setIsSubmitting(false);
			setIsStreamingGeneration(false);
			setActiveGeneratingChapterIndex(null);
			setActiveRunId(null);
			resetStreamingHtml();
		}
	}, [
		didacticUnitId,
		flushStreamingHtml,
		queueStreamingHtmlBlock,
		refreshWorkspaceAfterGeneration,
		resetStreamingHtml,
		unitGenerationTier,
		workspace,
	]);

	const handleSave = async () => {
		if (!activeChapter || !draft || activeChapter.status !== "ready") {
			return;
		}

		const nextTitle = draft.title.trim();
		const nextHtml = normalizeHtmlForStorage(draft.htmlDraft);

		await runAction(
			() =>
				dashboardApi.updateDidacticUnitChapter(
					didacticUnitId,
					activeChapter.chapterIndex,
					{
						title: nextTitle,
						html: nextHtml || activeChapter.html || "",
						htmlHash: activeChapter.htmlHash,
					},
				),
			{
				chapterIndex: activeChapter.chapterIndex,
				closeEditMode: true,
				silentRefresh: true,
				preserveSpread: true,
			},
		);
	};

	useEffect(() => {
		if (
			!workspace ||
			!unitGenerationTier ||
			generationQueueBlockedRef.current ||
			isGenerationQueueRunningRef.current ||
			isStreamingGeneration
		) {
			return;
		}

		const hasPendingChapters = workspace.chapters.some(
			(chapter) => chapter.status === "pending",
		);

		if (!hasPendingChapters) {
			generationQueueBlockedRef.current = false;
			return;
		}

		void startUnitGenerationQueue();
	}, [
		isStreamingGeneration,
		startUnitGenerationQueue,
		unitGenerationTier,
		workspace,
	]);

	const enterEditMode = () => {
		if (isExerciseOnlySpread) {
			return;
		}

		setActiveHtmlEditor(null);
		setIsEditMode(true);
	};

	const exitEditMode = () => {
		if (!activeChapter) {
			return;
		}

		setDraft(buildDraft(activeChapter, activeChapterDetail));
		setActiveHtmlEditor(null);
		setIsEditMode(false);
	};

	const isRevisionCurrent = (revision: DidacticUnitRevisionViewModel) => {
		if (!activeChapterDetail) {
			return false;
		}

		return (
			activeChapterDetail.title === revision.chapter.title &&
			normalizeStoredHtml(activeChapterDetail.html ?? "") ===
				normalizeStoredHtml(revision.chapter.html)
		);
	};

	const handleRestoreRevision = async (
		revision: DidacticUnitRevisionViewModel,
	) => {
		if (!activeChapter) {
			return;
		}

		await runAction(
			() =>
				dashboardApi.updateDidacticUnitChapter(
					didacticUnitId,
					activeChapter.chapterIndex,
					{
						title: revision.chapter.title,
						html: revision.chapter.html,
						htmlHash: activeChapter.htmlHash,
					},
				),
			{
				chapterIndex: activeChapter.chapterIndex,
				closeEditMode: true,
				silentRefresh: true,
				preserveSpread: true,
			},
		);
	};

	const sendReadingProgress = useCallback(
		async (
			chapter: DidacticUnitEditorChapter,
			visibleTextOffset: number,
			lastVisitedPageIndex?: number,
		): Promise<boolean> => {
			if (
				chapter.status !== "ready" ||
				chapter.totalBlocks === 0
			) {
				return false;
			}

			const nextBlockProgress = mapVisibleTextOffsetToBlockProgress(
				chapter,
				Math.max(0, Math.floor(visibleTextOffset)),
			);
			const nextReadBlockIndex = Math.max(
				chapter.readBlockIndex,
				nextBlockProgress.readBlockIndex,
			);
			const nextReadBlockOffset =
				nextReadBlockIndex === nextBlockProgress.readBlockIndex ?
					nextBlockProgress.readBlockOffset
				:	chapter.readBlockOffset;
			const didReadAdvance =
				nextReadBlockIndex > chapter.readBlockIndex ||
				(nextReadBlockIndex === chapter.readBlockIndex &&
					(nextReadBlockOffset ?? 0) >
						(chapter.readBlockOffset ?? 0));
			const didVisitPage =
				lastVisitedPageIndex !== undefined &&
				lastVisitedPageIndex !== chapter.lastVisitedPageIndex;

			if (!didReadAdvance && !didVisitPage) {
				return true;
			}

			const payloadKey = [
				chapter.chapterIndex,
				chapter.htmlBlocksVersion,
				chapter.totalBlocks,
				nextReadBlockIndex,
				nextReadBlockOffset ?? "",
				lastVisitedPageIndex ?? "",
			].join(":");

			if (lastReadingProgressPayloadRef.current === payloadKey) {
				return true;
			}

			lastReadingProgressPayloadRef.current = payloadKey;

			applyReadingProgressLocally({
				chapterIndex: chapter.chapterIndex,
				readBlockIndex: nextReadBlockIndex,
				readBlockOffset: nextReadBlockOffset,
				readBlocksVersion: chapter.htmlBlocksVersion,
				totalBlocks: chapter.totalBlocks,
				lastVisitedPageIndex,
			});

			const requestId = readingProgressRequestIdRef.current + 1;
			readingProgressRequestIdRef.current = requestId;

			try {
				const response =
					await dashboardApi.updateDidacticUnitReadingProgress(
						didacticUnitId,
						chapter.chapterIndex,
						{
							readBlockIndex: nextReadBlockIndex,
							...(nextReadBlockOffset !== undefined ?
								{readBlockOffset: nextReadBlockOffset}
							: 	{}),
						},
						lastVisitedPageIndex,
					);

				if (requestId === readingProgressRequestIdRef.current) {
					reconcileReadingProgress(response);
					onDataChanged();
				}
				return true;
			} catch (actionError) {
				if (requestId !== readingProgressRequestIdRef.current) {
					return true;
				}

				lastReadingProgressPayloadRef.current = null;

				toastError(
					actionError instanceof Error ?
						actionError.message
					:	"Didactic unit reading progress update failed.",
				);
				await loadWorkspace(chapter.chapterIndex, {
					silent: true,
					preserveSpread: true,
				});
				return false;
			}
		},
		[
			applyReadingProgressLocally,
			didacticUnitId,
			loadWorkspace,
			onDataChanged,
			reconcileReadingProgress,
		],
	);

	const flushReadingProgressSaveQueue = useCallback(() => {
		if (isReadingProgressSaveInFlightRef.current) {
			return;
		}

		const pendingSave = pendingReadingProgressSaveRef.current;
		if (!pendingSave) {
			return;
		}

		pendingReadingProgressSaveRef.current = null;
		isReadingProgressSaveInFlightRef.current = true;

		void (async () => {
			const didPersist = await sendReadingProgress(
				pendingSave.chapter,
				pendingSave.visibleTextOffset,
				pendingSave.lastVisitedPageIndex,
			);
			pendingSave.resolve(didPersist);
			isReadingProgressSaveInFlightRef.current = false;
			flushReadingProgressSaveQueue();
		})();
	}, [sendReadingProgress]);

	const persistReadProgress = useCallback(
		(
			chapter: DidacticUnitEditorChapter,
			visibleTextOffset: number,
			lastVisitedPageIndex?: number,
		): Promise<boolean> => {
			if (
				chapter.status !== "ready" ||
				chapter.totalBlocks === 0
			) {
				return Promise.resolve(false);
			}

			const nextBlockProgress = mapVisibleTextOffsetToBlockProgress(
				chapter,
				Math.max(0, Math.floor(visibleTextOffset)),
			);
			const nextReadBlockIndex = Math.max(
				chapter.readBlockIndex,
				nextBlockProgress.readBlockIndex,
			);
			const nextReadBlockOffset =
				nextReadBlockIndex === nextBlockProgress.readBlockIndex ?
					nextBlockProgress.readBlockOffset
				:	chapter.readBlockOffset;
			const didReadAdvance =
				nextReadBlockIndex > chapter.readBlockIndex ||
				(nextReadBlockIndex === chapter.readBlockIndex &&
					(nextReadBlockOffset ?? 0) >
						(chapter.readBlockOffset ?? 0));
			const didVisitPage =
				lastVisitedPageIndex !== undefined &&
				lastVisitedPageIndex !== chapter.lastVisitedPageIndex;

			if (!didReadAdvance && !didVisitPage) {
				return Promise.resolve(true);
			}

			applyReadingProgressLocally({
				chapterIndex: chapter.chapterIndex,
				readBlockIndex: nextReadBlockIndex,
				readBlockOffset: nextReadBlockOffset,
				readBlocksVersion: chapter.htmlBlocksVersion,
				totalBlocks: chapter.totalBlocks,
				lastVisitedPageIndex,
			});

			return new Promise((resolve) => {
				if (pendingReadingProgressSaveRef.current) {
					pendingReadingProgressSaveRef.current.resolve(true);
				}

				pendingReadingProgressSaveRef.current = {
					chapter,
					visibleTextOffset,
					lastVisitedPageIndex,
					resolve,
				};
				flushReadingProgressSaveQueue();
			});
		},
		[applyReadingProgressLocally, flushReadingProgressSaveQueue],
	);

	const handlePostModulePrimaryAction = useCallback(async () => {
		if (!workspace || !activeChapter || isPostModuleActionPending) {
			return;
		}

		setIsPostModuleActionPending(true);

		const didPersist = await persistReadProgress(
			activeChapter,
			activeChapter.htmlBlocks.at(-1)?.textEndOffset ?? 0,
			Math.max(0, readPages.length - 1),
		);

		if (!didPersist) {
			setIsPostModuleActionPending(false);
			return;
		}

		try {
			await dashboardApi.completeDidacticUnitChapter(
				didacticUnitId,
				activeChapter.chapterIndex,
			);
			onDataChanged();
		} catch (error) {
			setIsPostModuleActionPending(false);
			toastError(
				error instanceof Error ?
					error.message
				:	"Could not save module completion.",
			);
			return;
		}

		const nextChapter =
			workspace.chapters.find(
				(chapter) =>
					chapter.chapterIndex === activeChapter.chapterIndex + 1,
			) ?? null;

		if (nextChapter) {
			await loadWorkspace(nextChapter.chapterIndex, {
				silent: true,
			});
			setIsPostModuleActionPending(false);
			return;
		}

		setIsPostModuleActionPending(false);
		setIsUnitCompleteModalOpen(true);
	}, [
		activeChapter,
		didacticUnitId,
		isPostModuleActionPending,
		loadWorkspace,
		onDataChanged,
		persistReadProgress,
		readPages.length,
		workspace,
	]);

	const totalVisiblePages =
		isEditMode ?
			Math.max(visibleEditablePages.length, 1)
		:	Math.max(readPages.length, 1);
	const pagesPerSpread = spreadMetrics.pagesPerSpread;
	const totalSpreads = Math.max(
		1,
		Math.ceil(totalVisiblePages / pagesPerSpread),
	);
	const canGoPrev = currentSpread > 0;
	const canGoNext = currentSpread < totalSpreads - 1;

	const persistVisitedSpread = useCallback(
		(nextSpread: number) => {
			if (
				isEditMode ||
				!activeChapter ||
				readPages.length === 0
			) {
				return;
			}

			const lastVisitedPageIndex = Math.max(
				0,
				Math.min(
					nextSpread * pagesPerSpread + pagesPerSpread - 1,
					readPages.length - 1,
				),
			);
			const visibleTextOffset = getReadTextOffsetForSpread(
				measuredReadPages,
				nextSpread,
				pagesPerSpread,
			);

			void persistReadProgress(
				activeChapter,
				visibleTextOffset,
				lastVisitedPageIndex,
			);
		},
		[
			activeChapter,
			isEditMode,
			measuredReadPages,
			pagesPerSpread,
			persistReadProgress,
			readPages.length,
		],
	);

	const goToSpreadIndex = useCallback(
		(spreadIndex: number) => {
			const nextSpread = Math.max(
				0,
				Math.min(spreadIndex, totalSpreads - 1),
			);

			setSelectedOutlineItemId(null);
			setCurrentSpread(nextSpread);
			persistVisitedSpread(nextSpread);
		},
		[persistVisitedSpread, totalSpreads],
	);

	const goToPageIndex = useCallback(
		(pageIndex: number, outlineItemId?: string) => {
			const nextSpread = Math.max(
				0,
				Math.min(Math.floor(pageIndex / pagesPerSpread), totalSpreads - 1),
			);

			setSelectedOutlineItemId(outlineItemId ?? null);
			setCurrentSpread(nextSpread);
			persistVisitedSpread(nextSpread);
		},
		[pagesPerSpread, persistVisitedSpread, totalSpreads],
	);

	const goToNextSpread = useCallback(() => {
		if (!canGoNext) {
			return;
		}

		const nextSpread = Math.min(currentSpread + 1, totalSpreads - 1);
		if (nextSpread === currentSpread) {
			return;
		}

		setCurrentSpread(nextSpread);
		setSelectedOutlineItemId(null);
		persistVisitedSpread(nextSpread);
	}, [
		canGoNext,
		currentSpread,
		persistVisitedSpread,
		totalSpreads,
	]);

	const goToPrevSpread = useCallback(() => {
		const nextSpread = Math.max(currentSpread - 1, 0);
		if (nextSpread === currentSpread) {
			return;
		}

		setCurrentSpread(nextSpread);
		setSelectedOutlineItemId(null);
		persistVisitedSpread(nextSpread);
	}, [currentSpread, persistVisitedSpread]);

	useEffect(() => {
		if (currentSpread > totalSpreads - 1) {
			setCurrentSpread(Math.max(0, totalSpreads - 1));
		}
	}, [currentSpread, totalSpreads]);

	const activeOutlineItemId = useMemo(() => {
		if (moduleOutline.length === 0) {
			return null;
		}

		if (
			selectedOutlineItemId &&
			moduleOutline.some((item) => item.id === selectedOutlineItemId)
		) {
			return selectedOutlineItemId;
		}

		const visibleEndPageIndex = Math.min(
			currentSpread * pagesPerSpread + pagesPerSpread - 1,
			totalVisiblePages - 1,
		);
		const activeItem = moduleOutline
			.filter((item) => item.pageIndex <= visibleEndPageIndex)
			.at(-1);

		return activeItem?.id ?? null;
	}, [
		currentSpread,
		moduleOutline,
		pagesPerSpread,
		selectedOutlineItemId,
		totalVisiblePages,
	]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isEditModeRef.current) {
				return;
			}

			if (event.key === "ArrowRight") {
				goToNextSpread();
			}

			if (event.key === "ArrowLeft") {
				goToPrevSpread();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [goToNextSpread, goToPrevSpread]);

	const handleTextStyleChange = useCallback(
		(textStyle: EditorTextStyle) => {
			const userChangedSize =
				displayTextStyle?.sizeProfile !== textStyle.sizeProfile;
			if (userChangedSize) {
				markEditorTextSizePreference(didacticUnitId);
				setHasUserTextSizePreference(true);
			}

			const persistedTextStyle =
				!userChangedSize &&
				!hasUserTextSizePreference &&
				shouldUseCompactDesktopTextSizeDefault &&
				textStyle.sizeProfile === "small" ?
					{...textStyle, sizeProfile: "regular" as const}
				:	textStyle;
			const draftTextStyle =
				userChangedSize ? textStyle : persistedTextStyle;

			setDraft((previous) =>
				previous ?
					{
						...previous,
						textStyle: draftTextStyle,
					}
				:	previous,
			);
			const presentationTheme = themeFromTextStyle(
				resolvedTheme,
				persistedTextStyle,
			);
			setWorkspace((previous) =>
				previous ?
					{
						...previous,
						presentationTheme,
						chapters: previous.chapters.map((chapter) => ({
							...chapter,
							textStyle: draftTextStyle,
						})),
					}
				:	previous,
			);
			void dashboardApi
				.updateDidacticUnitTheme(didacticUnitId, presentationTheme)
				.catch((error) => {
					toastError(
						error instanceof Error ?
							error.message
						:	"Could not update the unit style.",
					);
				});
		},
		[
			didacticUnitId,
			displayTextStyle?.sizeProfile,
			hasUserTextSizePreference,
			resolvedTheme,
			shouldUseCompactDesktopTextSizeDefault,
		],
	);

	const loadingFallback = (
		<div className="flex h-screen w-full items-center justify-center bg-[#F5F5F7]">
			<Loader2 size={32} className="animate-spin text-[#86868B]" />
		</div>
	);

	if (isLoading) {
		return loadingFallback;
	}

	if (!workspace || !activeChapter || !draft) {
		return loadingFallback;
	}

	const getStatusIcon = (chapter: DidacticUnitEditorChapter) => {
		const isGenerating =
			isStreamingGeneration &&
			activeGeneratingChapterIndex !== null &&
			activeGeneratingChapterIndex === chapter.chapterIndex;
		const readProgress =
			chapter.totalBlocks > 0 ?
				Math.min(
					1,
					Math.max(0, (chapter.readBlockIndex + 1) / chapter.totalBlocks),
				)
			:	0;
		return (
			<ChapterStatusIcon
				status={chapter.status}
				isCompleted={chapter.isCompleted}
				isGenerating={isGenerating}
				progress={readProgress}
			/>
		);
	};

	const isPendingChapter = activeChapter.status === "pending";
	const isFailedChapter = activeChapter.status === "failed";
	const hasConfiguredGenerationTier = unitGenerationTier !== null;
	const regenerationCost =
		unitGenerationTier ?
			getModuleRegenerationCost({
				quality: unitGenerationTier,
				length: workspace.length,
			})
		:	null;
	const canPayRegeneration =
		!regenerationCost ||
		(user?.credits[regenerationCost.coinType] ?? 0) >=
			regenerationCost.amount;
	const contentPageOffset = currentSpread * pagesPerSpread;
	const leftReadPage = readPages[contentPageOffset];
	const rightReadPage =
		pagesPerSpread > 1 ? readPages[contentPageOffset + 1] : undefined;
	const visibleReadPages = [leftReadPage, rightReadPage].filter(
		(page): page is ReadPage => page !== undefined,
	);
	const isExerciseOnlySpread =
		!isEditMode &&
		visibleReadPages.length > 0 &&
		visibleReadPages.every((page) => page.kind === "learning_activity");
	const leftEditablePage = visibleEditablePages[contentPageOffset];
	const rightEditablePage =
		pagesPerSpread > 1 ?
			visibleEditablePages[contentPageOffset + 1]
		:	undefined;
	const spreadStartPage = contentPageOffset + 1;
	const hasRightPage =
		isEditMode ?
			rightEditablePage !== undefined
		:	rightReadPage !== undefined;
	const spreadEndPage =
		hasRightPage ?
			Math.min(contentPageOffset + pagesPerSpread, totalVisiblePages)
		:	spreadStartPage;
	const spreadPageShortLabel =
		spreadMetrics.isMobile ? `${spreadStartPage} / ${totalVisiblePages}`
		: spreadStartPage === spreadEndPage ?
			`${spreadStartPage} / ${totalVisiblePages}`
		:	`${spreadStartPage}-${spreadEndPage} / ${totalVisiblePages}`;
	const pageWheelOptions: WheelPickerOption<number>[] =
		spreadMetrics.isMobile ?
			Array.from({length: totalVisiblePages}, (_, pageIndex) => ({
				label: `${pageIndex + 1}`,
				textValue: `${pageIndex + 1} / ${totalVisiblePages}`,
				value: pageIndex,
			}))
		:	Array.from({length: totalSpreads}, (_, spreadIndex) => {
				const startPage = spreadIndex * pagesPerSpread + 1;
				const endPage = Math.min(
					startPage + pagesPerSpread - 1,
					totalVisiblePages,
				);
				const label =
					startPage === endPage ? `${startPage}` : `${startPage}-${endPage}`;

				return {
					label,
					textValue: `${label} / ${totalVisiblePages}`,
					value: spreadIndex,
				};
			});
	const pageWheelValue =
		spreadMetrics.isMobile ? contentPageOffset : currentSpread;

	const updatePaginatedContentPage = (
		pageIndex: number,
		html: string,
	) => {
		setContentPageDrafts((previous) => {
			const nextPages =
				previous.length > 0 ? [...previous] : [...visibleEditablePages];

			while (pageIndex >= nextPages.length) {
				nextPages.push("");
			}

			nextPages[pageIndex] = html;

			setDraft((currentDraft) =>
				currentDraft ?
					{
						...currentDraft,
						htmlDraft: normalizeHtmlForStorage(
							nextPages
								.filter((page) => page.trim().length > 0)
								.join("\n\n"),
						),
					}
				:	currentDraft,
			);

			return nextPages;
		});
	};

	const handlePrintTheoryExport = async () => {
		if (isPrintingTheory) {
			return;
		}

		setIsPrintingTheory(true);
		try {
			const snapshot = await buildUnitExportSnapshot(didacticUnitId);
			setPrintSnapshot(snapshot);
			setIsExportDialogOpen(false);
			requestPrint();
		} catch (error) {
			toastError(
				error instanceof Error ?
					error.message
				:	"Could not prepare the PDF export.",
			);
		} finally {
			setIsPrintingTheory(false);
		}
	};

	const handleDownloadActivitiesExport = async () => {
		if (isDownloadingActivities) {
			return;
		}

		setIsDownloadingActivities(true);
		try {
			const snapshot = await buildUnitExportSnapshot(didacticUnitId);
			const html = buildActivitiesHtmlDocument(snapshot);
			downloadTextFile(
				sanitizeExportFilename(snapshot.unit.title),
				html,
			);
			setIsExportDialogOpen(false);
		} catch (error) {
			toastError(
				error instanceof Error ?
					error.message
				:	"Could not export the activities HTML.",
			);
		} finally {
			setIsDownloadingActivities(false);
		}
	};

	const handleCreateLearningActivity = async () => {
		if (!activeChapter || isActivityLoading) {
			return;
		}

		setIsActivityLoading(true);
		try {
			const {activity} = await dashboardApi.createLearningActivity(
				didacticUnitId,
				activeChapter.chapterIndex,
				{
					scope: activityScope,
					type: activityType,
					quality: activityQuality,
				},
			);
			const {activities} = await dashboardApi.listLearningActivities(
				didacticUnitId,
				activeChapter.chapterIndex,
			);
			setLearningActivities((previous) => ({
				...previous,
				[activeChapter.chapterIndex]: activities,
			}));
			setActivityAttempts((previous) => ({
				...previous,
				[activity.id]: [],
			}));
			void refreshUser();

			const refreshedReadPages = buildReadPages(
				measuredReadPages,
				activities,
			);
			const targetPageIndex = findLearningActivityPageIndex(
				refreshedReadPages,
				activity.id,
			);
			if (targetPageIndex >= 0) {
				const targetSpread = Math.floor(targetPageIndex / pagesPerSpread);
				setCurrentSpread(targetSpread);
				setSelectedOutlineItemId(`activity-${activity.id}`);
				void persistReadProgress(
					activeChapter,
					getReadTextOffsetForSpread(
						measuredReadPages,
						targetSpread,
						pagesPerSpread,
					),
					targetPageIndex,
				);
			}
			setIsActivityModalOpen(false);
		} catch (error) {
			toastError(
				getDashboardErrorMessage(error, "Could not create the activity."),
			);
		} finally {
			setIsActivityLoading(false);
		}
	};

	const handleLearningActivityAttempt = async (
		activityId: string,
		answers: unknown,
	) => {
		if (isActivityAttemptSubmitting) {
			return;
		}

		setIsActivityAttemptSubmitting(true);
		try {
			const {attempt} = await dashboardApi.createLearningActivityAttempt(
				activityId,
				answers,
			);
			setActivityAttempts((previous) => ({
				...previous,
				[activityId]: [...(previous[activityId] ?? []), attempt],
			}));
		} catch (error) {
			toastError(
				error instanceof Error ?
					error.message
				:	"Could not check this activity.",
			);
		} finally {
			setIsActivityAttemptSubmitting(false);
		}
	};

	const handleRefillActivityAttempts = async (activityId: string) => {
		try {
			const {activity} = await dashboardApi.refillActivityAttempts(activityId);
			setLearningActivities((previous) => {
				const chapterActivities = previous[activity.chapterIndex] ?? [];
				return {
					...previous,
					[activity.chapterIndex]: chapterActivities.map((a) =>
						a.id === activity.id ? activity : a,
					),
				};
			});
			void refreshUser();
		} catch (error) {
			toastError(
				getDashboardErrorMessage(error, "Could not refill attempts."),
			);
			throw error;
		}
	};

	const handleDeleteLearningActivity = async (activityId: string) => {
		try {
			await dashboardApi.deleteLearningActivity(activityId);
			setLearningActivities((previous) => {
				const next: Record<number, BackendLearningActivity[]> = {};
				for (const [chapterIndex, activities] of Object.entries(previous)) {
					next[Number(chapterIndex)] = activities.filter(
						(activity) => activity.id !== activityId,
					);
				}
				return next;
			});
			setActivityAttempts((previous) => {
				const next = {...previous};
				delete next[activityId];
				return next;
			});
		} catch (error) {
			toastError(
				error instanceof Error ?
					error.message
				:	"Could not delete this activity.",
			);
			throw error;
		}
	};

	const postModuleCompletionStyle = resolvePostModuleCompletionStyle(
		draft.textStyle.stylePreset,
		resolvedMode === "dark",
	);
	const headerIconButtonClass =
		"flex h-10 w-10 items-center justify-center rounded-full border border-[#D4D7DD] bg-white text-[#1D1D1F] transition-all hover:border-[#34C759] hover:bg-[#F7FFF9] hover:text-[#34C759] active:border-[#34C759] active:text-[#34C759]";
	const usesTightPostModuleLayout =
		compactModuleTitle && spreadMetrics.pageHeight < 580;

	const renderPostModuleActionBody = ({
		hasNextModule,
		primaryActionLabel,
	}: {
		hasNextModule: boolean;
		primaryActionLabel: string;
	}) => (
		<div
			className={cn(
				"flex-shrink-0 rounded-[22px]",
				usesTightPostModuleLayout ? "p-2"
				: compactModuleTitle ? "p-3"
				: "p-5",
			)}
			style={{
				color: postModuleCompletionStyle.bodyColor,
				fontFamily: postModuleCompletionStyle.bodyFamily,
			}}
		>
			<div className="text-center">
				<div
					className={cn(
						"mx-auto items-center justify-center rounded-full border",
						usesTightPostModuleLayout ? "hidden"
						: compactModuleTitle ? "flex h-9 w-9"
						: "flex h-11 w-11",
					)}
					style={{
						backgroundColor: postModuleCompletionStyle.accentSoft,
						borderColor: postModuleCompletionStyle.tipBorder,
						color: postModuleCompletionStyle.accent,
					}}
				>
					<CheckCircle2 size={compactModuleTitle ? 18 : 22} />
				</div>
				<div
					className={cn(
						"text-[11px] font-bold uppercase tracking-[0.24em]",
						usesTightPostModuleLayout ? "mt-0"
						: compactModuleTitle ? "mt-2"
						: "mt-3",
					)}
					style={{color: postModuleCompletionStyle.accentText}}
				>
					Next steps
				</div>
				<h3
					className={cn(
						"mt-1 font-bold tracking-tight",
						compactModuleTitle ? "text-xl" : "text-2xl",
					)}
					style={{
						color: postModuleCompletionStyle.headingColor,
						fontFamily: postModuleCompletionStyle.headingFamily,
					}}
				>
					Module complete
				</h3>
				<p
					className={cn(
						"mx-auto max-w-[460px] text-sm",
						compactModuleTitle ? "mt-1 leading-snug" : "mt-2 leading-relaxed",
					)}
					style={{color: postModuleCompletionStyle.bodyColor}}
				>
					You have finished the theory part. Practice now or continue to the next topic.
				</p>
			</div>

			<div
				className={cn(
					"mx-auto grid w-full",
					usesTightPostModuleLayout ? "mt-3 max-w-[440px] gap-2.5"
					: compactModuleTitle ? "mt-4 max-w-[460px] gap-3"
					: "mt-6 gap-4",
				)}
			>
				<button
					className={cn(
						"group flex w-full flex-col text-left text-white transition-all hover:-translate-y-0.5",
						usesTightPostModuleLayout ?
							"min-h-[112px] rounded-[16px] p-3"
						: compactModuleTitle ?
							"min-h-[124px] rounded-[18px] p-4"
						:	"min-h-[164px] rounded-[20px] p-5",
					)}
					onClick={() => setIsActivityModalOpen(true)}
					style={{
						backgroundColor:
							postModuleCompletionStyle.primaryBackground,
						fontFamily: postModuleCompletionStyle.bodyFamily,
					}}
					type="button"
				>
					<span className="flex w-full items-start justify-between gap-3">
						<span
							className={cn(
								"flex items-center justify-center rounded-xl",
								usesTightPostModuleLayout ? "h-9 w-9"
								: compactModuleTitle ? "h-10 w-10"
								: "h-11 w-11",
							)}
							style={{
								backgroundColor:
									postModuleCompletionStyle.primaryIconBackground,
								color: postModuleCompletionStyle.accentText,
							}}
						>
							<Dumbbell
								size={
									usesTightPostModuleLayout ? 17
									: compactModuleTitle ? 18
									: 20
								}
							/>
						</span>
						<span
							className={cn(
								"rounded-full bg-white font-bold",
								usesTightPostModuleLayout ? "px-2.5 py-1 text-[10px]"
								: "px-3 py-1 text-[11px]",
							)}
							style={{
								color: postModuleCompletionStyle.accentText,
							}}
						>
							Recommended
						</span>
					</span>
					<span
						className={cn(
							"flex w-full items-center gap-3",
							usesTightPostModuleLayout ? "mt-3"
							: compactModuleTitle ? "mt-4"
							: "mt-5",
						)}
					>
						<span className="min-w-0 flex-1">
							<span
								className={cn(
									"block font-bold",
									usesTightPostModuleLayout ? "text-base"
									: compactModuleTitle ? "text-[17px]"
									: "text-lg",
								)}
								style={{fontFamily: postModuleCompletionStyle.headingFamily}}
							>
								Exercises & Practice
							</span>
							<span className={cn(
								"block text-sm font-medium text-white/75",
								compactModuleTitle ? "mt-1 leading-snug" : "mt-2 leading-relaxed",
							)}>
								Apply what you learned with guided exercises.
							</span>
						</span>
						<ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
					</span>
				</button>
				<button
					className={cn(
						"group flex w-full flex-col border border-[#E5E5E7] bg-white text-left text-[#0F0F12] transition-all hover:-translate-y-0.5 hover:border-[#0F0F12] disabled:cursor-not-allowed disabled:opacity-60",
						usesTightPostModuleLayout ?
							"min-h-[112px] rounded-[16px] p-3"
						: compactModuleTitle ?
							"min-h-[124px] rounded-[18px] p-4"
						:	"min-h-[164px] rounded-[20px] p-5",
					)}
					disabled={isPostModuleActionPending}
					onClick={() => {
						void handlePostModulePrimaryAction();
					}}
					type="button"
					style={{
						borderColor: postModuleCompletionStyle.panelBorder,
						color: postModuleCompletionStyle.headingColor,
						fontFamily: postModuleCompletionStyle.bodyFamily,
					}}
				>
					<span className="flex w-full items-start justify-between gap-3">
						<span
							className={cn(
								"flex items-center justify-center rounded-xl",
								usesTightPostModuleLayout ? "h-9 w-9"
								: compactModuleTitle ? "h-10 w-10"
								: "h-11 w-11",
							)}
							style={{
								backgroundColor:
									postModuleCompletionStyle.secondaryIconBackground,
								color: postModuleCompletionStyle.accent,
							}}
						>
							<BookOpenCheck
								size={
									usesTightPostModuleLayout ? 17
									: compactModuleTitle ? 18
									: 20
								}
							/>
						</span>
						<span
							className={cn(
								"rounded-full font-bold",
								usesTightPostModuleLayout ? "px-2.5 py-1 text-[10px]"
								: "px-3 py-1 text-[11px]",
							)}
							style={{
								backgroundColor:
									postModuleCompletionStyle.badgeBackground,
								color: postModuleCompletionStyle.accentText,
							}}
						>
							Continue
						</span>
					</span>
					<span
						className={cn(
							"flex w-full items-center gap-3",
							usesTightPostModuleLayout ? "mt-3"
							: compactModuleTitle ? "mt-4"
							: "mt-5",
						)}
					>
						<span className="min-w-0 flex-1">
							<span
								className={cn(
									"block font-bold",
									usesTightPostModuleLayout ? "text-base"
									: compactModuleTitle ? "text-[17px]"
									: "text-lg",
								)}
								style={{
									color: postModuleCompletionStyle.headingColor,
									fontFamily: postModuleCompletionStyle.headingFamily,
								}}
							>
								{primaryActionLabel}
							</span>
							<span
								className={cn(
									"block text-sm font-medium",
									compactModuleTitle ? "mt-1 leading-snug" : "mt-2 leading-relaxed",
								)}
								style={{color: postModuleCompletionStyle.bodyColor}}
							>
								{hasNextModule ?
									"Move forward when you are ready."
								:	"Finish this unit and return to your dashboard."
								}
							</span>
						</span>
						<ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
					</span>
				</button>
			</div>
			<div
				className={cn(
					"mx-auto w-fit border text-center text-sm",
					usesTightPostModuleLayout ?
						"mt-3 rounded-xl px-3 py-2 text-[12px] leading-snug"
					: compactModuleTitle ?
						"mt-4 rounded-xl px-4 py-2.5 text-[13px] leading-snug"
					:	"mt-5 rounded-2xl px-4 py-3",
				)}
				style={{
					backgroundColor: postModuleCompletionStyle.tipBackground,
					borderColor: postModuleCompletionStyle.tipBorder,
					color: postModuleCompletionStyle.bodyColor,
				}}
			>
				<span
					className="font-semibold"
					style={{color: postModuleCompletionStyle.accentText}}
				>
					Tip:
				</span>{" "}
				Practicing now helps retain the concepts before moving on.
			</div>
			<Dialog open={isActivityModalOpen} onOpenChange={setIsActivityModalOpen}>
				<DialogContent className="app-activity-create-modal max-h-[88vh] overflow-x-hidden overflow-y-auto sm:max-w-[760px]">
					<DialogHeader className="max-[1599px]:px-5 max-[1599px]:pb-3 max-[1599px]:pt-4">
						<DialogTitle>Exercises & Practice</DialogTitle>
						<DialogDescription>
							{hasNextModule ?
								"Create a structured activity before moving to the next module."
							:	"Create a structured activity to close out this unit."
							}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-6 px-6 py-5 max-[1599px]:space-y-3 max-[1599px]:px-5 max-[1599px]:py-3">
						<div className="app-activity-create-scope rounded-[18px] bg-[#F5F5F7] p-1 max-[1599px]:rounded-[15px]">
							<div className="grid grid-cols-2 gap-1">
								{[
									{value: "current_module" as const, label: "Current module", icon: BookOpenCheck},
									{value: "cumulative_until_module" as const, label: "All past modules", icon: History},
								].map((option) => {
									const TabIcon = option.icon;
									const selected = activityScope === option.value;
									return (
										<button
											key={option.value}
											type="button"
											onClick={() => setActivityScope(option.value)}
											className={cn(
												"app-activity-create-scope-option flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-bold transition max-[1599px]:rounded-[12px] max-[1599px]:py-2",
												selected ?
													"app-activity-create-scope-option-selected bg-white text-[#16A34A] shadow-sm ring-1 ring-[#4ADE80]"
												:	"text-[#6B7280] hover:text-[#0F0F12]",
											)}
										>
											<TabIcon size={15} />
											{option.label}
										</button>
									);
								})}
							</div>
						</div>

						<div className="-mx-6 border-t border-[#F0F0F2] max-[1599px]:-mx-5" />

						<div>
							<div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#86868B] max-[1599px]:mb-2">
								Activity type
							</div>
							<div className="grid gap-2 sm:grid-cols-2">
								{ACTIVITY_OPTIONS.map((option) => {
									const Icon = option.icon;
									const selected = activityType === option.type;
									return (
										<button
											key={option.type}
											type="button"
											onClick={() => setActivityType(option.type)}
											className={cn(
												"app-activity-create-option relative flex items-start gap-3 rounded-2xl border p-3 text-left transition max-[1599px]:gap-2.5 max-[1599px]:rounded-[13px] max-[1599px]:p-2",
												selected ?
													"app-activity-create-option-selected border-[#4ADE80] bg-[#F0FDF4] text-[#0F0F12]"
												:	"border-[#E5E5E7] bg-white text-[#0F0F12] hover:border-[#D1D5DB]",
											)}
										>
											{selected && (
												<CheckCircle2
													size={16}
													className="absolute right-3 top-3 text-[#16A34A]"
													fill="white"
												/>
											)}
											<span
												className={cn(
													"app-activity-create-option-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl max-[1599px]:h-8 max-[1599px]:w-8 max-[1599px]:rounded-[10px]",
													selected ?
														"app-activity-create-option-icon-selected bg-[#DCFCE7] text-[#16A34A]"
													:	"bg-[#F3F4F6] text-[#0F0F12]",
												)}
											>
												<Icon size={17} />
											</span>
											<span>
												<span className="block text-sm font-bold">{option.label}</span>
												<span className="mt-1 block text-xs leading-relaxed text-[#6B7280] max-[1599px]:mt-0.5 max-[1599px]:leading-snug">
													{option.description}
												</span>
											</span>
										</button>
									);
								})}
							</div>
						</div>

						<div className="-mx-6 border-t border-[#F0F0F2] max-[1599px]:-mx-5" />

						<div>
							<div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#86868B] max-[1599px]:mb-2">
								Model
							</div>
							<div className="grid gap-2 sm:grid-cols-2">
								{generationModelOptions.map((option) => {
									const selected = activityQuality === option.quality;
									return (
										<button
											key={option.quality}
											type="button"
											onClick={() => setActivityQuality(option.quality)}
											className={cn(
												"app-activity-create-model relative flex h-[58px] items-center gap-3 rounded-2xl border px-3 text-left transition max-[1599px]:h-[48px] max-[1599px]:rounded-[13px]",
												selected ?
													"app-activity-create-model-selected border-[#4ADE80] bg-white"
												:	"border-[#E5E5E7] bg-[#F8F8F9] hover:border-[#D1D5DB]",
											)}
										>
											{selected && (
												<span className="absolute right-3 top-1/2 -translate-y-1/2">
													<CoinAmount
														type={
															getActivityGenerationCost({
																quality: option.quality,
															}).coinType
														}
														amount={
															getActivityGenerationCost({
																quality: option.quality,
															}).amount
														}
														size={16}
													/>
												</span>
											)}
											<span className="flex h-9 w-9 shrink-0 items-center justify-center max-[1599px]:h-8 max-[1599px]:w-8">
												{option.icon ? (
													<img
														src={option.icon}
														alt=""
														className="h-6 w-6 object-contain"
													/>
												) : (
													<Brain size={18} className="text-[#0F0F12]" />
												)}
											</span>
											<span className="min-w-0 pr-14">
												<span className="block truncate text-sm font-bold text-[#0F0F12]">
													{option.label}
												</span>
											</span>
										</button>
									);
								})}
							</div>
						</div>

					</div>

					<DialogFooter className="app-activity-create-footer max-[1599px]:px-5 max-[1599px]:py-3">
						<span className="mr-auto inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[#0F0F12]">
							Current balance:
							<span className="inline-flex items-center gap-2">
								{VISIBLE_COIN_TYPES.map((coinType) => (
									<CoinAmount
										key={coinType}
										type={coinType}
										amount={user?.credits[coinType] ?? 0}
										size={16}
									/>
								))}
							</span>
						</span>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsActivityModalOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							disabled={isActivityLoading}
							onClick={() => {
								void handleCreateLearningActivity();
							}}
							className="gap-2 bg-[#4ADE80] text-[#0F0F12] hover:bg-[#3BCD6F]"
						>
							{isActivityLoading ?
								<Loader2 size={16} className="animate-spin" />
							:	<CirclePlus size={16} />
							}
							{isActivityLoading ? "Creating..." : "Create activity"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
	const unitPageBackground =
		(resolvedThemeVars as Record<string, string | undefined>)[
			"--unit-page-bg"
		] ?? "#ffffff";
	const compactPagePaddingStyle = compactModuleTitle ?
		{padding: "12px 17px"}
	:	undefined;

	const renderContentPage = ({
		editable,
		html,
		extraContent,
		pageIndex,
		pageNumber,
		pageStartOffset = 0,
		pageEndOffset = 0,
	}: {
		editable: boolean;
		html: string | undefined;
		extraContent?: ReactNode;
		pageIndex: number;
		pageNumber: number;
		pageStartOffset?: number;
		pageEndOffset?: number;
	}) => {
		const renderedHtml =
			!editable && activeChapter && pageEndOffset > pageStartOffset ?
				applyNoteMarksToPageHtml({
					html: html ?? "",
					pageStartOffset,
					pageEndOffset,
					chapter: activeChapter,
					notes: activeChapterNotes,
				})
			:	html ?? "";
		return (
			<div
				className={cn("app-editor-sheet relative overflow-hidden rounded-[16px] border border-[#E5E5E7] md:rounded-[24px]", !extraContent && "shadow-[0_8px_60px_rgba(0,0,0,0.08)]")}
				data-editor-tour="content"
				style={{
					height: `${spreadMetrics.pageHeight}px`,
					width: `${spreadMetrics.pageWidth}px`,
					backgroundColor: unitPageBackground,
				}}
			>
				<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5" style={compactPagePaddingStyle}>
					<div
						className={cn(
							"relative flex min-h-0 flex-1 flex-col",
							extraContent ? "overflow-hidden" : (
								"overflow-hidden"
							),
						)}
						data-unit-note-page={!editable ? "true" : undefined}
						data-page-start-offset={!editable ? pageStartOffset : undefined}
						data-page-end-offset={!editable ? pageEndOffset : undefined}
						onClick={!editable ? handleNoteContentClick : undefined}
						onContextMenu={!editable ? handleNoteContextMenu : undefined}
						onMouseUp={!editable ? handleNoteMouseUp : undefined}
						style={resolvedThemeVars}
					>
						{editable ?
							<TiptapHtmlEditor
								key={`content-${didacticUnitId}-${activeChapter.chapterIndex}-${pageIndex}-edit`}
								contentClassName={cn(
									"text-[#1D1D1F] outline-none",
									extraContent ?
										"min-h-0 w-full shrink-0 overflow-visible pb-1"
									:	"h-full min-h-full overflow-auto",
								)}
								baseTextStyle={displayTextStyle}
								editable
								editorId={`content-${didacticUnitId}-${activeChapter.chapterIndex}-${pageIndex}-edit`}
								initialHtml={html ?? ""}
								onFocusEditor={setActiveHtmlEditor}
								onHtmlChange={(nextHtml) =>
									updatePaginatedContentPage(
										pageIndex,
										nextHtml,
									)
								}
								placeholder="Write the module content here..."
							/>
						:	<ChapterRenderer
								html={renderedHtml}
								className={cn(
									"unit-page-scope text-[#1D1D1F]",
									extraContent ?
										"min-h-0 w-full shrink-0 overflow-visible pb-1"
									:	"h-full min-h-full overflow-auto",
								)}
								style={resolvedThemeVars}
								animateBlocks={isActiveChapterStreaming}
								animationSeed={`${didacticUnitId}-${activeChapter.chapterIndex}-${pageIndex}`}
								stylePreset={draft.textStyle.stylePreset ?? "classic"}
							/>
						}
						{extraContent ?
							<div className="flex flex-1 items-center justify-center py-4">
								{extraContent}
							</div>
						:	null}
					</div>

					<div className="absolute bottom-3 right-5 text-[10px] font-medium text-[#86868B] md:bottom-5 md:right-8">
						{pageNumber}
					</div>
				</div>
			</div>
		);
	};

	const renderFirstPage = ({
		editable,
		html,
		extraContent,
		pageNumber,
		pageStartOffset = 0,
		pageEndOffset = 0,
	}: {
		editable: boolean;
		html: string | undefined;
		extraContent?: ReactNode;
		pageNumber: number;
		pageStartOffset?: number;
		pageEndOffset?: number;
	}) => {
		const titlePreset =
			STYLE_PRESETS[draft.textStyle.stylePreset ?? "classic"];
		const titleHeadingFamily = FONT_CATALOG[titlePreset.heading].family;
		const titleBodyFamily = FONT_CATALOG[titlePreset.body].family;
		const renderedHtml =
			!editable && activeChapter && pageEndOffset > pageStartOffset ?
				applyNoteMarksToPageHtml({
					html: html ?? "",
					pageStartOffset,
					pageEndOffset,
					chapter: activeChapter,
					notes: activeChapterNotes,
				})
			:	html ?? "";

		return (
		<div
			className="app-editor-sheet relative overflow-hidden rounded-[16px] border border-[#E5E5E7] shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
			data-editor-tour="content"
			style={{
				height: `${spreadMetrics.pageHeight}px`,
				width: `${spreadMetrics.pageWidth}px`,
				backgroundColor: unitPageBackground,
			}}
		>
			<div
				className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5"
				style={{
					...resolvedThemeVars,
					...compactPagePaddingStyle,
				}}
			>
				<div className="flex-shrink-0">
					<div className="flex items-center justify-between gap-4">
						<h2
							className="flex-1 font-bold leading-tight tracking-tight text-[#1D1D1F] outline-none"
							style={{
								fontFamily: titleHeadingFamily,
								fontSize: `${moduleTitleSizePx}px`,
							}}
							contentEditable={editable}
							onInput={(event) =>
								setDraft((previous) =>
									previous ?
										{
											...previous,
											title:
												event.currentTarget
													.textContent ?? "",
										}
									:	previous,
								)
							}
							spellCheck={editable}
							suppressContentEditableWarning
						>
							{draft.title}
						</h2>
						<span
							className="flex-shrink-0 select-none font-bold leading-none tracking-tight"
							style={{
								fontSize: "clamp(3rem, 6vw, 4.5rem)",
								fontFamily: titleHeadingFamily,
								color: STYLE_PRESETS[draft.textStyle.stylePreset ?? "classic"].numberColor,
							}}
							aria-hidden="true"
						>
							{String(activeChapter.chapterIndex + 1).padStart(2, "0")}
						</span>
					</div>
					<p
						className="unit-summary-quote mt-4 font-medium italic leading-relaxed text-[#86868B]"
						style={{
							fontFamily: titleBodyFamily,
							textAlign: "justify",
						}}
					>
						{activeChapter.summary}
					</p>
					<div
						className="mt-5 h-[1.5px] w-full bg-gradient-to-r from-transparent to-transparent"
						style={{
							backgroundImage: `linear-gradient(to right, transparent, ${STYLE_PRESETS[draft.textStyle.stylePreset ?? "classic"].numberColor}, transparent)`,
						}}
					/>
				</div>

				<div
					className={cn(
						"relative flex min-h-0 flex-1 flex-col",
						"overflow-hidden",
					)}
					data-unit-note-page={!editable ? "true" : undefined}
					data-page-start-offset={!editable ? pageStartOffset : undefined}
					data-page-end-offset={!editable ? pageEndOffset : undefined}
					onClick={!editable ? handleNoteContentClick : undefined}
					onContextMenu={!editable ? handleNoteContextMenu : undefined}
					onMouseUp={!editable ? handleNoteMouseUp : undefined}
				>
					{editable ?
						<TiptapHtmlEditor
							key={`content-${didacticUnitId}-${activeChapter.chapterIndex}-0-edit`}
							contentClassName={cn(
								"text-[#1D1D1F] outline-none",
								extraContent ?
									"min-h-0 w-full shrink-0 overflow-visible pb-1"
								:	"h-full min-h-full overflow-auto",
							)}
							baseTextStyle={displayTextStyle}
							editable
							editorId={`content-${didacticUnitId}-${activeChapter.chapterIndex}-0-edit`}
							initialHtml={html ?? ""}
							onFocusEditor={setActiveHtmlEditor}
							onHtmlChange={(nextHtml) =>
								updatePaginatedContentPage(0, nextHtml)
							}
							placeholder="Write the module content here..."
						/>
					:	<ChapterRenderer
							html={renderedHtml}
							className={cn(
								"unit-page-scope text-[#1D1D1F]",
								extraContent ?
									"min-h-0 w-full shrink-0 overflow-visible pb-1"
								:	"h-full min-h-full overflow-auto",
							)}
							style={resolvedThemeVars}
							animateBlocks={isActiveChapterStreaming}
							animationSeed={`${didacticUnitId}-${activeChapter.chapterIndex}-first`}
							stylePreset={draft.textStyle.stylePreset ?? "classic"}
						/>
					}
					{extraContent ?
						<div className="mt-5 shrink-0">{extraContent}</div>
					:	null}
				</div>

				<div className="absolute bottom-3 right-5 text-[10px] font-medium text-[#86868B] md:bottom-5 md:right-8">
					{pageNumber}
				</div>
			</div>
		</div>
	);
	};

	const renderReadPage = ({
		page,
		pageNumber,
	}: {
		page: ReadPage | undefined;
		pageNumber: number;
	}) => {
		if (!page) {
			return null;
		}

		if (page.kind === "learning_activity") {
			const activityTheme = resolvePostModuleCompletionStyle(
				draft.textStyle.stylePreset,
				resolvedMode === "dark",
			);
			const activityContentScale = Math.min(
				1.2,
				Math.max(1, spreadMetrics.pageHeight / 700),
			);
			return (
				<div
					className="app-editor-sheet relative overflow-hidden rounded-[16px] border shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
					style={{
						height: `${spreadMetrics.pageHeight}px`,
						width: `${spreadMetrics.pageWidth}px`,
						background: resolveActivityPageSurface(draft.textStyle.stylePreset, resolvedMode === "dark"),
						borderColor: activityTheme.panelBorder,
					}}
				>
					<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5" style={compactPagePaddingStyle}>
						<LearningActivityRenderer
							activity={page.activity}
							attempts={activityAttempts[page.activity.id] ?? []}
							contentScale={activityContentScale}
							isSubmitting={isActivityAttemptSubmitting}
							onSubmitAttempt={handleLearningActivityAttempt}
							onRefillAttempts={handleRefillActivityAttempts}
							onDeleteActivity={handleDeleteLearningActivity}
							stylePreset={draft.textStyle.stylePreset ?? "modern"}
						/>
						<div className="pointer-events-none absolute bottom-3 right-5 text-[10px] font-medium text-[#86868B] md:bottom-5 md:right-8">
							{pageNumber}
						</div>
					</div>
				</div>
			);
		}

		if (page.kind === "post_module_actions") {
			if (isActiveChapterStreaming) return null;
			return (
				<div
					className="app-editor-sheet relative overflow-hidden rounded-[16px] border md:rounded-[24px]"
					style={{
						height: `${spreadMetrics.pageHeight}px`,
						width: `${spreadMetrics.pageWidth}px`,
						background: postModuleCompletionStyle.panelBackground,
						borderColor: postModuleCompletionStyle.panelBorder,
					}}
				>
					<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5" style={compactPagePaddingStyle}>
						<div className="flex min-h-0 flex-1 items-center justify-center">
							{renderPostModuleActionBody({
								hasNextModule: page.hasNextModule,
								primaryActionLabel: page.primaryActionLabel,
							})}
						</div>
						<div className="pointer-events-none absolute bottom-3 right-5 text-[10px] font-medium text-[#86868B] md:bottom-5 md:right-8">
							{pageNumber}
						</div>
					</div>
				</div>
			);
		}

		return renderContentPage({
			editable: false,
			html: page.html,
			extraContent:
				(
					page.kind === "content_with_actions" &&
					!isActiveChapterStreaming
				) ?
					renderPostModuleActionBody({
						hasNextModule: page.hasNextModule,
						primaryActionLabel: page.primaryActionLabel,
					})
				:	undefined,
			pageIndex: pageNumber - 1,
			pageNumber,
			pageStartOffset: page.startCharacterOffset,
			pageEndOffset: page.endCharacterOffset,
		});
	};

	const editorToolbarCompact = spreadMetrics.spreadWidth < 920;

	const renderEditorSpread = (editable: boolean) => (
		<>
			<div
				className="relative flex items-center justify-center"
				style={{
					height: `${spreadMetrics.spreadHeight}px`,
					width: `${spreadMetrics.spreadWidth}px`,
				}}
			>
				<AnimatePresence mode="wait">
					<Motion.div
						key={`spread-${currentSpread}-${spreadMetrics.pageWidth}-${spreadMetrics.pageHeight}`}
						animate={{opacity: 1, x: 0}}
						className="flex h-full w-full items-start justify-center gap-4 md:gap-8"
						exit={{opacity: 0, x: -72}}
						initial={{opacity: 0, x: 72}}
						transition={{duration: 0.42, ease: [0.22, 1, 0.36, 1]}}
					>
						{currentSpread === 0 ?
							editable ?
								renderFirstPage({
									editable: true,
									html: leftEditablePage,
									pageNumber: 1,
								})
							: (
								leftReadPage &&
								isMeasuredContentPage(leftReadPage)
							) ?
								renderFirstPage({
									editable: false,
									html: leftReadPage.html,
									extraContent:
										(
											leftReadPage.kind ===
												"content_with_actions" &&
											!isActiveChapterStreaming
										) ?
											renderPostModuleActionBody({
												hasNextModule:
													leftReadPage.hasNextModule,
												primaryActionLabel:
													leftReadPage.primaryActionLabel,
											})
									:	undefined,
									pageNumber: 1,
									pageStartOffset: leftReadPage.startCharacterOffset,
									pageEndOffset: leftReadPage.endCharacterOffset,
								})
							:	renderReadPage({
									page: leftReadPage,
									pageNumber: 1,
								})

						: editable ?
							renderContentPage({
								editable: true,
								html: leftEditablePage,
								pageIndex: contentPageOffset,
								pageNumber: contentPageOffset + 1,
							})
						:	renderReadPage({
								page: leftReadPage,
								pageNumber: contentPageOffset + 1,
							})
						}

						{editable ?
							rightEditablePage !== undefined ?
								renderContentPage({
									editable: true,
									html: rightEditablePage,
									pageIndex: contentPageOffset + 1,
									pageNumber: contentPageOffset + 2,
								})
							:	null
						: rightReadPage ?
							renderReadPage({
								page: rightReadPage,
								pageNumber: contentPageOffset + 2,
							})
						:	null}
					</Motion.div>
				</AnimatePresence>
			</div>

			<div
				className={cn(
					"relative z-50 mt-3 flex max-w-full items-center justify-center gap-1.5 transition-all duration-150 md:gap-2",
					isPagePickerOpen &&
						"pointer-events-none translate-y-1 scale-95 opacity-0",
				)}
				data-editor-tour="page-controls"
				style={{marginTop: `${spreadMetrics.indicatorGap}px`}}
			>
				{!editable && (
					<button
						aria-label="Previous pages"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E7] bg-white shadow-md transition-all hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-30 md:h-10 md:w-10 max-[1599px]:h-9 max-[1599px]:w-9"
						disabled={!canGoPrev}
						onClick={goToPrevSpread}
						type="button"
					>
						<ChevronLeft size={20} className="text-[#1D1D1F]" />
					</button>
				)}
				<div
					className={cn(
						"rounded-full border border-[#E5E5E7] bg-white/90 py-2 shadow-lg backdrop-blur-sm md:py-3 max-[1599px]:py-0.5",
						editable ?
							"w-max max-w-full shrink-0 flex-none overflow-visible px-2 md:px-4 max-[1599px]:px-2.5"
						:	"min-w-0 max-w-[min(100vw-8rem,720px)] flex-1 overflow-visible px-3 md:px-5",
					)}
					style={
						editable ?
							{
								maxWidth: `min(${spreadMetrics.spreadWidth}px, calc(100vw - 2rem))`,
							}
						:	undefined
					}
				>
					<AnimatePresence initial={false} mode="wait">
						{editable ?
							<Motion.div
								key="toolbar-pill"
								animate={{opacity: 1, scale: 1, y: 0}}
								className={cn(
									"flex flex-nowrap items-center justify-center",
									editorToolbarCompact ? "gap-1" : (
										"gap-2 md:gap-3"
									),
								)}
								exit={{opacity: 0, scale: 0.97, y: 6}}
								initial={{opacity: 0, scale: 0.97, y: 6}}
								transition={{
									duration: 0.18,
									ease: [0.22, 1, 0.36, 1],
								}}
							>
								<EditorToolbar
									activeEditor={activeHtmlEditor}
									compact={editorToolbarCompact}
								/>
							</Motion.div>
						:	<Motion.div
								key="status-pill"
								animate={{opacity: 1, scale: 1, y: 0}}
								className="flex items-center justify-center gap-2 md:gap-3"
								exit={{opacity: 0, scale: 0.97, y: -6}}
								initial={{opacity: 0, scale: 0.97, y: -6}}
								transition={{
									duration: 0.18,
									ease: [0.22, 1, 0.36, 1],
								}}
							>
								{isActiveChapterStreaming && (
									<span className="flex items-center gap-1 text-[11px] font-medium text-[#4E8B63] md:text-[13px]">
										<Loader2
											size={12}
											className="animate-spin"
										/>
										Generando
									</span>
								)}
								{isActiveChapterStreaming && (
									<span className="text-[11px] text-[#D1D5DB]">
										•
									</span>
								)}
								<Popover
									open={isPagePickerOpen}
									onOpenChange={setIsPagePickerOpen}
								>
									<PopoverTrigger asChild>
										<button
											type="button"
											className="rounded-full text-[11px] text-[#86868B] outline-none transition-colors hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#4ADE80]/40 md:text-[13px]"
										>
											{spreadPageShortLabel}
										</button>
									</PopoverTrigger>
									<PopoverContent
										align="center"
										side="top"
										sideOffset={-26}
										className="app-editor-page-picker-popover w-[112px] overflow-hidden rounded-full border-[#E5E5E7] bg-white/90 px-2.5 py-1 shadow-lg backdrop-blur-sm"
									>
										<DidactioWheelPicker
											className="w-full"
											optionItemHeight={18}
											options={pageWheelOptions}
											value={pageWheelValue}
											visibleCount={7}
											onValueChange={(value) => {
												if (spreadMetrics.isMobile) {
													goToPageIndex(value);
													return;
												}

												goToSpreadIndex(value);
											}}
										/>
									</PopoverContent>
								</Popover>
							</Motion.div>
						}
					</AnimatePresence>
				</div>
				{!editable && (
					<button
						aria-label="Next pages"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E7] bg-white shadow-md transition-all hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-30 md:h-10 md:w-10 max-[1599px]:h-9 max-[1599px]:w-9"
						disabled={!canGoNext}
						onClick={goToNextSpread}
						type="button"
					>
						<ChevronRight size={20} className="text-[#1D1D1F]" />
					</button>
				)}
			</div>
		</>
	);
	const editorGuideDialog = (
		<EditorFirstRunGuide
			open={isEditorGuideOpen}
			onOpenChange={handleEditorGuideOpenChange}
			isMobile={spreadMetrics.isMobile}
		/>
	);

	if (spreadMetrics.isMobile) {
		return (
			<>
				{editorGuideDialog}
				<MobileUnitEditor
					workspace={workspace}
					activeChapter={activeChapter}
					activeChapterIndex={activeChapterIndex}
					activeContentHtml={activeDraftContent}
					learningActivitiesByChapter={learningActivities}
					activityAttempts={activityAttempts}
					activityContentScale={Math.min(
						1.08,
						Math.max(0.92, viewport.height / 760),
					)}
					canRegenerate={
						hasConfiguredGenerationTier &&
						(activeChapter.status === "ready" ||
							activeChapter.status === "failed") &&
						canPayRegeneration
					}
					canEdit={activeChapter.status === "ready"}
					isActivityAttemptSubmitting={isActivityAttemptSubmitting}
					isActivityLoading={isActivityLoading}
					isFinishUnitPending={isPostModuleActionPending}
					onBackToDashboard={() => navigate("/dashboard")}
					onCreateActivity={() => setIsActivityModalOpen(true)}
					onDeleteActivity={handleDeleteLearningActivity}
					onEdit={() => setIsMobileEditOpen(true)}
					onFinishUnit={() => void handlePostModulePrimaryAction()}
					onOpenExport={() => setIsExportDialogOpen(true)}
					onOpenHistory={() => setIsHistoryOpen(true)}
					onOpenNotes={() => setIsNotesPanelOpen(true)}
					onOpenPreferences={() =>
						navigate("/dashboard?section=preferences")
					}
					onOpenTutorial={() => setIsEditorGuideOpen(true)}
					onTextStyleChange={handleTextStyleChange}
					onRegenerate={() => setRegenerateConfirmOpen(true)}
					onRefillActivityAttempts={handleRefillActivityAttempts}
					onSelectChapter={(chapterIndex) => {
						setActiveChapterIndex(chapterIndex);
						setCurrentSpread(0);
						setSelectedOutlineItemId(null);
					}}
					onSubmitActivityAttempt={handleLearningActivityAttempt}
					resolvedThemeVars={resolvedThemeVars}
					stylePreset={draft.textStyle.stylePreset}
					textStyle={displayTextStyle ?? draft.textStyle}
				/>
				<Dialog
					open={isExportDialogOpen}
					onOpenChange={setIsExportDialogOpen}
				>
					<DialogContent className="w-[calc(100vw-32px)] overflow-hidden rounded-[18px] p-0 sm:max-w-[430px]">
						<DialogHeader className="border-0 px-6 pb-3 pt-6">
							<DialogTitle className="text-[16px] font-bold">
								Export unit
							</DialogTitle>
							<DialogDescription className="mt-1 max-w-[340px] text-[13px] leading-relaxed text-[#6E6E73]">
								Choose the format you need for this unit.
							</DialogDescription>
						</DialogHeader>
						<div className="px-3 pb-3">
							<button
								className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-60"
								disabled={isPrintingTheory}
								onClick={() => void handlePrintTheoryExport()}
								type="button"
							>
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#CFEFDB] bg-[#F0FDF4] text-[#15803D]">
									<Printer size={17} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-[14px] font-semibold text-[#1D1D1F]">
										{isPrintingTheory ?
											"Preparing theory..."
										:	"Print theory PDF"}
									</span>
									<span className="mt-0.5 block text-[12px] leading-snug text-[#6E6E73]">
										Clean A4 print view with generated modules.
									</span>
								</span>
								<ChevronRight
									className="shrink-0 text-[#C7C7CC]"
									size={16}
								/>
							</button>
							<div className="mx-3 h-px bg-[#F0F0F2]" />
							<button
								className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-60"
								disabled={isDownloadingActivities}
								onClick={() => void handleDownloadActivitiesExport()}
								type="button"
							>
								<span className="app-export-download-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#D5E4FF] bg-[#EFF6FF] text-[#2563EB]">
									<Download size={17} />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-[14px] font-semibold text-[#1D1D1F]">
										{isDownloadingActivities ?
											"Preparing activities..."
										:	"Download activities HTML"}
									</span>
									<span className="mt-0.5 block text-[12px] leading-snug text-[#6E6E73]">
										Offline activities with local checks and keys.
									</span>
								</span>
								<ChevronRight
									className="shrink-0 text-[#C7C7CC]"
									size={16}
								/>
							</button>
						</div>
						<DialogFooter className="border-0 bg-[#FAFAFB] px-6 py-3">
							<button
								className="rounded-full border border-[#D4D7DD] bg-white px-4 py-2 text-[13px] font-semibold text-[#374151] transition hover:border-[#C7C7CC] hover:bg-[#F5F5F7]"
								onClick={() => setIsExportDialogOpen(false)}
								type="button"
							>
								Cancel
							</button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				{printSnapshot && (
					<UnitExportPrintView
						onClose={() => setPrintSnapshot(null)}
						onPrint={requestPrint}
						snapshot={printSnapshot}
					/>
				)}
				{isMobileEditOpen && (
					<div
						className="fixed inset-0 z-[70] flex flex-col overflow-hidden font-sans text-[#1D1D1F]"
						style={{
							backgroundColor:
								(resolvedThemeVars as Record<string, string | undefined>)[
									"--unit-page-bg"
								] ?? "#FFFFFF",
						}}
					>
						<header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E5E7] bg-white/90 px-4 py-3 backdrop-blur">
							<button
								className="rounded-full px-3 py-2 text-[13px] font-bold text-[#6E6E73]"
								onClick={() => {
									exitEditMode();
									setIsMobileEditOpen(false);
								}}
								type="button"
							>
								Cancel
							</button>
							<div className="min-w-0 flex-1 text-center">
								<div className="truncate text-[13px] font-bold">
									Edit module
								</div>
								<div className="truncate text-[11px] text-[#86868B]">
									{activeChapter.title}
								</div>
							</div>
							<button
								className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[13px] font-bold text-white"
								onClick={async () => {
									await handleSave();
									setIsMobileEditOpen(false);
								}}
								type="button"
							>
								Save
							</button>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
							<MobileInlineHtmlEditor
								html={activeDraftContent}
								onChange={(html) =>
									setDraft((previous) =>
										previous ?
											{
												...previous,
												htmlDraft: html,
											}
										:	previous,
									)
								}
								style={resolvedThemeVars}
							/>
						</div>
					</div>
				)}
				<Dialog
					open={isNotesPanelOpen}
					onOpenChange={setIsNotesPanelOpen}
				>
					<DialogContent className="max-h-[82vh] w-[calc(100vw-32px)] overflow-y-auto rounded-[18px] p-0">
						<DialogHeader className="border-b border-[#E5E5E7] px-5 pb-4 pt-5">
							<DialogTitle>Notes</DialogTitle>
							<DialogDescription>
								{validUnitNotes.length} saved in this unit
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3 px-5 py-4">
							{validUnitNotes.length === 0 ?
								<div className="rounded-[14px] border border-dashed border-[#D4D7DD] p-5 text-center">
									<StickyNote
										size={24}
										className="mx-auto mb-2 text-[#34C759]"
									/>
									<div className="text-[13px] font-semibold text-[#1D1D1F]">
										No notes yet
									</div>
									<div className="mt-1 text-[12px] leading-relaxed text-[#86868B]">
										Select text in a generated module to create one.
									</div>
								</div>
							:	validUnitNotes.map((note) => {
									const chapter = workspace.chapters.find(
										(item) =>
											item.chapterIndex === note.chapterIndex,
									);
									return (
										<div
											key={note.id}
											className="rounded-[14px] border border-[#E5E5E7] bg-[#FAFAFA] p-3"
										>
											<div className="mb-2">
												<div className="text-[11px] font-bold uppercase tracking-wide text-[#34C759]">
													Module {note.chapterIndex + 1}
												</div>
												<div className="truncate text-[12px] font-semibold text-[#1D1D1F]">
													{chapter?.title ?? "Module"}
												</div>
											</div>
											<div className="mb-2 rounded-[10px] bg-white px-3 py-2 text-[12px] italic leading-relaxed text-[#5A5A60]">
												"{note.selectedText}"
											</div>
											{note.question && (
												<div className="mb-1 text-[12px] font-semibold text-[#1D1D1F]">
													{note.question}
												</div>
											)}
											<div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#3A3A3C]">
												{note.content}
											</div>
										</div>
									);
								})
							}
						</div>
					</DialogContent>
				</Dialog>
				<Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
					<DialogContent className="max-h-[82vh] w-[calc(100vw-32px)] overflow-y-auto rounded-[18px] p-0">
						<DialogHeader className="border-b border-[#E5E5E7] px-5 pb-4 pt-5">
							<DialogTitle>Version history</DialogTitle>
							<DialogDescription>
								{activeChapter.title}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3 px-5 py-4">
							{revisions.length === 0 ?
								<div className="rounded-[14px] border border-[#E5E5E7] bg-[#F5F5F7] p-4 text-[13px] text-[#86868B]">
									No revisions yet for this module.
								</div>
							:	revisions.map((revision) => {
									const isCurrentRevision =
										isRevisionCurrent(revision);
									return (
										<div
											key={revision.id}
											className="rounded-[14px] border border-[#E5E5E7] p-4"
										>
											<div className="flex items-center justify-between gap-3">
												<span className="text-[12px] font-semibold text-[#1D1D1F]">
													{sourceLabel(revision.source)}
												</span>
												<span className="text-[11px] text-[#86868B]">
													{revision.createdAt}
												</span>
											</div>
											<div className="mt-1 text-[13px] text-[#5A5A60]">
												{revision.title}
											</div>
											<button
												className={cn(
													"mt-3 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all",
													isCurrentRevision ?
														"bg-[#F5F5F7] text-[#86868B]"
													:	"bg-[#1D1D1F] text-white",
												)}
												disabled={
													isCurrentRevision || isSubmitting
												}
												onClick={() =>
													void handleRestoreRevision(revision)
												}
												type="button"
											>
												{isCurrentRevision ?
													"Current"
												:	"Restore"}
											</button>
										</div>
									);
								})
							}
						</div>
					</DialogContent>
				</Dialog>
				<AlertDialog
					open={regenerateConfirmOpen}
					onOpenChange={setRegenerateConfirmOpen}
				>
					<AlertDialogContent className="w-[calc(100vw-32px)] rounded-[18px]">
						<AlertDialogHeader>
							<AlertDialogTitle>
								{activeChapter.status === "ready" ?
									"Regenerate this module?"
								:	"Retry generating this module?"}
							</AlertDialogTitle>
							<AlertDialogDescription>
								This will replace the current module content. Earlier snapshots stay available in Version history.
								{regenerationCost && (
									<span className="mt-3 flex items-center gap-2">
										<span>This action will cost</span>
										<CoinAmount
											type={regenerationCost.coinType}
											amount={regenerationCost.amount}
										/>
									</span>
								)}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={() => {
									void handlePrimaryGeneration();
								}}
							>
								{activeChapter.status === "ready" ?
									"Regenerate"
								:	"Retry"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<Dialog
					open={isActivityModalOpen}
					onOpenChange={setIsActivityModalOpen}
				>
					<DialogContent className="app-activity-create-modal max-h-[88vh] w-[calc(100vw-32px)] overflow-y-auto rounded-[18px] p-0 sm:max-w-[760px]">
						<DialogHeader className="px-5 pb-0 pt-5">
							<DialogTitle>Exercises & Practice</DialogTitle>
							<DialogDescription>
								{hasNextActiveModule ?
									"Create a structured activity before moving to the next module."
								:	"Create a structured activity to close out this unit."
								}
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-5 px-5 py-5">
							<div className="app-activity-create-scope rounded-[16px] bg-[#F5F5F7] p-1">
								<div className="grid grid-cols-2 gap-1">
									{[
										{value: "current_module" as const, label: "Current", icon: BookOpenCheck},
										{value: "cumulative_until_module" as const, label: "Past modules", icon: History},
									].map((option) => {
										const TabIcon = option.icon;
										const selected = activityScope === option.value;
										return (
											<button
												key={option.value}
												type="button"
												onClick={() => setActivityScope(option.value)}
												className={cn(
													"app-activity-create-scope-option flex items-center justify-center gap-2 rounded-[13px] px-3 py-2.5 text-[12px] font-bold transition",
													selected ?
														"app-activity-create-scope-option-selected bg-white text-[#16A34A] shadow-sm ring-1 ring-[#4ADE80]"
													:	"text-[#6B7280]",
												)}
											>
												<TabIcon size={15} />
												{option.label}
											</button>
										);
									})}
								</div>
							</div>

							<div>
								<div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#86868B]">
									Activity type
								</div>
								<div className="grid gap-2">
									{ACTIVITY_OPTIONS.map((option) => {
										const Icon = option.icon;
										const selected = activityType === option.type;
										return (
											<button
												key={option.type}
												type="button"
												onClick={() => setActivityType(option.type)}
												className={cn(
													"app-activity-create-option relative flex items-start gap-3 rounded-[14px] border p-3 text-left transition",
													selected ?
														"app-activity-create-option-selected border-[#4ADE80] bg-[#F0FDF4] text-[#0F0F12]"
													:	"border-[#E5E5E7] bg-white text-[#0F0F12]",
												)}
											>
												{selected && (
													<CheckCircle2
														size={16}
														className="absolute right-3 top-2.5 text-[#16A34A]"
														fill="white"
													/>
												)}
												<span
													className={cn(
														"app-activity-create-option-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
														selected ?
															"app-activity-create-option-icon-selected bg-[#DCFCE7] text-[#16A34A]"
														:	"bg-[#F3F4F6] text-[#0F0F12]",
													)}
												>
													<Icon size={17} />
												</span>
												<span className="pr-5">
													<span className="block text-[13px] font-bold">{option.label}</span>
													<span className="mt-1 block text-[11px] leading-relaxed text-[#6B7280]">
														{option.description}
													</span>
												</span>
											</button>
										);
									})}
								</div>
							</div>

							<div>
								<div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#86868B]">
									Model
								</div>
								<div className="grid gap-2">
									{generationModelOptions.map((option) => {
										const selected = activityQuality === option.quality;
										return (
											<button
												key={option.quality}
												type="button"
												onClick={() => setActivityQuality(option.quality)}
												className={cn(
													"app-activity-create-model relative flex h-[54px] items-center gap-3 rounded-[14px] border px-3 text-left transition",
													selected ?
														"app-activity-create-model-selected border-[#4ADE80] bg-white"
													:	"border-[#E5E5E7] bg-[#F8F8F9]",
												)}
											>
												{selected && (
													<span className="absolute right-3 top-1/2 -translate-y-1/2">
														<CoinAmount
															type={
																getActivityGenerationCost({
																	quality: option.quality,
																}).coinType
															}
															amount={
																getActivityGenerationCost({
																	quality: option.quality,
																}).amount
															}
															size={16}
														/>
													</span>
												)}
												<span className="flex h-9 w-9 shrink-0 items-center justify-center">
													{option.icon ?
														<img
															src={option.icon}
															alt=""
															className="h-6 w-6 object-contain"
														/>
													:	<Brain size={18} className="text-[#0F0F12]" />
													}
												</span>
												<span className="min-w-0 pr-14">
													<span className="block truncate text-[13px] font-bold text-[#0F0F12]">
														{option.label}
													</span>
												</span>
											</button>
										);
									})}
								</div>
							</div>
						</div>

						<DialogFooter className="app-activity-create-footer grid grid-cols-2 gap-2 border-t border-[#F0F0F2] bg-[#FAFAFB] px-5 py-4">
							<span className="col-span-2 mb-1 inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-bold text-[#0F0F12]">
								Current balance:
								<span className="inline-flex items-center gap-2">
									{VISIBLE_COIN_TYPES.map((coinType) => (
										<CoinAmount
											key={coinType}
											type={coinType}
											amount={user?.credits[coinType] ?? 0}
											size={16}
										/>
									))}
								</span>
							</span>
							<Button
								type="button"
								variant="outline"
								onClick={() => setIsActivityModalOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={isActivityLoading}
								onClick={() => {
									void handleCreateLearningActivity();
								}}
								className="gap-2 bg-[#4ADE80] text-[#0F0F12] hover:bg-[#3BCD6F]"
							>
								{isActivityLoading ?
									<Loader2 size={16} className="animate-spin" />
								:	<CirclePlus size={16} />
								}
								{isActivityLoading ? "Creating..." : "Create"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<Dialog
					open={isUnitCompleteModalOpen}
					onOpenChange={setIsUnitCompleteModalOpen}
				>
					<DialogContent className="w-[calc(100vw-48px)] max-w-[340px] overflow-hidden rounded-[18px] p-0 text-center sm:max-w-[460px]">
						<div className="relative px-7 pt-8 pb-6">
							<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A] shadow-[0_14px_40px_rgba(34,197,94,0.22)]">
								<PartyPopper size={30} />
							</div>
							<DialogHeader className="border-0 px-0 pb-0 pt-5 text-center">
								<DialogTitle className="text-[24px] font-bold tracking-tight text-[#0F0F12]">
									Congratulations
								</DialogTitle>
								<DialogDescription className="mx-auto mt-2 max-w-[330px] text-[14px] leading-relaxed text-[#6B7280]">
									You have finished every module in this unit. Keep practicing to reinforce the material, or return to your dashboard.
								</DialogDescription>
							</DialogHeader>
						</div>
						<DialogFooter className="grid grid-cols-1 gap-2 border-t border-[#F0F0F2] bg-[#FAFAFB] px-5 py-4 sm:grid-cols-2">
							<Button
								type="button"
								variant="outline"
								className="h-10 rounded-full font-semibold"
								onClick={() => {
									setIsUnitCompleteModalOpen(false);
									setActivityScope("current_module");
									setIsActivityModalOpen(true);
								}}
							>
								Keep practicing
							</Button>
							<Button
								type="button"
								className="h-10 rounded-full bg-[#0F0F12] font-semibold text-white hover:bg-[#2A2A2D]"
								onClick={() => navigate("/dashboard")}
							>
								Go to dashboard
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</>
		);
	}

	return (
		<div className="flex h-screen overflow-hidden bg-[#F5F5F7] font-sans text-[#1D1D1F]">
			<Motion.aside
				className="app-editor-sidebar z-20 flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-[#E5E5E7] bg-white"
				initial={false}
				style={
					resolvedMode === "dark" ?
						{backgroundColor: "#18181B", borderColor: "var(--app-border-subtle)"}
					:	undefined
				}
			>
				<div className="flex shrink-0 items-center justify-between gap-2 px-4 py-5">
					<div className="min-w-0 flex-1">
						<img
							src="/assets/logos/logo-horizontal.png"
							alt="Didactio"
							className="h-7 w-auto max-w-[180px] object-contain"
						/>
					</div>
					<button
						aria-label="Back to library"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#86868B] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ADE80]/40"
						onClick={() => navigate("/dashboard")}
						title="Library"
						type="button"
					>
						<ChevronLeft size={20} strokeWidth={2} />
					</button>
				</div>

				<div className="mb-5 shrink-0 px-4">
					<div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[#86868B]">
						<span>Overall Progress</span>
						<span>{workspace.progress}%</span>
					</div>
					<div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5F5F7]">
						<Motion.div
							animate={{width: `${workspace.progress}%`}}
							className="h-full bg-[#4ADE80]"
							initial={{width: 0}}
						/>
					</div>
				</div>

				<nav
					className="flex-1 space-y-2 overflow-y-auto px-2 pb-2"
					data-editor-tour="modules"
				>
					{workspace.chapters.map((chapter, index) => {
						const isActive =
							activeChapterIndex === chapter.chapterIndex;
						const isChapterGenerating =
							isStreamingGeneration &&
							activeGeneratingChapterIndex ===
								chapter.chapterIndex;
						const canAiModule =
							hasConfiguredGenerationTier &&
							(chapter.status === "ready" ||
								chapter.status === "pending" ||
								chapter.status === "failed");
						const aiBusy =
							isSubmitting ||
							isStreamingGeneration ||
							isCancellingGeneration;
						const aiLabel =
							chapter.status === "ready" ? "Regenerate"
							: chapter.status === "failed" ? "Retry generation"
							: "Generate module";
						const chapterNeedsPaidRegeneration =
							chapter.status === "ready" ||
							chapter.status === "failed";
						const moduleActionCost = regenerationCost;
						const canPayChapterAction =
							!chapterNeedsPaidRegeneration ||
							canPayRegeneration;
						const canMarkRead =
							chapter.status === "ready" && !chapter.isCompleted;
						const canMarkUnread =
							chapter.status === "ready" && chapter.isCompleted;
						const canCreateActivity = chapter.status === "ready";
						const showModuleOutline =
							isActive &&
							moduleOutline.length > 0 &&
							collapsedOutlineChapterIndex !==
								chapter.chapterIndex;

						return (
							<div
								key={chapter.chapterIndex}
								onContextMenu={(event) => {
									event.preventDefault();
									setOpenChapterActionsIndex(
										chapter.chapterIndex,
									);
								}}
								className={cn(
									"app-editor-outline-item group relative flex w-full flex-col items-stretch gap-2 rounded-[14px] transition-all duration-200",
									"px-2 py-2.5",
									isActive ?
										"app-editor-outline-item-active bg-[#F5F5F7] text-[#1D1D1F]"
									:	"text-[#6E6E73] hover:bg-[#FAFAFA] hover:text-[#1D1D1F]",
								)}
							>
								{isActive && (
									<span
										aria-hidden
										className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#34C759]"
									/>
								)}
								<div className="flex w-full items-start gap-1.5">
									<button
										className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
										onClick={() => {
											if (isActive) {
												setCollapsedOutlineChapterIndex(
													(current) =>
														current ===
														chapter.chapterIndex ?
															null
														:	chapter.chapterIndex,
												);
												return;
											}

											setActiveChapterIndex(
												chapter.chapterIndex,
											);
										}}
										type="button"
									>
										<span
											className={cn(
												"flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold tabular-nums transition-colors",
												isActive ?
													"bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05]"
												:	"bg-black/[0.05] text-[#86868B] group-hover:bg-black/[0.07] group-hover:text-[#1D1D1F]",
											)}
										>
											{index + 1}
										</span>
										<span className="min-w-0 flex-1 text-[12.5px] font-medium leading-[1.4] text-balance">
											{chapter.title}
										</span>
									</button>
									<div className="flex shrink-0 items-center gap-0.5 self-center">
										<div className="flex shrink-0">
											{getStatusIcon(chapter)}
										</div>
										<DropdownMenu
											open={
												openChapterActionsIndex ===
												chapter.chapterIndex
											}
											onOpenChange={(open) => {
												setOpenChapterActionsIndex(
													open ?
														chapter.chapterIndex
													:	null,
												);
											}}
										>
											<DropdownMenuTrigger asChild>
												<button
													aria-label={`Module ${index + 1} actions`}
													className="flex h-7 w-7 items-center justify-center rounded-md text-[#86868B] opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-[#1D1D1F] group-hover:opacity-100 data-[state=open]:opacity-100"
													type="button"
													onClick={(e) =>
														e.stopPropagation()
													}
												>
													<MoreHorizontal size={15} />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												side="right"
												align="start"
												className="w-44"
											>
											{canAiModule && unitGenerationTier ?
												<DropdownMenuItem
													disabled={
														aiBusy ||
														!canPayChapterAction
													}
													onSelect={() => {
														void streamChapterContent(
															chapter,
															unitGenerationTier,
														);
													}}
												>
													<RotateCcw
														size={14}
														className="text-[#86868B]"
													/>
													<span className="min-w-0 flex-1">
														{aiLabel}
													</span>
													{moduleActionCost && (
														<span className="ml-2 shrink-0">
															<CoinAmount
																type={
																	moduleActionCost.coinType
																}
																amount={
																	moduleActionCost.amount
																}
																size={14}
															/>
														</span>
													)}
												</DropdownMenuItem>
											:	null}
											{isChapterGenerating ? (
												<DropdownMenuItem
													destructive
													disabled={
														!activeRunId ||
														isCancellingGeneration
													}
													onSelect={() => {
														void handleStopActiveGeneration();
													}}
												>
													<X
														size={14}
														className="text-red-400"
													/>
													{isCancellingGeneration ?
														"Stopping generation"
													:	"Stop generation"}
												</DropdownMenuItem>
											) : null}
											{canCreateActivity ?
												<DropdownMenuItem
													disabled={isActivityLoading}
													onSelect={() => {
														setActiveChapterIndex(
															chapter.chapterIndex,
														);
														setCollapsedOutlineChapterIndex(
															null,
														);
														setIsActivityModalOpen(
															true,
														);
													}}
												>
													<CirclePlus
														size={14}
														className="text-[#86868B]"
													/>
													Create exercise
												</DropdownMenuItem>
											:	null}
											{canMarkRead ?
												<DropdownMenuItem
													disabled={isSubmitting}
													onSelect={() => {
														void runAction(
															() =>
																dashboardApi.completeDidacticUnitChapter(
																	didacticUnitId,
																	chapter.chapterIndex,
																),
															{
																chapterIndex:
																	activeChapterIndexRef.current,
																preserveSpread: true,
																silentRefresh: true,
															},
														);
													}}
												>
													<CheckCircle2
														size={14}
														className="text-[#86868B]"
													/>
													Mark as read
												</DropdownMenuItem>
											:	null}
											{canMarkUnread ?
												<DropdownMenuItem
													disabled={isSubmitting}
													onSelect={() => {
														void runAction(
															() =>
																dashboardApi.markDidacticUnitChapterUnread(
																	didacticUnitId,
																	chapter.chapterIndex,
																),
															{
																chapterIndex:
																	activeChapterIndexRef.current,
																preserveSpread: true,
																silentRefresh: true,
															},
														);
													}}
												>
													<Undo2
														size={14}
														className="text-[#86868B]"
													/>
													Mark as unread
												</DropdownMenuItem>
											:	null}
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>
								{showModuleOutline && (
									<Motion.div
										animate={{opacity: 1, height: "auto"}}
										className="relative ml-3 space-y-0.5 overflow-hidden py-1"
										initial={{opacity: 0, height: 0}}
										transition={{
											duration: 0.18,
											ease: [0.22, 1, 0.36, 1],
										}}
									>
										{moduleOutline
											.filter(
												(item) =>
													item.level === 2 ||
													(item.parentId &&
														expandedOutlineSectionIds.includes(
															item.parentId,
														)),
											)
											.map((item, index, visibleItems) => {
											const isCurrentOutlineItem =
												item.id === activeOutlineItemId;
											const isFirst = index === 0;
											const isLast =
												index ===
												visibleItems.length - 1;
											const ActivityIcon = item.icon;
											const hasSubsections =
												item.kind === "section" &&
												item.level === 2 &&
												moduleOutline.some(
													(child) =>
														child.parentId ===
														item.id,
												);

											return (
												<button
													key={item.id}
													type="button"
													onClick={() => {
														if (hasSubsections) {
															setExpandedOutlineSectionIds(
																(previous) =>
																	previous.includes(
																		item.id,
																	) ?
																		previous.filter(
																			(id) =>
																				id !==
																				item.id,
																		)
																	:	[
																			...previous,
																			item.id,
																		],
															);
														}

														goToPageIndex(
															item.pageIndex,
															item.id,
														);
													}}
													className={cn(
														"relative grid min-w-0 items-center gap-2 rounded-[6px] text-left text-[12px] leading-[1.35] transition-colors",
														item.level === 2 ?
															"mt-1 ml-1.5 w-[calc(100%-0.375rem)] grid-cols-[1.6rem_minmax(0,1fr)] py-1.5 pl-1 pr-1.5 font-medium"
														:	"ml-4 w-[calc(100%-1rem)] grid-cols-[1.55rem_minmax(0,1fr)] py-1.5 pl-1 pr-1.5 font-normal",
														isCurrentOutlineItem ?
															"text-[#1D1D1F]"
														:	"text-[#86868B] hover:text-[#1D1D1F]",
													)}
													aria-current={
														isCurrentOutlineItem ?
															"location"
														:	undefined
													}
												>
													{visibleItems.length >
														1 && (
														<span
															aria-hidden
															className={cn(
																"absolute w-0.5 bg-[#DADADF]",
																item.level === 2 ?
																	"-left-1.5"
																:	"-left-4",
																isFirst ?
																	"-top-2 rounded-t-full"
																:	"top-0",
																isLast ?
																	"bottom-1/2 rounded-b-full"
																:	"-bottom-1.5",
															)}
														/>
													)}
													<span
														aria-hidden
														className={cn(
															"absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[#DADADF]",
															item.level === 2 ?
																"-left-1.5 w-2"
															:	"-left-4 w-5",
														)}
													/>
													<span
														className={cn(
															"flex min-h-5 shrink-0 items-center justify-end font-semibold tabular-nums",
															isCurrentOutlineItem ?
																"text-[#34C759]"
															: item.level === 2 ?
																"text-[#8E8E93]"
															:	"text-[#AEAEB2]",
														)}
													>
														{item.kind ===
															"activity" &&
														ActivityIcon ?
															<ActivityIcon
																size={14}
																strokeWidth={
																	2
																}
															/>
														:	item.number}
													</span>
													<span
														className={cn(
															"min-w-0 flex-1 overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]",
															item.level === 2 ?
																"text-[#4B5563]"
															:	"text-[#6E6E73]",
															isCurrentOutlineItem &&
																"font-medium text-[#34C759]",
														)}
													>
														{item.title}
													</span>
												</button>
											);
										})}
									</Motion.div>
								)}
							</div>
						);
					})}
				</nav>

				<div
					className="shrink-0 space-y-0.5 border-t border-[#E5E5E7] p-3"
					data-editor-tour="sidebar-actions"
				>
					<button
						className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
						onClick={() => navigate("/dashboard")}
						type="button"
					>
						<Undo2 size={16} />
						<span>Back to Dashboard</span>
					</button>
					<button
						className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
						onClick={() => setIsExportDialogOpen(true)}
						type="button"
					>
						<Share2 size={16} />
						<span>Export Unit</span>
					</button>
					<button
						className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
						onClick={() => setIsEditorGuideOpen(true)}
						type="button"
					>
						<WandSparkles size={16} />
						<span>Show Tutorial</span>
					</button>
					<button
						className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
						onClick={() => navigate("/dashboard?section=preferences")}
						type="button"
					>
						<Settings size={16} />
						<span>Settings</span>
					</button>
				</div>
			</Motion.aside>

			<main className="relative flex h-full flex-1 flex-col overflow-hidden">
				<header
					className="app-editor-header z-10 flex h-[64px] shrink-0 items-center justify-between gap-8 border-b border-[#E5E5E7] bg-white/80 px-6 backdrop-blur-md"
					style={
						resolvedMode === "dark" ?
							{backgroundColor: "#18181B", borderColor: "var(--app-border-subtle)"}
						:	undefined
					}
				>
					<div className="flex min-w-0 flex-[1_1_auto] items-center gap-4">
						<div className="flex shrink-0 items-center gap-1.5 border-r border-[#D1D1D6] pr-4">
							<span className="text-[13px] leading-none">
								{getFolderEmoji(workspace.folder.icon)}
							</span>
							<span className="font-sora truncate text-[12px] font-medium text-[#3A3A3C]">
								{workspace.folder.name}
							</span>
						</div>

						<h1 className="unit-title-responsive line-clamp-2 min-w-0 flex-1 font-bold text-[#1D1D1F]">
							{workspace.title}
						</h1>
					</div>

					<HeaderCoinBalance
						credits={user?.credits ?? {bronze: 0, silver: 0, gold: 0}}
						onOpenSubscription={() =>
							navigate("/dashboard?section=subscription")
						}
					/>

					<div
						className="flex shrink-0 items-center gap-6"
						data-editor-tour="header-actions"
					>
						<div className="flex items-center gap-1.5">
							<HeaderControlTooltip label="Notes">
								<button
									aria-label="Notes"
									className={cn(
										headerIconButtonClass,
										isNotesPanelOpen ?
											"border-[#34C759] text-[#34C759]"
										:	"border-[#D4D7DD]",
									)}
									onClick={() =>
										setIsNotesPanelOpen((value) => !value)
									}
									type="button"
								>
									<StickyNote size={18} />
								</button>
							</HeaderControlTooltip>
							<HeaderControlTooltip label="Version history">
								<button
									aria-label="Version history"
									className={cn(
										headerIconButtonClass,
										isHistoryOpen &&
											"border-[#34C759] text-[#34C759]",
									)}
									onClick={() =>
										setIsHistoryOpen((value) => !value)
									}
									type="button"
								>
									<History size={18} />
								</button>
							</HeaderControlTooltip>
							{hasConfiguredGenerationTier &&
								(activeChapter.status === "ready" ||
									activeChapter.status === "failed") && (
									<HeaderControlTooltip
										label={
											activeChapter.status === "ready" ?
												"Regenerate module"
											:	"Retry generation"
										}
									>
										<button
											aria-label={
												activeChapter.status === "ready" ?
													"Regenerate module"
												:	"Retry generation"
											}
											className={headerIconButtonClass}
											onClick={() =>
												setRegenerateConfirmOpen(true)
											}
											type="button"
										>
											<RotateCcw size={18} />
										</button>
									</HeaderControlTooltip>
								)}
							{draft !== null && (
								<ChapterStyleMenu
									iconOnly
									value={displayTextStyle ?? draft.textStyle}
									onChange={handleTextStyleChange}
								/>
							)}
							{isEditMode ?
								<div
									className="flex h-10 w-[132px] overflow-hidden rounded-full border border-[#D4D7DD] bg-white shadow-sm"
									role="group"
									aria-label="Edit actions"
								>
									<Button
										aria-label="Save changes"
										className="h-full flex-1 rounded-none border-0 bg-[#4ADE80] px-0 text-white shadow-none hover:bg-[#3BCD6F] focus-visible:ring-[#4ADE80] focus-visible:ring-offset-0 active:translate-y-0"
										onClick={() => void handleSave()}
										size="icon-sm"
										type="button"
									>
										<Check size={16} />
									</Button>
									<div className="w-px bg-[#D4D7DD]" />
									<Button
										aria-label="Cancel editing"
										className="h-full flex-1 rounded-none border-0 bg-white px-0 text-[#86868B] shadow-none hover:bg-[#F5F5F7] hover:text-[#1D1D1F] focus-visible:ring-[#1D1D1F] focus-visible:ring-offset-0 active:translate-y-0"
										onClick={exitEditMode}
										size="icon-sm"
										type="button"
									>
										<X size={16} />
									</Button>
								</div>
							: 	<div className="group relative">
									<Button
										aria-label="Edit"
										className="h-10 w-10 rounded-full border border-[#D4D7DD] bg-white p-0 text-[#1D1D1F] hover:border-[#34C759] hover:bg-[#F7FFF9] hover:text-[#34C759] active:border-[#34C759] active:text-[#34C759] disabled:cursor-not-allowed disabled:border-[#D4D7DD] disabled:bg-white disabled:text-[#D1D1D6]"
										disabled={isExerciseOnlySpread}
										onClick={enterEditMode}
										type="button"
									>
										<Edit3 size={18} />
									</Button>
									{!isExerciseOnlySpread && (
										<div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[80] -translate-x-1/2 whitespace-nowrap rounded-md border border-[#E5E5E7] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1D1D1F] opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
											Edit module
										</div>
									)}
									{isExerciseOnlySpread && (
										<div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-[12px] border border-[#E5E5E7] bg-white px-3 py-2 text-[12px] leading-relaxed text-[#3A3A3C] opacity-0 shadow-[0_12px_36px_rgba(0,0,0,0.14)] transition-opacity group-hover:opacity-100">
											Edit mode is not available on exercise pages. Move to a content page to edit the unit.
										</div>
									)}
								</div>
							}
						</div>
					</div>
				</header>

				<div className="relative flex flex-1 flex-col items-center justify-center bg-[#F5F5F7] px-3 py-4 md:px-6 md:py-6 max-[1599px]:pb-7 max-[1599px]:pt-0">
					{pendingNoteSelection && !isNoteDialogOpen && (
						<button
							className="fixed z-50 flex items-center gap-2 rounded-full border border-[#34C759]/40 bg-white px-3 py-2 text-[13px] font-semibold text-[#1D1D1F] shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition hover:bg-[#F7FFF9]"
							style={{
								left: pendingNoteSelection.x,
								top: Math.max(72, pendingNoteSelection.y - 44),
								transform: "translateX(-50%)",
							}}
							onClick={openNoteDialog}
							type="button"
						>
							<StickyNote size={15} className="text-[#34C759]" />
							Notes · AI
						</button>
					)}
					{(
						activeChapter.status === "ready" ||
						isActiveChapterStreaming
					) ?
						renderEditorSpread(isEditMode)
					:	<>
							{isPendingChapter ?
								<div className="flex flex-col items-center justify-center space-y-6 text-center">
									<div className="relative">
										<Loader2
											size={56}
											strokeWidth={1.5}
											className="animate-spin text-[#4ADE80]"
										/>
										<Motion.div
											animate={{
												scale: [1, 1.2, 1],
												opacity: [0.3, 0.6, 0.3],
											}}
											className="absolute inset-0 rounded-full bg-[#4ADE80]/20 blur-xl"
											transition={{
												repeat: Number.POSITIVE_INFINITY,
												duration: 2,
											}}
										/>
									</div>
									<div className="space-y-2">
										<h3 className="text-xl font-semibold">
											{hasConfiguredGenerationTier ?
												"Module queued for generation"
											:	"Module not generated yet"}
										</h3>
										<p className="max-w-[300px] text-sm text-[#86868B]">
											{hasConfiguredGenerationTier ?
												(
													isStreamingGeneration &&
													activeGeneratingChapterIndex !==
														null
												) ?
													`Module ${activeGeneratingChapterIndex + 1} is generating now. Open that module to watch the live stream, or wait here until this one begins.`
												:	"The unit generator is preparing the remaining modules automatically."

											:	"This unit predates automatic generation startup. Pick a model once to begin generating the module queue."
											}
										</p>
									</div>
									{!hasConfiguredGenerationTier && (
										<div className="rounded-[10px] border border-[#E5E5E7] bg-white px-4 py-2 text-sm text-[#6E6E73]">
											Approve the syllabus with silver or
											gold quality before generating
											modules.
										</div>
									)}
								</div>
							: isFailedChapter ?
								<div className="flex flex-col items-center justify-center space-y-6 text-center">
									<div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
										<AlertCircle
											size={32}
											strokeWidth={1.5}
											className="text-red-400"
										/>
									</div>
									<div className="space-y-2">
										<h3 className="text-xl font-semibold">
											Generation Failed
										</h3>
										<p className="max-w-[300px] text-sm text-[#86868B]">
											We encountered an issue generating
											this module. Retry it to keep the
											unit generation moving.
										</p>
									</div>
									<div className="flex flex-wrap justify-center gap-3">
										{hasConfiguredGenerationTier ?
											<button
												className="rounded-full bg-[#1D1D1F] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] active:scale-95"
												disabled={
													isSubmitting ||
													!canPayRegeneration
												}
												onClick={() =>
													void handlePrimaryGeneration()
												}
												type="button"
											>
												Retry Module
												{regenerationCost && (
													<span className="ml-2 inline-flex">
														<CoinAmount
															type={
																regenerationCost.coinType
															}
															amount={
																regenerationCost.amount
															}
															size={16}
														/>
													</span>
												)}
											</button>
										:	<>
												<div className="rounded-[10px] border border-[#E5E5E7] bg-white px-4 py-2 text-sm text-[#6E6E73]">
													This unit needs a paid
													silver or gold quality
													before module retries.
												</div>
											</>
										}
									</div>
								</div>
							:	<div className="flex flex-col items-center justify-center space-y-6 text-center">
									<div className="relative">
										<Loader2
											size={56}
											strokeWidth={1.5}
											className="animate-spin text-[#4ADE80]"
										/>
									</div>
									<div className="space-y-2">
										<h3 className="text-xl font-semibold">
											Loading module
										</h3>
										<p className="max-w-[300px] text-sm text-[#86868B]">
											We are preparing the current module
											workspace.
										</p>
									</div>
								</div>
							}
						</>
					}
				</div>

				<AnimatePresence>
					{isHistoryOpen && (
						<Motion.div
							animate={{opacity: 1, x: 0}}
							className="absolute inset-y-0 right-0 z-30 w-[360px] border-l border-[#E5E5E7] bg-white/98 p-6 shadow-2xl backdrop-blur-md"
							exit={{opacity: 0, x: 24}}
							initial={{opacity: 0, x: 24}}
						>
							<div className="mb-6 flex items-center justify-between">
								<div>
									<div className="text-[11px] font-medium uppercase tracking-wide text-[#86868B]">
										Module history
									</div>
									<h3 className="mt-1 text-[20px] font-bold text-[#1D1D1F]">
										{activeChapter.title}
									</h3>
								</div>
								<button
									className="rounded-full p-2 text-[#86868B] transition-all hover:bg-[#F5F5F7]"
									onClick={() => setIsHistoryOpen(false)}
									type="button"
								>
									<X size={18} />
								</button>
							</div>

							<div className="space-y-3">
								{revisions.length === 0 && (
									<div className="rounded-2xl border border-[#E5E5E7] bg-[#F5F5F7] p-4 text-[13px] text-[#86868B]">
										No revisions yet for this module.
									</div>
								)}
								{revisions.map((revision) => {
									const isCurrentRevision =
										isRevisionCurrent(revision);

									return (
										<div
											key={revision.id}
											className="rounded-2xl border border-[#E5E5E7] p-4"
										>
											<div className="flex items-center justify-between gap-3">
												<span className="text-[12px] font-semibold text-[#1D1D1F]">
													{sourceLabel(
														revision.source,
													)}
												</span>
												<span className="text-[11px] text-[#86868B]">
													{revision.createdAt}
												</span>
											</div>
											<div className="mt-1 text-[13px] text-[#5A5A60]">
												{revision.title}
											</div>
											<div className="mt-4 flex items-center justify-between gap-3">
												<div className="text-[11px] text-[#86868B]">
													{isCurrentRevision ?
														"Current version"
													:	"Restore this snapshot"}
												</div>
												<button
													className={cn(
														"rounded-full px-3 py-1.5 text-[12px] font-medium transition-all",
														isCurrentRevision ?
															"bg-[#F5F5F7] text-[#86868B]"
														:	"bg-[#1D1D1F] text-white hover:bg-[#333333]",
													)}
													disabled={
														isCurrentRevision ||
														isSubmitting
													}
													onClick={() =>
														void handleRestoreRevision(
															revision,
														)
													}
													type="button"
												>
													{isCurrentRevision ?
														"Current"
													:	"Restore"}
												</button>
											</div>
											{!isCurrentRevision && (
												<div className="mt-2 text-[11px] text-[#86868B]">
													You can switch back to this
													version at any time.
												</div>
											)}
										</div>
									);
								})}
							</div>

							{activeRuns.length > 0 && (
								<div className="mt-8 border-t border-[#E5E5E7] pt-6">
									<div className="mb-3 flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-[#86868B]">
										<WandSparkles size={14} />
										Recent runs
									</div>
									<div className="space-y-3">
										{activeRuns.map((run) => (
											<div
												key={run.id}
												className="rounded-2xl border border-[#E5E5E7] p-4"
											>
												<div className="text-[12px] font-semibold text-[#1D1D1F]">
													{formatRunLabel(run)}
												</div>
												<div className="mt-1 text-[11px] text-[#86868B]">
													{run.provider.toUpperCase()}{" "}
													· {run.model}
												</div>
												<div className="mt-1 text-[11px] text-[#86868B]">
													{formatRelativeTimestamp(
														run.createdAt,
													)}
												</div>
												{run.error && (
													<div className="mt-2 text-[12px] text-red-600">
														{run.error}
													</div>
												)}
											</div>
										))}
									</div>
								</div>
							)}
						</Motion.div>
					)}
				</AnimatePresence>
				<AnimatePresence>
					{isNotesPanelOpen && (
						<Motion.aside
							animate={{x: 0, opacity: 1}}
							className="absolute right-4 top-[80px] bottom-4 z-20 flex w-[340px] flex-col overflow-hidden rounded-[18px] border border-[#E5E5E7] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.14)]"
							exit={{x: 24, opacity: 0}}
							initial={{x: 24, opacity: 0}}
							transition={{duration: 0.2, ease: [0.22, 1, 0.36, 1]}}
						>
							<div className="flex items-center justify-between border-b border-[#E5E5E7] px-4 py-3">
								<div>
									<div className="text-[15px] font-bold text-[#1D1D1F]">
										Notes
									</div>
									<div className="text-[12px] text-[#86868B]">
										{validUnitNotes.length} saved in this unit
									</div>
								</div>
								<button
									aria-label="Close notes"
									className="flex h-8 w-8 items-center justify-center rounded-full text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
									onClick={() => setIsNotesPanelOpen(false)}
									type="button"
								>
									<X size={16} />
								</button>
							</div>
							<div className="flex-1 space-y-3 overflow-y-auto p-4">
								{validUnitNotes.length === 0 ? (
									<div className="rounded-[14px] border border-dashed border-[#D4D7DD] p-5 text-center">
										<StickyNote
											size={24}
											className="mx-auto mb-2 text-[#34C759]"
										/>
										<div className="text-[13px] font-semibold text-[#1D1D1F]">
											No notes yet
										</div>
										<div className="mt-1 text-[12px] leading-relaxed text-[#86868B]">
											Select text in a generated module to create one.
										</div>
									</div>
								) : (
									validUnitNotes.map((note) => {
										const chapter = workspace.chapters.find(
											(item) =>
												item.chapterIndex === note.chapterIndex,
										);
										const isEditing = editingNoteId === note.id;
										return (
											<div
												key={note.id}
												className="rounded-[14px] border border-[#E5E5E7] bg-[#FAFAFA] p-3"
											>
												<div className="mb-2 flex items-start justify-between gap-2">
													<div className="min-w-0">
														<div className="text-[11px] font-bold uppercase tracking-wide text-[#34C759]">
															Module {note.chapterIndex + 1}
														</div>
														<div className="truncate text-[12px] font-semibold text-[#1D1D1F]">
															{chapter?.title ?? "Module"}
														</div>
													</div>
													<div className="flex shrink-0 gap-1">
														<button
															className="rounded-full px-2 py-1 text-[11px] font-medium text-[#6E6E73] hover:bg-white hover:text-[#1D1D1F]"
															onClick={() => startEditingNote(note)}
															type="button"
														>
															Edit
														</button>
														<button
															aria-label="Delete note"
															className="flex h-7 w-7 items-center justify-center rounded-full text-[#86868B] hover:bg-white hover:text-red-600"
															onClick={() => setDeleteNoteId(note.id)}
															type="button"
														>
															<Trash2 size={14} />
														</button>
													</div>
												</div>
												<div className="mb-2 rounded-[10px] bg-white px-3 py-2 text-[12px] italic leading-relaxed text-[#5A5A60]">
													"{note.selectedText}"
												</div>
												{isEditing ? (
													<div className="space-y-2">
														<textarea
															className="min-h-[54px] w-full resize-none rounded-[10px] border border-[#D4D7DD] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#34C759]"
															value={noteEditQuestion}
															onChange={(event) =>
																setNoteEditQuestion(event.target.value)
															}
															placeholder="Question"
														/>
														<textarea
															className="min-h-[96px] w-full resize-none rounded-[10px] border border-[#D4D7DD] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#34C759]"
															value={noteEditContent}
															onChange={(event) =>
																setNoteEditContent(event.target.value)
															}
														/>
														<div className="flex justify-end gap-2">
															<button
																className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[#6E6E73] hover:bg-white"
																onClick={() => setEditingNoteId(null)}
																type="button"
															>
																Cancel
															</button>
															<button
																className="rounded-full bg-[#1D1D1F] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
																disabled={isNoteSaving}
																onClick={() => void handleSaveNoteEdit()}
																type="button"
															>
																Save
															</button>
														</div>
													</div>
												) : (
													<>
														{note.question && (
															<div className="mb-1 text-[12px] font-semibold text-[#1D1D1F]">
																{note.question}
															</div>
														)}
														<div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#3A3A3C]">
															{note.content}
														</div>
													</>
												)}
											</div>
										);
									})
								)}
							</div>
						</Motion.aside>
					)}
				</AnimatePresence>
			</main>

			<Dialog
				open={isUnitCompleteModalOpen}
				onOpenChange={setIsUnitCompleteModalOpen}
			>
				<DialogContent className="overflow-hidden p-0 text-center sm:max-w-[460px]">
					<div className="relative px-7 pt-8 pb-6">
						<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A] shadow-[0_14px_40px_rgba(34,197,94,0.22)]">
							<PartyPopper size={30} />
						</div>
						<DialogHeader className="border-0 px-0 pb-0 pt-5 text-center">
							<DialogTitle className="text-[24px] font-bold tracking-tight text-[#0F0F12]">
								Congratulations
							</DialogTitle>
							<DialogDescription className="mx-auto mt-2 max-w-[330px] text-[14px] leading-relaxed text-[#6B7280]">
								You have finished every module in this unit. Keep practicing to reinforce the material, or return to your dashboard.
							</DialogDescription>
						</DialogHeader>
					</div>
					<DialogFooter className="grid grid-cols-1 gap-2 border-t border-[#F0F0F2] bg-[#FAFAFB] px-5 py-4 sm:grid-cols-2">
						<Button
							type="button"
							variant="outline"
							className="h-10 rounded-full font-semibold"
							onClick={() => {
								setIsUnitCompleteModalOpen(false);
								setActivityScope("current_module");
								setIsActivityModalOpen(true);
							}}
						>
							Keep practicing
						</Button>
						<Button
							type="button"
							className="h-10 rounded-full bg-[#0F0F12] font-semibold text-white hover:bg-[#2A2A2D]"
							onClick={() => navigate("/dashboard")}
						>
							Go to dashboard
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isNoteDialogOpen}
				onOpenChange={(open) => {
					setIsNoteDialogOpen(open);
					if (!open) {
						setActiveNoteId(null);
						setPendingNoteSelection(null);
						setEditingNoteId(null);
					}
				}}
			>
				<DialogContent
					className="overflow-hidden p-0 sm:max-w-[560px]"
					overlayClassName="bg-transparent backdrop-blur-0"
				>
					<DialogHeader className="border-b border-[#E5E5E7] px-6 pt-5 pb-4">
						<div className="flex items-center gap-3">
							<span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#34C759]/10 text-[#34C759]">
								<StickyNote size={18} />
							</span>
							<div>
								<DialogTitle className="text-[17px] font-bold text-[#0F0F12]">
									{activeNote ? "Note" : "Create note"}
								</DialogTitle>
								<DialogDescription className="mt-0.5 text-[13px] text-[#6E6E73]">
									Write directly, or ask AI to fill the note field.
								</DialogDescription>
							</div>
						</div>
					</DialogHeader>
					{(pendingNoteSelection || activeNote) && (
						<div className="space-y-3 bg-white px-6 py-4">
							<div className="relative rounded-[12px] border border-[#DDEFE3] bg-[#FBFFFC] px-4 py-2.5">
								<div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[#34C759]" />
								<div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#34C759]">
									Selected text
								</div>
								<div className="line-clamp-3 text-[13px] italic leading-relaxed text-[#3A3A3C]">
									"{pendingNoteSelection?.selectedText ?? activeNote?.selectedText}"
								</div>
							</div>
							<div>
								<label className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[#0F0F12]">
									<Edit3 size={14} className="text-[#34C759]" />
									<span>Note</span>
								</label>
								<textarea
									className="min-h-[230px] w-full resize-y rounded-[14px] border border-[#E5E5E7] bg-[#FAFAFA] px-4 py-3 text-[14px] leading-relaxed text-[#0F0F12] outline-none transition focus:border-[#34C759] focus:bg-white focus:ring-3 focus:ring-[#34C759]/10"
									value={noteDraftContent}
									onChange={(event) =>
										setNoteDraftContent(event.target.value)
									}
									placeholder="Write your note..."
								/>
							</div>
							<div className="rounded-[14px] border border-[#DDEFE3] bg-[#FBFFFC] p-3">
								<div className="flex items-center justify-between gap-3">
									<label className="flex items-center gap-2 text-[12px] font-bold text-[#0F0F12]">
										<Brain size={14} className="text-[#34C759]" />
										<span>Ask AI</span>
										<span className="text-[11px] font-medium text-[#86868B]">
											Optional prompt
										</span>
									</label>
									<button
										aria-label="Toggle optional AI prompt"
										className={cn(
											"flex h-8 w-8 items-center justify-center rounded-full border text-[#34C759] transition",
											isNoteAiPromptOpen ?
												"border-[#34C759] bg-white"
											:	"border-[#DDEFE3] bg-white hover:bg-[#F0FDF4]",
										)}
										onClick={() =>
											setIsNoteAiPromptOpen((value) => !value)
										}
										type="button"
									>
										{isNoteAiPromptOpen ?
											<X size={14} />
										:	<CirclePlus size={16} />}
									</button>
								</div>
								{isNoteAiPromptOpen && (
									<textarea
										className="mt-3 min-h-[70px] w-full resize-none rounded-[12px] border border-[#E5E5E7] bg-[#FAFAFA] px-3 py-2.5 text-[13px] leading-relaxed text-[#0F0F12] outline-none transition focus:border-[#34C759] focus:bg-white focus:ring-3 focus:ring-[#34C759]/10"
										value={noteQuestionDraft}
										onChange={(event) =>
											setNoteQuestionDraft(event.target.value)
										}
										placeholder="What do you want to clarify?"
									/>
								)}
								</div>
						</div>
					)}
					<DialogFooter className="border-t border-[#E5E5E7] bg-white px-6 py-4">
						{activeNote && (
							<Button
								variant="outline"
								className="mr-auto rounded-full text-red-600 hover:text-red-700"
								onClick={() => setDeleteNoteId(activeNote.id)}
								type="button"
							>
								Delete
							</Button>
						)}
						<Button
							variant="outline"
							className="rounded-full"
							onClick={() => setIsNoteDialogOpen(false)}
							type="button"
						>
							{activeNote ? "Close" : "Cancel"}
						</Button>
						{!activeNote && (
							<Button
								variant="outline"
								className="rounded-full"
								disabled={isNoteSaving || !noteDraftContent.trim()}
								onClick={() => void handleSaveCurrentNote()}
								type="button"
							>
								Save note
							</Button>
						)}
						<Button
							className="rounded-full bg-[#0F0F12] px-5 hover:bg-[#2A2A2D]"
							disabled={isNoteSaving}
							onClick={() => void handleGenerateNote()}
							type="button"
						>
							{isNoteSaving ? "Working..." : "Ask AI"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={deleteNote !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteNoteId(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete note?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove the note from this unit.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-red-600 text-white hover:bg-red-700"
							onClick={() => void handleDeleteNote()}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={isExportDialogOpen}
				onOpenChange={setIsExportDialogOpen}
			>
				<DialogContent className="overflow-hidden p-0 sm:max-w-[430px]">
					<DialogHeader className="border-0 px-6 pt-6 pb-3">
						<DialogTitle className="text-[16px] font-bold">
							Export unit
						</DialogTitle>
						<DialogDescription className="mt-1 max-w-[340px] text-[13px] leading-relaxed text-[#6E6E73]">
							Choose the format you need for this unit.
						</DialogDescription>
					</DialogHeader>
					<div className="px-3 pb-3">
						<button
							className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isPrintingTheory}
							onClick={() => void handlePrintTheoryExport()}
							type="button"
						>
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#CFEFDB] bg-[#F0FDF4] text-[#15803D]">
								<Printer size={17} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-[14px] font-semibold text-[#1D1D1F]">
									{isPrintingTheory ?
										"Preparing theory..."
									:	"Print theory PDF"}
								</span>
								<span className="mt-0.5 block text-[12px] leading-snug text-[#6E6E73]">
									Clean A4 print view with generated modules.
								</span>
							</span>
							<ChevronRight
								className="shrink-0 text-[#C7C7CC] transition group-hover:translate-x-0.5 group-hover:text-[#86868B]"
								size={16}
							/>
						</button>

						<div className="mx-3 h-px bg-[#F0F0F2]" />

						<button
							className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left transition hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isDownloadingActivities}
							onClick={() =>
								void handleDownloadActivitiesExport()
							}
							type="button"
						>
							<span className="app-export-download-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#D5E4FF] bg-[#EFF6FF] text-[#2563EB]">
								<Download size={17} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-[14px] font-semibold text-[#1D1D1F]">
									{isDownloadingActivities ?
										"Preparing activities..."
									:	"Download activities HTML"}
								</span>
								<span className="mt-0.5 block text-[12px] leading-snug text-[#6E6E73]">
									Offline activities with local checks and keys.
								</span>
							</span>
							<ChevronRight
								className="shrink-0 text-[#C7C7CC] transition group-hover:translate-x-0.5 group-hover:text-[#86868B]"
								size={16}
							/>
						</button>
					</div>
					<DialogFooter className="border-0 bg-[#FAFAFB] px-6 py-3">
						<button
							className="rounded-full border border-[#D4D7DD] bg-white px-4 py-2 text-[13px] font-semibold text-[#374151] transition hover:border-[#C7C7CC] hover:bg-[#F5F5F7]"
							onClick={() => setIsExportDialogOpen(false)}
							type="button"
						>
							Cancel
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{printSnapshot && (
				<UnitExportPrintView
					onClose={() => setPrintSnapshot(null)}
					onPrint={requestPrint}
					snapshot={printSnapshot}
				/>
			)}

			<AlertDialog
				open={regenerateConfirmOpen}
				onOpenChange={setRegenerateConfirmOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{activeChapter.status === "ready" ?
								"Regenerate this module?"
							:	"Retry generating this module?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							<div className="space-y-3">
								{activeChapter.status === "ready" ?
									<>
										The module will be generated again and the
										text you see now will be replaced. Earlier
										snapshots stay available: open{" "}
										<strong className="font-medium text-[#1D1D1F]">
											Version History
										</strong>{" "}
										in the header to review or restore a
										previous version.
									</>
								:	<>
										We will run generation again for this
										module. If a snapshot was already saved, you
										can open it from{" "}
										<strong className="font-medium text-[#1D1D1F]">
											Version History
										</strong>{" "}
										in the header.
									</>
								}
								{regenerationCost && (
									<div className="flex items-center gap-2">
										<span>This action will cost</span>
										<CoinAmount
											type={regenerationCost.coinType}
											amount={regenerationCost.amount}
										/>
									</div>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								void handlePrimaryGeneration();
							}}
						>
							{activeChapter.status === "ready" ?
								"Regenerate"
							:	"Retry"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			{editorGuideDialog}
		</div>
	);
}
