export type DidacticUnitProvider = string
export type DidacticUnitDepth = 'basic' | 'intermediate' | 'technical'
export type DidacticUnitLength = 'intro' | 'short' | 'long' | 'textbook'

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
    questionnaireEnabled: boolean
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

export interface DidacticUnitSyllabusChapter {
    title: string
    overview: string
    keyPoints: string[]
    estimatedDurationMinutes: number
    lessons: DidacticUnitSyllabusLesson[]
}

export interface DidacticUnitSyllabusLesson {
    title: string
    contentOutline: string[]
}

export interface DidacticUnitSyllabus {
    title: string
    overview: string
    learningGoals: string[]
    keywords: string[]
    estimatedDurationMinutes: number
    chapters: DidacticUnitSyllabusChapter[]
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
        questionnaireEnabled?: unknown
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
        questionnaireEnabled:
            payload.questionnaireEnabled === undefined
                ? true
                : Boolean(payload.questionnaireEnabled),
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
        estimatedDurationMinutes?: unknown
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
        estimatedDurationMinutes: parsePositiveNumber(
            payload.estimatedDurationMinutes,
            `syllabus.chapters[${index}].estimatedDurationMinutes`
        ),
        lessons: parseLessons(payload.lessons, `syllabus.chapters[${index}].lessons`),
    }
}

function parsePositiveNumber(value: unknown, fieldName: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`${fieldName} must be a positive number.`)
    }

    return Math.round(value)
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
        estimatedDurationMinutes?: unknown
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
            estimatedDurationMinutes: parsePositiveNumber(
                syllabusPayload.estimatedDurationMinutes,
                'syllabus.estimatedDurationMinutes'
            ),
            chapters: syllabusPayload.chapters.map((chapter, index) =>
                parseChapter(chapter, index)
            ),
        },
    }
}
