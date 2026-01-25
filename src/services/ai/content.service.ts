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

**Key concepts already covered:**
${previousSummaries.map((s, i) => `- Module ${i + 1}: ${s}`).join("\n")}

Build upon their existing knowledge without re-explaining basic concepts.`
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

**Pedagogical Requirements**
- Each lesson must be written as a cohesive mini-chapter, not a list of tips.
- Use a 70/30 balance of conceptual depth and applied practice.
- Include:
  1. A detailed conceptual explanation (at least 3 paragraphs)
  2. A realistic example drawn from relevant domains
  3. A contrastive analysis (ineffective vs effective approaches)
  4. A "Common Mistakes" section
  5. A short, meaningful activity or reflection task
  6. A final section called "Why It Works" that explains the underlying principles

- Use clear markdown formatting for hierarchy.

**Output Format**
Return ONLY markdown-formatted educational content.

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
    }

    if (options.maxTokens) {
      apiOptions.max_tokens = options.maxTokens;
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
            "Extract the key concepts and topics covered in this educational content. Return a brief summary (2-3 sentences) that can be used as context for generating subsequent modules. Return ONLY the summary text, nothing else.",
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
