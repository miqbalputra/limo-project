import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (method !== "GET") requestHeaders.set("Origin", baseUrl);
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

function ok(label) {
  console.log(`ok - ${label}`);
}

try {
  const guru = await login("guru@limo.local");
  const student = await login("LIMO-DEV-001");
  const wali = await login("wali@limo.local");
  const guruUser = await prisma.user.findUniqueOrThrow({ where: { email: "guru@limo.local" }, include: { guruProfile: true } });
  const waliUser = await prisma.user.findUniqueOrThrow({ where: { email: "wali@limo.local" } });
  const studentAccount = await prisma.siswaAccount.findFirstOrThrow({ where: { loginIdentifier: "limo-dev-001", status: "ACTIVE" } });
  const studentUser = await prisma.user.findUniqueOrThrow({ where: { id: studentAccount.userId } });
  const kelas = await prisma.kelas.findFirst({ where: { guruProfileId: guruUser.guruProfile.id, status: "ACTIVE", enrollments: { some: { siswaId: studentAccount.siswaId, status: "ACTIVE" } } } });
  assert.ok(kelas, "Seeded Guru and Siswa must share an active class");

  const rubric = await request("/api/v1/guru/rubrik", { method: "POST", cookie: guru.cookie, body: { title: `Speaking rubric ${runId}`, description: "Rubrik speaking", scope: "PRIVATE", criteria: [{ name: "Pronunciation", description: "Kejelasan pengucapan", maxScore: 10, order: 0, levels: [{ label: "Needs work", score: 0, order: 0 }, { label: "Excellent", score: 10, order: 1 }] }, { name: "Fluency", description: "Kelancaran", maxScore: 10, order: 1, levels: [{ label: "Needs work", score: 0, order: 0 }, { label: "Excellent", score: 10, order: 1 }] }] } });
  assert.equal(rubric.response.status, 201, JSON.stringify(rubric.payload));
  const rubricId = rubric.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/rubrik/${rubricId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } })).response.status, 200);
  ok("Guru can create and publish a reusable rubric");

  const assignmentResult = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Rubric assignment ${runId}`, instructions: "Kirim jawaban speaking.", submissionType: "ONLINE_TEXT", maxScore: 50, maxAttempts: 1 } });
  assert.equal(assignmentResult.response.status, 201, JSON.stringify(assignmentResult.payload));
  const assignmentId = assignmentResult.payload.data.item.id;
  const attached = await request(`/api/v1/guru/tugas/${assignmentId}/rubric`, { method: "PATCH", cookie: guru.cookie, body: { rubricId } });
  assert.equal(attached.response.status, 200, JSON.stringify(attached.payload));
  const snapshotBeforeEdit = attached.payload.data.item.rubricSnapshot;
  const edited = await request(`/api/v1/guru/rubrik/${rubricId}`, { method: "PATCH", cookie: guru.cookie, body: { title: `Speaking rubric edited ${runId}`, description: "Template berubah", scope: "PRIVATE", criteria: [{ name: "Pronunciation edited", description: "Updated", maxScore: 10, order: 0, levels: [{ label: "Needs work edited", score: 0, order: 0 }, { label: "Excellent edited", score: 10, order: 1 }] }, { name: "Fluency edited", description: "Updated", maxScore: 10, order: 1, levels: [{ label: "Needs work edited", score: 0, order: 0 }, { label: "Excellent edited", score: 10, order: 1 }] }] } });
  assert.equal(edited.response.status, 200, JSON.stringify(edited.payload));
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);
  ok("Attached rubric keeps its snapshot when the reusable template is edited");

  const submit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "I can speak clearly.", version: 0 } });
  assert.equal(submit.response.status, 200, JSON.stringify(submit.payload));
  const submissionId = submit.payload.data.item.id;
  const context = await request(`/api/v1/guru/submissions/${submissionId}/grade`, { cookie: guru.cookie });
  assert.equal(context.response.status, 200, JSON.stringify(context.payload));
  assert.equal(context.payload.data.rubricSnapshot.title, snapshotBeforeEdit.title);
  assert.equal(context.payload.data.submission.files.length, 0);
  const privateStudentView = (await request(`/api/v1/siswa/tugas/${assignmentId}`, { cookie: student.cookie })).payload.data.submission;
  assert.equal(privateStudentView.publishedGrade, null);
  assert.equal(Object.hasOwn(privateStudentView, "grades"), false);

  const criteria = context.payload.data.rubricSnapshot.criteria.map((criterion, index) => ({ criterionId: criterion.id, rubricLevelId: criterion.levels[1].id, score: index === 0 ? 8 : 9, comment: `Catatan ${index}` }));
  const draft = await request(`/api/v1/guru/submissions/${submissionId}/grade`, { method: "PATCH", cookie: guru.cookie, body: { feedbackText: "Draft feedback", criteria } });
  assert.equal(draft.response.status, 200, JSON.stringify(draft.payload));
  assert.equal(draft.payload.data.item.status, "DRAFT");
  assert.equal(draft.payload.data.item.score, 43);
  const privateStudentDraftView = (await request(`/api/v1/siswa/tugas/${assignmentId}`, { cookie: student.cookie })).payload.data.submission;
  assert.equal(privateStudentDraftView.publishedGrade, null);
  assert.equal(Object.hasOwn(privateStudentDraftView, "grades"), false);
  const published = await request(`/api/v1/guru/submissions/${submissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: draft.payload.data.item.id } });
  assert.equal(published.response.status, 200, JSON.stringify(published.payload));
  assert.equal(published.payload.data.item.status, "PUBLISHED");
  assert.equal((await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: submissionId } })).status, "GRADED");
  ok("Guru can save a private draft grade and publish normalized rubric feedback");

  const studentResult = await request(`/api/v1/siswa/tugas/${assignmentId}`, { cookie: student.cookie });
  assert.equal(studentResult.payload.data.submission.publishedGrade.score, 43);
  const waliResult = await request(`/api/v1/wali/anak/${studentAccount.siswaId}/kelas/${kelas.id}/tugas`, { cookie: wali.cookie });
  assert.equal(waliResult.payload.data.items.find((item) => item.id === assignmentId).latestSubmission.publishedGrade.score, 43);
  const notificationBefore = await prisma.notifikasi.count({ where: { template: "assignment-grade-published", recipient: { in: [studentUser.email, waliUser.email] } } });
  const duplicatePublish = await request(`/api/v1/guru/submissions/${submissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: draft.payload.data.item.id } });
  assert.equal(duplicatePublish.response.status, 404);
  const notificationAfter = await prisma.notifikasi.count({ where: { template: "assignment-grade-published", recipient: { in: [studentUser.email, waliUser.email] } } });
  assert.ok(notificationAfter >= notificationBefore);
  ok("Published feedback is visible to Siswa/Wali and republishing is not allowed");

  const correction = await request(`/api/v1/guru/submissions/${submissionId}/grade`, { method: "PATCH", cookie: guru.cookie, body: { feedbackText: "Koreksi feedback", correctionReason: "Verifikasi ulang rekaman", criteria: criteria.map((item) => ({ ...item, score: item.score - 1 })) } });
  assert.equal(correction.response.status, 200, JSON.stringify(correction.payload));
  const correctionPublish = await request(`/api/v1/guru/submissions/${submissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: correction.payload.data.item.id } });
  assert.equal(correctionPublish.response.status, 200, JSON.stringify(correctionPublish.payload));
  assert.equal(await prisma.submissionGrade.count({ where: { submissionId, status: "REVISED" } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "SubmissionGrade", entityId: correction.payload.data.item.id, action: "SUBMISSION_GRADE_CORRECTED" } }), 1);
  ok("Grade correction requires a reason and stores before/after audit history");

  const audioAssignment = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Audio fallback ${runId}`, instructions: "Upload audio.", submissionType: "AUDIO", maxScore: 100 } });
  assert.equal(audioAssignment.response.status, 201);
  const audioAssignmentId = audioAssignment.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${audioAssignmentId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);
  const audioForm = new FormData();
  audioForm.set("version", "0");
  audioForm.set("mediaDuration", "12");
  audioForm.set("file", new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42])], "speaking.webm", { type: "audio/webm" }));
  const audioSubmit = await request(`/api/v1/siswa/tugas/${audioAssignmentId}/submit`, { method: "POST", cookie: student.cookie, body: audioForm });
  assert.equal(audioSubmit.response.status, 200, JSON.stringify(audioSubmit.payload));
  const audioFile = await prisma.assignmentSubmissionFile.findFirstOrThrow({ where: { submissionId: audioSubmit.payload.data.item.id } });
  assert.equal(audioFile.mediaDuration, 12);
  assert.ok(audioFile.checksum);
  const inlineFile = await request(`/api/v1/assignment-submissions/files/${audioFile.id}?inline=1`, { cookie: guru.cookie });
  assert.equal(inlineFile.response.status, 200);
  assert.match(inlineFile.response.headers.get("content-disposition") || "", /^inline;/);
  ok("Audio fallback upload stores duration/checksum and supports inline playback");
} finally {
  await prisma.$disconnect();
}
