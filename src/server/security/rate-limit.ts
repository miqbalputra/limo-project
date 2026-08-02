import "server-only";
import { RateLimitedError } from "@/server/errors/application-error";

type Bucket = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  limoRateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalForRateLimit.limoRateLimitBuckets ?? new Map<string, Bucket>();
globalForRateLimit.limoRateLimitBuckets = buckets;

export function getClientAddress(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function assertRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const now = Date.now();
  const bucket = buckets.get(input.key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(input.key, { count: 1, resetAt: now + input.windowMs });
    return;
  }

  if (bucket.count >= input.limit) {
    throw new RateLimitedError(input.message);
  }

  bucket.count += 1;
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}
