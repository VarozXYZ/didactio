export type DashboardSection =
    | 'all-units'
    | 'subscription'
    | 'profile'
    | 'security'
    | 'preferences'
    | 'analytics'

export type DashboardItemKind = 'didacticUnit'

export interface DashboardFolder {
    id: string
    name: string
    icon: string
    color: string
    units: string[]
    unitCount: number
}

export interface DashboardListItem {
    kind: DashboardItemKind
    id: string
    title: string
    subtitle: string
    subject: string
    status: string
    primaryProgressPercent: number
    studyProgressPercent?: number
    chapterCount: number
    lastActivityAt: string
    coverColor: string
    canOpenEditor: boolean
    didacticUnitId?: string
    route: string
}

export type PlanningQuestionType = 'single_select' | 'long_text'

export interface PlanningQuestionOption {
    value: string
    label: string
}

export interface PlanningQuestion {
    id: string
    prompt: string
    type: PlanningQuestionType
    options?: PlanningQuestionOption[]
}

export interface PlanningSyllabusChapter {
    title: string
    overview: string
    keyPoints: string[]
}

export interface PlanningSyllabus {
    title: string
    overview: string
    learningGoals: string[]
    chapters: PlanningSyllabusChapter[]
}

export interface PlanningDetailViewModel {
    id: string
    topic: string
    subject: string
    provider: 'openai' | 'deepseek'
    status: string
    nextAction: string
    progressPercent: number
    lastActivityAt: string
    questionnaire?: {
        questions: PlanningQuestion[]
        answers: Record<string, string>
    }
    syllabusPrompt?: string
    syllabus?: PlanningSyllabus
    didacticUnitId?: string
    handoff?: {
        didacticUnitId: string
        nextRoute: string
    }
}

export type EditorChapterStatus = 'pending' | 'ready' | 'failed'

export interface DidacticUnitEditorChapter {
    chapterIndex: number
    title: string
    status: EditorChapterStatus
    summary: string
    readingTime: string
    content: string | null
    learningGoals: string[]
    keyPoints: string[]
    level: string
    effort: string
    isCompleted: boolean
    completedAt?: string
}

export interface DidacticUnitEditorViewModel {
    id: string
    title: string
    subject: string
    progress: number
    lastEdited: string
    coverColor: string
    status: string
    overview: string
    provider: 'openai' | 'deepseek'
    chapters: DidacticUnitEditorChapter[]
}

export interface DidacticUnitRevisionViewModel {
    id: string
    chapterIndex: number
    source: 'ai_generation' | 'ai_regeneration' | 'manual_edit'
    createdAt: string
    title: string
}
