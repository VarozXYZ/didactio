import { Router } from "express";
import courseRoutes from "./course.routes.js";

const router = Router();

router.use("/courses", courseRoutes);

export default router;
