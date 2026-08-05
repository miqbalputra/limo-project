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
  const studentAccount = await prisma.siswaAccount.findFirstOrThrow({ where: { loginIdentifier: "limo-dev-001", status: "ACTIVE" } });
  const kelas = await prisma.kelas.findFirstOrThrow({ where: { guruProfileId: guruUser.guruProfile.id, status: "ACTIVE", enrollments: { some: { siswaId: studentAccount.siswaId, status: "ACTIVE" } } } });
  // The seeded development class is the fixture owner for this integration test.
  // Clear prior Gradebook runs so the 50/30/20 category setup remains repeatable.
  await prisma.$transaction([
    prisma.finalGrade.deleteMany({ where: { classId: kelas.id } }),
    prisma.gradeItem.deleteMany({ where: { classId: kelas.id } }),
    prisma.gradeCategory.deleteMany({ where: { classId: kelas.id } }),
  ]);
  const exam = await prisma.ujian.findFirstOrThrow({ where: { kelasId: kelas.id, status: "PUBLISHED", results: { some: { siswaId: studentAccount.siswaId, status: { in: ["FINAL", "CORRECTED"] } } } }, select: { id: true, title: true, results: { where: { siswaId: studentAccount.siswaId, status: { in: ["FINAL", "CORRECTED"] } }, orderBy: { updatedAt: "desc" }, take: 1, select: { totalScore: true } } } });
  const examScore = Number(exam.results[0].totalScore);
  const expectedMissingScore = (80 * 50 + examScore * 20) / 70;
  const expectedCompleteScore = 80 * 0.5 + examScore * 0.2;

  const categoryA = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/categories`, { method: "POST", cookie: guru.cookie, body: { name: `Assignment ${runId}`, weight: 50, order: 0 } });
  const categoryB = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/categories`, { method: "POST", cookie: guru.cookie, body: { name: `Manual ${runId}`, weight: 30, order: 1 } });
  const categoryC = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/categories`, { method: "POST", cookie: guru.cookie, body: { name: `Exam ${runId}`, weight: 20, order: 2 } });
  assert.equal(categoryA.response.status, 201, JSON.stringify(categoryA.payload));
  assert.equal(categoryB.response.status, 201, JSON.stringify(categoryB.payload));
  assert.equal(categoryC.response.status, 201, JSON.stringify(categoryC.payload));
  const categoryIds = [categoryA.payload.data.item.id, categoryB.payload.data.item.id, categoryC.payload.data.item.id];
  for (const categoryId of categoryIds) {
    const result = await request(`/api/v1/guru/gradebook/categories/${categoryId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  }
  ok("Guru can create and publish weighted categories");

  const rubric = await request("/api/v1/guru/rubrik", { method: "POST", cookie: guru.cookie, body: { title: `Gradebook source rubric ${runId}`, scope: "PRIVATE", criteria: [{ name: "Quality", maxScore: 10, order: 0, levels: [{ label: "Basic", score: 0, order: 0 }, { label: "Good", score: 10, order: 1 }] }] } });
  assert.equal(rubric.response.status, 201, JSON.stringify(rubric.payload));
  const rubricId = rubric.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/rubrik/${rubricId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } })).response.status, 200);
  const assignment = await request(`/api/v1/guru/kelas/${kelas.id}/tugas`, { method: "POST", cookie: guru.cookie, body: { title: `Gradebook Assignment ${runId}`, instructions: "Jawaban sumber gradebook.", submissionType: "ONLINE_TEXT", maxScore: 100 } });
  assert.equal(assignment.response.status, 201, JSON.stringify(assignment.payload));
  const assignmentId = assignment.payload.data.item.id;
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}/rubric`, { method: "PATCH", cookie: guru.cookie, body: { rubricId } })).response.status, 200);
  assert.equal((await request(`/api/v1/guru/tugas/${assignmentId}/publish`, { method: "POST", cookie: guru.cookie })).response.status, 200);
  const submit = await request(`/api/v1/siswa/tugas/${assignmentId}/submit`, { method: "POST", cookie: student.cookie, body: { onlineText: "Gradebook source answer", version: 0 } });
  assert.equal(submit.response.status, 200, JSON.stringify(submit.payload));
  const submissionId = submit.payload.data.item.id;
  const gradeContext = await request(`/api/v1/guru/submissions/${submissionId}/grade`, { cookie: guru.cookie });
  const criterion = gradeContext.payload.data.rubricSnapshot.criteria[0];
  const gradeDraft = await request(`/api/v1/guru/submissions/${submissionId}/grade`, { method: "PATCH", cookie: guru.cookie, body: { feedbackText: "Sumber assignment", criteria: [{ criterionId: criterion.id, rubricLevelId: criterion.levels[1].id, score: 8, comment: "Good" }] } });
  assert.equal(gradeDraft.response.status, 200, JSON.stringify(gradeDraft.payload));
  assert.equal((await request(`/api/v1/guru/submissions/${submissionId}/grade/publish`, { method: "POST", cookie: guru.cookie, body: { gradeId: gradeDraft.payload.data.item.id } })).response.status, 200);
  ok("Published Assignment grade is available as a Gradebook source");

  const assignmentItem = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/items`, { method: "POST", cookie: guru.cookie, body: { categoryId: categoryIds[0], sourceType: "ASSIGNMENT", sourceId: assignmentId, title: "Assignment source", maxScore: 100 } });
  const manualItem = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/items`, { method: "POST", cookie: guru.cookie, body: { categoryId: categoryIds[1], sourceType: "MANUAL", title: "Manual participation", maxScore: 100 } });
  const examItem = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/items`, { method: "POST", cookie: guru.cookie, body: { categoryId: categoryIds[2], sourceType: "EXAM", sourceId: exam.id, title: exam.title, maxScore: 100 } });
  assert.equal(assignmentItem.response.status, 201, JSON.stringify(assignmentItem.payload));
  assert.equal(manualItem.response.status, 201, JSON.stringify(manualItem.payload));
  assert.equal(examItem.response.status, 201, JSON.stringify(examItem.payload));
  const itemIds = [assignmentItem.payload.data.item.id, manualItem.payload.data.item.id, examItem.payload.data.item.id];
  for (const itemId of itemIds) {
    const result = await request(`/api/v1/guru/gradebook/items/${itemId}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  }
  const firstView = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook`, { cookie: guru.cookie });
  assert.equal(firstView.response.status, 200, JSON.stringify(firstView.payload));
  const firstRow = firstView.payload.data.rows.find((row) => row.student.id === studentAccount.siswaId);
  const firstAssignmentEntry = firstRow.categories.flatMap((category) => category.items).find((item) => item.id === itemIds[0]);
  const firstExamEntry = firstRow.categories.flatMap((category) => category.items).find((item) => item.id === itemIds[2]);
  assert.equal(firstAssignmentEntry.status, "GRADED");
  assert.equal(firstAssignmentEntry.normalizedScore, 80);
  assert.equal(firstExamEntry.status, "FINAL");
  assert.equal(firstExamEntry.normalizedScore, examScore);
  assert.equal(firstRow.completionStatus, "INCOMPLETE");
  assert.ok(Math.abs(firstRow.calculatedScore - expectedMissingScore) < 0.01, `Missing item must be excluded, got ${firstRow.calculatedScore}`);
  ok("Assignment and Ujian sources synchronize automatically, while MISSING is excluded from the denominator");

  const blankEntry = await request(`/api/v1/guru/gradebook/items/${itemIds[1]}/entries`, { method: "PUT", cookie: guru.cookie, body: { studentId: studentAccount.siswaId, status: "GRADED" } });
  assert.equal(blankEntry.response.status, 400, JSON.stringify(blankEntry.payload));
  assert.equal((await request(`/api/v1/guru/gradebook/items/${itemIds[1]}`, { method: "PATCH", cookie: guru.cookie, body: { status: "LOCKED" } })).response.status, 200);
  const lockedEntry = await request(`/api/v1/guru/gradebook/items/${itemIds[1]}/entries`, { method: "PUT", cookie: guru.cookie, body: { studentId: studentAccount.siswaId, rawScore: 10, status: "GRADED" } });
  assert.equal(lockedEntry.response.status, 409, JSON.stringify(lockedEntry.payload));
  assert.equal((await request(`/api/v1/guru/gradebook/items/${itemIds[1]}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } })).response.status, 200);
  ok("Manual entries require a score and locked items reject edits");

  const zeroEntry = await request(`/api/v1/guru/gradebook/items/${itemIds[1]}/entries`, { method: "PUT", cookie: guru.cookie, body: { studentId: studentAccount.siswaId, rawScore: 0, status: "GRADED" } });
  assert.equal(zeroEntry.response.status, 200, JSON.stringify(zeroEntry.payload));
  const completeView = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook`, { cookie: guru.cookie });
  const completeRow = completeView.payload.data.rows.find((row) => row.student.id === studentAccount.siswaId);
  assert.equal(completeRow.completionStatus, "COMPLETE");
  assert.ok(Math.abs(completeRow.calculatedScore - expectedCompleteScore) < 0.01, `Zero must count in denominator, got ${completeRow.calculatedScore}`);
  const missingPublish = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/publish`, { method: "POST", cookie: guru.cookie, body: { studentIds: [studentAccount.siswaId] } });
  assert.equal(missingPublish.response.status, 200, JSON.stringify(missingPublish.payload));
  assert.equal(missingPublish.payload.data.items[0].status, "PUBLISHED");
  ok("A zero score counts, complete rows can publish, and final scores are calculated server-side");

  const studentView = await request(`/api/v1/siswa/kelas/${kelas.id}/gradebook`, { cookie: student.cookie });
  assert.equal(studentView.response.status, 200, JSON.stringify(studentView.payload));
  assert.equal(Number(studentView.payload.data.rows[0].finalGrade.publishedScore), Number(expectedCompleteScore.toFixed(2)));
  const waliView = await request(`/api/v1/wali/anak/${studentAccount.siswaId}/kelas/${kelas.id}/gradebook`, { cookie: wali.cookie });
  assert.equal(waliView.response.status, 200, JSON.stringify(waliView.payload));
  assert.equal(Number(waliView.payload.data.rows[0].finalGrade.publishedScore), Number(expectedCompleteScore.toFixed(2)));
  const forbidden = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook`, { cookie: wali.cookie });
  assert.equal(forbidden.response.status, 403);
  ok("Published final values are visible consistently to Siswa and Wali, while Guru scope remains protected");

  const remedial = await request(`/api/v1/guru/gradebook/items/${itemIds[1]}/entries`, { method: "PUT", cookie: guru.cookie, body: { studentId: studentAccount.siswaId, rawScore: 20, status: "REMEDIAL", feedbackSummary: "Remedial selesai" } });
  assert.equal(remedial.response.status, 200, JSON.stringify(remedial.payload));
  const corrected = await request(`/api/v1/guru/kelas/${kelas.id}/gradebook/publish`, { method: "POST", cookie: guru.cookie, body: { studentIds: [studentAccount.siswaId], correctionReason: "Nilai remedial sudah diverifikasi" } });
  assert.equal(corrected.response.status, 200, JSON.stringify(corrected.payload));
  assert.equal(corrected.payload.data.items[0].status, "CORRECTED");
  assert.equal(await prisma.finalGrade.count({ where: { classId: kelas.id, studentId: studentAccount.siswaId, status: "CORRECTED" } }), 1);
  ok("REMEDIAL replaces the item score and republishes the final grade with correction audit");
} finally {
  await prisma.$disconnect();
}
