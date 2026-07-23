import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateOpaqueToken(byteLength = 32) {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function timingSafeCompareText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    const paddedRight = Buffer.alloc(leftBuffer.length);
    timingSafeEqual(leftBuffer, paddedRight);
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
