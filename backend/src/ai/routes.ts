import express from "express";
import { parseAiConfigPatch } from "../ai/config.js";
import { MODEL_CATALOG } from "../ai/model-catalog.js";

import { asAuthenticatedRequest } from "../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../http/route-dependencies.js";

export function createAiRouter(
  dependencies: Pick<ProductRouteDependencies, "aiConfigStore">,
): express.Router {
  const { aiConfigStore } = dependencies;
  const router = express.Router();

  router.get("/ai-config", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    response.json(await aiConfigStore.get(authenticatedRequest.currentUser.id));
  });

  router.get("/ai-config/catalog", (_request, response) => {
    response.json(MODEL_CATALOG);
  });

  router.patch("/ai-config", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);

    try {
      const patch = parseAiConfigPatch(request.body);
      response.json(
        await aiConfigStore.update(authenticatedRequest.currentUser.id, patch),
      );
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Invalid AI config update request.",
      });
    }
  });

  return router;
}
