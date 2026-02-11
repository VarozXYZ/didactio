import { Router } from "express";
import {
  handleGetCurrentUser,
  handleListUsers,
  handleLogin,
  handleRegister,
  handleUpdateUserRole,
} from "../controllers/auth.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", handleRegister);
router.post("/login", handleLogin);
router.get("/me", requireAuth, handleGetCurrentUser);
router.get("/users", requireAuth, requireRoles("admin"), handleListUsers);
router.patch(
  "/users/:id/role",
  requireAuth,
  requireRoles("admin"),
  handleUpdateUserRole
);

export default router;

