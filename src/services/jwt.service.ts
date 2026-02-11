import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { UserRole } from "../models/user.model.js";
import { createHttpError } from "../utils/error.utils.js";

interface JwtHeader {
  alg: "HS256";
  typ: "JWT";
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  ver: number;
  typ: TokenType;
  iat: number;
  exp: number;
}

type TokenType = "access" | "refresh";

interface CreateTokenInput {
  sub: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
}

function encodeBase64Url(value: string | Buffer): string {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLength);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signTokenData(data: string): Buffer {
  return createHmac("sha256", env.JWT_SECRET).update(data).digest();
}

function isValidRole(role: unknown): role is UserRole {
  return role === "standard" || role === "premium" || role === "admin";
}

function isValidTokenType(value: unknown): value is TokenType {
  return value === "access" || value === "refresh";
}

function createToken(
  input: CreateTokenInput,
  tokenType: TokenType,
  expiresInSeconds: number
): string {
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresInSeconds;

  const payload: AuthTokenPayload = {
    sub: input.sub,
    email: input.email,
    role: input.role,
    ver: input.tokenVersion,
    typ: tokenType,
    iat: issuedAt,
    exp: expiresAt,
  };

  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = encodeBase64Url(signTokenData(data));

  return `${data}.${signature}`;
}

export function createAccessToken(input: CreateTokenInput): string {
  return createToken(input, "access", env.JWT_EXPIRES_IN_SECONDS);
}

export function createRefreshToken(input: CreateTokenInput): string {
  return createToken(input, "refresh", env.JWT_REFRESH_EXPIRES_IN_SECONDS);
}

function verifyToken(token: string, expectedType: TokenType): AuthTokenPayload {
  const [headerPart, payloadPart, signaturePart] = token.split(".");

  if (!headerPart || !payloadPart || !signaturePart) {
    throw createHttpError("Invalid token format", 401);
  }

  const data = `${headerPart}.${payloadPart}`;
  const expectedSignature = signTokenData(data);
  const receivedSignature = Buffer.from(
    decodeBase64UrlToBase64(signaturePart),
    "base64"
  );

  if (expectedSignature.length !== receivedSignature.length) {
    throw createHttpError("Invalid token signature", 401);
  }

  if (!timingSafeEqual(expectedSignature, receivedSignature)) {
    throw createHttpError("Invalid token signature", 401);
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(decodeBase64Url(payloadPart));
  } catch {
    throw createHttpError("Invalid token payload", 401);
  }

  if (
    typeof rawPayload !== "object" ||
    rawPayload === null ||
    typeof (rawPayload as { sub?: unknown }).sub !== "string" ||
    typeof (rawPayload as { email?: unknown }).email !== "string" ||
    !isValidRole((rawPayload as { role?: unknown }).role) ||
    typeof (rawPayload as { ver?: unknown }).ver !== "number" ||
    !Number.isInteger((rawPayload as { ver?: number }).ver) ||
    (rawPayload as { ver?: number }).ver! < 0 ||
    !isValidTokenType((rawPayload as { typ?: unknown }).typ) ||
    typeof (rawPayload as { iat?: unknown }).iat !== "number" ||
    typeof (rawPayload as { exp?: unknown }).exp !== "number"
  ) {
    throw createHttpError("Invalid token payload", 401);
  }

  const payload = rawPayload as AuthTokenPayload;
  if (payload.typ !== expectedType) {
    throw createHttpError("Invalid token type", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw createHttpError("Token expired", 401);
  }

  return payload;
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return verifyToken(token, "access");
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return verifyToken(token, "refresh");
}

function decodeBase64UrlToBase64(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (base64.length % 4)) % 4;
  return base64 + "=".repeat(padLength);
}
