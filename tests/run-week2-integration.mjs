import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

async function request(path, { method = "GET", body, cookie, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  if (method !== "GET") requestHeaders.set("Origin", origin);
  if (cookie) requestHeaders.set("Cookie", cookie);
  if (body !== undefined && !(body instanceof FormData)) requestHeaders.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(email, password = "password-dev-only") {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.response.status, 200, `Login failed for ${email}: ${JSON.stringify(result.payload)}`);
  const setCookie = result.response.headers.get("set-cookie") || "";
  return { ...result, cookie: setCookie.split(";")[0] };
}

function ok(label) {
  console.log(`ok - ${label}`);
}

try {
  const guru = await login("guru@limo.local");
  const wali = await login("wali@limo.local");

  const kelas = await prisma.kelas.findFirstOrThrow({
    where: { guruProfile: { user: { email: "guru@limo.local" } } },
    select: { id: true, programId: true, levelId: true, guruProfileId: true },
  });
  const enrollment = await prisma.kelasSiswa.findFirstOrThrow({
    where: { kelasId: kelas.id, status: "ACTIVE", siswa: { waliRelations: { some: { waliProfile: { user: { email: "wali@limo.local" } } } } } },
    select: { siswaId: true },
  });

  const directRppTitle = `Week2 Form RPP ${runId}`;
  const directRppForm = new FormData();
  directRppForm.set("kelasId", kelas.id);
  directRppForm.set("mode", "FORM");
  directRppForm.set("title", directRppTitle);
  directRppForm.set("planDate", "2026-08-05");
  directRppForm.set("meetingNumber", "1");
  directRppForm.set("topic", "Daily routines");
  directRppForm.set("difficulty", "Sedang");
  directRppForm.set("learningObjectives", "Murid memahami kosakata kegiatan harian");
  directRppForm.set("materials", "Kartu kosakata dan papan tulis");
  directRppForm.set("activities", "Pembukaan, latihan inti, dan refleksi penutup");
  directRppForm.set("assessment", "Observasi penggunaan kosakata");
  directRppForm.set("durationMinutes", "45");
  const directRpp = await request("/api/v1/guru/rpp", { method: "POST", cookie: guru.cookie, body: directRppForm });
  assert.equal(directRpp.response.status, 201, JSON.stringify(directRpp.payload));
  assert.equal(directRpp.payload.data.item.mode, "FORM");
  ok("Guru can create a direct-form RPP draft");

  const uploadRppTitle = `Week2 Upload RPP ${runId}`;
  const uploadRppForm = new FormData();
  uploadRppForm.set("kelasId", kelas.id);
  uploadRppForm.set("mode", "FILE");
  uploadRppForm.set("title", uploadRppTitle);
  uploadRppForm.set("planDate", "2026-08-06");
  uploadRppForm.set("topic", "Animals");
  uploadRppForm.set("difficulty", "Mudah");
  uploadRppForm.set("file", new File(["%PDF-1.7\nWeek2 RPP"], "week2-rpp.pdf", { type: "application/pdf" }));
  const uploadRpp = await request("/api/v1/guru/rpp", { method: "POST", cookie: guru.cookie, body: uploadRppForm });
  assert.equal(uploadRpp.response.status, 201, JSON.stringify(uploadRpp.payload));
  assert.equal(uploadRpp.payload.data.item.mode, "FILE");
  const uploadRppFile = await prisma.fileAsset.findFirstOrThrow({ where: { rppId: uploadRpp.payload.data.item.id, deletedAt: null }, select: { id: true, originalName: true, storagePath: true, mimeType: true, sizeBytes: true, checksumSha256: true } });
  ok("Guru can create an upload-mode RPP with a private PDF");

  const publishedDirectRpp = await request(`/api/v1/guru/rpp/${directRpp.payload.data.item.id}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } });
  assert.equal(publishedDirectRpp.response.status, 200, JSON.stringify(publishedDirectRpp.payload));
  const publishedUploadRpp = await request(`/api/v1/guru/rpp/${uploadRpp.payload.data.item.id}`, { method: "PATCH", cookie: guru.cookie, body: { status: "PUBLISHED" } });
  assert.equal(publishedUploadRpp.response.status, 200, JSON.stringify(publishedUploadRpp.payload));
  const waliRppPage = await request("/wali/rpp", { cookie: wali.cookie });
  assert.equal(waliRppPage.response.status, 200);
  assert.match(String(waliRppPage.payload), new RegExp(directRppTitle));
  assert.match(String(waliRppPage.payload), new RegExp(uploadRppTitle));
  const waliRppFile = await request(`/api/v1/files/${uploadRppFile.id}`, { cookie: wali.cookie });
  assert.equal(waliRppFile.response.status, 200, JSON.stringify(waliRppFile.payload));
  assert.match(String(waliRppFile.payload), /%PDF-1\.7/);
  ok("Published RPPs are visible to the enrolled Wali and its PDF remains private");

  const foreignClass = await prisma.kelas.create({ data: { name: `Week2 RPP Foreign ${runId}`, programId: kelas.programId, levelId: kelas.levelId, guruProfileId: kelas.guruProfileId } });
  const foreignRpp = await prisma.rpp.create({
    data: {
      kelasId: foreignClass.id,
      createdById: guru.payload.data.actor.id,
      mode: "FILE",
      status: "PUBLISHED",
      title: `Week2 Foreign RPP ${runId}`,
      planDate: new Date("2026-08-07T00:00:00.000Z"),
      topic: "Foreign class",
      learningObjectives: "",
      materials: "",
      difficulty: "Mudah",
      activities: "",
      assessment: "",
    },
    select: { id: true, title: true },
  });
  const foreignRppFile = await prisma.fileAsset.create({
    data: {
      ownerType: "RPP",
      ownerId: foreignRpp.id,
      rppId: foreignRpp.id,
      originalName: "foreign-rpp.pdf",
      storedName: `foreign-${runId}.pdf`,
      storagePath: uploadRppFile.storagePath,
      mimeType: uploadRppFile.mimeType,
      sizeBytes: uploadRppFile.sizeBytes,
      checksumSha256: uploadRppFile.checksumSha256,
      visibility: "PRIVATE",
      uploadedById: guru.payload.data.actor.id,
    },
    select: { id: true },
  });
  const foreignRppAccess = await request(`/api/v1/files/${foreignRppFile.id}`, { cookie: wali.cookie });
  assert.equal(foreignRppAccess.response.status, 403, JSON.stringify(foreignRppAccess.payload));
  const foreignRppPage = await request("/wali/rpp", { cookie: wali.cookie });
  assert.doesNotMatch(String(foreignRppPage.payload), new RegExp(foreignRpp.title));
  ok("Wali cannot list or download an RPP from a class without an active enrollment");

  const materialTitle = `PDF Materi Week2 ${runId}`;
  const material = await request(`/api/v1/guru/kelas/${kelas.id}/materi`, {
    method: "POST",
    cookie: guru.cookie,
    body: {
      title: materialTitle,
      type: "PDF",
      status: "PUBLISHED",
      order: 7,
    },
  });
  assert.equal(material.response.status, 201, JSON.stringify(material.payload));
  const materialList = await request(`/api/v1/guru/kelas/${kelas.id}/materi`, { cookie: guru.cookie });
  assert.equal(materialList.response.status, 200);
  assert.equal(materialList.payload.data.items.some((item) => item.title === materialTitle && item.type === "PDF"), true);
  const pagedMaterialList = await request(`/api/v1/guru/kelas/${kelas.id}/materi?page=1&pageSize=1`, { cookie: guru.cookie });
  assert.equal(pagedMaterialList.response.status, 200);
  assert.equal(pagedMaterialList.payload.data.pagination.pageSize, 1);
  assert.ok(pagedMaterialList.payload.data.pagination.totalItems >= 1);
  ok("LMS materi accepts categorized PDF material");

  const archivedMaterial = await request(`/api/v1/guru/materi/${material.payload.data.item.id}`, { method: "PATCH", cookie: guru.cookie, body: { status: "ARCHIVED" } });
  assert.equal(archivedMaterial.response.status, 200, JSON.stringify(archivedMaterial.payload));
  assert.equal(archivedMaterial.payload.data.item.status, "ARCHIVED");
  const restoredMaterial = await request(`/api/v1/guru/materi/${material.payload.data.item.id}`, { method: "PATCH", cookie: guru.cookie, body: { status: "DRAFT" } });
  assert.equal(restoredMaterial.response.status, 200, JSON.stringify(restoredMaterial.payload));
  assert.equal(restoredMaterial.payload.data.item.status, "DRAFT");
  ok("Guru can publish, archive, and restore material lifecycle state");

  const uploadForm = new FormData();
  uploadForm.append("file", new Blob(["%PDF-1.7"], { type: "application/pdf" }), "week2.pdf");
  const csrfUpload = await fetch(`${baseUrl}/api/v1/guru/materi/${material.payload.data.item.id}/files`, { method: "POST", headers: { Cookie: guru.cookie }, body: uploadForm });
  assert.equal(csrfUpload.status, 403);
  ok("Materi upload rejects requests without a same-origin header");

  const questionText = `Week2 auto scoring question ${runId}`;
  const question = await request("/api/v1/bank-soal", {
    method: "POST",
    cookie: guru.cookie,
    body: {
      kelasId: kelas.id,
      type: "PILIHAN_GANDA",
      question: questionText,
      options: [
        { label: "A", content: "Correct", isCorrect: true },
        { label: "B", content: "Wrong", isCorrect: false },
      ],
    },
  });
  assert.equal(question.response.status, 201, JSON.stringify(question.payload));
  const bankSoalId = question.payload.data.item.id;
  const pagedQuestionList = await request("/api/v1/bank-soal?page=1&pageSize=1", { cookie: guru.cookie });
  assert.equal(pagedQuestionList.response.status, 200);
  assert.equal(pagedQuestionList.payload.data.pagination.pageSize, 1);
  assert.ok(pagedQuestionList.payload.data.pagination.totalItems >= 1);
  ok("Bank soal stores structured multiple choice questions");

  const examTitle = `Week2 Timed Exam ${runId}`;
  const exam = await request("/api/v1/ujian", {
    method: "POST",
    cookie: guru.cookie,
    body: {
      kelasId: kelas.id,
      title: examTitle,
      status: "PUBLISHED",
      deliveryMode: "ONLINE_VIA_WALI",
      examDate: "2026-08-01",
      durationMinutes: 45,
      questions: [{ bankSoalId, weight: 10 }],
    },
  });
  assert.equal(exam.response.status, 201, JSON.stringify(exam.payload));
  const examList = await request("/api/v1/ujian", { cookie: guru.cookie });
  assert.equal(examList.response.status, 200);
  const createdExam = examList.payload.data.items.find((item) => item.title === examTitle);
  assert.equal(createdExam.durationMinutes, 45);
  assert.equal(createdExam.questions.length, 1);
  const pagedExamList = await request("/api/v1/ujian?page=1&pageSize=1", { cookie: guru.cookie });
  assert.equal(pagedExamList.response.status, 200);
  assert.equal(pagedExamList.payload.data.pagination.pageSize, 1);
  assert.ok(pagedExamList.payload.data.pagination.totalItems >= 1);
  ok("Ujian stores timer duration and selected questions");

  const archivedExam = await request(`/api/v1/ujian/${createdExam.id}/status`, { method: "PATCH", cookie: guru.cookie, body: { status: "ARCHIVED" } });
  assert.equal(archivedExam.response.status, 200, JSON.stringify(archivedExam.payload));
  assert.equal(archivedExam.payload.data.item.status, "ARCHIVED");
  const restoredExam = await request(`/api/v1/ujian/${createdExam.id}/status`, { method: "PATCH", cookie: guru.cookie, body: { status: "DRAFT" } });
  assert.equal(restoredExam.response.status, 200, JSON.stringify(restoredExam.payload));
  assert.equal(restoredExam.payload.data.item.status, "DRAFT");
  ok("Guru can publish, archive, and restore exam lifecycle state");

  const duplicate = await request(`/api/v1/ujian/${createdExam.id}/duplicate`, { method: "POST", cookie: guru.cookie, body: {} });
  assert.equal(duplicate.response.status, 201, JSON.stringify(duplicate.payload));
  assert.equal(duplicate.payload.data.item.status, "DRAFT");
  assert.match(duplicate.payload.data.item.title, /\(Template\)$/);
  assert.equal(duplicate.payload.data.item.questionCount, 1);
  const duplicateAudit = await prisma.auditLog.findFirst({ where: { action: "UJIAN_DUPLICATED", entityId: duplicate.payload.data.item.id }, orderBy: { createdAt: "desc" }, select: { metadata: true } });
  assert.equal(duplicateAudit?.metadata?.sourceUjianId, createdExam.id);
  ok("Guru can duplicate an exam as a draft template");

  const forbiddenDuplicate = await request(`/api/v1/ujian/${createdExam.id}/duplicate`, { method: "POST", cookie: wali.cookie, body: {} });
  assert.equal(forbiddenDuplicate.response.status, 403, JSON.stringify(forbiddenDuplicate.payload));
  ok("Wali cannot duplicate a Guru exam");

  const publishedNotifications = await prisma.notifikasi.findMany({ where: { template: "online-exam-published", recipient: "wali@limo.local" }, orderBy: { createdAt: "desc" }, select: { id: true, metadata: true } });
  const publishedNotification = publishedNotifications.find((notification) => notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata) && notification.metadata.ujianId === createdExam.id);
  assert.ok(publishedNotification);
  ok("Published online exam creates a Wali task notification");

  const result = await request("/api/v1/hasil-ujian", {
    method: "POST",
    cookie: guru.cookie,
    body: {
      ujianId: createdExam.id,
      siswaId: enrollment.siswaId,
      answers: [{ ujianSoalId: createdExam.questions[0].id, selectedOption: "A" }],
    },
  });
   assert.equal(result.response.status, 201, JSON.stringify(result.payload));
   assert.equal(Number(result.payload.data.item.totalScore), 100);
   assert.equal(result.payload.data.item.status, "FINAL");
   const pagedResults = await request(`/api/v1/hasil-ujian?ujianId=${createdExam.id}&page=1&pageSize=1`, { cookie: guru.cookie });
   assert.equal(pagedResults.response.status, 200);
   assert.equal(pagedResults.payload.data.pagination.pageSize, 1);
   assert.equal(pagedResults.payload.data.items.length, 1);
   ok("Pilihan ganda is auto-scored into final exam history");

   const lockedResult = await request("/api/v1/hasil-ujian", {
     method: "POST",
     cookie: guru.cookie,
     body: {
       ujianId: createdExam.id,
       siswaId: enrollment.siswaId,
       answers: [{ ujianSoalId: createdExam.questions[0].id, selectedOption: "B" }],
     },
   });
   assert.equal(lockedResult.response.status, 409, JSON.stringify(lockedResult.payload));
   ok("Final exam result cannot be overwritten through the normal input flow");

   const correction = await request(`/api/v1/hasil-ujian/${result.payload.data.item.id}/correction`, {
     method: "POST",
     cookie: guru.cookie,
     body: {
       reason: "Kunci jawaban perlu diperbaiki",
       answers: [{ ujianSoalId: createdExam.questions[0].id, selectedOption: "B" }],
     },
   });
   assert.equal(correction.response.status, 200, JSON.stringify(correction.payload));
   assert.equal(correction.payload.data.item.status, "CORRECTED");
   assert.equal(Number(correction.payload.data.item.totalScore), 0);
   const correctionAudit = await prisma.auditLog.findFirst({ where: { action: "HASIL_UJIAN_CORRECTED", entityId: result.payload.data.item.id }, orderBy: { createdAt: "desc" }, select: { reason: true, metadata: true } });
   assert.equal(correctionAudit?.reason, "Kunci jawaban perlu diperbaiki");
   assert.equal(correctionAudit?.metadata?.afterStatus, "CORRECTED");
   ok("Teacher correction stores before/after audit metadata");

   const lockedAfterCorrection = await request("/api/v1/hasil-ujian", {
     method: "POST",
     cookie: guru.cookie,
     body: {
       ujianId: createdExam.id,
       siswaId: enrollment.siswaId,
       answers: [{ ujianSoalId: createdExam.questions[0].id, selectedOption: "A" }],
     },
   });
   assert.equal(lockedAfterCorrection.response.status, 409, JSON.stringify(lockedAfterCorrection.payload));
   ok("Corrected exam result remains locked from normal input");

  const resultNotification = await prisma.notifikasi.findFirst({ where: { template: "exam-result-updated", recipient: "wali@limo.local" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  assert.ok(resultNotification);
  ok("Final exam result creates a Wali notification");

  const waliNilai = await request("/wali/nilai", { cookie: wali.cookie });
  assert.equal(waliNilai.response.status, 200);
  assert.match(String(waliNilai.payload), new RegExp(examTitle));
  ok("Wali can view exam score history");
} finally {
  await prisma.$disconnect();
}
