import express from "express";
import { AuthError } from "../../auth/core/errors.js";
import { resolveNoteGenerationCost } from "../../credits/generation-costs.js";
import {
  createDidacticUnitNote,
  parseCreateManualDidacticUnitNoteInput,
  parseGenerateDidacticUnitNoteInput,
  parseUpdateDidacticUnitNoteInput,
} from "../../didactic-unit/notes/note.js";

import {
  createAbortSignal,
  getGeneratedChapterOrThrow,
  resolveStageConfigError,
  updateDidacticUnitNote,
  validateNoteAnchorForChapter,
} from "../../http/api-helpers.js";
import {
  refundGenerationCredits,
  reserveGenerationCredits,
  sendAuthErrorResponse,
  type CreditReservation,
} from "../../credits/generation-reservations.js";
import { asAuthenticatedRequest } from "../../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../../http/route-dependencies.js";

export function createNotesRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    | "didacticUnitStore"
    | "didacticUnitNoteStore"
    | "aiConfigStore"
    | "aiService"
    | "authService"
  >,
): express.Router {
  const {
    didacticUnitStore,
    didacticUnitNoteStore,
    aiConfigStore,
    aiService,
    authService,
  } = dependencies;
  const router = express.Router();

  router.get("/didactic-unit/:id/notes", async (request, response) => {
    const ownerId = asAuthenticatedRequest(request).currentUser.id;
    const didacticUnit = await didacticUnitStore.getById(
      ownerId,
      String(request.params.id),
    );

    if (!didacticUnit) {
      response.status(404).json({ error: "Didactic unit not found." });
      return;
    }

    response.json({
      notes: await didacticUnitNoteStore.listByUnit(ownerId, didacticUnit.id),
    });
  });

  router.post("/didactic-unit/:id/notes", async (request, response) => {
    const ownerId = asAuthenticatedRequest(request).currentUser.id;
    const didacticUnit = await didacticUnitStore.getById(
      ownerId,
      String(request.params.id),
    );

    if (!didacticUnit) {
      response.status(404).json({ error: "Didactic unit not found." });
      return;
    }

    try {
      const input = parseCreateManualDidacticUnitNoteInput(request.body);
      const chapter = getGeneratedChapterOrThrow(
        didacticUnit,
        input.chapterIndex,
      );
      validateNoteAnchorForChapter({
        anchor: input.anchor,
        selectedText: input.selectedText,
        chapter,
      });
      const note = createDidacticUnitNote({
        ownerId,
        didacticUnitId: didacticUnit.id,
        chapterIndex: input.chapterIndex,
        source: "manual",
        selectedText: input.selectedText,
        content: input.content,
        anchor: input.anchor,
      });
      await didacticUnitNoteStore.save(note);
      response.status(201).json({ note });
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid didactic unit note request.",
      });
    }
  });

  router.post(
    "/didactic-unit/:id/notes/generate",
    async (request, response) => {
      const ownerId = asAuthenticatedRequest(request).currentUser.id;
      const didacticUnit = await didacticUnitStore.getById(
        ownerId,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      let input;
      let chapter;
      try {
        input = parseGenerateDidacticUnitNoteInput(request.body);
        chapter = getGeneratedChapterOrThrow(didacticUnit, input.chapterIndex);
        validateNoteAnchorForChapter({
          anchor: input.anchor,
          selectedText: input.selectedText,
          chapter,
        });
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit note generation request.",
        });
        return;
      }

      const config = await aiConfigStore.get(ownerId);
      let reservation: CreditReservation | null = null;

      try {
        reservation = await reserveGenerationCredits({
          authService,
          ownerId,
          cost: resolveNoteGenerationCost(),
          reason: "note_generation",
          metadata: {
            operation: "note_generation",
            didacticUnitId: didacticUnit.id,
            chapterIndex: input.chapterIndex,
            quality: "silver",
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
        const result = await aiService.generateDidacticUnitNote({
          unitTitle: didacticUnit.title,
          unitTopic: didacticUnit.topic,
          unitOutline: didacticUnit.chapters.map((module, index) => ({
            index,
            title: module.title,
            overview: module.overview,
          })),
          moduleTitle: chapter.title,
          moduleHtml: chapter.html,
          selectedText: input.selectedText,
          question: input.question,
          config,
          tier: "silver",
          abortSignal: createAbortSignal(request),
        });
        const note = createDidacticUnitNote({
          ownerId,
          didacticUnitId: didacticUnit.id,
          chapterIndex: input.chapterIndex,
          source: "ai",
          selectedText: input.selectedText,
          question: input.question,
          content: result.content,
          quality: "silver",
          anchor: input.anchor,
        });
        await didacticUnitNoteStore.save(note);
        response.status(201).json({ note });
      } catch (error) {
        await refundGenerationCredits({
          authService,
          reservation,
          reason: "note_generation_refund",
          metadata: {
            operation: "note_generation",
            didacticUnitId: didacticUnit.id,
            chapterIndex: input.chapterIndex,
            quality: "silver",
            error:
              error instanceof Error
                ? error.message
                : "Didactic unit note generation failed.",
          },
        });
        const resolved = resolveStageConfigError(
          error,
          "Didactic unit note generation failed.",
        );
        response.status(resolved.status).json({ error: resolved.message });
      }
    },
  );

  router.patch(
    "/didactic-unit/:id/notes/:noteId",
    async (request, response) => {
      const ownerId = asAuthenticatedRequest(request).currentUser.id;
      const didacticUnit = await didacticUnitStore.getById(
        ownerId,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      const note = await didacticUnitNoteStore.getById(
        ownerId,
        String(request.params.noteId),
      );
      if (!note || note.didacticUnitId !== didacticUnit.id) {
        response.status(404).json({ error: "Didactic unit note not found." });
        return;
      }

      try {
        const patch = parseUpdateDidacticUnitNoteInput(request.body);
        const updated = updateDidacticUnitNote(note, patch);
        await didacticUnitNoteStore.save(updated);
        response.json({ note: updated });
      } catch (error) {
        response.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid didactic unit note update request.",
        });
      }
    },
  );

  router.delete(
    "/didactic-unit/:id/notes/:noteId",
    async (request, response) => {
      const ownerId = asAuthenticatedRequest(request).currentUser.id;
      const didacticUnit = await didacticUnitStore.getById(
        ownerId,
        String(request.params.id),
      );

      if (!didacticUnit) {
        response.status(404).json({ error: "Didactic unit not found." });
        return;
      }

      const note = await didacticUnitNoteStore.getById(
        ownerId,
        String(request.params.noteId),
      );
      if (!note || note.didacticUnitId !== didacticUnit.id) {
        response.status(404).json({ error: "Didactic unit note not found." });
        return;
      }

      await didacticUnitNoteStore.deleteById(ownerId, note.id);
      response.status(204).send();
    },
  );

  return router;
}
