import "server-only";
import { RateLimitedError } from "@/server/errors/application-error";
import { getEnv } from "@/server/env";
import { prisma } from "@/server/db/prisma";

// Counter disimpan di database (bukan memori proses) agar throttle login/reset/
// pendaftaran tetap efektif saat aplikasi berjalan lebih dari satu instance.
// Fixed window per `windowMs`, dihitung atomik lewat `count: { increment: 1 }`.

const globalForRateLimit = globalThis as typeof globalThis & {
  limoRateLimitCleanupAt?: number;
};

/**
 * Alamat klien untuk kunci throttle & jejak audit.
 *
 * Header `x-forwarded-for` hanya dipercaya hop terakhir bila `RATE_LIMIT_TRUST_PROXY=true`
 * (deployment di belakang satu reverse proxy yang menimpa/menambah XFF, mis. Traefik).
 * Tanpa flag itu, hop pertama dipakai seperti perilaku lama — klien dapat memalsukan
 * header ini, jadi proxy produksi wajib menimpa XFF.
 */
export function getClientAddress(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length > 0) {
      let trustProxy = false;
      try {
        trustProxy = getEnv().RATE_LIMIT_TRUST_PROXY;
      } catch {
        trustProxy = false;
      }
      return trustProxy ? hops[hops.length - 1] : hops[0];
    }
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

function windowStartFor(windowMs: number, now: number) {
  return new Date(Math.floor(now / windowMs) * windowMs);
}

async function incrementCounter(key: string, windowMs: number, now: number): Promise<number> {
  const windowStart = windowStartFor(windowMs, now);
  const updated = await prisma.rateLimitCounter.updateMany({
    where: { key, windowStart },
    data: { count: { increment: 1 } },
  });

  if (updated.count === 0) {
    try {
      const created = await prisma.rateLimitCounter.create({
        data: { key, windowStart, count: 1, expiresAt: new Date(windowStart.getTime() + windowMs) },
        select: { count: true },
      });
      return created.count;
    } catch (error) {
      // Dua request bersamaan menciptakan window yang sama — inkremen ulang.
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
        throw error;
      }
      const retried = await prisma.rateLimitCounter.updateMany({
        where: { key, windowStart },
        data: { count: { increment: 1 } },
      });
      if (retried.count === 0) throw error;
    }
  }

  const counter = await prisma.rateLimitCounter.findUnique({
    where: { key_windowStart: { key, windowStart } },
    select: { count: true },
  });
  return counter?.count ?? 1;
}

async function cleanupExpiredCounters(now: number) {
  // Piggyback pembersihan: maksimal sekali per menit per proses agar tabel pendek.
  const last = globalForRateLimit.limoRateLimitCleanupAt ?? 0;
  if (now - last < 60_000) return;
  globalForRateLimit.limoRateLimitCleanupAt = now;
  await prisma.rateLimitCounter.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
}

export async function assertRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
}) {
  const now = Date.now();

  try {
    const count = await incrementCounter(input.key, input.windowMs, now);
    if (count > input.limit) {
      throw new RateLimitedError(input.message);
    }
    if (Math.random() < 0.05) {
      await cleanupExpiredCounters(now);
    }
  } catch (error) {
    if (error instanceof RateLimitedError) {
      throw error;
    }
    // Fail-open: kegagalan store (DB sesaat) tidak boleh memblokir login/mutasi.
    // Throttle tetap berjalan normal begitu store pulih.
    console.warn(JSON.stringify({ level: "warn", message: "Rate limit store tidak tersedia, throttle dilewati", error: error instanceof Error ? error.message : String(error) }));
  }
}

export async function clearRateLimit(key: string) {
  try {
    await prisma.rateLimitCounter.deleteMany({ where: { key } });
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", message: "Gagal membersihkan rate limit", error: error instanceof Error ? error.message : String(error) }));
  }
}
