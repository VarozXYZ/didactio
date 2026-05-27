import express from "express";

import {
  buildUsageAnalytics,
  parseUsageAnalyticsPeriod,
} from "./usage-analytics.js";
import { asAuthenticatedRequest } from "../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../http/route-dependencies.js";

export function createAnalyticsRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    "didacticUnitStore" | "folderStore" | "generationRunStore"
  >,
): express.Router {
  const { didacticUnitStore, folderStore, generationRunStore } = dependencies;
  const router = express.Router();

  router.get("/analytics/usage", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);

    try {
      const period = parseUsageAnalyticsPeriod(request.query.period);
      response.json(
        await buildUsageAnalytics({
          ownerId: authenticatedRequest.currentUser.id,
          period,
          didacticUnitStore,
          folderStore,
          generationRunStore,
        }),
      );
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error ? error.message : "Invalid analytics request.",
      });
    }
  });

  return router;
}
