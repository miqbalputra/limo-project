import "server-only";

import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { canManageClass } from "@/server/policies/access-policy";
import { getJakartaDayRange } from "@/server/time/jakarta";
import { calendarRangeSchema, createCalendarEventSchema, parseInputDate, updateCalendarEventSchema } from "@/server/validation/calendar";

const calendarTypes = ["CLASS_SESSION", "MODULE_RELEASE", "ASSIGNMENT_DUE", "QUIZ_DUE", "EXAM", "REMEDIAL_DUE", "HOLIDAY", "ANNOUNCEMENT"] as const;
type CalendarType = (typeof calendarTypes)[number];

export type CalendarEventDto = {
  id: string;
  eventType: CalendarType;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  visibility: string;
  classId: string | null;
  className: string | null;
  sourceType: string;
  sourceId: string;
  status: string | null;
  href: string;
};

type Scope = {
  classIds: string[];
  studentIds: string[];
  enrollmentWindows: Map<string, Array<{ startDate: Date; endDate: Date | null }>>;
};

function requireCalendarFeature() {
  requireFeature("calendarEnabled", "Kalender dan To-do belum diaktifkan");
}

export function getDefaultCalendarRange() {
  const range = getJakartaDayRange(-7, 28);
  return { from: range.start, to: range.end };
}

export function resolveCalendarRange(input: unknown) {
  const parsed = calendarRangeSchema.safeParse(input ?? {});
  if (!parsed.success) throw new ValidationError("Rentang kalender belum valid", parsed.error.flatten().fieldErrors);

  const defaults = getDefaultCalendarRange();
  const from = parsed.data.from ? parseInputDate(parsed.data.from) : defaults.from;
  const to = parsed.data.to ? parseInputDate(parsed.data.to) : defaults.to;
  if (!from || !to) throw new ValidationError("Tanggal kalender belum valid");
  if (to <= from) throw new ValidationError("Tanggal akhir kalender harus setelah tanggal mulai");
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) throw new ValidationError("Rentang kalender maksimal 366 hari");
  return { from, to };
}

async function getScope(actor: Actor): Promise<Scope> {
  if (actor.role === "ADMIN") {
    const classes = await prisma.kelas.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    return { classIds: classes.map((item) => item.id), studentIds: [], enrollmentWindows: new Map() };
  }

  if (actor.role === "GURU") {
    const classes = await prisma.kelas.findMany({ where: { status: "ACTIVE", guruProfile: { userId: actor.id } }, select: { id: true } });
    return { classIds: classes.map((item) => item.id), studentIds: [], enrollmentWindows: new Map() };
  }

  let studentIds: string[];
  if (actor.role === "SISWA") {
    const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } } });
    if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun siswa belum aktif");
    studentIds = [account.siswaId];
  } else if (actor.role === "WALI") {
    const relations = await prisma.waliSiswa.findMany({ where: { waliProfile: { userId: actor.id }, endedAt: null, siswa: { status: "ACTIVE", deletedAt: null } }, select: { siswaId: true } });
    studentIds = relations.map((item) => item.siswaId);
  } else {
    throw new ForbiddenError("Role belum didukung kalender");
  }

  const enrollments = await prisma.kelasSiswa.findMany({ where: { siswaId: { in: studentIds }, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { kelasId: true, siswaId: true, startDate: true, endDate: true } });
  const enrollmentWindows = new Map<string, Array<{ startDate: Date; endDate: Date | null }>>();
  for (const enrollment of enrollments) {
    const key = `${enrollment.siswaId}:${enrollment.kelasId}`;
    enrollmentWindows.set(key, [...(enrollmentWindows.get(key) || []), { startDate: enrollment.startDate, endDate: enrollment.endDate }]);
  }
  return { classIds: [...new Set(enrollments.map((item) => item.kelasId))], studentIds, enrollmentWindows };
}

function isWithinEnrollment(scope: Scope, classId: string, startAt: Date) {
  if (scope.studentIds.length === 0) return true;
  return scope.studentIds.some((studentId) => (scope.enrollmentWindows.get(`${studentId}:${classId}`) || []).some((window) => window.startDate <= startAt && (!window.endDate || window.endDate >= startAt)));
}

function visibilityForRole(actor: Actor): Array<"ALL" | "GURU" | "SISWA" | "WALI"> {
  if (actor.role === "ADMIN") return ["ALL", "GURU", "SISWA", "WALI"];
  return ["ALL", actor.role];
}

function eventHref(actor: Actor, eventType: CalendarType, sourceId: string, classId: string | null) {
  if (eventType === "HOLIDAY" || eventType === "ANNOUNCEMENT") return actor.role === "GURU" ? "/guru/kalender" : actor.role === "SISWA" ? "/siswa/kalender" : actor.role === "WALI" ? "/wali/kalender" : "/admin/kalender";
  if (actor.role === "GURU") {
    if (eventType === "CLASS_SESSION") return `/guru/presensi/${sourceId}`;
    if (eventType === "ASSIGNMENT_DUE") return `/guru/tugas/${sourceId}/submissions`;
    if (eventType === "EXAM") return `/guru/ujian/${sourceId}/hasil`;
    return classId ? `/guru/kelas/${classId}/modul` : "/guru/kalender";
  }
  if (actor.role === "SISWA") {
    if (eventType === "ASSIGNMENT_DUE") return `/siswa/tugas/${sourceId}`;
    return classId ? `/siswa/kelas/${classId}` : "/siswa/kalender";
  }
  if (actor.role === "WALI") return "/wali/progres";
  return "/admin/kalender";
}

function addEvent(events: CalendarEventDto[], actor: Actor, input: Omit<CalendarEventDto, "href">) {
  events.push({ ...input, href: eventHref(actor, input.eventType, input.sourceId, input.classId) });
}

export async function listCalendarEvents(actor: Actor, input: unknown = {}) {
  requireCalendarFeature();
  const { from, to } = resolveCalendarRange(input);
  const scope = await getScope(actor);
  const includeDrafts = actor.role === "GURU" || actor.role === "ADMIN";
  const classWhere = { in: scope.classIds };
  const [classes, sessions, modules, assignments, exams, manualEvents] = await Promise.all([
    prisma.kelas.findMany({ where: { id: classWhere }, select: { id: true, name: true } }),
    prisma.sesiKelas.findMany({ where: { kelasId: classWhere, sessionDate: { gte: from, lt: to }, status: { not: "CANCELLED" } }, orderBy: { sessionDate: "asc" }, select: { id: true, kelasId: true, meetingNumber: true, topic: true, sessionDate: true, status: true, kelas: { select: { name: true } } } }),
    prisma.learningModule.findMany({ where: { kelasId: classWhere, status: includeDrafts ? { not: "ARCHIVED" } : { in: ["SCHEDULED", "PUBLISHED"] } }, orderBy: { releaseAt: "asc" }, select: { id: true, kelasId: true, title: true, description: true, status: true, releaseAt: true, dueAt: true, publishedAt: true, kelas: { select: { name: true } } } }),
    prisma.assignment.findMany({ where: { kelasId: classWhere, status: includeDrafts ? { not: "ARCHIVED" } : "PUBLISHED", dueAt: { gte: from, lt: to } }, orderBy: { dueAt: "asc" }, select: { id: true, kelasId: true, title: true, instructions: true, status: true, dueAt: true, cutoffAt: true, kelas: { select: { name: true } } } }),
    prisma.ujian.findMany({ where: { kelasId: classWhere, status: includeDrafts ? { not: "ARCHIVED" } : "PUBLISHED" }, orderBy: { examDate: "asc" }, select: { id: true, kelasId: true, title: true, description: true, status: true, examDate: true, availableFrom: true, availableUntil: true, durationMinutes: true, kelas: { select: { name: true } } } }),
    prisma.calendarEvent.findMany({ where: { startAt: { lt: to }, OR: [{ endAt: null }, { endAt: { gte: from } }], visibility: { in: visibilityForRole(actor) }, AND: [{ OR: [{ classId: null }, { classId: classWhere }] }] }, orderBy: { startAt: "asc" }, select: { id: true, classId: true, title: true, description: true, eventType: true, startAt: true, endAt: true, allDay: true, visibility: true, kelas: { select: { name: true } } } }),
  ]);

  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const events: CalendarEventDto[] = [];
  for (const item of sessions) {
    if (!isWithinEnrollment(scope, item.kelasId, item.sessionDate)) continue;
    addEvent(events, actor, { id: `SesiKelas:${item.id}`, eventType: "CLASS_SESSION", title: `Pertemuan ${item.meetingNumber}: ${item.topic}`, description: item.status === "DRAFT" ? "Sesi masih berstatus draft." : null, startAt: item.sessionDate, endAt: new Date(item.sessionDate.getTime() + 60 * 60 * 1000), allDay: false, visibility: "ALL", classId: item.kelasId, className: item.kelas.name, sourceType: "SesiKelas", sourceId: item.id, status: item.status });
  }
  for (const item of modules) {
    const startAt = item.releaseAt || item.publishedAt;
    if (!startAt || startAt < from || startAt >= to || !isWithinEnrollment(scope, item.kelasId, startAt)) continue;
    addEvent(events, actor, { id: `LearningModule:${item.id}`, eventType: "MODULE_RELEASE", title: `Modul: ${item.title}`, description: item.dueAt ? `Tenggat modul ${item.dueAt.toISOString()}` : item.description, startAt, endAt: new Date(startAt.getTime() + 30 * 60 * 1000), allDay: false, visibility: "ALL", classId: item.kelasId, className: item.kelas.name, sourceType: "LearningModule", sourceId: item.id, status: item.status });
  }
  for (const item of assignments) {
    if (!item.dueAt || !isWithinEnrollment(scope, item.kelasId, item.dueAt)) continue;
    addEvent(events, actor, { id: `Assignment:${item.id}`, eventType: "ASSIGNMENT_DUE", title: `Tenggat: ${item.title}`, description: item.cutoffAt ? `Cutoff ${item.cutoffAt.toISOString()}` : item.instructions.slice(0, 240), startAt: item.dueAt, endAt: new Date(item.dueAt.getTime() + 30 * 60 * 1000), allDay: false, visibility: "ALL", classId: item.kelasId, className: item.kelas.name, sourceType: "Assignment", sourceId: item.id, status: item.status });
  }
  for (const item of exams) {
    const startAt = item.examDate || item.availableUntil || item.availableFrom;
    if (!startAt || startAt < from || startAt >= to || !isWithinEnrollment(scope, item.kelasId, startAt)) continue;
    addEvent(events, actor, { id: `Ujian:${item.id}`, eventType: "EXAM", title: `Ujian: ${item.title}`, description: item.description, startAt, endAt: new Date(startAt.getTime() + Math.max(item.durationMinutes, 1) * 60 * 1000), allDay: false, visibility: "ALL", classId: item.kelasId, className: item.kelas.name, sourceType: "Ujian", sourceId: item.id, status: item.status });
  }
  for (const item of manualEvents) {
    if (item.classId && (!scope.classIds.includes(item.classId) || !isWithinEnrollment(scope, item.classId, item.startAt))) continue;
    addEvent(events, actor, { id: `CalendarEvent:${item.id}`, eventType: item.eventType, title: item.title, description: item.description, startAt: item.startAt, endAt: item.endAt, allDay: item.allDay, visibility: item.visibility, classId: item.classId, className: item.classId ? classNames.get(item.classId) || item.kelas?.name || null : null, sourceType: "CalendarEvent", sourceId: item.id, status: null });
  }

  events.sort((left, right) => left.startAt.getTime() - right.startAt.getTime() || left.title.localeCompare(right.title));
  return { from, to, events };
}

export async function listCalendarEventClasses(actor: Actor) {
  requireCalendarFeature();
  if (actor.role !== "GURU" && actor.role !== "ADMIN") throw new ForbiddenError("Hanya Guru atau Admin dapat mengelola event kalender");
  return { items: await prisma.kelas.findMany({ where: actor.role === "ADMIN" ? { status: "ACTIVE" } : { status: "ACTIVE", guruProfile: { userId: actor.id } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) };
}

async function assertCalendarEventManager(actor: Actor, classId: string | null) {
  requireCalendarFeature();
  if (actor.role === "ADMIN") return;
  if (actor.role !== "GURU") throw new ForbiddenError("Hanya Guru atau Admin dapat mengelola event kalender");
  if (!classId || !(await canManageClass(actor, classId))) throw new ForbiddenError("Anda tidak memiliki akses mengelola event kelas ini");
}

export async function createCalendarEvent(actor: Actor, input: unknown) {
  const parsed = createCalendarEventSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data event kalender belum valid", parsed.error.flatten().fieldErrors);
  const classId = parsed.data.classId || null;
  await assertCalendarEventManager(actor, classId);
  if (classId) {
    const kelas = await prisma.kelas.findFirst({ where: { id: classId, status: "ACTIVE" }, select: { id: true } });
    if (!kelas) throw new NotFoundError("Kelas kalender tidak ditemukan");
  }
  const startAt = parseInputDate(parsed.data.startAt);
  const endAt = parsed.data.endAt ? parseInputDate(parsed.data.endAt) : null;
  if (!startAt || (parsed.data.endAt && !endAt)) throw new ValidationError("Waktu event kalender belum valid");
  const item = await prisma.$transaction(async (tx) => {
    const event = await tx.calendarEvent.create({ data: { classId, title: parsed.data.title, description: parsed.data.description || null, eventType: parsed.data.eventType, startAt, endAt, allDay: parsed.data.allDay, visibility: parsed.data.visibility, createdById: actor.id }, select: { id: true, title: true, eventType: true, startAt: true, classId: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "CALENDAR_EVENT_CREATED", entityType: "CalendarEvent", entityId: event.id, metadata: { classId, eventType: event.eventType } } });
    return event;
  });
  return { item };
}

export async function deleteCalendarEvent(actor: Actor, eventId: string) {
  requireCalendarFeature();
  const existing = await prisma.calendarEvent.findUnique({ where: { id: eventId }, select: { id: true, classId: true, createdById: true } });
  if (!existing) throw new NotFoundError("Event kalender tidak ditemukan");
  if (actor.role !== "ADMIN" && (existing.createdById !== actor.id || !existing.classId || !(await canManageClass(actor, existing.classId)))) throw new ForbiddenError("Anda tidak memiliki akses menghapus event kalender ini");
  await prisma.$transaction([
    prisma.calendarEvent.delete({ where: { id: eventId } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "CALENDAR_EVENT_DELETED", entityType: "CalendarEvent", entityId: eventId, metadata: { classId: existing.classId } } }),
  ]);
  return { success: true };
}

export async function updateCalendarEvent(actor: Actor, eventId: string, input: unknown) {
  const parsed = updateCalendarEventSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data event kalender belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.calendarEvent.findUnique({ where: { id: eventId }, select: { id: true, classId: true, createdById: true, startAt: true, endAt: true } });
  if (!existing) throw new NotFoundError("Event kalender tidak ditemukan");
  if (actor.role !== "ADMIN" && (existing.createdById !== actor.id || !existing.classId || !(await canManageClass(actor, existing.classId)))) throw new ForbiddenError("Anda tidak memiliki akses mengubah event kalender ini");
  const nextClassId = parsed.data.classId !== undefined ? parsed.data.classId || null : existing.classId;
  await assertCalendarEventManager(actor, nextClassId);
  if (nextClassId) {
    const kelas = await prisma.kelas.findFirst({ where: { id: nextClassId, status: "ACTIVE" }, select: { id: true } });
    if (!kelas) throw new NotFoundError("Kelas kalender tidak ditemukan");
  }
  const startAt = parsed.data.startAt ? parseInputDate(parsed.data.startAt) : existing.startAt;
  const endAt = parsed.data.endAt === "" ? null : parsed.data.endAt ? parseInputDate(parsed.data.endAt) : existing.endAt;
  if (!startAt || (parsed.data.endAt && !endAt) || (endAt && endAt < startAt)) throw new ValidationError("Rentang waktu event kalender belum valid");
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.calendarEvent.update({ where: { id: eventId }, data: { ...(parsed.data.classId !== undefined ? { classId: nextClassId } : {}), ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}), ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}), ...(parsed.data.eventType !== undefined ? { eventType: parsed.data.eventType } : {}), startAt, endAt, ...(parsed.data.allDay !== undefined ? { allDay: parsed.data.allDay } : {}), ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}) }, select: { id: true, title: true, eventType: true, startAt: true, classId: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "CALENDAR_EVENT_UPDATED", entityType: "CalendarEvent", entityId: eventId, metadata: { classId: nextClassId } } });
    return updated;
  });
  return { item };
}
