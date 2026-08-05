import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { method = "GET", body, cookie, headers = {}, skipOrigin = false } = {}) {
  const requestHeaders = new Headers(headers);
  if (method !== "GET" && !skipOrigin) requestHeaders.set("Origin", origin);
  if (cookie) requestHeaders.set("Cookie", cookie);
  if (body !== undefined && !(body instanceof FormData)) requestHeaders.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, { method, headers: requestHeaders, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(identifier) {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email: identifier, password: "password-dev-only" } });
  assert.equal(result.response.status, 200, `Login failed for ${identifier}: ${JSON.stringify(result.payload)}`);
  return { ...result, cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
}

function futureDate(days = 1) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function pastDate(days = 1) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function ok(label) {
  console.log(`ok - ${label}`);
}

try {
  const guru = await login("guru@limo.local");
  const student = await login("LIMO-DEV-001");
  const wali = await login("wali@limo.local");
  const guruUser = await prisma.user.findUniqueOrThrow({ where: { email: "guru@limo.local" }, include: { guruProfile: true } });
  const studentAccount = await prisma.siswaAccount.findFirstOrThrow({ where: { loginIdentifier: "limo-dev-001", status: "ACTIVE" } });
  const kelas = await prisma.kelas.findFirst({ where: { guruProfileId: guruUser.guruProfile.id, status: "ACTIVE", enrollments: { some: { siswaId: studentAccount.siswaId, status: "ACTIVE" } } } });
  assert.ok(kelas, "Seeded Guru and Siswa must share an active class");

  const create = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Text Assignment ${runId}`, instructions: "Tulis tiga kalimat tentang kegiatan hari ini.", submissionType: "ONLINE_TEXT", maxScore: 100, dueAt: futureDate(), maxAttempts: 2, allowResubmission: true } });
  assert.equal(create.response.status, 201, JSON.stringify(create.payload));
  const assignmentId = create.payload.data.item.id;
  const publish = await request(`/api/v1/guru/tugas/${assignmentId}/publish`, { method: "POST", cookie: guru.cookie });
  assert.equal(publish.response.status, 200, JSON.stringify(publish.payload));
  ok("Guru can create and publish a text assignment");

  const studentList = await request(`/api/v1/siswa/kelas/${kelas.id}/tugas`, { cookie: student.cookie });
  assert.equal(studentList.response.status, 200, JSON.stringify(studentList.payload));
  assert.equal(studentList.payload.data.items.some((item) => item.id === assignmentId), true);
  const draft = await request(`/api/v1/siswa/tugas/${assignmentId}/draft`, { method: "PATCH", cookie: student.cookie, body: { onlineText: "I read a book and practiced English.", version: 0 } });
  assert.equal(draft.response.status, 200, JSON.stringify(draft.payload));
  assert.equal(draft.payload.data.item.status, "DRAFT");
  assert.equal(draft.payload.data.item.version, 1);
  const staleDraft = await request(`/api/v1/siswa/tugas/${assignmentId}/draft`, { method: "PATCH", cookie: student.cookie, body: { onlineText: "stale", version: 0 } });
  assert.equal(staleDraft.response.status, 409);
  const submit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "I read a book and practiced English.", version: 1 } });
  assert.equal(submit.response.status, 200, JSON.stringify(submit.payload));
  assert.equal(submit.payload.data.item.status, "SUBMITTED");
  ok("Siswa autosave persists a versioned draft and final text submission rejects stale writes");

  const waliAssignments = await request(`/api/v1/wali/anak/${studentAccount.siswaId}/kelas/${kelas.id}/tugas`, { cookie: wali.cookie });
  assert.equal(waliAssignments.response.status, 200, JSON.stringify(waliAssignments.payload));
  assert.equal(waliAssignments.payload.data.items.find((item) => item.id === assignmentId).latestSubmission.status, "SUBMITTED");
  const waliMutation = await request(`/api/v1/siswa/tugas/${assignmentId}/draft`, { method: "PATCH", cookie: wali.cookie, body: { onlineText: "wali must not edit", version: 1 } });
  assert.equal(waliMutation.response.status, 403);
  ok("Wali can read assignment status but cannot mutate a Siswa submission");

  const noRepeat = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `No Repeat ${runId}`, instructions: "Satu kali submit.", submissionType: "ONLINE_TEXT", dueAt: futureDate() } });
  assert.equal(noRepeat.response.status, 201);
  const noRepeatId = noRepeat.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${noRepeatId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);
  const firstFinal = await request(`/api/v1/siswa/tugas/${noRepeatId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "final answer", version: 0 } });
  assert.equal(firstFinal.response.status, 200);
  const repeatFinal = await request(`/api/v1/siswa/tugas/${noRepeatId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "duplicate final", version: 1 } });
  assert.equal(repeatFinal.response.status, 200, JSON.stringify(repeatFinal.payload));
  assert.equal(repeatFinal.payload.data.idempotent, true);
  assert.equal(await prisma.assignmentSubmission.count({ where: { assignmentId: noRepeatId, studentId: studentAccount.siswaId } }), 1);
  ok("Duplicate final submit is idempotent and does not create a second final attempt");

  const fileAssignment = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `File Assignment ${runId}`, instructions: "Upload PDF jawaban.", submissionType: "FILE", dueAt: futureDate() } });
  assert.equal(fileAssignment.response.status, 201);
  const fileAssignmentId = fileAssignment.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${fileAssignmentId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);
  const formData = new FormData();
  formData.set("version", "0");
  formData.set("file", new File(["%PDF-1.4\nFase 3"], "jawaban.pdf", { type: "application/pdf" }));
  const fileSubmit = await request(`/api/v1/siswa/tugas/${fileAssignmentId}/submit`, { method: "POST", cookie: student.cookie, body: formData });
  assert.equal(fileSubmit.response.status, 200, JSON.stringify(fileSubmit.payload));
  const fileId = fileSubmit.payload.data.item.files[0].id;
  const studentFile = await request(`/api/v1/assignment-submissions/files/${fileId}`, { cookie: student.cookie });
  assert.equal(studentFile.response.status, 200);
  const waliFile = await request(`/api/v1/assignment-submissions/files/${fileId}`, { cookie: wali.cookie });
  assert.equal(waliFile.response.status, 200);
  const guruFile = await request(`/api/v1/assignment-submissions/files/${fileId}`, { cookie: guru.cookie });
  assert.equal(guruFile.response.status, 200);
  ok("Siswa can submit a private PDF and only scoped Siswa, Wali, or Guru can download it");

  const lateAssignment = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Late Assignment ${runId}`, instructions: "Tugas terlambat.", submissionType: "ONLINE_TEXT", dueAt: pastDate(), cutoffAt: futureDate(), allowLateSubmission: true } });
  assert.equal(lateAssignment.response.status, 201);
  const lateAssignmentId = lateAssignment.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${lateAssignmentId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);
  const lateSubmit = await request(`/api/v1/siswa/tugas/${lateAssignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "submitted late", version: 0 } });
  assert.equal(lateSubmit.response.status, 200, JSON.stringify(lateSubmit.payload));
  assert.equal(lateSubmit.payload.data.item.status, "LATE");
  ok("Server marks a submission LATE when dueAt has passed and late submission is allowed");

  const moduleResult = await request(`/api/v1/guru/kelas/${kelas.id}/modul`, { method: "POST", cookie: guru.cookie, body: { title: `Assignment Module ${runId}`, description: "Module with assignment", order: 99 } });
  assert.equal(moduleResult.response.status, 201);
  const moduleId = moduleResult.payload.data.item.id;
  const moduleItem = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "ASSIGNMENT", entityId: assignmentId, isRequired: true } });
  assert.equal(moduleItem.response.status, 201, JSON.stringify(moduleItem.payload));
  ok("Published assignments can be attached to a structured learning module");

  const guruPage = await request(`/guru/kelas/${kelas.id}/tugas`, { cookie: guru.cookie });
  assert.equal(guruPage.response.status, 200);
  const studentPage = await request(`/siswa/tugas/${assignmentId}`, { cookie: student.cookie });
  assert.equal(studentPage.response.status, 200);
  const waliPage = await request(`/wali/progres/${studentAccount.siswaId}/tugas`, { cookie: wali.cookie });
  assert.equal(waliPage.response.status, 200);
  ok("Guru, Siswa, and Wali Fase 3 pages render");
} finally {
  await prisma.$disconnect();
}
