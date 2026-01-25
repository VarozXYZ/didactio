import { getAIClient, getModel } from "./client.js";
import { AIProvider, Tone, Technicality, TONE_INSTRUCTIONS, TECHNICALITY_INSTRUCTIONS } from "../../models/course.model.js";
import { Syllabus, Module } from "../../models/schemas/syllabus.schema.js";

export interface ModuleGenerationResult {
  success: boolean;
  content?: string;
  summary?: string;
  error?: string;
}

export interface ContentGenerationOptions {
  tone: Tone;
  technicality: Technicality;
  additionalContext?: string;
  maxTokens?: number;
}

function createModulePrompt(
  module: Module,
  moduleIndex: number,
  syllabusData: Syllabus,
  level: string,
  previousSummaries: string[],
  options: ContentGenerationOptions
): string {
  const courseContext = syllabusData.modules
    .map((mod, index) => {
      const isCurrent = index === moduleIndex;
      const isPrevious = index < moduleIndex;
      const isNext = index > moduleIndex;

      let status = "";
      if (isCurrent) status = " (CURRENT MODULE)";
      else if (isPrevious) status = " (COMPLETED)";
      else if (isNext) status = " (UPCOMING)";

      return `${index + 1}. ${mod.title}${status}
   - Overview: ${mod.overview || ""}
   - Duration: ${mod.estimated_duration_minutes || 0} minutes
   - Lessons: ${mod.lessons.map((lesson) => lesson.title).join(", ")}`;
    })
    .join("\n\n");

  const previousModules = syllabusData.modules.slice(0, moduleIndex);
  const prerequisiteContext =
    previousModules.length > 0
      ? `**Prerequisites (from previous modules):**
${previousModules.map((mod, index) => `${index + 1}. ${mod.title}: ${mod.overview || ""}`).join("\n")}

**Key concepts ALREADY covered (DO NOT RE-EXPLAIN THESE):**
${previousSummaries.map((s, i) => `### Module ${i + 1} Concepts:\n${s}`).join("\n\n")}

Instructions:
- Assume the student has mastered the concepts listed above.
- Do not define terms that were already defined in previous modules.
- Build upon this existing knowledge foundation.`
      : `**Prerequisites:**
This is the first module, so assume students are starting fresh with the topic.`;

  const upcomingModules = syllabusData.modules.slice(moduleIndex + 1);
  const forwardContext =
    upcomingModules.length > 0
      ? `**Upcoming modules (to prepare students for):**
${upcomingModules.map((mod, index) => `${moduleIndex + index + 2}. ${mod.title}: ${mod.overview || ""}`).join("\n")}

Introduce concepts that will be expanded in later modules. Avoid covering topics that will be deeply explored in upcoming modules.`
      : `**Course completion:**
This is the final module. Focus on synthesis, application, and mastery of the entire topic.`;

  const toneInstruction = TONE_INSTRUCTIONS[options.tone];
  const technicalityInstruction = TECHNICALITY_INSTRUCTIONS[options.technicality];
  
  const additionalContextSection = options.additionalContext 
    ? `\n**Student additional context:**\n${options.additionalContext}\n\nTailor the content to address these specific needs and goals.`
    : "";

  return `You are an expert curriculum designer.

**Course Overview:**
- Main Topic: ${syllabusData.topic}
- Student Level: ${level}
- Total Course Duration: ${syllabusData.total_duration_minutes} minutes
- Course Description: ${syllabusData.description}
${additionalContextSection}

**Complete Course Structure:**
${courseContext}

**Current Module Details:**
- Module Title: ${module.title}
- Module Overview: ${module.overview || ""}
- Estimated Duration: ${module.estimated_duration_minutes || 0} minutes
- Position in Course: Module ${moduleIndex + 1} of ${syllabusData.modules.length}

${prerequisiteContext}

${forwardContext}

**Writing Style Requirements:**
- Tone: ${toneInstruction}
- Technical Level: ${technicalityInstruction}

**Pedagogical Requirements (Dynamic Structure)**
- **Do NOT use generic headings** like "Concept Explanation", "Practical Example", or "Common Mistakes" repeatedly.
- Instead, **weave these elements naturally** into the narrative using headings specific to the topic (e.g., instead of "Example", use "Real-world Scenario: Scaling a Node.js API").
- Ensure all these components are present but integrated organically:
  1. Deep conceptual explanation
  2. Realistic, industry-relevant examples
  3. Comparison of approaches (ineffective vs effective)
  4. Warnings about common pitfalls
  5. Practical application or reflection
  6. Underlying principles ("Why it works")

- The structure should flow logically as a chapter, not a checklist.
- Use clear markdown hierarchy.

**Output Format**
Return ONLY markdown-formatted educational content.
- **Do NOT** include the module title (e.g., "# Module 1...")
- **Do NOT** include the "Module Overview" at the beginning.
- Start directly with the content.

**Current Module Lessons to Cover:**
${module.lessons.map((lesson, index) => `${index + 1}. ${lesson.title}`).join("\n")}

Begin creating the module content now:`;
}

export async function generateModuleContent(
  module: Module,
  moduleIndex: number,
  syllabusData: Syllabus,
  level: string,
  previousSummaries: string[],
  provider: AIProvider,
  options: ContentGenerationOptions
): Promise<ModuleGenerationResult> {
  const client = getAIClient(provider);
  const model = getModel(provider);

  try {
    const prompt = createModulePrompt(module, moduleIndex, syllabusData, level, previousSummaries, options);

    const apiOptions: {
      messages: Array<{ role: "system" | "user"; content: string }>;
      model: string;
      temperature?: number;
      max_tokens?: number;
      max_completion_tokens?: number;
    } = {
      messages: [
        {
          role: "system",
          content:
            "You are an expert educational content creator. Create high-quality educational content in markdown format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model,
    };

    if (provider === "deepseek") {
      apiOptions.temperature = 0.7;
      if (options.maxTokens) {
        apiOptions.max_tokens = options.maxTokens;
      }
    } else if (provider === "openai" && options.maxTokens) {
      apiOptions.max_completion_tokens = options.maxTokens;
    }

    const completion = await client.chat.completions.create(apiOptions);

    const content = completion.choices[0].message.content;
    if (!content) {
      return { success: false, error: "No response from AI" };
    }

    const summary = await extractModuleSummary(content, provider);

    return { success: true, content, summary };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate module content: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function extractModuleSummary(content: string, provider: AIProvider): Promise<string> {
  const client = getAIClient(provider);
  const model = getModel(provider);

  try {
    const apiOptions: {
      messages: Array<{ role: "system" | "user"; content: string }>;
      model: string;
      temperature?: number;
    } = {
      messages: [
        {
          role: "system",
          content:
            "Analyze the content and extract a concise, schematic list of key concepts, definitions, and techniques covered. Return a markdown bullet list (max 10 items). Do not use full sentences. Focus on what was explicitly taught. Return ONLY the list.",
        },
        {
          role: "user",
          content: content,
        },
      ],
      model,
    };

    if (provider === "deepseek") {
      apiOptions.temperature = 0.7;
    }

    const completion = await client.chat.completions.create(apiOptions);

    return completion.choices[0].message.content || "Summary not available";
  } catch {
    return "Summary extraction failed";
  }
}
