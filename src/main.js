import OpenAI from "openai";
import "dotenv/config";
import Ajv from "ajv";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const syllabusSchema = {
    type: "object",
  properties: {
        topic: {type: "string"},
        title: {type: "string"},
        keywords: {type: "string"},
        description: {type: "string"},
        total_duration_minutes: {type: "number"},
    modules: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: {type: "string"},
                    overview: {type: "string"},
                    estimated_duration_minutes: {type: "number"},
                    lessons: {
                        type: "array",
                        items: {
                            type: "object",
              properties: {
                                title: {type: "string"},
                content_outline: {
                                    type: "array",
                                    items: {type: "string"},
                                },
                            },
                            required: ["title", "content_outline"],
                        },
                    },
                },
                required: ["title", "lessons"],
            },
        },
    },
    required: ["topic", "title", "keywords", "description", "total_duration_minutes", "modules"],
};

// Initialize JSON Schema validator
const ajv = new Ajv();

const topic = "Prompt engineering";
const level = "beginner";
const num_lessons = 4;
const minutes = 600; // 10 hours = 600 minutes

/**
 * Converts completion output to JSON object
 * @param {string} completionContent - The raw content from the completion
 * @returns {Object|null} - Parsed JSON object or null if parsing fails
 */
function convertCompletionToJSON(completionContent) {
    try {
        // Clean the content by removing any potential markdown formatting
        const cleanedContent = completionContent.trim();

        // Try to parse as JSON
        const jsonData = JSON.parse(cleanedContent);
        return jsonData;
    } catch (error) {
        console.error("Error parsing completion content to JSON:", error.message);
        return null;
    }
}

/**
 * Validates JSON data against the syllabus schema
 * @param {Object} jsonData - The JSON data to validate
 * @param {Object} schema - The schema to validate against
 * @returns {Object} - Validation result with isValid and errors
 */
function validateAgainstSchema(jsonData, schema) {
    try {
        const validate = ajv.compile(schema);
        const isValid = validate(jsonData);

        return {
            isValid,
            errors: isValid ? null : validate.errors,
        };
    } catch (error) {
        console.error("Error validating schema:", error.message);
        return {
            isValid: false,
            errors: [{message: "Schema validation failed", error: error.message}],
        };
    }
}

/**
 * Complete function that converts completion to JSON and validates it
 * @param {string} completionContent - The raw content from the completion
 * @param {Object} schema - The schema to validate against
 * @returns {Object} - Result with parsed JSON, validation status, and errors
 */
function processCompletionOutput(completionContent, schema) {
    const jsonData = convertCompletionToJSON(completionContent);

    if (!jsonData) {
        return {
            success: false,
            jsonData: null,
            validation: {
                isValid: false,
                errors: [{message: "Failed to parse JSON from completion content"}],
            },
        };
    }

    const validation = validateAgainstSchema(jsonData, schema);

    return {
        success: true,
        jsonData,
        validation,
    };
}

/**
 * Creates a high-quality prompt for module completion
 * @param {Object} module - The module object from the syllabus
 * @param {number} moduleIndex - The index of the current module
 * @param {string} topic - The main topic of the syllabus
 * @param {string} level - The student level
 * @param {Object} syllabusData - The complete syllabus data for context
 * @returns {string} - The formatted prompt
 */
function createModulePrompt(module, moduleIndex, topic, level, syllabusData) {
    // Create context about the entire course structure
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
   - Overview: ${mod.overview}
    - Duration: ${mod.estimated_duration_minutes} minutes
   - Lessons: ${mod.lessons.map((lesson) => lesson.title).join(", ")}`;
        })
        .join("\n\n");

    // Get previous modules for prerequisite context
    const previousModules = syllabusData.modules.slice(0, moduleIndex);
    const prerequisiteContext =
        previousModules.length > 0
            ? `**Prerequisites (from previous modules):**
${previousModules.map((mod, index) => `${index + 1}. ${mod.title}: ${mod.overview}`).join("\n")}

**Key concepts students should already know:**
- Students have completed the above modules and understand the foundational concepts
- Build upon their existing knowledge without re-explaining basic concepts
- Reference previous learning when introducing new concepts`
            : `**Prerequisites:**
This is the first module, so assume students are starting fresh with the topic.`;

    // Get upcoming modules for forward context
    const upcomingModules = syllabusData.modules.slice(moduleIndex + 1);
    const forwardContext =
        upcomingModules.length > 0
            ? `**Upcoming modules (to prepare students for):**
${upcomingModules.map((mod, index) => `${moduleIndex + index + 2}. ${mod.title}: ${mod.overview}`).join("\n")}

**Preparation for future learning:**
- Introduce concepts that will be expanded in later modules
- Avoid covering topics that will be deeply explored in upcoming modules
- Create a foundation for the advanced concepts coming next`
            : `**Course completion:**
This is the final module. Focus on synthesis, application, and mastery of the entire topic.`;

    return `
    You are an expert curriculum designer and instructional design specialist with deep knowledge across diverse subject areas.


    **Course Overview:**
    - Main Topic: ${topic}
    - Student Level: ${level}
    - Total Course Duration: ${syllabusData.total_duration_minutes} minutes
    - Course Description: ${syllabusData.description}

    **Complete Course Structure:**
    ${courseContext}

    **Current Module Details:**
    - Module Title: ${module.title}
    - Module Overview: ${module.overview}
    - Estimated Duration: ${module.estimated_duration_minutes} minutes
    - Position in Course: Module ${moduleIndex + 1} of ${syllabusData.modules.length}

    ${prerequisiteContext}

    ${forwardContext}

    **Goals**
    Write comprehensive, engaging, *expert-level* educational content for this module.

    **Pedagogical Requirements**
    - Each lesson must be written as a cohesive mini-chapter, not a list of tips.
    - Use a 70/30 balance of conceptual depth and applied practice.
    - Include:
      1. A detailed conceptual explanation (at least 3 paragraphs)
      2. A realistic example drawn from relevant domains and real-world applications
      3. A contrastive analysis (ineffective vs effective approaches)
      4. A "Common Mistakes" section
      5. A short, meaningful activity or reflection task
      6. A final section called **Why It Works** that explains the underlying principles

    - Choose examples that are relevant to the subject matter and student level.
    - Use clear markdown formatting for hierarchy (### headings, bullet points only when useful).
    - Keep tone professional, slightly conversational, with cognitive hooks and reasoning explanations.

    **Course Structure Guidelines**
    - Ensure the modules progress logically from foundational concepts to advanced application.
    - Each module should have a distinct learning purpose and not overlap with others.
    - Ensure total estimated duration aligns with realistic student pacing (1–2 hours per lesson maximum for beginner level).
    - Module overviews must directly connect to the main topic and clearly state what skills the student will gain.
    - Lessons should follow a progression within each module: 
      1) concept introduction, 
      2) guided application, 
      3) independent or creative application.
    - Vary domains and use cases relevant to the subject matter to keep engagement high.
    - Include a "practical project" in the final module to synthesize learning.
    - Prioritize conceptual balance over exhaustive coverage — conciseness is a virtue.
    - When appropriate, simulate instructor–student dialogue for engagement ("Let's test this idea: what happens if…").
    - Include one short "knowledge check" quiz (3 questions) per module.

    **Lesson Structure Requirements**
    - Begin each lesson with a 2-sentence bridge from the previous lesson.
    - At the end of each module, include:
      - A brief reflection question ("What new insight surprised you?")
      - 2-3 bullet key takeaways ("You now understand…")
    - Ensure each real-world example is from a different domain than the previous module (to maximize transfer of learning).
    - Conclude every module with a short "Meta-connection" section explaining how these skills prepare for the next module.
    - For activity design, ensure cognitive load balance: one reflective, one practical.

    **Output Format**
    Return ONLY markdown-formatted educational content. No commentary or text outside markdown.

    **Current Module Lessons to Cover:**
    ${module.lessons.map((lesson, index) => `${index + 1}. ${lesson.title}`).join("\n")}

    Begin creating the module content now:`;
}

/**
 * Saves module content to a single comprehensive course file
 * @param {string} content - The markdown content to save
 * @param {string} moduleTitle - The title of the module
 * @param {number} moduleIndex - The index of the module
 * @param {string} courseTitle - The title of the entire course
 * @param {boolean} isFirstModule - Whether this is the first module being written
 * @returns {string} - The file path where content was saved
 */
function saveModuleContent(content, moduleTitle, moduleIndex, courseTitle, isFirstModule = false) {
    try {
        // Create output directory if it doesn't exist
        const outputDir = path.join(process.cwd(), "output");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }

        // Create a single course file
        const sanitizedCourseTitle = courseTitle.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
        const filename = `${sanitizedCourseTitle}_Complete_Course.md`;
        const filePath = path.join(outputDir, filename);

        // Prepare module header
        const moduleHeader = `\n\n# Module ${moduleIndex + 1}: ${moduleTitle}\n\n`;
        
        if (isFirstModule) {
            // Create the file with course header and first module
            const courseHeader = `# ${courseTitle}\n\n*Complete Course Content*\n\n`;
            const fullContent = courseHeader + moduleHeader + content;
            fs.writeFileSync(filePath, fullContent, "utf8");
            console.log(`📚 Course file created: ${filePath}`);
        } else {
            // Append to existing file
            const moduleContent = moduleHeader + content;
            fs.appendFileSync(filePath, moduleContent, "utf8");
            console.log(`📝 Module ${moduleIndex + 1} added to course file`);
        }

        return filePath;
    } catch (error) {
        console.error(`❌ Error saving module content:`, error.message);
        throw error;
    }
}

/**
 * Processes a single module with AI completion
 * @param {Object} module - The module object to process
 * @param {number} moduleIndex - The index of the module
 * @param {string} topic - The main topic
 * @param {string} level - The student level
 * @param {Object} syllabusData - The complete syllabus data for context
 * @returns {Object} - Result object with success status and details
 */
async function processModule(module, moduleIndex, topic, level, syllabusData) {
    const startTime = Date.now();
    console.log(`\n🚀 Starting module ${moduleIndex + 1}: "${module.title}"`);
    console.log(`📊 Module has ${module.lessons.length} lessons`);
    console.log(`⏱️  Estimated duration: ${module.estimated_duration_minutes} minutes`);

    try {
        // Create the prompt for this module
        const prompt = createModulePrompt(module, moduleIndex, topic, level, syllabusData);

        console.log(`🤖 Sending request to DeepSeek API...`);

        // Make the API call
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert educational content creator specializing in creating comprehensive, engaging learning materials for any subject matter. Create high-quality educational content in markdown format that focuses on clarity, engagement, and practical application across diverse domains.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            model: "deepseek-reasoner",
            temperature: 0.7,
            max_tokens: 4000,
        });

        const content = completion.choices[0].message.content;
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.log(`✅ Module ${moduleIndex + 1} completed in ${duration.toFixed(2)} seconds`);
        console.log(`📝 Content length: ${content.length} characters`);

        // Save the content to file
        const isFirstModule = moduleIndex === 0;
        const filePath = saveModuleContent(content, module.title, moduleIndex, syllabusData.title, isFirstModule);

        return {
            success: true,
            moduleIndex,
            moduleTitle: module.title,
            content,
            filePath,
            duration,
            contentLength: content.length,
        };
    } catch (error) {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        console.error(`❌ Error processing module ${moduleIndex + 1} ("${module.title}"):`, error.message);
        console.error(`⏱️  Failed after ${duration.toFixed(2)} seconds`);

        return {
            success: false,
            moduleIndex,
            moduleTitle: module.title,
            error: error.message,
            duration,
        };
    }
}

/**
 * Processes all modules from a syllabus using prompt chaining
 * @param {Object} syllabusData - The validated syllabus JSON data
 * @param {string} topic - The main topic
 * @param {string} level - The student level
 * @returns {Object} - Summary of all processing results
 */
async function processAllModules(syllabusData, topic, level) {
    console.log(`\n🎯 Starting prompt chaining for ${syllabusData.modules.length} modules`);
    console.log(`📚 Topic: ${topic}`);
    console.log(`🎓 Level: ${level}`);

    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < syllabusData.modules.length; i++) {
        const module = syllabusData.modules[i];
        console.log(`\n${"=".repeat(60)}`);
        console.log(`📖 Processing Module ${i + 1}/${syllabusData.modules.length}`);

        const result = await processModule(module, i, topic, level, syllabusData);
        results.push(result);

        // Add a small delay between requests to be respectful to the API
        if (i < syllabusData.modules.length - 1) {
            console.log(`⏳ Waiting 2 seconds before next module...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }

    const totalTime = (Date.now() - startTime) / 1000;

    // Generate summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 PROMPT CHAINING SUMMARY`);
    console.log(`✅ Successful modules: ${successful}/${syllabusData.modules.length}`);
    console.log(`❌ Failed modules: ${failed}/${syllabusData.modules.length}`);
    console.log(`⏱️  Total processing time: ${totalTime.toFixed(2)} seconds`);

    if (successful > 0) {
        console.log(`\n📁 Generated course file:`);
        const successfulResults = results.filter((r) => r.success);
        if (successfulResults.length > 0) {
            console.log(`   - ${successfulResults[0].filePath}`);
            console.log(`   - Contains ${successfulResults.length} modules`);
        }
    }

    if (failed > 0) {
        console.log(`\n❌ Failed modules:`);
        results
            .filter((r) => !r.success)
            .forEach((result) => {
                console.log(`   - Module ${result.moduleIndex + 1}: ${result.moduleTitle} (${result.error})`);
            });
    }

    return {
        totalModules: syllabusData.modules.length,
        successful,
        failed,
        totalTime,
        results,
    };
}

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: "system",
                content: `You are a curriculum designer. RETURN ONLY a single valid JSON object that exactly matches the provided JSON schema. ` + `DO NOT output any explanations, commentary, <think> blocks, citations, or text outside the JSON. ` + `Do not include markdown, code fences, or any other content.\n\n` + `Estimate realistic durations based on learner level, topic complexity, and number of lessons. For beginners: assume 60-120 minutes per lesson (content + exercises). For intermediate: 120-180 minutes. For advanced: 180-240 minutes. Ensure total_duration_minutes ≈ sum(estimated_duration_minutes per module).` + `JSON schema (strictly follow types, required fields, and structure; no extra keys):\n` + `${JSON.stringify(syllabusSchema, null, 2)}`,
            },
            {
                role: "user",
                content: `Create a complete syllabus on the following topic: ${topic}. The students have the following level: ${level}. For that reason, the syllabus must have at least ${num_lessons} lessons and the maximum duration must be less than ${minutes} minutes` + "Ensure that each module logically builds upon the previous one and ends with a summary or applied project. Modules should progress from conceptual understanding → practical application → independent creation. For each lesson, include action verbs aligned with Bloom's taxonomy (e.g., define, explain, apply, analyze, create)",
            },
    ],
    model: "deepseek-reasoner",
        response_format: {type: "json_object"},
    });

    const completionContent = completion.choices[0].message.content;

    // Process the completion output: convert to JSON and validate against schema
    const result = processCompletionOutput(completionContent, syllabusSchema);

    console.log("=== COMPLETION RESULT ===");
    console.log("Success:", result.success);

    if (result.success) {
        console.log("\n=== PARSED JSON ===");
        console.log(JSON.stringify(result.jsonData, null, 2));

        console.log("\n=== VALIDATION RESULT ===");
        console.log("Is Valid:", result.validation.isValid);

        if (!result.validation.isValid) {
            console.log("\n=== VALIDATION ERRORS ===");
            console.log(JSON.stringify(result.validation.errors, null, 2));
        } else {
            console.log("✅ JSON structure complies with syllabusSchema!");

            // Start prompt chaining for all modules
            console.log("\n" + "=".repeat(80));
            console.log("🚀 STARTING PROMPT CHAINING PROCESS");
            console.log("=".repeat(80));

            const chainingResult = await processAllModules(result.jsonData, topic, level);

            console.log("\n" + "=".repeat(80));
            console.log("🎉 PROMPT CHAINING COMPLETED");
            console.log("=".repeat(80));
            console.log(`📊 Final Summary:`);
            console.log(`   - Total modules processed: ${chainingResult.totalModules}`);
            console.log(`   - Successful: ${chainingResult.successful}`);
            console.log(`   - Failed: ${chainingResult.failed}`);
            console.log(`   - Total time: ${chainingResult.totalTime.toFixed(2)} seconds`);
        }
    } else {
        console.log("\n=== ERROR ===");
        console.log("Failed to process completion output");
        if (result.validation.errors) {
            console.log("Errors:", JSON.stringify(result.validation.errors, null, 2));
        }
    }
}

main();
