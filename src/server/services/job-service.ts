import "server-only";
import { prisma } from "@/server/db/prisma";

export async function markOverdueInvoices(input: { dryRun?: boolean; now?: Date } = {}) {
  const now = input.now ?? new Date();
  const candidates = await prisma.tagihan.findMany({
    where: {
      status: "UNPAID",
      dueDate: { lt: now },
    },
    select: { id: true },
  });

  if (!input.dryRun && candidates.length > 0) {
    await prisma.tagihan.updateMany({
      where: { id: { in: candidates.map((item) => item.id) } },
      data: { status: "OVERDUE" },
    });
  }

  if (!input.dryRun) {
    await prisma.jobRun.create({
      data: {
        name: "mark-overdue-invoices",
        status: "SUCCESS",
        finishedAt: new Date(),
        successCount: candidates.length,
        metadata: { dryRun: false },
      },
    });
  }

  return { marked: candidates.length, dryRun: Boolean(input.dryRun) };
}

export async function cleanupExpiredSessions(input: { dryRun?: boolean; now?: Date } = {}) {
  const now = input.now ?? new Date();
  const candidates = await prisma.session.findMany({
    where: {
      OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }],
    },
    select: { id: true },
  });

  if (!input.dryRun && candidates.length > 0) {
    await prisma.session.deleteMany({ where: { id: { in: candidates.map((item) => item.id) } } });
  }

  if (!input.dryRun) {
    await prisma.jobRun.create({
      data: {
        name: "cleanup-expired-sessions",
        status: "SUCCESS",
        finishedAt: new Date(),
        successCount: candidates.length,
        metadata: { dryRun: false },
      },
    });
  }

  return { deleted: candidates.length, dryRun: Boolean(input.dryRun) };
}

export async function retryPendingNotifications(input: { dryRun?: boolean; limit?: number } = {}) {
  const limit = input.limit ?? 50;
  const notifications = await prisma.notifikasi.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, channel: true, recipient: true, subject: true, body: true },
  });

  if (!input.dryRun) {
    await prisma.$transaction([
      ...notifications.map((notification) =>
        prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            provider: "console",
            status: "SENT",
            attempt: 1,
            response: { deliveredBy: "console", recipient: notification.recipient },
            sentAt: new Date(),
          },
        }),
      ),
      ...notifications.map((notification) =>
        prisma.notifikasi.update({ where: { id: notification.id }, data: { status: "SENT" } }),
      ),
      prisma.jobRun.create({
        data: {
          name: "retry-notifications",
          status: "SUCCESS",
          finishedAt: new Date(),
          successCount: notifications.length,
          metadata: { provider: "console", dryRun: false },
        },
      }),
    ]);
  }

  return { sent: notifications.length, dryRun: Boolean(input.dryRun) };
}
