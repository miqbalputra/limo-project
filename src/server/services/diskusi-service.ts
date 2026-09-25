import "server-only";

import { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { assertManageKelasForum, assertViewKelasForum, canManageClass } from "@/server/policies/access-policy";
import { assertRateLimit } from "@/server/security/rate-limit";
import { readPrivateFile, storeMaterialFile } from "@/server/providers/storage/local-storage";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { createNotificationIfMissing, notifyGuruForKelas } from "@/server/services/notification-service";
import {
  createDiskusiBalasanSchema,
  createDiskusiThreadSchema,
  moderateDiskusiBalasanSchema,
  moderateDiskusiThreadSchema,
  reportDiskusiSchema,
  resolveDiskusiLaporanSchema,
  updateDiskusiBalasanSchema,
  updateDiskusiThreadSchema,
} from "@/server/validation/diskusi";

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const attachmentSelect = { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } as const;

const threadSelect = {
  id: true,
  kelasId: true,
  createdById: true,
  title: true,
  content: true,
  status: true,
  isPinned: true,
  replyCount: true,
  lastReplyAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  kelas: { select: { id: true, name: true, program: { select: { name: true } } } },
  createdBy: { select: { id: true, name: true, role: true } },
} as const;

const replySelect = {
  id: true,
  threadId: true,
  content: true,
  parentReplyId: true,
  isTeacherAnswer: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, role: true } },
  attachments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" as const }, select: attachmentSelect },
} as const;

function readerThreadWhere(manage: boolean) {
  return manage ? {} : { deletedAt: null, status: { not: "HIDDEN" as const } };
}

function readerReplyWhere(manage: boolean) {
  return manage ? {} : { deletedAt: null, status: "VISIBLE" as const };
}

async function isForumManager(actor: Actor, kelasId: string) {
  return (await canManageClass(actor, kelasId)) || actor.role === "ADMIN";
}

function assertCanWriteThread(actor: Actor) {
  if (actor.role === "WALI") {
    throw new ForbiddenError("Wali dapat membalas diskusi, tetapi tidak membuat thread baru");
  }
  if (actor.role !== "SISWA" && actor.role !== "GURU" && actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

async function notifyUser(userId: string | null, input: { template: string; subject: string; body: string; dedupeKey: string; metadata?: Record<string, string | number | boolean | null> }) {
  if (!userId) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
  if (!user || user.status !== "ACTIVE") return;

  await createNotificationIfMissing({
    channel: "in_app",
    template: input.template,
    recipient: user.email,
    subject: input.subject,
    body: input.body,
    metadata: input.metadata,
    dedupeKey: input.dedupeKey,
  });
}

async function recountThread(tx: Prisma.TransactionClient, threadId: string) {
  const count = await tx.diskusiBalasan.count({ where: { threadId, deletedAt: null, status: "VISIBLE" } });
  const latest = await tx.diskusiBalasan.findFirst({
    where: { threadId, deletedAt: null, status: "VISIBLE" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  await tx.diskusiThread.update({ where: { id: threadId }, data: { replyCount: count, lastReplyAt: latest?.createdAt ?? null } });
}

function assertRateLimited(actor: Actor) {
  assertRateLimit({ key: `diskusi-post:${actor.id}`, limit: 30, windowMs: 15 * 60 * 1000, message: "Terlalu banyak postingan. Coba lagi nanti" });
}

export async function listDiskusiThreads(actor: Actor, kelasId: string, paginationInput: PaginationInput = {}) {
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } },
  });
  if (!kelas) throw new NotFoundError("Kelas tidak ditemukan");

  await assertViewKelasForum(actor, kelasId);
  const manage = await isForumManager(actor, kelasId);

  const pagination = resolvePagination(paginationInput, 20);
  const where = { kelasId, ...readerThreadWhere(manage) };

  const [totalItems, items] = await Promise.all([
    prisma.diskusiThread.count({ where }),
    prisma.diskusiThread.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { lastReplyAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: threadSelect,
    }),
  ]);

  return {
    kelas,
    manage,
    items,
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}

export async function createDiskusiThread(actor: Actor, input: unknown) {
  const parsed = createDiskusiThreadSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Thread diskusi belum valid", parsed.error.flatten().fieldErrors);

  assertCanWriteThread(actor);
  await assertViewKelasForum(actor, parsed.data.kelasId);
  assertRateLimited(actor);

  const thread = await prisma.$transaction(async (tx) => {
    const created = await tx.diskusiThread.create({
      data: {
        kelasId: parsed.data.kelasId,
        title: parsed.data.title,
        content: parsed.data.content,
        createdById: actor.id,
      },
      select: { id: true, kelasId: true, title: true, content: true },
    });

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "DISKUSI_THREAD_CREATED", entityType: "DiskusiThread", entityId: created.id, metadata: { kelasId: created.kelasId } },
    });

    return created;
  });

  if (actor.role === "SISWA" || actor.role === "WALI") {
    await notifyGuruForKelas({
      kelasId: thread.kelasId,
      template: "diskusi-baru",
      subject: `Diskusi baru: ${thread.title}`,
      body: `${actor.name} memulai diskusi baru di kelas. Buka ruang diskusi untuk menjawab.`,
      metadata: { threadId: thread.id, kelasId: thread.kelasId },
      dedupeKey: `diskusi-baru:${thread.id}`,
    });
  }

  return { item: { id: thread.id, kelasId: thread.kelasId, title: thread.title, status: "OPEN" } };
}

export async function updateDiskusiThread(actor: Actor, threadId: string, input: unknown) {
  const parsed = updateDiskusiThreadSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Thread diskusi belum valid", parsed.error.flatten().fieldErrors);

  const thread = await prisma.diskusiThread.findUnique({ where: { id: threadId }, select: { id: true, kelasId: true, createdById: true, status: true, deletedAt: true } });
  if (!thread) throw new NotFoundError("Diskusi tidak ditemukan");
  await assertViewKelasForum(actor, thread.kelasId);

  const manage = await isForumManager(actor, thread.kelasId);
  if (!manage && thread.createdById !== actor.id) throw new ForbiddenError("Anda hanya dapat mengubah pesan sendiri");
  if (!manage && thread.deletedAt) throw new NotFoundError("Diskusi tidak ditemukan");

  const updated = await prisma.diskusiThread.update({
    where: { id: threadId },
    data: { title: parsed.data.title, content: parsed.data.content },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "DISKUSI_THREAD_UPDATED", entityType: "DiskusiThread", entityId: updated.id, metadata: { kelasId: thread.kelasId } },
  });

  return { item: { id: updated.id } };
}

export async function getDiskusiThread(actor: Actor, threadId: string, paginationInput: PaginationInput = {}) {
  const thread = await prisma.diskusiThread.findUnique({
    where: { id: threadId },
    select: {
      ...threadSelect,
      attachments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: attachmentSelect,
      },
      kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
    },
  });
  if (!thread) throw new NotFoundError("Diskusi tidak ditemukan");

  await assertViewKelasForum(actor, thread.kelasId);
  const manage = await isForumManager(actor, thread.kelasId);

  if (!manage && (thread.deletedAt || thread.status === "HIDDEN")) {
    throw new NotFoundError("Diskusi tidak ditemukan");
  }

  const pagination = resolvePagination(paginationInput, 50);
  const where = { threadId, ...readerReplyWhere(manage) };

  const [totalItems, replies] = await Promise.all([
    prisma.diskusiBalasan.count({ where }),
    prisma.diskusiBalasan.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.take,
      select: replySelect,
    }),
  ]);

  return {
    thread,
    manage,
    canAttach: manage || Boolean(thread.createdById && thread.createdById === actor.id),
    replies,
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}

export async function createDiskusiBalasan(actor: Actor, threadId: string, input: unknown) {
  const parsed = createDiskusiBalasanSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Balasan belum valid", parsed.error.flatten().fieldErrors);

  if (actor.role !== "SISWA" && actor.role !== "GURU" && actor.role !== "ADMIN" && actor.role !== "WALI") {
    throw new ForbiddenError();
  }

  const thread = await prisma.diskusiThread.findUnique({ where: { id: threadId }, select: { id: true, kelasId: true, status: true, deletedAt: true, createdById: true, title: true } });
  if (!thread || thread.deletedAt) throw new NotFoundError("Diskusi tidak ditemukan");

  await assertViewKelasForum(actor, thread.kelasId);
  assertRateLimited(actor);

  if (thread.status === "HIDDEN") throw new NotFoundError("Diskusi tidak ditemukan");
  if (thread.status === "LOCKED") {
    const manage = await isForumManager(actor, thread.kelasId);
    if (!manage) throw new ConflictError("Diskusi dikunci dan tidak dapat dibalas");
  }

  const parentReplyId = parsed.data.parentReplyId || null;
  if (parentReplyId) {
    const parent = await prisma.diskusiBalasan.findFirst({ where: { id: parentReplyId, threadId }, select: { id: true } });
    if (!parent) throw new ValidationError("Balasan induk tidak ditemukan", { parentReplyId: ["Balasan induk tidak ditemukan"] });
  }

  const reply = await prisma.$transaction(async (tx) => {
    const created = await tx.diskusiBalasan.create({
      data: { threadId, content: parsed.data.content, createdById: actor.id, parentReplyId },
      select: { id: true, threadId: true, createdAt: true },
    });
    await recountThread(tx, threadId);
    await tx.auditLog.create({
      data: { actorId: actor.id, action: "DISKUSI_BALASAN_CREATED", entityType: "DiskusiBalasan", entityId: created.id, metadata: { threadId, kelasId: thread.kelasId } },
    });
    return created;
  });

  if (thread.createdById && thread.createdById !== actor.id) {
    await notifyUser(thread.createdById, {
      template: "diskusi-balasan",
      subject: `Balasan di diskusi: ${thread.title}`,
      body: `${actor.name} membalas diskusi yang Anda buat.`,
      dedupeKey: `diskusi-balasan:${reply.id}`,
      metadata: { threadId, replyId: reply.id },
    });
  }
  if (actor.role === "SISWA" || actor.role === "WALI") {
    await notifyGuruForKelas({
      kelasId: thread.kelasId,
      template: "diskusi-balasan",
      subject: `Balasan baru di diskusi: ${thread.title}`,
      body: `${actor.name} menambahkan balasan pada diskusi kelas.`,
      metadata: { threadId, replyId: reply.id, kelasId: thread.kelasId },
      dedupeKey: `diskusi-guru:${reply.id}`,
    });
  }

  return { item: { id: reply.id, threadId } };
}

export async function updateDiskusiBalasan(actor: Actor, replyId: string, input: unknown) {
  const parsed = updateDiskusiBalasanSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Balasan belum valid", parsed.error.flatten().fieldErrors);

  const reply = await prisma.diskusiBalasan.findUnique({
    where: { id: replyId },
    select: { id: true, threadId: true, createdById: true, createdAt: true, deletedAt: true, thread: { select: { kelasId: true } } },
  });
  if (!reply) throw new NotFoundError("Balasan tidak ditemukan");

  await assertViewKelasForum(actor, reply.thread.kelasId);
  const manage = await isForumManager(actor, reply.thread.kelasId);

  if (!manage) {
    if (reply.deletedAt) throw new NotFoundError("Balasan tidak ditemukan");
    if (reply.createdById !== actor.id) throw new ForbiddenError("Anda hanya dapat mengubah balasan sendiri");
    if (Date.now() - reply.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ConflictError("Balasan hanya dapat diubah dalam 15 menit pertama");
    }
  }

  const updated = await prisma.diskusiBalasan.update({ where: { id: replyId }, data: { content: parsed.data.content }, select: { id: true } });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "DISKUSI_BALASAN_UPDATED", entityType: "DiskusiBalasan", entityId: updated.id, metadata: { threadId: reply.threadId } },
  });

  return { item: { id: updated.id } };
}

export async function moderateDiskusiThread(actor: Actor, threadId: string, input: unknown) {
  const parsed = moderateDiskusiThreadSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Aksi moderasi belum valid", parsed.error.flatten().fieldErrors);

  const thread = await prisma.diskusiThread.findUnique({ where: { id: threadId }, select: { id: true, kelasId: true } });
  if (!thread) throw new NotFoundError("Diskusi tidak ditemukan");

  await assertManageKelasForum(actor, thread.kelasId);

  const action = parsed.data.action;
  const data = action === "pin" ? { isPinned: true }
    : action === "unpin" ? { isPinned: false }
      : action === "lock" ? { status: "LOCKED" as const }
        : action === "unlock" ? { status: "OPEN" as const }
          : action === "hide" ? { status: "HIDDEN" as const }
            : action === "restore" ? { status: "OPEN" as const, deletedAt: null }
              : { deletedAt: new Date() };

  const updated = await prisma.diskusiThread.update({ where: { id: threadId }, data, select: threadSelect });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: `DISKUSI_THREAD_${action.toUpperCase()}`,
      entityType: "DiskusiThread",
      entityId: threadId,
      metadata: { kelasId: thread.kelasId },
    },
  });

  return { item: updated };
}

export async function moderateDiskusiBalasan(actor: Actor, replyId: string, input: unknown) {
  const parsed = moderateDiskusiBalasanSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Aksi moderasi belum valid", parsed.error.flatten().fieldErrors);

  const reply = await prisma.diskusiBalasan.findUnique({ where: { id: replyId }, select: { id: true, threadId: true, thread: { select: { kelasId: true } } } });
  if (!reply) throw new NotFoundError("Balasan tidak ditemukan");

  await assertManageKelasForum(actor, reply.thread.kelasId);

  const action = parsed.data.action;
  const data = action === "hide" ? { status: "HIDDEN" as const }
    : action === "restore" ? { status: "VISIBLE" as const, deletedAt: null }
      : action === "markTeacherAnswer" ? { isTeacherAnswer: true }
        : action === "unmarkTeacherAnswer" ? { isTeacherAnswer: false }
          : { deletedAt: new Date() };

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.diskusiBalasan.update({ where: { id: replyId }, data, select: replySelect });
    await recountThread(tx, reply.threadId);
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: `DISKUSI_BALASAN_${action.toUpperCase()}`,
        entityType: "DiskusiBalasan",
        entityId: replyId,
        metadata: { threadId: reply.threadId, kelasId: reply.thread.kelasId },
      },
    });
    return row;
  });

  return { item: updated };
}

export async function listWaliDiskusi(actor: Actor, selectedStudentId: string | null = null, paginationInput: PaginationInput = {}) {
  if (actor.role !== "WALI") throw new ForbiddenError("Hanya untuk akun wali");

  const relations = await prisma.waliSiswa.findMany({
    where: {
      endedAt: null,
      waliProfile: { userId: actor.id },
      siswa: { status: "ACTIVE", deletedAt: null },
      ...(selectedStudentId ? { siswaId: selectedStudentId } : {}),
    },
    select: { siswaId: true },
  });
  const siswaIds = relations.map((relation) => relation.siswaId);
  const pagination = resolvePagination(paginationInput, 20);

  if (siswaIds.length === 0) return { items: [], pagination: createPaginationMeta(pagination.page, pagination.pageSize, 0) };

  const enrollments = await prisma.kelasSiswa.findMany({
    where: { siswaId: { in: siswaIds }, status: "ACTIVE", kelas: { status: "ACTIVE" } },
    select: { kelasId: true },
  });
  const kelasIds = [...new Set(enrollments.map((enrollment) => enrollment.kelasId))];
  if (kelasIds.length === 0) return { items: [], pagination: createPaginationMeta(pagination.page, pagination.pageSize, 0) };

  const where = { kelasId: { in: kelasIds }, ...readerThreadWhere(false) };
  const [totalItems, items] = await Promise.all([
    prisma.diskusiThread.count({ where }),
    prisma.diskusiThread.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { lastReplyAt: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: threadSelect,
    }),
  ]);

  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems) };
}

async function assertCanAttach(actor: Actor, threadId: string) {
  const thread = await prisma.diskusiThread.findUnique({
    where: { id: threadId },
    select: { id: true, kelasId: true, status: true, deletedAt: true, createdById: true },
  });
  if (!thread || thread.deletedAt) throw new NotFoundError("Diskusi tidak ditemukan");

  await assertViewKelasForum(actor, thread.kelasId);
  if (thread.status === "HIDDEN") throw new NotFoundError("Diskusi tidak ditemukan");

  const manage = await isForumManager(actor, thread.kelasId);
  if (!manage && thread.createdById !== actor.id) {
    throw new ForbiddenError("Hanya pembuat diskusi atau pengelola kelas yang dapat melampirkan berkas");
  }

  return thread;
}

export async function attachDiskusiFile(actor: Actor, threadId: string, file: File | null) {
  if (!file) throw new ValidationError("File lampiran wajib dipilih");

  const thread = await assertCanAttach(actor, threadId);
  assertRateLimit({ key: `diskusi-upload:${actor.id}`, limit: 20, windowMs: 60 * 60 * 1000, message: "Terlalu banyak unggahan lampiran. Coba lagi nanti" });

  const stored = await storeMaterialFile(file, "diskusi");
  const asset = await prisma.fileAsset.create({
    data: {
      ownerType: "DISKUSI",
      ownerId: thread.id,
      diskusiThreadId: thread.id,
      originalName: stored.originalName,
      storedName: stored.storedName,
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      checksumSha256: stored.checksumSha256 ?? null,
      uploadedById: actor.id,
    },
    select: attachmentSelect,
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "DISKUSI_LAMPIRAN_ADDED",
      entityType: "FileAsset",
      entityId: asset.id,
      metadata: { threadId: thread.id, kelasId: thread.kelasId },
    },
  });

  // sizeBytes BigInt tidak dapat diserialisasi ke JSON.
  return { item: { ...asset, sizeBytes: Number(asset.sizeBytes) } };
}

export async function getDiskusiThreadFile(actor: Actor, threadId: string, fileId: string) {
  const thread = await prisma.diskusiThread.findUnique({
    where: { id: threadId },
    select: { id: true, kelasId: true, status: true, deletedAt: true },
  });
  if (!thread) throw new NotFoundError("File tidak ditemukan");

  await assertViewKelasForum(actor, thread.kelasId);
  const manage = await isForumManager(actor, thread.kelasId);
  if ((thread.deletedAt || thread.status === "HIDDEN") && !manage) throw new NotFoundError("File tidak ditemukan");

  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    select: { storagePath: true, mimeType: true, originalName: true, diskusiThreadId: true, deletedAt: true },
  });
  if (!file || file.diskusiThreadId !== threadId || file.deletedAt) throw new NotFoundError("File tidak ditemukan");

  const bytes = await readPrivateFile(file.storagePath);
  return { bytes, mimeType: file.mimeType, originalName: file.originalName };
}

export async function removeDiskusiAttachment(actor: Actor, threadId: string, fileId: string) {
  const thread = await assertCanAttach(actor, threadId);

  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    select: { id: true, diskusiThreadId: true, deletedAt: true },
  });
  if (!file || file.diskusiThreadId !== threadId || file.deletedAt) throw new NotFoundError("File tidak ditemukan");

  await prisma.fileAsset.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "DISKUSI_LAMPIRAN_REMOVED",
      entityType: "FileAsset",
      entityId: fileId,
      metadata: { threadId: thread.id, kelasId: thread.kelasId },
    },
  });

  return { success: true };
}

async function assertCanAttachReply(actor: Actor, replyId: string) {
  const reply = await prisma.diskusiBalasan.findUnique({
    where: { id: replyId },
    select: { id: true, createdById: true, deletedAt: true, threadId: true, thread: { select: { id: true, kelasId: true, status: true, deletedAt: true } } },
  });
  if (!reply || reply.deletedAt) throw new NotFoundError("Balasan tidak ditemukan");

  await assertViewKelasForum(actor, reply.thread.kelasId);
  if (reply.thread.deletedAt || reply.thread.status === "HIDDEN") throw new NotFoundError("Balasan tidak ditemukan");

  const manage = await isForumManager(actor, reply.thread.kelasId);
  if (!manage && reply.createdById !== actor.id) {
    throw new ForbiddenError("Hanya penulis balasan atau pengelola kelas yang dapat melampirkan berkas");
  }

  return { reply, manage };
}

export async function attachDiskusiReplyFile(actor: Actor, replyId: string, file: File | null) {
  if (!file) throw new ValidationError("File lampiran wajib dipilih");

  const { reply } = await assertCanAttachReply(actor, replyId);
  assertRateLimit({ key: `diskusi-reply-upload:${actor.id}`, limit: 20, windowMs: 60 * 60 * 1000, message: "Terlalu banyak unggahan lampiran. Coba lagi nanti" });

  const stored = await storeMaterialFile(file, "diskusi-balasan");
  const asset = await prisma.fileAsset.create({
    data: {
      ownerType: "DISKUSI",
      ownerId: reply.id,
      diskusiBalasanId: reply.id,
      originalName: stored.originalName,
      storedName: stored.storedName,
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      checksumSha256: stored.checksumSha256 ?? null,
      uploadedById: actor.id,
    },
    select: attachmentSelect,
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "DISKUSI_BALASAN_LAMPIRAN_ADDED",
      entityType: "FileAsset",
      entityId: asset.id,
      metadata: { threadId: reply.threadId, replyId: reply.id, kelasId: reply.thread.kelasId },
    },
  });

  return { item: { ...asset, sizeBytes: Number(asset.sizeBytes) } };
}

export async function getDiskusiReplyFile(actor: Actor, replyId: string, fileId: string) {
  const reply = await prisma.diskusiBalasan.findUnique({
    where: { id: replyId },
    select: { id: true, deletedAt: true, thread: { select: { kelasId: true, status: true, deletedAt: true } } },
  });
  if (!reply) throw new NotFoundError("File tidak ditemukan");

  await assertViewKelasForum(actor, reply.thread.kelasId);
  const manage = await isForumManager(actor, reply.thread.kelasId);
  if ((reply.deletedAt || reply.thread.deletedAt || reply.thread.status === "HIDDEN") && !manage) throw new NotFoundError("File tidak ditemukan");

  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    select: { storagePath: true, mimeType: true, originalName: true, diskusiBalasanId: true, deletedAt: true },
  });
  if (!file || file.diskusiBalasanId !== replyId || file.deletedAt) throw new NotFoundError("File tidak ditemukan");

  const bytes = await readPrivateFile(file.storagePath);
  return { bytes, mimeType: file.mimeType, originalName: file.originalName };
}

export async function removeDiskusiReplyAttachment(actor: Actor, replyId: string, fileId: string) {
  const { reply } = await assertCanAttachReply(actor, replyId);

  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    select: { id: true, diskusiBalasanId: true, deletedAt: true },
  });
  if (!file || file.diskusiBalasanId !== replyId || file.deletedAt) throw new NotFoundError("File tidak ditemukan");

  await prisma.fileAsset.update({ where: { id: fileId }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "DISKUSI_BALASAN_LAMPIRAN_REMOVED",
      entityType: "FileAsset",
      entityId: fileId,
      metadata: { threadId: reply.threadId, replyId, kelasId: reply.thread.kelasId },
    },
  });

  return { success: true };
}

export async function reportDiskusiContent(actor: Actor, input: unknown) {
  const parsed = reportDiskusiSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Laporan belum valid", parsed.error.flatten().fieldErrors);

  const thread = await prisma.diskusiThread.findUnique({
    where: { id: parsed.data.threadId },
    select: { id: true, kelasId: true, status: true, deletedAt: true },
  });
  if (!thread || thread.deletedAt || thread.status === "HIDDEN") throw new NotFoundError("Diskusi tidak ditemukan");

  await assertViewKelasForum(actor, thread.kelasId);

  const replyId = parsed.data.replyId || null;
  if (replyId) {
    const reply = await prisma.diskusiBalasan.findFirst({
      where: { id: replyId, threadId: thread.id },
      select: { id: true },
    });
    if (!reply) throw new ValidationError("Balasan yang dilaporkan tidak ditemukan", { replyId: ["Balasan tidak ditemukan"] });
  }

  assertRateLimit({ key: `diskusi-report:${actor.id}`, limit: 10, windowMs: 60 * 60 * 1000, message: "Terlalu banyak laporan. Coba lagi nanti" });

  const existing = await prisma.diskusiLaporan.findFirst({
    where: { threadId: thread.id, replyId, reporterId: actor.id, status: "OPEN" },
    select: { id: true },
  });
  if (existing) return { item: { id: existing.id, status: "OPEN" } };

  const laporan = await prisma.diskusiLaporan.create({
    data: { threadId: thread.id, replyId, alasan: parsed.data.alasan, reporterId: actor.id },
    select: { id: true, status: true, alasan: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "DISKUSI_LAPORAN_CREATED",
      entityType: "DiskusiLaporan",
      entityId: laporan.id,
      metadata: { threadId: thread.id, kelasId: thread.kelasId, replyId },
    },
  });

  return { item: laporan };
}

export async function listDiskusiLaporan(
  actor: Actor,
  paginationInput: PaginationInput = {},
  filters: { status?: "OPEN" | "RESOLVED" | "DISMISSED" } = {},
) {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Hanya untuk Admin");

  const pagination = resolvePagination(paginationInput, 25);
  const where = filters.status ? { status: filters.status } : {};

  const [totalItems, items] = await Promise.all([
    prisma.diskusiLaporan.count({ where }),
    prisma.diskusiLaporan.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        replyId: true,
        alasan: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        reporter: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
        thread: {
          select: {
            id: true,
            title: true,
            status: true,
            kelas: { select: { id: true, name: true, program: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems) };
}

export async function resolveDiskusiLaporan(actor: Actor, laporanId: string, input: unknown) {
  const parsed = resolveDiskusiLaporanSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status laporan belum valid", parsed.error.flatten().fieldErrors);

  if (actor.role !== "ADMIN") throw new ForbiddenError("Hanya untuk Admin");

  const existing = await prisma.diskusiLaporan.findUnique({ where: { id: laporanId }, select: { id: true, status: true, threadId: true, thread: { select: { kelasId: true } } } });
  if (!existing) throw new NotFoundError("Laporan tidak ditemukan");

  const item = await prisma.diskusiLaporan.update({
    where: { id: laporanId },
    data: { status: parsed.data.status, resolvedById: actor.id, resolvedAt: new Date() },
    select: { id: true, status: true, resolvedAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: `DISKUSI_LAPORAN_${parsed.data.status}`,
      entityType: "DiskusiLaporan",
      entityId: laporanId,
      metadata: { threadId: existing.threadId, kelasId: existing.thread.kelasId },
    },
  });

  return { item };
}
