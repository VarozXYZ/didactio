import OpenAI from "openai";
import { env } from "../../config/env.js";
import { AIProvider } from "../../models/course.model.js";

const providers: Record<AIProvider, { baseURL: string; apiKey: string }> = {
  deepseek: {
    baseURL: "https://api.deepseek.com",
    apiKey: env.DEEPSEEK_API_KEY,
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    apiKey: env.OPENAI_API_KEY || "",
  },
};

export function getAIClient(provider: AIProvider): OpenAI {
  const config = providers[provider];
  return new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
}

export function getModel(provider: AIProvider): string {
  return provider === "deepseek" ? "deepseek-reasoner" : "gpt-4o";
}
