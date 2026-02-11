import { Router } from "express";
import authRoutes from "./auth.routes.js";
import courseRoutes from "./course.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/courses", courseRoutes);

export default router;
