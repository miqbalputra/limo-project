import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";

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

function baseQuestions() {
  return [
    {
      type: "PILIHAN_GANDA",
      question: `Ibu kota Indonesia? ${runId}`,
      required: true,
      points: 1,
      allowOther: true,
      sectionIndex: 0,
      branchRules: [{ label: "B", goToSectionIndex: 1 }],
      options: [
        { label: "A", content: "Jakarta" },
        { label: "B", content: "Bandung" },
        { label: "C", content: "Surabaya" },
      ],
      correctLabels: ["A"],
    },
    {
      type: "MULTI_SELECT",
      question: `Pilih bilangan genap ${runId}`,
      required: true,
      points: 1,
      options: [
        { label: "A", content: "2" },
        { label: "B", content: "3" },
        { label: "C", content: "4" },
      ],
      correctLabels: ["A", "C"],
    },
    {
      type: "BENAR_SALAH",
      question: `Matahari terbit dari timur ${runId}`,
      required: true,
      points: 1,
      expectedAnswer: "benar",
    },
    {
      type: "ISIAN_SINGKAT",
      question: `Lambang air adalah ${runId}`,
      required: true,
      points: 1,
      sectionIndex: 1,
      expectedAnswer: "H2O",
    },
  ];
}

function basePayload(kelasId) {
  return {
    kelasId,
    title: `Formulir Kuis ${runId}`,
    description: "Uji builder",
    mode: "LATIHAN",
    deliveryMode: "ONLINE_VIA_WALI",
    durationMinutes: 20,
    maxAttempts: 2,
    shuffleQuestions: false,
    shuffleOptions: false,
    passingScore: 70,
    showScoreImmediately: true,
    showAnswersAfterSubmit: true,
    collectRespondentName: true,
    showResultToWali: true,
    themeColor: "green",
    sections: [
      { title: "Bagian 1", description: "Pemanasan" },
      { title: "Bagian 2", description: "Pendalaman" },
    ],
    questions: baseQuestions(),
  };
}

let ujianId = null;
let mediaId = null;
const bankSoalIds = [];

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const guru = await login("guru@limo.local");
  const wali = await login("wali@limo.local");

  const listPage = await request("/guru/kuis", { cookie: guru.cookie });
  assert.equal(listPage.response.status, 200);
  assert.match(String(listPage.payload), /Formulir Kuis/);
  const newPage = await request("/guru/kuis/baru", { cookie: guru.cookie });
  assert.equal(newPage.response.status, 200);
  assert.match(String(newPage.payload), /Buat Formulir Kuis/);
  ok("Halaman khusus Formulir Kuis (list & buat) dapat diakses guru");

  const kelas = await prisma.kelas.findFirst({ where: { status: "ACTIVE", guruProfile: { user: { email: "guru@limo.local" } } }, select: { id: true } });
  assert.ok(kelas, "Kelas milik guru harus tersedia");

  const invalid = await request("/api/v1/kuis", { method: "POST", cookie: guru.cookie, body: { ...basePayload(kelas.id), questions: [{ type: "PILIHAN_GANDA", question: "Soal tanpa kunci?", options: [{ label: "A", content: "Satu" }, { label: "B", content: "Dua" }], correctLabels: [] }] } });
  assert.equal(invalid.response.status, 400);
  const forbidden = await request("/api/v1/kuis", { method: "POST", cookie: wali.cookie, body: basePayload(kelas.id) });
  assert.equal(forbidden.response.status, 403);
  ok("Builder menolak soal tanpa kunci (400) dan non-guru (403)");

  const created = await request("/api/v1/kuis", { method: "POST", cookie: guru.cookie, body: basePayload(kelas.id) });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  ujianId = created.payload.data.item.id;
  ok("Penulisan formulir (sections + branching) tersimpan");

  const detail = await request(`/api/v1/kuis/${ujianId}`, { cookie: guru.cookie });
  assert.equal(detail.response.status, 200, JSON.stringify(detail.payload));
  const saved = detail.payload.data.item;
  assert.equal(saved.questions.length, 4);
  assert.deepEqual(saved.questions[0].correctLabels, ["A"]);
  assert.deepEqual(saved.questions[1].correctLabels.sort(), ["A", "C"]);
  assert.equal(saved.questions[2].expectedAnswer, "benar");
  assert.equal(saved.questions[3].expectedAnswer, "H2O");
  assert.equal(saved.status, "DRAFT");
  assert.equal(saved.themeColor, "green");
  assert.equal(saved.sections.length, 2);
  assert.equal(saved.sections[0].title, "Bagian 1");
  assert.equal(saved.questions[3].sectionIndex, 1);
  assert.deepEqual(saved.questions[0].branchRules, [{ label: "B", goToSectionIndex: 1 }]);
  ok("Buat formulir dengan kartu soal (PG, multi, benar/salah, isian) + kunci tersimpan");

  const soalIds = await prisma.ujianSoal.findMany({ where: { ujianId }, select: { bankSoalId: true } });
  bankSoalIds.length = 0;
  for (const row of soalIds) bankSoalIds.push(row.bankSoalId);

  const updatedQuestions = baseQuestions();
  const pngBytes = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f4f0000000049454e44ae426082", "hex");
  const mediaForm = new FormData();
  mediaForm.set("file", new File([pngBytes], "soal.png", { type: "image/png" }));
  const mediaRes = await fetch(`${origin}/api/v1/kuis/media`, { method: "POST", headers: { Origin: origin, Cookie: guru.cookie }, body: mediaForm });
  const mediaBody = await mediaRes.json();
  assert.equal(mediaRes.status, 201, JSON.stringify(mediaBody));
  const mediaItem = mediaBody.data.item;
  mediaId = mediaItem.id;
  assert.match(mediaItem.url, /\/api\/v1\/public\/quiz-media\//);
  const mediaGet = await fetch(`${origin}${mediaItem.url}`);
  assert.equal(mediaGet.status, 200);
  assert.equal(mediaGet.headers.get("content-type"), "image/png");
  updatedQuestions[0].mediaUrl = mediaItem.url;
  ok("Unggah gambar soal + disajikan publik tanpa login");

  updatedQuestions[0].question = `Ibu kota Indonesia (revisi)? ${runId}`;
  updatedQuestions[0].points = 2;
  updatedQuestions[3].required = false;

  const updated = await request(`/api/v1/kuis/${ujianId}`, { method: "PATCH", cookie: guru.cookie, body: { ...basePayload(kelas.id), questions: updatedQuestions } });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.payload));

  const afterUpdate = await request(`/api/v1/kuis/${ujianId}`, { cookie: guru.cookie });
  assert.equal(afterUpdate.payload.data.item.questions[0].points, 2);
  assert.match(afterUpdate.payload.data.item.questions[0].mediaUrl, /\/api\/v1\/public\/quiz-media\//);
  assert.equal(afterUpdate.payload.data.item.sections.length, 2);
  assert.equal(afterUpdate.payload.data.item.questions[3].sectionIndex, 1);
  assert.match(afterUpdate.payload.data.item.questions[0].question, /revisi/);
  assert.equal(afterUpdate.payload.data.item.questions.length, 4);
  assert.equal(afterUpdate.payload.data.item.questions[3].required, false);
  ok("Edit soal (ubah teks/poin/required) aman saat draf");

  const published = await request(`/api/v1/kuis/${ujianId}/publish`, { method: "POST", cookie: guru.cookie, body: {} });
  assert.equal(published.response.status, 200, JSON.stringify(published.payload));

  const editableBeforeAttempt = await request(`/api/v1/kuis/${ujianId}`, { method: "PATCH", cookie: guru.cookie, body: basePayload(kelas.id) });
  assert.equal(editableBeforeAttempt.response.status, 200, "Kuis terbit tanpa pengerjaan masih boleh diedit");

  const share = await request(`/api/v1/ujian/${ujianId}/share`, { method: "POST", cookie: guru.cookie, body: {} });
  assert.equal(share.response.status, 201, JSON.stringify(share.payload));
  const token = share.payload.data.token;

  const intro = await request(`/api/v1/public/quiz/${token}`);
  assert.equal(intro.response.status, 200, JSON.stringify(intro.payload));
  assert.equal(intro.payload.data.quiz.questionCount, 4);
  assert.equal(intro.payload.data.quiz.themeColor, "green");

  const start = await request(`/api/v1/public/quiz/${token}/responses`, { method: "POST", body: { respondentName: `Builder ${runId}` } });
  assert.equal(start.response.status, 201, JSON.stringify(start.payload));
  const responseId = start.payload.data.responseId;

  const context = await request(`/api/v1/public/quiz/${token}/responses/${responseId}`);
  const questions = context.payload.data.questions;
  assert.equal(context.payload.data.sections.length, 2);
  assert.equal(context.payload.data.quiz.themeColor, "green");
  assert.equal(questions[0].required, true);
  assert.ok(!("isCorrect" in questions[0].options[0]));
  assert.deepEqual(questions.find((question) => question.type === "PILIHAN_GANDA").branchRules, [{ label: "B", goToSectionIndex: 1 }]);
  assert.equal(questions.find((question) => question.type === "ISIAN_SINGKAT").sectionIndex, 1);

  const pg = questions.find((question) => question.type === "PILIHAN_GANDA");
  assert.equal(pg.allowOther, true, "Soal pilihan ganda harus menandai opsi 'Lainnya'");
  const multi = questions.find((question) => question.type === "MULTI_SELECT");
  const bs = questions.find((question) => question.type === "BENAR_SALAH");
  const isian = questions.find((question) => question.type === "ISIAN_SINGKAT");

  const submit = await request(`/api/v1/public/quiz/${token}/responses/${responseId}/submit`, {
    method: "POST",
    body: {
      answers: [
        { ujianSoalId: pg.id, selectedOption: pg.options.find((option) => option.content === "Jakarta").label },
        { ujianSoalId: multi.id, selectedOptions: [multi.options.find((option) => option.content === "2").label, multi.options.find((option) => option.content === "4").label] },
        { ujianSoalId: bs.id, selectedOption: "benar" },
        { ujianSoalId: isian.id, shortAnswer: "h2o" },
      ],
    },
  });
  assert.equal(submit.response.status, 200, JSON.stringify(submit.payload));
  assert.equal(submit.payload.data.result.score, 100);
  assert.equal(submit.payload.data.result.passed, true);
  ok("Publikasi + share link + penilaian otomatis dari soal yang dibuat di builder");

  const otherStart = await request(`/api/v1/public/quiz/${token}/responses`, { method: "POST", body: { respondentName: `Lainnya ${runId}` } });
  assert.equal(otherStart.response.status, 201, JSON.stringify(otherStart.payload));
  const otherId = otherStart.payload.data.responseId;
  const otherContext = await request(`/api/v1/public/quiz/${token}/responses/${otherId}`);
  const otherPg = otherContext.payload.data.questions.find((question) => question.type === "PILIHAN_GANDA");
  const otherSubmit = await request(`/api/v1/public/quiz/${token}/responses/${otherId}/submit`, {
    method: "POST",
    body: { answers: [{ ujianSoalId: otherPg.id, selectedOption: "OTHER", shortAnswer: "Medan" }] },
  });
  assert.equal(otherSubmit.response.status, 200, JSON.stringify(otherSubmit.payload));
  assert.equal(otherSubmit.payload.data.result.needsReview, true);
  assert.equal(otherSubmit.payload.data.result.passed, null);
  ok("Jawaban pada opsi 'Lainnya' ditandai perlu peninjauan (needsReview)");

  const responsesPage = await request(`/guru/kuis/${ujianId}/responses`, { cookie: guru.cookie });
  assert.equal(responsesPage.response.status, 200);
  assert.match(String(responsesPage.payload), /Respons Kuis/);
  ok("Halaman Respons menampilkan analitik soal");

  const blockedAfterResponse = await request(`/api/v1/kuis/${ujianId}`, { method: "PATCH", cookie: guru.cookie, body: basePayload(kelas.id) });
  assert.equal(blockedAfterResponse.response.status, 409);
  ok("Kuis yang sudah dikerjakan tidak dapat diubah (409)");
} finally {
  if (mediaId) {
    const media = await prisma.quizMedia.findUnique({ where: { id: mediaId }, select: { storagePath: true } }).catch(() => null);
    await prisma.quizMedia.delete({ where: { id: mediaId } }).catch(() => undefined);
    if (media?.storagePath) await unlink(media.storagePath).catch(() => undefined);
  }
  if (ujianId) {
    await prisma.ujian.delete({ where: { id: ujianId } }).catch(() => undefined);
  }
  if (bankSoalIds.length > 0) {
    await prisma.opsiSoal.deleteMany({ where: { bankSoalId: { in: bankSoalIds } } }).catch(() => undefined);
    await prisma.bankSoal.deleteMany({ where: { id: { in: bankSoalIds } } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
