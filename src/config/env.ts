import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  // MongoDB
  MONGODB_URI: z.string().url(),

  // AI Providers
  DEEPSEEK_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),

  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
