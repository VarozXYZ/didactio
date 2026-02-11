import { Router } from "express";
import {
  handleGetCurrentUser,
  handleListUsers,
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleRegister,
  handleUpdateUserRole,
} from "../controllers/auth.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/register", handleRegister);
router.post("/login", handleLogin);
router.post("/refresh", handleRefreshToken);
router.post("/logout", requireAuth, handleLogout);
router.get("/me", requireAuth, handleGetCurrentUser);
router.get("/users", requireAuth, requireRoles("admin"), handleListUsers);
router.patch(
  "/users/:id/role",
  requireAuth,
  requireRoles("admin"),
  handleUpdateUserRole
);

export default router;
