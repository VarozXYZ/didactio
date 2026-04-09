export type DidacticUnitProvider = string
export type DidacticUnitDepth = 'basic' | 'intermediate' | 'technical'
export type DidacticUnitLength = 'intro' | 'short' | 'long' | 'textbook'
export type DidacticUnitLevel = 'beginner' | 'intermediate' | 'advanced'
export type DidacticUnitFolderAssignmentMode = 'manual' | 'auto'

export type DidacticUnitNextAction =
    | 'moderate_topic'
    | 'generate_questionnaire'
    | 'answer_questionnaire'
    | 'generate_syllabus_prompt'
    | 'review_syllabus_prompt'
    | 'review_syllabus'
    | 'approve_syllabus'
    | 'view_didactic_unit'

export interface CreateDidacticUnitInput {
    topic: string
    provider: DidacticUnitProvider
    additionalContext?: string
    depth: DidacticUnitDepth
    length: DidacticUnitLength
    level: DidacticUnitLevel
    questionnaireEnabled: boolean
    folderSelection: DidacticUnitFolderSelectionInput
}

export interface DidacticUnitFolderSelectionInput {
    mode: DidacticUnitFolderAssignmentMode
    folderId?: string
}

export interface UpdateDidacticUnitFolderInput {
    folderSelection: DidacticUnitFolderSelectionInput
}

export interface DidacticUnitQuestionAnswer {
    questionId: string
    value: string
}

export interface DidacticUnitQuestionnaireAnswersInput {
    answers: DidacticUnitQuestionAnswer[]
}

export type DidacticUnitQuestionType = 'single_select' | 'long_text'

export interface DidacticUnitQuestionOption {
    value: string
    label: string
}

export interface DidacticUnitQuestion {
    id: string
    prompt: string
    type: DidacticUnitQuestionType
    options?: DidacticUnitQuestionOption[]
}

export interface DidacticUnitQuestionnaire {
    questions: DidacticUnitQuestion[]
}

export interface DidacticUnitSyllabusLesson {
    title: string
    contentOutline: string[]
}

export interface DidacticUnitSyllabusChapter {
    title: string
    overview: string
    keyPoints: string[]
    lessons: DidacticUnitSyllabusLesson[]
}

export interface DidacticUnitSyllabus {
    title: string
    overview: string
    learningGoals: string[]
    keywords: string[]
    chapters: DidacticUnitSyllabusChapter[]
}

export interface DidacticUnitModuleLesson {
    title: string
    contentOutline: string[]
}

export interface DidacticUnitModule {
    title: string
    overview: string
    lessons: DidacticUnitModuleLesson[]
}

export interface DidacticUnitReferenceSyllabus {
    topic: string
    title: string
    keywords: string
    description: string
    modules: DidacticUnitModule[]
}

export interface UpdateDidacticUnitSyllabusInput {
    syllabus: DidacticUnitSyllabus
}

function parseNonEmptyString(value: unknown, fieldName: string): string {
    const parsedValue = typeof value === 'string' ? value.trim() : ''

    if (!parsedValue) {
        throw new Error(`${fieldName} is required.`)
    }

    return parsedValue
}

function parseStringArray(value: unknown, fieldName: string): string[] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`${fieldName} must be a non-empty array.`)
    }

    return value.map((item, index) =>
        parseNonEmptyString(item, `${fieldName}[${index}]`)
    )
}

function parseEnumValue<T extends string>(
    value: unknown,
    fieldName: string,
    allowedValues: readonly T[],
    fallback: T
): T {
    const normalized =
        typeof value === 'string' && value.trim() ? value.trim() : fallback

    if (!allowedValues.includes(normalized as T)) {
        throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}.`)
    }

    return normalized as T
}

export function normalizeKeywordList(value: string): string[] {
    return value
        .split(/[,\n;]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
}

function uniqueNonEmpty(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function deriveLearningGoals(syllabus: DidacticUnitReferenceSyllabus): string[] {
    const outlineItems = uniqueNonEmpty(
        syllabus.modules.flatMap((module) =>
            module.lessons.flatMap((lesson) => lesson.contentOutline)
        )
    )

    if (outlineItems.length >= 3) {
        return outlineItems.slice(0, 3)
    }

    const moduleGoals = uniqueNonEmpty(
        syllabus.modules.map((module) => `Understand ${module.title}`)
    )

    return moduleGoals.slice(0, 3)
}

function deriveModuleKeyPoints(module: DidacticUnitModule): string[] {
    const keyPoints = uniqueNonEmpty(
        module.lessons.flatMap((lesson) => lesson.contentOutline)
    )

    if (keyPoints.length >= 3) {
        return keyPoints.slice(0, 3)
    }

    return uniqueNonEmpty(module.lessons.map((lesson) => lesson.title)).slice(0, 3)
}

export function adaptReferenceSyllabusToDidacticUnitSyllabus(
    syllabus: DidacticUnitReferenceSyllabus
): DidacticUnitSyllabus {
    return {
        title: syllabus.title,
        overview: syllabus.description,
        learningGoals: deriveLearningGoals(syllabus),
        keywords: normalizeKeywordList(syllabus.keywords),
        chapters: syllabus.modules.map((module) => ({
            title: module.title,
            overview: module.overview,
            keyPoints: deriveModuleKeyPoints(module),
            lessons: module.lessons.map((lesson) => ({
                title: lesson.title,
                contentOutline: [...lesson.contentOutline],
            })),
        })),
    }
}

export function adaptDidacticUnitSyllabusToReferenceSyllabus(input: {
    topic: string
    syllabus: DidacticUnitSyllabus
}): DidacticUnitReferenceSyllabus {
    return {
        topic: input.topic,
        title: input.syllabus.title,
        keywords: input.syllabus.keywords.join(', '),
        description: input.syllabus.overview,
        modules: input.syllabus.chapters.map((chapter) => ({
            title: chapter.title,
            overview: chapter.overview,
            lessons: chapter.lessons.map((lesson) => ({
                title: lesson.title,
                contentOutline: [...lesson.contentOutline],
            })),
        })),
    }
}

export function parseCreateDidacticUnitInput(body: unknown): CreateDidacticUnitInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as {
        topic?: unknown
        provider?: unknown
        additionalContext?: unknown
        depth?: unknown
        length?: unknown
        level?: unknown
        questionnaireEnabled?: unknown
        folderSelection?: unknown
    }
    const topic = typeof payload.topic === 'string' ? payload.topic.trim() : ''

    if (!topic) {
        throw new Error('Topic is required.')
    }

    return {
        topic,
        provider:
            typeof payload.provider === 'string' && payload.provider.trim()
                ? payload.provider.trim()
                : 'profile-config',
        additionalContext:
            typeof payload.additionalContext === 'string' &&
            payload.additionalContext.trim()
                ? payload.additionalContext.trim()
                : undefined,
        depth: parseEnumValue(
            payload.depth,
            'depth',
            ['basic', 'intermediate', 'technical'],
            'intermediate'
        ),
        length: parseEnumValue(
            payload.length,
            'length',
            ['intro', 'short', 'long', 'textbook'],
            'short'
        ),
        level: parseEnumValue(
            payload.level,
            'level',
            ['beginner', 'intermediate', 'advanced'],
            'beginner'
        ),
        questionnaireEnabled:
            payload.questionnaireEnabled === undefined
                ? true
                : Boolean(payload.questionnaireEnabled),
        folderSelection: parseFolderSelectionInput(payload.folderSelection),
    }
}

export function parseFolderSelectionInput(
    value: unknown
): DidacticUnitFolderSelectionInput {
    if (!value || typeof value !== 'object') {
        return { mode: 'auto' }
    }

    const payload = value as {
        mode?: unknown
        folderId?: unknown
    }

    if (payload.mode !== 'manual' && payload.mode !== 'auto') {
        throw new Error('folderSelection.mode must be either "manual" or "auto".')
    }

    if (payload.mode === 'manual') {
        const folderId =
            typeof payload.folderId === 'string' ? payload.folderId.trim() : ''

        if (!folderId) {
            throw new Error('folderSelection.folderId is required for manual mode.')
        }

        return {
            mode: 'manual',
            folderId,
        }
    }

    return { mode: 'auto' }
}

export function parseUpdateDidacticUnitFolderInput(
    body: unknown
): UpdateDidacticUnitFolderInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { folderSelection?: unknown }

    return {
        folderSelection: parseFolderSelectionInput(payload.folderSelection),
    }
}

export function parseQuestionnaireAnswersInput(
    body: unknown
): DidacticUnitQuestionnaireAnswersInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { answers?: unknown }
    if (!Array.isArray(payload.answers) || payload.answers.length === 0) {
        throw new Error('Answers must be a non-empty array.')
    }

    const answers = payload.answers.map((entry) => {
        if (!entry || typeof entry !== 'object') {
            throw new Error('Each answer must be an object.')
        }

        const answer = entry as { questionId?: unknown; value?: unknown }
        const questionId =
            typeof answer.questionId === 'string' ? answer.questionId.trim() : ''
        const value = typeof answer.value === 'string' ? answer.value.trim() : ''

        if (!questionId) {
            throw new Error('Each answer must include a questionId.')
        }

        if (!value) {
            throw new Error('Each answer must include a non-empty value.')
        }

        return { questionId, value }
    })

    return { answers }
}

function buildLevelOptions(): DidacticUnitQuestionOption[] {
    return [
        { value: 'none', label: 'No prior knowledge' },
        { value: 'basic', label: 'Basic understanding' },
        { value: 'intermediate', label: 'Intermediate experience' },
        { value: 'advanced', label: 'Advanced experience' },
    ]
}

export function buildQuestionnaireForDidacticUnit(topic: string): DidacticUnitQuestionnaire {
    return {
        questions: [
            {
                id: 'topic_knowledge_level',
                prompt: `What is your current knowledge level in ${topic}?`,
                type: 'single_select',
                options: buildLevelOptions(),
            },
            {
                id: 'related_knowledge_level',
                prompt: `How comfortable are you with related concepts that may support learning ${topic}?`,
                type: 'single_select',
                options: buildLevelOptions(),
            },
            {
                id: 'learning_goal',
                prompt: `What do you want to achieve by learning ${topic}?`,
                type: 'long_text',
            },
        ],
    }
}

function parseChapter(value: unknown, index: number): DidacticUnitSyllabusChapter {
    if (!value || typeof value !== 'object') {
        throw new Error(`syllabus.chapters[${index}] must be an object.`)
    }

    const payload = value as {
        title?: unknown
        overview?: unknown
        keyPoints?: unknown
        lessons?: unknown
    }

    return {
        title: parseNonEmptyString(payload.title, `syllabus.chapters[${index}].title`),
        overview: parseNonEmptyString(
            payload.overview,
            `syllabus.chapters[${index}].overview`
        ),
        keyPoints: parseStringArray(
            payload.keyPoints,
            `syllabus.chapters[${index}].keyPoints`
        ),
        lessons: parseLessons(payload.lessons, `syllabus.chapters[${index}].lessons`),
    }
}

function parseLesson(value: unknown, fieldName: string): DidacticUnitSyllabusLesson {
    if (!value || typeof value !== 'object') {
        throw new Error(`${fieldName} must be an object.`)
    }

    const payload = value as {
        title?: unknown
        contentOutline?: unknown
    }

    return {
        title: parseNonEmptyString(payload.title, `${fieldName}.title`),
        contentOutline: parseStringArray(
            payload.contentOutline,
            `${fieldName}.contentOutline`
        ),
    }
}

function parseLessons(value: unknown, fieldName: string): DidacticUnitSyllabusLesson[] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`${fieldName} must be a non-empty array.`)
    }

    return value.map((lesson, index) => parseLesson(lesson, `${fieldName}[${index}]`))
}

export function parseUpdateDidacticUnitSyllabusInput(
    body: unknown
): UpdateDidacticUnitSyllabusInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { syllabus?: unknown }

    if (!payload.syllabus || typeof payload.syllabus !== 'object') {
        throw new Error('Syllabus is required.')
    }

    const syllabusPayload = payload.syllabus as {
        title?: unknown
        overview?: unknown
        learningGoals?: unknown
        keywords?: unknown
        chapters?: unknown
    }

    if (!Array.isArray(syllabusPayload.chapters) || syllabusPayload.chapters.length === 0) {
        throw new Error('syllabus.chapters must be a non-empty array.')
    }

    return {
        syllabus: {
            title: parseNonEmptyString(syllabusPayload.title, 'syllabus.title'),
            overview: parseNonEmptyString(syllabusPayload.overview, 'syllabus.overview'),
            learningGoals: parseStringArray(
                syllabusPayload.learningGoals,
                'syllabus.learningGoals'
            ),
            keywords: parseStringArray(syllabusPayload.keywords, 'syllabus.keywords'),
            chapters: syllabusPayload.chapters.map((chapter, index) =>
                parseChapter(chapter, index)
            ),
        },
    }
}
