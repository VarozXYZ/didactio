import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	AlertCircle,
	BookOpenCheck,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	CirclePlus,
	Code2,
	Dumbbell,
	Edit3,
	FileQuestion,
	Layers3,
	History,
	Loader2,
	MoreHorizontal,
	Brain,
	Undo2,
	RotateCcw,
	Settings,
	Share2,
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
	DropdownMenuSeparator,
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
	type BackendDidacticUnitChapterDetail,
	type BackendGenerationRun,
	type BackendLearningActivity,
	type BackendLearningActivityAttempt,
	type BackendLearningActivityScope,
	type BackendLearningActivityType,
	DashboardApiError,
	dashboardApi,
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
import {CoinAmount} from "@/components/Coin";
import {getModuleRegenerationCost} from "../../utils/coinPricing";
import {
	resolvePresentationTheme,
	themeVars,
} from "../../utils/themeVars";
import type {PresentationTheme} from "../../../types/presentationTheme";
import {
	FONT_CATALOG,
	STYLE_PRESETS,
	resolveBodyLineHeight,
	type FontId,
} from "../../utils/typography";

function ChapterStatusIcon({
	status,
	isCompleted,
	isGenerating,
}: {
	status: "pending" | "ready" | "failed";
	isCompleted: boolean;
	isGenerating: boolean;
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
	level: 2;
	number: string;
	pageIndex: number;
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
	return chapter.htmlBlocks.flatMap((block): ModuleOutlineItem[] => {
		if (block.type !== "heading") {
			return [];
		}

		const heading = parseHeadingFromHtml(block.html);
		if (!heading || heading.level !== 2) {
			return [];
		}

		section += 1;
		const number = `${section}.`;
		const title = stripLeadingHeadingNumber(heading.title);

		return [
			{
				id: block.id,
				kind: "section",
				level: 2,
				number,
				pageIndex: findMeasuredPageIndexForOffset(
					pages,
					block.textStartOffset,
				),
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

function resolvePostModuleCompletionStyle(presetId: string | undefined) {
	const resolvedPresetId = presetId ?? "classic";
	const preset = STYLE_PRESETS[resolvedPresetId] ?? STYLE_PRESETS.classic;
	const headingFamily = FONT_CATALOG[preset.heading].family;
	const bodyFamily = FONT_CATALOG[preset.body].family;

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
			headingColor: "#111827",
			bodyColor: "#4B5563",
			primaryBackground: "#111827",
			primaryHover: "#1F2937",
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
		headingColor: "#111827",
		bodyColor: "#4B5563",
		primaryBackground: "#111827",
		primaryHover: "#1F2937",
		primaryIconBackground: "rgba(16,185,129,0.20)",
		secondaryIconBackground: "#ECFDF5",
		badgeBackground: "#ECFDF5",
		tipBackground: "rgba(255,255,255,0.80)",
		tipBorder: "#DCFCE7",
	};
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
	const [isSaving, setIsSaving] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isPostModuleActionPending, setIsPostModuleActionPending] =
		useState(false);
	const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
	const [learningActivities, setLearningActivities] = useState<
		Record<number, BackendLearningActivity[]>
	>({});
	const [activityAttempts, setActivityAttempts] = useState<
		Record<string, BackendLearningActivityAttempt[]>
	>({});
	const [activityScope, setActivityScope] =
		useState<BackendLearningActivityScope>("current_module");
	const [activityType, setActivityType] =
		useState<BackendLearningActivityType>("multiple_choice");
	const [activityQuality, setActivityQuality] =
		useState<BackendGenerationQuality>("silver");
	const [isActivityLoading, setIsActivityLoading] = useState(false);
	const [isActivityAttemptSubmitting, setIsActivityAttemptSubmitting] =
		useState(false);
	const [isEditMode, setIsEditMode] = useState(false);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
	const [currentSpread, setCurrentSpread] = useState(0);
	const [isPagePickerOpen, setIsPagePickerOpen] = useState(false);
	const [collapsedOutlineChapterIndex, setCollapsedOutlineChapterIndex] =
		useState<number | null>(null);
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
	const resolvedTheme = useMemo(
		() =>
			resolvePresentationTheme(
				workspace?.presentationTheme,
				user?.defaultPresentationTheme,
			),
		[workspace?.presentationTheme, user?.defaultPresentationTheme],
	);
	const effectiveTheme = useMemo(
		() =>
			draft ?
				themeFromTextStyle(resolvedTheme, draft.textStyle)
			:	resolvedTheme,
		[resolvedTheme, draft],
	);
	const resolvedThemeVars = useMemo(
		() => themeVars(effectiveTheme),
		[effectiveTheme],
	);
	const [activeGeneratingChapterIndex, setActiveGeneratingChapterIndex] =
		useState<number | null>(null);
	const [activeRunId, setActiveRunId] = useState<string | null>(null);
	const [isCancellingGeneration, setIsCancellingGeneration] = useState(false);
	const [viewport, setViewport] = useState(() => ({
		height: typeof window !== "undefined" ? window.innerHeight : 900,
		width: typeof window !== "undefined" ? window.innerWidth : 1440,
	}));
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
	const lastReadingProgressPayloadRef = useRef<string | null>(null);
	const streamingHtmlBufferRef = useRef("");
	const streamingHtmlFlushTimeoutRef = useRef<number | null>(null);
	const isCancellingGenerationRef = useRef(false);

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
				const [unit, chaptersResponse] = await Promise.all([
					dashboardApi.getDidacticUnit(didacticUnitId),
					dashboardApi.listDidacticUnitChapters(didacticUnitId),
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
							(preferredChapterIndex ?? activeChapterIndexRef.current),
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
		isEditModeRef.current = isEditMode;
	}, [isEditMode]);

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

	const activeDraftSettings =
		isDraftForActiveChapter ?
			draft.textStyle
		: 	activeChapter?.textStyle;

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
	const measuredReadPages = useMemo(
		() =>
			fontsReady && activeChapterLayoutSnapshot && activeDraftContent ?
				measurePages({
					activeChapter: activeChapterLayoutSnapshot,
					chapterIndex: activeChapterLayoutSnapshot.chapterIndex,
					content: activeDraftContent,
					hasNextModule: hasNextActiveModule,
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
			spreadMetrics.pageHeight,
			spreadMetrics.pageWidth,
			activeDraftSettings,
		],
	);
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
		setCurrentSpread(Math.floor(lastVisitedPageIndex / 2));
		setLastRestoredActivationKey(activeChapterActivation.key);
	}, [
		activeChapter?.chapterIndex,
		activeChapter?.lastVisitedPageIndex,
		activeChapterActivation,
		isEditMode,
		lastRestoredActivationKey,
		readPages.length,
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
						actionError instanceof Error ?
							actionError.message
						:	"Didactic unit action failed.",
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

		const nextChapter =
			workspace.chapters.find(
				(chapter) =>
					chapter.chapterIndex === activeChapter.chapterIndex + 1,
			) ?? null;

		setIsPostModuleActionPending(false);

		if (nextChapter) {
			setActiveChapterIndex(nextChapter.chapterIndex);
			return;
		}

		navigate("/dashboard");
	}, [
		activeChapter,
		isPostModuleActionPending,
		navigate,
		persistReadProgress,
		readPages.length,
		workspace,
	]);

	const totalVisiblePages =
		isEditMode ?
			Math.max(visibleEditablePages.length, 1)
		:	Math.max(readPages.length, 1);
	const totalSpreads = Math.max(1, Math.ceil(totalVisiblePages / 2));
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
				Math.min(nextSpread * 2 + 1, readPages.length - 1),
			);
			const visibleTextOffset = getReadTextOffsetForSpread(
				measuredReadPages,
				nextSpread,
			);

			void persistReadProgress(
				activeChapter,
				visibleTextOffset,
				lastVisitedPageIndex,
			);
		},
		[activeChapter, isEditMode, measuredReadPages, persistReadProgress, readPages.length],
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
				Math.min(Math.floor(pageIndex / 2), totalSpreads - 1),
			);

			setSelectedOutlineItemId(outlineItemId ?? null);
			setCurrentSpread(nextSpread);
			persistVisitedSpread(nextSpread);
		},
		[persistVisitedSpread, totalSpreads],
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
			currentSpread * 2 + 1,
			totalVisiblePages - 1,
		);
		const activeItem = moduleOutline
			.filter((item) => item.pageIndex <= visibleEndPageIndex)
			.at(-1);

		return activeItem?.id ?? null;
	}, [
		currentSpread,
		moduleOutline,
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

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-[#F5F5F7]">
				<Loader2 size={32} className="animate-spin text-[#86868B]" />
			</div>
		);
	}

	if (!workspace || !activeChapter || !draft) {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-[#F5F5F7]">
				<Loader2 size={32} className="animate-spin text-[#86868B]" />
			</div>
		);
	}

	const getStatusIcon = (chapter: DidacticUnitEditorChapter) => {
		const isGenerating =
			isStreamingGeneration &&
			activeGeneratingChapterIndex !== null &&
			activeGeneratingChapterIndex === chapter.chapterIndex;
		return (
			<ChapterStatusIcon
				status={chapter.status}
				isCompleted={chapter.isCompleted}
				isGenerating={isGenerating}
			/>
		);
	};

	const isPendingChapter = activeChapter.status === "pending";
	const isFailedChapter = activeChapter.status === "failed";
	const hasConfiguredGenerationTier = unitGenerationTier !== null;
	const regenerationCost =
		unitGenerationTier ?
			getModuleRegenerationCost({quality: unitGenerationTier})
		:	null;
	const canPayRegeneration =
		!regenerationCost ||
		(user?.credits[regenerationCost.coinType] ?? 0) >=
			regenerationCost.amount;
	const contentPageOffset = currentSpread * 2;
	const leftReadPage = readPages[contentPageOffset];
	const rightReadPage = readPages[contentPageOffset + 1];
	const leftEditablePage = visibleEditablePages[contentPageOffset];
	const rightEditablePage = visibleEditablePages[contentPageOffset + 1];
	const spreadStartPage = contentPageOffset + 1;
	const hasRightPage =
		isEditMode ?
			rightEditablePage !== undefined
		:	rightReadPage !== undefined;
	const spreadEndPage =
		hasRightPage ?
			Math.min(contentPageOffset + 2, totalVisiblePages)
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
				const startPage = spreadIndex * 2 + 1;
				const endPage = Math.min(startPage + 1, totalVisiblePages);
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
				const targetSpread = Math.floor(targetPageIndex / 2);
				setCurrentSpread(targetSpread);
				setSelectedOutlineItemId(`activity-${activity.id}`);
				void persistReadProgress(
					activeChapter,
					getReadTextOffsetForSpread(measuredReadPages, targetSpread),
					targetPageIndex,
				);
			}
			setIsActivityModalOpen(false);
		} catch (error) {
			toastError(
				error instanceof Error ?
					error.message
				:	"Could not create the activity.",
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
	};

	const postModuleCompletionStyle = resolvePostModuleCompletionStyle(
		draft.textStyle.stylePreset,
	);

	const renderPostModuleActionBody = ({
		hasNextModule,
		primaryActionLabel,
	}: {
		hasNextModule: boolean;
		primaryActionLabel: string;
	}) => (
		<div
			className="flex-shrink-0 rounded-[22px] border p-5"
			style={{
				background: postModuleCompletionStyle.panelBackground,
				borderColor: postModuleCompletionStyle.panelBorder,
				boxShadow: postModuleCompletionStyle.panelShadow,
				color: postModuleCompletionStyle.bodyColor,
				fontFamily: postModuleCompletionStyle.bodyFamily,
			}}
		>
			<div className="text-center">
				<div
					className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border"
					style={{
						backgroundColor: postModuleCompletionStyle.accentSoft,
						borderColor: postModuleCompletionStyle.tipBorder,
						color: postModuleCompletionStyle.accent,
					}}
				>
					<CheckCircle2 size={22} />
				</div>
				<div className="mt-3 text-[11px] font-bold uppercase tracking-[0.24em] text-[#6B7280]">
					Next steps
				</div>
				<h3
					className="mt-1 text-2xl font-bold tracking-tight"
					style={{
						color: postModuleCompletionStyle.headingColor,
						fontFamily: postModuleCompletionStyle.headingFamily,
					}}
				>
					Module complete
				</h3>
				<p
					className="mx-auto mt-2 max-w-[460px] text-sm leading-relaxed"
					style={{color: postModuleCompletionStyle.bodyColor}}
				>
					You have finished the theory part. Practice now or continue to the next topic.
				</p>
			</div>

			<div className="mt-6 grid gap-4">
				<button
					className="group flex min-h-[164px] w-full flex-col rounded-[20px] p-5 text-left text-white transition-all hover:-translate-y-0.5"
					onClick={() => setIsActivityModalOpen(true)}
					onMouseEnter={(event) => {
						event.currentTarget.style.backgroundColor =
							postModuleCompletionStyle.primaryHover;
					}}
					onMouseLeave={(event) => {
						event.currentTarget.style.backgroundColor =
							postModuleCompletionStyle.primaryBackground;
					}}
					style={{
						backgroundColor:
							postModuleCompletionStyle.primaryBackground,
						fontFamily: postModuleCompletionStyle.bodyFamily,
					}}
					type="button"
				>
					<span className="flex w-full items-start justify-between gap-3">
						<span
							className="flex h-11 w-11 items-center justify-center rounded-xl"
							style={{
								backgroundColor:
									postModuleCompletionStyle.primaryIconBackground,
								color: postModuleCompletionStyle.panelBorder,
							}}
						>
							<Dumbbell size={20} />
						</span>
						<span
							className="rounded-full bg-white px-3 py-1 text-[11px] font-bold"
							style={{
								color: postModuleCompletionStyle.accentText,
							}}
						>
							Recommended
						</span>
					</span>
					<span className="mt-5 flex w-full items-center gap-3">
						<span className="min-w-0 flex-1">
							<span
								className="block text-lg font-bold"
								style={{fontFamily: postModuleCompletionStyle.headingFamily}}
							>
								Exercises & Practice
							</span>
							<span className="mt-2 block text-sm font-medium leading-relaxed text-white/75">
								Apply what you learned with guided exercises.
							</span>
						</span>
						<ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
					</span>
				</button>
				<button
					className="group flex min-h-[164px] w-full flex-col rounded-[20px] border border-[#E5E5E7] bg-white p-5 text-left text-[#111827] transition-all hover:-translate-y-0.5 hover:border-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isSubmitting || isPostModuleActionPending}
					onClick={() => {
						void handlePostModulePrimaryAction();
					}}
					type="button"
					style={{fontFamily: postModuleCompletionStyle.bodyFamily}}
				>
					<span className="flex w-full items-start justify-between gap-3">
						<span
							className="flex h-11 w-11 items-center justify-center rounded-xl"
							style={{
								backgroundColor:
									postModuleCompletionStyle.secondaryIconBackground,
								color: postModuleCompletionStyle.accent,
							}}
						>
							<BookOpenCheck size={20} />
						</span>
						<span
							className="rounded-full px-3 py-1 text-[11px] font-bold"
							style={{
								backgroundColor:
									postModuleCompletionStyle.badgeBackground,
								color: postModuleCompletionStyle.accentText,
							}}
						>
							Continue
						</span>
					</span>
					<span className="mt-5 flex w-full items-center gap-3">
						<span className="min-w-0 flex-1">
							<span
								className="block text-lg font-bold"
								style={{
									color: postModuleCompletionStyle.headingColor,
									fontFamily: postModuleCompletionStyle.headingFamily,
								}}
							>
								{primaryActionLabel}
							</span>
							<span className="mt-2 block text-sm font-medium leading-relaxed text-[#4B5563]">
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
				className="mx-auto mt-5 w-fit rounded-2xl border px-4 py-3 text-center text-sm"
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
				<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[760px]">
					<DialogHeader>
						<DialogTitle>Exercises & Practice</DialogTitle>
						<DialogDescription>
							{hasNextModule ?
								"Create a structured activity before moving to the next module."
							:	"Create a structured activity to close out this unit."
							}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-6 px-6 py-5">
						<div className="rounded-[18px] bg-[#F5F5F7] p-1">
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
												"flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-bold transition",
												selected ?
													"bg-white text-[#16A34A] shadow-sm ring-1 ring-[#4ADE80]"
												:	"text-[#6B7280] hover:text-[#111827]",
											)}
										>
											<TabIcon size={15} />
											{option.label}
										</button>
									);
								})}
							</div>
						</div>

						<div className="-mx-6 border-t border-[#F0F0F2]" />

						<div>
							<div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#86868B]">
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
												"relative flex items-start gap-3 rounded-2xl border p-3 text-left transition",
												selected ?
													"border-[#4ADE80] bg-[#F0FDF4] text-[#111827]"
												:	"border-[#E5E5E7] bg-white text-[#111827] hover:border-[#D1D5DB]",
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
													"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
													selected ?
														"bg-[#DCFCE7] text-[#16A34A]"
													:	"bg-[#F3F4F6] text-[#111827]",
												)}
											>
												<Icon size={17} />
											</span>
											<span>
												<span className="block text-sm font-bold">{option.label}</span>
												<span className="mt-1 block text-xs leading-relaxed text-[#6B7280]">
													{option.description}
												</span>
											</span>
										</button>
									);
								})}
							</div>
						</div>

						<div className="-mx-6 border-t border-[#F0F0F2]" />

						<div>
							<div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#86868B]">
								Model
							</div>
							<div className="grid gap-2 sm:grid-cols-2">
								{[
									{value: "silver" as const, label: "Silver model", cost: "1 silver", detail: "Fast practice generation"},
									{value: "gold" as const, label: "Gold model", cost: "3 silver", detail: "Deeper activity and feedback"},
								].map((option) => {
									const selected = activityQuality === option.value;
									return (
										<button
											key={option.value}
											type="button"
											onClick={() => setActivityQuality(option.value)}
											className={cn(
												"relative flex items-center gap-3 rounded-2xl border p-3 text-left transition",
												selected ?
													"border-[#4ADE80] bg-white"
												:	"border-[#E5E5E7] bg-[#F8F8F9] hover:border-[#D1D5DB]",
											)}
										>
											{selected && (
												<CheckCircle2
													size={16}
													className="absolute right-3 top-3 text-[#16A34A]"
													fill="white"
												/>
											)}
											<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-white">
												<Brain size={17} />
											</span>
											<span className="min-w-0">
												<span className="block text-sm font-bold text-[#111827]">{option.label}</span>
												<span className="block text-xs text-[#6B7280]">{option.detail}</span>
											</span>
											<span className="ml-auto whitespace-nowrap rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-bold text-[#374151]">
												{option.cost}
											</span>
										</button>
									);
								})}
							</div>
						</div>

					</div>

					<DialogFooter>
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
							className="gap-2 bg-[#4ADE80] text-[#111827] hover:bg-[#3BCD6F]"
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

	const renderContentPage = ({
		editable,
		html,
		extraContent,
		pageIndex,
		pageNumber,
	}: {
		editable: boolean;
		html: string | undefined;
		extraContent?: ReactNode;
		pageIndex: number;
		pageNumber: number;
	}) => {
		return (
			<div
				className={cn("relative overflow-hidden rounded-[16px] border border-[#E5E5E7] md:rounded-[24px]", !extraContent && "shadow-[0_8px_60px_rgba(0,0,0,0.08)]")}
				style={{
					height: `${spreadMetrics.pageHeight}px`,
					width: `${spreadMetrics.pageWidth}px`,
					backgroundColor: unitPageBackground,
				}}
			>
				<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5">
					<div
						className={cn(
							"relative flex min-h-0 flex-1 flex-col",
							extraContent ? "overflow-hidden" : (
								"overflow-hidden"
							),
						)}
						style={resolvedThemeVars}
					>
						{editable ?
							<TiptapHtmlEditor
								key={`content-${didacticUnitId}-${activeChapter.chapterIndex}-${pageIndex}-edit`}
								contentClassName={cn(
									"leading-[1.9] text-[#1D1D1F] outline-none",
									extraContent ?
										"min-h-0 w-full shrink-0 overflow-visible pb-1"
									:	"h-full min-h-full overflow-auto",
								)}
								baseTextStyle={draft.textStyle}
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
								html={html ?? ""}
								className={cn(
									"unit-page-scope leading-[1.9] text-[#1D1D1F]",
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

					<div className="absolute bottom-4 right-6 text-[10px] font-medium text-[#86868B] md:bottom-6 md:right-10">
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
	}: {
		editable: boolean;
		html: string | undefined;
		extraContent?: ReactNode;
		pageNumber: number;
	}) => {
		const titlePreset =
			STYLE_PRESETS[draft.textStyle.stylePreset ?? "classic"];
		const titleHeadingFamily = FONT_CATALOG[titlePreset.heading].family;
		const titleBodyFamily = FONT_CATALOG[titlePreset.body].family;

		return (
		<div
			className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
			style={{
				height: `${spreadMetrics.pageHeight}px`,
				width: `${spreadMetrics.pageWidth}px`,
				backgroundColor: unitPageBackground,
			}}
		>
			<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5" style={resolvedThemeVars}>
				<div className="flex-shrink-0">
					<div className="flex items-center justify-between gap-4">
						<h2
							className="flex-1 font-bold leading-tight tracking-tight text-[#1D1D1F] outline-none"
							style={{
								fontFamily: titleHeadingFamily,
								fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)",
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
				>
					{editable ?
						<TiptapHtmlEditor
							key={`content-${didacticUnitId}-${activeChapter.chapterIndex}-0-edit`}
							contentClassName={cn(
								"leading-[1.9] text-[#1D1D1F] outline-none",
								extraContent ?
									"min-h-0 w-full shrink-0 overflow-visible pb-1"
								:	"h-full min-h-full overflow-auto",
							)}
							baseTextStyle={draft.textStyle}
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
							html={html ?? ""}
							className={cn(
								"unit-page-scope leading-[1.9] text-[#1D1D1F]",
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

				<div className="absolute bottom-4 right-6 text-[10px] font-medium text-[#86868B] md:bottom-6 md:right-10">
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
			return (
				<div
					className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] bg-white shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
					style={{
						height: `${spreadMetrics.pageHeight}px`,
						width: `${spreadMetrics.pageWidth}px`,
					}}
				>
					<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5">
						<LearningActivityRenderer
							activity={page.activity}
							attempts={activityAttempts[page.activity.id] ?? []}
							isSubmitting={isActivityAttemptSubmitting}
							onSubmitAttempt={handleLearningActivityAttempt}
							onRefillAttempts={handleRefillActivityAttempts}
						/>
						<div className="pointer-events-none absolute bottom-4 right-6 text-[10px] font-medium text-[#86868B] md:bottom-6 md:right-10">
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
					className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] bg-white md:rounded-[24px]"
					style={{
						height: `${spreadMetrics.pageHeight}px`,
						width: `${spreadMetrics.pageWidth}px`,
					}}
				>
					<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5">
						<div className="flex min-h-0 flex-1 items-center justify-center">
							{renderPostModuleActionBody({
								hasNextModule: page.hasNextModule,
								primaryActionLabel: page.primaryActionLabel,
							})}
						</div>
						<div className="pointer-events-none absolute bottom-4 right-6 text-[10px] font-medium text-[#86868B] md:bottom-6 md:right-10">
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
					"mt-3 flex max-w-full items-center justify-center gap-1.5 transition-all duration-150 md:gap-2",
					isPagePickerOpen &&
						"pointer-events-none translate-y-1 scale-95 opacity-0",
				)}
				style={{marginTop: `${spreadMetrics.indicatorGap}px`}}
			>
				{!editable && (
					<button
						aria-label="Previous pages"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E7] bg-white shadow-md transition-all hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-30 md:h-10 md:w-10"
						disabled={!canGoPrev}
						onClick={goToPrevSpread}
						type="button"
					>
						<ChevronLeft size={20} className="text-[#1D1D1F]" />
					</button>
				)}
				<div
					className={cn(
						"rounded-full border border-[#E5E5E7] bg-white/90 py-2 shadow-lg backdrop-blur-sm md:py-3",
						editable ?
							"w-max max-w-full shrink-0 flex-none overflow-x-auto overflow-y-hidden px-2 md:px-4 [-webkit-overflow-scrolling:touch]"
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
										sideOffset={-42}
										className="w-[136px] overflow-hidden rounded-full border-[#E5E5E7] bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm"
									>
										<DidactioWheelPicker
											className="w-full"
											options={pageWheelOptions}
											value={pageWheelValue}
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
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E5E5E7] bg-white shadow-md transition-all hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-30 md:h-10 md:w-10"
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

	return (
		<div className="flex h-screen overflow-hidden bg-[#F5F5F7] font-sans text-[#1D1D1F]">
			<Motion.aside
				className="z-20 flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-[#E5E5E7] bg-white"
				initial={false}
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

				<nav className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
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
							chapter.status === "ready" ? "Regenerate module"
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
						const showModuleOutline =
							isActive &&
							moduleOutline.length > 0 &&
							collapsedOutlineChapterIndex !==
								chapter.chapterIndex;

						return (
							<div
								key={chapter.chapterIndex}
								className={cn(
									"group relative flex w-full flex-col items-stretch gap-2 rounded-[14px] transition-all duration-200",
									"px-2 py-2.5",
									isActive ?
										"bg-[#F5F5F7] text-[#1D1D1F] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
									:	"text-[#6E6E73] hover:bg-[#FAFAFA] hover:text-[#1D1D1F] hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
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
										<DropdownMenu>
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
												className="w-52"
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
													{aiLabel}
													{moduleActionCost && (
														<span className="ml-auto">
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
											{canMarkRead &&
											((canAiModule &&
												unitGenerationTier) ||
												isChapterGenerating) ?
												<DropdownMenuSeparator />
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
										{moduleOutline.map((item, index) => {
											const isCurrentOutlineItem =
												item.id === activeOutlineItemId;
											const isFirst = index === 0;
											const isLast =
												index ===
												moduleOutline.length - 1;
											const ActivityIcon = item.icon;

											return (
												<button
													key={item.id}
													type="button"
													onClick={() =>
														goToPageIndex(
															item.pageIndex,
															item.id,
														)
													}
													className={cn(
														"relative grid min-w-0 items-center gap-1 rounded-[6px] text-left text-[12px] leading-[1.35] transition-colors",
														"mt-1 ml-1.5 w-[calc(100%-0.375rem)] grid-cols-[1.6rem_minmax(0,1fr)] py-1.5 pl-1 pr-1.5",
														item.kind === "section" ?
															"font-medium"
														:	"font-normal",
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
													{moduleOutline.length >
														1 && (
														<span
															aria-hidden
															className={cn(
																"absolute w-0.5 bg-[#DADADF]",
																"-left-1.5",
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
															"-left-1.5 w-2",
														)}
													/>
													<span
														className={cn(
															"flex min-h-5 shrink-0 items-center justify-end font-semibold tabular-nums",
															isCurrentOutlineItem ?
																"text-[#34C759]"
															: item.kind === "section" ?
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
															item.kind === "section" ?
																"text-[#4B5563]"
															:	"text-[#6E6E73]",
															isCurrentOutlineItem &&
																"font-medium text-[#1D1D1F]",
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

				<div className="shrink-0 space-y-0.5 border-t border-[#E5E5E7] p-3">
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
						type="button"
					>
						<Share2 size={16} />
						<span>Export Unit</span>
					</button>
					<button
						className="flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-[13px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
						type="button"
					>
						<Settings size={16} />
						<span>Settings</span>
					</button>
				</div>
			</Motion.aside>

			<main className="relative flex h-full flex-1 flex-col overflow-hidden">
				<header className="z-10 flex h-[64px] shrink-0 items-center justify-between border-b border-[#E5E5E7] bg-white/80 px-6 backdrop-blur-md">
					<div className="flex items-center gap-4">
						<div className="flex flex-col gap-0.5">
							<h1 className="text-[20px] font-bold text-[#1D1D1F]">
								{workspace.title}
							</h1>
							<div className="flex items-baseline gap-1.5">
								<span className="text-[11px] leading-none">
									{getFolderEmoji(workspace.folder.icon)}
								</span>
								<span className="text-[11px] font-medium text-[#AEAEB2]">
									{workspace.folder.name}
								</span>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-6">
						<div className="flex items-center gap-2 text-[13px] text-[#86868B]">
							<span
								className={cn(
									"h-2 w-2 rounded-full",
									isSaving || isSubmitting ? "bg-amber-400"
									:	"bg-[#4ADE80]",
								)}
							/>
							{isSaving || isSubmitting ? "Saving..." : "Saved"}
						</div>

						<div className="h-4 w-[1px] bg-[#E5E5E7]" />

						<div className="flex items-center gap-1.5">
							<button
								className="flex items-center gap-2 rounded-full border border-[#D4D7DD] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1D1D1F] transition-all hover:bg-[#F5F5F7]"
								onClick={() =>
									setIsHistoryOpen((value) => !value)
								}
								type="button"
							>
								<History size={16} className="text-[#86868B]" />
								<span>Version History</span>
							</button>
							{hasConfiguredGenerationTier &&
								(activeChapter.status === "ready" ||
									activeChapter.status === "failed") && (
									<button
										className="flex items-center gap-2 rounded-full border border-[#D4D7DD] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1D1D1F] transition-all hover:bg-[#F5F5F7]"
										onClick={() =>
											setRegenerateConfirmOpen(true)
										}
										type="button"
									>
										<RotateCcw
											size={16}
											className="text-[#86868B]"
										/>
										<span>
											{activeChapter.status === "ready" ?
												"Regenerate"
											:	"Retry"}
										</span>
									</button>
								)}
							{draft !== null && (
								<ChapterStyleMenu
									compact={false}
									value={draft.textStyle}
									onChange={(textStyle) => {
										setDraft((previous) =>
											previous ?
												{
													...previous,
													textStyle,
												}
											:	previous,
										);
										const presentationTheme =
											themeFromTextStyle(
												resolvedTheme,
												textStyle,
											);
										setWorkspace((previous) =>
											previous ?
												{
													...previous,
													presentationTheme,
												}
											:	previous,
										);
										void dashboardApi
											.updateDidacticUnitTheme(
												didacticUnitId,
												presentationTheme,
											)
											.catch((error) => {
												toastError(
													error instanceof Error ?
														error.message
													:	"Could not update the unit style.",
												);
											});
									}}
								/>
							)}
							{isEditMode ?
								<div
									className="flex h-8 w-[117px] overflow-hidden rounded-full border border-[#D4D7DD] bg-white shadow-sm"
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
							: 	<Button
									className="h-8 w-[117px] gap-2 rounded-full bg-[#1D1D1F] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#333333]"
									onClick={enterEditMode}
									type="button"
								>
									<Edit3 size={16} />
									<span>Edit Mode</span>
								</Button>
							}
						</div>
					</div>
				</header>

				<div className="relative flex flex-1 flex-col items-center justify-center bg-[#F5F5F7] px-3 py-4 md:px-6 md:py-6">
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
			</main>

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
								<div className="flex items-center gap-2">
									<span>This action will cost</span>
									<CoinAmount type="bronze" amount={1} />
								</div>
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
		</div>
	);
}
