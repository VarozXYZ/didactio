import { Course, ICourse, AIProvider } from "../models/course.model.js";
import { filterAndImprovePrompt } from "./ai/prompt.service.js";
import { generateSyllabus } from "./ai/syllabus.service.js";
import { generateModuleContent } from "./ai/content.service.js";

export interface CreateCourseInput {
  topic: string;
  level: string;
  provider?: AIProvider;
  options?: { numLessons?: number; maxMinutes?: number };
}

export async function createCourse(input: CreateCourseInput): Promise<ICourse> {
  const provider = input.provider || "deepseek";

  const course = new Course({
    status: "filtering_prompt",
    provider,
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

    const filterResult = await filterAndImprovePrompt(input.topic, provider);
    if (!filterResult.isValid) {
      course.status = "error";
      course.errorMessage = filterResult.rejectionReason;
      await course.save();
      return;
    }

    course.improvedPrompt = filterResult.improvedPrompt;
    course.status = "generating_syllabus";
    await course.save();

    const syllabusResult = await generateSyllabus(
      filterResult.improvedPrompt!,
      input.level,
      provider,
      input.options
    );

    if (!syllabusResult.success) {
      course.status = "error";
      course.errorMessage = syllabusResult.error;
      await course.save();
      return;
    }

    course.syllabus = syllabusResult.syllabus;
    course.status = "generating_content";
    await course.save();

    const summaries: string[] = [];
    for (let i = 0; i < syllabusResult.syllabus!.modules.length; i++) {
      const module = syllabusResult.syllabus!.modules[i];

      const contentResult = await generateModuleContent(
        module,
        i,
        syllabusResult.syllabus!,
        input.level,
        summaries,
        provider
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
      }
    }

    course.status = "ready";
    await course.save();
  } catch (error) {
    const course = await Course.findById(courseId);
    if (course) {
      course.status = "error";
      course.errorMessage = error instanceof Error ? error.message : "Unknown error";
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
    useProvider
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
