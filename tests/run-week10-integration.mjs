import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const dayMs = 24 * 60 * 60 * 1000;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { method = "GET", body, cookie, headers: extraHeaders } = {}) {
  const headers = new Headers();
  if (method !== "GET") headers.set("Origin", baseUrl);
  if (cookie) headers.set("Cookie", cookie);
  for (const [name, value] of Object.entries(extraHeaders || {})) headers.set(name, value);
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
  const waliUser = await prisma.user.findUniqueOrThrow({ where: { email: "wali@limo.local" } });
  const studentUser = await prisma.user.findUniqueOrThrow({ where: { id: studentAccount.userId } });
  const kelas = await prisma.kelas.findFirstOrThrow({ where: { guruProfileId: guruUser.guruProfile.id, status: "ACTIVE", enrollments: { some: { siswaId: studentAccount.siswaId, status: "ACTIVE" } } } });

  await prisma.$transaction([
    prisma.finalGrade.deleteMany({ where: { classId: kelas.id } }),
    prisma.gradeItem.deleteMany({ where: { classId: kelas.id } }),
    prisma.gradeCategory.deleteMany({ where: { classId: kelas.id } }),
  ]);

  const rubric = await request("/api/v1/guru/rubrik", { method: "POST", cookie: guru.cookie, body: { title: `Remedial rubric ${runId}`, scope: "PRIVATE", criteria: [{ name: "Quality", maxScore: 10, order: 0, levels: [{ label: "Needs work", score: 0, order: 0 }, { label: "Excellent", score: 10, order: 1 }] }] } });
  assert.equal(rubric.response.status, 201, JSON.stringify(rubric.payload));
  const rubricId = rubric.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/rubrik/${rubricId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } })).response.status, 200);

  const assignment = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Remedial source ${runId}`, instructions: "Jawaban sumber remedial.", submissionType: "ONLINE_TEXT", maxScore: 100, maxAttempts: 1, allowResubmission: false } });
  assert.equal(assignment.response.status, 201, JSON.stringify(assignment.payload));
  const assignmentId = assignment.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}/rubric`, { method: "PATCH", cookie: guru.cookie, body: { rubricId } })).response.status, 200);
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);

  const originalSubmit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "Jawaban awal", version: 0 } });
   assert.equal(originalSubmit.response.status, 200, JSON.stringify(originalSubmit.payload));
   const originalSubmissionId = originalSubmit.payload.data.item.id;
   assert.equal(originalSubmit.payload.data.item.attemptNumber, 1);
  const originalContext = await request(`/api/v1/guru/submissions/${originalSubmissionId}/grade`, { cookie: guru.cookie });
  const originalCriterion = originalContext.payload.data.rubricSnapshot.criteria[0];
  const originalDraft = await request(`/api/v1/guru/submissions/${originalSubmissionId}/grade`, { method: "PATCH", cookie: guru.cookie, body: { criteria: [{ criterionId: originalCriterion.id, rubricLevelId: originalCriterion.levels[1].id, score: 4, comment: "Perlu perbaikan" }] } });
  assert.equal(originalDraft.response.status, 200, JSON.stringify(originalDraft.payload));
  assert.equal((await request(`/api/v1/guru/submissions/${originalSubmissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: originalDraft.payload.data.item.id } })).response.status, 200);
  ok("Guru can publish an original assignment grade before remedial or revision");

  const revision = await request(`/api/v1/guru/submissions/${originalSubmissionId}/revision`, { method: "POST", cookie: guru.cookie, body: { reason: "Nilai belum memenuhi target", instructions: "Perbaiki jawaban dengan contoh yang lebih lengkap.", dueAt: new Date(Date.now() + 3 * dayMs).toISOString() } });
  assert.equal(revision.response.status, 201, JSON.stringify(revision.payload));
  const revisionId = revision.payload.data.item.id;
  assert.equal((await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: originalSubmissionId } })).status, "NEEDS_REVISION");
  assert.equal(await prisma.assignmentRevisionRequest.count({ where: { id: revisionId, status: "OPEN" } }), 1);
  assert.ok(await prisma.notifikasi.findFirst({ where: { template: "assignment-revision-requested", recipient: studentUser.email } }));

  const revisionView = await request(`/api/v1/siswa/tugas/${assignmentId}`, { cookie: student.cookie });
  assert.equal(revisionView.response.status, 200, JSON.stringify(revisionView.payload));
  assert.equal(revisionView.payload.data.revisionRequest.id, revisionId);
  assert.equal(revisionView.payload.data.submission.status, "DRAFT");
  const revisionSubmit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "Jawaban revisi", version: revisionView.payload.data.submission.version } });
   assert.equal(revisionSubmit.response.status, 200, JSON.stringify(revisionSubmit.payload));
   const revisionSubmissionId = revisionSubmit.payload.data.item.id;
   assert.equal(revisionSubmit.payload.data.item.attemptNumber, 2);
  assert.equal(await prisma.assignmentRevisionRequest.count({ where: { id: revisionId, status: "SUBMITTED" } }), 1);
  ok("Guru can request revision and Siswa reuses the existing assignment submission flow");

  const revisionGradeContext = await request(`/api/v1/guru/submissions/${revisionSubmissionId}/grade`, { cookie: guru.cookie });
  const revisionCriterion = revisionGradeContext.payload.data.rubricSnapshot.criteria[0];
  const revisionDraft = await request(`/api/v1/guru/submissions/${revisionSubmissionId}/grade`, { method: "PATCH", cookie: guru.cookie, body: { criteria: [{ criterionId: revisionCriterion.id, rubricLevelId: revisionCriterion.levels[1].id, score: 7, comment: "Sudah membaik" }] } });
  assert.equal(revisionDraft.response.status, 200, JSON.stringify(revisionDraft.payload));
  assert.equal((await request(`/api/v1/guru/submissions/${revisionSubmissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: revisionDraft.payload.data.item.id } })).response.status, 200);
  assert.equal(await prisma.assignmentRevisionRequest.count({ where: { id: revisionId, status: "COMPLETED" } }), 1);
  ok("Published revision completes the request without deleting the original attempt");

  const category = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/categories`, { method: "POST", cookie: guru.cookie, body: { name: `Remedial category ${runId}`, weight: 100, order: 0 } });
  assert.equal(category.response.status, 201, JSON.stringify(category.payload));
  const categoryId = category.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/gradebook/categories/${categoryId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED", confirmPublishedChange: true } })).response.status, 200);
  const gradeItem = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/items`, { method: "POST", cookie: guru.cookie, body: { categoryId, sourceType: "ASSIGNMENT", sourceId: assignmentId, title: "Remedial source", maxScore: 100 } });
  assert.equal(gradeItem.response.status, 201, JSON.stringify(gradeItem.payload));
  const gradeItemId = gradeItem.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/gradebook/items/${gradeItemId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED", confirmPublishedChange: true } })).response.status, 200);
  const beforeRemedial = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook`, { cookie: guru.cookie });
  const beforeEntry = beforeRemedial.payload.data.rows.find((row) => row.student.id === studentAccount.siswaId).categories.flatMap((row) => row.items).find((item) => item.id === gradeItemId);
   assert.equal(beforeEntry.normalizedScore, 40);

  const dueAt = new Date(Date.now() + 2 * dayMs).toISOString();
  const remedial = await request(`/api/v1/guru/kelas/${kelas.id}/remedial`, { method: "POST", cookie: guru.cookie, body: { sourceType: "ASSIGNMENT", sourceId: assignmentId, title: `Remedial ${runId}`, instructions: "Kerjakan ulang bagian yang belum tuntas.", dueAt, scorePolicy: "HIGHEST", status: "PUBLISHED", participants: [{ studentId: studentAccount.siswaId, reason: "Target nilai belum tercapai" }] } });
  assert.equal(remedial.response.status, 201, JSON.stringify(remedial.payload));
  const participantId = remedial.payload.data.item.participants[0].id;
  assert.equal((await request("/api/v1/siswa/remedial", { cookie: student.cookie })).payload.data.items.some((item) => item.id === participantId), true);
  assert.equal((await request(`/api/v1/wali/anak/${studentAccount.siswaId}/kelas/${kelas.id}/remedial`, { cookie: wali.cookie })).payload.data.items.some((item) => item.id === participantId), true);
  assert.ok(await prisma.notifikasi.findFirst({ where: { template: "remedial-assigned", recipient: studentUser.email } }));
  ok("Published remedial is visible only to its assigned Siswa and Wali");

  const remedialView = await request(`/api/v1/siswa/tugas/${assignmentId}?remedialId=${participantId}`, { cookie: student.cookie });
  assert.equal(remedialView.response.status, 200, JSON.stringify(remedialView.payload));
  assert.equal(remedialView.payload.data.remedial.participantId, participantId);
  const remedialSubmit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "Jawaban remedial", version: remedialView.payload.data.submission.version, remedialId: participantId } });
   assert.equal(remedialSubmit.response.status, 200, JSON.stringify(remedialSubmit.payload));
   const remedialSubmissionId = remedialSubmit.payload.data.item.id;
   assert.equal(remedialSubmit.payload.data.item.attemptNumber, 3);
   assert.equal(await prisma.assignmentSubmission.count({ where: { id: remedialSubmissionId, remedialParticipantId: participantId } }), 1);
   const remedialReload = await request(`/api/v1/siswa/tugas/${assignmentId}?remedialId=${participantId}`, { cookie: student.cookie });
   assert.equal(remedialReload.payload.data.submission.id, remedialSubmissionId);
   assert.equal(await prisma.assignmentSubmission.count({ where: { remedialParticipantId: participantId } }), 1);
   assert.equal((await request(`/api/v1/guru/submissions/${remedialSubmissionId}/revision`, { method: "POST", cookie: guru.cookie, body: { reason: "Tidak boleh nested" } })).response.status, 409);

  const remedialGradeContext = await request(`/api/v1/guru/submissions/${remedialSubmissionId}/grade`, { cookie: guru.cookie });
  const remedialCriterion = remedialGradeContext.payload.data.rubricSnapshot.criteria[0];
  const remedialDraft = await request(`/api/v1/guru/submissions/${remedialSubmissionId}/grade`, { method: "PATCH", cookie: guru.cookie, body: { criteria: [{ criterionId: remedialCriterion.id, rubricLevelId: remedialCriterion.levels[1].id, score: 9, comment: "Target tercapai" }] } });
  assert.equal(remedialDraft.response.status, 200, JSON.stringify(remedialDraft.payload));
  assert.equal((await request(`/api/v1/guru/submissions/${remedialSubmissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: remedialDraft.payload.data.item.id } })).response.status, 200);

   const participant = await prisma.remedialParticipant.findUniqueOrThrow({ where: { id: participantId } });
   assert.equal(participant.status, "COMPLETED");
   assert.equal(Number(participant.originalScore), 40);
   assert.equal(participant.originalSubmissionId, originalSubmissionId);
  assert.equal(Number(participant.remedialScore), 90);
  assert.equal(Number(participant.effectiveScore), 90);
  const afterRemedial = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook`, { cookie: guru.cookie });
  const afterEntry = afterRemedial.payload.data.rows.find((row) => row.student.id === studentAccount.siswaId).categories.flatMap((row) => row.items).find((item) => item.id === gradeItemId);
   assert.equal(afterEntry.status, "REMEDIAL");
   assert.equal(afterEntry.normalizedScore, 90);
   const originalCorrection = await request(`/api/v1/guru/submissions/${originalSubmissionId}/grade`, { method: "PATCH", cookie: guru.cookie, body: { criteria: [{ criterionId: originalCriterion.id, rubricLevelId: originalCriterion.levels[0].id, score: 2, comment: "Koreksi histori" }], correctionReason: "Koreksi nilai original" } });
   assert.equal(originalCorrection.response.status, 200, JSON.stringify(originalCorrection.payload));
   assert.equal((await request(`/api/v1/guru/submissions/${originalSubmissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: originalCorrection.payload.data.item.id } })).response.status, 200);
   const afterOriginalCorrection = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook`, { cookie: guru.cookie });
   const correctedEntry = afterOriginalCorrection.payload.data.rows.find((row) => row.student.id === studentAccount.siswaId).categories.flatMap((row) => row.items).find((item) => item.id === gradeItemId);
   assert.equal(correctedEntry.normalizedScore, 90);
   ok("Remedial score policy updates Gradebook while preserving the original score history");

  const pendingDueAt = new Date(Date.now() + 2 * dayMs).toISOString();
   const pendingIdempotencyKey = `week10-${runId}`;
   const pendingBody = { sourceType: "ASSIGNMENT", sourceId: assignmentId, title: `Pending reminder remedial ${runId}`, instructions: "Reminder fixture.", dueAt: pendingDueAt, scorePolicy: "LATEST", status: "PUBLISHED", participants: [{ studentId: studentAccount.siswaId, reason: "Reminder fixture" }] };
   const pendingRemedial = await request(`/api/v1/guru/kelas/${kelas.id}/remedial`, { method: "POST", cookie: guru.cookie, headers: { "Idempotency-Key": pendingIdempotencyKey }, body: pendingBody });
   assert.equal(pendingRemedial.response.status, 201, JSON.stringify(pendingRemedial.payload));
   const pendingRetry = await request(`/api/v1/guru/kelas/${kelas.id}/remedial`, { method: "POST", cookie: guru.cookie, headers: { "Idempotency-Key": pendingIdempotencyKey }, body: pendingBody });
   assert.equal(pendingRetry.payload.data.item.id, pendingRemedial.payload.data.item.id);
   assert.equal(await prisma.remedialAssignment.count({ where: { idempotencyKey: pendingIdempotencyKey } }), 1);
  const pendingRemedialId = pendingRemedial.payload.data.item.id;

  const from = new Date(Date.now() - dayMs).toISOString();
  const to = new Date(Date.now() + 4 * dayMs).toISOString();
  const calendar = await request(`/api/v1/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cookie: student.cookie });
  assert.equal(calendar.response.status, 200, JSON.stringify(calendar.payload));
  assert.equal(calendar.payload.data.events.some((event) => event.eventType === "REMEDIAL_DUE" && event.sourceId === pendingRemedialId), true);
  const { sendDeadlineReminders } = await import("../src/server/services/reminder-service.ts");
  const reminderNow = new Date(new Date(pendingDueAt).getTime() - dayMs);
  const reminder = await sendDeadlineReminders({ now: reminderNow });
  assert.ok(reminder.created >= 1);
  const reminderAgain = await sendDeadlineReminders({ now: reminderNow });
  assert.equal(reminderAgain.created, 0);
  const remedialReminderNotifications = await prisma.notifikasi.findMany({ where: { template: "deadline-reminder", recipient: { in: [studentUser.email, waliUser.email] } }, select: { metadata: true } });
  assert.equal(remedialReminderNotifications.some((item) => JSON.stringify(item.metadata).includes("RemedialAssignment")), true);
  ok("Remedial deadline appears in calendar and reminder delivery is idempotent");
} finally {
  await prisma.$disconnect();
}
