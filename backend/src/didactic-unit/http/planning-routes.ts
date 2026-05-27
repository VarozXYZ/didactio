import express from "express";
import { type AiModelTier } from "../../ai/config.js";
import { openNdjsonStream, writeNdjsonEvent } from "../../ai/ndjson.js";
import { AuthError } from "../../auth/core/errors.js";
import {
  resolveSyllabusGenerationCost,
  resolveUnitGenerationCost,
  type GenerationQuality,
} from "../../credits/generation-costs.js";
import { type DidacticUnit } from "../../didactic-unit/didactic-unit.js";
import {
  answerDidacticUnitQuestionnaire,
  applyGeneratedDidacticUnitSyllabus,
  approveDidacticUnitSyllabus,
  generateDidacticUnitSyllabusPrompt,
  moderateDidacticUnitPlanning,
  prepareDidacticUnitSyllabusGeneration,
  rejectDidacticUnitModeration,
  updateDidacticUnitSyllabus,
} from "../../didactic-unit/planning-lifecycle.js";
import {
  parseQuestionnaireAnswersInput,
  parseUpdateDidacticUnitSyllabusInput,
} from "../../didactic-unit/planning.js";
import { updateDidacticUnitFolder } from "../../didactic-unit/update-didactic-unit-folder.js";
import { ensureDefaultFolders } from "../../folders/folder-defaults.js";
import { SYSTEM_DEFAULT_THEME } from "../../presentation-theme/types.js";

import {
  createAbortSignal,
  parseGenerationQuality,
  parseOptionalSyllabusContext,
  recordCompletedSyllabusRun,
  recordFailedSyllabusRun,
  resolveFolderIdFromModelName,
  resolveStageConfigError,
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
  buildDidacticUnitResponse,
  buildFolderDescription,
} from "./responses.js";

export function createPlanningRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    | "didacticUnitStore"
    | "folderStore"
    | "generationRunStore"
    | "aiConfigStore"
    | "aiService"
    | "authService"
    | "appLogger"
  >,
): express.Router {
  const {
    didacticUnitStore,
    folderStore,
    generationRunStore,
    aiConfigStore,
    aiService,
    authService,
    appLogger,
  } = dependencies;
  const router = express.Router();

  router.post("/didactic-unit/:id/moderate", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const didacticUnit = await didacticUnitStore.getById(
      authenticatedRequest.currentUser.id,
      String(request.params.id),
    );

    if (!didacticUnit) {
      response.status(404).json({ error: "Didactic unit not found." });
      return;
    }

    if (
      didacticUnit.status !== "submitted" &&
      didacticUnit.status !== "questionnaire_pending_moderation" &&
      didacticUnit.status !== "moderation_failed"
    ) {
      response.json(await buildDidacticUnitResponse(didacticUnit, folderStore));
      return;
    }

    try {
      const config = await aiConfigStore.get(
        authenticatedRequest.currentUser.id,
      );
      const folders = await ensureDefaultFolders(
        folderStore,
        authenticatedRequest.currentUser.id,
      );
      const generalFolder = folders.find((folder) => folder.slug === "general");

      if (!generalFolder) {
        throw new Error("General folder could not be resolved.");
      }
      const moderation = await aiService.moderateTopic({
        topic: didacticUnit.topic,
        level: didacticUnit.level,
        additionalContext: didacticUnit.additionalContext,
        folders:
          didacticUnit.folderAssignmentMode === "auto"
            ? folders.map((folder) => ({
                name: folder.name,
                description: buildFolderDescription(folder),
              }))
            : undefined,
        config,
        tier: "silver",
        abortSignal: createAbortSignal(request),
      });

      if (!moderation.approved) {
        appLogger.warn("Didactic unit moderation rejected", {
          didacticUnitId: didacticUnit.id,
          ownerId: authenticatedRequest.currentUser.id,
          topic: didacticUnit.topic,
          notes: moderation.notes,
          reasoningNotes: moderation.reasoningNotes,
        });
        await didacticUnitStore.save(
          rejectDidacticUnitModeration(didacticUnit, moderation.notes),
        );
        response.status(409).json({ error: moderation.notes });
        return;
      }

      const moderatedDidacticUnit = moderateDidacticUnitPlanning(didacticUnit, {
        normalizedTopic: moderation.normalizedTopic,
        improvedTopicBrief: moderation.improvedTopicBrief,
        reasoningNotes: moderation.reasoningNotes,
      });
      const folderResolvedDidacticUnit =
        moderatedDidacticUnit.folderAssignmentMode === "auto"
          ? updateDidacticUnitFolder(moderatedDidacticUnit, {
              mode: "auto",
              folderId: resolveFolderIdFromModelName({
                folderName: moderation.folderName,
                folders,
                fallbackFolderId: generalFolder.id,
              }),
            })
          : moderatedDidacticUnit;
      const styledUnit =
        moderation.stylePreset &&
        !folderResolvedDidacticUnit.presentationTheme?.stylePreset
          ? {
              ...folderResolvedDidacticUnit,
              presentationTheme: {
                ...(folderResolvedDidacticUnit.presentationTheme ??
                  SYSTEM_DEFAULT_THEME),
                stylePreset: moderation.stylePreset,
              },
            }
          : folderResolvedDidacticUnit;
      await didacticUnitStore.save(styledUnit);
      response.json(await buildDidacticUnitResponse(styledUnit, folderStore));
    } catch (error) {
      const resolved = resolveStageConfigError(
        error,
        "Didactic unit moderation failed.",
      );
      response.status(resolved.status).json({ error: resolved.message });
    }
  });

  router.post(
    "/didactic-unit/:id/moderate/stream",
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

      if (
        didacticUnit.status !== "submitted" &&
        didacticUnit.status !== "questionnaire_pending_moderation" &&
        didacticUnit.status !== "moderation_failed"
      ) {
        openNdjsonStream(response);
        writeNdjsonEvent(response, {
          type: "complete",
          data: await buildDidacticUnitResponse(didacticUnit, folderStore),
        });
        response.end();
        return;
      }

      openNdjsonStream(response);

      try {
        const config = await aiConfigStore.get(
          authenticatedRequest.currentUser.id,
        );
        const folders = await ensureDefaultFolders(
          folderStore,
          authenticatedRequest.currentUser.id,
        );
        const generalFolder = folders.find(
          (folder) => folder.slug === "general",
        );

        if (!generalFolder) {
          throw new Error("General folder could not be resolved.");
        }
        const moderation = await aiService.streamModeration(
          {
            topic: didacticUnit.topic,
            level: didacticUnit.level,
            additionalContext: didacticUnit.additionalContext,
            folders:
              didacticUnit.folderAssignmentMode === "auto"
                ? folders.map((folder) => ({
                    name: folder.name,
                    description: buildFolderDescription(folder),
                  }))
                : undefined,
            config,
            tier: "silver",
            abortSignal: createAbortSignal(request),
          },
          {
            onStart: async (selection) => {
              writeNdjsonEvent(response, {
                type: "start",
                stage: "moderation",
                provider: selection.provider,
                model: selection.model,
              });
            },
            onPartial: async (partial) => {
              writeNdjsonEvent(response, {
                type: "partial_structured",
                data: partial,
              });
            },
          },
        );

        if (!moderation.approved) {
          appLogger.warn("Didactic unit moderation rejected", {
            didacticUnitId: didacticUnit.id,
            ownerId: authenticatedRequest.currentUser.id,
            topic: didacticUnit.topic,
            notes: moderation.notes,
            reasoningNotes: moderation.reasoningNotes,
            streaming: true,
          });
          await didacticUnitStore.save(
            rejectDidacticUnitModeration(didacticUnit, moderation.notes),
          );
          writeNdjsonEvent(response, {
            type: "error",
            message: moderation.notes,
          });
          response.end();
          return;
        }

        const moderatedDidacticUnit = moderateDidacticUnitPlanning(
          didacticUnit,
          {
            normalizedTopic: moderation.normalizedTopic,
            improvedTopicBrief: moderation.improvedTopicBrief,
            reasoningNotes: moderation.reasoningNotes,
          },
        );
        const folderResolvedDidacticUnit =
          moderatedDidacticUnit.folderAssignmentMode === "auto"
            ? updateDidacticUnitFolder(moderatedDidacticUnit, {
                mode: "auto",
                folderId: resolveFolderIdFromModelName({
                  folderName: moderation.folderName,
                  folders,
                  fallbackFolderId: generalFolder.id,
                }),
              })
            : moderatedDidacticUnit;
        await didacticUnitStore.save(folderResolvedDidacticUnit);
        writeNdjsonEvent(response, {
          type: "complete",
          data: await buildDidacticUnitResponse(
            folderResolvedDidacticUnit,
            folderStore,
          ),
        });
      } catch (error) {
        const resolved = resolveStageConfigError(
          error,
          "Didactic unit moderation failed.",
        );
        writeNdjsonEvent(response, {
          type: "error",
          message: resolved.message,
        });
      }

      response.end();
    },
  );

  router.patch(
    "/didactic-unit/:id/questionnaire/answers",
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

      let parsedInput;
      try {
        parsedInput = parseQuestionnaireAnswersInput(request.body);
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid questionnaire answers request.",
        });
        return;
      }

      try {
        const updatedDidacticUnit = answerDidacticUnitQuestionnaire(
          didacticUnit,
          parsedInput,
        );
        await didacticUnitStore.save(updatedDidacticUnit);
        response.json(
          await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
        );
      } catch (error) {
        response.status(409).json({
          error:
            error instanceof Error
              ? error.message
              : "Didactic unit questionnaire answer submission failed.",
        });
      }
    },
  );

  router.post(
    "/didactic-unit/:id/syllabus-prompt/generate",
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

      try {
        const config = await aiConfigStore.get(
          authenticatedRequest.currentUser.id,
        );
        const updatedDidacticUnit = generateDidacticUnitSyllabusPrompt(
          didacticUnit,
          config.authoring,
        );
        await didacticUnitStore.save(updatedDidacticUnit);
        response.json(
          await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
        );
      } catch (error) {
        response.status(409).json({
          error:
            error instanceof Error
              ? error.message
              : "Didactic unit syllabus prompt generation failed.",
        });
      }
    },
  );

  router.post(
    "/didactic-unit/:id/syllabus/generate/stream",
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        request.params.id,
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      const tier: AiModelTier = "silver";

      const config = await aiConfigStore.get(
        authenticatedRequest.currentUser.id,
      );
      let preparedDidacticUnit: DidacticUnit | null = null;
      let reservation: CreditReservation | null = null;

      let syllabusContext: string | undefined;
      try {
        syllabusContext = parseOptionalSyllabusContext(request.body);
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit syllabus generation request.",
        });
        return;
      }

      try {
        reservation = await reserveGenerationCredits({
          authService,
          ownerId: authenticatedRequest.currentUser.id,
          cost: resolveSyllabusGenerationCost(),
          reason: "syllabus_generation",
          metadata: {
            operation: "syllabus_generation",
            didacticUnitId: didacticUnit.id,
            quality: tier,
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

      openNdjsonStream(response);

      try {
        preparedDidacticUnit = prepareDidacticUnitSyllabusGeneration(
          didacticUnit,
          config.authoring,
          syllabusContext,
        );
        const result = await aiService.streamSyllabus(
          {
            topic: preparedDidacticUnit.topic,
            level: preparedDidacticUnit.level,
            improvedTopicBrief: preparedDidacticUnit.improvedTopicBrief,
            syllabusPrompt: preparedDidacticUnit.syllabusPrompt ?? "",
            questionnaireAnswers: preparedDidacticUnit.questionnaireAnswers,
            depth: preparedDidacticUnit.depth,
            length: preparedDidacticUnit.length,
            config,
            tier,
            abortSignal: createAbortSignal(request),
          },
          {
            onStart: async (selection) => {
              writeNdjsonEvent(response, {
                type: "start",
                stage: "syllabus",
                provider: selection.provider,
                model: selection.model,
              });
            },
            onPartial: async (partial) => {
              writeNdjsonEvent(response, {
                type: "partial_structured",
                data: partial,
              });
            },
          },
        );

        const updatedDidacticUnit = applyGeneratedDidacticUnitSyllabus(
          preparedDidacticUnit,
          result.syllabus,
        );
        updatedDidacticUnit.provider = result.provider;
        await didacticUnitStore.save(updatedDidacticUnit);
        await recordCompletedSyllabusRun(
          generationRunStore,
          updatedDidacticUnit,
          result,
        );
        writeNdjsonEvent(response, {
          type: "complete",
          data: await buildDidacticUnitResponse(
            updatedDidacticUnit,
            folderStore,
          ),
        });
      } catch (error) {
        await recordFailedSyllabusRun(
          generationRunStore,
          didacticUnit,
          preparedDidacticUnit?.syllabusPrompt ??
            didacticUnit.syllabusPrompt ??
            "",
          config[tier],
          error,
        );
        await refundGenerationCredits({
          authService,
          reservation,
          reason: "syllabus_generation_refund",
          metadata: {
            operation: "syllabus_generation",
            didacticUnitId: didacticUnit.id,
            quality: tier,
            error:
              error instanceof Error
                ? error.message
                : "Didactic unit syllabus generation failed.",
          },
        });
        const resolved = resolveStageConfigError(
          error,
          "Didactic unit syllabus generation failed.",
        );
        writeNdjsonEvent(response, {
          type: "error",
          message: resolved.message,
        });
      }

      response.end();
    },
  );

  router.patch("/didactic-unit/:id/syllabus", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const didacticUnit = await didacticUnitStore.getById(
      authenticatedRequest.currentUser.id,
      request.params.id,
    );

    if (!didacticUnit) {
      response.status(404).json({ error: "Didactic unit not found." });
      return;
    }

    let parsedInput;
    try {
      parsedInput = parseUpdateDidacticUnitSyllabusInput(request.body);
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid syllabus update request.",
      });
      return;
    }

    try {
      const updatedDidacticUnit = updateDidacticUnitSyllabus(
        didacticUnit,
        parsedInput,
      );
      await didacticUnitStore.save(updatedDidacticUnit);
      response.json(
        await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
      );
    } catch (error) {
      response.status(409).json({
        error:
          error instanceof Error
            ? error.message
            : "Didactic unit syllabus update failed.",
      });
    }
  });

  router.post(
    "/didactic-unit/:id/approve-syllabus",
    async (request, response) => {
      const authenticatedRequest = asAuthenticatedRequest(request);
      const didacticUnit = await didacticUnitStore.getById(
        authenticatedRequest.currentUser.id,
        request.params.id,
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let quality: GenerationQuality;
      try {
        quality = parseGenerationQuality(request.body);
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit syllabus approval request.",
        });
        return;
      }

      let reservation: CreditReservation | null = null;
      try {
        const cost = resolveUnitGenerationCost({
          quality,
          length: didacticUnit.length,
        });
        reservation = await reserveGenerationCredits({
          authService,
          ownerId: authenticatedRequest.currentUser.id,
          cost,
          reason: "unit_generation",
          metadata: {
            operation: "unit_generation",
            didacticUnitId: didacticUnit.id,
            quality,
            length: didacticUnit.length,
          },
        });
        const approvedDidacticUnit = approveDidacticUnitSyllabus(didacticUnit, {
          generationQuality: quality,
          creditTransactionId: reservation?.transaction.id,
          paidAt:
            reservation?.transaction.createdAt.toISOString() ??
            new Date().toISOString(),
        });
        await didacticUnitStore.save(approvedDidacticUnit);
        response.json(
          await buildDidacticUnitResponse(approvedDidacticUnit, folderStore),
        );
      } catch (error) {
        if (reservation) {
          await refundGenerationCredits({
            authService,
            reservation,
            reason: "unit_generation_refund",
            metadata: {
              operation: "unit_generation",
              didacticUnitId: didacticUnit.id,
              quality,
              error:
                error instanceof Error
                  ? error.message
                  : "Didactic unit syllabus approval failed.",
            },
          });
        }
        if (error instanceof AuthError) {
          sendAuthErrorResponse(response, error);
          return;
        }
        response.status(409).json({
          error:
            error instanceof Error
              ? error.message
              : "Didactic unit syllabus approval failed.",
        });
      }
    },
  );

  return router;
}
