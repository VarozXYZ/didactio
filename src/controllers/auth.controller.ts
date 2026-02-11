import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  getUserById,
  listUsers,
  loginUser,
  logoutCurrentUser,
  refreshAuthSession,
  registerUser,
  updateUserRole,
} from "../services/auth.service.js";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";

const roleSchema = z.enum(["standard", "premium", "admin"]);

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: roleSchema.optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const updateRoleSchema = z.object({
  role: roleSchema,
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function handleRegister(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    if (parsed.data.role && env.NODE_ENV !== "development") {
      res.status(403).json({
        error:
          "Role assignment is restricted in non-development environments.",
      });
      return;
    }

    const authResponse = await registerUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role || "standard",
    });

    res.status(201).json(authResponse);
  } catch (error) {
    next(error);
  }
}

export async function handleLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const authResponse = await loginUser(parsed.data);
    res.json(authResponse);
  } catch (error) {
    next(error);
  }
}

export async function handleRefreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const authResponse = await refreshAuthSession(parsed.data.refreshToken);
    res.json(authResponse);
  } catch (error) {
    next(error);
  }
}

export async function handleGetCurrentUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = await getUserById(req.user.sub);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function handleListUsers(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateUserRole(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const updatedUser = await updateUserRole(
      req.params.id as string,
      parsed.data.role
    );

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
}

export async function handleLogout(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    await logoutCurrentUser(req.user.sub);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
