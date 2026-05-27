import express from "express";
import { openNdjsonStream, writeNdjsonEvent } from "../ai/ndjson.js";
import {
  type ChapterGenerationRunRecord,
  type GenerationRun,
} from "../generation-runs/generation-run-store.js";

import { isTerminalGenerationRun } from "../http/api-helpers.js";
import { asAuthenticatedRequest } from "../http/authenticated-user.js";
import type { ProductRouteDependencies } from "../http/route-dependencies.js";

export function createGenerationRunsRouter(
  dependencies: Pick<
    ProductRouteDependencies,
    "generationRunStore" | "activeGenerationControllers"
  >,
): express.Router {
  const { generationRunStore, activeGenerationControllers } = dependencies;
  const router = express.Router();

  router.post("/generation-runs/:runId/cancel", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const runId = String(request.params.runId);
    const run = await generationRunStore.getById(ownerId, runId);

    if (!run) {
      response.status(404).json({ error: "Generation run not found." });
      return;
    }

    if (isTerminalGenerationRun(run)) {
      response
        .status(409)
        .json({ error: "Generation run is already complete." });
      return;
    }

    activeGenerationControllers.get(runId)?.abort();
    activeGenerationControllers.delete(runId);

    await generationRunStore.save({
      ...run,
      status: "failed",
      error: "Cancelled by user.",
      errorMessage: "Cancelled by user.",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    } as ChapterGenerationRunRecord);

    response.status(200).json({ ok: true });
  });

  router.get("/generation-runs/:runId", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const run = await generationRunStore.getById(
      authenticatedRequest.currentUser.id,
      String(request.params.runId),
    );
    if (!run) {
      response.status(404).json({ error: "Generation run not found." });
      return;
    }

    response.json({ run });
  });

  router.get("/generation-runs/:runId/stream", async (request, response) => {
    const authenticatedRequest = asAuthenticatedRequest(request);
    const ownerId = authenticatedRequest.currentUser.id;
    const runId = String(request.params.runId);
    let run = await generationRunStore.getById(ownerId, runId);
    if (!run) {
      response.status(404).json({ error: "Generation run not found." });
      return;
    }

    openNdjsonStream(response);
    writeNdjsonEvent(response, {
      type: "start",
      stage: run.stage === "chapter" ? "module" : run.stage,
      provider: run.provider,
      model: run.model,
    });

    let emittedCount = 0;
    const replay = (current: GenerationRun) => {
      if (current.stage !== "chapter") {
        return;
      }
      const blocks = current.emittedBlocks ?? [];
      for (const block of blocks.slice(emittedCount)) {
        writeNdjsonEvent(response, { type: "partial_html_block", block });
      }
      emittedCount = blocks.length;
    };

    replay(run);
    if (isTerminalGenerationRun(run)) {
      if (run.status === "completed") {
        writeNdjsonEvent(response, { type: "complete", data: { run } });
      } else {
        writeNdjsonEvent(response, {
          type: "error",
          message: run.errorMessage ?? run.error ?? "Generation failed.",
          data: { run },
        });
      }
      response.end();
      return;
    }

    const interval = setInterval(async () => {
      run = await generationRunStore.getById(ownerId, runId);
      if (!run) {
        clearInterval(interval);
        writeNdjsonEvent(response, {
          type: "error",
          message: "Generation run was removed.",
        });
        response.end();
        return;
      }
      replay(run);
      if (!isTerminalGenerationRun(run)) {
        return;
      }

      clearInterval(interval);
      if (run.status === "completed") {
        writeNdjsonEvent(response, { type: "complete", data: { run } });
      } else {
        writeNdjsonEvent(response, {
          type: "error",
          message: run.errorMessage ?? run.error ?? "Generation failed.",
          data: { run },
        });
      }
      response.end();
    }, 500);

    request.on("close", () => {
      clearInterval(interval);
    });
  });

  return router;
}
