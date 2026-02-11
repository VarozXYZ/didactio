import { Response, NextFunction } from "express";
import { z } from "zod";
import {
  createCourse,
  getCourse,
  listCourses,
  listCoursesByOwner,
  deleteCourse,
  regenerateSection,
  resumeCourse,
} from "../services/course.service.js";
import { exportCourseToPdf } from "../services/pdf.service.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { ICourse } from "../models/course.model.js";

const createCourseSchema = z.object({
  topic: z.string().min(1),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  provider: z.enum(["deepseek", "openai"]).optional(),
  contentLength: z.enum(["intro", "short", "long", "textbook"]).optional(),
  tone: z.enum(["friendly", "neutral", "professional"]).optional(),
  technicality: z.enum(["basic", "intermediate", "technical"]).optional(),
  language: z.string().optional(),
  additionalContext: z.string().optional(),
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const course = await createCourse({
      ownerId: req.user.sub,
      ...parsed.data,
      contentLength: parsed.data.contentLength || "short",
      tone: parsed.data.tone || "neutral",
      technicality: parsed.data.technicality || "intermediate",
      language: parsed.data.language || "Spanish",
    });
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
}

export async function handleGetCourse(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const course = await getAccessibleCourse(req, res, req.params.id as string);
    if (!course) {
      return;
    }

    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function handleListCourses(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const courses =
      req.user.role === "admin"
        ? await listCourses()
        : await listCoursesByOwner(req.user.sub);

    res.json(courses);
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteCourse(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const course = await getAccessibleCourse(req, res, req.params.id as string);
    if (!course) {
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsed = regenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const existingCourse = await getAccessibleCourse(
      req,
      res,
      req.params.id as string
    );
    if (!existingCourse) {
      return;
    }

    const course = await regenerateSection(
      existingCourse.id,
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const course = await getAccessibleCourse(req, res, req.params.id as string);
    if (!course) {
      return;
    }

    if (course.status !== "ready") {
      res.status(400).json({ error: "Course is not ready for export" });
      return;
    }

    const pdfBuffer = await exportCourseToPdf(course);
    
    const filename = (course.syllabus?.title || "course")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.pdf"`
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
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const parsed = resumeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const existingCourse = await getAccessibleCourse(
      req,
      res,
      req.params.id as string
    );
    if (!existingCourse) {
      return;
    }

    const course = await resumeCourse(
      existingCourse.id,
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

async function getAccessibleCourse(
  req: AuthenticatedRequest,
  res: Response,
  courseId: string
): Promise<ICourse | null> {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const course = await getCourse(courseId);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return null;
  }

  if (req.user.role === "admin") {
    return course;
  }

  if (String(course.owner) !== req.user.sub) {
    res.status(403).json({ error: "You do not have access to this course" });
    return null;
  }

  return course;
}
