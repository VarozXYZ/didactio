import express from "express";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📍 Environment: ${env.NODE_ENV}`);
  });
}

start();
