import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { Actor } from "../auth/session.ts";
import { prisma } from "../db/prisma.ts";
import { NotFoundError } from "../errors/application-error.ts";
import { getEnv } from "../env.ts";
import { scheduleImmediateDispatch } from "./notification-dispatch-scheduler.ts";

type NotificationData = Prisma.NotifikasiCreateArgs["data"];

export async function createNotificationIfMissing(data: NotificationData) {
  if (data.dedupeKey) {
    const existing = await prisma.notifikasi.findUnique({ where: { dedupeKey: data.dedupeKey }, select: { id: true } });
    if (existing) return null;
  }

  try {
    const created = await prisma.notifikasi.create({ data, select: { id: true } });
    scheduleImmediateDispatch(created.id);
    return created.id;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return null;
    throw error;
  }
}

export async function notifyWaliForStudents(input: {
  siswaIds: string[];
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
  dedupeKey?: string;
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

     const key = `${relation.siswaId}:${channel}:${recipient}:${input.dedupeKey || input.template}`;
    if (uniqueRecipients.has(key)) return null;

    uniqueRecipients.add(key);
    return {
      channel,
      template: input.template,
      recipient,
      subject: input.subject,
      body: input.body,
       dedupeKey: createHash("sha256").update(`${input.template}|${channel}|${recipient}|${input.dedupeKey || input.body}`).digest("hex"),
      metadata: { ...input.metadata, siswaId: relation.siswaId },
    };
  })).filter((item): item is NonNullable<typeof item> => item !== null);

  let created = 0;
  for (const item of data) {
    if (await createNotificationIfMissing(item)) created += 1;
  }

  return { created };
}

export async function notifySiswaForStudents(input: {
  siswaIds: string[];
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
  dedupeKey?: string;
}) {
  const siswaIds = [...new Set(input.siswaIds)];
  if (siswaIds.length === 0) return { created: 0 };
  const accounts = await prisma.siswaAccount.findMany({ where: { siswaId: { in: siswaIds }, status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null } }, select: { siswaId: true, user: { select: { email: true } } } });
  let created = 0;
  for (const account of accounts) {
    if (await createNotificationIfMissing({ channel: "in_app", template: input.template, recipient: account.user.email, subject: input.subject, body: input.body, dedupeKey: createHash("sha256").update(`${input.template}|${account.siswaId}|${input.dedupeKey || input.body}`).digest("hex"), metadata: { ...input.metadata, siswaId: account.siswaId } })) created += 1;
  }
  return { created };
}

/**
 * Notifikasi in-app/e-mail ke seluruh anggota aktif sebuah kelas,
 * disaring sesuai audience pengumuman (SISWA / WALI / SEMUA).
 */
export async function notifyKelasAktif(input: {
  kelasId: string;
  audience: "SISWA" | "WALI" | "SEMUA";
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
  dedupeKey?: string;
}) {
  const enrollments = await prisma.kelasSiswa.findMany({
    where: { kelasId: input.kelasId, status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null } },
    select: { siswaId: true },
  });
  const siswaIds = [...new Set(enrollments.map((enrollment) => enrollment.siswaId))];

  let created = 0;
  const payload = {
    siswaIds,
    template: input.template,
    subject: input.subject,
    body: input.body,
    metadata: input.metadata,
    dedupeKey: input.dedupeKey,
  };

  if (input.audience === "SISWA" || input.audience === "SEMUA") {
    created += (await notifySiswaForStudents(payload)).created;
  }
  if (input.audience === "WALI" || input.audience === "SEMUA") {
    created += (await notifyWaliForStudents(payload)).created;
  }

  return { created };
}

/**
 * Notifikasi sekolah-wide (semua siswa dan/atau wali aktif), dipakai oleh
 * pengumuman dengan `kelasId` null.
 */
export async function notifySekolahAktif(input: {
  audience: "SISWA" | "WALI" | "SEMUA";
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
  dedupeKey?: string;
}) {
  const students = await prisma.siswa.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { id: true } });
  const siswaIds = students.map((student) => student.id);

  let created = 0;
  const payload = { siswaIds, template: input.template, subject: input.subject, body: input.body, metadata: input.metadata, dedupeKey: input.dedupeKey };

  if (input.audience === "SISWA" || input.audience === "SEMUA") {
    created += (await notifySiswaForStudents(payload)).created;
  }
  if (input.audience === "WALI" || input.audience === "SEMUA") {
    created += (await notifyWaliForStudents(payload)).created;
  }

  return { created };
}

/**
 * Notifikasi ke Guru pengampu sebuah kelas (dipakai saat siswa/wali
 * memulai diskusi baru atau membalas thread).
 */
export async function notifyGuruForKelas(input: {
  kelasId: string;
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
  dedupeKey?: string;
}) {
  const kelas = await prisma.kelas.findUnique({
    where: { id: input.kelasId },
    select: { guruProfile: { select: { user: { select: { email: true, status: true } } } } },
  });
  const guru = kelas?.guruProfile?.user;

  if (!guru || guru.status !== "ACTIVE") {
    return { created: 0 };
  }

  const notificationId = await createNotificationIfMissing({
    channel: "in_app",
    template: input.template,
    recipient: guru.email,
    subject: input.subject,
    body: input.body,
    metadata: input.metadata,
    dedupeKey: input.dedupeKey,
  });

  return { created: notificationId ? 1 : 0 };
}

export async function notifyAdmins(input: {
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    select: { email: true },
  });
  let created = 0;

  for (const admin of admins) {
    if (await createNotificationIfMissing({ channel: "in_app", template: input.template, recipient: admin.email, subject: input.subject, body: input.body, dedupeKey: createHash("sha256").update(`${input.template}|${admin.email}|${input.body}`).digest("hex"), metadata: input.metadata })) created += 1;
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
      if (await createNotificationIfMissing({ channel: "in_app", template: `guru-pending-${task.type}`, recipient: actor.email, subject: `${task.action} tertunda: ${session.kelas.name}`, body: `${task.label} untuk sesi ${session.meetingNumber}: ${session.topic} baru terisi ${task.filled}/${students} siswa.`, dedupeKey: createHash("sha256").update(`guru-pending-${task.type}|${actor.email}|${session.id}`).digest("hex"), metadata: { sesiKelasId: session.id, taskType: task.type, filled: task.filled, expected: students } })) created += 1;
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
