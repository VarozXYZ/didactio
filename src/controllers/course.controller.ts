import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  createCourse,
  getCourse,
  listCourses,
  deleteCourse,
  regenerateSection,
  resumeCourse,
} from "../services/course.service.js";
import { exportCourseToPdf } from "../services/pdf.service.js";

const createCourseSchema = z.object({
  topic: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  provider: z.enum(["deepseek", "openai"]).optional(),
  contentLength: z.enum(["intro", "summary", "lesson", "course", "textbook"]).optional(),
  options: z
    .object({
      numLessons: z.number().optional(),
      maxMinutes: z.number().optional(),
    })
    .optional(),
});

const regenerateSchema = z.object({
  moduleIndex: z.number().int().min(0),
  context: z.string().min(1),
  provider: z.enum(["deepseek", "openai"]).optional(),
});

export async function handleCreateCourse(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const course = await createCourse({
      ...parsed.data,
      contentLength: parsed.data.contentLength || "lesson",
    });
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
}

export async function handleGetCourse(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const course = await getCourse(req.params.id as string);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function handleListCourses(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courses = await listCourses();
    res.json(courses);
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteCourse(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const deleted = await deleteCourse(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function handleGetCourseStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const course = await getCourse(req.params.id as string);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json({
      id: course._id,
      status: course.status,
      modulesGenerated: course.modules.length,
      totalModules: course.syllabus?.modules.length || 0,
      errorMessage: course.errorMessage,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRegenerateCourse(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = regenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const course = await regenerateSection(
      req.params.id as string,
      parsed.data.moduleIndex,
      parsed.data.context,
      parsed.data.provider
    );

    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }
    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function handleExportPdf(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const course = await getCourse(req.params.id as string);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    if (course.status !== "ready") {
      res.status(400).json({ error: "Course is not ready for export" });
      return;
    }

    const pdfBuffer = await exportCourseToPdf(course);
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${course.syllabus?.title || "course"}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

const resumeSchema = z.object({
  provider: z.enum(["deepseek", "openai"]).optional(),
});

export async function handleResumeCourse(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = resumeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const course = await resumeCourse(
      req.params.id as string,
      parsed.data.provider
    );

    if (!course) {
      res.status(404).json({ error: "Course not found or has no syllabus" });
      return;
    }

    res.json({
      message: "Resume started",
      courseId: course._id,
      status: course.status,
      modulesGenerated: course.modules.length,
      totalModules: course.syllabus?.modules.length || 0,
    });
  } catch (error) {
    next(error);
  }
}
