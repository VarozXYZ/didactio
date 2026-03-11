import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loadAuthSession } from '../services/auth.storage'
import {
    createCourse,
    exportCoursePdf,
    getCourse,
    listCourses,
    regenerateCourse,
    resumeCourse,
} from '../services/course.api'
import type {
    AIProvider,
    ContentLength,
    Course,
    CourseLevel,
    Tone,
    Technicality,
} from '../services/course.api'

type CreateCourseFormState = {
    topic: string
    level: CourseLevel
    provider: AIProvider
    contentLength: ContentLength
    tone: Tone
    technicality: Technicality
    language: string
    additionalContext: string
    numLessons: string
    maxMinutes: string
}

const defaultCourseFormState: CreateCourseFormState = {
    topic: '',
    level: 'beginner',
    provider: 'deepseek',
    contentLength: 'short',
    tone: 'neutral',
    technicality: 'intermediate',
    language: 'English',
    additionalContext: '',
    numLessons: '4',
    maxMinutes: '600',
}

const generatingStatuses = new Set(['filtering_prompt', 'generating_syllabus', 'generating_content'])
const DASHBOARD_INITIAL_LOAD_DEBOUNCE_MS = 1500
const lastDashboardLoadByUser = new Map<string, number>()
const courseStatusBadgeMap: Record<Course['status'], { label: string; className: string }> = {
    draft: {
        label: 'Draft',
        className: 'border border-dark/20 bg-white text-dark/70',
    },
    filtering_prompt: {
        label: 'Generating',
        className: 'border border-blue-500/30 bg-blue-100 text-blue-800',
    },
    generating_syllabus: {
        label: 'Generating',
        className: 'border border-blue-500/30 bg-blue-100 text-blue-800',
    },
    generating_content: {
        label: 'Generating',
        className: 'border border-blue-500/30 bg-blue-100 text-blue-800',
    },
    ready: {
        label: 'Completed',
        className: 'border border-emerald-500/30 bg-emerald-100 text-emerald-800',
    },
    error: {
        label: 'Error',
        className: 'border border-red-500/30 bg-red-100 text-red-700',
    },
}

function DashboardPage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const session = useMemo(() => loadAuthSession(), [])
    const hasSession = Boolean(session?.accessToken)
    const sessionUserId = session?.user.id ?? null
    const sharedCourseId = searchParams.get('course')
    const [courses, setCourses] = useState<Course[]>([])
    const [activeCourseId, setActiveCourseId] = useState<string | null>(searchParams.get('course'))
    const [activeCourse, setActiveCourse] = useState<Course | null>(null)
    const [selectedModuleIndex, setSelectedModuleIndex] = useState<number | null>(null)
    const [instruction, setInstruction] = useState('')
    const [courseForm, setCourseForm] = useState<CreateCourseFormState>(defaultCourseFormState)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [isLoadingCourses, setIsLoadingCourses] = useState(false)
    const [isLoadingCourse, setIsLoadingCourse] = useState(false)
    const [isCreatingCourse, setIsCreatingCourse] = useState(false)
    const [isRegenerating, setIsRegenerating] = useState(false)
    const [isResuming, setIsResuming] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [noticeMessage, setNoticeMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!hasSession) {
            navigate('/login', { replace: true })
            return
        }
    }, [hasSession, navigate])

    useEffect(() => {
        if (!hasSession) return
        if (sessionUserId) {
            const now = Date.now()
            const lastLoadedAt = lastDashboardLoadByUser.get(sessionUserId) ?? 0
            if (now - lastLoadedAt < DASHBOARD_INITIAL_LOAD_DEBOUNCE_MS) return
            lastDashboardLoadByUser.set(sessionUserId, now)
        }

        let ignore = false
        setIsLoadingCourses(true)
        listCourses()
            .then((loaded) => {
                if (ignore) return
                setCourses(loaded)
                setActiveCourseId((current) => {
                    if (current && loaded.some((course) => course._id === current)) return current
                    return loaded[0]?._id ?? null
                })
            })
            .catch((error) => {
                if (!ignore) setErrorMessage(error instanceof Error ? error.message : 'Unable to load courses.')
            })
            .finally(() => {
                if (!ignore) setIsLoadingCourses(false)
            })

        return () => {
            ignore = true
        }
    }, [hasSession, sessionUserId])

    useEffect(() => {
        if (!sharedCourseId) return
        if (!courses.some((course) => course._id === sharedCourseId)) return

        setActiveCourseId((current) => (current === sharedCourseId ? current : sharedCourseId))
    }, [courses, sharedCourseId])

    useEffect(() => {
        if (!hasSession || !activeCourseId) {
            setActiveCourse(null)
            return
        }

        let ignore = false
        setIsLoadingCourse(true)
        getCourse(activeCourseId)
            .then((course) => {
                if (ignore) return
                setActiveCourse(course)
            })
            .catch((error) => {
                if (!ignore) setErrorMessage(error instanceof Error ? error.message : 'Unable to load course.')
            })
            .finally(() => {
                if (!ignore) setIsLoadingCourse(false)
            })

        return () => {
            ignore = true
        }
    }, [activeCourseId, hasSession])

    const setSearchParamsRef = useRef(setSearchParams)
    setSearchParamsRef.current = setSearchParams

    useEffect(() => {
        if (!activeCourseId) {
            if (sharedCourseId) {
                setSearchParamsRef.current({}, { replace: true })
            }
            return
        }

        if (sharedCourseId === activeCourseId) return
        setSearchParamsRef.current({ course: activeCourseId }, { replace: true })
    }, [activeCourseId, sharedCourseId])

    const activeCourseStatus = activeCourse?.status ?? null
    const activeStatusBadge = activeCourseStatus ? courseStatusBadgeMap[activeCourseStatus] : null

    useEffect(() => {
        if (!activeCourseId || !activeCourseStatus || !generatingStatuses.has(activeCourseStatus)) return

        const interval = window.setInterval(async () => {
            try {
                const refreshed = await getCourse(activeCourseId)
                setActiveCourse(refreshed)
            } catch {
                // ignore polling errors
            }
        }, 5000)

        return () => window.clearInterval(interval)
    }, [activeCourseId, activeCourseStatus])

    useEffect(() => {
        if (!noticeMessage) return
        const timeout = window.setTimeout(() => setNoticeMessage(null), 3200)
        return () => window.clearTimeout(timeout)
    }, [noticeMessage])

    const displayName = session?.user.name?.trim() || session?.user.email || 'User'
    const userInitial = displayName.charAt(0).toUpperCase()

    const modules = useMemo(() => {
        if (!activeCourse) return []
        const syllabusModules = activeCourse.syllabus?.modules || []
        if (syllabusModules.length === 0) return activeCourse.modules
        return syllabusModules.map((module, index) => {
            const generated =
                activeCourse.modules.find((item) => item.title === module.title) || activeCourse.modules[index]
            return {
                ...module,
                generatedContent: generated?.generatedContent,
                summary: generated?.summary,
            }
        })
    }, [activeCourse])

    const selectedModule = selectedModuleIndex === null ? null : modules[selectedModuleIndex] || null
    const objectives = useMemo(() => {
        const outlined = modules
            .flatMap((module) => module.lessons)
            .flatMap((lesson) => lesson.content_outline || [])
            .map((item) => item.trim())
            .filter(Boolean)
        return outlined.length ? Array.from(new Set(outlined)).slice(0, 6) : []
    }, [modules])

    useEffect(() => {
        if (modules.length === 0) {
            setSelectedModuleIndex(null)
            return
        }

        setSelectedModuleIndex((current) => {
            if (current !== null && current < modules.length) return current
            return 0
        })
    }, [modules])

    async function refreshCourses(preferredId?: string) {
        const loaded = await listCourses(true)
        setCourses(loaded)
        setActiveCourseId((current) => {
            if (preferredId && loaded.some((course) => course._id === preferredId)) return preferredId
            if (current && loaded.some((course) => course._id === current)) return current
            return loaded[0]?._id ?? null
        })
    }

    async function handleCreateCourse(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setErrorMessage(null)
        if (!courseForm.topic.trim()) {
            setErrorMessage('Course topic is required.')
            return
        }

        setIsCreatingCourse(true)
        try {
            const numLessons = Number(courseForm.numLessons)
            const maxMinutes = Number(courseForm.maxMinutes)
            const created = await createCourse({
                topic: courseForm.topic.trim(),
                level: courseForm.level,
                provider: courseForm.provider,
                contentLength: courseForm.contentLength,
                tone: courseForm.tone,
                technicality: courseForm.technicality,
                language: courseForm.language.trim() || 'English',
                additionalContext: courseForm.additionalContext.trim() || undefined,
                options: {
                    numLessons: Number.isFinite(numLessons) && numLessons > 0 ? Math.floor(numLessons) : undefined,
                    maxMinutes: Number.isFinite(maxMinutes) && maxMinutes > 0 ? Math.floor(maxMinutes) : undefined,
                },
            })
            await refreshCourses(created._id)
            setCourseForm(defaultCourseFormState)
            setIsCreateModalOpen(false)
            setNoticeMessage('Course generation started.')
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to create course.')
        } finally {
            setIsCreatingCourse(false)
        }
    }

    async function handleRegenerate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setErrorMessage(null)
        if (!activeCourseId || !activeCourse || !instruction.trim()) return
        const moduleIndex = selectedModuleIndex ?? 0
        if (!modules[moduleIndex]) return

        setIsRegenerating(true)
        try {
            await regenerateCourse(activeCourseId, {
                moduleIndex,
                context: instruction.trim(),
                provider: activeCourse.provider,
            })
            const refreshed = await getCourse(activeCourseId)
            setActiveCourse(refreshed)
            setCourses((previous) =>
                previous.map((item) => (item._id === refreshed._id ? refreshed : item))
            )
            setInstruction('')
            setNoticeMessage('Regeneration request sent.')
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to regenerate module.')
        } finally {
            setIsRegenerating(false)
        }
    }

    async function handleResume() {
        if (!activeCourseId || !activeCourse) return
        setIsResuming(true)
        try {
            await resumeCourse(activeCourseId, { provider: activeCourse.provider })
            const refreshed = await getCourse(activeCourseId)
            setActiveCourse(refreshed)
            setCourses((previous) =>
                previous.map((item) => (item._id === refreshed._id ? refreshed : item))
            )
            setNoticeMessage('Resume started.')
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to resume generation.')
        } finally {
            setIsResuming(false)
        }
    }

    async function handleExport() {
        if (!activeCourseId) return
        setIsExporting(true)
        try {
            const { blob, filename } = await exportCoursePdf(activeCourseId)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : 'Unable to export course.')
        } finally {
            setIsExporting(false)
        }
    }

    async function handleShare() {
        if (!activeCourseId) return
        const url = `${window.location.origin}/dashboard?course=${activeCourseId}`
        try {
            await navigator.clipboard.writeText(url)
            setNoticeMessage('Share link copied.')
        } catch {
            setNoticeMessage(url)
        }
    }

    if (!session) return null

    return (
        <section className="min-h-screen w-full bg-[#5D5D5D0D] text-dark flex">
            <aside className="w-[340px] border-r border-dark/15 bg-white px-8 py-6 flex flex-col">
                <img src="/assets/logos/logo-horizontal.png" alt="Didactio" className="w-full max-w-[230px] h-auto object-contain mx-auto" />
                <button type="button" onClick={() => setIsCreateModalOpen(true)} className="mt-10 h-13 w-[220px] self-center rounded-md bg-accent font-sora text-3xl font-medium flex items-center justify-center gap-3 hover:bg-accent/90 transition-colors">
                    <img src="/assets/icons/plus-circle-outline-svgrepo-com.png" alt="" className="h-6 w-6" />
                    New course
                </button>
                <p className="mt-12 font-sora text-xl font-medium text-dark/70">Recent</p>
                <div className="mt-4 space-y-2">
                    {courses.map((course) => {
                        const title = course.syllabus?.title || course.improvedPrompt || course.originalPrompt
                        const selected = course._id === activeCourseId
                        return (
                            <button key={course._id} type="button" onClick={() => setActiveCourseId(course._id)} className={`w-full rounded-md px-4 py-3 text-left ${selected ? 'bg-dark/8' : 'hover:bg-dark/5'}`}>
                                <span className="flex items-start gap-3">
                                    <img src="/assets/icons/project.png" alt="" className="h-5 w-5 mt-1" />
                                    <span className="font-inter text-2xl leading-tight">{title}</span>
                                </span>
                            </button>
                        )
                    })}
                    {!isLoadingCourses && courses.length === 0 && <p className="font-inter text-sm text-dark/55 px-2">No courses yet.</p>}
                </div>
                <div className="mt-auto border-t border-dark/15 pt-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-dark text-white font-sora text-sm font-semibold flex items-center justify-center">{userInitial}</div>
                        <span className="font-inter text-3xl text-dark/75 truncate max-w-[210px]">{displayName}</span>
                    </div>
                    <img src="/assets/icons/settings-svgrepo-com.png" alt="" className="h-8 w-8 opacity-55" />
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-h-screen">
                <header className="h-[96px] border-b border-dark/15 px-8 bg-white flex items-center justify-between">
                    <div className="flex-1 flex flex-col justify-center pr-8">
                        <h1 className="font-sora text-3xl font-semibold leading-tight">{activeCourse ? (activeCourse.syllabus?.title || activeCourse.improvedPrompt || activeCourse.originalPrompt) : 'Dashboard'}</h1>
                        {activeStatusBadge && (
                            <span className={`mt-2 self-start inline-flex h-8 items-center rounded-full px-3 font-inter text-xs font-semibold ${activeStatusBadge.className}`}>
                                {activeStatusBadge.label}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={handleShare} disabled={!activeCourseId} className="h-11 rounded-md border border-dark/20 bg-white px-5 font-sora text-xl font-medium flex items-center gap-2.5 hover:bg-dark/3 disabled:opacity-50">
                            <img src="/assets/icons/share-nodes-solid-full.png" alt="" className="h-4 w-4" />
                            Share
                        </button>
                        <button type="button" onClick={handleExport} disabled={!activeCourseId || activeCourse?.status !== 'ready' || isExporting} className="h-11 rounded-md bg-accent px-5 font-sora text-xl font-medium flex items-center gap-2.5 hover:bg-accent/90 disabled:opacity-50">
                            <img src="/assets/icons/export.png" alt="" className="h-4 w-4" />
                            {isExporting ? 'Exporting...' : 'Export'}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-10 py-8 pb-24">
                    {errorMessage && <p className="mb-4 rounded-md border border-red-400/40 bg-red-50 px-4 py-3 font-inter text-sm text-red-700">{errorMessage}</p>}
                    {noticeMessage && <p className="mb-4 rounded-md border border-accent/40 bg-accent/10 px-4 py-3 font-inter text-sm">{noticeMessage}</p>}
                    {isLoadingCourse && <p className="mb-4 font-inter text-sm text-dark/55">Loading course...</p>}
                    {activeCourse?.status === 'error' && (
                        <div className="mb-5 rounded-md border border-amber-400/35 bg-amber-50 px-4 py-4 flex items-center justify-between">
                            <p className="font-inter text-sm text-amber-800">{activeCourse.errorMessage || 'Course finished with issues.'}</p>
                            <button type="button" onClick={handleResume} disabled={isResuming} className="h-10 rounded-md bg-dark px-4 font-sora text-xs font-semibold text-white hover:bg-dark/90">{isResuming ? 'Resuming...' : 'Resume generation'}</button>
                        </div>
                    )}
                    {!activeCourse && !isLoadingCourse && <div className="rounded-md border border-dark/20 bg-white px-6 py-8"><h2 className="font-sora text-4xl font-semibold">No course selected</h2><p className="mt-2 font-inter text-3xl text-dark/65">Choose one from the sidebar or create a new course.</p></div>}
                    {activeCourse && (
                        <div className="space-y-6">
                            <article className="rounded-md border border-dark/20 bg-[#f7f7f7] px-5 py-4"><h2 className="font-sora text-4xl font-semibold">Course overview</h2><p className="mt-3 font-inter text-3xl text-dark/65 leading-relaxed">{activeCourse.syllabus?.description || activeCourse.improvedPrompt || activeCourse.originalPrompt}</p></article>
                            {objectives.length > 0 && (
                                <article className="rounded-md border border-dark/20 bg-[#f7f7f7] px-5 py-4">
                                    <h2 className="font-sora text-4xl font-semibold">Learning objectives</h2>
                                    <div className="mt-4 space-y-3">{objectives.map((objective) => <p key={objective} className="flex gap-3 font-inter text-3xl text-dark/70"><img src="/assets/icons/check-mark.png" alt="" className="h-6 w-6 mt-0.5" /><span>{objective}</span></p>)}</div>
                                </article>
                            )}
                            {modules.map((module, index) => {
                                const selected = index === selectedModuleIndex
                                return (
                                    <button key={`${module.title}-${index}`} type="button" onClick={() => setSelectedModuleIndex(index)} className={`w-full rounded-md border bg-[#f7f7f7] px-5 py-4 text-left ${selected ? 'border-accent shadow-card' : 'border-dark/20 hover:bg-[#f4f4f4]'}`}>
                                        <h3 className="font-sora text-4xl font-semibold">Module {index + 1}: {module.title}</h3>
                                        <p className="mt-3 font-inter text-3xl text-dark/65 leading-relaxed">{module.overview || 'No overview available yet.'}</p>
                                    </button>
                                )
                            })}
                            {selectedModule?.generatedContent && (
                                <article className="rounded-md border border-dark/20 bg-white px-5 py-4">
                                    <h2 className="font-sora text-4xl font-semibold">Module draft: {selectedModule.title}</h2>
                                    {selectedModule.summary && <pre className="mt-3 whitespace-pre-wrap font-inter text-2xl text-dark/75 bg-[#f5f5f5] border border-dark/10 rounded-sm px-4 py-3">{selectedModule.summary}</pre>}
                                    <pre className="mt-4 max-h-[260px] overflow-y-auto whitespace-pre-wrap font-inter text-2xl text-dark/70 bg-[#f8f8f8] border border-dark/10 rounded-sm px-4 py-4">{selectedModule.generatedContent}</pre>
                                </article>
                            )}
                        </div>
                    )}
                </div>

                <footer className="border-t border-dark/15 bg-[#5D5D5D0D] px-10 py-5">
                    <form onSubmit={handleRegenerate} className="flex items-center gap-3">
                        <input type="text" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Ask the AI to modify, improve or add anything..." className="h-13 flex-1 rounded-sm border border-dark/20 bg-white px-4 font-inter text-3xl outline-none placeholder:text-dark/45 focus:ring-2 focus:ring-accent/45" />
                        <button type="submit" disabled={!activeCourseId || isRegenerating} className="h-13 w-13 rounded-md bg-accent flex items-center justify-center hover:bg-accent/90 disabled:opacity-50">
                            <img src="/assets/icons/paper-plane-solid-full-black.png" alt="" className="h-7 w-7" />
                        </button>
                    </form>
                    <p className="mt-2 font-inter text-xs text-dark/55">{selectedModule ? `Editing module: ${selectedModule.title}` : 'Select a module first, then send instructions to regenerate it.'}</p>
                </footer>
            </div>

            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-6">
                    <div className="w-full max-w-[820px] rounded-md border border-dark/20 bg-white shadow-elevated">
                        <div className="border-b border-dark/12 px-6 py-4 flex items-center justify-between">
                            <h2 className="font-sora text-4xl font-semibold">Create a new course</h2>
                            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="h-8 w-8 rounded-full border border-dark/25 text-dark/70 hover:bg-dark/5">×</button>
                        </div>
                        <form onSubmit={handleCreateCourse} className="px-6 py-5 space-y-4">
                            <label className="block"><span className="font-sora text-sm font-semibold">Course topic</span><input type="text" value={courseForm.topic} onChange={(event) => setCourseForm((previous) => ({ ...previous, topic: event.target.value }))} placeholder="Introduction to Python programming" className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45" /></label>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="block"><span className="font-sora text-sm font-semibold">Level</span><select value={courseForm.level} onChange={(event) => setCourseForm((previous) => ({ ...previous, level: event.target.value as CourseLevel }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
                                <label className="block"><span className="font-sora text-sm font-semibold">Provider</span><select value={courseForm.provider} onChange={(event) => setCourseForm((previous) => ({ ...previous, provider: event.target.value as AIProvider }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45"><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option></select></label>
                                <label className="block"><span className="font-sora text-sm font-semibold">Content length</span><select value={courseForm.contentLength} onChange={(event) => setCourseForm((previous) => ({ ...previous, contentLength: event.target.value as ContentLength }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45"><option value="intro">Intro</option><option value="short">Short</option><option value="long">Long</option><option value="textbook">Textbook</option></select></label>
                                <label className="block"><span className="font-sora text-sm font-semibold">Language</span><input type="text" value={courseForm.language} onChange={(event) => setCourseForm((previous) => ({ ...previous, language: event.target.value }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45" /></label>
                                <label className="block"><span className="font-sora text-sm font-semibold">Tone</span><select value={courseForm.tone} onChange={(event) => setCourseForm((previous) => ({ ...previous, tone: event.target.value as Tone }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45"><option value="friendly">Friendly</option><option value="neutral">Neutral</option><option value="professional">Professional</option></select></label>
                                <label className="block"><span className="font-sora text-sm font-semibold">Technicality</span><select value={courseForm.technicality} onChange={(event) => setCourseForm((previous) => ({ ...previous, technicality: event.target.value as Technicality }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45"><option value="basic">Basic</option><option value="intermediate">Intermediate</option><option value="technical">Technical</option></select></label>
                                <label className="block"><span className="font-sora text-sm font-semibold">Min lessons</span><input type="number" min={1} value={courseForm.numLessons} onChange={(event) => setCourseForm((previous) => ({ ...previous, numLessons: event.target.value }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45" /></label>
                                <label className="block"><span className="font-sora text-sm font-semibold">Max minutes</span><input type="number" min={30} value={courseForm.maxMinutes} onChange={(event) => setCourseForm((previous) => ({ ...previous, maxMinutes: event.target.value }))} className="mt-2 h-11 w-full rounded-sm border border-dark/20 px-3 font-inter text-sm outline-none focus:ring-2 focus:ring-accent/45" /></label>
                            </div>
                            <label className="block"><span className="font-sora text-sm font-semibold">Additional context</span><textarea rows={4} value={courseForm.additionalContext} onChange={(event) => setCourseForm((previous) => ({ ...previous, additionalContext: event.target.value }))} placeholder="Add classroom constraints, student profile, or emphasis areas..." className="mt-2 w-full rounded-sm border border-dark/20 px-3 py-2 font-inter text-sm outline-none resize-none focus:ring-2 focus:ring-accent/45" /></label>
                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="h-11 rounded-sm border border-dark/25 px-4 font-sora text-sm hover:bg-dark/5">Cancel</button>
                                <button type="submit" disabled={isCreatingCourse} className="h-11 rounded-sm bg-accent px-5 font-sora text-sm font-semibold hover:bg-accent/90 disabled:opacity-65">{isCreatingCourse ? 'Creating...' : 'Create course'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}

export default DashboardPage
