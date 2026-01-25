import { Router } from "express";
import {
  handleCreateCourse,
  handleGetCourse,
  handleListCourses,
  handleDeleteCourse,
  handleGetCourseStatus,
  handleRegenerateCourse,
  handleExportPdf,
  handleResumeCourse,
} from "../controllers/course.controller.js";

const router = Router();

router.post("/", handleCreateCourse);
router.get("/", handleListCourses);
router.get("/:id", handleGetCourse);
router.get("/:id/status", handleGetCourseStatus);
router.get("/:id/export/pdf", handleExportPdf);
router.post("/:id/regenerate", handleRegenerateCourse);
router.post("/:id/resume", handleResumeCourse);
router.delete("/:id", handleDeleteCourse);

export default router;
