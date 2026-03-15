import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
    AlertCircle,
    ArrowLeft,
    BookOpen,
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
} from 'lucide-react'
import { AnimatePresence, motion as Motion } from 'motion/react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
    ACTIVITIES_PAGE,
    calculateSpreadMetrics,
    getStatusPillClass,
    measurePages,
} from '../../pageLayout'
import type { DetailedUnit, UnitChapter } from '../../types'

type UnitEditorProps = {
    onBack: () => void
    unit: DetailedUnit
}

function cn(...inputs: Array<string | false | null | undefined>) {
    return twMerge(clsx(inputs))
}

export function UnitEditor({ onBack, unit }: UnitEditorProps) {
    const [activeChapterId, setActiveChapterId] = useState(unit.chapters[0].id)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isEditMode, setIsEditMode] = useState(false)
    const [currentSpread, setCurrentSpread] = useState(0)
    const [pages, setPages] = useState<string[]>([])
    const [viewport, setViewport] = useState(() => ({
        height: typeof window !== 'undefined' ? window.innerHeight : 900,
        width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    }))

    useEffect(() => {
        setActiveChapterId(unit.chapters[0].id)
        setCurrentSpread(0)
        setIsEditMode(false)
    }, [unit])

    const activeChapter =
        unit.chapters.find((chapter) => chapter.id === activeChapterId) ?? unit.chapters[0]

    const spreadMetrics = useMemo(
        () =>
            calculateSpreadMetrics({
                isSidebarOpen,
                viewportHeight: viewport.height,
                viewportWidth: viewport.width,
            }),
        [isSidebarOpen, viewport.height, viewport.width]
    )

    const handleSave = () => {
        setIsSaving(true)
        window.setTimeout(() => setIsSaving(false), 1200)
    }

    const selectChapter = (chapterId: string) => {
        setActiveChapterId(chapterId)
        setCurrentSpread(0)
        setIsEditMode(false)
    }

    const getStatusIcon = (status: UnitChapter['status']) => {
        switch (status) {
            case 'ready':
                return <CheckCircle2 size={14} className="text-[#4ADE80]" />
            case 'generating':
                return <Loader2 size={14} className="animate-spin text-[#4ADE80]" />
            case 'failed':
                return <AlertCircle size={14} className="text-red-400" />
            default:
                return null
        }
    }

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

    useLayoutEffect(() => {
        let frameId = 0

        if (!activeChapter.content) {
            frameId = window.requestAnimationFrame(() => setPages([]))
            return () => window.cancelAnimationFrame(frameId)
        }

        const chapterIndex = unit.chapters.findIndex((chapter) => chapter.id === activeChapter.id)
        frameId = window.requestAnimationFrame(() => {
            setPages(
                measurePages({
                    activeChapter,
                    chapterIndex,
                    content: activeChapter.content ?? '',
                    pageHeight: spreadMetrics.pageHeight,
                    pageWidth: spreadMetrics.pageWidth,
                })
            )
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [activeChapter, spreadMetrics.pageHeight, spreadMetrics.pageWidth, unit.chapters])

    const totalPages = pages.length
    const totalSpreads = Math.ceil(totalPages / 2)

    useEffect(() => {
        if (totalSpreads === 0) {
            if (currentSpread === 0) {
                return
            }

            const frameId = window.requestAnimationFrame(() => {
                setCurrentSpread(0)
            })

            return () => window.cancelAnimationFrame(frameId)
        }

        if (currentSpread <= totalSpreads - 1) {
            return
        }

        const frameId = window.requestAnimationFrame(() => {
            setCurrentSpread(totalSpreads - 1)
        })

        return () => window.cancelAnimationFrame(frameId)
    }, [currentSpread, totalSpreads])

    const goToNextSpread = useCallback(() => {
        setCurrentSpread((previousSpread) =>
            previousSpread < totalSpreads - 1 ? previousSpread + 1 : previousSpread
        )
    }, [totalSpreads])

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

    const leftPageIndex = currentSpread * 2
    const rightPageIndex = currentSpread * 2 + 1
    const canGoPrev = currentSpread > 0
    const canGoNext = currentSpread < totalSpreads - 1

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

        return (
            <div className="flex h-full flex-col overflow-hidden p-6 pb-12 md:p-8 md:pb-14">
                {pageNumber === 1 && (
                    <div className="mb-4 flex-shrink-0 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#86868B]">
                                Chapter {unit.chapters.indexOf(activeChapter) + 1}
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
                        <h2 className="text-xl font-bold leading-tight tracking-tight text-[#1D1D1F] md:text-2xl">
                            {activeChapter.title}
                        </h2>
                        <p className="text-xs font-medium italic leading-relaxed text-[#86868B] md:text-sm">
                            {activeChapter.summary}
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
                                <span>{unit.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5F5F7]">
                                <Motion.div
                                    animate={{ width: `${unit.progress}%` }}
                                    className="h-full bg-[#4ADE80]"
                                    initial={{ width: 0 }}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="text-center">
                            <div className="text-sm font-bold text-[#4ADE80]">{unit.progress}%</div>
                        </div>
                    )}
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-3">
                    {unit.chapters.map((chapter, index) => (
                        <button
                            key={chapter.id}
                            className={cn(
                                'group flex w-full items-center rounded-[10px] text-left transition-all duration-200',
                                isSidebarOpen ? 'gap-3 px-3 py-2.5' : 'justify-center px-2 py-2.5',
                                activeChapterId === chapter.id
                                    ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                                    : 'text-[#86868B] hover:bg-[#F5F5F7]/50 hover:text-[#1D1D1F]'
                            )}
                            onClick={() => selectChapter(chapter.id)}
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
                                                : chapter.status === 'generating'
                                                  ? 'generating-pulse text-[#4ADE80]'
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
                        onClick={onBack}
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
                            onClick={onBack}
                            type="button"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="h-4 w-[1px] bg-[#E5E5E7]" />
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-[#86868B]">
                                <span>Units</span>
                                <ChevronRight size={10} />
                                <span>{unit.subject}</span>
                            </div>
                            <h1 className="max-w-[300px] truncate text-[14px] font-semibold text-[#1D1D1F]">
                                {unit.title}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-[13px] text-[#86868B]">
                            <span
                                className={cn(
                                    'h-2 w-2 rounded-full',
                                    isSaving ? 'bg-amber-400' : 'bg-[#4ADE80]'
                                )}
                            />
                            {isSaving ? 'Saving...' : 'Autosaved'}
                        </div>

                        <div className="h-4 w-[1px] bg-[#E5E5E7]" />

                        <div className="flex items-center gap-1.5">
                            <button
                                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all hover:bg-[#F5F5F7]"
                                type="button"
                            >
                                <History size={16} className="text-[#86868B]" />
                                <span>Version History</span>
                            </button>
                            <button
                                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all hover:bg-[#F5F5F7]"
                                onClick={handleSave}
                                type="button"
                            >
                                <RotateCcw size={16} className="text-[#86868B]" />
                                <span>Regenerate</span>
                            </button>
                            <button
                                className={cn(
                                    'flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all',
                                    isEditMode
                                        ? 'bg-[#4ADE80] text-white hover:bg-[#3BCD6F]'
                                        : 'bg-[#1D1D1F] text-white hover:bg-[#333333]'
                                )}
                                onClick={() => setIsEditMode(!isEditMode)}
                                type="button"
                            >
                                <Edit3 size={16} />
                                <span>{isEditMode ? 'Exit Edit' : 'Edit Mode'}</span>
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

                <div className="flex flex-1 flex-col items-center justify-center bg-[#F5F5F7] px-4 py-4 md:px-8 md:py-6">
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
                            {activeChapter.status === 'generating' ? (
                                <>
                                    <div className="relative">
                                        <Loader2
                                            size={56}
                                            strokeWidth={1.5}
                                            className="animate-spin text-[#4ADE80]"
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
                                        <h3 className="text-xl font-semibold">AI is crafting this chapter</h3>
                                        <p className="max-w-[300px] text-sm text-[#86868B]">
                                            Synthesizing pedagogical research, technical data, and educational benchmarks...
                                        </p>
                                    </div>
                                </>
                            ) : (
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
                                            We encountered an issue during synthesis. This usually happens with complex technical constraints.
                                        </p>
                                        <button
                                            className="mt-6 rounded-full bg-[#1D1D1F] px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] active:scale-95"
                                            type="button"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
