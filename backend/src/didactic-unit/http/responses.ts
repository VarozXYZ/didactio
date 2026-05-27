import { MODEL_CATALOG } from "../../ai/model-catalog.js";
import { legacyTierToGenerationQuality } from "../../credits/generation-costs.js";
import { ensureDefaultFolders } from "../../folders/folder-defaults.js";
import type { Folder, FolderStore } from "../../folders/folder-store.js";
import type {
  ChapterGenerationRunRecord,
  GenerationRun,
} from "../../generation-runs/generation-run-store.js";
import type { DidacticUnitStore } from "../didactic-unit-store.js";
import type { DidacticUnit } from "../didactic-unit.js";
import { resolveLearningProfile } from "../planning.js";
import { getModuleReadProgressRecord } from "../reading-progress.js";
import {
  summarizeDidacticUnit,
  summarizeDidacticUnitStudyProgress,
} from "../summary.js";
export function buildFolderResponse(folder: Folder) {
  return {
    id: folder.id,
    name: folder.name,
    slug: folder.slug,
    icon: folder.icon,
    color: folder.color,
    kind: folder.kind,
  };
}

export function buildFolderDescription(folder: Folder): string {
  if (folder.slug === "general") {
    return "Use for broad topics, mixed subjects, or units that do not clearly fit a specialized folder.";
  }

  return `Use for units primarily focused on ${folder.name.toLowerCase()}.`;
}

export function resolveFolderOrFallback(
  didacticUnit: Pick<DidacticUnit, "folderId">,
  foldersById: Map<string, Folder>,
): Folder {
  const assignedFolder = foldersById.get(didacticUnit.folderId);
  if (assignedFolder) {
    return assignedFolder;
  }

  const generalFolder = [...foldersById.values()].find(
    (folder) => folder.slug === "general",
  );
  if (generalFolder) {
    return generalFolder;
  }

  throw new Error(
    "No folder metadata was available for the didactic unit response.",
  );
}

export function buildDidacticUnitResponseFromFolders(
  didacticUnit: DidacticUnit,
  foldersById: Map<string, Folder>,
) {
  const folder = resolveFolderOrFallback(didacticUnit, foldersById);

  return {
    id: didacticUnit.id,
    ownerId: didacticUnit.ownerId,
    topic: didacticUnit.topic,
    title: didacticUnit.title,
    folderId: folder.id,
    folderAssignmentMode: didacticUnit.folderAssignmentMode,
    folder: buildFolderResponse(folder),
    presentationTheme: didacticUnit.presentationTheme ?? null,
    provider: didacticUnit.provider,
    status: didacticUnit.status,
    nextAction: didacticUnit.nextAction,
    createdAt: didacticUnit.createdAt,
    updatedAt: didacticUnit.updatedAt,
    moderatedAt: didacticUnit.moderatedAt,
    moderationError: didacticUnit.moderationError,
    moderationAttempts: didacticUnit.moderationAttempts,
    questionnaireGeneratedAt: didacticUnit.questionnaireGeneratedAt,
    questionnaireAnsweredAt: didacticUnit.questionnaireAnsweredAt,
    improvedTopicBrief: didacticUnit.improvedTopicBrief,
    reasoningNotes: didacticUnit.reasoningNotes,
    additionalContext: didacticUnit.additionalContext,
    depth: didacticUnit.depth,
    length: didacticUnit.length,
    level: didacticUnit.level,
    learningProfile:
      didacticUnit.learningProfile ??
      resolveLearningProfile({
        level: didacticUnit.level,
        depth: didacticUnit.depth,
      }).learningProfile,
    generationTier: didacticUnit.generationTier,
    generationQuality:
      didacticUnit.generationQuality ??
      legacyTierToGenerationQuality(didacticUnit.generationTier),
    unitGenerationPaidAt: didacticUnit.unitGenerationPaidAt,
    unitGenerationCreditTransactionId:
      didacticUnit.unitGenerationCreditTransactionId,
    questionnaireEnabled: didacticUnit.questionnaireEnabled,
    questionnaire: didacticUnit.questionnaire,
    questionnaireAnswers: didacticUnit.questionnaireAnswers,
    syllabusPrompt: didacticUnit.syllabusPrompt,
    syllabusPromptGeneratedAt: didacticUnit.syllabusPromptGeneratedAt,
    syllabus: didacticUnit.syllabus,
    syllabusGeneratedAt: didacticUnit.syllabusGeneratedAt,
    syllabusUpdatedAt: didacticUnit.syllabusUpdatedAt,
    syllabusApprovedAt: didacticUnit.syllabusApprovedAt,
    overview: didacticUnit.overview,
    learningGoals: didacticUnit.learningGoals,
    keywords: didacticUnit.keywords,
    chapters: didacticUnit.chapters.map((chapter) => ({
      title: chapter.title,
      overview: chapter.overview,
      keyPoints: [...chapter.keyPoints],
      lessons: chapter.lessons.map((lesson) => ({
        title: lesson.title,
        contentOutline: [...lesson.contentOutline],
      })),
    })),
    studyProgress: summarizeDidacticUnitStudyProgress(didacticUnit),
  };
}

export async function loadFoldersById(
  folderStore: FolderStore,
  ownerId: string,
): Promise<Map<string, Folder>> {
  const folders = await ensureDefaultFolders(folderStore, ownerId);
  return new Map(folders.map((folder) => [folder.id, folder] as const));
}

export async function buildDidacticUnitResponse(
  didacticUnit: DidacticUnit,
  folderStore: FolderStore,
) {
  return buildDidacticUnitResponseFromFolders(
    didacticUnit,
    await loadFoldersById(folderStore, didacticUnit.ownerId),
  );
}

export async function buildDidacticUnitSummaryResponses(
  didacticUnits: DidacticUnit[],
  folderStore: FolderStore,
  ownerId: string,
  generationRuns: GenerationRun[] = [],
) {
  const foldersById = await loadFoldersById(folderStore, ownerId);
  const runsByUnitId = generationRuns.reduce<Map<string, GenerationRun[]>>(
    (map, run) => {
      const runs = map.get(run.didacticUnitId) ?? [];
      runs.push(run);
      map.set(run.didacticUnitId, runs);
      return map;
    },
    new Map(),
  );

  return didacticUnits.map((didacticUnit) => {
    const summary = summarizeDidacticUnit(didacticUnit);
    const folder = resolveFolderOrFallback(didacticUnit, foldersById);
    const modelRun = resolveDidacticUnitModelRun(
      runsByUnitId.get(didacticUnit.id) ?? [],
    );
    const modelAttribution = modelRun ?? didacticUnit.modelAttribution;

    return {
      ...summary,
      folder: buildFolderResponse(folder),
      modelUsed: modelAttribution
        ? {
            provider: modelAttribution.provider,
            model: modelAttribution.model,
            label: getModelDisplayName(
              modelAttribution.provider,
              modelAttribution.model,
            ),
          }
        : null,
    };
  });
}

export function resolveDidacticUnitModelRun(
  runs: GenerationRun[],
): GenerationRun | null {
  const relevantRuns = runs
    .filter(
      (run) =>
        run.status === "completed" &&
        (run.stage === "chapter" || run.stage === "syllabus"),
    )
    .sort((left, right) => {
      const leftTime = left.updatedAt ?? left.createdAt;
      const rightTime = right.updatedAt ?? right.createdAt;
      return rightTime.localeCompare(leftTime);
    });

  return (
    relevantRuns.find((run) => run.stage === "chapter") ??
    relevantRuns.find((run) => run.stage === "syllabus") ??
    null
  );
}

export async function listFoldersWithUnitCounts(
  folderStore: FolderStore,
  didacticUnitStore: DidacticUnitStore,
  ownerId: string,
) {
  const folders = await ensureDefaultFolders(folderStore, ownerId);
  const didacticUnits = await didacticUnitStore.listByOwner(ownerId);
  const unitCounts = didacticUnits.reduce<Map<string, number>>(
    (counts, didacticUnit) => {
      counts.set(
        didacticUnit.folderId,
        (counts.get(didacticUnit.folderId) ?? 0) + 1,
      );
      return counts;
    },
    new Map(),
  );

  return folders.map((folder) => ({
    ...buildFolderResponse(folder),
    unitCount: unitCounts.get(folder.id) ?? 0,
  }));
}

export function getModelDisplayName(provider: string, model: string): string {
  const modelId = `${provider}/${model}`;
  const catalogEntry = [...MODEL_CATALOG.silver, ...MODEL_CATALOG.gold].find(
    (entry) => entry.id === modelId,
  );

  return catalogEntry?.label ?? modelId;
}

export function resolveDidacticUnitChapterState(input: {
  didacticUnit: DidacticUnit;
  chapterIndex: number;
  chapterRuns: ChapterGenerationRunRecord[];
}): "pending" | "ready" | "failed" {
  if (
    input.didacticUnit.generatedChapters?.some(
      (chapter) => chapter.chapterIndex === input.chapterIndex,
    )
  ) {
    return "ready";
  }

  const latestRun = input.chapterRuns
    .filter((run) => run.chapterIndex === input.chapterIndex)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  return latestRun?.status === "failed" ? "failed" : "pending";
}

export function buildDidacticUnitModuleDetailResponse(input: {
  didacticUnit: DidacticUnit;
  moduleIndex: number;
  chapterRuns: ChapterGenerationRunRecord[];
}) {
  const plannedChapter = input.didacticUnit.chapters[input.moduleIndex];
  if (!plannedChapter) {
    return null;
  }

  const generatedChapter = input.didacticUnit.generatedChapters?.find(
    (chapter) => chapter.chapterIndex === input.moduleIndex,
  );
  const readProgress = getModuleReadProgressRecord(
    input.didacticUnit,
    input.moduleIndex,
  );
  const isCompleted = readProgress?.chapterCompleted ?? false;
  const completedAt = isCompleted ? readProgress?.lastReadAt : undefined;

  return {
    chapterIndex: input.moduleIndex,
    title: generatedChapter?.title ?? plannedChapter.title,
    planningOverview: plannedChapter.overview,
    html: generatedChapter?.html ?? null,
    htmlHash: generatedChapter?.htmlHash,
    htmlBlocks: generatedChapter?.htmlBlocks ?? [],
    htmlBlocksVersion: generatedChapter?.htmlBlocksVersion ?? 0,
    generatedAt: generatedChapter?.generatedAt,
    updatedAt: generatedChapter?.updatedAt,
    state: resolveDidacticUnitChapterState({
      didacticUnit: input.didacticUnit,
      chapterIndex: input.moduleIndex,
      chapterRuns: input.chapterRuns,
    }),
    readBlockIndex: readProgress?.furthestReadBlockIndex ?? 0,
    readBlockOffset: readProgress?.furthestReadBlockOffset,
    readBlocksVersion: readProgress?.furthestReadBlocksVersion ?? 0,
    totalBlocks: generatedChapter?.htmlBlocks.length ?? 0,
    isCompleted,
    completedAt,
    lastVisitedPageIndex: readProgress?.lastVisitedPageIndex,
  };
}
