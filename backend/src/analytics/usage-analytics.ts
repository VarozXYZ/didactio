import type { DidacticUnitStore } from "../didactic-unit/didactic-unit-store.js";
import type { DidacticUnit } from "../didactic-unit/didactic-unit.js";
import {
  buildFolderResponse,
  getModelDisplayName,
  loadFoldersById,
  resolveFolderOrFallback,
} from "../didactic-unit/http/responses.js";
import { summarizeDidacticUnit } from "../didactic-unit/summary.js";
import type { Folder, FolderStore } from "../folders/folder-store.js";
import type {
  GenerationRun,
  GenerationRunStore,
} from "../generation-runs/generation-run-store.js";

export type UsageAnalyticsPeriod = "7d" | "30d" | "6m" | "12m";

interface UsageAnalyticsBucket {
  key: string;
  label: string;
  count: number;
}
export function parseUsageAnalyticsPeriod(
  value: unknown,
): UsageAnalyticsPeriod {
  if (
    value === undefined ||
    value === "7d" ||
    value === "30d" ||
    value === "6m" ||
    value === "12m"
  ) {
    return value ?? "30d";
  }

  throw new Error("Invalid analytics period.");
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en", {
    month: "short",
    timeZone: "UTC",
  });
}

export function addUtcDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

export function addUtcMonths(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + amount);
  return next;
}

export function buildEmptyAnalyticsBuckets(
  period: UsageAnalyticsPeriod,
  now = new Date(),
): UsageAnalyticsBucket[] {
  if (period === "7d" || period === "30d") {
    const dayCount = period === "7d" ? 7 : 30;
    const firstDay = addUtcDays(startOfUtcDay(now), -(dayCount - 1));
    return Array.from({ length: dayCount }, (_ignored, index) => {
      const bucketDate = addUtcDays(firstDay, index);
      return {
        key: formatDayKey(bucketDate),
        label: formatDayLabel(bucketDate),
        count: 0,
      };
    });
  }

  const monthCount = period === "6m" ? 6 : 12;
  const firstMonth = addUtcMonths(startOfUtcMonth(now), -(monthCount - 1));
  return Array.from({ length: monthCount }, (_ignored, index) => {
    const bucketDate = addUtcMonths(firstMonth, index);
    return {
      key: formatMonthKey(bucketDate),
      label: formatMonthLabel(bucketDate),
      count: 0,
    };
  });
}

export function getRunActivityDate(run: GenerationRun): Date {
  return new Date(
    (run.stage === "chapter" ? run.completedAt : undefined) ??
      run.updatedAt ??
      run.createdAt,
  );
}

export function getBucketKeyForDate(
  date: Date,
  period: UsageAnalyticsPeriod,
): string {
  return period === "7d" || period === "30d"
    ? formatDayKey(startOfUtcDay(date))
    : formatMonthKey(startOfUtcMonth(date));
}

export function buildFavoriteModel(completedRuns: GenerationRun[]) {
  const counts = completedRuns.reduce<
    Map<string, { provider: string; model: string; count: number }>
  >((accumulator, run) => {
    const key = `${run.provider}/${run.model}`;
    const current = accumulator.get(key);
    accumulator.set(key, {
      provider: run.provider,
      model: run.model,
      count: (current?.count ?? 0) + 1,
    });
    return accumulator;
  }, new Map());

  const favorite = [...counts.values()].sort(
    (left, right) =>
      right.count - left.count ||
      getModelDisplayName(left.provider, left.model).localeCompare(
        getModelDisplayName(right.provider, right.model),
      ),
  )[0];

  if (!favorite) {
    return null;
  }

  return {
    provider: favorite.provider,
    model: favorite.model,
    label: getModelDisplayName(favorite.provider, favorite.model),
    count: favorite.count,
  };
}

export function buildFavoriteTopic(
  didacticUnits: DidacticUnit[],
  foldersById: Map<string, Folder>,
) {
  const counts = didacticUnits.reduce<Map<string, number>>(
    (accumulator, didacticUnit) => {
      const folder = resolveFolderOrFallback(didacticUnit, foldersById);
      accumulator.set(folder.id, (accumulator.get(folder.id) ?? 0) + 1);
      return accumulator;
    },
    new Map(),
  );

  const favorite = [...counts.entries()]
    .map(([folderId, count]) => ({ folder: foldersById.get(folderId), count }))
    .filter(
      (entry): entry is { folder: Folder; count: number } =>
        entry.folder !== undefined,
    )
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.folder.name.localeCompare(right.folder.name),
    )[0];

  if (!favorite) {
    return null;
  }

  return {
    ...buildFolderResponse(favorite.folder),
    unitCount: favorite.count,
  };
}

export async function buildUsageAnalytics(input: {
  ownerId: string;
  period: UsageAnalyticsPeriod;
  didacticUnitStore: DidacticUnitStore;
  folderStore: FolderStore;
  generationRunStore: GenerationRunStore;
}) {
  const [didacticUnits, foldersById, generationRuns] = await Promise.all([
    input.didacticUnitStore.listByOwner(input.ownerId),
    loadFoldersById(input.folderStore, input.ownerId),
    input.generationRunStore.listByOwner(input.ownerId),
  ]);

  const unitSummaries = didacticUnits.map((didacticUnit) =>
    summarizeDidacticUnit(didacticUnit),
  );
  const readBlockCount = unitSummaries.reduce(
    (total, summary) => total + summary.readBlockCount,
    0,
  );
  const totalBlockCount = unitSummaries.reduce(
    (total, summary) => total + summary.totalBlockCount,
    0,
  );
  const completedRuns = generationRuns.filter(
    (run) => run.status === "completed",
  );
  const buckets = buildEmptyAnalyticsBuckets(input.period);
  const bucketCounts = new Map(
    buckets.map((bucket) => [bucket.key, bucket.count] as const),
  );

  for (const run of completedRuns) {
    const key = getBucketKeyForDate(getRunActivityDate(run), input.period);
    if (bucketCounts.has(key)) {
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }
  }

  return {
    period: input.period,
    unitsCreated: didacticUnits.length,
    aiGenerations: completedRuns.length,
    completionRate:
      totalBlockCount === 0
        ? 0
        : Math.round((readBlockCount / totalBlockCount) * 100),
    readBlockCount,
    totalBlockCount,
    favoriteModel: buildFavoriteModel(completedRuns),
    favoriteTopic: buildFavoriteTopic(didacticUnits, foldersById),
    chart: buckets.map((bucket) => ({
      ...bucket,
      count: bucketCounts.get(bucket.key) ?? 0,
    })),
  };
}
