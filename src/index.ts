import express from "express";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import routes from "./routes/index.js";
import { errorMiddleware } from "./middleware/error.middleware.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", routes);

app.use(errorMiddleware);

async function start() {
  await connectDatabase();

  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${env.PORT}`);
    console.log(`📍 Environment: ${env.NODE_ENV}`);
  });
}

start();
