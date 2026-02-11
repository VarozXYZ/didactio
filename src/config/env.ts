import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  MONGODB_URI: z.string().url(),
  DEEPSEEK_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(604800),
  JWT_REFRESH_EXPIRES_IN_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2592000),
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
