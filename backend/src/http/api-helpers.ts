import express from "express";
import {
  AiConfigValidationError,
  type AiConfig,
  type AiConfigStore,
  type AiModelConfig,
  type AiModelTier,
} from "../ai/config.js";
import {
  AiGatewayConfigurationError,
  type AiService,
  type FolderClassificationResult,
  type SyllabusResult,
} from "../ai/service.js";
import {
  isGenerationQuality,
  legacyTierToGenerationQuality,
  type GenerationQuality,
} from "../credits/generation-costs.js";
import {
  createCanonicalDidacticUnitChapter,
  type HtmlContentBlock,
} from "../didactic-unit/chapter.js";
import { type DidacticUnit } from "../didactic-unit/didactic-unit.js";
import { buildFolderDescription } from "../didactic-unit/http/responses.js";
import {
  type DidacticUnitNote,
  type DidacticUnitNoteAnchor,
} from "../didactic-unit/notes/note.js";
import { ensureDefaultFolders } from "../folders/folder-defaults.js";
import type { Folder, FolderStore } from "../folders/folder-store.js";
import {
  createCompletedSyllabusGenerationRunRecord,
  createFailedSyllabusGenerationRunRecord,
  type GenerationRun,
  type GenerationRunStore,
} from "../generation-runs/generation-run-store.js";
import { type LearningActivityStore } from "../learning-activities/learning-activity-store.js";
import {
  getFlashcardVisibleModuleIndexes,
  type LearningActivity,
} from "../learning-activities/learning-activity.js";
export {
  asAuthenticatedRequest,
  type AuthenticatedRequest,
} from "./authenticated-user.js";

export function parseChapterIndex(value: string): number {
  const chapterIndex = Number.parseInt(value, 10);

  if (!Number.isInteger(chapterIndex) || chapterIndex < 0) {
    throw new Error("moduleIndex must be a non-negative integer.");
  }

  return chapterIndex;
}

export function parseModuleReadProgressInput(body: unknown): {
  readBlockIndex: number;
  readBlockOffset?: number;
  lastVisitedPageIndex?: number;
} {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const payload = body as {
    readBlockIndex?: unknown;
    readBlockOffset?: unknown;
    lastVisitedPageIndex?: unknown;
  };
  const readBlockIndex =
    typeof payload.readBlockIndex === "number" ? payload.readBlockIndex : 0;

  if (
    payload.readBlockIndex !== undefined &&
    (typeof readBlockIndex !== "number" || !Number.isFinite(readBlockIndex))
  ) {
    throw new Error("readBlockIndex must be a finite number.");
  }

  if (readBlockIndex < 0) {
    throw new Error("readBlockIndex must be greater than or equal to 0.");
  }
  if (
    payload.readBlockOffset !== undefined &&
    (typeof payload.readBlockOffset !== "number" ||
      !Number.isFinite(payload.readBlockOffset) ||
      payload.readBlockOffset < 0)
  ) {
    throw new Error("readBlockOffset must be a non-negative number.");
  }

  if (
    payload.lastVisitedPageIndex !== undefined &&
    (typeof payload.lastVisitedPageIndex !== "number" ||
      !Number.isFinite(payload.lastVisitedPageIndex) ||
      !Number.isInteger(payload.lastVisitedPageIndex) ||
      payload.lastVisitedPageIndex < 0)
  ) {
    throw new Error("lastVisitedPageIndex must be a non-negative integer.");
  }

  return {
    readBlockIndex,
    readBlockOffset:
      typeof payload.readBlockOffset === "number"
        ? payload.readBlockOffset
        : undefined,
    lastVisitedPageIndex:
      typeof payload.lastVisitedPageIndex === "number"
        ? payload.lastVisitedPageIndex
        : undefined,
  };
}

export function parseChapterGenerationInstruction(
  body: unknown,
): string | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const payload = body as { instruction?: unknown };
  if (payload.instruction === undefined) {
    return undefined;
  }

  if (typeof payload.instruction !== "string") {
    throw new Error("instruction must be a string.");
  }

  const normalized = payload.instruction.trim();
  return normalized || undefined;
}

export function parseAiModelTier(body: unknown): AiModelTier {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const payload = body as { tier?: unknown; quality?: unknown };
  const quality = legacyTierToGenerationQuality(
    payload.quality ?? payload.tier,
  );

  if (!quality) {
    throw new Error('quality must be either "silver" or "gold".');
  }

  return quality;
}

export function parseGenerationQuality(body: unknown): GenerationQuality {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const payload = body as { quality?: unknown; tier?: unknown };
  const quality = legacyTierToGenerationQuality(
    payload.quality ?? payload.tier,
  );
  if (!isGenerationQuality(quality)) {
    throw new Error('quality must be either "silver" or "gold".');
  }

  return quality;
}

export function parseOptionalSyllabusContext(
  body: unknown,
): string | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const payload = body as { context?: unknown };
  if (payload.context === undefined) {
    return undefined;
  }

  if (typeof payload.context !== "string") {
    throw new Error("context must be a string.");
  }

  const normalized = payload.context.trim();
  return normalized || undefined;
}

export function compareRunsByCreatedAtDesc(
  left: GenerationRun,
  right: GenerationRun,
): number {
  return right.createdAt.localeCompare(left.createdAt);
}

export function isTerminalGenerationRun(run: GenerationRun): boolean {
  return (
    run.status === "completed" ||
    run.status === "failed" ||
    run.status === "payment_failed"
  );
}

export function resolveFolderSelectionForManualMode(
  folderSelection: {
    mode: "manual" | "auto";
    folderId?: string;
  },
  foldersById: Map<string, Folder>,
) {
  if (folderSelection.mode !== "manual") {
    return folderSelection;
  }

  const selectedFolder = folderSelection.folderId
    ? foldersById.get(folderSelection.folderId)
    : null;

  if (!selectedFolder) {
    throw new Error("Selected folder was not found.");
  }

  return {
    mode: "manual" as const,
    folderId: selectedFolder.id,
  };
}

export function resolveFolderIdFromModelName(input: {
  folderName: string | undefined;
  folders: Folder[];
  fallbackFolderId: string;
}): string {
  const normalizedFolderName = input.folderName?.trim().toLowerCase();

  if (!normalizedFolderName) {
    return input.fallbackFolderId;
  }

  return (
    input.folders.find(
      (folder) => folder.name.trim().toLowerCase() === normalizedFolderName,
    )?.id ?? input.fallbackFolderId
  );
}

export async function resolveAutoAssignedFolderSelection(input: {
  didacticUnit: DidacticUnit;
  folderStore: FolderStore;
  aiConfigStore: AiConfigStore;
  aiService: AiService;
  abortSignal?: AbortSignal;
}): Promise<{
  folderId: string;
  result?: FolderClassificationResult;
}> {
  const folders = await ensureDefaultFolders(
    input.folderStore,
    input.didacticUnit.ownerId,
  );
  const generalFolder = folders.find((folder) => folder.slug === "general");

  if (!generalFolder) {
    throw new Error("General folder could not be resolved.");
  }

  try {
    const config = await input.aiConfigStore.get(input.didacticUnit.ownerId);
    const result = await input.aiService.classifyFolder({
      topic: input.didacticUnit.topic,
      additionalContext: input.didacticUnit.additionalContext,
      folders: folders.map((folder) => ({
        name: folder.name,
        description: buildFolderDescription(folder),
      })),
      config,
      tier: "silver",
      abortSignal: input.abortSignal,
    });

    const matchedFolder =
      folders.find(
        (folder) =>
          folder.name.toLowerCase() === result.folderName.trim().toLowerCase(),
      ) ?? generalFolder;

    return {
      folderId: matchedFolder.id,
      result,
    };
  } catch {
    return { folderId: generalFolder.id };
  }
}

export function resolveCompatibilityProvider(
  config: AiConfig,
  requestedProvider: string,
): string {
  return requestedProvider === "profile-config"
    ? config.silver.provider
    : requestedProvider;
}

export function resolveStageConfigError(
  error: unknown,
  fallbackMessage: string,
): { status: number; message: string } {
  if (
    error instanceof AiGatewayConfigurationError ||
    error instanceof AiConfigValidationError
  ) {
    return { status: 500, message: error.message };
  }

  return {
    status: 409,
    message: resolvePublicAiFailureMessage(error, fallbackMessage),
  };
}

export function resolvePublicAiFailureMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (
    message.includes("No object generated") ||
    message.includes("response did not match schema") ||
    message.includes("Syllabus generation returned")
  ) {
    return fallbackMessage;
  }

  return message;
}

export function createAbortSignal(request: express.Request): AbortSignal {
  const controller = new AbortController();
  request.on("close", () => controller.abort());
  return controller.signal;
}

export {
  refundGenerationCredits,
  reserveGenerationCredits,
  sendAuthErrorResponse,
  type CreditReservation,
} from "../credits/generation-reservations.js";

export function getGeneratedChapterOrThrow(
  didacticUnit: DidacticUnit,
  chapterIndex: number,
) {
  const generatedChapter = didacticUnit.generatedChapters?.find(
    (chapter) => chapter.chapterIndex === chapterIndex,
  );

  if (!generatedChapter) {
    throw new Error("Generated didactic unit module not found.");
  }

  return generatedChapter;
}

export function validateNoteAnchorForChapter(input: {
  anchor: DidacticUnitNoteAnchor;
  selectedText: string;
  chapter: ReturnType<typeof getGeneratedChapterOrThrow>;
}): void {
  const startBlock = input.chapter.htmlBlocks.find(
    (block) => block.id === input.anchor.startBlockId,
  );
  const endBlock = input.chapter.htmlBlocks.find(
    (block) => block.id === input.anchor.endBlockId,
  );

  if (!startBlock || !endBlock) {
    throw new Error("Note anchor block was not found in the generated module.");
  }
  if (
    input.anchor.htmlHash &&
    input.anchor.htmlHash !== input.chapter.htmlHash
  ) {
    throw new Error("Note anchor does not match the current module content.");
  }
  if (input.anchor.htmlBlocksVersion !== input.chapter.htmlBlocksVersion) {
    throw new Error(
      "Note anchor does not match the current module block version.",
    );
  }
  if (
    input.anchor.startOffset > startBlock.textLength ||
    input.anchor.endOffset > endBlock.textLength
  ) {
    throw new Error("Note anchor offset is outside the selected module text.");
  }
  if (input.selectedText.trim().length === 0) {
    throw new Error("selectedText is required.");
  }
}

export function updateDidacticUnitNote(
  note: DidacticUnitNote,
  patch: { question?: string; content?: string },
): DidacticUnitNote {
  return {
    ...note,
    question:
      patch.question !== undefined
        ? patch.question.trim() || undefined
        : note.question,
    content: patch.content?.trim() ?? note.content,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveActivitySourceModuleIndexes(input: {
  scope: "current_module" | "cumulative_until_module";
  chapterIndex: number;
}): number[] {
  return input.scope === "current_module"
    ? [input.chapterIndex]
    : Array.from({ length: input.chapterIndex + 1 }, (_, index) => index);
}

export function buildActivityContextModules(input: {
  didacticUnit: DidacticUnit;
  sourceModuleIndexes: number[];
}) {
  return input.sourceModuleIndexes.map((index) => {
    const planned =
      input.didacticUnit.referenceSyllabus?.modules[index] ??
      input.didacticUnit.modules[index] ??
      input.didacticUnit.chapters[index];
    const generated = input.didacticUnit.generatedChapters?.find(
      (chapter) => chapter.chapterIndex === index,
    );

    return {
      index,
      title: planned?.title ?? generated?.title ?? `Module ${index + 1}`,
      overview:
        "overview" in (planned ?? {})
          ? String((planned as { overview?: unknown }).overview ?? "")
          : "",
      html: generated?.html,
      continuitySummary: input.didacticUnit.continuitySummaries?.[index],
    };
  });
}

export function sortPreviousActivitiesForPrompt(input: {
  activities: LearningActivity[];
  chapterIndex: number;
  type: string;
}): LearningActivity[] {
  return [...input.activities].sort((left, right) => {
    const leftScore =
      (left.chapterIndex === input.chapterIndex ? 4 : 0) +
      (left.type === input.type ? 2 : 0);
    const rightScore =
      (right.chapterIndex === input.chapterIndex ? 4 : 0) +
      (right.type === input.type ? 2 : 0);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function uniqueLearningActivitiesById(
  activities: LearningActivity[],
): LearningActivity[] {
  const seen = new Set<string>();
  const unique: LearningActivity[] = [];

  for (const activity of activities) {
    if (seen.has(activity.id)) {
      continue;
    }

    seen.add(activity.id);
    unique.push(activity);
  }

  return unique;
}

export function resolveFlashcardGenerationCount(
  quality: GenerationQuality,
): number {
  return quality === "gold" ? 15 : 5;
}

export function normalizeActivityRecord(
  value: unknown,
): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function normalizeFlashcardText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeFlashcardKey(value: unknown): string {
  return normalizeFlashcardText(value).toLowerCase().replace(/\s+/g, " ");
}

export function normalizeFlashcardCards(
  value: unknown,
): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value
        .map((item) => normalizeActivityRecord(item))
        .filter(
          (card) =>
            normalizeFlashcardText(card.front).length > 0 &&
            normalizeFlashcardText(card.back).length > 0,
        )
    : [];
}

export function normalizeFlashcardModuleSortTimestamps(
  value: unknown,
): Record<string, string> {
  const record = normalizeActivityRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter(
      ([key, timestamp]) =>
        Number.isInteger(Number(key)) &&
        typeof timestamp === "string" &&
        timestamp.trim().length > 0,
    ),
  ) as Record<string, string>;
}

export function prepareGeneratedFlashcardCards(input: {
  cards: unknown;
  existingCards: Array<Record<string, unknown>>;
  count: number;
}): Array<Record<string, unknown>> {
  const existingKeys = new Set(
    input.existingCards.map((card) => normalizeFlashcardKey(card.front)),
  );
  const seenKeys = new Set<string>();

  return normalizeFlashcardCards(input.cards)
    .filter((card) => {
      const key = normalizeFlashcardKey(card.front);
      if (!key || existingKeys.has(key) || seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
      return true;
    })
    .slice(0, input.count)
    .map((card, index) => ({
      ...card,
      id: normalizeFlashcardText(card.id) || `card-${Date.now()}-${index + 1}`,
    }));
}

export async function resolveCanonicalFlashcardActivity(input: {
  learningActivityStore: LearningActivityStore;
  ownerId: string;
  didacticUnitId: string;
  chapterIndex: number;
  sourceModuleIndexes: number[];
  quality: GenerationQuality;
  result: {
    title: string;
    instructions: string;
    content: Record<string, unknown>;
    dedupeSummary: string;
  };
  generationRunId: string;
  activityId: string;
  now: string;
}): Promise<LearningActivity> {
  const count = resolveFlashcardGenerationCount(input.quality);
  const unitActivities = await input.learningActivityStore.listByUnit({
    ownerId: input.ownerId,
    didacticUnitId: input.didacticUnitId,
  });
  const flashcardActivities = unitActivities
    .filter((activity) => activity.type === "flashcards")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const canonical = flashcardActivities[0];
  const duplicateActivities = flashcardActivities.slice(1);
  const duplicateCards = duplicateActivities.flatMap((activity) =>
    normalizeFlashcardCards(activity.content.cards),
  );
  const existingCards = canonical
    ? normalizeFlashcardCards(canonical.content.cards)
    : [];
  const generatedCards = prepareGeneratedFlashcardCards({
    cards: input.result.content.cards,
    existingCards: [...existingCards, ...duplicateCards],
    count,
  });
  const mergedCards = [
    ...existingCards,
    ...duplicateCards.filter((card) => {
      const key = normalizeFlashcardKey(card.front);
      return !existingCards.some(
        (existing) => normalizeFlashcardKey(existing.front) === key,
      );
    }),
    ...generatedCards,
  ];

  if (canonical) {
    const visibleModuleSortTimestamps = {
      ...normalizeFlashcardModuleSortTimestamps(
        canonical.content.visibleModuleSortTimestamps,
      ),
      ...Object.fromEntries(
        duplicateActivities.flatMap((activity) =>
          Object.entries(
            normalizeFlashcardModuleSortTimestamps(
              activity.content.visibleModuleSortTimestamps,
            ),
          ),
        ),
      ),
      [String(input.chapterIndex)]: input.now,
    };
    const visibleModuleIndexes = Array.from(
      new Set([
        ...getFlashcardVisibleModuleIndexes(canonical),
        ...duplicateActivities.flatMap(getFlashcardVisibleModuleIndexes),
        input.chapterIndex,
      ]),
    ).sort((left, right) => left - right);
    const updated: LearningActivity = {
      ...canonical,
      quality: input.quality,
      title: input.result.title || canonical.title,
      instructions: input.result.instructions || canonical.instructions,
      content: {
        ...canonical.content,
        ...input.result.content,
        cards: mergedCards,
        visibleModuleIndexes,
        visibleModuleSortTimestamps,
      },
      dedupeSummary: [canonical.dedupeSummary, input.result.dedupeSummary]
        .filter(Boolean)
        .join(" "),
      sourceModuleIndexes: Array.from(
        new Set([
          ...canonical.sourceModuleIndexes,
          ...input.sourceModuleIndexes,
        ]),
      ).sort((left, right) => left - right),
      feedbackAttemptLimit: Math.max(canonical.feedbackAttemptLimit, 3),
      generationRunId: input.generationRunId,
      updatedAt: input.now,
    };
    await input.learningActivityStore.saveActivity(updated);
    for (const duplicate of duplicateActivities) {
      await input.learningActivityStore.saveActivity({
        ...duplicate,
        content: { ...duplicate.content, archived: true },
        updatedAt: input.now,
      });
    }
    return updated;
  }

  return {
    id: input.activityId,
    ownerId: input.ownerId,
    didacticUnitId: input.didacticUnitId,
    chapterIndex: input.chapterIndex,
    scope: "cumulative_until_module",
    type: "flashcards",
    quality: input.quality,
    title: input.result.title,
    instructions: input.result.instructions,
    content: {
      ...input.result.content,
      cards: generatedCards,
      visibleModuleIndexes: [input.chapterIndex],
      visibleModuleSortTimestamps: {
        [String(input.chapterIndex)]: input.now,
      },
    },
    dedupeSummary: input.result.dedupeSummary,
    sourceModuleIndexes: input.sourceModuleIndexes,
    feedbackAttemptLimit: 3,
    generationRunId: input.generationRunId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function parseAttemptAnswers(body: unknown): unknown {
  if (!body || typeof body !== "object" || !("answers" in body)) {
    throw new Error("Activity attempt answers are required.");
  }

  return (body as { answers: unknown }).answers;
}

const TOP_LEVEL_HTML_BLOCK_TAGS = new Set([
  "h2",
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "blockquote",
  "pre",
  "table",
]);

const VOID_HTML_BLOCK_TAGS = new Set(["hr"]);

export function createHtmlBlockAccumulator(input: {
  chapterId: string;
  onBlock: (block: HtmlContentBlock) => Promise<void>;
}) {
  let buffer = "";
  let cursor = 0;
  let blockStart = -1;
  let activeTag: string | null = null;
  let depth = 0;
  let emittedCount = 0;

  const emitBlock = async (rawBlockHtml: string) => {
    const chapter = createCanonicalDidacticUnitChapter({
      chapterIndex: 0,
      title: "Streaming block",
      rawHtml: rawBlockHtml,
      chapterId: `${input.chapterId}:stream:${emittedCount}`,
    });
    const block = chapter.htmlBlocks[0];
    if (!block) {
      return;
    }
    emittedCount += 1;
    await input.onBlock(block);
  };

  const readTag = (tagStart: number) => {
    const tagEnd = buffer.indexOf(">", tagStart);
    if (tagEnd === -1) {
      return null;
    }

    const rawTag = buffer.slice(tagStart + 1, tagEnd).trim();
    if (!rawTag || rawTag.startsWith("!") || rawTag.startsWith("?")) {
      return { tagEnd, tagName: "", isClosing: false, isSelfClosing: true };
    }

    const isClosing = rawTag.startsWith("/");
    const tagBody = (isClosing ? rawTag.slice(1) : rawTag).trim();
    const tagName = tagBody.split(/\s+/)[0]?.toLowerCase() ?? "";
    const isSelfClosing =
      rawTag.endsWith("/") || VOID_HTML_BLOCK_TAGS.has(tagName);

    return { tagEnd, tagName, isClosing, isSelfClosing };
  };

  return {
    async ingest(delta: string) {
      buffer += delta;

      while (cursor < buffer.length) {
        const tagStart = buffer.indexOf("<", cursor);
        if (tagStart === -1) {
          cursor = buffer.length;
          break;
        }

        const tag = readTag(tagStart);
        if (!tag) {
          break;
        }

        if (!tag.tagName) {
          cursor = tag.tagEnd + 1;
          continue;
        }

        if (activeTag === null) {
          if (
            !tag.isClosing &&
            (TOP_LEVEL_HTML_BLOCK_TAGS.has(tag.tagName) ||
              VOID_HTML_BLOCK_TAGS.has(tag.tagName))
          ) {
            blockStart = tagStart;
            activeTag = tag.tagName;
            depth = tag.isSelfClosing ? 0 : 1;

            if (tag.isSelfClosing) {
              await emitBlock(buffer.slice(blockStart, tag.tagEnd + 1));
              buffer = buffer.slice(tag.tagEnd + 1);
              cursor = 0;
              blockStart = -1;
              activeTag = null;
              continue;
            }
          }

          cursor = tag.tagEnd + 1;
          continue;
        }

        if (!tag.isClosing && !tag.isSelfClosing) {
          depth += 1;
        } else if (tag.isClosing) {
          depth = Math.max(0, depth - 1);
        }

        cursor = tag.tagEnd + 1;

        if (depth === 0 && blockStart !== -1) {
          await emitBlock(buffer.slice(blockStart, tag.tagEnd + 1));
          buffer = buffer.slice(tag.tagEnd + 1);
          cursor = 0;
          blockStart = -1;
          activeTag = null;
        }
      }
    },
  };
}

export async function recordCompletedSyllabusRun(
  generationRunStore: GenerationRunStore,
  didacticUnit: DidacticUnit,
  result: SyllabusResult,
): Promise<void> {
  await generationRunStore.save(
    createCompletedSyllabusGenerationRunRecord({
      didacticUnitId: didacticUnit.id,
      ownerId: didacticUnit.ownerId,
      provider: result.provider,
      model: result.model,
      prompt: result.prompt,
      syllabus: didacticUnit.syllabus!,
      createdAt: didacticUnit.syllabusGeneratedAt ?? new Date().toISOString(),
      telemetry: result.telemetry,
    }),
  );
}

export async function recordFailedSyllabusRun(
  generationRunStore: GenerationRunStore,
  didacticUnit: DidacticUnit,
  prompt: string,
  modelConfig: AiModelConfig,
  error: unknown,
): Promise<void> {
  if (!prompt.trim()) {
    return;
  }

  await generationRunStore.save(
    createFailedSyllabusGenerationRunRecord({
      didacticUnitId: didacticUnit.id,
      ownerId: didacticUnit.ownerId,
      provider: modelConfig.provider,
      model: modelConfig.model,
      prompt,
      error:
        error instanceof Error
          ? error.message
          : "Didactic unit syllabus generation failed.",
      createdAt: new Date().toISOString(),
    }),
  );
}
