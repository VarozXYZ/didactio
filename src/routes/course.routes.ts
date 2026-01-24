import { Router } from "express";
import {
  handleCreateCourse,
  handleGetCourse,
  handleListCourses,
  handleDeleteCourse,
  handleGetCourseStatus,
  handleRegenerateCourse,
} from "../controllers/course.controller.js";

const router = Router();

router.post("/", handleCreateCourse);
router.get("/", handleListCourses);
router.get("/:id", handleGetCourse);
router.get("/:id/status", handleGetCourseStatus);
router.post("/:id/regenerate", handleRegenerateCourse);
router.delete("/:id", handleDeleteCourse);

export default router;
