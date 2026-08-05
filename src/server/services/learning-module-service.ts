import "server-only";

import type { Actor } from "@/server/auth/session";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { notifyWaliForStudents } from "@/server/services/notification-service";
import { addModuleItemSchema, createLearningModuleSchema, reorderModuleItemsSchema, updateLearningModuleSchema } from "@/server/validation/learning-module";

type SupportedModuleItemType = "MATERIAL" | "ASSIGNMENT" | "EXAM" | "CLASS_SESSION";

function requireModulesFeature() {
  requireFeature("learningModulesEnabled", "Modul pembelajaran belum diaktifkan");
}

async function assertGuruClass(actor: Actor, kelasId: string) {
  requireModulesFeature();
  if (actor.role !== "GURU" || !(await canManageClass(actor, kelasId))) {
    throw new ForbiddenError("Anda tidak memiliki akses mengelola modul kelas ini");
  }
}

function parseDateTime(value: string | undefined, field: string) {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`Tanggal ${field} belum valid`, { [field]: [`Tanggal ${field} belum valid`] });
  return parsed;
}

function assertDateOrder(releaseAt: Date | undefined, dueAt: Date | undefined) {
  if (releaseAt && dueAt && dueAt < releaseAt) {
    throw new ValidationError("Batas akhir modul tidak boleh sebelum waktu release", { dueAt: ["Batas akhir modul tidak boleh sebelum waktu release"] });
  }
}

const moduleSelect = {
    id: true,
    kelasId: true,
    title: true,
    description: true,
    order: true,
    status: true,
    releaseAt: true,
    dueAt: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
    items: {
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        itemType: true,
        entityId: true,
        titleOverride: true,
        order: true,
        isRequired: true,
        availableFrom: true,
        availableUntil: true,
        prerequisiteItemId: true,
        prerequisiteItem: { select: { id: true, itemType: true, entityId: true, titleOverride: true } },
      },
    },
  } satisfies Prisma.LearningModuleSelect;

type ModuleRecord = Prisma.LearningModuleGetPayload<{ select: typeof moduleSelect }>;
type ModuleItemRecord = ModuleRecord["items"][number];

async function getModule(moduleId: string) {
  return prisma.learningModule.findUnique({ where: { id: moduleId }, select: moduleSelect });
}

async function decorateItems(items: ModuleItemRecord[], now = new Date()) {
  const materialIds = items.filter((item) => item.itemType === "MATERIAL").map((item) => item.entityId);
  const assignmentIds = items.filter((item) => item.itemType === "ASSIGNMENT").map((item) => item.entityId);
  const examIds = items.filter((item) => item.itemType === "EXAM").map((item) => item.entityId);
  const sessionIds = items.filter((item) => item.itemType === "CLASS_SESSION").map((item) => item.entityId);
  const [materials, assignments, exams, sessions] = await Promise.all([
    prisma.materi.findMany({ where: { id: { in: materialIds } }, select: { id: true, title: true, status: true } }),
    prisma.assignment.findMany({ where: { id: { in: assignmentIds } }, select: { id: true, title: true, status: true } }),
    prisma.ujian.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true, status: true } }),
    prisma.sesiKelas.findMany({ where: { id: { in: sessionIds } }, select: { id: true, topic: true, status: true, meetingNumber: true } }),
  ]);
  const targets = new Map<string, { title: string; status: string }>();
  materials.forEach((item) => targets.set(`MATERIAL:${item.id}`, { title: item.title, status: item.status }));
  assignments.forEach((item) => targets.set(`ASSIGNMENT:${item.id}`, { title: item.title, status: item.status }));
  exams.forEach((item) => targets.set(`EXAM:${item.id}`, { title: item.title, status: item.status }));
  sessions.forEach((item) => targets.set(`CLASS_SESSION:${item.id}`, { title: `Pertemuan ${item.meetingNumber}: ${item.topic}`, status: item.status }));

  return items.map((item) => {
    const target = targets.get(`${item.itemType}:${item.entityId}`);
    const availableFrom = !item.availableFrom || item.availableFrom <= now;
    const availableUntil = !item.availableUntil || item.availableUntil >= now;
    const targetPublished = item.itemType === "CLASS_SESSION" ? Boolean(target && target.status !== "CANCELLED") : target?.status === "PUBLISHED";
    return {
      ...item,
      title: item.titleOverride || target?.title || "Aktivitas tidak ditemukan",
      targetStatus: target?.status || "MISSING",
      targetPublished: Boolean(targetPublished),
      isAvailable: availableFrom && availableUntil && !item.prerequisiteItemId && Boolean(targetPublished),
      isScheduled: !availableFrom,
      isExpired: !availableUntil,
      isLockedByPrerequisite: Boolean(item.prerequisiteItemId),
    };
  });
}

async function decorateModule(module: ModuleRecord) {
  return { ...module, items: await decorateItems(module.items) };
}

export async function listModuleItemOptions(actor: Actor, kelasId: string) {
  await assertGuruClass(actor, kelasId);
  const [materials, assignments, exams, sessions] = await Promise.all([
    prisma.materi.findMany({ where: { kelasId }, orderBy: [{ order: "asc" }, { title: "asc" }], select: { id: true, title: true, status: true } }),
    prisma.assignment.findMany({ where: { kelasId }, orderBy: [{ createdAt: "desc" }], select: { id: true, title: true, status: true } }),
    prisma.ujian.findMany({ where: { kelasId }, orderBy: [{ createdAt: "desc" }], select: { id: true, title: true, status: true } }),
    prisma.sesiKelas.findMany({ where: { kelasId }, orderBy: [{ meetingNumber: "asc" }], select: { id: true, meetingNumber: true, topic: true, status: true } }),
  ]);
  return {
    materials,
    assignments,
    exams,
    sessions: sessions.map((item) => ({ id: item.id, title: `Pertemuan ${item.meetingNumber}: ${item.topic}`, status: item.status })),
  };
}

export async function listGuruModules(actor: Actor, kelasId: string) {
  await assertGuruClass(actor, kelasId);
  await publishDueLearningModules();
  const modules = await prisma.learningModule.findMany({ where: { kelasId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: moduleSelect });
  return { items: await Promise.all(modules.map((module) => decorateModule(module))) };
}

export async function getGuruModule(actor: Actor, moduleId: string) {
  requireModulesFeature();
  const learningModule = await getModule(moduleId);
  if (!learningModule) throw new NotFoundError("Modul tidak ditemukan");
  await assertGuruClass(actor, learningModule.kelasId);
  return { item: await decorateModule(learningModule) };
}

export async function createLearningModule(actor: Actor, kelasId: string, input: unknown) {
  await assertGuruClass(actor, kelasId);
  const parsed = createLearningModuleSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data modul belum valid", parsed.error.flatten().fieldErrors);
  const releaseAt = parseDateTime(parsed.data.releaseAt, "releaseAt");
  const dueAt = parseDateTime(parsed.data.dueAt, "dueAt");
  assertDateOrder(releaseAt, dueAt);
  const status = releaseAt && releaseAt > new Date() ? "SCHEDULED" : "DRAFT";

  const item = await prisma.$transaction(async (tx) => {
     const createdModule = await tx.learningModule.create({
      data: { kelasId, title: parsed.data.title, description: parsed.data.description || undefined, order: parsed.data.order, status, releaseAt, dueAt, createdById: actor.id },
      select: { id: true, title: true, status: true, order: true },
    });
     await tx.auditLog.create({ data: { actorId: actor.id, action: "LEARNING_MODULE_CREATED", entityType: "LearningModule", entityId: createdModule.id } });
     return createdModule;
  });
  return { item };
}

export async function updateLearningModule(actor: Actor, moduleId: string, input: unknown) {
  requireModulesFeature();
  const parsed = updateLearningModuleSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data modul belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.learningModule.findUnique({ where: { id: moduleId }, select: { id: true, kelasId: true, status: true, releaseAt: true, dueAt: true, publishedAt: true } });
  if (!existing) throw new NotFoundError("Modul tidak ditemukan");
  await assertGuruClass(actor, existing.kelasId);

  const releaseAt = Object.hasOwn(parsed.data, "releaseAt") ? parseDateTime(parsed.data.releaseAt, "releaseAt") : existing.releaseAt || undefined;
  const dueAt = Object.hasOwn(parsed.data, "dueAt") ? parseDateTime(parsed.data.dueAt, "dueAt") : existing.dueAt || undefined;
  assertDateOrder(releaseAt, dueAt);
  let status = parsed.data.status || existing.status;
  if (status === "PUBLISHED" && releaseAt && releaseAt > new Date()) status = "SCHEDULED";
  if (status === "SCHEDULED" && (!releaseAt || releaseAt <= new Date())) status = "PUBLISHED";
  if (status === "PUBLISHED" && existing.status === "ARCHIVED") throw new ConflictError("Modul arsip harus dikembalikan menjadi draft sebelum dipublish");

  const data: Parameters<typeof prisma.learningModule.update>[0]["data"] = {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
    ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
    ...(Object.hasOwn(parsed.data, "releaseAt") ? { releaseAt: releaseAt || null } : {}),
    ...(Object.hasOwn(parsed.data, "dueAt") ? { dueAt: dueAt || null } : {}),
    status,
    ...(status === "PUBLISHED" && existing.status !== "PUBLISHED" ? { publishedAt: new Date() } : {}),
    ...(status === "DRAFT" ? { publishedAt: null } : {}),
  };
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.learningModule.update({ where: { id: moduleId }, data, select: { id: true, title: true, status: true, publishedAt: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: `LEARNING_MODULE_${status}`, entityType: "LearningModule", entityId: moduleId } });
    return updated;
  });
  if (status === "PUBLISHED" && existing.status !== "PUBLISHED") await notifyModulePublished(existing.kelasId, moduleId, item.title);
  return { item };
}

export async function addModuleItem(actor: Actor, moduleId: string, input: unknown) {
  requireModulesFeature();
  const parsed = addModuleItemSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Aktivitas modul belum valid", parsed.error.flatten().fieldErrors);
  const learningModule = await prisma.learningModule.findUnique({ where: { id: moduleId }, select: { id: true, kelasId: true } });
  if (!learningModule) throw new NotFoundError("Modul tidak ditemukan");
  await assertGuruClass(actor, learningModule.kelasId);
  const itemType = parsed.data.itemType as SupportedModuleItemType | "ASSIGNMENT" | "QUIZ" | "DISCUSSION";
  if (!(["MATERIAL", "ASSIGNMENT", "EXAM", "CLASS_SESSION"] as string[]).includes(itemType)) {
    throw new ConflictError(`Aktivitas ${itemType} belum tersedia pada fase ini`);
  }
  const supportedItemType = itemType as SupportedModuleItemType;
  await assertEntityBelongsToClass(learningModule.kelasId, supportedItemType, parsed.data.entityId);
  const duplicate = await prisma.moduleItem.findUnique({
    where: { moduleId_itemType_entityId: { moduleId, itemType: supportedItemType, entityId: parsed.data.entityId } },
    select: { id: true },
  });
  if (duplicate) throw new ConflictError("Aktivitas ini sudah ada di modul");
  if (parsed.data.prerequisiteItemId) {
    await assertPrerequisite(moduleId, parsed.data.prerequisiteItemId);
  }
  const availableFrom = parseDateTime(parsed.data.availableFrom, "availableFrom");
  const availableUntil = parseDateTime(parsed.data.availableUntil, "availableUntil");
  assertDateOrder(availableFrom, availableUntil);
  const maxOrder = await prisma.moduleItem.aggregate({ where: { moduleId }, _max: { order: true } });
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.moduleItem.create({
      data: {
        moduleId,
        itemType: supportedItemType,
        entityId: parsed.data.entityId,
        titleOverride: parsed.data.titleOverride || undefined,
        order: parsed.data.order ?? ((maxOrder._max.order ?? -1) + 1),
        isRequired: parsed.data.isRequired,
        availableFrom,
        availableUntil,
        prerequisiteItemId: parsed.data.prerequisiteItemId || undefined,
      },
      select: { id: true, itemType: true, entityId: true, order: true },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "LEARNING_MODULE_ITEM_ADDED", entityType: "ModuleItem", entityId: created.id, metadata: { moduleId, itemType: supportedItemType, entityId: parsed.data.entityId } } });
    return created;
  });
  return { item };
}

async function assertEntityBelongsToClass(kelasId: string, itemType: SupportedModuleItemType, entityId: string) {
  const entity = itemType === "MATERIAL"
    ? await prisma.materi.findFirst({ where: { id: entityId, kelasId }, select: { id: true } })
    : itemType === "ASSIGNMENT"
      ? await prisma.assignment.findFirst({ where: { id: entityId, kelasId }, select: { id: true } })
    : itemType === "EXAM"
      ? await prisma.ujian.findFirst({ where: { id: entityId, kelasId }, select: { id: true } })
      : await prisma.sesiKelas.findFirst({ where: { id: entityId, kelasId }, select: { id: true } });
  if (!entity) throw new NotFoundError("Aktivitas tidak ditemukan pada kelas modul ini");
}

async function assertPrerequisite(moduleId: string, prerequisiteItemId: string) {
  const prerequisite = await prisma.moduleItem.findFirst({ where: { id: prerequisiteItemId, moduleId }, select: { id: true, prerequisiteItemId: true } });
  if (!prerequisite) throw new NotFoundError("Prasyarat harus berasal dari modul yang sama");
  const seen = new Set<string>();
  let cursor: string | null = prerequisite.id;
  while (cursor) {
    if (seen.has(cursor)) throw new ConflictError("Rantai prasyarat modul tidak valid");
    seen.add(cursor);
    const item: { id: string; prerequisiteItemId: string | null } | null = await prisma.moduleItem.findUnique({ where: { id: cursor }, select: { id: true, prerequisiteItemId: true } });
    cursor = item?.prerequisiteItemId || null;
  }
}

export async function deleteModuleItem(actor: Actor, moduleId: string, itemId: string) {
  requireModulesFeature();
  const learningModule = await prisma.learningModule.findUnique({ where: { id: moduleId }, select: { kelasId: true } });
  if (!learningModule) throw new NotFoundError("Modul tidak ditemukan");
  await assertGuruClass(actor, learningModule.kelasId);
  const item = await prisma.moduleItem.findFirst({ where: { id: itemId, moduleId }, select: { id: true } });
  if (!item) throw new NotFoundError("Aktivitas modul tidak ditemukan");
  await prisma.$transaction([
    prisma.moduleItem.delete({ where: { id: itemId } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "LEARNING_MODULE_ITEM_REMOVED", entityType: "ModuleItem", entityId: itemId, metadata: { moduleId } } }),
  ]);
  return { success: true };
}

export async function reorderModuleItems(actor: Actor, moduleId: string, input: unknown) {
  requireModulesFeature();
  const parsed = reorderModuleItemsSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Urutan aktivitas belum valid", parsed.error.flatten().fieldErrors);
  const learningModule = await prisma.learningModule.findUnique({ where: { id: moduleId }, select: { kelasId: true } });
  if (!learningModule) throw new NotFoundError("Modul tidak ditemukan");
  await assertGuruClass(actor, learningModule.kelasId);
  const existing = await prisma.moduleItem.findMany({ where: { moduleId }, select: { id: true } });
  const existingIds = new Set(existing.map((item) => item.id));
  if (existingIds.size !== parsed.data.itemIds.length || parsed.data.itemIds.some((id) => !existingIds.has(id)) || new Set(parsed.data.itemIds).size !== parsed.data.itemIds.length) {
    throw new ValidationError("Urutan harus memuat seluruh aktivitas modul tepat satu kali");
  }
  await prisma.$transaction(async (tx) => {
    for (const [order, itemId] of parsed.data.itemIds.entries()) {
      await tx.moduleItem.update({ where: { id: itemId }, data: { order } });
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "LEARNING_MODULE_ITEMS_REORDERED", entityType: "LearningModule", entityId: moduleId } });
  });
  return { success: true };
}

export async function duplicateLearningModule(actor: Actor, moduleId: string) {
  requireModulesFeature();
  const source = await prisma.learningModule.findUnique({ where: { id: moduleId }, select: moduleSelect });
  if (!source) throw new NotFoundError("Modul tidak ditemukan");
  await assertGuruClass(actor, source.kelasId);
  const maxOrder = await prisma.learningModule.aggregate({ where: { kelasId: source.kelasId }, _max: { order: true } });
  const item = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.learningModule.create({
      data: { kelasId: source.kelasId, title: `${source.title} (Copy)`.slice(0, 200), description: source.description, order: (maxOrder._max.order ?? -1) + 1, status: "DRAFT", createdById: actor.id },
      select: { id: true, title: true, status: true, order: true },
    });
    const idMap = new Map<string, string>();
    const sourceItems = [...source.items].sort((left, right) => left.order - right.order);
    for (const sourceItem of sourceItems) {
      const copy = await tx.moduleItem.create({ data: { moduleId: duplicate.id, itemType: sourceItem.itemType, entityId: sourceItem.entityId, titleOverride: sourceItem.titleOverride, order: sourceItem.order, isRequired: sourceItem.isRequired, availableFrom: sourceItem.availableFrom, availableUntil: sourceItem.availableUntil }, select: { id: true } });
      idMap.set(sourceItem.id, copy.id);
    }
    for (const sourceItem of sourceItems) {
      if (sourceItem.prerequisiteItemId) {
        await tx.moduleItem.update({ where: { id: idMap.get(sourceItem.id) }, data: { prerequisiteItemId: idMap.get(sourceItem.prerequisiteItemId) } });
      }
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "LEARNING_MODULE_DUPLICATED", entityType: "LearningModule", entityId: duplicate.id, metadata: { sourceModuleId: moduleId, itemCount: source.items.length } } });
    return duplicate;
  });
  return { item: { ...item, itemCount: source.items.length } };
}

async function assertStudentClass(actor: Actor, kelasId: string) {
  requireModulesFeature();
  if (actor.role !== "SISWA") throw new ForbiddenError("Akses modul ini hanya tersedia untuk Siswa");
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } } });
  if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun Siswa belum aktif");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId: account.siswaId, kelasId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { siswaId: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  return enrollment.siswaId;
}

export async function listStudentModules(actor: Actor, kelasId: string) {
  const siswaId = await assertStudentClass(actor, kelasId);
  await publishDueLearningModules();
  const modules = await prisma.learningModule.findMany({ where: { kelasId, status: "PUBLISHED", OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }] }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: moduleSelect });
  return { siswaId, items: await Promise.all(modules.map((module) => decorateModule(module))) };
}

export async function listWaliModules(actor: Actor, siswaId: string, kelasId: string) {
  requireModulesFeature();
  if (actor.role !== "WALI" || !(await canAccessStudent(actor, siswaId))) throw new ForbiddenError("Anda tidak memiliki akses ke modul siswa ini");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId, kelasId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  await publishDueLearningModules();
  const modules = await prisma.learningModule.findMany({ where: { kelasId, status: "PUBLISHED", OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }] }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: moduleSelect });
  return { items: await Promise.all(modules.map((module) => decorateModule(module))) };
}

export async function listWaliStudentModules(actor: Actor, siswaId: string) {
  requireModulesFeature();
  if (actor.role !== "WALI" || !(await canAccessStudent(actor, siswaId))) throw new ForbiddenError("Anda tidak memiliki akses ke modul siswa ini");
  await publishDueLearningModules();
  const enrollments = await prisma.kelasSiswa.findMany({ where: { siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, orderBy: { startDate: "desc" }, select: { kelasId: true, kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } } } });
  const classes = await Promise.all(enrollments.map(async (enrollment) => ({ ...enrollment.kelas, modules: await listWaliModules(actor, siswaId, enrollment.kelasId) })));
  return { classes };
}

async function publishDueLearningModules() {
  const due = await prisma.learningModule.findMany({ where: { status: "SCHEDULED", releaseAt: { not: null, lte: new Date() } }, select: { id: true, kelasId: true, title: true } });
  for (const learningModule of due) {
    const result = await prisma.learningModule.updateMany({ where: { id: learningModule.id, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    if (result.count > 0) {
      await prisma.auditLog.create({ data: { action: "LEARNING_MODULE_PUBLISHED", entityType: "LearningModule", entityId: learningModule.id, metadata: { source: "schedule" } } });
      await notifyModulePublished(learningModule.kelasId, learningModule.id, learningModule.title);
    }
  }
}

async function notifyModulePublished(kelasId: string, moduleId: string, title: string) {
  const students = await prisma.kelasSiswa.findMany({ where: { kelasId, status: "ACTIVE" }, select: { siswaId: true } });
  await notifyWaliForStudents({ siswaIds: students.map((student) => student.siswaId), template: "learning-module-published", subject: `Modul tersedia: ${title}`, body: `Modul ${title} sudah tersedia untuk kelas anak. Buka portal untuk melihat urutan aktivitas belajar.`, metadata: { moduleId } });
}
