import { getEnv } from "@/server/env";
import { generateOpaqueToken, hashToken } from "@/server/security/crypto";

const RESET_TOKEN_MINUTES = 30;

export function createPasswordResetGrant() {
  const token = generateOpaqueToken(48);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
  const resetUrl = new URL("/reset-password", getEnv().APP_URL);
  resetUrl.searchParams.set("token", token);

  return { token, tokenHash: hashToken(token), expiresAt, resetUrl: resetUrl.toString() };
}
