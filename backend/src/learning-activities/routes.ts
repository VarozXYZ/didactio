import express from "express";
import { randomUUID } from "node:crypto";
import { AuthError } from "../auth/core/errors.js";
import {
  resolveActivityFeedbackRefillCost,
  resolveActivityGenerationCost,
} from "../credits/generation-costs.js";
import {
  createCompletedActivityFeedbackRunRecord,
  createCompletedActivityGenerationRunRecord,
  createFailedActivityGenerationRunRecord,
} from "../generation-runs/generation-run-store.js";
import {
  gradeObjectiveActivity,
  OBJECTIVE_ACTIVITY_TYPES,
  parseCreateLearningActivityInput,
  type LearningActivity,
  type LearningActivityAttempt,
  type LearningActivityProgress,
} from "../learning-activities/learning-activity.js";

import {
  buildActivityContextModules,
  createAbortSignal,
  getGeneratedChapterOrThrow,
  normalizeFlashcardCards,
  normalizeFlashcardText,
  parseAttemptAnswers,
  parseChapterIndex,
  resolveActivitySourceModuleIndexes,
  resolveCanonicalFlashcardActivity,
  resolveStageConfigError,
  sortPreviousActivitiesForPrompt,
  uniqueLearningActivitiesById,
} from "../http/api-helpers.js";
import {
  refundGenerationCredits,
  reserveGenerationCredits,
  sendAuthErrorResponse,
  type CreditReservation,
} from "../credits/generation-reservations.js";
import { asAuthenticatedRequest } from "../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../http/route-dependencies.js";

export function createLearningActivitiesRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    | "didacticUnitStore"
    | "generationRunStore"
    | "learningActivityStore"
    | "aiConfigStore"
    | "aiService"
    | "authService"
  >,
): express.Router {
  const {
    didacticUnitStore,
    generationRunStore,
    learningActivityStore,
    aiConfigStore,
    aiService,
    authService,
  } = dependencies;
  const router = express.Router();

  router.get(
    "/didactic-unit/:id/modules/:chapterIndex/activities",
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
              : "Invalid learning activity lookup request.",
        });
        return;
      }

      response.json({
        activities: await learningActivityStore.listByModule({
          ownerId,
          didacticUnitId: didacticUnit.id,
          chapterIndex,
        }),
      });
    },
  );

  router.post(
    "/didactic-unit/:id/modules/:chapterIndex/activities",
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
      let input;
      try {
        chapterIndex = parseChapterIndex(String(request.params.chapterIndex));
        input = parseCreateLearningActivityInput(request.body);
        getGeneratedChapterOrThrow(didacticUnit, chapterIndex);
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid learning activity creation request.",
        });
        return;
      }

      if (
        input.type === "freeform_html" &&
        process.env.LEARNING_ACTIVITY_FREEFORM_ENABLED !== "true"
      ) {
        response.status(403).json({
          error: "Freeform activity creation is not enabled.",
        });
        return;
      }

      const sourceModuleIndexes = resolveActivitySourceModuleIndexes({
        scope: input.scope,
        chapterIndex,
      });
      const activityPromptPool =
        input.scope === "current_module"
          ? await learningActivityStore.listByModule({
              ownerId,
              didacticUnitId: didacticUnit.id,
              chapterIndex,
            })
          : await learningActivityStore.listByUnitRange({
              ownerId,
              didacticUnitId: didacticUnit.id,
              maxChapterIndex: chapterIndex,
            });
      const flashcardPromptPool =
        input.type === "flashcards"
          ? (
              await learningActivityStore.listByUnit({
                ownerId,
                didacticUnitId: didacticUnit.id,
              })
            ).filter((activity) => activity.type === "flashcards")
          : [];
      const previousActivities = sortPreviousActivitiesForPrompt({
        activities: uniqueLearningActivitiesById([
          ...activityPromptPool,
          ...flashcardPromptPool,
        ]),
        chapterIndex,
        type: input.type,
      });
      const config = await aiConfigStore.get(ownerId);
      let reservation: CreditReservation | null = null;

      try {
        reservation = await reserveGenerationCredits({
          authService,
          ownerId,
          cost: resolveActivityGenerationCost({ quality: input.quality }),
          reason: "activity_generation",
          metadata: {
            operation: "activity_generation",
            didacticUnitId: didacticUnit.id,
            chapterIndex,
            scope: input.scope,
            type: input.type,
            quality: input.quality,
          },
        });
      } catch (error) {
        if (error instanceof AuthError) {
          sendAuthErrorResponse(response, error);
          return;
        }
        throw error;
      }

      try {
        const result = await aiService.generateLearningActivity({
          topic: didacticUnit.topic,
          moduleTitle:
            didacticUnit.modules[chapterIndex]?.title ??
            didacticUnit.chapters[chapterIndex]?.title ??
            `Module ${chapterIndex + 1}`,
          scope: input.scope,
          type: input.type,
          contextModules: buildActivityContextModules({
            didacticUnit,
            sourceModuleIndexes,
          }),
          previousActivities: previousActivities.map((activity) => ({
            chapterIndex: activity.chapterIndex,
            type: activity.type,
            title: activity.title,
            instructions: activity.instructions,
            dedupeSummary:
              activity.type === "flashcards"
                ? [
                    activity.dedupeSummary,
                    "Existing cards:",
                    normalizeFlashcardCards(activity.content.cards)
                      .slice(0, 80)
                      .map(
                        (card) =>
                          `${normalizeFlashcardText(card.front)} -> ${normalizeFlashcardText(card.back)}`,
                      )
                      .join("; "),
                  ]
                    .filter(Boolean)
                    .join(" ")
                : activity.dedupeSummary,
          })),
          config,
          tier: input.quality,
          abortSignal: createAbortSignal(request),
        });
        const now = new Date().toISOString();
        const existingFlashcardActivity =
          input.type === "flashcards"
            ? (
                await learningActivityStore.listByUnit({
                  ownerId,
                  didacticUnitId: didacticUnit.id,
                })
              )
                .filter((activity) => activity.type === "flashcards")
                .sort((left, right) =>
                  left.createdAt.localeCompare(right.createdAt),
                )[0]
            : null;
        const activityId = existingFlashcardActivity?.id ?? randomUUID();
        const run = createCompletedActivityGenerationRunRecord({
          didacticUnitId: didacticUnit.id,
          ownerId,
          chapterIndex,
          activityId,
          activityType: input.type,
          scope: input.scope,
          provider: result.provider,
          model: result.model,
          prompt: result.prompt,
          rawOutput: JSON.stringify(result.raw),
          coinTxId: reservation?.transaction.id,
          createdAt: now,
          telemetry: result.telemetry,
        });
        await generationRunStore.save(run);
        const activity: LearningActivity =
          input.type === "flashcards"
            ? await resolveCanonicalFlashcardActivity({
                learningActivityStore,
                ownerId,
                didacticUnitId: didacticUnit.id,
                chapterIndex,
                sourceModuleIndexes,
                quality: input.quality,
                result,
                generationRunId: run.id,
                activityId,
                now,
              })
            : {
                id: activityId,
                ownerId,
                didacticUnitId: didacticUnit.id,
                chapterIndex,
                scope: input.scope,
                type: input.type,
                quality: input.quality,
                title: result.title,
                instructions: result.instructions,
                content: result.content,
                dedupeSummary: result.dedupeSummary,
                sourceModuleIndexes,
                feedbackAttemptLimit: 3,
                generationRunId: run.id,
                createdAt: now,
                updatedAt: now,
              };
        await learningActivityStore.saveActivity(activity);
        response.status(201).json({ activity });
      } catch (error) {
        await refundGenerationCredits({
          authService,
          reservation,
          reason: "activity_generation_refund",
          metadata: {
            operation: "activity_generation",
            didacticUnitId: didacticUnit.id,
            chapterIndex,
            scope: input.scope,
            type: input.type,
            quality: input.quality,
            error:
              error instanceof Error
                ? error.message
                : "Learning activity generation failed.",
          },
        });
        await generationRunStore.save(
          createFailedActivityGenerationRunRecord({
            didacticUnitId: didacticUnit.id,
            ownerId,
            chapterIndex,
            activityType: input.type,
            scope: input.scope,
            provider: config[input.quality].provider,
            model: config[input.quality].model,
            prompt: "",
            error:
              error instanceof Error
                ? error.message
                : "Learning activity generation failed.",
            coinTxId: reservation?.transaction.id,
            createdAt: new Date().toISOString(),
          }),
        );
        const resolved = resolveStageConfigError(
          error,
          "Learning activity generation failed.",
        );
        response.status(resolved.status).json({ error: resolved.message });
      }
    },
  );

  router.get("/activities/:activityId/progress", async (request, response) => {
    const ownerId = asAuthenticatedRequest(request).currentUser.id;
    const activity = await learningActivityStore.getActivity(
      ownerId,
      String(request.params.activityId),
    );
    if (!activity) {
      response.status(404).json({ error: "Learning activity not found." });
      return;
    }
    const progress = await learningActivityStore.getProgress(
      ownerId,
      activity.id,
    );
    response.json({ progress });
  });

  router.put("/activities/:activityId/progress", async (request, response) => {
    const ownerId = asAuthenticatedRequest(request).currentUser.id;
    const activity = await learningActivityStore.getActivity(
      ownerId,
      String(request.params.activityId),
    );
    if (!activity) {
      response.status(404).json({ error: "Learning activity not found." });
      return;
    }
    const { confirmedAnswers, answers, completed } = request.body as {
      confirmedAnswers: LearningActivityProgress["confirmedAnswers"];
      answers?: LearningActivityProgress["answers"];
      completed: boolean;
    };
    const progress: LearningActivityProgress = {
      activityId: activity.id,
      ownerId,
      confirmedAnswers: confirmedAnswers ?? {},
      answers:
        answers && typeof answers === "object" && !Array.isArray(answers)
          ? answers
          : undefined,
      completed: completed ?? false,
      updatedAt: new Date().toISOString(),
    };
    await learningActivityStore.saveProgress(progress);
    response.json({ progress });
  });

  router.get("/activities/:activityId", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const activity = await learningActivityStore.getActivity(
      ownerId,
      String(request.params.activityId),
    );

    if (!activity) {
      response.status(404).json({ error: "Learning activity not found." });
      return;
    }

    response.json({
      activity,
      attempts: await learningActivityStore.listAttempts(ownerId, activity.id),
    });
  });

  router.delete("/activities/:activityId", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const deleted = await learningActivityStore.deleteActivity(
      ownerId,
      String(request.params.activityId),
    );

    if (!deleted) {
      response.status(404).json({ error: "Learning activity not found." });
      return;
    }

    response.status(204).send();
  });

  router.get("/activities/:activityId/attempts", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const activity = await learningActivityStore.getActivity(
      ownerId,
      String(request.params.activityId),
    );

    if (!activity) {
      response.status(404).json({ error: "Learning activity not found." });
      return;
    }

    response.json({
      attempts: await learningActivityStore.listAttempts(ownerId, activity.id),
    });
  });

  router.post("/activities/:activityId/refill", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const activity = await learningActivityStore.getActivity(
      ownerId,
      String(request.params.activityId),
    );

    if (!activity) {
      response.status(404).json({ error: "Learning activity not found." });
      return;
    }

    const cost = resolveActivityFeedbackRefillCost({
      quality: activity.quality,
    });

    try {
      await reserveGenerationCredits({
        authService,
        ownerId,
        cost,
        reason: "activity_feedback_refill",
        metadata: {
          operation: "activity_feedback_refill",
          activityId: activity.id,
          quality: activity.quality,
        },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        sendAuthErrorResponse(response, error);
        return;
      }
      throw error;
    }

    const updatedActivity: LearningActivity = {
      ...activity,
      feedbackAttemptLimit: activity.feedbackAttemptLimit + 3,
      updatedAt: new Date().toISOString(),
    };
    await learningActivityStore.saveActivity(updatedActivity);
    response.json({ activity: updatedActivity });
  });

  router.post("/activities/:activityId/attempts", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const activity = await learningActivityStore.getActivity(
      ownerId,
      String(request.params.activityId),
    );

    if (!activity) {
      response.status(404).json({ error: "Learning activity not found." });
      return;
    }

    let answers: unknown;
    try {
      answers = parseAttemptAnswers(request.body);
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid learning activity attempt request.",
      });
      return;
    }

    const existingAttempts = await learningActivityStore.listAttempts(
      ownerId,
      activity.id,
    );
    if (existingAttempts.length >= activity.feedbackAttemptLimit) {
      response.status(409).json({
        error: "No feedback attempts remain for this activity.",
      });
      return;
    }

    const now = new Date().toISOString();
    const attemptId = randomUUID();
    try {
      let score: number | undefined;
      let feedback: string;
      let strengths: string[] | undefined;
      let improvements: string[] | undefined;
      let questionFeedback: LearningActivityAttempt["questionFeedback"];

      if (OBJECTIVE_ACTIVITY_TYPES.has(activity.type)) {
        const result = gradeObjectiveActivity({ activity, answers });
        score = result.score;
        feedback = result.feedback;
      } else {
        const didacticUnit = await didacticUnitStore.getById(
          ownerId,
          activity.didacticUnitId,
        );
        if (!didacticUnit) {
          response.status(404).json({ error: "Didactic unit not found." });
          return;
        }
        const config = await aiConfigStore.get(ownerId);
        const result = await aiService.generateLearningActivityFeedback({
          activityTitle: activity.title,
          activityType: activity.type,
          instructions: activity.instructions,
          content: activity.content,
          answers,
          config,
          tier: activity.quality,
          abortSignal: createAbortSignal(request),
        });
        score = result.score;
        questionFeedback = result.questionFeedback;
        strengths = result.strengths;
        improvements = result.improvements;
        feedback = result.feedback;
        await generationRunStore.save(
          createCompletedActivityFeedbackRunRecord({
            didacticUnitId: activity.didacticUnitId,
            ownerId,
            chapterIndex: activity.chapterIndex,
            activityId: activity.id,
            attemptId,
            provider: result.provider,
            model: result.model,
            prompt: result.prompt,
            rawOutput: JSON.stringify({
              score: result.score,
              feedback: result.feedback,
              strengths: result.strengths,
              improvements: result.improvements,
              questionFeedback: result.questionFeedback,
            }),
            createdAt: now,
            telemetry: result.telemetry,
          }),
        );
      }

      const attempt: LearningActivityAttempt = {
        id: attemptId,
        activityId: activity.id,
        ownerId,
        answers,
        score,
        feedback,
        strengths,
        improvements,
        questionFeedback,
        completedAt: now,
      };
      await learningActivityStore.saveAttempt(attempt);
      response.status(201).json({ attempt });
    } catch (error) {
      const resolved = resolveStageConfigError(
        error,
        "Learning activity feedback failed.",
      );
      response.status(resolved.status).json({ error: resolved.message });
    }
  });

  return router;
}
