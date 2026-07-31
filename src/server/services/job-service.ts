import { prisma } from "../db/prisma.ts";
import { deliverNotification } from "../providers/notification/notifier.ts";

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

export async function retryPendingNotifications(input: { dryRun?: boolean; limit?: number; maxAttempts?: number } = {}) {
  const limit = input.limit ?? 50;
  const maxAttempts = input.maxAttempts ?? 5;
  const notifications = await prisma.notifikasi.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      deliveries: { none: { attempt: { gte: maxAttempts } } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      channel: true,
      recipient: true,
      subject: true,
      body: true,
      deliveries: { orderBy: { attempt: "desc" }, take: 1, select: { attempt: true } },
    },
  });

  let sent = 0;
  let failed = 0;

  if (input.dryRun) {
    return { sent: notifications.length, failed: 0, dryRun: true };
  }

  for (const notification of notifications) {
    const delivery = await deliverNotification(notification);
    const nextAttempt = (notification.deliveries[0]?.attempt ?? 0) + 1;

    if (delivery.status === "SENT") {
      sent += 1;
    } else {
      failed += 1;
    }

    await prisma.$transaction([
      prisma.notificationDelivery.create({
        data: {
          notificationId: notification.id,
          provider: delivery.provider,
          status: delivery.status,
          attempt: nextAttempt,
          response: delivery.response,
          errorMessage: delivery.errorMessage,
          sentAt: delivery.status === "SENT" ? new Date() : undefined,
        },
      }),
      prisma.notifikasi.update({ where: { id: notification.id }, data: { status: delivery.status } }),
    ]);
  }

  await prisma.jobRun.create({
    data: {
      name: "retry-notifications",
      status: failed > 0 ? "FAILED" : "SUCCESS",
      finishedAt: new Date(),
      successCount: sent,
      failedCount: failed,
      metadata: { dryRun: false, maxAttempts },
    },
  });

  return { sent, failed, dryRun: false };
}
