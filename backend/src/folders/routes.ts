import express from "express";
import { updateDidacticUnitFolder } from "../didactic-unit/update-didactic-unit-folder.js";
import {
  CUSTOM_FOLDER_COLOR,
  CUSTOM_FOLDER_ICON,
  ensureDefaultFolders,
  getGeneralFolder,
  MAX_FOLDER_NAME_LENGTH,
  normalizeFolderName,
  slugifyFolderName,
} from "../folders/folder-defaults.js";

import {
  buildFolderResponse,
  listFoldersWithUnitCounts,
} from "../didactic-unit/http/responses.js";
import { asAuthenticatedRequest } from "../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../http/route-dependencies.js";

export function createFoldersRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    "didacticUnitStore" | "folderStore"
  >,
): express.Router {
  const { didacticUnitStore, folderStore } = dependencies;
  const router = express.Router();

  router.get("/folders", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);

    response.json({
      folders: await listFoldersWithUnitCounts(
        folderStore,
        didacticUnitStore,
        authenticatedRequest.currentUser.id,
      ),
    });
  });

  router.post("/folders", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);

    try {
      if (!request.body || typeof request.body !== "object") {
        throw new Error("Request body must be a JSON object.");
      }

      const payload = request.body as {
        name?: unknown;
        icon?: unknown;
        color?: unknown;
      };
      const name = normalizeFolderName(
        typeof payload.name === "string" ? payload.name : "",
      );
      const icon =
        typeof payload.icon === "string" &&
        payload.icon.trim().length > 0 &&
        payload.icon.trim().length <= 16
          ? payload.icon.trim()
          : CUSTOM_FOLDER_ICON;
      const color =
        typeof payload.color === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(payload.color.trim())
          ? payload.color.trim()
          : CUSTOM_FOLDER_COLOR;

      if (!name) {
        throw new Error("Folder name is required.");
      }
      if (name.length > MAX_FOLDER_NAME_LENGTH) {
        throw new Error(
          `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer.`,
        );
      }

      const slug = slugifyFolderName(name);

      if (!slug) {
        throw new Error("Folder name must include letters or numbers.");
      }

      await ensureDefaultFolders(
        folderStore,
        authenticatedRequest.currentUser.id,
      );
      const existingFolder = await folderStore.getBySlug(
        authenticatedRequest.currentUser.id,
        slug,
      );

      if (existingFolder) {
        throw new Error("A folder with that name already exists.");
      }

      const folder = await folderStore.create({
        ownerId: authenticatedRequest.currentUser.id,
        name,
        slug,
        kind: "custom",
        icon,
        color,
      });

      response.status(201).json({
        ...buildFolderResponse(folder),
        unitCount: 0,
      });
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error ? error.message : "Invalid folder request.",
      });
    }
  });

  router.patch("/folders/:id", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const folder = await folderStore.getById(ownerId, request.params.id);

    if (!folder) {
      response.status(404).json({ error: "Folder not found." });
      return;
    }

    try {
      const payload = request.body as {
        name?: unknown;
        icon?: unknown;
        color?: unknown;
      };
      const patch: { name?: string; icon?: string; color?: string } = {};

      if (typeof payload.name === "string" && payload.name.trim()) {
        patch.name = normalizeFolderName(payload.name);
        if (patch.name.length > MAX_FOLDER_NAME_LENGTH) {
          throw new Error(
            `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or fewer.`,
          );
        }
      }
      if (
        typeof payload.icon === "string" &&
        payload.icon.trim().length > 0 &&
        payload.icon.trim().length <= 16
      ) {
        patch.icon = payload.icon.trim();
      }
      if (
        typeof payload.color === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(payload.color.trim())
      ) {
        patch.color = payload.color.trim();
      }

      const updated = await folderStore.updateById(
        ownerId,
        request.params.id,
        patch,
      );

      if (!updated) {
        response.status(404).json({ error: "Folder not found." });
        return;
      }

      const unitCount = (await didacticUnitStore.listByOwner(ownerId)).filter(
        (unit) => unit.folderId === updated.id,
      ).length;

      response.json({ ...buildFolderResponse(updated), unitCount });
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error ? error.message : "Invalid folder update.",
      });
    }
  });

  router.delete("/folders/:id", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const folder = await folderStore.getById(ownerId, request.params.id);

    if (!folder) {
      response.status(404).json({ error: "Folder not found." });
      return;
    }

    if (folder.slug === "general") {
      response
        .status(403)
        .json({ error: "The General folder cannot be removed." });
      return;
    }

    const generalFolder = await getGeneralFolder(folderStore, ownerId);
    const allUnits = await didacticUnitStore.listByOwner(ownerId);
    const unitsInFolder = allUnits.filter(
      (unit) => unit.folderId === folder.id,
    );

    await Promise.all(
      unitsInFolder.map((unit) =>
        didacticUnitStore.save(
          updateDidacticUnitFolder(unit, {
            mode: "manual",
            folderId: generalFolder.id,
          }),
        ),
      ),
    );

    await folderStore.deleteById(ownerId, request.params.id);
    response.status(204).end();
  });

  return router;
}
