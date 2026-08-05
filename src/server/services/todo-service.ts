import "server-only";

import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";

export type TodoStatus = "OPEN" | "OVERDUE" | "DONE";
export type TodoPriority = "HIGH" | "NORMAL" | "LOW";

export type TodoItem = {
  key: string;
  kind: string;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  classId: string | null;
  siswaId: string | null;
  childName: string | null;
  dueAt: Date | null;
  status: TodoStatus;
  isOverdue: boolean;
  priority: TodoPriority;
  href: string;
};

function requireTodoFeature() {
  requireFeature("calendarEnabled", "Kalender dan To-do belum diaktifkan");
}

function todoStatus(done: boolean, dueAt: Date | null, now: Date): TodoStatus {
  if (done) return "DONE";
  return dueAt && dueAt < now ? "OVERDUE" : "OPEN";
}

function priority(status: TodoStatus, dueAt: Date | null, now: Date): TodoPriority {
  if (status === "OVERDUE") return "HIGH";
  if (dueAt && dueAt.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000) return "HIGH";
  return "NORMAL";
}

function sortTodos(items: TodoItem[]) {
  return items.sort((left, right) => {
    const statusRank = { OVERDUE: 0, OPEN: 1, DONE: 2 };
    return statusRank[left.status] - statusRank[right.status] || (left.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) || left.title.localeCompare(right.title);
  });
}

function todoResult(actor: Actor, items: TodoItem[], now: Date) {
  const sorted = sortTodos(items);
  return { items: sorted.filter((item) => item.status !== "DONE"), completedCount: sorted.filter((item) => item.status === "DONE").length, role: actor.role, generatedAt: now };
}

async function getStudentTodo(actor: Actor, now: Date) {
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true, name: true } } } });
  if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun siswa belum aktif");
  const enrollments = await prisma.kelasSiswa.findMany({ where: { siswaId: account.siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { kelasId: true, startDate: true, endDate: true, kelas: { select: { name: true } } } });
  const classIds = enrollments.map((item) => item.kelasId);
  const [assignments, exams] = await Promise.all([
    prisma.assignment.findMany({ where: { kelasId: { in: classIds }, status: "PUBLISHED", OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] }, orderBy: { dueAt: "asc" }, select: { id: true, kelasId: true, title: true, dueAt: true, submissions: { where: { studentId: account.siswaId }, orderBy: { attemptNumber: "desc" }, take: 1, select: { status: true } }, kelas: { select: { name: true } } } }),
    prisma.ujian.findMany({ where: { kelasId: { in: classIds }, status: "PUBLISHED" }, orderBy: { examDate: "asc" }, select: { id: true, kelasId: true, title: true, examDate: true, availableFrom: true, availableUntil: true, results: { where: { siswaId: account.siswaId, status: { in: ["FINAL", "CORRECTED"] } }, take: 1, select: { id: true } }, attempts: { where: { siswaId: account.siswaId }, orderBy: { updatedAt: "desc" }, take: 1, select: { status: true } }, kelas: { select: { name: true } } } }),
  ]);
  const items: TodoItem[] = [];
  for (const assignment of assignments) {
    const submissionStatus = assignment.submissions[0]?.status || null;
    const done = submissionStatus !== null && ["SUBMITTED", "LATE", "GRADED"].includes(submissionStatus);
    const status = submissionStatus === "NEEDS_REVISION" ? "OPEN" : todoStatus(done, assignment.dueAt, now);
    items.push({ key: `Assignment:${assignment.id}:${account.siswaId}`, kind: submissionStatus === "NEEDS_REVISION" ? "ASSIGNMENT_REVISION" : "ASSIGNMENT_SUBMISSION", title: submissionStatus === "NEEDS_REVISION" ? `Revisi tugas: ${assignment.title}` : `Kirim tugas: ${assignment.title}`, description: `${assignment.kelas.name}${assignment.dueAt ? ` / tenggat ${assignment.dueAt.toISOString()}` : " / tanpa tenggat"}`, entityType: "Assignment", entityId: assignment.id, classId: assignment.kelasId, siswaId: account.siswaId, childName: null, dueAt: assignment.dueAt, status, isOverdue: status === "OVERDUE", priority: submissionStatus === "NEEDS_REVISION" ? "HIGH" : priority(status, assignment.dueAt, now), href: `/siswa/tugas/${assignment.id}` });
  }
  for (const exam of exams) {
    if (exam.availableFrom && exam.availableFrom > now) continue;
    const done = exam.results.length > 0;
    const dueAt = exam.examDate || exam.availableUntil;
    const status = todoStatus(done, dueAt, now);
    items.push({ key: `Ujian:${exam.id}:${account.siswaId}`, kind: "EXAM", title: `Ikuti ujian: ${exam.title}`, description: exam.kelas.name, entityType: "Ujian", entityId: exam.id, classId: exam.kelasId, siswaId: account.siswaId, childName: null, dueAt, status, isOverdue: status === "OVERDUE", priority: priority(status, dueAt, now), href: `/siswa/kelas/${exam.kelasId}` });
  }
  return todoResult(actor, items, now);
}

async function getWaliTodo(actor: Actor, now: Date) {
  const relations = await prisma.waliSiswa.findMany({ where: { waliProfile: { userId: actor.id }, endedAt: null, siswa: { status: "ACTIVE", deletedAt: null } }, select: { siswaId: true, siswa: { select: { name: true } } } });
  const studentIds = relations.map((item) => item.siswaId);
  const childNames = new Map(relations.map((item) => [item.siswaId, item.siswa.name]));
  const enrollments = await prisma.kelasSiswa.findMany({ where: { siswaId: { in: studentIds }, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { siswaId: true, kelasId: true } });
  const enrollmentKeys = new Set(enrollments.map((item) => `${item.siswaId}:${item.kelasId}`));
  const classIds = [...new Set(enrollments.map((item) => item.kelasId))];
  const [assignments, exams, sessions] = await Promise.all([
    prisma.assignment.findMany({ where: { kelasId: { in: classIds }, status: "PUBLISHED" }, orderBy: { dueAt: "asc" }, select: { id: true, kelasId: true, title: true, dueAt: true, submissions: { where: { studentId: { in: studentIds } }, orderBy: [{ studentId: "asc" }, { attemptNumber: "desc" }], select: { studentId: true, status: true } }, kelas: { select: { name: true } } } }),
    prisma.ujian.findMany({ where: { kelasId: { in: classIds }, status: "PUBLISHED" }, orderBy: { examDate: "asc" }, select: { id: true, kelasId: true, title: true, examDate: true, availableFrom: true, availableUntil: true, results: { where: { siswaId: { in: studentIds }, status: { in: ["FINAL", "CORRECTED"] } }, select: { siswaId: true } }, kelas: { select: { name: true } } } }),
    prisma.sesiKelas.findMany({ where: { kelasId: { in: classIds }, sessionDate: { gte: now }, status: { not: "CANCELLED" } }, orderBy: { sessionDate: "asc" }, take: 20, select: { id: true, kelasId: true, topic: true, sessionDate: true, kelas: { select: { name: true } } } }),
  ]);
  const items: TodoItem[] = [];
  for (const assignment of assignments) {
    const latestByStudent = new Map<string, string>();
    for (const submission of assignment.submissions) if (!latestByStudent.has(submission.studentId)) latestByStudent.set(submission.studentId, submission.status);
    for (const studentId of studentIds) {
      if (!enrollmentKeys.has(`${studentId}:${assignment.kelasId}`)) continue;
      const submissionStatus = latestByStudent.get(studentId) || null;
      const done = submissionStatus !== null && ["SUBMITTED", "LATE", "GRADED"].includes(submissionStatus);
      const status = submissionStatus === "NEEDS_REVISION" ? "OPEN" : todoStatus(done, assignment.dueAt, now);
      items.push({ key: `Assignment:${assignment.id}:${studentId}`, kind: submissionStatus === "NEEDS_REVISION" ? "ASSIGNMENT_REVISION" : "ASSIGNMENT_SUBMISSION", title: `${submissionStatus === "NEEDS_REVISION" ? "Revisi" : "Tugas"} ${childNames.get(studentId)}: ${assignment.title}`, description: `${assignment.kelas.name}${assignment.dueAt ? ` / tenggat ${assignment.dueAt.toISOString()}` : " / tanpa tenggat"}`, entityType: "Assignment", entityId: assignment.id, classId: assignment.kelasId, siswaId: studentId, childName: childNames.get(studentId) || null, dueAt: assignment.dueAt, status, isOverdue: status === "OVERDUE", priority: submissionStatus === "NEEDS_REVISION" ? "HIGH" : priority(status, assignment.dueAt, now), href: `/wali/tugas/${studentId}` });
    }
  }
  for (const exam of exams) {
    const completed = new Set(exam.results.map((item) => item.siswaId));
    for (const studentId of studentIds) {
      if (!enrollmentKeys.has(`${studentId}:${exam.kelasId}`) || (exam.availableFrom && exam.availableFrom > now)) continue;
      const dueAt = exam.examDate || exam.availableUntil;
      const status = todoStatus(completed.has(studentId), dueAt, now);
      items.push({ key: `Ujian:${exam.id}:${studentId}`, kind: "EXAM", title: `Ujian ${childNames.get(studentId)}: ${exam.title}`, description: exam.kelas.name, entityType: "Ujian", entityId: exam.id, classId: exam.kelasId, siswaId: studentId, childName: childNames.get(studentId) || null, dueAt, status, isOverdue: status === "OVERDUE", priority: priority(status, dueAt, now), href: `/wali/tugas/${studentId}` });
    }
  }
  for (const session of sessions) {
    for (const studentId of studentIds) {
      if (!enrollmentKeys.has(`${studentId}:${session.kelasId}`)) continue;
      items.push({ key: `SesiKelas:${session.id}:${studentId}`, kind: "CLASS_SESSION", title: `Jadwal ${childNames.get(studentId)}: ${session.topic}`, description: session.kelas.name, entityType: "SesiKelas", entityId: session.id, classId: session.kelasId, siswaId: studentId, childName: childNames.get(studentId) || null, dueAt: session.sessionDate, status: "OPEN", isOverdue: false, priority: "LOW", href: `/wali/progres/${studentId}` });
    }
  }
  return todoResult(actor, items, now);
}

async function getGuruTodo(actor: Actor, now: Date) {
  const classes = await prisma.kelas.findMany({ where: { status: "ACTIVE", guruProfile: { userId: actor.id } }, select: { id: true, name: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } } });
  const classIds = classes.map((item) => item.id);
  const classNames = new Map(classes.map((item) => [item.id, item.name]));
  const [assignments, modules, materials, sessions, submissions, gradeCategories] = await Promise.all([
    prisma.assignment.findMany({ where: { kelasId: { in: classIds }, status: "DRAFT" }, select: { id: true, kelasId: true, title: true } }),
    prisma.learningModule.findMany({ where: { kelasId: { in: classIds }, status: "DRAFT" }, select: { id: true, kelasId: true, title: true, releaseAt: true } }),
    prisma.materi.findMany({ where: { kelasId: { in: classIds }, status: "DRAFT" }, select: { id: true, kelasId: true, title: true } }),
    prisma.sesiKelas.findMany({ where: { kelasId: { in: classIds }, status: "DRAFT" }, select: { id: true, kelasId: true, topic: true, sessionDate: true } }),
    prisma.assignmentSubmission.findMany({ where: { assignment: { kelasId: { in: classIds } }, status: { in: ["SUBMITTED", "LATE", "NEEDS_REVISION"] } }, orderBy: { updatedAt: "asc" }, select: { id: true, studentId: true, assignmentId: true, status: true, assignment: { select: { title: true, kelasId: true, kelas: { select: { name: true } } }, }, student: { select: { name: true } } } }),
    prisma.gradeCategory.findMany({ where: { classId: { in: classIds }, status: "PUBLISHED" }, select: { id: true, classId: true, name: true } }),
  ]);
  const items: TodoItem[] = [];
  const gradebookTodoClasses = new Set<string>();
  for (const item of assignments) items.push({ key: `AssignmentDraft:${item.id}`, kind: "ASSIGNMENT_DRAFT", title: `Publikasikan tugas: ${item.title}`, description: classNames.get(item.kelasId) || "Kelas", entityType: "Assignment", entityId: item.id, classId: item.kelasId, siswaId: null, childName: null, dueAt: null, status: "OPEN", isOverdue: false, priority: "HIGH", href: `/guru/kelas/${item.kelasId}/tugas` });
  for (const item of modules) items.push({ key: `ModuleDraft:${item.id}`, kind: "MODULE_DRAFT", title: `Publikasikan modul: ${item.title}`, description: classNames.get(item.kelasId) || "Kelas", entityType: "LearningModule", entityId: item.id, classId: item.kelasId, siswaId: null, childName: null, dueAt: item.releaseAt, status: "OPEN", isOverdue: false, priority: "NORMAL", href: `/guru/kelas/${item.kelasId}/modul` });
  for (const item of materials) items.push({ key: `MateriDraft:${item.id}`, kind: "MATERIAL_DRAFT", title: `Publikasikan materi: ${item.title}`, description: classNames.get(item.kelasId) || "Kelas", entityType: "Materi", entityId: item.id, classId: item.kelasId, siswaId: null, childName: null, dueAt: null, status: "OPEN", isOverdue: false, priority: "NORMAL", href: `/guru/kelas/${item.kelasId}` });
  for (const item of sessions) items.push({ key: `SessionDraft:${item.id}`, kind: "SESSION_UNFINALIZED", title: `Finalkan sesi: ${item.topic}`, description: `${classNames.get(item.kelasId) || "Kelas"} / ${item.sessionDate.toISOString()}`, entityType: "SesiKelas", entityId: item.id, classId: item.kelasId, siswaId: null, childName: null, dueAt: item.sessionDate, status: todoStatus(false, item.sessionDate, now), isOverdue: item.sessionDate < now, priority: "HIGH", href: `/guru/presensi/${item.id}` });
  for (const item of submissions) items.push({ key: `Submission:${item.id}`, kind: "SUBMISSION_TO_GRADE", title: `Nilai submission ${item.student.name}: ${item.assignment.title}`, description: `${item.assignment.kelas.name} / ${item.status}`, entityType: "AssignmentSubmission", entityId: item.id, classId: item.assignment.kelasId, siswaId: item.studentId, childName: item.student.name, dueAt: null, status: "OPEN", isOverdue: false, priority: item.status === "NEEDS_REVISION" ? "HIGH" : "NORMAL", href: `/guru/tugas/${item.assignmentId}/submissions` });
  for (const category of gradeCategories) {
    if (gradebookTodoClasses.has(category.classId)) continue;
    const classInfo = classes.find((item) => item.id === category.classId);
    if (!classInfo || classInfo._count.enrollments === 0) continue;
    const publishedCount = await prisma.finalGrade.count({ where: { classId: category.classId, status: { in: ["PUBLISHED", "LOCKED", "CORRECTED"] } } });
    gradebookTodoClasses.add(category.classId);
    if (publishedCount < classInfo._count.enrollments) items.push({ key: `Gradebook:${category.classId}`, kind: "GRADEBOOK_PUBLISH", title: `Publikasikan nilai: ${classInfo.name}`, description: `Kategori ${category.name} belum memiliki nilai akhir untuk semua siswa aktif`, entityType: "Gradebook", entityId: category.classId, classId: category.classId, siswaId: null, childName: null, dueAt: null, status: "OPEN", isOverdue: false, priority: "HIGH", href: `/guru/kelas/${category.classId}/gradebook` });
  }
  return todoResult(actor, items, now);
}

export async function listTodoItems(actor: Actor, now = new Date()) {
  requireTodoFeature();
  if (actor.role === "GURU") return getGuruTodo(actor, now);
  if (actor.role === "SISWA") return getStudentTodo(actor, now);
  if (actor.role === "WALI") return getWaliTodo(actor, now);
  if (actor.role === "ADMIN") return todoResult(actor, [], now);
  throw new ForbiddenError("Role belum didukung To-do");
}
