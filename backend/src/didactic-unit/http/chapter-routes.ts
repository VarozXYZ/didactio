import express from "express";
import { AuthError } from "../../auth/core/errors.js";
import {
  legacyTierToGenerationQuality,
  resolveModuleRegenerationCost,
} from "../../credits/generation-costs.js";
import {
  applyGeneratedDidacticUnitChapter,
  hasGeneratedDidacticUnitChapter,
} from "../../didactic-unit/chapter-generation.js";
import { listDidacticUnitChapters } from "../../didactic-unit/chapter-listing.js";
import { parseUpdateDidacticUnitChapterInput } from "../../didactic-unit/chapter.js";
import { completeDidacticUnitChapter } from "../../didactic-unit/complete-didactic-unit-chapter.js";
import { adaptDidacticUnitSyllabusToReferenceSyllabus } from "../../didactic-unit/planning.js";
import {
  resetDidacticUnitModuleReadProgress,
  updateDidacticUnitModuleReadProgress,
} from "../../didactic-unit/reading-progress.js";
import { summarizeDidacticUnitStudyProgress } from "../../didactic-unit/summary.js";
import { updateDidacticUnitChapter } from "../../didactic-unit/update-didactic-unit-chapter.js";
import {
  createQueuedChapterGenerationRunRecord,
  type ChapterGenerationRunRecord,
} from "../../generation-runs/generation-run-store.js";

import {
  compareRunsByCreatedAtDesc,
  createHtmlBlockAccumulator,
  parseChapterGenerationInstruction,
  parseChapterIndex,
  parseModuleReadProgressInput,
} from "../../http/api-helpers.js";
import {
  refundGenerationCredits,
  reserveGenerationCredits,
  sendAuthErrorResponse,
  type CreditReservation,
} from "../../credits/generation-reservations.js";
import { asAuthenticatedRequest } from "../../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../../http/route-dependencies.js";
import {
  buildDidacticUnitModuleDetailResponse,
  buildDidacticUnitResponse,
  resolveDidacticUnitChapterState,
} from "./responses.js";

export function createChapterRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    | "didacticUnitStore"
    | "folderStore"
    | "generationRunStore"
    | "aiConfigStore"
    | "aiService"
    | "authService"
    | "activeGenerationControllers"
  >,
): express.Router {
  const {
    didacticUnitStore,
    folderStore,
    generationRunStore,
    aiConfigStore,
    aiService,
    authService,
    activeGenerationControllers,
  } = dependencies;
  const router = express.Router();

  router.get(
    ["/didactic-unit/:id/chapters", "/didactic-unit/:id/modules"],
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      const chapterRuns = (
        await generationRunStore.listByDidacticUnit(
          authenticatedRequest.currentUser.id,
          didacticUnit.id,
        )
      ).filter(
        (run): run is ChapterGenerationRunRecord => run.stage === "chapter",
      );

      response.json({
        chapters: listDidacticUnitChapters(didacticUnit).map((chapter) => ({
          ...chapter,
          state: resolveDidacticUnitChapterState({
            didacticUnit,
            chapterIndex: chapter.chapterIndex,
            chapterRuns,
          }),
        })),
      });
    },
  );

  router.get(
    [
      "/didactic-unit/:id/chapters/:chapterIndex",
      "/didactic-unit/:id/modules/:chapterIndex",
    ],
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let chapterIndex;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module lookup request.",
        });
        return;
      }

      const plannedChapter = didacticUnit.chapters[chapterIndex];
      if (!plannedChapter) {
        response.status(404).json({ error: "Didactic unit module not found." });
        return;
      }

      const chapterRuns = (
        await generationRunStore.listByDidacticUnit(
          authenticatedRequest.currentUser.id,
          didacticUnit.id,
        )
      ).filter(
        (run): run is ChapterGenerationRunRecord => run.stage === "chapter",
      );
      response.json(
        buildDidacticUnitModuleDetailResponse({
          didacticUnit,
          moduleIndex: chapterIndex,
          chapterRuns,
        }),
      );
    },
  );

  router.get(
    [
      "/didactic-unit/:id/chapters/:chapterIndex/revisions",
      "/didactic-unit/:id/modules/:chapterIndex/revisions",
    ],
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let chapterIndex;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module revision lookup request.",
        });
        return;
      }

      const revisions = (didacticUnit.chapterRevisions ?? [])
        .filter((revision) => revision.chapterIndex === chapterIndex)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

      if (revisions.length === 0) {
        response
          .status(404)
          .json({ error: "Didactic unit module revisions not found." });
        return;
      }

      response.json({ revisions });
    },
  );

  router.get("/didactic-unit/:id/runs", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const didacticUnit = await didacticUnitStore.getById(
      authenticatedRequest.currentUser.id,
      String(request.params.id),
    );

    if (!didacticUnit) {
      response.status(404).json({ error: "Didactic unit not found." });
      return;
    }

    response.json({
      runs: (
        await generationRunStore.listByDidacticUnit(
          authenticatedRequest.currentUser.id,
          didacticUnit.id,
        )
      ).sort(compareRunsByCreatedAtDesc),
    });
  });

  router.post(
    [
      "/didactic-unit/:id/chapters/:chapterIndex/complete",
      "/didactic-unit/:id/modules/:chapterIndex/complete",
    ],
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let chapterIndex;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module completion request.",
        });
        return;
      }

      try {
        const updatedDidacticUnit = completeDidacticUnitChapter(
          didacticUnit,
          chapterIndex,
        );
        await didacticUnitStore.save(updatedDidacticUnit);
        response.json(
          await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Didactic unit module completion failed.";
        response
          .status(
            message === "Generated didactic unit module not found." ? 404 : 409,
          )
          .json({ error: message });
      }
    },
  );

  router.post(
    [
      "/didactic-unit/:id/chapters/:chapterIndex/unread",
      "/didactic-unit/:id/modules/:chapterIndex/unread",
    ],
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let chapterIndex;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module unread request.",
        });
        return;
      }

      const updatedDidacticUnit = resetDidacticUnitModuleReadProgress(
        didacticUnit,
        chapterIndex,
      );
      await didacticUnitStore.save(updatedDidacticUnit);
      response.json(
        await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
      );
    },
  );

  router.put(
    [
      "/didactic-unit/:id/chapters/:chapterIndex/reading-progress",
      "/didactic-unit/:id/modules/:chapterIndex/reading-progress",
    ],
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let chapterIndex;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module reading progress request.",
        });
        return;
      }

      try {
        const parsedInput = parseModuleReadProgressInput(request.body);
        const updatedDidacticUnit = updateDidacticUnitModuleReadProgress(
          didacticUnit,
          chapterIndex,
          parsedInput.readBlockIndex,
          parsedInput.lastVisitedPageIndex,
          parsedInput.readBlockOffset,
        );
        await didacticUnitStore.save(updatedDidacticUnit);

        response.json({
          module: buildDidacticUnitModuleDetailResponse({
            didacticUnit: updatedDidacticUnit,
            moduleIndex: chapterIndex,
            chapterRuns: [],
          }),
          studyProgress:
            summarizeDidacticUnitStudyProgress(updatedDidacticUnit),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Didactic unit module reading progress update failed.";
        response
          .status(
            message === "Generated didactic unit module not found." ? 404 : 409,
          )
          .json({ error: message });
      }
    },
  );

  router.patch(
    [
      "/didactic-unit/:id/chapters/:chapterIndex",
      "/didactic-unit/:id/modules/:chapterIndex",
    ],
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let chapterIndex;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module update request.",
        });
        return;
      }

      let parsedInput;
      try {
        parsedInput = parseUpdateDidacticUnitChapterInput(request.body);
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module update request.",
        });
        return;
      }

      try {
        const updatedDidacticUnit = updateDidacticUnitChapter(
          didacticUnit,
          chapterIndex,
          parsedInput,
        );
        await didacticUnitStore.save(updatedDidacticUnit);
        response.json(
          buildDidacticUnitModuleDetailResponse({
            didacticUnit: updatedDidacticUnit,
            moduleIndex: chapterIndex,
            chapterRuns: [],
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Didactic unit module update failed.";
        response
          .status(
            message === "Generated didactic unit module not found." ? 404 : 409,
          )
          .json({ error: message });
      }
    },
  );

  router.post(
    "/didactic-unit/:id/modules/:chapterIndex/generate-run",
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const ownerId = authenticatedRequest.currentUser.id;
      const didacticUnit = await didacticUnitStore.getById(
        ownerId,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let chapterIndex;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit module generation request.",
        });
        return;
      }

      const plannedChapter = didacticUnit.chapters[chapterIndex];
      if (!plannedChapter) {
        response.status(400).json({
          error: "Module index is out of range for the approved syllabus.",
        });
        return;
      }

      const activeRun = await generationRunStore.findActiveChapterRun(
        ownerId,
        didacticUnit.id,
        chapterIndex,
      );
      if (activeRun) {
        response.status(202).json({ runId: activeRun.id, run: activeRun });
        return;
      }

      const quality =
        didacticUnit.generationQuality ??
        legacyTierToGenerationQuality(didacticUnit.generationTier);
      if (!quality || !didacticUnit.unitGenerationPaidAt) {
        response.status(409).json({
          error:
            "Unit generation must be paid for before modules can be generated.",
        });
        return;
      }

      let reservation: CreditReservation | null = null;
      const isRegeneration = hasGeneratedDidacticUnitChapter(
        didacticUnit,
        chapterIndex,
      );
      if (isRegeneration) {
        try {
          reservation = await reserveGenerationCredits({
            authService,
            ownerId,
            cost: resolveModuleRegenerationCost({
              quality,
              length: didacticUnit.length,
            }),
            reason: "module_regeneration",
            metadata: {
              operation: "module_regeneration",
              didacticUnitId: didacticUnit.id,
              chapterIndex,
              quality,
              length: didacticUnit.length,
            },
          });
        } catch (error) {
          if (error instanceof AuthError) {
            sendAuthErrorResponse(response, error);
            return;
          }
          throw error;
        }
      }

      const config = await aiConfigStore.get(ownerId);
      const run = createQueuedChapterGenerationRunRecord({
        didacticUnitId: didacticUnit.id,
        ownerId,
        chapterIndex,
        provider: config[quality].provider,
        model: config[quality].model,
        coinTxId: reservation?.transaction.id,
      });
      await generationRunStore.save(run);
      response.status(202).json({ runId: run.id, run });

      const generationAbortController = new AbortController();
      activeGenerationControllers.set(run.id, generationAbortController);

      void (async () => {
        let currentRun: ChapterGenerationRunRecord = {
          ...run,
          status: "running",
          attempts: 1,
          updatedAt: new Date().toISOString(),
        };
        await generationRunStore.save(currentRun);

        try {
          for (let attempt = 1; attempt <= 2; attempt += 1) {
            currentRun = {
              ...currentRun,
              status: attempt === 1 ? "running" : "retrying",
              attempts: attempt,
              emittedBlocks: [],
              updatedAt: new Date().toISOString(),
            };
            await generationRunStore.save(currentRun);

            try {
              const latestUnit = await didacticUnitStore.getById(
                ownerId,
                didacticUnit.id,
              );
              if (!latestUnit) {
                throw new Error("Didactic unit not found.");
              }

              const referenceSyllabus =
                latestUnit.referenceSyllabus ??
                adaptDidacticUnitSyllabusToReferenceSyllabus({
                  topic: latestUnit.topic,
                  syllabus: latestUnit.syllabus ?? {
                    title: latestUnit.title,
                    overview: latestUnit.overview,
                    learningGoals: latestUnit.learningGoals,
                    keywords: latestUnit.keywords,
                    chapters: latestUnit.chapters,
                  },
                });
              const blockAccumulator = createHtmlBlockAccumulator({
                chapterId: `${latestUnit.topic}:${chapterIndex}`,
                onBlock: async (block) => {
                  currentRun = {
                    ...currentRun,
                    emittedBlocks: [...(currentRun.emittedBlocks ?? []), block],
                    updatedAt: new Date().toISOString(),
                  };
                  await generationRunStore.save(currentRun);
                },
              });

              const result = await aiService.streamChapter(
                {
                  topic: latestUnit.topic,
                  level: latestUnit.level,
                  syllabus: referenceSyllabus,
                  chapterIndex,
                  questionnaireAnswers: latestUnit.questionnaireAnswers,
                  continuitySummaries: latestUnit.continuitySummaries,
                  depth: latestUnit.depth,
                  length: latestUnit.length,
                  additionalContext: latestUnit.additionalContext,
                  instruction: parseChapterGenerationInstruction(request.body),
                  config,
                  tier: quality,
                  abortSignal: generationAbortController.signal,
                },
                {
                  onHtml: async (delta) => {
                    await blockAccumulator.ingest(delta);
                  },
                },
              );

              const updatedDidacticUnit = applyGeneratedDidacticUnitChapter(
                latestUnit,
                chapterIndex,
                result.chapter,
                hasGeneratedDidacticUnitChapter(latestUnit, chapterIndex)
                  ? "ai_regeneration"
                  : "ai_generation",
                result.continuitySummary,
              );
              updatedDidacticUnit.provider = result.provider;
              await didacticUnitStore.save(updatedDidacticUnit);

              currentRun = {
                ...currentRun,
                status: "completed",
                provider: result.provider,
                model: result.model,
                prompt: result.prompt,
                chapter: result.chapter,
                rawOutput: result.html,
                emittedBlocks: result.chapter.htmlBlocks,
                finalHtml: result.chapter.html,
                finalHash: result.chapter.htmlHash,
                htmlBlocksVersion: result.chapter.htmlBlocksVersion,
                telemetry: result.telemetry,
                updatedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
              };
              await generationRunStore.save(currentRun);
              return;
            } catch (error) {
              if (attempt < 2) {
                continue;
              }
              throw error;
            }
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Didactic unit module generation failed.";
          if (reservation) {
            await refundGenerationCredits({
              authService,
              reservation,
              reason: "module_regeneration_refund",
              metadata: {
                operation: "module_regeneration",
                didacticUnitId: didacticUnit.id,
                chapterIndex,
                quality,
                error: message,
              },
            });
          }
          await generationRunStore.save({
            ...currentRun,
            status: "failed",
            error: message,
            errorMessage: message,
            refundTxId: reservation
              ? `refund:${reservation.transaction.id}`
              : undefined,
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          });
        } finally {
          activeGenerationControllers.delete(run.id);
        }
      })();
    },
  );

  return router;
}
