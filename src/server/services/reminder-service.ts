import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.ts";
import { getEnv } from "../env.ts";
import { formatRupiah } from "../../lib/money.ts";
import { dispatchNotificationIds } from "./notification-job-service.ts";
import { formatJakartaDate, getJakartaDateParts } from "../time/jakarta.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderWindow = "H3" | "H1" | "DUE" | "OVERDUE";

function isCalendarEnabled() {
  const configured = process.env.CALENDAR_ENABLED?.trim().toLowerCase();
  if (configured) return ["1", "true", "yes", "on"].includes(configured);
  return process.env.NODE_ENV !== "production";
}

function isRemedialEnabled() {
  const configured = process.env.REMEDIAL_ENABLED?.trim().toLowerCase();
  if (configured) return ["1", "true", "yes", "on"].includes(configured);
  return process.env.NODE_ENV !== "production";
}

function activeChannels(): Array<"email" | "whatsapp"> {
  const provider = getEnv().NOTIFICATION_PROVIDER;
  return (["whatsapp", "email"] as const).filter((channel) => provider !== "email" || channel === "email");
}

function windowLabel(window: ReminderWindow) {
  return window === "H3" ? "H-3" : window === "H1" ? "H-1" : window === "DUE" ? "Hari ini" : "Terlambat";
}

type ReminderCandidate = {
  recipient: string;
  phone: string | null;
  recipientRole: "SISWA" | "WALI";
  sourceType: "Assignment" | "Ujian" | "RemedialAssignment";
  sourceId: string;
  title: string;
  className: string;
  childName: string | null;
  dueAt: Date;
  href: string;
  siswaId: string;
};

type ReminderCandidateWindowed = ReminderCandidate & { window: ReminderWindow };
type WaliContact = { email: string; phone: string | null };

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

export function getInvoiceReminderWindow(dueDate: Date, now: Date): ReminderWindow | null {
  const daysUntil = localDayOrdinal(dueDate) - localDayOrdinal(now);
  if (daysUntil === 3) return "H3";
  if (daysUntil === 1) return "H1";
  if (daysUntil === 0) return "DUE";
  if (daysUntil < 0) return "OVERDUE";
  return null;
}

function isActiveAt(startDate: Date, endDate: Date | null, value: Date) {
  return startDate <= value && (!endDate || endDate >= value);
}

/**
 * Simpan notifikasi dengan dedupeKey, kembalikan id bila baru dibuat.
 * Pengiriman dilakukan di akhir job lewat dispatchNotificationIds.
 */
async function enqueueNotification(input: {
  channel: "email" | "whatsapp" | "in_app";
  template: string;
  recipient: string;
  subject: string;
  body: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
}) {
  const existing = await prisma.notifikasi.findUnique({ where: { dedupeKey: input.dedupeKey }, select: { id: true } });
  if (existing) return null;

  try {
    const created = await prisma.notifikasi.create({
      data: {
        channel: input.channel,
        template: input.template,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return null;
    throw error;
  }
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
  const remedials = isRemedialEnabled() ? await prisma.remedialParticipant.findMany({ where: { studentId: { in: studentIds }, status: { notIn: ["CANCELLED", "COMPLETED", "EXPIRED", "SUBMITTED"] }, remedial: { status: "PUBLISHED" } }, select: { id: true, studentId: true, remedial: { select: { id: true, sourceId: true, title: true, dueAt: true, kelasId: true, kelas: { select: { name: true } } } } } }) : [];
  const assignmentIds = assignments.map((item) => item.id);
  const examIds = exams.map((item) => item.id);
  const [submissions, results, waliRelations] = await Promise.all([
    prisma.assignmentSubmission.findMany({ where: { assignmentId: { in: assignmentIds }, studentId: { in: studentIds }, remedialParticipantId: null, revisionRequestId: null }, orderBy: [{ assignmentId: "asc" }, { studentId: "asc" }, { attemptNumber: "desc" }], select: { assignmentId: true, studentId: true, status: true } }),
    prisma.hasilUjian.findMany({ where: { ujianId: { in: examIds }, siswaId: { in: studentIds }, status: { in: ["FINAL", "CORRECTED"] } }, select: { ujianId: true, siswaId: true } }),
    prisma.waliSiswa.findMany({ where: { siswaId: { in: studentIds }, endedAt: null }, select: { siswaId: true, waliProfile: { select: { phone: true, user: { select: { email: true } } } } } }),
  ]);
  const latestSubmissions = new Map<string, string>();
  for (const submission of submissions) {
    const key = `${submission.assignmentId}:${submission.studentId}`;
    if (!latestSubmissions.has(key)) latestSubmissions.set(key, submission.status);
  }
  const completedExams = new Set(results.map((item) => `${item.ujianId}:${item.siswaId}`));
  const relationsByStudent = new Map<string, WaliContact[]>();
  for (const relation of waliRelations) {
    const contact: WaliContact = { email: relation.waliProfile.user.email, phone: relation.waliProfile.phone };
    relationsByStudent.set(relation.siswaId, [...(relationsByStudent.get(relation.siswaId) || []), contact]);
  }
  const candidates: ReminderCandidateWindowed[] = [];
  for (const assignment of assignments) {
    if (!assignment.dueAt) continue;
    for (const enrollment of enrollmentByClass.get(assignment.kelasId) || []) {
      if (!isActiveAt(enrollment.startDate, enrollment.endDate, assignment.dueAt)) continue;
      const submissionStatus = latestSubmissions.get(`${assignment.id}:${enrollment.siswaId}`);
      if (submissionStatus && ["SUBMITTED", "LATE", "GRADED"].includes(submissionStatus)) continue;
      const accountEmail = enrollment.siswa.siswaAccount?.user.email;
      if (!accountEmail) continue;
      candidates.push({ recipient: accountEmail, phone: null, recipientRole: "SISWA", sourceType: "Assignment", sourceId: assignment.id, title: assignment.title, className: assignment.kelas.name, childName: null, dueAt: assignment.dueAt, href: `/siswa/tugas/${assignment.id}`, siswaId: enrollment.siswaId, window: getReminderWindow(assignment.dueAt, now)! });
      for (const contact of relationsByStudent.get(enrollment.siswaId) || []) candidates.push({ recipient: contact.email, phone: contact.phone, recipientRole: "WALI", sourceType: "Assignment", sourceId: assignment.id, title: assignment.title, className: assignment.kelas.name, childName: enrollment.siswa.name, dueAt: assignment.dueAt, href: `/wali/tugas/${enrollment.siswaId}`, siswaId: enrollment.siswaId, window: getReminderWindow(assignment.dueAt, now)! });
    }
  }
  for (const exam of exams) {
    const dueAt = exam.examDate || exam.availableUntil;
    if (!dueAt) continue;
    for (const enrollment of enrollmentByClass.get(exam.kelasId) || []) {
      if (!isActiveAt(enrollment.startDate, enrollment.endDate, dueAt) || completedExams.has(`${exam.id}:${enrollment.siswaId}`)) continue;
      const accountEmail = enrollment.siswa.siswaAccount?.user.email;
      if (!accountEmail) continue;
      candidates.push({ recipient: accountEmail, phone: null, recipientRole: "SISWA", sourceType: "Ujian", sourceId: exam.id, title: exam.title, className: exam.kelas.name, childName: null, dueAt, href: `/siswa/kelas/${exam.kelasId}`, siswaId: enrollment.siswaId, window: getReminderWindow(dueAt, now)! });
      for (const contact of relationsByStudent.get(enrollment.siswaId) || []) candidates.push({ recipient: contact.email, phone: contact.phone, recipientRole: "WALI", sourceType: "Ujian", sourceId: exam.id, title: exam.title, className: exam.kelas.name, childName: enrollment.siswa.name, dueAt, href: `/wali/tugas/${enrollment.siswaId}`, siswaId: enrollment.siswaId, window: getReminderWindow(dueAt, now)! });
    }
  }
  for (const participant of remedials) {
    const dueAt = participant.remedial.dueAt;
    const enrollment = (enrollmentByClass.get(participant.remedial.kelasId) || []).find((item) => item.siswaId === participant.studentId);
    if (!enrollment || !isActiveAt(enrollment.startDate, enrollment.endDate, dueAt)) continue;
    const accountEmail = enrollment.siswa.siswaAccount?.user.email;
    if (!accountEmail) continue;
    candidates.push({ recipient: accountEmail, phone: null, recipientRole: "SISWA", sourceType: "RemedialAssignment", sourceId: participant.remedial.id, title: participant.remedial.title, className: participant.remedial.kelas.name, childName: null, dueAt, href: `/siswa/tugas/${participant.remedial.sourceId}?remedialId=${participant.id}`, siswaId: participant.studentId, window: getReminderWindow(dueAt, now)! });
    for (const contact of relationsByStudent.get(participant.studentId) || []) candidates.push({ recipient: contact.email, phone: contact.phone, recipientRole: "WALI", sourceType: "RemedialAssignment", sourceId: participant.remedial.id, title: participant.remedial.title, className: participant.remedial.kelas.name, childName: enrollment.siswa.name, dueAt, href: `/wali/progres/${participant.studentId}/remedial`, siswaId: participant.studentId, window: getReminderWindow(dueAt, now)! });
  }
  return candidates.filter((candidate) => candidate.window !== null);
}

export async function sendDeadlineReminders(input: { now?: Date; dryRun?: boolean } = {}) {
  const now = input.now ?? new Date();
  if (!isCalendarEnabled()) return { candidates: 0, created: 0, skipped: 0, dryRun: Boolean(input.dryRun), disabled: true };
  const candidates = await loadCandidates(now);
  if (input.dryRun) return { candidates: candidates.length, created: 0, skipped: 0, dryRun: true };
  const dateKey = formatJakartaDate(now);
  const queuedIds: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const candidate of candidates.filter((item) => item.recipientRole === "SISWA")) {
    const label = windowLabel(candidate.window);
    const dedupeKey = createHash("sha256").update(`deadline-reminder|SISWA|in_app|${candidate.recipient}|${dateKey}|${candidate.window}|${candidate.sourceType}:${candidate.sourceId}`).digest("hex");
    const id = await enqueueNotification({ channel: "in_app", template: "deadline-reminder", recipient: candidate.recipient, subject: `${label}: ${candidate.title}`, body: `${candidate.title} di ${candidate.className} ${candidate.dueAt < now ? "sudah melewati tenggat" : `memiliki tenggat ${candidate.dueAt.toISOString()}`}. Buka LIMO untuk menindaklanjuti.`, dedupeKey, metadata: { sourceType: candidate.sourceType, sourceId: candidate.sourceId, siswaId: candidate.siswaId, href: candidate.href } });
    if (id) { created += 1; queuedIds.push(id); } else skipped += 1;
  }

  const waliGroups = new Map<string, ReminderCandidateWindowed[]>();
  for (const candidate of candidates.filter((item) => item.recipientRole === "WALI")) {
    const key = `${candidate.recipient}:${candidate.window}`;
    waliGroups.set(key, [...(waliGroups.get(key) || []), candidate]);
  }

  for (const group of waliGroups.values()) {
    const first = group[0];
    const label = windowLabel(first.window);
    const lines = group.slice(0, 8).map((candidate) => `- ${candidate.childName}: ${candidate.title} (${candidate.className})`).join("\n");
    const groupSourceKey = group.map((candidate) => `${candidate.siswaId}:${candidate.sourceType}:${candidate.sourceId}`).sort().join("|");
    const subject = `${label}: aktivitas anak`;
    const body = `Ada aktivitas anak yang perlu diperhatikan:\n${lines}`;
    const metadata = { sourceType: "GROUPED", sourceId: group.map((candidate) => `${candidate.sourceType}:${candidate.sourceId}`).join(",").slice(0, 1000), siswaId: [...new Set(group.map((candidate) => candidate.siswaId))].join(","), href: "/wali/todo" };

    for (const channel of activeChannels()) {
      const recipient = channel === "email" ? first.recipient : first.phone;
      if (!recipient) continue;
      const dedupeKey = createHash("sha256").update(`deadline-reminder|WALI|${channel}|${recipient}|${dateKey}|${first.window}|${groupSourceKey}`).digest("hex");
      const id = await enqueueNotification({ channel, template: "deadline-reminder", recipient, subject, body, dedupeKey, metadata });
      if (id) { created += 1; queuedIds.push(id); } else skipped += 1;
    }
  }

  const delivery = await dispatchNotificationIds(queuedIds);
  await prisma.jobRun.create({ data: { name: "send-deadline-reminders", status: delivery.failed > 0 ? "FAILED" : "SUCCESS", finishedAt: new Date(), successCount: created, skippedCount: skipped, failedCount: delivery.failed, metadata: { dryRun: false, now: now.toISOString(), candidates: candidates.length } } });
  return { candidates: candidates.length, created, skipped, delivery, dryRun: false };
}

export async function sendInvoiceReminders(input: { now?: Date; dryRun?: boolean } = {}) {
  const now = input.now ?? new Date();
  // Batas atas inklusif = akhir hari H+3 (Jakarta), sehingga jatuh tempo kapan pun di hari itu terambil.
  const endOfWindow = new Date((localDayOrdinal(now) + 4) * DAY_MS);
  const tagihanList = await prisma.tagihan.findMany({
    where: { status: { in: ["UNPAID", "OVERDUE"] }, dueDate: { lte: endOfWindow } },
    select: { id: true, siswaId: true, amount: true, dueDate: true, jenis: true, periode: true, siswa: { select: { name: true } } },
  });
  const candidates = tagihanList
    .map((tagihan) => ({ tagihan, window: getInvoiceReminderWindow(tagihan.dueDate, now) }))
    .filter((item): item is { tagihan: (typeof tagihanList)[number]; window: ReminderWindow } => item.window !== null);

  if (input.dryRun) {
    return { candidates: candidates.length, created: 0, skipped: 0, dryRun: true };
  }

  const studentIds = [...new Set(candidates.map((item) => item.tagihan.siswaId))];
  const waliRelations = studentIds.length > 0
    ? await prisma.waliSiswa.findMany({ where: { siswaId: { in: studentIds }, endedAt: null }, select: { siswaId: true, waliProfile: { select: { phone: true, user: { select: { email: true } } } } } })
    : [];
  const contactsByStudent = new Map<string, WaliContact[]>();
  for (const relation of waliRelations) {
    const contact: WaliContact = { email: relation.waliProfile.user.email, phone: relation.waliProfile.phone };
    contactsByStudent.set(relation.siswaId, [...(contactsByStudent.get(relation.siswaId) || []), contact]);
  }

  const queuedIds: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const { tagihan, window } of candidates) {
    const label = windowLabel(window);
    const dueLabel = formatJakartaDate(tagihan.dueDate);
    const subject = `${label}: tagihan ${tagihan.jenis}`;
    const body = `Tagihan ${tagihan.jenis} periode ${formatJakartaDate(tagihan.periode)} sebesar ${formatRupiah(Number(tagihan.amount))} ${window === "OVERDUE" ? `sudah melewati jatuh tempo ${dueLabel}` : `jatuh tempo ${dueLabel}`}. Buka menu Tagihan di LIMO untuk instruksi pembayaran.`;
    const metadata = { tagihanId: tagihan.id, siswaId: tagihan.siswaId, window, href: "/wali/tagihan", dueDate: dueLabel };

    for (const contact of contactsByStudent.get(tagihan.siswaId) || []) {
      for (const channel of activeChannels()) {
        const recipient = channel === "email" ? contact.email : contact.phone;
        if (!recipient) continue;
        const dedupeKey = createHash("sha256").update(`invoice-reminder|${window}|${tagihan.id}|${channel}|${recipient}`).digest("hex");
        const id = await enqueueNotification({ channel, template: "invoice-reminder", recipient, subject, body, dedupeKey, metadata });
        if (id) { created += 1; queuedIds.push(id); } else skipped += 1;
      }
    }
  }

  const delivery = await dispatchNotificationIds(queuedIds);
  await prisma.jobRun.create({ data: { name: "send-invoice-reminders", status: delivery.failed > 0 ? "FAILED" : "SUCCESS", finishedAt: new Date(), successCount: created, skippedCount: skipped, failedCount: delivery.failed, metadata: { dryRun: false, now: now.toISOString(), candidates: candidates.length } } });
  return { candidates: candidates.length, created, skipped, delivery, dryRun: false };
}
