import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.ts";
import { deliverNotification } from "../providers/notification/notifier.ts";

const STALE_PROCESSING_MS = 10 * 60 * 1000;

type DeliveryRecord = {
  id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string;
  metadata: Prisma.JsonValue | null;
  deliveries: { attempt: number }[];
};

const deliverySelect = {
  id: true,
  channel: true,
  recipient: true,
  subject: true,
  body: true,
  metadata: true,
  deliveries: { orderBy: { attempt: "desc" as const }, take: 1, select: { attempt: true } },
};

async function claimNotifications(ids: string[]) {
  const claimed: string[] = [];
  for (const id of ids) {
    const result = await prisma.notifikasi.updateMany({
      where: { id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PROCESSING" },
    });
    if (result.count === 1) {
      claimed.push(id);
    }
  }
  return claimed;
}

async function deliverClaimed(notification: DeliveryRecord) {
  const delivery = await deliverNotification(notification);
  const nextAttempt = (notification.deliveries[0]?.attempt ?? 0) + 1;

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

  return delivery.status;
}

/**
 * Kirim notifikasi tertentu secara instan (best-effort). Klaim atomik
 * PENDING/FAILED -> PROCESSING mencegah pengiriman ganda dengan job cron.
 */
export async function dispatchNotificationIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const claimed = await claimNotifications(uniqueIds);
  if (claimed.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const notifications = await prisma.notifikasi.findMany({
    where: { id: { in: claimed } },
    select: deliverySelect,
  });

  let sent = 0;
  let failed = 0;
  for (const notification of notifications) {
    const status = await deliverClaimed(notification);
    if (status === "SENT") sent += 1;
    else failed += 1;
  }

  return { sent, failed };
}

export async function retryPendingNotifications(input: { dryRun?: boolean; limit?: number; maxAttempts?: number } = {}) {
  const limit = input.limit ?? 50;
  const maxAttempts = input.maxAttempts ?? 5;

  // Kembalikan klaim yang menggantung (proses berhenti di tengah pengiriman).
  await prisma.notifikasi.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
    data: { status: "PENDING" },
  });

  const notifications = await prisma.notifikasi.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      deliveries: { none: { attempt: { gte: maxAttempts } } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: deliverySelect,
  });

  if (input.dryRun) {
    return { sent: notifications.length, failed: 0, dryRun: true };
  }

  const claimed = await claimNotifications(notifications.map((notification) => notification.id));
  const rows = notifications.filter((notification) => claimed.includes(notification.id));

  let sent = 0;
  let failed = 0;
  for (const notification of rows) {
    const status = await deliverClaimed(notification);
    if (status === "SENT") sent += 1;
    else failed += 1;
  }

  // Hindari menumpuk JobRun saat tidak ada notifikasi yang diproses (cron per menit).
  if (sent + failed > 0) {
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
  }

  return { sent, failed, dryRun: false };
}
