import "./load-env.ts";
import { notifyDuePengumuman } from "@/server/services/pengumuman-job-service";

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

if (dryRun) {
  const { prisma } = await import("@/server/db/prisma");
  const now = new Date();
  const pending = await prisma.pengumuman.count({
    where: {
      notifiedAt: null,
      status: "PUBLISHED",
      kelasId: { not: null },
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
    },
  });
  console.log(`[dry-run] pengumuman jatuh tempo menunggu notifikasi=${pending}`);
  process.exit(0);
}

const result = await notifyDuePengumuman({ limit: Number.isFinite(limit) ? limit : undefined });

console.log(`notified=${result.notified} pending=${result.total - result.notified}`);
process.exit(0);
