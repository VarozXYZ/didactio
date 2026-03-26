import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    AlertCircle,
    ArrowLeft,
    CheckCheck,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Edit3,
    FileText,
    History,
    LayoutDashboard,
    Loader2,
    MoreHorizontal,
    RotateCcw,
    Settings,
    Share2,
    Sparkles,
    Target,
    WandSparkles,
    X,
} from 'lucide-react'
import type { LexicalEditor } from 'lexical'
import { AnimatePresence, motion as Motion } from 'motion/react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useNavigate } from 'react-router-dom'
import {
    type BackendAiModelTier,
    type BackendDidacticUnitChapterDetail,
    type BackendGenerationRun,
    DashboardApiError,
    dashboardApi,
} from '../../api/dashboardApi'
import {
    adaptDidacticUnitEditor,
    adaptDidacticUnitRevisions,
} from '../../adapters'
import {
    calculateSpreadMetrics,
    getStatusPillClass,
    paginateMarkdownContent,
} from '../../pageLayout'
import { LexicalMarkdownEditor } from './LexicalMarkdownEditor'
import { ChapterStyleMenu } from './ChapterStyleMenu'
import { LexicalToolbar } from './LexicalToolbar'
import type {
    ChapterPresentationSettings,
    DidacticUnitEditorChapter,
    DidacticUnitEditorViewModel,
    DidacticUnitRevisionViewModel,
} from '../../types'
import { formatRelativeTimestamp } from '../../utils/topicMetadata'
import {
    keyTakeawaysToMarkdown,
    markdownToKeyTakeaways,
    normalizeMarkdownForStorage,
    normalizeStoredMarkdown,
} from '../../utils/markdown'

type UnitEditorProps = {
    didacticUnitId: string
    onDataChanged: () => void
}

type ChapterDraft = {
    title: string
    overviewMarkdown: string
    contentMarkdown: string
    keyTakeawaysMarkdown: string
    presentationSettings: ChapterPresentationSettings
}

function cn(...inputs: Array<string | false | null | undefined>) {
    return twMerge(clsx(inputs))
}

function buildDraft(
    chapter: DidacticUnitEditorChapter,
    detail: BackendDidacticUnitChapterDetail | undefined
): ChapterDraft {
    return {
        title: detail?.title ?? chapter.title,
        overviewMarkdown: normalizeStoredMarkdown(detail?.overview ?? chapter.summary),
        contentMarkdown: normalizeStoredMarkdown(detail?.content ?? chapter.content),
        keyTakeawaysMarkdown: keyTakeawaysToMarkdown(
            detail?.keyTakeaways ?? chapter.keyPoints
        ),
        presentationSettings: detail?.presentationSettings ?? chapter.presentationSettings,
    }
}

function sourceLabel(source: DidacticUnitRevisionViewModel['source']): string {
    switch (source) {
        case 'ai_generation':
            return 'AI generation'
        case 'ai_regeneration':
            return 'AI regeneration'
        case 'manual_edit':
            return 'Manual edit'
    }
}

function formatRunLabel(run: BackendGenerationRun): string {
    if (run.stage === 'syllabus') {
        return 'Syllabus generation'
    }

    return `Chapter ${run.chapterIndex !== undefined ? run.chapterIndex + 1 : '-'}`
}

export function UnitEditor({ didacticUnitId, onDataChanged }: UnitEditorProps) {
    const navigate = useNavigate()
    const [workspace, setWorkspace] = useState<DidacticUnitEditorViewModel | null>(null)
    const [chapterDetails, setChapterDetails] = useState<Record<number, BackendDidacticUnitChapterDetail>>({})
    const [revisions, setRevisions] = useState<DidacticUnitRevisionViewModel[]>([])
    const [activeChapterIndex, setActiveChapterIndex] = useState(0)
    const [draft, setDraft] = useState<ChapterDraft | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [currentSpread, setCurrentSpread] = useState(0)
    const [contentPageDrafts, setContentPageDrafts] = useState<string[]>([])
    const [activeLexicalEditor, setActiveLexicalEditor] = useState<LexicalEditor | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [streamingMarkdown, setStreamingMarkdown] = useState('')
    const [isStreamingGeneration, setIsStreamingGeneration] = useState(false)
    const [unitGenerationTier, setUnitGenerationTier] =
        useState<BackendAiModelTier | null>(null)
    const [activeGeneratingChapterIndex, setActiveGeneratingChapterIndex] = useState<number | null>(
        null
    )
    const [viewport, setViewport] = useState(() => ({
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    }))
    const saveTimeoutRef = useRef<number | null>(null)
    const preserveViewOnNextWorkspaceRef = useRef(false)
    const activeChapterIndexRef = useRef(0)
    const isEditModeRef = useRef(false)
    const generationQueueBlockedRef = useRef(false)
    const isGenerationQueueRunningRef = useRef(false)

    const activeChapter = useMemo(
        () =>
            workspace?.chapters.find((chapter) => chapter.chapterIndex === activeChapterIndex) ??
            workspace?.chapters[0] ??
            null,
        [activeChapterIndex, workspace]
    )
    const activeChapterDetail = activeChapter
        ? chapterDetails[activeChapter.chapterIndex]
        : undefined
    const activeRuns = [] as BackendGenerationRun[]

    const loadRevisions = useCallback(
        async (chapterIndex: number) => {
            try {
                const response = await dashboardApi.listDidacticUnitChapterRevisions(
                    didacticUnitId,
                    chapterIndex
                )
                setRevisions(adaptDidacticUnitRevisions(response.revisions))
            } catch (loadError) {
                if (loadError instanceof DashboardApiError && loadError.status === 404) {
                    setRevisions([])
                    return
                }

                throw loadError
            }
        },
        [didacticUnitId]
    )

    const loadWorkspace = useCallback(
        async (
            preferredChapterIndex?: number,
            options: { silent?: boolean; preserveSpread?: boolean } = {}
        ) => {
            if (!options.silent) {
                setIsLoading(true)
            }
            setError(null)

            try {
                const [unit, chaptersResponse] = await Promise.all([
                    dashboardApi.getDidacticUnit(didacticUnitId),
                    dashboardApi.listDidacticUnitChapters(didacticUnitId),
                ])

                const detailResponses = await Promise.all(
                    chaptersResponse.chapters.map((chapter) =>
                        dashboardApi.getDidacticUnitChapter(didacticUnitId, chapter.chapterIndex)
                    )
                )

                const detailsRecord = Object.fromEntries(
                    detailResponses.map((detail) => [detail.chapterIndex, detail])
                ) as Record<number, BackendDidacticUnitChapterDetail>
                const detailMap = new Map(
                    detailResponses.map((detail) => [detail.chapterIndex, detail] as const)
                )
                const nextWorkspace = adaptDidacticUnitEditor({
                    unit,
                    chapterSummaries: chaptersResponse.chapters,
                    chapterDetails: detailMap,
                })
                const nextActiveChapter =
                    nextWorkspace.chapters.find(
                        (chapter) =>
                            chapter.chapterIndex ===
                            (preferredChapterIndex ?? activeChapterIndex)
                    ) ??
                    nextWorkspace.chapters[0] ??
                    null

                setWorkspace(nextWorkspace)
                setUnitGenerationTier((previousTier) => unit.generationTier ?? previousTier ?? null)
                setChapterDetails(detailsRecord)
                setActiveChapterIndex(nextActiveChapter?.chapterIndex ?? 0)
                preserveViewOnNextWorkspaceRef.current = Boolean(options.preserveSpread)

                if (!options.preserveSpread) {
                    setCurrentSpread(0)
                }

                if (nextActiveChapter) {
                    setDraft(
                        buildDraft(
                            nextActiveChapter,
                            detailsRecord[nextActiveChapter.chapterIndex]
                        )
                    )
                    await loadRevisions(nextActiveChapter.chapterIndex)
                } else {
                    setDraft(null)
                    setRevisions([])
                }
            } catch (loadError) {
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : 'Failed to load didactic unit.'
                )
            } finally {
                if (!options.silent) {
                    setIsLoading(false)
                }
            }
        },
        [activeChapterIndex, didacticUnitId, loadRevisions]
    )

    useEffect(() => {
        void loadWorkspace()
    }, [loadWorkspace])

    useEffect(() => {
        activeChapterIndexRef.current = activeChapterIndex
    }, [activeChapterIndex])

    useEffect(() => {
        isEditModeRef.current = isEditMode
    }, [isEditMode])

    useEffect(() => {
        if (!workspace || !activeChapter) {
            return
        }

        setDraft(buildDraft(activeChapter, activeChapterDetail))

        if (preserveViewOnNextWorkspaceRef.current) {
            preserveViewOnNextWorkspaceRef.current = false
            return
        }

        setIsEditMode(false)
        setActiveLexicalEditor(null)
        setCurrentSpread(0)
    }, [activeChapter, activeChapterDetail, workspace])

    useEffect(() => {
        if (
            !isStreamingGeneration ||
            activeGeneratingChapterIndex === null ||
            activeGeneratingChapterIndex !== activeChapterIndex
        ) {
            return
        }

        setDraft((currentDraft) =>
            currentDraft
                ? {
                      ...currentDraft,
                      contentMarkdown: streamingMarkdown,
                  }
                : currentDraft
        )
    }, [
        activeChapterIndex,
        activeGeneratingChapterIndex,
        isStreamingGeneration,
        streamingMarkdown,
    ])

    useEffect(() => {
        const updateViewport = () => {
            setViewport({
                height: window.innerHeight,
                width: window.innerWidth,
            })
        }

        updateViewport()
        window.addEventListener('resize', updateViewport)

        return () => window.removeEventListener('resize', updateViewport)
    }, [])

    useEffect(
        () => () => {
            if (saveTimeoutRef.current) {
                window.clearTimeout(saveTimeoutRef.current)
            }
        },
        []
    )

    const spreadMetrics = useMemo(
        () =>
            calculateSpreadMetrics({
                isSidebarOpen,
                viewportHeight: viewport.height,
                viewportWidth: viewport.width,
            }),
        [isSidebarOpen, viewport.height, viewport.width]
    )
    const paginatedContentPages = useMemo(
        () =>
            draft
                ? paginateMarkdownContent({
                      content: draft.contentMarkdown,
                      pageHeight: spreadMetrics.pageHeight,
                      pageWidth: spreadMetrics.pageWidth,
                  })
                : [],
        [draft, spreadMetrics.pageHeight, spreadMetrics.pageWidth]
    )
    const visibleContentPages =
        isEditMode && contentPageDrafts.length > 0 ? contentPageDrafts : paginatedContentPages

    useEffect(() => {
        if (!isEditMode) {
            setContentPageDrafts([])
            return
        }

        setContentPageDrafts(paginatedContentPages.length > 0 ? paginatedContentPages : [''])
    }, [
        isEditMode,
        activeChapter?.chapterIndex,
        paginatedContentPages,
        spreadMetrics.pageHeight,
        spreadMetrics.pageWidth,
    ])

    const runAction = async (
        action: () => Promise<unknown>,
        options: {
            chapterIndex?: number
            closeEditMode?: boolean
            silentRefresh?: boolean
            preserveSpread?: boolean
        } = {}
    ) => {
        setIsSubmitting(true)
        setError(null)

        try {
            await action()
            onDataChanged()
            await loadWorkspace(options.chapterIndex ?? activeChapterIndex, {
                silent: options.silentRefresh,
                preserveSpread: options.preserveSpread,
            })

            if (options.closeEditMode) {
                setIsEditMode(false)
            }

            setIsSaving(true)
            if (saveTimeoutRef.current) {
                window.clearTimeout(saveTimeoutRef.current)
            }
            saveTimeoutRef.current = window.setTimeout(() => setIsSaving(false), 1200)
        } catch (actionError) {
            setError(
                actionError instanceof Error
                    ? actionError.message
                    : 'Didactic unit action failed.'
            )
            setIsSaving(false)
        } finally {
            setIsSubmitting(false)
        }
    }

    const pulseSavedState = () => {
        setIsSaving(true)
        if (saveTimeoutRef.current) {
            window.clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = window.setTimeout(() => setIsSaving(false), 1200)
    }

    const refreshWorkspaceAfterGeneration = useCallback(async () => {
        onDataChanged()

        if (!isEditModeRef.current) {
            await loadWorkspace(activeChapterIndexRef.current, {
                silent: true,
                preserveSpread: true,
            })
        }

        pulseSavedState()
    }, [loadWorkspace, onDataChanged])

    const handlePrimaryGeneration = async (tierOverride?: BackendAiModelTier) => {
        const tier = tierOverride ?? unitGenerationTier

        if (!activeChapter || !tier) {
            return
        }

        generationQueueBlockedRef.current = false
        setIsSubmitting(true)
        setIsStreamingGeneration(true)
        setActiveGeneratingChapterIndex(activeChapter.chapterIndex)
        setStreamingMarkdown('')
        setError(null)

        try {
            if (activeChapter.status === 'ready') {
                await dashboardApi.streamRegenerateDidacticUnitChapter(
                    didacticUnitId,
                    activeChapter.chapterIndex,
                    tier,
                    {
                        onPartialMarkdown: (event) => {
                            setStreamingMarkdown(event.markdown)
                        },
                    }
                )
            } else {
                await dashboardApi.streamGenerateDidacticUnitChapter(
                    didacticUnitId,
                    activeChapter.chapterIndex,
                    tier,
                    {
                        onPartialMarkdown: (event) => {
                            setStreamingMarkdown(event.markdown)
                        },
                    }
                )
            }

            setUnitGenerationTier((previousTier) => previousTier ?? tier)
            await refreshWorkspaceAfterGeneration()
        } catch (actionError) {
            setError(
                actionError instanceof Error
                    ? actionError.message
                    : 'Didactic unit action failed.'
            )
            setIsSaving(false)
        } finally {
            setIsSubmitting(false)
            setIsStreamingGeneration(false)
            setActiveGeneratingChapterIndex(null)
            setStreamingMarkdown('')
        }
    }

    const startUnitGenerationQueue = useCallback(async () => {
        if (
            !workspace ||
            !unitGenerationTier ||
            generationQueueBlockedRef.current ||
            isGenerationQueueRunningRef.current
        ) {
            return
        }

        const pendingChapters = workspace.chapters
            .filter((chapter) => chapter.status === 'pending')
            .sort((left, right) => left.chapterIndex - right.chapterIndex)

        if (pendingChapters.length === 0) {
            return
        }

        isGenerationQueueRunningRef.current = true
        setIsSubmitting(true)
        setIsStreamingGeneration(true)
        setError(null)

        try {
            for (const chapter of pendingChapters) {
                setActiveGeneratingChapterIndex(chapter.chapterIndex)
                setStreamingMarkdown('')

                await dashboardApi.streamGenerateDidacticUnitChapter(
                    didacticUnitId,
                    chapter.chapterIndex,
                    unitGenerationTier,
                    {
                        onPartialMarkdown: (event) => {
                            setStreamingMarkdown(event.markdown)
                        },
                    }
                )

                await refreshWorkspaceAfterGeneration()
            }
        } catch (actionError) {
            generationQueueBlockedRef.current = true
            setError(
                actionError instanceof Error
                    ? actionError.message
                    : 'Didactic unit generation failed.'
            )
            setIsSaving(false)
        } finally {
            isGenerationQueueRunningRef.current = false
            setIsSubmitting(false)
            setIsStreamingGeneration(false)
            setActiveGeneratingChapterIndex(null)
            setStreamingMarkdown('')
        }
    }, [didacticUnitId, refreshWorkspaceAfterGeneration, unitGenerationTier, workspace])

    const handleSave = async () => {
        if (!activeChapter || !draft || activeChapter.status !== 'ready') {
            return
        }

        const nextTitle = draft.title.trim()
        const nextOverview = normalizeMarkdownForStorage(draft.overviewMarkdown)
        const nextContent = normalizeMarkdownForStorage(draft.contentMarkdown)
        const nextKeyTakeaways = markdownToKeyTakeaways(draft.keyTakeawaysMarkdown)

        await runAction(
            () =>
                dashboardApi.updateDidacticUnitChapter(
                    didacticUnitId,
                    activeChapter.chapterIndex,
                    {
                        title: nextTitle,
                        overview: nextOverview || activeChapter.summary,
                        content: nextContent || activeChapter.content || '',
                        keyTakeaways:
                            nextKeyTakeaways.length > 0
                                ? nextKeyTakeaways
                                : [...activeChapter.keyPoints],
                        presentationSettings: draft.presentationSettings,
                    }
                ),
            {
                chapterIndex: activeChapter.chapterIndex,
                closeEditMode: true,
                silentRefresh: true,
                preserveSpread: true,
            }
        )
    }

    useEffect(() => {
        if (
            !workspace ||
            !unitGenerationTier ||
            generationQueueBlockedRef.current ||
            isGenerationQueueRunningRef.current ||
            isStreamingGeneration
        ) {
            return
        }

        const hasPendingChapters = workspace.chapters.some(
            (chapter) => chapter.status === 'pending'
        )

        if (!hasPendingChapters) {
            generationQueueBlockedRef.current = false
            return
        }

        void startUnitGenerationQueue()
    }, [isStreamingGeneration, startUnitGenerationQueue, unitGenerationTier, workspace])

    const enterEditMode = () => {
        setActiveLexicalEditor(null)
        setIsEditMode(true)
    }

    const exitEditMode = () => {
        if (!activeChapter) {
            return
        }

        setDraft(buildDraft(activeChapter, activeChapterDetail))
        setActiveLexicalEditor(null)
        setIsEditMode(false)
    }

    const handleComplete = async () => {
        if (!activeChapter || activeChapter.status !== 'ready' || activeChapter.isCompleted) {
            return
        }

        await runAction(
            () =>
                dashboardApi.completeDidacticUnitChapter(
                    didacticUnitId,
                    activeChapter.chapterIndex
                ),
            { chapterIndex: activeChapter.chapterIndex }
        )
    }

    const isRevisionCurrent = (revision: DidacticUnitRevisionViewModel) => {
        if (!activeChapterDetail) {
            return false
        }

        return (
            activeChapterDetail.title === revision.chapter.title &&
            normalizeStoredMarkdown(activeChapterDetail.overview) ===
                normalizeStoredMarkdown(revision.chapter.overview) &&
            normalizeStoredMarkdown(activeChapterDetail.content ?? '') ===
                normalizeStoredMarkdown(revision.chapter.content) &&
            JSON.stringify(activeChapterDetail.presentationSettings) ===
                JSON.stringify(revision.chapter.presentationSettings) &&
            JSON.stringify(activeChapterDetail.keyTakeaways) ===
                JSON.stringify(revision.chapter.keyTakeaways)
        )
    }

    const handleRestoreRevision = async (revision: DidacticUnitRevisionViewModel) => {
        if (!activeChapter) {
            return
        }

        await runAction(
            () =>
                dashboardApi.updateDidacticUnitChapter(
                    didacticUnitId,
                    activeChapter.chapterIndex,
                    {
                        title: revision.chapter.title,
                        overview: revision.chapter.overview,
                        content: revision.chapter.content,
                        keyTakeaways: [...revision.chapter.keyTakeaways],
                        presentationSettings: revision.chapter.presentationSettings,
                    }
                ),
            {
                chapterIndex: activeChapter.chapterIndex,
                closeEditMode: true,
                silentRefresh: true,
                preserveSpread: true,
            }
        )
    }

    const totalSpreads = Math.max(1, 1 + Math.ceil(Math.max(visibleContentPages.length - 1, 0) / 2))
    const canGoPrev = currentSpread > 0
    const canGoNext = currentSpread < totalSpreads - 1

    const goToNextSpread = useCallback(() => {
        setCurrentSpread((previousSpread) =>
            previousSpread < totalSpreads - 1 ? previousSpread + 1 : previousSpread
        )
    }, [totalSpreads])

    const goToPrevSpread = useCallback(() => {
        setCurrentSpread((previousSpread) => (previousSpread > 0 ? previousSpread - 1 : 0))
    }, [])

    useEffect(() => {
        if (currentSpread > totalSpreads - 1) {
            setCurrentSpread(Math.max(0, totalSpreads - 1))
        }
    }, [currentSpread, totalSpreads])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowRight') {
                goToNextSpread()
            }

            if (event.key === 'ArrowLeft') {
                goToPrevSpread()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goToNextSpread, goToPrevSpread])

    if (isLoading) {
        return (
            <div className="flex min-w-0 flex-1 items-center justify-center text-[#86868B]">
                Loading didactic unit workspace...
            </div>
        )
    }

    if (!workspace || !activeChapter || !draft) {
        return (
            <div className="flex min-w-0 flex-1 items-center justify-center text-[#86868B]">
                Didactic unit workspace unavailable.
            </div>
        )
    }

    const getStatusIcon = (status: DidacticUnitEditorChapter['status']) => {
        switch (status) {
            case 'ready':
                return <CheckCircle2 size={14} className="text-[#4ADE80]" />
            case 'pending':
                return <Sparkles size={14} className="text-[#4ADE80]" />
            case 'failed':
                return <AlertCircle size={14} className="text-red-400" />
        }
    }

    const isPendingChapter = activeChapter.status === 'pending'
    const isFailedChapter = activeChapter.status === 'failed'
    const isActiveChapterStreaming =
        isStreamingGeneration &&
        activeGeneratingChapterIndex !== null &&
        activeGeneratingChapterIndex === activeChapter.chapterIndex
    const hasConfiguredGenerationTier = unitGenerationTier !== null
    const contentPageOffset = currentSpread === 0 ? 0 : 1 + (currentSpread - 1) * 2
    const leftContentPage =
        currentSpread === 0 ? undefined : visibleContentPages[contentPageOffset]
    const rightContentPage =
        currentSpread === 0
            ? visibleContentPages[0]
            : visibleContentPages[contentPageOffset + 1]
    const spreadPageLabel =
        currentSpread === 0
            ? 'Pages 1-2'
            : `Pages ${contentPageOffset + 2}-${contentPageOffset + 3}`

    const updatePaginatedContentPage = (pageIndex: number, markdown: string) => {
        setContentPageDrafts((previous) => {
            const nextPages =
                previous.length > 0 ? [...previous] : [...visibleContentPages]

            while (pageIndex >= nextPages.length) {
                nextPages.push('')
            }

            nextPages[pageIndex] = markdown

            setDraft((currentDraft) =>
                currentDraft
                    ? {
                          ...currentDraft,
                          contentMarkdown: normalizeMarkdownForStorage(
                              nextPages.filter((page) => page.trim().length > 0).join('\n\n')
                          ),
                      }
                    : currentDraft
            )

            return nextPages
        })
    }

    const renderContentPage = ({
        editable,
        markdown,
        pageIndex,
        pageNumber,
    }: {
        editable: boolean
        markdown: string | undefined
        pageIndex: number
        pageNumber: number
    }) => (
        <div
            className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] bg-white shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
            style={{
                height: `${spreadMetrics.pageHeight}px`,
                width: `${spreadMetrics.pageWidth}px`,
            }}
        >
            <div className="flex h-full flex-col overflow-hidden p-6 pb-12 md:p-8 md:pb-14">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#86868B]">
                    Chapter Content
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden">
                    <LexicalMarkdownEditor
                        key={`content-${didacticUnitId}-${activeChapter.chapterIndex}-${pageIndex}`}
                        contentClassName="h-full min-h-full overflow-hidden leading-[1.9] text-[#1D1D1F] outline-none"
                        baseTextStyle={draft.presentationSettings}
                        editable={editable}
                        editorId={`content-${didacticUnitId}-${activeChapter.chapterIndex}-${pageIndex}`}
                        initialMarkdown={markdown ?? ''}
                        onFocusEditor={setActiveLexicalEditor}
                        onMarkdownChange={
                            editable
                                ? (nextMarkdown) =>
                                      updatePaginatedContentPage(pageIndex, nextMarkdown)
                                : undefined
                        }
                        placeholder="Write the chapter content here..."
                    />
                </div>

                <div className="absolute bottom-4 right-6 text-[10px] font-medium text-[#86868B] md:bottom-6 md:right-10">
                    {pageNumber}
                </div>
            </div>
        </div>
    )

    const renderLexicalSpread = (editable: boolean) => (
        <>
            <div
                className="relative flex items-center justify-center"
                style={{
                    height: `${spreadMetrics.spreadHeight}px`,
                    width: `${spreadMetrics.spreadWidth}px`,
                }}
            >
                <button
                    className="absolute left-[-56px] top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E5E7] bg-white transition-all hover:scale-110 hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:left-[-76px] md:h-12 md:w-12"
                    disabled={!canGoPrev}
                    onClick={goToPrevSpread}
                    type="button"
                >
                    <ChevronLeft size={20} className="text-[#1D1D1F]" />
                </button>

                <AnimatePresence mode="wait">
                    <Motion.div
                        key={`spread-${currentSpread}-${spreadMetrics.pageWidth}-${spreadMetrics.pageHeight}`}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex h-full w-full gap-4 md:gap-8"
                        exit={{ opacity: 0, x: -72 }}
                        initial={{ opacity: 0, x: 72 }}
                        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {currentSpread === 0 ? (
                            <div
                                className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] bg-white shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
                                style={{
                                    height: `${spreadMetrics.pageHeight}px`,
                                    width: `${spreadMetrics.pageWidth}px`,
                                }}
                            >
                                <div className="flex h-full flex-col overflow-hidden p-6 pb-12 md:p-8 md:pb-14">
                                    <div className="mb-4 flex-shrink-0 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#86868B]">
                                                Chapter {activeChapter.chapterIndex + 1}
                                            </span>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest',
                                                    getStatusPillClass(activeChapter.status)
                                                )}
                                            >
                                                {activeChapter.status}
                                            </span>
                                        </div>
                                        <h2
                                            className="min-h-[2.5rem] text-xl font-bold leading-tight tracking-tight text-[#1D1D1F] outline-none md:text-2xl"
                                            contentEditable={editable}
                                            onInput={(event) =>
                                                setDraft((previous) =>
                                                    previous
                                                        ? {
                                                              ...previous,
                                                              title:
                                                                  event.currentTarget.textContent ??
                                                                  '',
                                                          }
                                                        : previous
                                                )
                                            }
                                            spellCheck={editable}
                                            suppressContentEditableWarning
                                        >
                                            {draft.title}
                                        </h2>
                                        <div className="relative min-h-[88px]">
                                            <LexicalMarkdownEditor
                                                key={`overview-${didacticUnitId}-${activeChapter.chapterIndex}`}
                                                contentClassName="min-h-[88px] font-medium italic leading-relaxed text-[#86868B] outline-none"
                                                baseTextStyle={draft.presentationSettings}
                                                editable={editable}
                                                editorId={`overview-${didacticUnitId}-${activeChapter.chapterIndex}`}
                                                initialMarkdown={draft.overviewMarkdown}
                                                onFocusEditor={setActiveLexicalEditor}
                                                onMarkdownChange={
                                                    editable
                                                        ? (markdown) =>
                                                              setDraft((previous) =>
                                                                  previous
                                                                      ? {
                                                                            ...previous,
                                                                            overviewMarkdown:
                                                                                markdown,
                                                                        }
                                                                      : previous
                                                              )
                                                        : undefined
                                                }
                                                placeholder="Write a short overview for this chapter..."
                                                placeholderClassName="pointer-events-none absolute inset-0 italic text-[#B0B0B5]"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 pt-1 text-[10px] text-[#86868B]">
                                            <div className="flex items-center gap-1">
                                                <Clock size={12} strokeWidth={1.5} />
                                                <span>{activeChapter.readingTime}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Target size={12} strokeWidth={1.5} />
                                                <span>{activeChapter.level}</span>
                                            </div>
                                        </div>
                                        <div className="my-3 h-[1px] w-full bg-[#E5E5E7]" />
                                    </div>

                                    <div className="min-h-0 flex-1 overflow-hidden">
                                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#86868B]">
                                            Key Takeaways
                                        </div>
                                        <div className="relative min-h-[180px]">
                                            <LexicalMarkdownEditor
                                                key={`takeaways-${didacticUnitId}-${activeChapter.chapterIndex}`}
                                                contentClassName="min-h-[180px] leading-[1.9] text-[#1D1D1F] outline-none"
                                                baseTextStyle={draft.presentationSettings}
                                                editable={editable}
                                                editorId={`takeaways-${didacticUnitId}-${activeChapter.chapterIndex}`}
                                                initialMarkdown={draft.keyTakeawaysMarkdown}
                                                onFocusEditor={setActiveLexicalEditor}
                                                onMarkdownChange={
                                                    editable
                                                        ? (markdown) =>
                                                              setDraft((previous) =>
                                                                  previous
                                                                      ? {
                                                                            ...previous,
                                                                            keyTakeawaysMarkdown:
                                                                                markdown,
                                                                        }
                                                                      : previous
                                                              )
                                                        : undefined
                                                }
                                                placeholder="- Summarize the main outcomes here"
                                            />
                                        </div>
                                    </div>

                                    <div className="absolute bottom-4 right-6 text-[10px] font-medium text-[#86868B] md:bottom-6 md:right-10">
                                        1
                                    </div>
                                </div>
                            </div>
                        ) : (
                            renderContentPage({
                                editable,
                                markdown: leftContentPage,
                                pageIndex: contentPageOffset,
                                pageNumber: contentPageOffset + 2,
                            })
                        )}

                        {renderContentPage({
                            editable,
                            markdown: rightContentPage,
                            pageIndex: currentSpread === 0 ? 0 : contentPageOffset + 1,
                            pageNumber: currentSpread === 0 ? 2 : contentPageOffset + 3,
                        })}
                    </Motion.div>
                </AnimatePresence>

                <button
                    className="absolute right-[-56px] top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E5E7] bg-white transition-all hover:scale-110 hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:right-[-76px] md:h-12 md:w-12"
                    disabled={!canGoNext}
                    onClick={goToNextSpread}
                    type="button"
                >
                    <ChevronRight size={20} className="text-[#1D1D1F]" />
                </button>
            </div>

            <div
                className="mt-3 rounded-full border border-[#E5E5E7] bg-white/90 px-4 py-2 shadow-lg backdrop-blur-sm md:px-6 md:py-3"
                style={{ marginTop: `${spreadMetrics.indicatorGap}px` }}
            >
                <AnimatePresence initial={false} mode="wait">
                    {editable ? (
                        <Motion.div
                            key="toolbar-pill"
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="flex flex-wrap items-center justify-center gap-2 md:gap-3"
                            exit={{ opacity: 0, scale: 0.97, y: 6 }}
                            initial={{ opacity: 0, scale: 0.97, y: 6 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <ChapterStyleMenu
                                value={draft.presentationSettings}
                                onChange={(presentationSettings) =>
                                    setDraft((previous) =>
                                        previous
                                            ? { ...previous, presentationSettings }
                                            : previous
                                    )
                                }
                            />
                            <div className="hidden h-6 w-px bg-[#E5DED0] md:block" />
                            <LexicalToolbar activeEditor={activeLexicalEditor} />
                        </Motion.div>
                    ) : (
                        <Motion.div
                            key="status-pill"
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="flex items-center gap-2 md:gap-3"
                            exit={{ opacity: 0, scale: 0.97, y: -6 }}
                            initial={{ opacity: 0, scale: 0.97, y: -6 }}
                            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <FileText size={16} className="text-[#86868B]" />
                            <span className="text-[11px] font-medium text-[#1D1D1F] md:text-[13px]">
                                Chapter workspace
                            </span>
                            {isActiveChapterStreaming && (
                                <>
                                    <span className="text-[11px] text-[#D1D5DB]">•</span>
                                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#4E8B63] md:text-[13px]">
                                        <Loader2 size={12} className="animate-spin" />
                                        Streaming
                                    </span>
                                </>
                            )}
                            <span className="text-[11px] text-[#86868B] md:text-[13px]">
                                {spreadPageLabel}
                            </span>
                        </Motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    )

    return (
        <div className="flex h-screen overflow-hidden bg-[#F5F5F7] font-sans text-[#1D1D1F]">
            <Motion.aside
                animate={{ width: isSidebarOpen ? 260 : 80 }}
                className="z-20 flex h-full flex-col overflow-hidden border-r border-[#E5E5E7] bg-white"
                initial={false}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <div
                    className={cn(
                        'flex shrink-0 items-center p-6',
                        isSidebarOpen ? 'justify-between gap-3' : 'justify-center'
                    )}
                >
                    {isSidebarOpen ? (
                        <>
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D1D1F]">
                                    <Sparkles size={18} className="text-[#4ADE80]" />
                                </div>
                                <span className="text-lg font-semibold tracking-tight">Didactio</span>
                            </div>
                            <button
                                className="rounded-lg p-1.5 text-[#86868B] transition-all hover:bg-[#F5F5F7]"
                                onClick={() => setIsSidebarOpen(false)}
                                type="button"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        </>
                    ) : (
                        <button
                            className="rounded-lg p-1.5 text-[#86868B] transition-all hover:bg-[#F5F5F7]"
                            onClick={() => setIsSidebarOpen(true)}
                            type="button"
                        >
                            <ChevronRight size={18} />
                        </button>
                    )}
                </div>

                <div className={cn('mb-6 shrink-0', isSidebarOpen ? 'px-6' : 'px-3')}>
                    {isSidebarOpen ? (
                        <>
                            <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[#86868B]">
                                <span>Overall Progress</span>
                                <span>{workspace.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5F5F7]">
                                <Motion.div
                                    animate={{ width: `${workspace.progress}%` }}
                                    className="h-full bg-[#4ADE80]"
                                    initial={{ width: 0 }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="text-sm font-bold text-[#4ADE80]">{workspace.progress}%</div>
                        </div>
                    )}
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-3">
                    {workspace.chapters.map((chapter, index) => (
                        <button
                            key={chapter.chapterIndex}
                            className={cn(
                                'group flex w-full items-center rounded-[10px] text-left transition-all duration-200',
                                isSidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2.5',
                                activeChapterIndex === chapter.chapterIndex
                                    ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                                    : 'text-[#86868B] hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]'
                            )}
                            onClick={() => setActiveChapterIndex(chapter.chapterIndex)}
                            type="button"
                        >
                            {isSidebarOpen ? (
                                <>
                                    <span className="w-4 text-center text-xs font-medium opacity-50">
                                        {index + 1}
                                    </span>
                                    <span className="flex-1 truncate text-[14px] font-medium">
                                        {chapter.title}
                                    </span>
                                    <div className="flex-shrink-0">{getStatusIcon(chapter.status)}</div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center">
                                    <span
                                        className={cn(
                                            'text-sm font-semibold',
                                            chapter.status === 'ready'
                                                ? 'text-[#4ADE80]'
                                                : chapter.status === 'pending'
                                                  ? 'text-[#4ADE80]'
                                                  : 'text-red-400'
                                        )}
                                    >
                                        {index + 1}
                                    </span>
                                </div>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="shrink-0 space-y-1 border-t border-[#E5E5E7] p-4">
                    <button
                        className={cn(
                            'flex w-full items-center rounded-[10px] text-[14px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]',
                            isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center py-2.5'
                        )}
                        onClick={() => navigate('/dashboard')}
                        type="button"
                    >
                        <LayoutDashboard size={18} />
                        {isSidebarOpen && <span>Dashboard</span>}
                    </button>
                    <button
                        className={cn(
                            'flex w-full items-center rounded-[10px] text-[14px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]',
                            isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center py-2.5'
                        )}
                        type="button"
                    >
                        <Share2 size={18} />
                        {isSidebarOpen && <span>Export Unit</span>}
                    </button>
                    <button
                        className={cn(
                            'flex w-full items-center rounded-[10px] text-[14px] text-[#86868B] transition-all hover:bg-[#F5F5F7] hover:text-[#1D1D1F]',
                            isSidebarOpen ? 'gap-3 px-3 py-2' : 'justify-center py-2.5'
                        )}
                        type="button"
                    >
                        <Settings size={18} />
                        {isSidebarOpen && <span>Settings</span>}
                    </button>
                </div>
            </Motion.aside>

            <main className="relative flex h-full flex-1 flex-col overflow-hidden">
                <header className="z-10 flex h-[64px] shrink-0 items-center justify-between border-b border-[#E5E5E7] bg-white/80 px-6 backdrop-blur-md">
                    <div className="flex items-center gap-4">
                        <button
                            className="rounded-lg p-2 text-[#86868B] transition-all hover:bg-[#F5F5F7]"
                            onClick={() => navigate('/dashboard')}
                            type="button"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="h-4 w-[1px] bg-[#E5E5E7]" />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[#86868B]">
                                <span>Units</span>
                                <ChevronRight size={10} />
                                <span>{workspace.subject}</span>
                            </div>
                            <h1 className="max-w-[300px] truncate text-[14px] font-semibold text-[#1D1D1F]">
                                {workspace.title}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-[13px] text-[#86868B]">
                            <span
                                className={cn(
                                    'h-2 w-2 rounded-full',
                                    isSaving || isSubmitting ? 'bg-amber-400' : 'bg-[#4ADE80]'
                                )}
                            />
                            {isSaving || isSubmitting ? 'Saving...' : 'Autosaved'}
                        </div>

                        <div className="h-4 w-[1px] bg-[#E5E5E7]" />

                        <div className="flex items-center gap-1.5">
                            <button
                                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all hover:bg-[#F5F5F7]"
                                onClick={() => setIsHistoryOpen((value) => !value)}
                                type="button"
                            >
                                <History size={16} className="text-[#86868B]" />
                                <span>Version History</span>
                            </button>
                            {hasConfiguredGenerationTier &&
                                (activeChapter.status === 'ready' ||
                                    activeChapter.status === 'failed') && (
                                    <button
                                        className="flex items-center gap-2 rounded-full border border-[#D4D7DD] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1D1D1F] transition-all hover:bg-[#F5F5F7]"
                                        onClick={() => void handlePrimaryGeneration()}
                                        type="button"
                                    >
                                        <RotateCcw size={16} className="text-[#86868B]" />
                                        <span>
                                            {activeChapter.status === 'ready'
                                                ? `Regenerate Chapter (${unitGenerationTier})`
                                                : `Retry Chapter (${unitGenerationTier})`}
                                        </span>
                                    </button>
                                )}
                            <button
                                className={cn(
                                    'flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all',
                                    isEditMode
                                        ? 'bg-[#4ADE80] text-white hover:bg-[#3BCD6F]'
                                        : 'bg-[#1D1D1F] text-white hover:bg-[#333333]'
                                )}
                                onClick={() => {
                                    if (isEditMode) {
                                        void handleSave()
                                        return
                                    }

                                    enterEditMode()
                                }}
                                type="button"
                            >
                                <Edit3 size={16} />
                                <span>{isEditMode ? 'Save Changes' : 'Edit Mode'}</span>
                            </button>
                            {isEditMode && (
                                <button
                                    className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all hover:bg-[#F5F5F7]"
                                    onClick={exitEditMode}
                                    type="button"
                                >
                                    <X size={16} className="text-[#86868B]" />
                                    <span>Cancel</span>
                                </button>
                            )}
                            <button
                                className="rounded-full p-1.5 text-[#86868B] transition-all hover:bg-[#F5F5F7]"
                                onClick={() => void handleComplete()}
                                type="button"
                            >
                                <CheckCheck size={20} />
                            </button>
                            <button
                                className="rounded-full p-1.5 text-[#86868B] transition-all hover:bg-[#F5F5F7]"
                                type="button"
                            >
                                <MoreHorizontal size={20} />
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-[13px] text-red-600">
                        {error}
                    </div>
                )}

                <div className="relative flex flex-1 flex-col items-center justify-center bg-[#F5F5F7] px-4 py-4 md:px-8 md:py-6">
                    {activeChapter.status === 'ready' || isActiveChapterStreaming ? (
                        renderLexicalSpread(isEditMode)
                    ) : (
                        <>
                            {isPendingChapter ? (
                                <div className="flex flex-col items-center justify-center space-y-6 text-center">
                                    <div className="relative">
                                        <Sparkles
                                            size={56}
                                            strokeWidth={1.5}
                                            className="text-[#4ADE80]"
                                        />
                                        <Motion.div
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                            className="absolute inset-0 rounded-full bg-[#4ADE80]/20 blur-xl"
                                            transition={{
                                                repeat: Number.POSITIVE_INFINITY,
                                                duration: 2,
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-semibold">
                                            {hasConfiguredGenerationTier
                                                ? 'Chapter queued for generation'
                                                : 'Chapter not generated yet'}
                                        </h3>
                                        <p className="max-w-[300px] text-sm text-[#86868B]">
                                            {hasConfiguredGenerationTier
                                                ? isStreamingGeneration && activeGeneratingChapterIndex !== null
                                                    ? `Chapter ${activeGeneratingChapterIndex + 1} is generating now. Open that chapter to watch the live stream, or wait here until this one begins.`
                                                    : 'The unit generator is preparing the remaining chapters automatically.'
                                                : 'This unit predates automatic generation startup. Pick a model once to begin generating the chapter queue.'}
                                        </p>
                                    </div>
                                    {!hasConfiguredGenerationTier && (
                                        <div className="flex flex-wrap justify-center gap-3">
                                            <button
                                                className="rounded-full border border-[#D4D7DD] bg-white px-8 py-2.5 text-sm font-semibold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7] active:scale-95"
                                                onClick={() => void handlePrimaryGeneration('cheap')}
                                                type="button"
                                            >
                                                Start with Cheap
                                            </button>
                                            <button
                                                className="rounded-full bg-[#1D1D1F] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] active:scale-95"
                                                onClick={() => void handlePrimaryGeneration('premium')}
                                                type="button"
                                            >
                                                Start with Premium
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : isFailedChapter ? (
                                <div className="flex flex-col items-center justify-center space-y-6 text-center">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                                        <AlertCircle
                                            size={32}
                                            strokeWidth={1.5}
                                            className="text-red-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-semibold">Generation Failed</h3>
                                        <p className="max-w-[300px] text-sm text-[#86868B]">
                                            We encountered an issue generating this chapter. Retry it to keep the unit generation moving.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-3">
                                        {hasConfiguredGenerationTier ? (
                                            <button
                                                className="rounded-full bg-[#1D1D1F] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] active:scale-95"
                                                onClick={() => void handlePrimaryGeneration()}
                                                type="button"
                                            >
                                                Retry Chapter
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="rounded-full border border-[#D4D7DD] bg-white px-8 py-2.5 text-sm font-semibold text-[#1D1D1F] transition-all hover:bg-[#F5F5F7] active:scale-95"
                                                    onClick={() => void handlePrimaryGeneration('cheap')}
                                                    type="button"
                                                >
                                                    Retry Cheap
                                                </button>
                                                <button
                                                    className="rounded-full bg-[#1D1D1F] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] active:scale-95"
                                                    onClick={() => void handlePrimaryGeneration('premium')}
                                                    type="button"
                                                >
                                                    Retry Premium
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center space-y-6 text-center">
                                    <div className="relative">
                                        <Loader2
                                            size={56}
                                            strokeWidth={1.5}
                                            className="animate-spin text-[#4ADE80]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-semibold">Loading chapter</h3>
                                        <p className="max-w-[300px] text-sm text-[#86868B]">
                                            We are preparing the current chapter workspace.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <AnimatePresence>
                    {isHistoryOpen && (
                        <Motion.div
                            animate={{ opacity: 1, x: 0 }}
                            className="absolute inset-y-0 right-0 z-30 w-[360px] border-l border-[#E5E5E7] bg-white/98 p-6 shadow-2xl backdrop-blur-md"
                            exit={{ opacity: 0, x: 24 }}
                            initial={{ opacity: 0, x: 24 }}
                        >
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <div className="text-[11px] font-medium uppercase tracking-wide text-[#86868B]">
                                        Chapter history
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
                                        No revisions yet for this chapter.
                                    </div>
                                )}
                                {revisions.map((revision) => {
                                    const isCurrentRevision = isRevisionCurrent(revision)

                                    return (
                                        <div
                                            key={revision.id}
                                            className="rounded-2xl border border-[#E5E5E7] p-4"
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
                                            <div className="mt-4 flex items-center justify-between gap-3">
                                                <div className="text-[11px] text-[#86868B]">
                                                    {isCurrentRevision
                                                        ? 'Current version'
                                                        : 'Restore this snapshot'}
                                                </div>
                                                <button
                                                    className={cn(
                                                        'rounded-full px-3 py-1.5 text-[12px] font-medium transition-all',
                                                        isCurrentRevision
                                                            ? 'bg-[#F5F5F7] text-[#86868B]'
                                                            : 'bg-[#1D1D1F] text-white hover:bg-[#333333]'
                                                    )}
                                                    disabled={isCurrentRevision || isSubmitting}
                                                    onClick={() =>
                                                        void handleRestoreRevision(revision)
                                                    }
                                                    type="button"
                                                >
                                                    {isCurrentRevision ? 'Current' : 'Restore'}
                                                </button>
                                            </div>
                                            {!isCurrentRevision && (
                                                <div className="mt-2 text-[11px] text-[#86868B]">
                                                    You can switch back to this version at any
                                                    time.
                                                </div>
                                            )}
                                        </div>
                                    )
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
                                                {run.provider.toUpperCase()} · {run.model}
                                            </div>
                                            <div className="mt-1 text-[11px] text-[#86868B]">
                                                {formatRelativeTimestamp(run.createdAt)}
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
        </div>
    )
}
