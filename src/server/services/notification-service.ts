import { createHash } from "node:crypto";
import type { Actor } from "../auth/session.ts";
import { prisma } from "../db/prisma.ts";
import { NotFoundError } from "../errors/application-error.ts";
import { getEnv } from "../env.ts";

export async function notifyWaliForStudents(input: {
  siswaIds: string[];
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
  channels?: Array<"email" | "whatsapp">;
  }) {
  const siswaIds = [...new Set(input.siswaIds)];
  const requestedChannels = input.channels ?? ["email"];
  const provider = getEnv().NOTIFICATION_PROVIDER;
  const channels = requestedChannels.filter((channel) => provider !== "email" || channel === "email");

  if (siswaIds.length === 0) {
    return { created: 0 };
  }

  const relations = await prisma.waliSiswa.findMany({
    where: { siswaId: { in: siswaIds }, endedAt: null, siswa: { status: "ACTIVE", deletedAt: null } },
    select: { siswaId: true, waliProfile: { select: { phone: true, user: { select: { email: true } } } } },
  });
  const uniqueRecipients = new Set<string>();
  const data = relations.flatMap((relation) => channels.map((channel) => {
    const recipient = channel === "email" ? relation.waliProfile.user.email : relation.waliProfile.phone;
    if (!recipient) return null;

    const key = `${relation.siswaId}:${channel}:${recipient}:${input.template}`;
    if (uniqueRecipients.has(key)) return null;

    uniqueRecipients.add(key);
    return {
      channel,
      template: input.template,
      recipient,
      subject: input.subject,
      body: input.body,
      dedupeKey: createHash("sha256").update(`${input.template}|${channel}|${recipient}|${input.body}`).digest("hex"),
      metadata: { ...input.metadata, siswaId: relation.siswaId },
    };
  })).filter((item): item is NonNullable<typeof item> => item !== null);

  let created = 0;
  for (const item of data) {
    try {
      await prisma.notifikasi.create({ data: item });
      created += 1;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        continue;
      }

      throw error;
    }
  }

  return { created };
}

export async function syncGuruPendingNotifications(actor: Actor) {
  if (actor.role !== "GURU") {
    return { created: 0 };
  }

  const sessions = await prisma.sesiKelas.findMany({
    where: {
      sessionDate: { lte: new Date() },
      status: "DRAFT",
      kelas: { status: "ACTIVE", guruProfile: { userId: actor.id } },
    },
    orderBy: { sessionDate: "desc" },
    select: {
      id: true,
      meetingNumber: true,
      topic: true,
      kelas: {
        select: {
          name: true,
          _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
        },
      },
      _count: { select: { presensi: true, progresBelajar: true } },
    },
  });

  let created = 0;
  for (const session of sessions) {
    const students = session.kelas._count.enrollments;
    if (students === 0) continue;

    const pending = [
      { type: "presensi", filled: session._count.presensi, label: "presensi", action: "Input Presensi" },
      { type: "progres", filled: session._count.progresBelajar, label: "progres belajar", action: "Input Progres" },
    ].filter((item) => item.filled < students);

    for (const task of pending) {
      try {
        await prisma.notifikasi.create({
          data: {
            channel: "in_app",
            template: `guru-pending-${task.type}`,
            recipient: actor.email,
            subject: `${task.action} tertunda: ${session.kelas.name}`,
            body: `${task.label} untuk sesi ${session.meetingNumber}: ${session.topic} baru terisi ${task.filled}/${students} siswa.`,
            dedupeKey: createHash("sha256").update(`guru-pending-${task.type}|${actor.email}|${session.id}`).digest("hex"),
            metadata: { sesiKelasId: session.id, taskType: task.type, filled: task.filled, expected: students },
          },
        });
        created += 1;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          continue;
        }

        throw error;
      }
    }
  }

  return { created };
}

export async function listDashboardNotifications(actor: Actor) {
  const recipients = new Set([actor.email]);

  if (actor.role === "ADMIN") {
    recipients.add("admin@limo.local");
  }

  const where = { recipient: { in: [...recipients] } };
  const [items, unreadCount] = await Promise.all([
    prisma.notifikasi.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        subject: true,
        body: true,
        status: true,
        template: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notifikasi.count({ where: { ...where, readAt: null } }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
    })),
    unreadCount,
  };
}

export async function markDashboardNotificationRead(actor: Actor, notificationId: string) {
  const recipients = new Set([actor.email]);

  if (actor.role === "ADMIN") {
    recipients.add("admin@limo.local");
  }

  const result = await prisma.notifikasi.updateMany({
    where: { id: notificationId, recipient: { in: [...recipients] } },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    throw new NotFoundError("Notifikasi tidak ditemukan");
  }

  return { success: true };
}
