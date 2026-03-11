import { loadAuthSession } from './auth.storage'

export type CourseStatus =
    | 'draft'
    | 'filtering_prompt'
    | 'generating_syllabus'
    | 'generating_content'
    | 'ready'
    | 'error'

export type AIProvider = 'deepseek' | 'openai'
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type ContentLength = 'intro' | 'short' | 'long' | 'textbook'
export type Tone = 'friendly' | 'neutral' | 'professional'
export type Technicality = 'basic' | 'intermediate' | 'technical'

export interface CourseLesson {
    title: string
    content_outline: string[]
    content?: string
}

export interface CourseModule {
    title: string
    overview?: string
    estimated_duration_minutes?: number
    lessons: CourseLesson[]
    generatedContent?: string
    summary?: string
}

export interface CourseSyllabus {
    topic: string
    title: string
    keywords: string
    description: string
    total_duration_minutes: number
    modules: CourseModule[]
}

export interface Course {
    _id: string
    owner: string
    status: CourseStatus
    provider: AIProvider
    contentLength: ContentLength
    tone: Tone
    technicality: Technicality
    language: string
    additionalContext?: string
    originalPrompt: string
    improvedPrompt?: string
    level: CourseLevel
    syllabus?: CourseSyllabus
    modules: CourseModule[]
    iterationSummaries: string[]
    errorMessage?: string
    createdAt: string
    updatedAt: string
}

export interface CreateCoursePayload {
    topic: string
    level: CourseLevel
    provider?: AIProvider
    contentLength?: ContentLength
    tone?: Tone
    technicality?: Technicality
    language?: string
    additionalContext?: string
    options?: {
        numLessons?: number
        maxMinutes?: number
    }
}

export interface CourseStatusResponse {
    id: string
    status: CourseStatus
    modulesGenerated: number
    totalModules: number
    errorMessage?: string
}

export interface RegenerateCoursePayload {
    moduleIndex: number
    context: string
    provider?: AIProvider
}

export interface ResumeCoursePayload {
    provider?: AIProvider
}

interface DownloadResult {
    blob: Blob
    filename: string
}

const COURSES_STORAGE_KEY = 'didactio.courses'

function loadStoredCourses(): Course[] {
    const rawCourses = localStorage.getItem(COURSES_STORAGE_KEY)
    if (!rawCourses) {
        return []
    }

    try {
        const parsed = JSON.parse(rawCourses) as Course[]
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function saveStoredCourses(courses: Course[]): void {
    localStorage.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses))
}

function requireSession() {
    const session = loadAuthSession()
    if (!session) {
        throw new Error('Please log in to continue.')
    }
    return session
}

function sortCourses(courses: Course[]): Course[] {
    return [...courses].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function buildModuleTitle(topic: string, index: number, moduleCount: number): string {
    if (moduleCount === 1) {
        return `${topic} overview`
    }

    const labels = ['Foundations', 'Core Concepts', 'Applied Practice', 'Advanced Scenarios', 'Implementation', 'Evaluation']
    const label = labels[index] ?? `Module ${index + 1}`
    return `${label} of ${topic}`
}

function buildLessonOutline(topic: string, level: CourseLevel, moduleIndex: number): string[] {
    const levelGuidance: Record<CourseLevel, string[]> = {
        beginner: ['Understand the main concepts', 'Recognize essential vocabulary', 'Complete guided exercises'],
        intermediate: ['Connect ideas across modules', 'Apply concepts in realistic tasks', 'Review tradeoffs and patterns'],
        advanced: ['Analyze complex cases', 'Design independent solutions', 'Critique implementation decisions'],
    }

    return [
        `${topic} module ${moduleIndex + 1} goals`,
        ...levelGuidance[level],
    ]
}

function buildGeneratedContent(
    topic: string,
    moduleTitle: string,
    language: string,
    tone: Tone,
    technicality: Technicality,
    additionalContext?: string
): string {
    const contextLine = additionalContext
        ? `Additional context: ${additionalContext}.`
        : 'Additional context: none provided.'

    return [
        `${moduleTitle}`,
        '',
        `This lesson pack is written in ${language} with a ${tone} tone and ${technicality} depth.`,
        `Focus area: ${topic}.`,
        contextLine,
        '',
        'Suggested flow:',
        '1. Introduce the key idea and why it matters.',
        '2. Break the concept into teachable steps.',
        '3. Show an applied example or classroom activity.',
        '4. Close with a reflection prompt and a short recap.',
    ].join('\n')
}

function buildSummary(moduleTitle: string, topic: string): string {
    return `${moduleTitle} gives learners a practical checkpoint within the broader ${topic} course.`
}

function createCourseModules(payload: CreateCoursePayload): CourseModule[] {
    const moduleCount = Math.min(Math.max(payload.options?.numLessons ?? 4, 1), 8)
    const totalMinutes = Math.max(payload.options?.maxMinutes ?? 240, 60)
    const minutesPerModule = Math.max(Math.floor(totalMinutes / moduleCount), 30)

    return Array.from({ length: moduleCount }, (_, index) => {
        const title = buildModuleTitle(payload.topic, index, moduleCount)
        const lessonTitle = `${title} workshop`
        return {
            title,
            overview: `A ${payload.level} module focused on ${payload.topic.toLowerCase()} through concrete activities and reflection.`,
            estimated_duration_minutes: minutesPerModule,
            lessons: [
                {
                    title: lessonTitle,
                    content_outline: buildLessonOutline(payload.topic, payload.level, index),
                    content: `Learners work through ${lessonTitle.toLowerCase()} with examples, guided prompts, and recap tasks.`,
                },
            ],
            generatedContent: buildGeneratedContent(
                payload.topic,
                title,
                payload.language ?? 'English',
                payload.tone ?? 'neutral',
                payload.technicality ?? 'intermediate',
                payload.additionalContext
            ),
            summary: buildSummary(title, payload.topic),
        }
    })
}

function buildCourseSyllabus(payload: CreateCoursePayload, modules: CourseModule[]): CourseSyllabus {
    return {
        topic: payload.topic,
        title: `${payload.topic} Mastery Path`,
        keywords: [payload.topic, payload.level, payload.language ?? 'English'].join(', '),
        description: `A ${payload.level} course for ${payload.topic} designed as a fully local workspace draft.`,
        total_duration_minutes: modules.reduce(
            (total, module) => total + (module.estimated_duration_minutes ?? 0),
            0
        ),
        modules: modules.map(({ title, overview, estimated_duration_minutes, lessons }) => ({
            title,
            overview,
            estimated_duration_minutes,
            lessons,
        })),
    }
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function updateCourseInStore(updatedCourse: Course): void {
    const courses = loadStoredCourses()
    const nextCourses = courses.map((course) =>
        course._id === updatedCourse._id ? updatedCourse : course
    )
    saveStoredCourses(nextCourses)
}

export async function listCourses(force = false): Promise<Course[]> {
    void force
    const session = requireSession()
    const courses = loadStoredCourses().filter((course) => course.owner === session.user.id)
    return sortCourses(courses)
}

export async function getCourse(courseId: string): Promise<Course> {
    const session = requireSession()
    const course = loadStoredCourses().find(
        (candidate) => candidate._id === courseId && candidate.owner === session.user.id
    )

    if (!course) {
        throw new Error('Course not found.')
    }

    return course
}

export async function createCourse(payload: CreateCoursePayload): Promise<Course> {
    const session = requireSession()
    const timestamp = new Date().toISOString()
    const modules = createCourseModules(payload)
    const course: Course = {
        _id: crypto.randomUUID(),
        owner: session.user.id,
        status: 'ready',
        provider: payload.provider ?? 'deepseek',
        contentLength: payload.contentLength ?? 'short',
        tone: payload.tone ?? 'neutral',
        technicality: payload.technicality ?? 'intermediate',
        language: payload.language?.trim() || 'English',
        additionalContext: payload.additionalContext?.trim() || undefined,
        originalPrompt: payload.topic.trim(),
        improvedPrompt: `Create a ${payload.level} course about ${payload.topic.trim()}.`,
        level: payload.level,
        syllabus: buildCourseSyllabus(payload, modules),
        modules,
        iterationSummaries: ['Initial local course draft created in the browser.'],
        createdAt: timestamp,
        updatedAt: timestamp,
    }

    const courses = loadStoredCourses()
    saveStoredCourses([course, ...courses])
    return course
}

export async function regenerateCourse(
    courseId: string,
    payload: RegenerateCoursePayload
): Promise<Course> {
    const course = await getCourse(courseId)
    const module = course.modules[payload.moduleIndex]

    if (!module) {
        throw new Error('Selected module no longer exists.')
    }

    const refreshedModule: CourseModule = {
        ...module,
        generatedContent: [
            module.generatedContent || module.overview || module.title,
            '',
            `Revision request: ${payload.context}`,
            '',
            'Updated local draft:',
            `- Tighten the structure for ${course.level} learners.`,
            `- Keep the tone ${course.tone} and the language ${course.language}.`,
            '- Add one more concrete activity or example before the recap.',
        ].join('\n'),
        summary: `Updated after local revision request: ${payload.context}`,
    }

    const modules = course.modules.map((current, index) =>
        index === payload.moduleIndex ? refreshedModule : current
    )

    const updatedCourse: Course = {
        ...course,
        modules,
        syllabus: course.syllabus
            ? {
                ...course.syllabus,
                modules: course.syllabus.modules.map((current, index) =>
                    index === payload.moduleIndex
                        ? {
                            ...current,
                            overview: refreshedModule.overview,
                            lessons: refreshedModule.lessons,
                        }
                        : current
                ),
            }
            : undefined,
        iterationSummaries: [
            ...course.iterationSummaries,
            `Module ${payload.moduleIndex + 1} revised locally.`,
        ],
        updatedAt: new Date().toISOString(),
    }

    updateCourseInStore(updatedCourse)
    return updatedCourse
}

export async function resumeCourse(
    courseId: string,
    payload: ResumeCoursePayload = {}
): Promise<CourseStatusResponse> {
    void payload
    const course = await getCourse(courseId)
    const updatedCourse: Course = {
        ...course,
        status: 'ready',
        errorMessage: undefined,
        updatedAt: new Date().toISOString(),
    }

    updateCourseInStore(updatedCourse)

    return {
        id: updatedCourse._id,
        status: updatedCourse.status,
        modulesGenerated: updatedCourse.modules.length,
        totalModules: updatedCourse.modules.length,
    }
}

export async function downloadCourseDocument(courseId: string): Promise<DownloadResult> {
    const course = await getCourse(courseId)
    const title = course.syllabus?.title || course.improvedPrompt || course.originalPrompt
    const description = course.syllabus?.description || course.originalPrompt
    const body = [
        `# ${title}`,
        '',
        description,
        '',
        ...course.modules.flatMap((module, index) => [
            `## Module ${index + 1}: ${module.title}`,
            '',
            module.overview || '',
            '',
            module.generatedContent || '',
            '',
        ]),
    ].join('\n')

    return {
        blob: new Blob([body], { type: 'text/markdown;charset=utf-8' }),
        filename: `${slugify(title) || 'course'}.md`,
    }
}
