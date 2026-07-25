import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function listDashboardNotifications(actor: Actor) {
  const recipients = new Set([actor.email]);

  if (actor.role === "ADMIN") {
    recipients.add("admin@limo.local");
  }

  const items = await prisma.notifikasi.findMany({
    where: { recipient: { in: [...recipients] } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      subject: true,
      body: true,
      status: true,
      template: true,
      createdAt: true,
    },
  });

  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    pendingCount: items.filter((item) => item.status === "PENDING").length,
  };
}
