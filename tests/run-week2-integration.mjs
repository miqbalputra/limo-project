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
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
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
    select: { id: true },
  });
  const enrollment = await prisma.kelasSiswa.findFirstOrThrow({
    where: { kelasId: kelas.id, status: "ACTIVE", siswa: { waliRelations: { some: { waliProfile: { user: { email: "wali@limo.local" } } } } } },
    select: { siswaId: true },
  });

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
  ok("LMS materi accepts categorized PDF material");

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
  ok("Ujian stores timer duration and selected questions");

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
  assert.equal(Number(result.payload.data.item.totalScore), 10);
  assert.equal(result.payload.data.item.status, "FINAL");
  ok("Pilihan ganda is auto-scored into final exam history");

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
