export type UnitStatus = 'ready' | 'generating' | 'failed'

export type DashboardSection =
    | 'all-units'
    | 'subscription'
    | 'profile'
    | 'security'
    | 'preferences'
    | 'analytics'

export interface DashboardFolder {
    id: number
    name: string
    icon: string
    color: string
    unitCount: number
    units: number[]
}

export interface UnitSummary {
    id: number
    editorUnitId?: string
    canOpenEditor?: boolean
    title: string
    subject: string
    chapters: number
    progress: number
    lastModified: string
    status: UnitStatus
    level: string
    readingTime: string
    coverColor: string
}

export interface UnitChapter {
    id: string
    title: string
    status: UnitStatus
    summary: string
    readingTime: string
    content: string | null
    learningGoals: string[]
    keyPoints: string[]
    level: string
    effort: string
}

export interface DetailedUnit {
    id: string
    listingId: number
    title: string
    subject: string
    progress: number
    lastEdited: string
    coverColor: string
    status: UnitStatus
    level: string
    readingTime: string
    chapters: UnitChapter[]
}
