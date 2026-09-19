import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

async function request(path, { method = "GET", body, cookie, headers = {}, skipOrigin = false } = {}) {
  const requestHeaders = new Headers(headers);
  if (method !== "GET" && !skipOrigin) requestHeaders.set("Origin", origin);
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
  assert.equal(result.response.status, 200, `Login gagal untuk ${email}: ${JSON.stringify(result.payload)}`);
  return { ...result, cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
}

function ok(label) {
  console.log(`ok - ${label}`);
}

let ujianId = null;
let soalId = null;

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const guru = await login("guru@limo.local");
  const kelas = await prisma.kelas.findFirst({
    where: { status: "ACTIVE", guruProfile: { user: { email: "guru@limo.local" } } },
    select: { id: true },
  });
  assert.ok(kelas, "Kelas milik guru harus tersedia");

  const soal = await request("/api/v1/bank-soal", {
    method: "POST",
    cookie: guru.cookie,
    body: {
      kelasId: kelas.id,
      type: "PILIHAN_GANDA",
      question: `Soal kuis share ${runId}?`,
      cognitiveLevel: "LOTS",
      skill: "VOCABULARY",
      difficulty: "EASY",
      assessmentType: "FORMATIVE",
      explanation: "Pembahasan: jawaban benar adalah Satu.",
      options: [
        { label: "A", content: "Satu", isCorrect: true },
        { label: "B", content: "Dua", isCorrect: false },
        { label: "C", content: "Tiga", isCorrect: false },
      ],
    },
  });
  assert.equal(soal.response.status, 201, JSON.stringify(soal.payload));
  soalId = soal.payload.data.item.id;

  const ujian = await request("/api/v1/ujian", {
    method: "POST",
    cookie: guru.cookie,
    body: {
      kelasId: kelas.id,
      title: `Kuis Latihan ${runId}`,
      description: "Latihan berbagi tautan",
      status: "PUBLISHED",
      deliveryMode: "TEACHER_ENTRY",
      durationMinutes: 15,
      maxAttempts: 1,
      mode: "LATIHAN",
      shuffleQuestions: true,
      shuffleOptions: true,
      passingScore: 70,
      showScoreImmediately: true,
      showAnswersAfterSubmit: true,
      collectRespondentName: true,
      questions: [{ bankSoalId: soalId, weight: 10 }],
    },
  });
  assert.equal(ujian.response.status, 201, JSON.stringify(ujian.payload));
  ujianId = ujian.payload.data.item.id;
  ok("Guru dapat membuat soal (opsi dinamis) dan kuis LATIHAN yang diterbitkan");

  const share = await request(`/api/v1/ujian/${ujianId}/share`, { method: "POST", cookie: guru.cookie, body: {} });
  assert.equal(share.response.status, 201, JSON.stringify(share.payload));
  const token = share.payload.data.token;
  assert.ok(token && token.length >= 16, "Token share harus berupa string acak");

  const shareAgain = await request(`/api/v1/ujian/${ujianId}/share`, { method: "POST", cookie: guru.cookie, body: {} });
  assert.equal(shareAgain.payload.data.token, token, "Token share stabil sampai dibuat ulang");
  ok("Guru dapat membuat tautan share kuis yang stabil");

  const intro = await request(`/api/v1/public/quiz/${token}`);
  assert.equal(intro.response.status, 200, JSON.stringify(intro.payload));
  assert.equal(intro.payload.data.quiz.questionCount, 1);
  assert.equal(intro.payload.data.quiz.passingScore, 70);
  assert.equal(intro.payload.data.quiz.mode, "LATIHAN");

  const notFound = await request("/api/v1/public/quiz/token-tidak-ada");
  assert.equal(notFound.response.status, 404);
  ok("Halaman publik membaca info kuis tanpa login dan menolak token salah");

  const start = await request(`/api/v1/public/quiz/${token}/responses`, { method: "POST", body: { respondentName: `Responden ${runId}` } });
  assert.equal(start.response.status, 201, JSON.stringify(start.payload));
  const responseId = start.payload.data.responseId;

  const ctx = await request(`/api/v1/public/quiz/${token}/responses/${responseId}`);
  assert.equal(ctx.response.status, 200, JSON.stringify(ctx.payload));
  const question = ctx.payload.data.questions[0];
  assert.equal(question.type, "PILIHAN_GANDA");
  assert.ok(!("isCorrect" in question.options[0]), "Kunci jawaban tidak boleh bocor ke responden");
  const correctLabel = question.options.find((option) => option.content === "Satu")?.label;
  assert.ok(correctLabel, "Opsi benar harus tersedia meski diacak");

  const draft = await request(`/api/v1/public/quiz/${token}/responses/${responseId}`, {
    method: "PATCH",
    body: { answers: [{ ujianSoalId: question.id, selectedOption: correctLabel }] },
  });
  assert.equal(draft.response.status, 200, JSON.stringify(draft.payload));
  ok("Responden publik dapat memulai kuis, melihat soal tanpa kunci, dan menyimpan draf");

  const submit = await request(`/api/v1/public/quiz/${token}/responses/${responseId}/submit`, {
    method: "POST",
    body: { answers: [{ ujianSoalId: question.id, selectedOption: correctLabel }] },
  });
  assert.equal(submit.response.status, 200, JSON.stringify(submit.payload));
  assert.equal(submit.payload.data.result.score, 100);
  assert.equal(submit.payload.data.result.passed, true);

  const result = await request(`/api/v1/public/quiz/${token}/responses/${responseId}/result`);
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.data.result.showAnswersAfterSubmit, true);
  assert.equal(result.payload.data.result.feedback.length, 1);
  assert.equal(result.payload.data.result.feedback[0].correctAnswer, "Satu");

  const resubmit = await request(`/api/v1/public/quiz/${token}/responses/${responseId}/submit`, {
    method: "POST",
    body: { answers: [{ ujianSoalId: question.id, selectedOption: correctLabel }] },
  });
  assert.equal(resubmit.response.status, 409);

  const wrongToken = await request(`/api/v1/public/quiz/token-lain/responses/${responseId}`);
  assert.equal(wrongToken.response.status, 404);
  ok("Penilaian otomatis, KKM, pembahasan, anti-submit-ganda, dan proteksi respons bekerja");
} finally {
  if (ujianId) {
    await prisma.ujian.delete({ where: { id: ujianId } }).catch(() => undefined);
  }
  if (soalId) {
    await prisma.opsiSoal.deleteMany({ where: { bankSoalId: soalId } }).catch(() => undefined);
    await prisma.bankSoal.delete({ where: { id: soalId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
