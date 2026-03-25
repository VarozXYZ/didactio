import type {
    BackendChapterPresentationSettings,
    BackendDidacticUnitChapterDetail,
    BackendDidacticUnitChapterRevision,
    BackendDidacticUnitChapterSummary,
    BackendDidacticUnitDetail,
    BackendDidacticUnitSummary,
} from './api/dashboardApi'
import type {
    ChapterPresentationSettings,
    DashboardFolder,
    DashboardListItem,
    DidacticUnitEditorChapter,
    DidacticUnitEditorViewModel,
    DidacticUnitRevisionViewModel,
    PlanningDetailViewModel,
} from './types'
import {
    deriveEffortFromReadingTime,
    deriveSubjectFromTopic,
    estimateReadingTimeFromText,
    formatRelativeTimestamp,
} from './utils/topicMetadata'
import { markdownToPlainText, normalizeStoredMarkdown } from './utils/markdown'
import { getSubjectStyle } from './utils/subjectStyles'

function resolveDisplayStatus(status: string): string {
    switch (status) {
        case 'submitted':
        case 'moderation_completed':
        case 'questionnaire_ready':
        case 'questionnaire_answered':
        case 'syllabus_prompt_ready':
        case 'syllabus_ready':
            return 'generating'
        case 'syllabus_approved':
        case 'ready_for_content_generation':
        case 'content_generation_in_progress':
        case 'content_generation_completed':
            return 'ready'
        default:
            return 'failed'
    }
}

function resolvePlanningProgressPercent(status: BackendDidacticUnitDetail['status']): number {
    switch (status) {
        case 'submitted':
            return 0
        case 'moderation_completed':
            return 17
        case 'questionnaire_ready':
            return 33
        case 'questionnaire_answered':
            return 50
        case 'syllabus_prompt_ready':
            return 67
        case 'syllabus_ready':
            return 83
        case 'syllabus_approved':
        case 'ready_for_content_generation':
        case 'content_generation_in_progress':
        case 'content_generation_completed':
            return 100
        default:
            return 0
    }
}

function resolveActivityDate(value: string | undefined, fallback: string): string {
    return value?.trim() ? value : fallback
}

function buildCoverColor(subject: string): string {
    return getSubjectStyle(subject).accentColor
}

function resolvePresentationSettings(
    settings?: BackendChapterPresentationSettings
): ChapterPresentationSettings {
    return {
        paragraphFontFamily: settings?.paragraphFontFamily ?? 'sans',
        paragraphFontSize: settings?.paragraphFontSize ?? '16px',
        paragraphAlign: settings?.paragraphAlign ?? 'left',
    }
}

export function adaptDidacticUnitSummaryToDashboardItem(
    summary: BackendDidacticUnitSummary
): DashboardListItem {
    const subject = deriveSubjectFromTopic(summary.topic)
    const activityDate = resolveActivityDate(summary.lastActivityAt, summary.createdAt)
    const canOpenEditor =
        summary.status === 'content_generation_in_progress' ||
        summary.status === 'content_generation_completed'

    return {
        kind: 'didacticUnit',
        id: summary.id,
        title: summary.title,
        subtitle: summary.topic,
        subject,
        status: resolveDisplayStatus(summary.status),
        primaryProgressPercent: canOpenEditor
            ? summary.studyProgressPercent
            : summary.progressPercent,
        studyProgressPercent: summary.studyProgressPercent,
        chapterCount: summary.chapterCount,
        lastActivityAt: formatRelativeTimestamp(activityDate),
        coverColor: buildCoverColor(subject),
        canOpenEditor,
        didacticUnitId: summary.id,
        route: canOpenEditor ? `/dashboard/unit/${summary.id}` : '/dashboard',
    }
}

export function mergeDashboardItems(input: {
    didacticUnits: BackendDidacticUnitSummary[]
}): DashboardListItem[] {
    return input.didacticUnits
        .map((summary) => ({
            item: adaptDidacticUnitSummaryToDashboardItem(summary),
            sortKey: resolveActivityDate(summary.lastActivityAt, summary.createdAt),
        }))
        .sort((left, right) => right.sortKey.localeCompare(left.sortKey))
        .map(({ item }) => item)
}

export function buildDashboardFolders(items: DashboardListItem[]): DashboardFolder[] {
    return [
        {
            id: 'general',
            name: 'General',
            icon: '📚',
            color: '#4ADE80',
            units: items.map((item) => item.id),
            unitCount: items.length,
        },
        {
            id: 'math-units',
            name: 'Math Units',
            icon: '📐',
            color: '#4ADE80',
            units: [],
            unitCount: 0,
        },
        {
            id: 'science-curriculum',
            name: 'Science Curriculum',
            icon: '🔬',
            color: '#3B82F6',
            units: [],
            unitCount: 0,
        },
        {
            id: 'history-lessons',
            name: 'History Lessons',
            icon: '📜',
            color: '#F59E0B',
            units: [],
            unitCount: 0,
        },
    ]
}

export function adaptDidacticUnitPlanning(detail: BackendDidacticUnitDetail): PlanningDetailViewModel {
    const subject = deriveSubjectFromTopic(detail.topic)
    const answers = Object.fromEntries(
        (detail.questionnaireAnswers ?? []).map((answer) => [answer.questionId, answer.value])
    )

    return {
        id: detail.id,
        topic: detail.topic,
        subject,
        provider: detail.provider,
        status: detail.status,
        nextAction: detail.nextAction,
        progressPercent: resolvePlanningProgressPercent(detail.status),
        lastActivityAt: formatRelativeTimestamp(detail.updatedAt),
        questionnaire: detail.questionnaire
            ? {
                  questions: detail.questionnaire.questions,
                  answers,
              }
            : undefined,
        syllabusPrompt: detail.syllabusPrompt,
        syllabus: detail.syllabus,
        didacticUnitId: detail.id,
    }
}

function buildEditorChapter(
    unit: BackendDidacticUnitDetail,
    summary: BackendDidacticUnitChapterSummary,
    detail: BackendDidacticUnitChapterDetail | undefined
): DidacticUnitEditorChapter {
    const content = normalizeStoredMarkdown(detail?.content ?? '')
    const readingTime = estimateReadingTimeFromText(markdownToPlainText(content))

    return {
        chapterIndex: summary.chapterIndex,
        title: detail?.title ?? summary.title,
        status: summary.state,
        summary: detail?.overview ?? summary.overview,
        readingTime,
        content,
        learningGoals: [...unit.learningGoals],
        keyPoints: detail?.keyTakeaways?.length
            ? [...detail.keyTakeaways]
            : [...unit.chapters[summary.chapterIndex].keyPoints],
        level: unit.provider === 'profile-config' ? 'Configured' : 'Adaptive',
        effort: deriveEffortFromReadingTime(readingTime),
        isCompleted: detail?.isCompleted ?? summary.isCompleted,
        completedAt: detail?.completedAt ?? summary.completedAt,
        presentationSettings: resolvePresentationSettings(detail?.presentationSettings),
    }
}

export function adaptDidacticUnitEditor(input: {
    unit: BackendDidacticUnitDetail
    chapterSummaries: BackendDidacticUnitChapterSummary[]
    chapterDetails: Map<number, BackendDidacticUnitChapterDetail>
}): DidacticUnitEditorViewModel {
    const subject = deriveSubjectFromTopic(input.unit.topic)

    return {
        id: input.unit.id,
        title: input.unit.title,
        subject,
        progress: input.unit.studyProgress.studyProgressPercent,
        lastEdited: formatRelativeTimestamp(input.unit.updatedAt),
        coverColor: buildCoverColor(subject),
        status: resolveDisplayStatus(input.unit.status),
        overview: input.unit.overview,
        provider: input.unit.provider,
        chapters: input.chapterSummaries.map((summary) =>
            buildEditorChapter(input.unit, summary, input.chapterDetails.get(summary.chapterIndex))
        ),
    }
}

export function adaptDidacticUnitRevisions(
    revisions: BackendDidacticUnitChapterRevision[]
): DidacticUnitRevisionViewModel[] {
    return revisions.map((revision) => ({
        id: revision.id,
        chapterIndex: revision.chapterIndex,
        source: revision.source,
        createdAt: formatRelativeTimestamp(revision.createdAt),
        title: revision.chapter.title,
        chapter: {
            title: revision.chapter.title,
            overview: revision.chapter.overview,
            content: normalizeStoredMarkdown(revision.chapter.content),
            keyTakeaways: [...revision.chapter.keyTakeaways],
            presentationSettings: resolvePresentationSettings(
                revision.chapter.presentationSettings
            ),
        },
    }))
}
