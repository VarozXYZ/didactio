import { getAIClient, getModel } from "./client.js";
import { AIProvider } from "../../models/course.model.js";

export interface PromptFilterResult {
  isValid: boolean;
  improvedPrompt?: string;
  rejectionReason?: string;
}

export async function filterAndImprovePrompt(
  userPrompt: string,
  level: string,
  provider: AIProvider
): Promise<PromptFilterResult> {
  const client = getAIClient(provider);
  const model = getModel(provider);

  const completion = await client.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a prompt filter and improver for an educational course creation platform.

Your job is to:
1. Validate that the topic is appropriate for educational content (reject harmful, illegal, or non-educational topics)
2. Improve vague prompts into clear, structured learning objectives
3. IMPORTANT: The course level is "${level}" - ensure the improved prompt targets this specific level

Return a JSON object with this exact structure:
{
  "isValid": true/false,
  "improvedPrompt": "the improved, detailed prompt targeting ${level} level" (only if valid),
  "rejectionReason": "reason for rejection" (only if invalid)
}

Return ONLY the JSON object, no other text.`,
      },
      {
        role: "user",
        content: `Evaluate and improve this course topic request for a ${level} level course: "${userPrompt}"`,
      },
    ],
    model,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    return { isValid: false, rejectionReason: "No response from AI" };
  }

  try {
    const result = JSON.parse(content);
    return {
      isValid: result.isValid,
      improvedPrompt: result.improvedPrompt,
      rejectionReason: result.rejectionReason,
    };
  } catch {
    return { isValid: false, rejectionReason: "Failed to parse AI response" };
  }
}
