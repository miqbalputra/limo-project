import "server-only";
import type { Actor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import type { SchoolSetting } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { createAcademicYearSchema, updateAcademicYearSchema, updateSchoolSettingSchema } from "@/server/validation/settings";

const DEFAULT_SCHOOL_SETTING: SchoolSetting = {
  id: "default",
  name: "LIMO - Little Moslems Academy",
  tagline: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  logoFileId: null,
  updatedById: null,
  updatedAt: new Date(0),
};


function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function getSchoolSetting() {
  const setting = await prisma.schoolSetting.findUnique({ where: { id: "default" } });
  return setting ?? DEFAULT_SCHOOL_SETTING;
}

export async function updateSchoolSetting(actor: Actor, input: unknown) {
  await requirePermission(actor, "admin.settings.manage");
  const parsed = updateSchoolSettingSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data sekolah belum valid", parsed.error.flatten().fieldErrors);

  const data = {
    name: parsed.data.name,
    tagline: parsed.data.tagline || null,
    address: parsed.data.address || null,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    website: parsed.data.website || null,
    updatedById: actor.id,
  };

  const item = await prisma.schoolSetting.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  await prisma.auditLog.create({ data: { actorId: actor.id, action: "SCHOOL_SETTING_UPDATED", entityType: "SchoolSetting", entityId: "default" } });
  return { item };
}

export async function listAcademicYears(actor: Actor) {
  await requirePermission(actor, "admin.settings.manage");
  const items = await prisma.academicYear.findMany({ orderBy: [{ startDate: "desc" }, { label: "desc" }] });
  return { items };
}

export async function getActiveAcademicYear() {
  return prisma.academicYear.findFirst({ where: { isActive: true } });
}

export async function createAcademicYear(actor: Actor, input: unknown) {
  await requirePermission(actor, "admin.settings.manage");
  const parsed = createAcademicYearSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data tahun ajaran belum valid", parsed.error.flatten().fieldErrors);

  const startDate = parseDate(parsed.data.startDate);
  const endDate = parseDate(parsed.data.endDate);
  if (endDate <= startDate) throw new ValidationError("Tanggal selesai harus setelah tanggal mulai");

  const existing = await prisma.academicYear.findUnique({ where: { label: parsed.data.label }, select: { id: true } });
  if (existing) throw new ConflictError("Label tahun ajaran sudah dipakai");

  const item = await prisma.academicYear.create({
    data: { label: parsed.data.label, semester: parsed.data.semester, startDate, endDate },
  });

  await prisma.auditLog.create({ data: { actorId: actor.id, action: "ACADEMIC_YEAR_CREATED", entityType: "AcademicYear", entityId: item.id } });
  return { item };
}

export async function updateAcademicYear(actor: Actor, id: string, input: unknown) {
  await requirePermission(actor, "admin.settings.manage");
  const parsed = updateAcademicYearSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data tahun ajaran belum valid", parsed.error.flatten().fieldErrors);

  const existing = await prisma.academicYear.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Tahun ajaran tidak ditemukan");

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.academicYear.update({
      where: { id },
      data: {
        ...(parsed.data.label ? { label: parsed.data.label } : {}),
        ...(parsed.data.semester ? { semester: parsed.data.semester } : {}),
        ...(parsed.data.startDate ? { startDate: parseDate(parsed.data.startDate) } : {}),
        ...(parsed.data.endDate ? { endDate: parseDate(parsed.data.endDate) } : {}),
      },
    });
    if (updated.endDate <= updated.startDate) throw new ValidationError("Tanggal selesai harus setelah tanggal mulai");
    return updated;
  });

  await prisma.auditLog.create({ data: { actorId: actor.id, action: "ACADEMIC_YEAR_UPDATED", entityType: "AcademicYear", entityId: id } });
  return { item };
}

export async function setActiveAcademicYear(actor: Actor, id: string) {
  await requirePermission(actor, "admin.settings.manage");
  const existing = await prisma.academicYear.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Tahun ajaran tidak ditemukan");

  const item = await prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.academicYear.update({ where: { id }, data: { isActive: true } });
  });

  await prisma.auditLog.create({ data: { actorId: actor.id, action: "ACADEMIC_YEAR_ACTIVATED", entityType: "AcademicYear", entityId: id } });
  return { item };
}
