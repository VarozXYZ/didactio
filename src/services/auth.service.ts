import { User, UserRole } from "../models/user.model.js";
import { createAccessToken } from "./jwt.service.js";
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
  token: string;
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

function buildAuthResponse(user: PublicUser): AuthResponse {
  return {
    token: createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
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

  return buildAuthResponse(publicUser);
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

  return buildAuthResponse(publicUser);
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
    { role },
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

