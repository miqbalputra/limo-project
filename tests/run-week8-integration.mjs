import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { method = "GET", body, cookie } = {}) {
  const headers = new Headers();
  if (method !== "GET") headers.set("Origin", baseUrl);
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(identifier) {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email: identifier, password: "password-dev-only" } });
  assert.equal(result.response.status, 200, `Login failed for ${identifier}: ${JSON.stringify(result.payload)}`);
  return { cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
}

function ok(label) {
  console.log(`ok - ${label}`);
}

try {
  const guru = await login("guru@limo.local");
  const admin = await login("admin@limo.local");
  const student = await login("LIMO-DEV-001");
  const wali = await login("wali@limo.local");
  const guruUser = await prisma.user.findUniqueOrThrow({ where: { email: "guru@limo.local" }, include: { guruProfile: true } });
  const studentAccount = await prisma.siswaAccount.findFirstOrThrow({ where: { loginIdentifier: "limo-dev-001", status: "ACTIVE" } });
  const kelas = await prisma.kelas.findFirstOrThrow({ where: { guruProfileId: guruUser.guruProfile.id, status: "ACTIVE", enrollments: { some: { siswaId: studentAccount.siswaId, status: "ACTIVE" } } }, select: { id: true, name: true } });
  const reminderNow = new Date();
  const dueAt = new Date(reminderNow.getTime() + 24 * 60 * 60 * 1000);
  const from = new Date(reminderNow.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(reminderNow.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();

  const manualEvent = await request("/api/v1/calendar/events", { method: "POST", cookie: guru.cookie, body: { classId: kelas.id, title: `Fase 6 announcement ${runId}`, eventType: "ANNOUNCEMENT", startAt: new Date(reminderNow.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), visibility: "ALL" } });
  assert.equal(manualEvent.response.status, 201, JSON.stringify(manualEvent.payload));
  const eventId = manualEvent.payload.data.item.id;
  const guruCalendar = await request(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: guru.cookie });
  assert.equal(guruCalendar.response.status, 200, JSON.stringify(guruCalendar.payload));
  assert.ok(guruCalendar.payload.data.events.some((event) => event.id === `CalendarEvent:${eventId}`));
  const studentCalendar = await request(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: student.cookie });
  const waliCalendar = await request(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: wali.cookie });
  assert.ok(studentCalendar.payload.data.events.some((event) => event.id === `CalendarEvent:${eventId}`));
  assert.ok(waliCalendar.payload.data.events.some((event) => event.id === `CalendarEvent:${eventId}`));
  ok("Calendar derived events and manual announcements are visible within role scope");

  const globalEvent = await request("/api/v1/calendar/events", { method: "POST", cookie: admin.cookie, body: { title: `Fase 6 holiday ${runId}`, eventType: "HOLIDAY", startAt: new Date(reminderNow.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), allDay: true, visibility: "ALL" } });
  assert.equal(globalEvent.response.status, 201, JSON.stringify(globalEvent.payload));
  const globalCalendar = await request(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: student.cookie });
  assert.ok(globalCalendar.payload.data.events.some((event) => event.id === `CalendarEvent:${globalEvent.payload.data.item.id}`));
  const guruGlobalAttempt = await request("/api/v1/calendar/events", { method: "POST", cookie: guru.cookie, body: { title: `Fase 6 invalid global ${runId}`, eventType: "ANNOUNCEMENT", startAt: new Date(reminderNow.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(), visibility: "ALL" } });
  assert.equal(guruGlobalAttempt.response.status, 403);
  ok("Admin can create global events while Guru mutations remain class-scoped");

  const assignment = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Fase 6 deadline ${runId}`, instructions: "Selesaikan aktivitas kalender.", submissionType: "ONLINE_TEXT", maxScore: 100, availableFrom: new Date(reminderNow.getTime() - 60 * 60 * 1000).toISOString(), dueAt: dueAt.toISOString(), cutoffAt: new Date(dueAt.getTime() + 24 * 60 * 60 * 1000).toISOString() } });
  assert.equal(assignment.response.status, 201, JSON.stringify(assignment.payload));
  const assignmentId = assignment.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } })).response.status, 200);
  const initialCalendar = await request(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: student.cookie });
  assert.ok(initialCalendar.payload.data.events.some((event) => event.id === `Assignment:${assignmentId}` && event.startAt === dueAt.toISOString()));
  const movedDueAt = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000);
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}`, { method: "PATCH", cookie: guru.cookie, body: { dueAt: movedDueAt.toISOString() } })).response.status, 200);
  const movedCalendar = await request(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: student.cookie });
  assert.ok(movedCalendar.payload.data.events.some((event) => event.id === `Assignment:${assignmentId}` && event.startAt === movedDueAt.toISOString()));
  ok("Changing a source deadline is reflected immediately without stale calendar data");

  const studentTodo = await request("/api/v1/todo", { cookie: student.cookie });
  assert.equal(studentTodo.response.status, 200, JSON.stringify(studentTodo.payload));
  assert.ok(studentTodo.payload.data.items.some((item) => item.entityId === assignmentId && item.status === "OPEN"));
  const waliTodo = await request("/api/v1/todo", { cookie: wali.cookie });
  assert.equal(waliTodo.response.status, 200, JSON.stringify(waliTodo.payload));
  assert.ok(waliTodo.payload.data.items.some((item) => item.entityId === assignmentId && item.siswaId === studentAccount.siswaId));
  ok("Siswa and Wali receive scoped open To-do items for an unpublished submission");

  const reminderJobNow = new Date(movedDueAt.getTime() - 24 * 60 * 60 * 1000);
  const reminderRun = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/send-deadline-reminders.ts", `--now=${reminderJobNow.toISOString()}`], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: "file:./dev.db" }, encoding: "utf8" });
  assert.equal(reminderRun.status, 0, reminderRun.stderr || reminderRun.stdout);
  const reminderNotification = await prisma.notifikasi.findFirst({ where: { template: "deadline-reminder", recipient: "siswa@limo.local", body: { contains: assignment.payload.data.item.title } }, select: { id: true } });
  assert.ok(reminderNotification, "Student reminder should be created");
  const reminderCountBefore = await prisma.notifikasi.count({ where: { template: "deadline-reminder", recipient: "siswa@limo.local", body: { contains: assignment.payload.data.item.title } } });
  const secondReminderRun = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/send-deadline-reminders.ts", `--now=${reminderJobNow.toISOString()}`], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: "file:./dev.db" }, encoding: "utf8" });
  assert.equal(secondReminderRun.status, 0, secondReminderRun.stderr || secondReminderRun.stdout);
  const reminderCountAfter = await prisma.notifikasi.count({ where: { template: "deadline-reminder", recipient: "siswa@limo.local", body: { contains: assignment.payload.data.item.title } } });
  assert.equal(reminderCountAfter, reminderCountBefore);
  ok("H-1 reminder is created once and rerunning the job does not duplicate it");

  const submit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "Sudah selesai", version: 0 } });
  assert.equal(submit.response.status, 200, JSON.stringify(submit.payload));
  const completedTodo = await request("/api/v1/todo", { cookie: student.cookie });
  assert.equal(completedTodo.response.status, 200, JSON.stringify(completedTodo.payload));
  assert.equal(completedTodo.payload.data.items.some((item) => item.entityId === assignmentId), false);
  ok("Completed submission disappears from the student To-do list");
} finally {
  await prisma.$disconnect();
}
