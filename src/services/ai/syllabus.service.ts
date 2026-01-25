import AjvModule from "ajv";
import { getAIClient, getModel } from "./client.js";
import { AIProvider } from "../../models/course.model.js";
import { syllabusSchema, Syllabus } from "../../models/schemas/syllabus.schema.js";

const Ajv = AjvModule.default || AjvModule;
const ajv = new Ajv();

export interface SyllabusGenerationResult {
  success: boolean;
  syllabus?: Syllabus;
  error?: string;
}

export async function generateSyllabus(
  improvedPrompt: string,
  level: string,
  provider: AIProvider,
  language: string,
  options?: { numLessons?: number; maxMinutes?: number }
): Promise<SyllabusGenerationResult> {
  const client = getAIClient(provider);
  const model = getModel(provider);

  const numLessons = options?.numLessons || 4;
  const maxMinutes = options?.maxMinutes || 600;

  const completion = await client.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          `You are a curriculum designer. RETURN ONLY a single valid JSON object that exactly matches the provided JSON schema. ` +
          `DO NOT output any explanations, commentary, <think> blocks, citations, or text outside the JSON. ` +
          `Do not include markdown, code fences, or any other content.\n\n` +
          `Estimate realistic durations based on learner level, topic complexity, and number of lessons. ` +
          `For beginners: assume 60-120 minutes per lesson. For intermediate: 120-180 minutes. For advanced: 180-240 minutes. ` +
          `Ensure total_duration_minutes ≈ sum(estimated_duration_minutes per module).\n\n` +
          `JSON schema (strictly follow types, required fields, and structure):\n` +
          `${JSON.stringify(syllabusSchema, null, 2)}`,
      },
      {
        role: "user",
        content:
          `Create a complete syllabus on the following topic: ${improvedPrompt}. ` +
          `The students have the following level: ${level}. ` +
          `The syllabus must have at least ${numLessons} lessons and the maximum duration must be less than ${maxMinutes} minutes. ` +
          `Ensure that each module logically builds upon the previous one and ends with a summary or applied project. ` +
          `Modules should progress from conceptual understanding → practical application → independent creation. ` +
          `For each lesson, include action verbs aligned with Bloom's taxonomy (e.g., define, explain, apply, analyze, create). \n\n` +
          `IMPORTANT: Generate the entire syllabus (titles, descriptions, keywords) in ${language}.`,
      },
    ],
    model,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    return { success: false, error: "No response from AI" };
  }

  try {
    const parsed = JSON.parse(content);
    const validate = ajv.compile(syllabusSchema);
    const isValid = validate(parsed);

    if (!isValid) {
      return {
        success: false,
        error: `Schema validation failed: ${JSON.stringify(validate.errors)}`,
      };
    }

    return { success: true, syllabus: parsed as unknown as Syllabus };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse syllabus: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
