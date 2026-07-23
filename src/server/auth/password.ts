import "server-only";
import argon2 from "argon2";

const argon2Options = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  return argon2.hash(password, argon2Options);
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}
