import { createHash } from "node:crypto";
import { prisma } from "../db/prisma.ts";
import { formatJakartaDate, getJakartaDateParts } from "../time/jakarta.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderWindow = "H3" | "H1" | "DUE" | "OVERDUE";

function isCalendarEnabled() {
  const configured = process.env.CALENDAR_ENABLED?.trim().toLowerCase();
  if (configured) return ["1", "true", "yes", "on"].includes(configured);
  return process.env.NODE_ENV !== "production";
}

type ReminderCandidate = {
  recipient: string;
  recipientRole: "SISWA" | "WALI";
  sourceType: "Assignment" | "Ujian";
  sourceId: string;
  title: string;
  className: string;
  childName: string | null;
  dueAt: Date;
  href: string;
  siswaId: string;
};

function localDayOrdinal(value: Date) {
  const parts = getJakartaDateParts(value);
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

export function getReminderWindow(dueAt: Date, now: Date): ReminderWindow | null {
  const daysUntil = localDayOrdinal(dueAt) - localDayOrdinal(now);
  if (daysUntil === 3) return "H3";
  if (daysUntil === 1) return "H1";
  if (daysUntil === 0 && dueAt <= now) return "DUE";
  if (daysUntil < 0 || dueAt < now) return "OVERDUE";
  return null;
}

function isActiveAt(startDate: Date, endDate: Date | null, value: Date) {
  return startDate <= value && (!endDate || endDate >= value);
}

async function loadCandidates(now: Date) {
  const enrollments = await prisma.kelasSiswa.findMany({ where: { status: "ACTIVE", kelas: { status: "ACTIVE" }, siswa: { status: "ACTIVE", deletedAt: null } }, select: { siswaId: true, kelasId: true, startDate: true, endDate: true, siswa: { select: { name: true, siswaAccount: { select: { user: { select: { email: true } } } } } }, kelas: { select: { name: true } } } });
  const enrollmentByClass = new Map<string, typeof enrollments>();
  for (const enrollment of enrollments) enrollmentByClass.set(enrollment.kelasId, [...(enrollmentByClass.get(enrollment.kelasId) || []), enrollment]);
  const studentIds = enrollments.map((item) => item.siswaId);
  const classIds = [...new Set(enrollments.map((item) => item.kelasId))];
  const [assignments, exams] = await Promise.all([
    prisma.assignment.findMany({ where: { kelasId: { in: classIds }, status: "PUBLISHED", dueAt: { not: null } }, select: { id: true, kelasId: true, title: true, dueAt: true, kelas: { select: { name: true } } } }),
    prisma.ujian.findMany({ where: { kelasId: { in: classIds }, status: "PUBLISHED", OR: [{ examDate: { not: null } }, { availableUntil: { not: null } }] }, select: { id: true, kelasId: true, title: true, examDate: true, availableUntil: true, kelas: { select: { name: true } } } }),
  ]);
  const assignmentIds = assignments.map((item) => item.id);
  const examIds = exams.map((item) => item.id);
  const [submissions, results, waliRelations] = await Promise.all([
    prisma.assignmentSubmission.findMany({ where: { assignmentId: { in: assignmentIds }, studentId: { in: studentIds } }, orderBy: [{ assignmentId: "asc" }, { studentId: "asc" }, { attemptNumber: "desc" }], select: { assignmentId: true, studentId: true, status: true } }),
    prisma.hasilUjian.findMany({ where: { ujianId: { in: examIds }, siswaId: { in: studentIds }, status: { in: ["FINAL", "CORRECTED"] } }, select: { ujianId: true, siswaId: true } }),
    prisma.waliSiswa.findMany({ where: { siswaId: { in: studentIds }, endedAt: null }, select: { siswaId: true, waliProfile: { select: { user: { select: { email: true } } } } } }),
  ]);
  const latestSubmissions = new Map<string, string>();
  for (const submission of submissions) {
    const key = `${submission.assignmentId}:${submission.studentId}`;
    if (!latestSubmissions.has(key)) latestSubmissions.set(key, submission.status);
  }
  const completedExams = new Set(results.map((item) => `${item.ujianId}:${item.siswaId}`));
  const relationsByStudent = new Map<string, string[]>();
  for (const relation of waliRelations) relationsByStudent.set(relation.siswaId, [...(relationsByStudent.get(relation.siswaId) || []), relation.waliProfile.user.email]);
  const candidates: ReminderCandidate[] = [];
  for (const assignment of assignments) {
    if (!assignment.dueAt) continue;
    for (const enrollment of enrollmentByClass.get(assignment.kelasId) || []) {
      if (!isActiveAt(enrollment.startDate, enrollment.endDate, assignment.dueAt)) continue;
      const submissionStatus = latestSubmissions.get(`${assignment.id}:${enrollment.siswaId}`);
      if (submissionStatus && ["SUBMITTED", "LATE", "GRADED"].includes(submissionStatus)) continue;
      const accountEmail = enrollment.siswa.siswaAccount?.user.email;
      if (!accountEmail) continue;
      candidates.push({ recipient: accountEmail, recipientRole: "SISWA", sourceType: "Assignment", sourceId: assignment.id, title: assignment.title, className: assignment.kelas.name, childName: null, dueAt: assignment.dueAt, href: `/siswa/tugas/${assignment.id}`, siswaId: enrollment.siswaId });
      for (const email of relationsByStudent.get(enrollment.siswaId) || []) candidates.push({ recipient: email, recipientRole: "WALI", sourceType: "Assignment", sourceId: assignment.id, title: assignment.title, className: assignment.kelas.name, childName: enrollment.siswa.name, dueAt: assignment.dueAt, href: `/wali/tugas/${enrollment.siswaId}`, siswaId: enrollment.siswaId });
    }
  }
  for (const exam of exams) {
    const dueAt = exam.examDate || exam.availableUntil;
    if (!dueAt) continue;
    for (const enrollment of enrollmentByClass.get(exam.kelasId) || []) {
      if (!isActiveAt(enrollment.startDate, enrollment.endDate, dueAt) || completedExams.has(`${exam.id}:${enrollment.siswaId}`)) continue;
      const accountEmail = enrollment.siswa.siswaAccount?.user.email;
      if (!accountEmail) continue;
      candidates.push({ recipient: accountEmail, recipientRole: "SISWA", sourceType: "Ujian", sourceId: exam.id, title: exam.title, className: exam.kelas.name, childName: null, dueAt, href: `/siswa/kelas/${exam.kelasId}`, siswaId: enrollment.siswaId });
      for (const email of relationsByStudent.get(enrollment.siswaId) || []) candidates.push({ recipient: email, recipientRole: "WALI", sourceType: "Ujian", sourceId: exam.id, title: exam.title, className: exam.kelas.name, childName: enrollment.siswa.name, dueAt, href: `/wali/tugas/${enrollment.siswaId}`, siswaId: enrollment.siswaId });
    }
  }
  return candidates.map((candidate) => ({ ...candidate, window: getReminderWindow(candidate.dueAt, now) })).filter((candidate): candidate is ReminderCandidate & { window: ReminderWindow } => candidate.window !== null);
}

async function createReminderNotification(input: { recipient: string; role: string; window: ReminderWindow; dateKey: string; sourceKey: string; subject: string; body: string; metadata: Record<string, string | null> }) {
  const rawKey = `deadline-reminder|${input.role}|${input.recipient}|${input.dateKey}|${input.window}|${input.sourceKey}`;
  try {
    await prisma.notifikasi.create({ data: { channel: "in_app", template: "deadline-reminder", recipient: input.recipient, subject: input.subject, body: input.body, dedupeKey: createHash("sha256").update(rawKey).digest("hex"), metadata: input.metadata } });
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return false;
    throw error;
  }
}

export async function sendDeadlineReminders(input: { now?: Date; dryRun?: boolean } = {}) {
  const now = input.now ?? new Date();
  if (!isCalendarEnabled()) return { candidates: 0, created: 0, skipped: 0, dryRun: Boolean(input.dryRun), disabled: true };
  const candidates = await loadCandidates(now);
  if (input.dryRun) return { candidates: candidates.length, created: 0, skipped: 0, dryRun: true };
  const dateKey = formatJakartaDate(now);
  let created = 0;
  let skipped = 0;
  const studentCandidates = candidates.filter((candidate) => candidate.recipientRole === "SISWA");
  for (const candidate of studentCandidates) {
    const windowLabel = candidate.window === "H3" ? "H-3" : candidate.window === "H1" ? "H-1" : candidate.window === "DUE" ? "Hari ini" : "Terlambat";
    const didCreate = await createReminderNotification({ recipient: candidate.recipient, role: candidate.recipientRole, window: candidate.window, dateKey, sourceKey: `${candidate.sourceType}:${candidate.sourceId}`, subject: `${windowLabel}: ${candidate.title}`, body: `${candidate.title} di ${candidate.className} ${candidate.dueAt < now ? "sudah melewati tenggat" : `memiliki tenggat ${candidate.dueAt.toISOString()}`}. Buka LIMO untuk menindaklanjuti.`, metadata: { sourceType: candidate.sourceType, sourceId: candidate.sourceId, siswaId: candidate.siswaId, href: candidate.href } });
    if (didCreate) created += 1; else skipped += 1;
  }
  const waliGroups = new Map<string, (typeof candidates)[number][]>();
  for (const candidate of candidates.filter((item) => item.recipientRole === "WALI")) {
    const key = `${candidate.recipient}:${candidate.window}`;
    waliGroups.set(key, [...(waliGroups.get(key) || []), candidate]);
  }
  for (const [key, group] of waliGroups) {
    const [recipient, window] = key.split(":") as [string, ReminderWindow];
    const windowLabel = window === "H3" ? "H-3" : window === "H1" ? "H-1" : window === "DUE" ? "Hari ini" : "Terlambat";
    const lines = group.slice(0, 8).map((candidate) => `- ${candidate.childName}: ${candidate.title} (${candidate.className})`).join("\n");
    const didCreate = await createReminderNotification({ recipient, role: "WALI", window, dateKey, sourceKey: "grouped", subject: `${windowLabel}: aktivitas anak`, body: `Ada aktivitas anak yang perlu diperhatikan:\n${lines}`, metadata: { sourceType: "GROUPED", sourceId: group.map((candidate) => `${candidate.sourceType}:${candidate.sourceId}`).join(",").slice(0, 1000), siswaId: [...new Set(group.map((candidate) => candidate.siswaId))].join(","), href: "/wali/todo" } });
    if (didCreate) created += 1; else skipped += 1;
  }
  await prisma.jobRun.create({ data: { name: "send-deadline-reminders", status: "SUCCESS", finishedAt: new Date(), successCount: created, skippedCount: skipped, metadata: { dryRun: false, now: now.toISOString(), candidates: candidates.length } } });
  return { candidates: candidates.length, created, skipped, dryRun: false };
}
