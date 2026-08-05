import "server-only";

import type { Actor } from "@/server/auth/session";
import { getSelectedWaliStudentId } from "@/server/dal/wali-selector-dal";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { readPrivateFile, removePrivateFile, storeRppFile } from "@/server/providers/storage/local-storage";
import { notifyWaliForStudents } from "@/server/services/notification-service";
import { createRppSchema, updateRppStatusSchema } from "@/server/validation/rpp";

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function assertGuruClass(actor: Actor, kelasId: string) {
  if (actor.role !== "GURU" || !(await canManageClass(actor, kelasId))) {
    throw new ForbiddenError("Anda tidak memiliki akses mengelola RPP kelas ini");
  }
}

export async function createRpp(actor: Actor, input: { data: unknown; file?: File | null }) {
  const parsed = createRppSchema.safeParse(input.data);
  if (!parsed.success) throw new ValidationError("Data RPP belum valid", parsed.error.flatten().fieldErrors);
  await assertGuruClass(actor, parsed.data.kelasId);

  if (parsed.data.mode === "FILE" && !(input.file instanceof File)) {
    throw new ValidationError("File RPP PDF/DOC/DOCX wajib diunggah", { file: ["File RPP wajib diunggah untuk mode upload"] });
  }

  const item = await prisma.rpp.create({
    data: {
      kelasId: parsed.data.kelasId,
      createdById: actor.id,
      mode: parsed.data.mode,
      title: parsed.data.title,
      planDate: parseDate(parsed.data.planDate),
      meetingNumber: parsed.data.meetingNumber === "" ? undefined : parsed.data.meetingNumber,
      topic: parsed.data.topic,
      learningObjectives: parsed.data.learningObjectives,
      materials: parsed.data.materials,
      difficulty: parsed.data.difficulty,
      activities: parsed.data.activities,
      assessment: parsed.data.assessment,
      durationMinutes: parsed.data.durationMinutes === "" ? undefined : parsed.data.durationMinutes,
      notes: parsed.data.notes || undefined,
      status: "DRAFT",
    },
    select: { id: true, title: true, status: true, mode: true },
  });

  if (input.file instanceof File) {
    const storedFile = await storeRppFile(input.file, `rpp/${item.id}`).catch(async (error) => {
      await prisma.rpp.delete({ where: { id: item.id } });
      throw error;
    });

    try {
      await prisma.fileAsset.create({
        data: {
          ownerType: "RPP",
          ownerId: item.id,
          rppId: item.id,
          originalName: storedFile.originalName,
          storedName: storedFile.storedName,
          storagePath: storedFile.storagePath,
          mimeType: storedFile.mimeType,
          sizeBytes: storedFile.sizeBytes,
          checksumSha256: storedFile.checksumSha256,
          visibility: "PRIVATE",
          uploadedById: actor.id,
        },
      });
    } catch (error) {
      await removePrivateFile(storedFile.storagePath);
      await prisma.rpp.delete({ where: { id: item.id } });
      throw error;
    }
  }

  await prisma.auditLog.create({ data: { actorId: actor.id, action: "RPP_CREATED", entityType: "Rpp", entityId: item.id, metadata: { mode: item.mode } } });
  return { item };
}

export async function listGuruRpp(actor: Actor) {
  if (actor.role !== "GURU") throw new ForbiddenError();
  const items = await prisma.rpp.findMany({
    where: { kelas: { status: "ACTIVE", guruProfile: { userId: actor.id } } },
    orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      mode: true,
      status: true,
      title: true,
      planDate: true,
      meetingNumber: true,
      topic: true,
      learningObjectives: true,
      materials: true,
      difficulty: true,
      activities: true,
      assessment: true,
      durationMinutes: true,
      notes: true,
      kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
      files: { where: { deletedAt: null }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
    },
  });

  return { items: items.map((item) => ({ ...item, files: item.files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })) })) };
}

export async function updateRppStatus(actor: Actor, rppId: string, input: unknown) {
  const parsed = updateRppStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status RPP belum valid", parsed.error.flatten().fieldErrors);

  const existing = await prisma.rpp.findUnique({
    where: { id: rppId },
    select: { id: true, title: true, status: true, mode: true, kelasId: true, files: { where: { deletedAt: null }, select: { id: true } } },
  });
  if (!existing) throw new NotFoundError("RPP tidak ditemukan");
  await assertGuruClass(actor, existing.kelasId);
  if (parsed.data.status === "PUBLISHED" && existing.mode === "FILE" && existing.files.length === 0) {
    throw new ValidationError("RPP upload belum memiliki file");
  }

  const item = await prisma.rpp.update({ where: { id: rppId }, data: { status: parsed.data.status }, select: { id: true, title: true, status: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: `RPP_${parsed.data.status}`, entityType: "Rpp", entityId: rppId } });

  if (parsed.data.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
    const students = await prisma.kelasSiswa.findMany({ where: { kelasId: existing.kelasId, status: "ACTIVE" }, select: { siswaId: true } });
    await notifyWaliForStudents({
      siswaIds: students.map((student) => student.siswaId),
      template: "rpp-published",
      subject: `RPP tersedia: ${existing.title}`,
      body: `Guru telah membagikan RPP ${existing.title}. Buka menu RPP untuk melihat rancangan pembelajaran kelas anak.`,
      metadata: { rppId },
    });
  }

  return { item };
}

async function getAllowedStudentIds(actor: Actor) {
  if (actor.role !== "WALI") throw new ForbiddenError();
  const selectedStudentId = await getSelectedWaliStudentId(actor);
  const relations = await prisma.waliSiswa.findMany({
    where: { endedAt: null, ...(selectedStudentId ? { siswaId: selectedStudentId } : {}), siswa: { status: "ACTIVE", deletedAt: null }, waliProfile: { userId: actor.id } },
    select: { siswaId: true },
  });
  return relations.map((relation) => relation.siswaId);
}

export async function listWaliRpp(actor: Actor) {
  const studentIds = await getAllowedStudentIds(actor);
  if (studentIds.length === 0) return { items: [] };

  const items = await prisma.rpp.findMany({
    where: {
      status: "PUBLISHED",
      kelas: { status: "ACTIVE", enrollments: { some: { status: "ACTIVE", siswaId: { in: studentIds }, siswa: { status: "ACTIVE", deletedAt: null } } } },
    },
    orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      mode: true,
      status: true,
      title: true,
      planDate: true,
      meetingNumber: true,
      topic: true,
      learningObjectives: true,
      materials: true,
      difficulty: true,
      activities: true,
      assessment: true,
      durationMinutes: true,
      notes: true,
      kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
      files: { where: { deletedAt: null }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
    },
  });

  return { items: items.map((item) => ({ ...item, files: item.files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })) })) };
}

export async function getWaliRppFile(actor: Actor, rppId: string, fileId: string) {
  const studentIds = await getAllowedStudentIds(actor);
  const file = await prisma.fileAsset.findFirst({
    where: {
      id: fileId,
      rppId,
      ownerType: "RPP",
      deletedAt: null,
      rpp: { status: "PUBLISHED", kelas: { status: "ACTIVE", enrollments: { some: { status: "ACTIVE", siswaId: { in: studentIds }, siswa: { status: "ACTIVE", deletedAt: null } } } } },
    },
    select: { originalName: true, mimeType: true, storagePath: true },
  });
  if (!file) throw new NotFoundError("File RPP tidak ditemukan");
  return { ...file, bytes: await readPrivateFile(file.storagePath) };
}
