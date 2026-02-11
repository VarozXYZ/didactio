import { Course, ICourse, AIProvider, ContentLength, Tone, Technicality, CONTENT_LENGTH_TOKENS, TONE_INSTRUCTIONS, TECHNICALITY_INSTRUCTIONS } from "../models/course.model.js";
import { Module } from "../models/schemas/syllabus.schema.js";
import { filterAndImprovePrompt } from "./ai/prompt.service.js";
import { generateSyllabus } from "./ai/syllabus.service.js";
import { generateModuleContent } from "./ai/content.service.js";

export interface CreateCourseInput {
  ownerId: string;
  topic: string;
  level: string;
  provider?: AIProvider;
  contentLength: ContentLength;
  tone: Tone;
  technicality: Technicality;
  language: string;
  additionalContext?: string;
  options?: { numLessons?: number; maxMinutes?: number };
}

export async function createCourse(input: CreateCourseInput): Promise<ICourse> {
  const provider = input.provider || "deepseek";

  const course = new Course({
    owner: input.ownerId,
    status: "filtering_prompt",
    provider,
    contentLength: input.contentLength,
    tone: input.tone,
    technicality: input.technicality,
    language: input.language,
    additionalContext: input.additionalContext,
    originalPrompt: input.topic,
    level: input.level,
    modules: [],
    iterationSummaries: [],
  });
  await course.save();

  processCourseAsync(course._id.toString(), input, provider);

  return course;
}

async function processCourseAsync(
  courseId: string,
  input: CreateCourseInput,
  provider: AIProvider
): Promise<void> {
  try {
    const course = await Course.findById(courseId);
    if (!course) return;

    console.log(`[Course ${courseId}] Starting prompt filtering...`);
    const filterResult = await filterAndImprovePrompt(input.topic, input.level, provider);
    if (!filterResult.isValid) {
      course.status = "error";
      course.errorMessage = filterResult.rejectionReason;
      await course.save();
      console.log(`[Course ${courseId}] Prompt rejected: ${filterResult.rejectionReason}`);
      return;
    }

    course.improvedPrompt = filterResult.improvedPrompt;
    course.status = "generating_syllabus";
    await course.save();
    console.log(`[Course ${courseId}] Prompt improved, generating syllabus...`);

    const syllabusResult = await generateSyllabus(
      filterResult.improvedPrompt!,
      input.level,
      provider,
      input.language,
      input.options
    );

    if (!syllabusResult.success) {
      course.status = "error";
      course.errorMessage = syllabusResult.error;
      await course.save();
      console.log(`[Course ${courseId}] Syllabus generation failed: ${syllabusResult.error}`);
      return;
    }

    course.syllabus = syllabusResult.syllabus;
    course.status = "generating_content";
    await course.save();
    console.log(`[Course ${courseId}] Syllabus created with ${syllabusResult.syllabus!.modules.length} modules`);

    const summaries: string[] = [];
    let failedModules: string[] = [];

    for (let i = 0; i < syllabusResult.syllabus!.modules.length; i++) {
      const module = syllabusResult.syllabus!.modules[i];
      console.log(`[Course ${courseId}] Generating module ${i + 1}/${syllabusResult.syllabus!.modules.length}: ${module.title}`);

      try {
        const contentResult = await generateModuleContent(
          module,
          i,
          syllabusResult.syllabus!,
          input.level,
          summaries,
          provider,
          {
            tone: input.tone,
            technicality: input.technicality,
            language: input.language,
            additionalContext: input.additionalContext,
            maxTokens: CONTENT_LENGTH_TOKENS[input.contentLength],
          }
        );

        if (contentResult.success) {
          course.modules.push({
            ...module,
            generatedContent: contentResult.content,
            summary: contentResult.summary,
          });

          if (contentResult.summary) {
            summaries.push(contentResult.summary);
            course.iterationSummaries.push(contentResult.summary);
          }

          await course.save();
          console.log(`[Course ${courseId}] Module ${i + 1} completed (${contentResult.content?.length || 0} chars)`);
        } else {
          console.log(`[Course ${courseId}] Module ${i + 1} failed: ${contentResult.error}`);
          failedModules.push(`Module ${i + 1} (${module.title}): ${contentResult.error}`);
        }
      } catch (moduleError) {
        const errorMsg = moduleError instanceof Error ? moduleError.message : "Unknown error";
        console.log(`[Course ${courseId}] Module ${i + 1} exception: ${errorMsg}`);
        failedModules.push(`Module ${i + 1} (${module.title}): ${errorMsg}`);
      }
    }

    if (course.modules.length === 0) {
      course.status = "error";
      course.errorMessage = `All modules failed to generate. Errors: ${failedModules.join("; ")}`;
    } else if (failedModules.length > 0) {
      course.status = "ready";
      course.errorMessage = `Completed with ${failedModules.length} failed modules: ${failedModules.join("; ")}`;
    } else {
      course.status = "ready";
    }
    
    await course.save();
    console.log(`[Course ${courseId}] Finished. Status: ${course.status}, Modules: ${course.modules.length}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Course ${courseId}] Fatal error: ${errorMsg}`);
    const course = await Course.findById(courseId);
    if (course) {
      course.status = "error";
      course.errorMessage = errorMsg;
      await course.save();
    }
  }
}

export async function getCourse(courseId: string): Promise<ICourse | null> {
  return Course.findById(courseId);
}

export async function listCourses(): Promise<ICourse[]> {
  return Course.find().sort({ createdAt: -1 });
}

export async function listCoursesByOwner(ownerId: string): Promise<ICourse[]> {
  return Course.find({ owner: ownerId }).sort({ createdAt: -1 });
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  const result = await Course.findByIdAndDelete(courseId);
  return result !== null;
}

export async function regenerateSection(
  courseId: string,
  moduleIndex: number,
  userContext: string,
  provider?: AIProvider
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course || !course.syllabus) return null;

  const useProvider = provider || course.provider;
  const module = course.syllabus.modules[moduleIndex];
  if (!module) return null;

  const previousSummaries = course.iterationSummaries.slice(0, moduleIndex);

  const syllabusWithContext = {
    ...course.syllabus,
    description: `${course.syllabus.description}\n\nAdditional context for regeneration: ${userContext}`,
  };

  const contentResult = await generateModuleContent(
    module,
    moduleIndex,
    syllabusWithContext,
    course.level,
    previousSummaries,
    useProvider,
    {
      tone: course.tone,
      technicality: course.technicality,
      language: course.language,
      additionalContext: userContext || course.additionalContext,
      maxTokens: CONTENT_LENGTH_TOKENS[course.contentLength],
    }
  );

  if (contentResult.success) {
    course.modules[moduleIndex] = {
      ...module,
      generatedContent: contentResult.content,
      summary: contentResult.summary,
    };

    if (contentResult.summary) {
      course.iterationSummaries[moduleIndex] = contentResult.summary;
    }

    await course.save();
  }

  return course;
}

export async function resumeCourse(
  courseId: string,
  provider?: AIProvider
): Promise<ICourse | null> {
  const course = await Course.findById(courseId);
  if (!course || !course.syllabus) return null;

  const useProvider = provider || course.provider;
  const totalModules = course.syllabus.modules.length;
  const generatedModulesTitles = new Set(course.modules.map(m => m.title));

  const missingModules: { index: number; module: typeof course.syllabus.modules[0] }[] = [];
  for (let i = 0; i < totalModules; i++) {
    const syllabusModule = course.syllabus.modules[i];
    if (!generatedModulesTitles.has(syllabusModule.title)) {
      missingModules.push({ index: i, module: syllabusModule });
    }
  }

  if (missingModules.length === 0) {
    course.status = "ready";
    course.errorMessage = undefined;
    await course.save();
    return course;
  }

  console.log(`[Course ${courseId}] Resuming generation. Missing ${missingModules.length} modules.`);
  course.status = "generating_content";
  course.errorMessage = undefined;
  await course.save();

  resumeCourseAsync(courseId, missingModules, useProvider);

  return course;
}

async function resumeCourseAsync(
  courseId: string,
  missingModules: { index: number; module: Module }[],
  provider: AIProvider
): Promise<void> {
  try {
    const course = await Course.findById(courseId);
    if (!course || !course.syllabus) return;

    const failedModules: string[] = [];

    for (const { index, module } of missingModules) {
      console.log(`[Course ${courseId}] Resuming module ${index + 1}/${course.syllabus.modules.length}: ${module.title}`);

      const previousSummaries = course.iterationSummaries.slice(0, index);

      try {
        const contentResult = await generateModuleContent(
          module as Module,
          index,
          course.syllabus,
          course.level,
          previousSummaries,
          provider,
          {
            tone: course.tone,
            technicality: course.technicality,
            language: course.language,
            additionalContext: course.additionalContext,
            maxTokens: CONTENT_LENGTH_TOKENS[course.contentLength],
          }
        );

        if (contentResult.success) {
          const existingModuleIndex = course.modules.findIndex(m => m.title === module.title);
          
          const syllabusModule = course.syllabus!.modules[index];
          const newModule = {
            title: syllabusModule.title,
            overview: syllabusModule.overview,
            estimated_duration_minutes: syllabusModule.estimated_duration_minutes,
            lessons: syllabusModule.lessons,
            generatedContent: contentResult.content,
            summary: contentResult.summary,
          };

          if (existingModuleIndex >= 0) {
            course.modules[existingModuleIndex] = newModule;
          } else {
            course.modules.push(newModule);
          }

          if (contentResult.summary) {
            course.iterationSummaries[index] = contentResult.summary;
          }

          await course.save();
          console.log(`[Course ${courseId}] Module ${index + 1} completed (${contentResult.content?.length || 0} chars)`);
        } else {
          console.log(`[Course ${courseId}] Module ${index + 1} failed: ${contentResult.error}`);
          failedModules.push(`Module ${index + 1} (${module.title}): ${contentResult.error}`);
        }
      } catch (moduleError) {
        const errorMsg = moduleError instanceof Error ? moduleError.message : "Unknown error";
        console.log(`[Course ${courseId}] Module ${index + 1} exception: ${errorMsg}`);
        failedModules.push(`Module ${index + 1} (${module.title}): ${errorMsg}`);
      }
    }

    course.modules.sort((a, b) => {
      const indexA = course.syllabus!.modules.findIndex(m => m.title === a.title);
      const indexB = course.syllabus!.modules.findIndex(m => m.title === b.title);
      return indexA - indexB;
    });

    if (course.modules.length === course.syllabus.modules.length) {
      course.status = "ready";
      course.errorMessage = failedModules.length > 0 
        ? `Completed with some issues: ${failedModules.join("; ")}` 
        : undefined;
    } else if (failedModules.length > 0) {
      course.status = "error";
      course.errorMessage = `Resume failed for some modules: ${failedModules.join("; ")}`;
    }

    await course.save();
    console.log(`[Course ${courseId}] Resume finished. Status: ${course.status}, Modules: ${course.modules.length}/${course.syllabus.modules.length}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Course ${courseId}] Resume fatal error: ${errorMsg}`);
    const course = await Course.findById(courseId);
    if (course) {
      course.status = "error";
      course.errorMessage = errorMsg;
      await course.save();
    }
  }
}

