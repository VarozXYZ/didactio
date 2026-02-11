import { User, UserRole } from "../models/user.model.js";
import { createAccessToken, createRefreshToken, verifyRefreshToken } from "./jwt.service.js";
import { hashPassword, verifyPassword } from "../utils/password.utils.js";
import { createHttpError } from "../utils/error.utils.js";

export interface RegisterInput {
  name?: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface PublicUser {
  id: string;
  name?: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(user: {
  id: string;
  name?: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function buildAuthResponse(user: PublicUser, tokenVersion: number): AuthResponse {
  return {
    accessToken: createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion,
    }),
    refreshToken: createRefreshToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion,
    }),
    user,
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw createHttpError("Email already in use", 409);
  }

  const createdUser = await User.create({
    name: input.name?.trim() || undefined,
    email,
    passwordHash: hashPassword(input.password),
    role: input.role,
  });

  const publicUser = toPublicUser({
    id: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role,
    createdAt: createdUser.createdAt,
    updatedAt: createdUser.updatedAt,
  });

  return buildAuthResponse(publicUser, createdUser.tokenVersion);
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  const email = normalizeEmail(input.email);
  const user = await User.findOne({ email }).select("+passwordHash");

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw createHttpError("Invalid email or password", 401);
  }

  const publicUser = toPublicUser({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  return buildAuthResponse(publicUser, user.tokenVersion);
}

export async function refreshAuthSession(
  refreshToken: string
): Promise<AuthResponse> {
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub);

  if (!user) {
    throw createHttpError("User not found", 401);
  }

  if (user.tokenVersion !== payload.ver) {
    throw createHttpError("Session has been invalidated", 401);
  }

  const publicUser = toPublicUser({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  return buildAuthResponse(publicUser, user.tokenVersion);
}

export async function logoutCurrentUser(userId: string): Promise<boolean> {
  const result = await User.findByIdAndUpdate(userId, {
    $inc: { tokenVersion: 1 },
  });
  return result !== null;
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const user = await User.findById(userId);
  if (!user) return null;

  return toPublicUser({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await User.find().sort({ createdAt: -1 });

  return users.map((user) =>
    toPublicUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
  );
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<PublicUser | null> {
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $set: { role },
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );

  if (!updatedUser) return null;

  return toPublicUser({
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    createdAt: updatedUser.createdAt,
    updatedAt: updatedUser.updatedAt,
  });
}
