export type DidacticUnitProvider = string

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
}

export interface DidacticUnitSyllabus {
    title: string
    overview: string
    learningGoals: string[]
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

export function parseCreateDidacticUnitInput(body: unknown): CreateDidacticUnitInput {
    if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object.')
    }

    const payload = body as { topic?: unknown; provider?: unknown }
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

function buildDepthOptions(): DidacticUnitQuestionOption[] {
    return [
        { value: 'basic', label: 'Keep it basic' },
        { value: 'balanced', label: 'Balanced depth' },
        { value: 'advanced', label: 'Go advanced' },
    ]
}

function buildLengthOptions(): DidacticUnitQuestionOption[] {
    return [
        { value: 'short', label: 'Short unit' },
        { value: 'medium', label: 'Medium unit' },
        { value: 'long', label: 'Long unit' },
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
            {
                id: 'preferred_depth',
                prompt: `How advanced should the didactic unit for ${topic} be?`,
                type: 'single_select',
                options: buildDepthOptions(),
            },
            {
                id: 'preferred_length',
                prompt: `How long should the didactic unit for ${topic} be?`,
                type: 'single_select',
                options: buildLengthOptions(),
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
    }
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
            chapters: syllabusPayload.chapters.map((chapter, index) =>
                parseChapter(chapter, index)
            ),
        },
    }
}
