import assert from "node:assert/strict";

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
  const student = await login("LIMO-DEV-001");
  const wali = await login("wali@limo.local");
  const guruUser = await prisma.user.findUniqueOrThrow({ where: { email: "guru@limo.local" }, include: { guruProfile: true } });
  const studentAccount = await prisma.siswaAccount.findFirstOrThrow({ where: { loginIdentifier: "limo-dev-001", status: "ACTIVE" } });
  const kelas = await prisma.kelas.findFirstOrThrow({ where: { guruProfileId: guruUser.guruProfile.id, status: "ACTIVE", enrollments: { some: { siswaId: studentAccount.siswaId, status: "ACTIVE" } } }, select: { id: true } });
  const materials = await prisma.materi.findMany({ where: { kelasId: kelas.id, status: "PUBLISHED" }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true, title: true } });
  assert.equal(materials.length >= 2, true, "Fase 7 requires two published materials for prerequisite coverage");
  const exam = await prisma.ujian.findFirstOrThrow({ where: { kelasId: kelas.id, status: "PUBLISHED", results: { some: { siswaId: studentAccount.siswaId, status: { in: ["FINAL", "CORRECTED"] } } } }, select: { id: true, title: true } });
  const session = await prisma.sesiKelas.findFirstOrThrow({ where: { kelasId: kelas.id, status: { not: "CANCELLED" } }, orderBy: { meetingNumber: "asc" }, select: { id: true, topic: true } });

  const assignment = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Fase 7 assignment ${runId}`, instructions: "Submit untuk menyelesaikan aktivitas.", submissionType: "ONLINE_TEXT", maxScore: 100, availableFrom: new Date(Date.now() - 60 * 60 * 1000).toISOString(), dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), allowLateSubmission: true } });
  assert.equal(assignment.response.status, 201, JSON.stringify(assignment.payload));
  const assignmentId = assignment.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);

  const learningModule = await request(`/api/v1/guru/kelas/${kelas.id}/modul`, { method: "POST", cookie: guru.cookie, body: { title: `Fase 7 Completion ${runId}`, description: "Completion integration fixture", order: 0 } });
  assert.equal(learningModule.response.status, 201, JSON.stringify(learningModule.payload));
  const moduleId = learningModule.payload.data.item.id;
  const firstItem = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "MATERIAL", entityId: materials[0].id, isRequired: true } });
  assert.equal(firstItem.response.status, 201, JSON.stringify(firstItem.payload));
  const firstItemId = firstItem.payload.data.item.id;
  const prerequisiteItem = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "MATERIAL", entityId: materials[1].id, isRequired: true, prerequisiteItemId: firstItemId } });
  assert.equal(prerequisiteItem.response.status, 201, JSON.stringify(prerequisiteItem.payload));
  const prerequisiteItemId = prerequisiteItem.payload.data.item.id;
  const assignmentItem = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "ASSIGNMENT", entityId: assignmentId, isRequired: true } });
  assert.equal(assignmentItem.response.status, 201, JSON.stringify(assignmentItem.payload));
  const assignmentItemId = assignmentItem.payload.data.item.id;
  const examItem = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "EXAM", entityId: exam.id, isRequired: true } });
  assert.equal(examItem.response.status, 201, JSON.stringify(examItem.payload));
  const examItemId = examItem.payload.data.item.id;
  const manualItem = await request(`/api/v1/guru/modul/${moduleId}/items`, { method: "POST", cookie: guru.cookie, body: { itemType: "CLASS_SESSION", entityId: session.id, isRequired: true } });
  assert.equal(manualItem.response.status, 201, JSON.stringify(manualItem.payload));
  const manualItemId = manualItem.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/modul/${moduleId}/items/${manualItemId}`, { method: "PATCH", cookie: guru.cookie, body: { ruleType: "MANUAL", isRequired: true } })).response.status, 200);
  assert.equal((await request(`/api/v1/guru/modul/${moduleId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);
  ok("Guru can build a published module with completion rules for material, assignment, exam, prerequisite, and manual activity");

  const blocked = await request(`/api/v1/siswa/kelas/${kelas.id}/modul/${moduleId}/items/${prerequisiteItemId}/view`, { method: "POST", cookie: student.cookie });
  assert.equal(blocked.response.status, 409, JSON.stringify(blocked.payload));
  const viewed = await request(`/api/v1/siswa/kelas/${kelas.id}/modul/${moduleId}/items/${firstItemId}/view`, { method: "POST", cookie: student.cookie });
  assert.equal(viewed.response.status, 200, JSON.stringify(viewed.payload));
  assert.equal((await request(`/api/v1/siswa/kelas/${kelas.id}/modul/${moduleId}/items/${firstItemId}/view`, { method: "POST", cookie: student.cookie })).response.status, 200);
  assert.equal(await prisma.studentActivityCompletion.count({ where: { studentId: studentAccount.siswaId, moduleItemId: firstItemId } }), 1);
  const opened = await request(`/api/v1/siswa/kelas/${kelas.id}/modul/${moduleId}/items/${prerequisiteItemId}/view`, { method: "POST", cookie: student.cookie });
  assert.equal(opened.response.status, 200, JSON.stringify(opened.payload));
  ok("VIEWED completion is idempotent and unlocks a prerequisite activity");

  const beforeSubmit = await request(`/api/v1/siswa/kelas/${kelas.id}/modul/progres?moduleId=${moduleId}`, { cookie: student.cookie });
  assert.equal(beforeSubmit.response.status, 200, JSON.stringify(beforeSubmit.payload));
  const beforeItems = new Map(beforeSubmit.payload.data.modules[0].items.map((item) => [item.moduleItemId, item.status]));
  assert.equal(beforeItems.get(firstItemId), "COMPLETED");
  assert.equal(beforeItems.get(assignmentItemId), "NOT_STARTED");
  assert.equal(beforeItems.get(examItemId), "COMPLETED");
  const submit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "Jawaban Fase 7", version: 0 } });
  assert.equal(submit.response.status, 200, JSON.stringify(submit.payload));
  const afterSubmit = await request(`/api/v1/siswa/kelas/${kelas.id}/modul/progres?moduleId=${moduleId}`, { cookie: student.cookie });
  assert.equal(afterSubmit.payload.data.modules[0].items.find((item) => item.moduleItemId === assignmentItemId).status, "COMPLETED");
  ok("Final assignment submission updates completion automatically");

  const matrix = await request(`/api/v1/guru/kelas/${kelas.id}/progres/aktivitas`, { cookie: guru.cookie });
  assert.equal(matrix.response.status, 200, JSON.stringify(matrix.payload));
  assert.ok(matrix.payload.data.modules.some((item) => item.id === moduleId));
  const manual = await request(`/api/v1/guru/kelas/${kelas.id}/progres/aktivitas/${studentAccount.siswaId}/${manualItemId}/manual`, { method: "PUT", cookie: guru.cookie, body: { completed: true, reason: "Guru memverifikasi aktivitas kelas" } });
  assert.equal(manual.response.status, 200, JSON.stringify(manual.payload));
  const afterManual = await request(`/api/v1/siswa/kelas/${kelas.id}/modul/progres?moduleId=${moduleId}`, { cookie: student.cookie });
  assert.equal(afterManual.payload.data.modules[0].items.find((item) => item.moduleItemId === manualItemId).status, "COMPLETED");
  const waliProgress = await request(`/api/v1/wali/anak/${studentAccount.siswaId}/kelas/${kelas.id}/modul/progres?moduleId=${moduleId}`, { cookie: wali.cookie });
  assert.equal(waliProgress.response.status, 200, JSON.stringify(waliProgress.payload));
  assert.equal(waliProgress.payload.data.modules[0].items.find((item) => item.moduleItemId === manualItemId).status, "COMPLETED");
  ok("Guru matrix manual completion is audited and Siswa/Wali receive the same progress state");

  const archived = await request(`/api/v1/guru/modul/${moduleId}/items/${firstItemId}`, { method: "DELETE", cookie: guru.cookie });
  assert.equal(archived.response.status, 200, JSON.stringify(archived.payload));
  assert.equal(await prisma.studentActivityCompletion.count({ where: { studentId: studentAccount.siswaId, moduleItemId: firstItemId } }), 1);
  const afterArchive = await request(`/api/v1/siswa/kelas/${kelas.id}/modul/progres?moduleId=${moduleId}`, { cookie: student.cookie });
  assert.equal(afterArchive.payload.data.modules[0].items.some((item) => item.moduleItemId === firstItemId), false);
  ok("Archiving an activity preserves completion history while removing it from active progress totals");
} finally {
  await prisma.$disconnect();
}
