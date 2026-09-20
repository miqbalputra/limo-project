import "server-only";
import type { Actor } from "@/server/auth/session";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { prisma } from "@/server/db/prisma";
import { dispatchNotificationIds } from "@/server/services/notification-job-service";

const statuses = ["PENDING", "PROCESSING", "SENT", "FAILED", "CANCELLED"] as const;
const channels = ["email", "whatsapp", "in_app"] as const;

export type NotificationLogStatus = (typeof statuses)[number];
export type NotificationLogChannel = (typeof channels)[number];

export function parseNotificationStatus(value: string | null | undefined) {
  return value && statuses.includes(value as NotificationLogStatus) ? (value as NotificationLogStatus) : undefined;
}

export function parseNotificationChannel(value: string | null | undefined) {
  return value && channels.includes(value as NotificationLogChannel) ? (value as NotificationLogChannel) : undefined;
}

export type NotificationLogFilters = {
  status?: NotificationLogStatus;
  channel?: NotificationLogChannel;
  search?: string;
};

export async function listNotificationLog(actor: Actor, paginationInput: PaginationInput = {}, filters: NotificationLogFilters = {}) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const pagination = resolvePagination(paginationInput, 25);
  const search = filters.search?.trim().slice(0, 120);
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.channel ? { channel: filters.channel } : {}),
    ...(search
      ? {
          OR: [
            { recipient: { contains: search } },
            { template: { contains: search } },
            { subject: { contains: search } },
            { body: { contains: search } },
          ],
        }
      : {}),
  };

  const [totalItems, items] = await Promise.all([
    prisma.notifikasi.count({ where }),
    prisma.notifikasi.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        template: true,
        channel: true,
        recipient: true,
        subject: true,
        body: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { deliveries: true } },
        deliveries: {
          orderBy: { attempt: "desc" },
          take: 1,
          select: { provider: true, status: true, attempt: true, errorMessage: true, sentAt: true, response: true },
        },
      },
    }),
  ]);

  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems) };
}

export async function getNotificationLogSummary(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const grouped = await prisma.notifikasi.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(grouped.map((item) => [item.status, item._count._all]));

  return {
    pending: counts.PENDING ?? 0,
    processing: counts.PROCESSING ?? 0,
    sent: counts.SENT ?? 0,
    failed: counts.FAILED ?? 0,
    cancelled: counts.CANCELLED ?? 0,
  };
}

export async function retryNotification(actor: Actor, id: string) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const existing = await prisma.notifikasi.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new NotFoundError("Notifikasi tidak ditemukan");
  }

  const result = await dispatchNotificationIds([id]);

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "NOTIFICATION_RETRIED", entityType: "Notifikasi", entityId: id, metadata: { sent: result.sent, failed: result.failed } },
  });

  return result;
}
