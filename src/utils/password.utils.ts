import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const HASH_ITERATIONS = 120_000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = "sha512";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    HASH_ITERATIONS,
    HASH_KEY_LENGTH,
    HASH_DIGEST
  ).toString("hex");

  return `${HASH_ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  storedPasswordHash: string
): boolean {
  const [iterationsRaw, salt, storedHash] = storedPasswordHash.split(":");
  if (!iterationsRaw || !salt || !storedHash) {
    return false;
  }

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const derivedHash = pbkdf2Sync(
    password,
    salt,
    iterations,
    HASH_KEY_LENGTH,
    HASH_DIGEST
  ).toString("hex");

  const storedHashBuffer = Buffer.from(storedHash, "hex");
  const derivedHashBuffer = Buffer.from(derivedHash, "hex");

  if (storedHashBuffer.length !== derivedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedHashBuffer, derivedHashBuffer);
}

