import express from "express";
import {
  createDidacticUnit,
  type DidacticUnit,
} from "../../didactic-unit/didactic-unit.js";
import {
  parseCreateDidacticUnitInput,
  parseUpdateDidacticUnitFolderInput,
} from "../../didactic-unit/planning.js";
import { updateDidacticUnitFolder } from "../../didactic-unit/update-didactic-unit-folder.js";
import { getGeneralFolder } from "../../folders/folder-defaults.js";
import { parsePresentationTheme } from "../../presentation-theme/validate.js";

import {
  resolveAutoAssignedFolderSelection,
  resolveCompatibilityProvider,
  resolveFolderSelectionForManualMode,
} from "../../http/api-helpers.js";
import { asAuthenticatedRequest } from "../../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../../http/route-dependencies.js";
import {
  buildDidacticUnitResponse,
  buildDidacticUnitSummaryResponses,
  loadFoldersById,
} from "./responses.js";

export function createDidacticUnitRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    | "didacticUnitStore"
    | "didacticUnitNoteStore"
    | "folderStore"
    | "generationRunStore"
    | "aiConfigStore"
    | "aiService"
    | "enqueueModerationJob"
  >,
): express.Router {
  const {
    didacticUnitStore,
    didacticUnitNoteStore,
    folderStore,
    generationRunStore,
    aiConfigStore,
    aiService,
    enqueueModerationJob,
  } = dependencies;
  const router = express.Router();

  router.post("/didactic-unit", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);

    try {
      const input = parseCreateDidacticUnitInput(request.body);
      const config = await aiConfigStore.get(
        authenticatedRequest.currentUser.id,
      );
      const foldersById = await loadFoldersById(
        folderStore,
        authenticatedRequest.currentUser.id,
      );
      const generalFolder = await getGeneralFolder(
        folderStore,
        authenticatedRequest.currentUser.id,
      );
      const resolvedFolderSelection =
        input.folderSelection.mode === "manual"
          ? resolveFolderSelectionForManualMode(
              input.folderSelection,
              foldersById,
            )
          : {
              mode: "auto" as const,
              folderId: generalFolder.id,
            };
      const didacticUnit = createDidacticUnit(
        {
          ...input,
          provider: resolveCompatibilityProvider(config, input.provider),
          folderSelection: resolvedFolderSelection,
        },
        authenticatedRequest.currentUser.id,
      );

      await didacticUnitStore.save(didacticUnit);
      enqueueModerationJob(
        authenticatedRequest.currentUser.id,
        didacticUnit.id,
      );
      response
        .status(201)
        .json(await buildDidacticUnitResponse(didacticUnit, folderStore));
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid didactic unit request.",
      });
    }
  });

  router.get("/didactic-unit", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const didacticUnits = await didacticUnitStore.listByOwner(
      authenticatedRequest.currentUser.id,
    );

    response.json({
      didacticUnits: await buildDidacticUnitSummaryResponses(
        didacticUnits,
        folderStore,
        authenticatedRequest.currentUser.id,
        await generationRunStore.listByOwner(
          authenticatedRequest.currentUser.id,
        ),
      ),
    });
  });

  router.get("/didactic-unit/:id", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const didacticUnit = await didacticUnitStore.getById(
      authenticatedRequest.currentUser.id,
      String(request.params.id),
    );

    if (!didacticUnit) {
      response.status(404).json({ error: "Didactic unit not found." });
      return;
    }

    response.json(await buildDidacticUnitResponse(didacticUnit, folderStore));
  });

  router.delete("/didactic-unit/:id", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const deleted = await didacticUnitStore.deleteById(
      authenticatedRequest.currentUser.id,
      request.params.id,
    );

    if (!deleted) {
      response.status(404).json({ error: "Didactic unit not found." });
      return;
    }

    await didacticUnitNoteStore.deleteByUnit(
      authenticatedRequest.currentUser.id,
      request.params.id,
    );
    response.status(204).end();
  });

  router.patch("/didactic-unit/:id/folder", async (request, response) => {
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
      const parsedInput = parseUpdateDidacticUnitFolderInput(request.body);
      const foldersById = await loadFoldersById(
        folderStore,
        authenticatedRequest.currentUser.id,
      );

      const updatedDidacticUnit =
        parsedInput.folderSelection.mode === "manual"
          ? updateDidacticUnitFolder(
              didacticUnit,
              resolveFolderSelectionForManualMode(
                parsedInput.folderSelection,
                foldersById,
              ),
            )
          : updateDidacticUnitFolder(didacticUnit, {
              mode: "auto",
              folderId: (
                await resolveAutoAssignedFolderSelection({
                  didacticUnit,
                  folderStore,
                  aiConfigStore,
                  aiService,
                })
              ).folderId,
            });

      await didacticUnitStore.save(updatedDidacticUnit);
      response.json(
        await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
      );
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid didactic unit folder update request.",
      });
    }
  });

  router.patch("/didactic-unit/:id/theme", async (request, response) => {
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
      const body = request.body as { presentationTheme?: unknown };
      const presentationTheme =
        body.presentationTheme === null
          ? null
          : parsePresentationTheme(body.presentationTheme);
      const updatedDidacticUnit: DidacticUnit = {
        ...didacticUnit,
        presentationTheme,
        updatedAt: new Date().toISOString(),
      };
      await didacticUnitStore.save(updatedDidacticUnit);
      response.json(
        await buildDidacticUnitResponse(updatedDidacticUnit, folderStore),
      );
    } catch (error) {
      response.status(422).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid didactic unit theme update request.",
      });
    }
  });

  return router;
}
