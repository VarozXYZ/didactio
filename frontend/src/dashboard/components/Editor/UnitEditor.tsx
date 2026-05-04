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
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Edit3,
	History,
	Loader2,
	MoreHorizontal,
	Undo2,
	RotateCcw,
	Settings,
	Share2,
	Sparkles,
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
import {useNavigate} from "react-router-dom";
import {
	type BackendDidacticUnitReadingProgressResponse,
	type BackendGenerationQuality,
	type BackendDidacticUnitChapterDetail,
	type BackendGenerationRun,
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
	getStatusPillClass,
	measurePages,
	type MeasuredModulePage,
} from "../../pageLayout";
import {TiptapHtmlEditor} from "./TiptapHtmlEditor";
import {ChapterRenderer} from "../Content/ChapterRenderer";
import {ChapterStyleMenu} from "./ChapterStyleMenu";
import {EditorToolbar} from "./EditorToolbar";
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
} from "../../utils/markdown";
import {getFolderEmoji} from "../../utils/folderDisplay";
import {useAuth} from "../../../auth/AuthProvider";
import {CoinAmount} from "@/components/Coin";
import {getModuleRegenerationCost} from "../../utils/coinPricing";
import {
	resolvePresentationTheme,
	themeVars,
} from "../../utils/themeVars";
import type {PresentationTheme} from "../../../types/presentationTheme";
import {FONT_CATALOG, STYLE_PRESETS, type FontId} from "../../utils/typography";

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
	page: MeasuredModulePage,
): page is Extract<
	MeasuredModulePage,
	{kind: "content" | "content_with_actions"}
> {
	return page.kind === "content" || page.kind === "content_with_actions";
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

// FontId (camelCase) → PresentationFont (kebab-case) for keys that differ.
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
		lineHeight: 1.6,
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
	const [isEditMode, setIsEditMode] = useState(false);
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
	const [currentSpread, setCurrentSpread] = useState(0);
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
	// Merge preset fonts from draft.textStyle into the resolved theme so CSS vars
	// always reflect the current style preset rather than the raw stored fonts.
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
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

	// When presentation preset changes, load the two preset fonts before paginating.
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
	const paginatedContentPages = useMemo(
		() =>
			measuredReadPages
				.filter(isMeasuredContentPage)
				.map((page) => page.markdown),
		[measuredReadPages],
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

		if (!activeChapter || measuredReadPages.length === 0) {
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
			measuredReadPages.length <= savedLastVisitedPageIndex
		) {
			return;
		}

		const lastVisitedPageIndex = Math.max(
			0,
			Math.min(savedLastVisitedPageIndex, measuredReadPages.length - 1),
		);
		setCurrentSpread(Math.floor(lastVisitedPageIndex / 2));
		setLastRestoredActivationKey(activeChapterActivation.key);
	}, [
		activeChapter?.chapterIndex,
		activeChapter?.lastVisitedPageIndex,
		activeChapterActivation,
		isEditMode,
		lastRestoredActivationKey,
		measuredReadPages,
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
				toastError(
					actionError instanceof Error ?
						actionError.message
					:	"Didactic unit action failed.",
				);
				setIsSaving(false);
				await refreshUser();
			} finally {
				setIsSubmitting(false);
				setIsStreamingGeneration(false);
				setActiveGeneratingChapterIndex(null);
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
					await dashboardApi.streamGenerationRun(runId, {
						onPartialHtmlBlock: ({block}) => {
							queueStreamingHtmlBlock(block);
						},
					});

					flushStreamingHtml();
				} catch (actionError) {
					toastError(
						actionError instanceof Error ?
							actionError.message
						:	"Module generation failed.",
					);
				} finally {
					await refreshWorkspaceAfterGeneration();
				}
			}
		} catch (actionError) {
			generationQueueBlockedRef.current = true;
			toastError(
				actionError instanceof Error ?
					actionError.message
				:	"Didactic unit generation failed.",
			);
			setIsSaving(false);
		} finally {
			isGenerationQueueRunningRef.current = false;
			setIsSubmitting(false);
			setIsStreamingGeneration(false);
			setActiveGeneratingChapterIndex(null);
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
			Math.max(0, measuredReadPages.length - 1),
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
		measuredReadPages.length,
		navigate,
		persistReadProgress,
		workspace,
	]);

	const totalVisiblePages =
		isEditMode ?
			Math.max(visibleEditablePages.length, 1)
		:	Math.max(measuredReadPages.length, 1);
	const totalSpreads = Math.max(1, Math.ceil(totalVisiblePages / 2));
	const canGoPrev = currentSpread > 0;
	const canGoNext = currentSpread < totalSpreads - 1;

	const persistVisitedSpread = useCallback(
		(nextSpread: number) => {
			if (
				isEditMode ||
				!activeChapter ||
				measuredReadPages.length === 0
			) {
				return;
			}

			const lastVisitedPageIndex = Math.max(
				0,
				Math.min(nextSpread * 2 + 1, measuredReadPages.length - 1),
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
		[activeChapter, isEditMode, measuredReadPages, persistReadProgress],
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
		persistVisitedSpread(nextSpread);
	}, [currentSpread, persistVisitedSpread]);

	useEffect(() => {
		if (currentSpread > totalSpreads - 1) {
			setCurrentSpread(Math.max(0, totalSpreads - 1));
		}
	}, [currentSpread, totalSpreads]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
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
	const leftReadPage = measuredReadPages[contentPageOffset];
	const rightReadPage = measuredReadPages[contentPageOffset + 1];
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
	const spreadPageLabel =
		spreadStartPage === spreadEndPage ?
			`Page ${spreadStartPage} of ${totalVisiblePages}`
		:	`Pages ${spreadStartPage}-${spreadEndPage} of ${totalVisiblePages}`;

	const updatePaginatedContentPage = (
		pageIndex: number,
		markdown: string,
	) => {
		setContentPageDrafts((previous) => {
			const nextPages =
				previous.length > 0 ? [...previous] : [...visibleEditablePages];

			while (pageIndex >= nextPages.length) {
				nextPages.push("");
			}

			nextPages[pageIndex] = markdown;

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

	const renderPostModuleActionBody = ({
		hasNextModule,
		primaryActionLabel,
	}: {
		hasNextModule: boolean;
		primaryActionLabel: string;
	}) => (
		<div className="flex-shrink-0 space-y-4">
			<div className="space-y-2">
				<div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#86868B]">
					{hasNextModule ? "Ready to continue" : "Unit complete"}
				</div>
				<p className="text-[13px] leading-[1.7] text-[#4B5563]">
					{hasNextModule ?
						"You can keep your momentum going with the next module, or come back later for practice exercises."
					:	"You have reached the end of this unit. Practice exercises are coming soon, and you can wrap up for now."
					}
				</p>
			</div>
			<div className="grid gap-2.5">
				<button
					className="flex w-full items-center gap-2 rounded-2xl border border-[#E5E5E7] bg-[#F8F8F9] px-4 py-3 text-left text-sm font-semibold text-[#A1A1AA]"
					disabled
					type="button"
				>
					<WandSparkles size={16} />
					<span>Quick Check</span>
					<span className="ml-auto text-[11px] font-medium uppercase tracking-wide">
						Coming soon
					</span>
				</button>
				<button
					className="flex w-full items-center gap-2 rounded-2xl border border-[#E5E5E7] bg-[#F8F8F9] px-4 py-3 text-left text-sm font-semibold text-[#A1A1AA]"
					disabled
					type="button"
				>
					<Sparkles size={16} />
					<span>Applied Practice</span>
					<span className="ml-auto text-[11px] font-medium uppercase tracking-wide">
						Coming soon
					</span>
				</button>
				<button
					className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isSubmitting || isPostModuleActionPending}
					onClick={() => {
						void handlePostModulePrimaryAction();
					}}
					type="button"
				>
					<span>{primaryActionLabel}</span>
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
	);

	const renderContentPage = ({
		editable,
		markdown,
		extraContent,
		pageIndex,
		pageNumber,
	}: {
		editable: boolean;
		markdown: string | undefined;
		extraContent?: ReactNode;
		pageIndex: number;
		pageNumber: number;
	}) => {
		return (
			<div
				className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
				style={{
					height: `${spreadMetrics.pageHeight}px`,
					width: `${spreadMetrics.pageWidth}px`,
					backgroundColor: resolvedThemeVars["--unit-page-bg"] as string ?? "#ffffff",
				}}
			>
				<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5">
					<div
						className={cn(
							"relative flex min-h-0 flex-1 flex-col",
							extraContent ? "overflow-y-auto" : (
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
								initialHtml={markdown ?? ""}
								onFocusEditor={setActiveHtmlEditor}
								onHtmlChange={(nextMarkdown) =>
									updatePaginatedContentPage(
										pageIndex,
										nextMarkdown,
									)
								}
								placeholder="Write the module content here..."
							/>
						:	<ChapterRenderer
								html={markdown ?? ""}
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

	const renderFirstPage = ({
		editable,
		markdown,
		extraContent,
		pageNumber,
	}: {
		editable: boolean;
		markdown: string | undefined;
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
				backgroundColor: resolvedThemeVars["--unit-page-bg"] as string ?? "#ffffff",
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
						extraContent ? "overflow-y-auto" : "overflow-hidden",
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
							initialHtml={markdown ?? ""}
							onFocusEditor={setActiveHtmlEditor}
							onHtmlChange={(nextMarkdown) =>
								updatePaginatedContentPage(0, nextMarkdown)
							}
							placeholder="Write the module content here..."
						/>
					:	<ChapterRenderer
							html={markdown ?? ""}
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
		page: MeasuredModulePage | undefined;
		pageNumber: number;
	}) => {
		if (!page) {
			return null;
		}

		if (page.kind === "post_module_actions") {
			if (isActiveChapterStreaming) return null;
			return (
				<div
					className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] bg-white shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
					style={{
						height: `${spreadMetrics.pageHeight}px`,
						width: `${spreadMetrics.pageWidth}px`,
					}}
				>
					<div className="flex h-full flex-col overflow-hidden px-5 py-4 md:px-6 md:py-5">
						<div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#86868B]">
							Next Steps
						</div>
						<div className="flex min-h-0 flex-1 flex-col justify-start">
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
			markdown: page.markdown,
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
									markdown: leftEditablePage,
									pageNumber: 1,
								})
							: (
								leftReadPage &&
								isMeasuredContentPage(leftReadPage)
							) ?
								renderFirstPage({
									editable: false,
									markdown: leftReadPage.markdown,
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
								markdown: leftEditablePage,
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
									markdown: rightEditablePage,
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
				className="mt-3 flex max-w-full items-center justify-center gap-1.5 md:gap-2"
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
										Streaming
									</span>
								)}
								{isActiveChapterStreaming && (
									<span className="text-[11px] text-[#D1D5DB]">
										•
									</span>
								)}
								<span className="text-[11px] text-[#86868B] md:text-[13px]">
									{spreadPageLabel}
								</span>
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
						const canAiModule =
							hasConfiguredGenerationTier &&
							(chapter.status === "ready" ||
								chapter.status === "pending" ||
								chapter.status === "failed");
						const aiBusy = isSubmitting || isStreamingGeneration;
						const aiLabel =
							chapter.status === "ready" ? "Regenerate module"
							: chapter.status === "failed" ? "Retry generation"
							: "Generate module";
						const chapterNeedsPaidRegeneration =
							chapter.status === "ready" ||
							chapter.status === "failed";
						const canPayChapterAction =
							!chapterNeedsPaidRegeneration ||
							canPayRegeneration;
						const canMarkRead =
							chapter.status === "ready" && !chapter.isCompleted;

						return (
							<div
								key={chapter.chapterIndex}
								className={cn(
									"group relative flex w-full items-start gap-1.5 rounded-[14px] transition-all duration-200",
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
								<button
									className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
									onClick={() =>
										setActiveChapterIndex(
											chapter.chapterIndex,
										)
									}
									type="button"
								>
									<span
										className={cn(
											"mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold tabular-nums transition-colors",
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
													{chapterNeedsPaidRegeneration &&
														regenerationCost && (
															<span className="ml-auto">
																<CoinAmount
																	type={
																		regenerationCost.coinType
																	}
																	amount={
																		regenerationCost.amount
																	}
																	size={14}
																/>
															</span>
														)}
												</DropdownMenuItem>
											:	null}
											{(
												canAiModule &&
												unitGenerationTier &&
												canMarkRead
											) ?
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
