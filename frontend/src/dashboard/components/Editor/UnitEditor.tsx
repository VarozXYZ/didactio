import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
    AlertCircle,
    ArrowLeft,
    BookOpen,
    CheckCheck,
    CheckCircle2,
    ChevronLeft,
    ChevronLeftIcon,
    ChevronRight,
    ChevronRightIcon,
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
import { AnimatePresence, motion as Motion } from 'motion/react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useNavigate } from 'react-router-dom'
import {
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
    ACTIVITIES_PAGE,
    calculateSpreadMetrics,
    getStatusPillClass,
    measurePages,
} from '../../pageLayout'
import type {
    DidacticUnitEditorChapter,
    DidacticUnitEditorViewModel,
    DidacticUnitRevisionViewModel,
} from '../../types'
import { formatRelativeTimestamp } from '../../utils/topicMetadata'

type UnitEditorProps = {
    didacticUnitId: string
    onDataChanged: () => void
}

type ChapterDraft = {
    title: string
    overview: string
    content: string
    keyTakeawaysText: string
}

function cn(...inputs: Array<string | false | null | undefined>) {
    return twMerge(clsx(inputs))
}

function toEditableText(value: string | null): string {
    if (!value) {
        return ''
    }

    if (!value.includes('<')) {
        return value
    }

    const parser = new DOMParser()
    const document = parser.parseFromString(value, 'text/html')
    const blocks = Array.from(document.body.children)

    if (blocks.length === 0) {
        return document.body.textContent?.trim() ?? ''
    }

    return blocks
        .map((element) => element.textContent?.trim() ?? '')
        .filter(Boolean)
        .join('\n\n')
}

function buildDraft(
    chapter: DidacticUnitEditorChapter,
    detail: BackendDidacticUnitChapterDetail | undefined
): ChapterDraft {
    return {
        title: detail?.title ?? chapter.title,
        overview: detail?.overview ?? chapter.summary,
        content: toEditableText(detail?.content ?? chapter.content),
        keyTakeawaysText: (detail?.keyTakeaways ?? chapter.keyPoints).join('\n'),
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
    const [runs, setRuns] = useState<BackendGenerationRun[]>([])
    const [revisions, setRevisions] = useState<DidacticUnitRevisionViewModel[]>([])
    const [activeChapterIndex, setActiveChapterIndex] = useState(0)
    const [draft, setDraft] = useState<ChapterDraft | null>(null)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [currentSpread, setCurrentSpread] = useState(0)
    const [pages, setPages] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [viewport, setViewport] = useState(() => ({
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    }))
    const saveTimeoutRef = useRef<number | null>(null)
    const preserveViewOnNextWorkspaceRef = useRef(false)
    const titleRef = useRef<HTMLDivElement | null>(null)
    const overviewRef = useRef<HTMLDivElement | null>(null)
    const pageContentRefs = useRef<Record<number, HTMLDivElement | null>>({})

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
    const activeRuns = useMemo(
        () =>
            runs
                .filter(
                    (run) =>
                        run.stage === 'syllabus' ||
                        (run.stage === 'chapter' &&
                            run.chapterIndex === activeChapter?.chapterIndex)
                )
                .slice(0, 8),
        [activeChapter?.chapterIndex, runs]
    )

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
                const [unit, chaptersResponse, runsResponse] = await Promise.all([
                    dashboardApi.getDidacticUnit(didacticUnitId),
                    dashboardApi.listDidacticUnitChapters(didacticUnitId),
                    dashboardApi.listDidacticUnitRuns(didacticUnitId),
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
                setChapterDetails(detailsRecord)
                setRuns(runsResponse.runs)
                setActiveChapterIndex(nextActiveChapter?.chapterIndex ?? 0)

                if (options.preserveSpread) {
                    preserveViewOnNextWorkspaceRef.current = true
                } else {
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
        if (!workspace || !activeChapter) {
            return
        }

        setDraft(buildDraft(activeChapter, activeChapterDetail))

        if (preserveViewOnNextWorkspaceRef.current) {
            preserveViewOnNextWorkspaceRef.current = false
            return
        }

        setIsEditMode(false)
        setCurrentSpread(0)
    }, [activeChapter, activeChapterDetail, workspace])

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

    useLayoutEffect(() => {
        let frameId = 0

        if (!activeChapter?.content) {
            frameId = window.requestAnimationFrame(() => setPages([]))
            return () => window.cancelAnimationFrame(frameId)
        }

        frameId = window.requestAnimationFrame(() => {
            setPages(
                measurePages({
                    activeChapter,
                    chapterIndex: activeChapter.chapterIndex,
                    content: activeChapter.content ?? '',
                    pageHeight: spreadMetrics.pageHeight,
                    pageWidth: spreadMetrics.pageWidth,
                })
            )
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [activeChapter, spreadMetrics.pageHeight, spreadMetrics.pageWidth])

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

    const handlePrimaryGeneration = async () => {
        if (!activeChapter) {
            return
        }

        await runAction(
            () =>
                activeChapter.status === 'ready'
                    ? dashboardApi.regenerateDidacticUnitChapter(
                          didacticUnitId,
                          activeChapter.chapterIndex
                      )
                    : dashboardApi.generateDidacticUnitChapter(
                          didacticUnitId,
                          activeChapter.chapterIndex
                      ),
            { chapterIndex: activeChapter.chapterIndex }
        )
    }

    const handleSave = async () => {
        if (!activeChapter || !draft || activeChapter.status !== 'ready') {
            return
        }

        const nextTitle = titleRef.current?.textContent?.trim() || draft.title.trim()
        const nextOverview = overviewRef.current?.textContent?.trim() || draft.overview.trim()
        const nextContent = pages
            .map((pageContent, index) => {
                if (pageContent === ACTIVITIES_PAGE) {
                    return null
                }

                const pageElement = pageContentRefs.current[index]
                const pageText = pageElement?.innerText?.trim()
                return pageText && pageText.length > 0 ? pageText : toEditableText(pageContent)
            })
            .filter((value): value is string => Boolean(value))
            .join('\n\n')
            .trim()

        await runAction(
            () =>
                dashboardApi.updateDidacticUnitChapter(
                    didacticUnitId,
                    activeChapter.chapterIndex,
                    {
                        title: nextTitle,
                        overview: nextOverview,
                        content: nextContent || draft.content.trim(),
                        keyTakeaways: draft.keyTakeawaysText
                            .split('\n')
                            .map((value) => value.trim())
                            .filter(Boolean),
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

    const enterEditMode = () => {
        setIsEditMode(true)
    }

    const exitEditMode = () => {
        if (!activeChapter) {
            return
        }

        setDraft(buildDraft(activeChapter, activeChapterDetail))
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

    const goToNextSpread = useCallback(() => {
        setCurrentSpread((previousSpread) =>
            previousSpread < Math.ceil(pages.length / 2) - 1 ? previousSpread + 1 : previousSpread
        )
    }, [pages.length])

    const goToPrevSpread = useCallback(() => {
        setCurrentSpread((previousSpread) => (previousSpread > 0 ? previousSpread - 1 : 0))
    }, [])

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

    const totalPages = pages.length
    const totalSpreads = Math.ceil(totalPages / 2)
    const leftPageIndex = currentSpread * 2
    const rightPageIndex = currentSpread * 2 + 1
    const canGoPrev = currentSpread > 0
    const canGoNext = currentSpread < totalSpreads - 1

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
    const renderPage = (pageContent: string | undefined, pageNumber: number) => {
        if (!pageContent) {
            return null
        }

        if (pageContent === ACTIVITIES_PAGE) {
            return (
                <div className="flex h-full flex-col items-center justify-center space-y-8 overflow-y-auto p-8">
                    <div className="mb-8 space-y-3 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#4ADE80]/10">
                            <Sparkles size={32} className="text-[#4ADE80]" />
                        </div>
                        <h3 className="text-2xl font-bold">Learning Activities</h3>
                        <p className="mx-auto max-w-[300px] text-sm text-[#86868B]">
                            Reinforce your understanding with AI-powered exercises
                        </p>
                    </div>

                    <div className="w-full max-w-[400px] space-y-3">
                        {[
                            {
                                icon: Target,
                                title: 'Generate Quiz',
                                desc: 'Test your knowledge with 5 questions',
                            },
                            {
                                icon: Sparkles,
                                title: 'Create Flashcards',
                                desc: 'Key concepts for quick review',
                            },
                            {
                                icon: FileText,
                                title: 'Practice Problems',
                                desc: "Apply what you've learned",
                            },
                        ].map((item) => (
                            <button
                                key={item.title}
                                className="group flex w-full items-center gap-4 rounded-2xl border border-[#E5E5E7] p-5 text-left transition-all hover:border-[#4ADE80] hover:bg-[#4ADE80]/5"
                                type="button"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F7] transition-all group-hover:bg-[#4ADE80]/10">
                                    <item.icon
                                        size={20}
                                        className="text-[#86868B] transition-all group-hover:text-[#4ADE80]"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[15px] font-semibold">{item.title}</div>
                                    <div className="text-[12px] text-[#86868B]">{item.desc}</div>
                                </div>
                                <ChevronRight
                                    size={18}
                                    className="text-[#86868B] opacity-0 transition-all group-hover:opacity-100"
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )
        }

        const pageIndex = pageNumber - 1

        return (
            <div className="flex h-full flex-col overflow-hidden p-6 pb-12 md:p-8 md:pb-14">
                {pageNumber === 1 && (
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
                            ref={titleRef}
                            className={cn(
                                'text-xl font-bold leading-tight tracking-tight text-[#1D1D1F] md:text-2xl',
                                isEditMode && 'focus:outline-none'
                            )}
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                        >
                            {draft.title}
                        </h2>
                        <p
                            ref={overviewRef}
                            className={cn(
                                'text-xs font-medium italic leading-relaxed text-[#86868B] md:text-sm',
                                isEditMode && 'focus:outline-none'
                            )}
                            contentEditable={isEditMode}
                            suppressContentEditableWarning
                        >
                            {draft.overview}
                        </p>
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
                )}

                <div
                    ref={(node) => {
                        pageContentRefs.current[pageIndex] = node
                    }}
                    className={cn(
                        'prose prose-neutral max-w-none min-h-0 flex-1 overflow-hidden text-sm leading-[1.9] text-[#1D1D1F] md:text-base',
                        isEditMode && 'focus:outline-none'
                    )}
                    contentEditable={isEditMode}
                    dangerouslySetInnerHTML={{ __html: pageContent }}
                    suppressContentEditableWarning
                />

                <div className="absolute bottom-4 right-6 text-[10px] font-medium text-[#86868B] md:bottom-6 md:right-10">
                    {pageNumber}
                </div>
            </div>
        )
    }

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
                            <button
                                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all hover:bg-[#F5F5F7]"
                                onClick={() => void handlePrimaryGeneration()}
                                type="button"
                            >
                                <RotateCcw size={16} className="text-[#86868B]" />
                                <span>
                                    {activeChapter.status === 'ready'
                                        ? 'Regenerate'
                                        : activeChapter.status === 'failed'
                                          ? 'Try Again'
                                          : 'Generate'}
                                </span>
                            </button>
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
                    {activeChapter.content ? (
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
                                    <ChevronLeftIcon size={20} className="text-[#1D1D1F]" />
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
                                        <div
                                            className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] bg-white shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
                                            style={{
                                                height: `${spreadMetrics.pageHeight}px`,
                                                width: `${spreadMetrics.pageWidth}px`,
                                            }}
                                        >
                                            {leftPageIndex < totalPages &&
                                                renderPage(pages[leftPageIndex], leftPageIndex + 1)}
                                        </div>

                                        <div
                                            className="relative overflow-hidden rounded-[16px] border border-[#E5E5E7] bg-white shadow-[0_8px_60px_rgba(0,0,0,0.08)] md:rounded-[24px]"
                                            style={{
                                                height: `${spreadMetrics.pageHeight}px`,
                                                width: `${spreadMetrics.pageWidth}px`,
                                            }}
                                        >
                                            {rightPageIndex < totalPages &&
                                                renderPage(pages[rightPageIndex], rightPageIndex + 1)}
                                        </div>
                                    </Motion.div>
                                </AnimatePresence>

                                <button
                                    className="absolute right-[-56px] top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E5E7] bg-white transition-all hover:scale-110 hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 md:right-[-76px] md:h-12 md:w-12"
                                    disabled={!canGoNext}
                                    onClick={goToNextSpread}
                                    type="button"
                                >
                                    <ChevronRightIcon size={20} className="text-[#1D1D1F]" />
                                </button>

                                <div
                                    className="absolute inset-y-0 left-0 w-[12%] cursor-w-resize"
                                    onClick={canGoPrev ? goToPrevSpread : undefined}
                                />
                                <div
                                    className="absolute inset-y-0 right-0 w-[12%] cursor-e-resize"
                                    onClick={canGoNext ? goToNextSpread : undefined}
                                />
                            </div>

                            <div
                                className="mt-3 rounded-full border border-[#E5E5E7] bg-white/90 px-4 py-2 shadow-lg backdrop-blur-sm md:px-6 md:py-3"
                                style={{ marginTop: `${spreadMetrics.indicatorGap}px` }}
                            >
                                <div className="flex items-center gap-2 md:gap-3">
                                    <BookOpen size={16} className="text-[#86868B]" />
                                    <span className="text-[11px] font-medium text-[#1D1D1F] md:text-[13px]">
                                        Pages {leftPageIndex + 1}-{Math.min(rightPageIndex + 1, totalPages)} of{' '}
                                        {totalPages}
                                    </span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center space-y-6 text-center">
                            {isPendingChapter ? (
                                <>
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
                                        <h3 className="text-xl font-semibold">Chapter not generated yet</h3>
                                        <p className="max-w-[300px] text-sm text-[#86868B]">
                                            Generate this chapter to turn the syllabus outline into readable lesson content.
                                        </p>
                                    </div>
                                    <button
                                        className="rounded-full bg-[#1D1D1F] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] active:scale-95"
                                        onClick={() => void handlePrimaryGeneration()}
                                        type="button"
                                    >
                                        Generate Chapter
                                    </button>
                                </>
                            ) : isFailedChapter ? (
                                <>
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
                                            We encountered an issue generating this chapter. You can retry with the same outline.
                                        </p>
                                    </div>
                                    <button
                                        className="rounded-full bg-[#1D1D1F] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] active:scale-95"
                                        onClick={() => void handlePrimaryGeneration()}
                                        type="button"
                                    >
                                        Try Again
                                    </button>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
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
                                {revisions.map((revision) => (
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
                                    </div>
                                ))}
                            </div>

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
                        </Motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    )
}
