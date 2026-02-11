import { Request, Response, NextFunction } from "express";
import { User, UserRole } from "../models/user.model.js";
import { AuthTokenPayload, verifyAccessToken } from "../services/jwt.service.js";

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    User.findById(payload.sub)
      .select("email role tokenVersion")
      .then((user) => {
        if (!user) {
          res.status(401).json({ error: "Authentication required" });
          return;
        }

        if (user.tokenVersion !== payload.ver) {
          res.status(401).json({ error: "Session has been invalidated" });
          return;
        }

        req.user = {
          ...payload,
          email: user.email,
          role: user.role,
          ver: user.tokenVersion,
        };

        next();
      })
      .catch(next);
  } catch (error) {
    next(error);
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}
