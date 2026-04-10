import type {
    BackendChapterPresentationSettings,
    BackendDidacticUnitChapterDetail,
    BackendDidacticUnitChapterRevision,
    BackendDidacticUnitChapterSummary,
    BackendDidacticUnitDetail,
    BackendDidacticUnitSummary,
    BackendFolder,
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
    estimateReadingTimeFromText,
    formatRelativeTimestamp,
} from './utils/topicMetadata'
import { markdownToPlainText, normalizeStoredMarkdown } from './utils/markdown'

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

function resolvePresentationSettings(
    settings?: BackendChapterPresentationSettings
): ChapterPresentationSettings {
    return {
        paragraphFontFamily: settings?.paragraphFontFamily ?? 'sans',
        paragraphFontSize: settings?.paragraphFontSize ?? '16px',
        paragraphAlign: settings?.paragraphAlign ?? 'left',
    }
}

export function adaptFolderSummary(folder: Omit<BackendFolder, 'unitCount'>) {
    return {
        id: folder.id,
        name: folder.name,
        slug: folder.slug,
        icon: folder.icon,
        color: folder.color,
        kind: folder.kind,
    } as const
}

export function adaptDidacticUnitSummaryToDashboardItem(
    summary: BackendDidacticUnitSummary
): DashboardListItem {
    const activityDate = resolveActivityDate(summary.lastActivityAt, summary.createdAt)
    const canOpenEditor =
        summary.status === 'syllabus_approved' ||
        summary.status === 'ready_for_content_generation' ||
        summary.status === 'content_generation_in_progress' ||
        summary.status === 'content_generation_completed'

    return {
        kind: 'didacticUnit',
        id: summary.id,
        title: summary.title,
        subtitle: summary.topic,
        folder: adaptFolderSummary(summary.folder),
        status: resolveDisplayStatus(summary.status),
        primaryProgressPercent: canOpenEditor
            ? summary.studyProgressPercent
            : summary.progressPercent,
        studyProgressPercent: summary.studyProgressPercent,
        chapterCount: summary.moduleCount,
        lastActivityAt: formatRelativeTimestamp(activityDate),
        coverColor: summary.folder.color,
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

export function buildDashboardFolders(
    folders: BackendFolder[],
    items: DashboardListItem[]
): DashboardFolder[] {
    return folders
        .map((folder) => {
            const units = items
                .filter((item) => item.folder.id === folder.id)
                .map((item) => item.id)

            return {
                id: folder.id,
                name: folder.name,
                slug: folder.slug,
                icon: folder.icon,
                color: folder.color,
                kind: folder.kind,
                units,
                unitCount: units.length,
            }
        })
        .filter((folder) => folder.unitCount > 0)
}

export function adaptDidacticUnitPlanning(detail: BackendDidacticUnitDetail): PlanningDetailViewModel {
    const answers = Object.fromEntries(
        (detail.questionnaireAnswers ?? []).map((answer) => [answer.questionId, answer.value])
    )

    return {
        id: detail.id,
        topic: detail.topic,
        folder: adaptFolderSummary(detail.folder),
        provider: detail.provider,
        status: detail.status,
        nextAction: detail.nextAction,
        progressPercent: resolvePlanningProgressPercent(detail.status),
        lastActivityAt: formatRelativeTimestamp(detail.updatedAt),
        additionalContext: detail.additionalContext,
        improvedTopicBrief: detail.improvedTopicBrief,
        reasoningNotes: detail.reasoningNotes,
        level: detail.level,
        depth: detail.depth,
        length: detail.length,
        questionnaireEnabled: detail.questionnaireEnabled,
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
        summary: detail?.planningOverview ?? summary.overview,
        readingTime,
        content,
        learningGoals: [...unit.learningGoals],
        keyPoints: [...unit.chapters[summary.chapterIndex].keyPoints],
        level: unit.level,
        effort: deriveEffortFromReadingTime(readingTime),
        isCompleted: detail?.isCompleted ?? summary.isCompleted,
        completedAt: detail?.completedAt ?? summary.completedAt,
        readCharacterCount: detail?.readCharacterCount ?? summary.readCharacterCount,
        totalCharacterCount: detail?.totalCharacterCount ?? summary.totalCharacterCount,
        presentationSettings: resolvePresentationSettings(detail?.presentationSettings),
    }
}

export function adaptDidacticUnitEditor(input: {
    unit: BackendDidacticUnitDetail
    chapterSummaries: BackendDidacticUnitChapterSummary[]
    chapterDetails: Map<number, BackendDidacticUnitChapterDetail>
}): DidacticUnitEditorViewModel {
    return {
        id: input.unit.id,
        title: input.unit.title,
        folder: adaptFolderSummary(input.unit.folder),
        progress: input.unit.studyProgress.studyProgressPercent,
        lastEdited: formatRelativeTimestamp(input.unit.updatedAt),
        coverColor: input.unit.folder.color,
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
            content: normalizeStoredMarkdown(revision.chapter.content),
            presentationSettings: resolvePresentationSettings(
                revision.chapter.presentationSettings
            ),
        },
    }))
}
