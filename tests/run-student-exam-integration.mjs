import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;

async function request(path, { method = "GET", body, cookie } = {}) {
  const headers = new Headers();
  if (method !== "GET") headers.set("Origin", origin);
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function requestForm(path, { formData, cookie } = {}) {
  const headers = new Headers();
  headers.set("Origin", origin);
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers, body: formData, redirect: "manual" });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(email, password = "password-dev-only") {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.response.status, 200, `Login gagal untuk ${email}: ${JSON.stringify(result.payload)}`);
  return (result.response.headers.get("set-cookie") || "").split(";")[0];
}

function ok(label) {
  console.log(`ok - ${label}`);
}

const createdUjianIds = [];
const createdBankSoalIds = [];
const createdMediaIds = [];

async function createExam({ kelasId, deliveryMode, maxAttempts = 1, answerKey = "A", showResultToSiswa = true, label = deliveryMode }) {
  const bankSoal = await prisma.bankSoal.create({
    data: {
      kelasId,
      type: "PILIHAN_GANDA",
      question: `Soal integrasi (${label})`,
      expectedAnswer: answerKey,
      options: {
        create: [
          { label: "A", content: "Jawaban benar", isCorrect: answerKey === "A", order: 0 },
          { label: "B", content: "Jawaban salah", isCorrect: false, order: 1 },
        ],
      },
    },
    select: { id: true },
  });
  createdBankSoalIds.push(bankSoal.id);

  const ujian = await prisma.ujian.create({
    data: {
      kelasId,
      title: `Ujian Mandiri Siswa (${label})`,
      status: "PUBLISHED",
      deliveryMode,
      durationMinutes: 30,
      maxAttempts,
      showResultToWali: true,
      showResultToSiswa,
      questions: { create: [{ bankSoalId: bankSoal.id, order: 0, weight: 1, required: true }] },
    },
    select: { id: true, questions: { select: { id: true } } },
  });
  createdUjianIds.push(ujian.id);

  return { ujianId: ujian.id, ujianSoalId: ujian.questions[0].id };
}

async function createUploadExam({ kelasId }) {
  const bankSoal = await prisma.bankSoal.create({
    data: { kelasId, type: "FILE_UPLOAD", question: "Unggah berkas jawaban", options: { create: [] } },
    select: { id: true },
  });
  createdBankSoalIds.push(bankSoal.id);

  const ujian = await prisma.ujian.create({
    data: {
      kelasId,
      title: "Ujian Unggah Berkas (integrasi)",
      status: "PUBLISHED",
      deliveryMode: "ONLINE_VIA_SISWA",
      durationMinutes: 30,
      maxAttempts: 1,
      questions: { create: [{ bankSoalId: bankSoal.id, order: 0, weight: 1, required: true }] },
    },
    select: { id: true, questions: { select: { id: true } } },
  });
  createdUjianIds.push(ujian.id);

  return { ujianId: ujian.id, ujianSoalId: ujian.questions[0].id };
}

async function cleanup() {
  for (const ujianId of createdUjianIds) {
    await prisma.hasilUjian.deleteMany({ where: { ujianId } }).catch(() => undefined);
    await prisma.ujian.delete({ where: { id: ujianId } }).catch(() => undefined);
  }
  for (const bankSoalId of createdBankSoalIds) {
    await prisma.bankSoal.delete({ where: { id: bankSoalId } }).catch(() => undefined);
  }
  for (const mediaId of createdMediaIds) {
    const media = await prisma.quizMedia.findUnique({ where: { id: mediaId }, select: { storagePath: true } }).catch(() => null);
    await prisma.quizMedia.delete({ where: { id: mediaId } }).catch(() => undefined);
    if (media?.storagePath) await unlink(media.storagePath).catch(() => undefined);
  }
}

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const studentCookie = await login("siswa@limo.local");
  const waliCookie = await login("wali@limo.local");
  const guruCookie = await login("guru@limo.local");

  const studentUser = await prisma.user.findUnique({
    where: { email: "siswa@limo.local" },
    select: { id: true, siswaAccount: { select: { siswaId: true } } },
  });
  assert.ok(studentUser?.siswaAccount, "Akun siswa seed harus tersedia");

  const siswaId = studentUser.siswaAccount.siswaId;
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId, status: "ACTIVE" }, select: { kelasId: true }, orderBy: { createdAt: "asc" } });
  assert.ok(enrollment, "Siswa harus memiliki minimal satu kelas aktif");

  const selfExam = await createExam({ kelasId: enrollment.kelasId, deliveryMode: "ONLINE_VIA_SISWA" });
  const bothExam = await createExam({ kelasId: enrollment.kelasId, deliveryMode: "BOTH", maxAttempts: 2 });
  const teacherExam = await createExam({ kelasId: enrollment.kelasId, deliveryMode: "TEACHER_ENTRY" });
  const hiddenExam = await createExam({ kelasId: enrollment.kelasId, deliveryMode: "ONLINE_VIA_SISWA", label: "SISWA-nilai-tertahan", showResultToSiswa: false });
  const uploadExam = await createUploadExam({ kelasId: enrollment.kelasId });

  const list = await request("/api/v1/siswa/ujian", { cookie: studentCookie });
  assert.equal(list.response.status, 200, JSON.stringify(list.payload));
  const listedIds = list.payload.data.exams.map((exam) => exam.id);
  assert.ok(listedIds.includes(selfExam.ujianId), "Ujian ONLINE_VIA_SISWA harus tampil di daftar siswa");
  assert.ok(listedIds.includes(bothExam.ujianId), "Ujian BOTH harus tampil di daftar siswa");
  assert.ok(!listedIds.includes(teacherExam.ujianId), "Ujian TEACHER_ENTRY tidak boleh tampil di daftar siswa");
  ok("Daftar ujian siswa hanya memuat mode daring yang relevan");

  const blockedStart = await request(`/api/v1/siswa/ujian/${teacherExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(blockedStart.response.status, 404, "Ujian TEACHER_ENTRY tidak boleh dimulai siswa");
  ok("Ujian mode input guru ditolak untuk siswa (404)");

  const started = await request(`/api/v1/siswa/ujian/${selfExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(started.response.status, 201, JSON.stringify(started.payload));
  const attemptId = started.payload.data.attemptId;
  assert.ok(attemptId, "Attempt id harus dikembalikan");

  const resumed = await request(`/api/v1/siswa/ujian/${selfExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(resumed.payload.data.attemptId, attemptId, "Mulai ulang harus melanjutkan attempt yang sama");
  ok("Siswa dapat memulai dan melanjutkan attempt sendiri");

  const listPage = await request("/siswa/ujian", { cookie: studentCookie });
  assert.equal(listPage.response.status, 200, "Halaman daftar ujian siswa harus 200");
  assert.match(String(listPage.payload), /Ujian Saya/);
  const instructionPage = await request(`/siswa/ujian/${selfExam.ujianId}`, { cookie: studentCookie });
  assert.equal(instructionPage.response.status, 200, "Halaman instruksi ujian siswa harus 200");
  assert.match(String(instructionPage.payload), /Instruksi/);
  const playerPage = await request(`/siswa/ujian/attempt/${attemptId}`, { cookie: studentCookie });
  assert.equal(playerPage.response.status, 200, "Halaman pemutar ujian siswa harus 200");
  assert.match(String(playerPage.payload), /Kumpulkan Jawaban/);
  ok("Halaman daftar, instruksi, dan pemutar ujian siswa dapat dirender");

  const draft = await request(`/api/v1/siswa/attempt/${attemptId}`, { method: "PATCH", cookie: studentCookie, body: { answers: [{ ujianSoalId: selfExam.ujianSoalId, selectedOption: "A" }] } });
  assert.equal(draft.response.status, 200, JSON.stringify(draft.payload));
  assert.ok(draft.payload.data.draftSavedAt, "Draf harus mengembalikan waktu simpan");
  ok("Draf jawaban siswa tersimpan");

  const violation1 = await request(`/api/v1/siswa/attempt/${attemptId}/violation`, { method: "POST", cookie: studentCookie, body: { reason: "visibility_hidden" } });
  assert.equal(violation1.response.status, 200, JSON.stringify(violation1.payload));
  assert.equal(violation1.payload.data.violationCount, 1);
  const violation2 = await request(`/api/v1/siswa/attempt/${attemptId}/violation`, { method: "POST", cookie: studentCookie, body: { reason: "visibility_hidden" } });
  assert.equal(violation2.payload.data.violationCount, 2);
  const violationRow = await prisma.ujianAttempt.findUnique({ where: { id: attemptId }, select: { violationCount: true, lastViolationAt: true } });
  assert.equal(violationRow.violationCount, 2);
  assert.ok(violationRow.lastViolationAt, "lastViolationAt harus terisi");
  ok("Mode aman mencatat perpindahan tab pada attempt siswa");

  const submitted = await request(`/api/v1/siswa/attempt/${attemptId}/submit`, { method: "POST", cookie: studentCookie, body: { answers: [{ ujianSoalId: selfExam.ujianSoalId, selectedOption: "A" }] } });
  assert.equal(submitted.response.status, 200, JSON.stringify(submitted.payload));
  assert.equal(submitted.payload.data.item.status, "FINAL", "Jawaban benar semua harus berstatus FINAL");
  assert.equal(Number(submitted.payload.data.item.totalScore), 100, "Skor harus 100 untuk jawaban benar semua");

  const attemptRow = await prisma.ujianAttempt.findUnique({ where: { id: attemptId }, select: { status: true, siswaAccountId: true, waliProfileId: true, startedByRole: true } });
  assert.equal(attemptRow.status, "FINAL");
  assert.equal(attemptRow.startedByRole, "SISWA");
  assert.ok(attemptRow.siswaAccountId, "Attempt siswa harus menyimpan siswaAccountId");
  assert.equal(attemptRow.waliProfileId, null, "Attempt siswa tidak boleh terikat wali");
  ok("Submit siswa dinilai otomatis dan menghasilkan HasilUjian final");

  const violationAfterSubmit = await request(`/api/v1/siswa/attempt/${attemptId}/violation`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(violationAfterSubmit.response.status, 404, "Pelanggaran tidak boleh dicatat setelah attempt dikumpulkan");

  const overLimit = await request(`/api/v1/siswa/ujian/${selfExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(overLimit.response.status, 409, "Melebihi maxAttempts harus ditolak 409");
  ok("Batas percobaan ditegakkan untuk siswa");

  const resultList = await request("/api/v1/siswa/ujian", { cookie: studentCookie });
  const selfRow = resultList.payload.data.exams.find((exam) => exam.id === selfExam.ujianId);
  assert.equal(selfRow.latestAttempt.status, "FINAL");
  assert.equal(Number(selfRow.result.totalScore), 100);
  ok("Hasil ujian tampil pada daftar ujian siswa");

  const hiddenStart = await request(`/api/v1/siswa/ujian/${hiddenExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(hiddenStart.response.status, 201, JSON.stringify(hiddenStart.payload));
  const hiddenSubmit = await request(`/api/v1/siswa/attempt/${hiddenStart.payload.data.attemptId}/submit`, { method: "POST", cookie: studentCookie, body: { answers: [{ ujianSoalId: hiddenExam.ujianSoalId, selectedOption: "A" }] } });
  assert.equal(hiddenSubmit.response.status, 200, JSON.stringify(hiddenSubmit.payload));

  const hiddenRow = (await request("/api/v1/siswa/ujian", { cookie: studentCookie })).payload.data.exams.find((exam) => exam.id === hiddenExam.ujianId);
  assert.equal(hiddenRow.status, "SUBMITTED", "Nilai tertahan harus berstatus dikirim, bukan belum dimulai");
  assert.equal(hiddenRow.result, null, "Nilai yang belum dirilis tidak boleh dikirim ke siswa");

  const dashboardScoreIds = (await request("/api/v1/siswa/dashboard", { cookie: studentCookie })).payload.data.scores.map((row) => row.ujian.id);
  assert.ok(dashboardScoreIds.includes(selfExam.ujianId), "Nilai yang dirilis harus tampil di beranda siswa");
  assert.ok(!dashboardScoreIds.includes(hiddenExam.ujianId), "Nilai yang belum dirilis tidak boleh tampil di beranda");
  ok("Kontrol rilis nilai ke siswa ditegakkan");

  // Rilis nilai per hasil (per attempt/siswa), melampaui pengaturan global.
  const hiddenHasil = await prisma.hasilUjian.findUniqueOrThrow({ where: { ujianId_siswaId: { ujianId: hiddenExam.ujianId, siswaId } }, select: { id: true } });
  const releaseAsSiswa = await request(`/api/v1/hasil-ujian/${hiddenHasil.id}/release`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(releaseAsSiswa.response.status, 403, "Siswa tidak boleh merilis nilai");

  const released = await request(`/api/v1/hasil-ujian/${hiddenHasil.id}/release`, { method: "POST", cookie: guruCookie, body: {} });
  assert.equal(released.response.status, 200, JSON.stringify(released.payload));
  const releasedRow = await prisma.hasilUjian.findUniqueOrThrow({ where: { id: hiddenHasil.id }, select: { releasedAt: true } });
  assert.ok(releasedRow.releasedAt, "releasedAt tersimpan setelah rilis");

  const afterRelease = (await request("/api/v1/siswa/ujian", { cookie: studentCookie })).payload.data.exams.find((exam) => exam.id === hiddenExam.ujianId);
  assert.ok(afterRelease.result, "Nilai yang dirilis per-hasil harus tampil untuk siswa");
  const releasedDashboardIds = (await request("/api/v1/siswa/dashboard", { cookie: studentCookie })).payload.data.scores.map((row) => row.ujian.id);
  assert.ok(releasedDashboardIds.includes(hiddenExam.ujianId), "Nilai yang dirilis tampil di beranda siswa");
  ok("Rilis nilai per hasil (per attempt) diterapkan");

  const uploadStart = await request(`/api/v1/siswa/ujian/${uploadExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(uploadStart.response.status, 201, JSON.stringify(uploadStart.payload));
  const uploadAttemptId = uploadStart.payload.data.attemptId;

  const uploadFormData = new FormData();
  uploadFormData.set("file", new File([Buffer.from("jawaban-siswa\n", "utf8")], "jawaban.txt", { type: "text/plain" }));
  uploadFormData.set("ujianSoalId", uploadExam.ujianSoalId);
  const uploaded = await requestForm(`/api/v1/siswa/attempt/${uploadAttemptId}/upload`, { formData: uploadFormData, cookie: studentCookie });
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.payload));
  const uploadedFile = uploaded.payload.data.item;
  createdMediaIds.push(uploadedFile.id);

  await request(`/api/v1/siswa/attempt/${uploadAttemptId}`, { method: "PATCH", cookie: studentCookie, body: { answers: [{ ujianSoalId: uploadExam.ujianSoalId, structuredAnswer: { fileId: uploadedFile.id, name: uploadedFile.name } }] } });

  const download = await fetch(`${baseUrl}/api/v1/siswa/attempt/${uploadAttemptId}/files/${uploadedFile.id}`, { headers: { Cookie: studentCookie }, redirect: "manual" });
  assert.equal(download.status, 200, "Siswa harus dapat mengunduh berkas jawabannya sendiri");
  assert.match(download.headers.get("content-type") || "", /text\/plain/);
  assert.equal(Buffer.from(await download.arrayBuffer()).toString(), "jawaban-siswa\n");

  const deniedDownload = await fetch(`${baseUrl}/api/v1/siswa/attempt/${uploadAttemptId}/files/${uploadedFile.id}`, { headers: { Cookie: waliCookie }, redirect: "manual" });
  assert.equal(deniedDownload.status, 403, "Wali tidak boleh memakai rute berkas milik siswa");
  ok("Siswa dapat mengunggah dan mengunduh berkas jawabannya sendiri");

  const waliOwnedAttempt = await prisma.ujianAttempt.create({
    data: {
      ujianId: bothExam.ujianId,
      siswaId,
      waliProfileId: (await prisma.waliProfile.findFirst({ select: { id: true } })).id,
      startedByRole: "WALI",
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
    select: { id: true },
  });

  const crossDraft = await request(`/api/v1/siswa/attempt/${waliOwnedAttempt.id}`, { method: "PATCH", cookie: studentCookie, body: { answers: [{ ujianSoalId: bothExam.ujianSoalId, selectedOption: "A" }] } });
  assert.equal(crossDraft.response.status, 404, "Siswa tidak boleh menyentuh attempt milik wali");
  const crossSubmit = await request(`/api/v1/siswa/attempt/${waliOwnedAttempt.id}/submit`, { method: "POST", cookie: studentCookie, body: { answers: [{ ujianSoalId: bothExam.ujianSoalId, selectedOption: "A" }] } });
  assert.equal(crossSubmit.response.status, 404, "Siswa tidak boleh submit attempt milik wali");

  const waliReadsStudent = await request(`/api/v1/wali/attempt/${attemptId}`, { method: "PATCH", cookie: waliCookie, body: { answers: [{ ujianSoalId: selfExam.ujianSoalId, selectedOption: "A" }] } });
  assert.equal(waliReadsStudent.response.status, 404, "Wali tidak boleh menyentuh attempt milik siswa");

  const studentUsesWaliRoute = await request(`/api/v1/wali/tugas/${siswaId}/ujian/${bothExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(studentUsesWaliRoute.response.status, 403, "Siswa tidak boleh memakai jalur attempt wali");
  ok("Isolasi attempt antara siswa dan wali ditegakkan");

  const crossViolation = await request(`/api/v1/siswa/attempt/${waliOwnedAttempt.id}/violation`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(crossViolation.response.status, 404, "Siswa tidak boleh mencatat pelanggaran pada attempt milik wali");

  const studentStartsShared = await request(`/api/v1/siswa/ujian/${bothExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(studentStartsShared.response.status, 409, "Attempt wali yang masih berjalan harus memblokir siswa pada ujian yang sama");
  assert.match(String(studentStartsShared.payload.error.message), /Wali/i);

  await prisma.ujianAttempt.update({ where: { id: waliOwnedAttempt.id }, data: { status: "EXPIRED" } });
  const studentStartsAfterWali = await request(`/api/v1/siswa/ujian/${bothExam.ujianId}/attempt`, { method: "POST", cookie: studentCookie, body: {} });
  assert.equal(studentStartsAfterWali.response.status, 201, JSON.stringify(studentStartsAfterWali.payload));
  assert.notEqual(studentStartsAfterWali.payload.data.attemptId, waliOwnedAttempt.id, "Attempt siswa harus terpisah dari attempt wali");
  const studentAttemptRow = await prisma.ujianAttempt.findUnique({ where: { id: studentStartsAfterWali.payload.data.attemptId }, select: { siswaAccountId: true, waliProfileId: true, startedByRole: true } });
  assert.equal(studentAttemptRow.startedByRole, "SISWA");
  assert.equal(studentAttemptRow.waliProfileId, null);
  assert.ok(studentAttemptRow.siswaAccountId);
  ok("Satu attempt aktif per ujian-siswa, dan attempt siswa terpisah dari wali");
} finally {
  await cleanup();
  await prisma.$disconnect();
}
