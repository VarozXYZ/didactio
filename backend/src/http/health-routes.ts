import { Router } from "express";
import type { MongoHealthStatus } from "../mongo/mongo-connection.js";

export function createHealthRouter(mongoHealth: MongoHealthStatus): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "didactio-backend",
      mongo: mongoHealth,
    });
  });

  return router;
}
