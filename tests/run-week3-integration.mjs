import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;

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
  const admin = await login("admin@limo.local");

  const adminReport = await request("/admin/laporan?from=2026-08-01&to=2026-08-31", { cookie: admin.cookie });
  assert.equal(adminReport.response.status, 200);
  assert.match(String(adminReport.payload), /Laporan Operasional/);
  assert.match(String(adminReport.payload), /2026-08-01/);
  assert.match(String(adminReport.payload), /2026-08-31/);
  ok("Admin report page accepts a filtered reporting period");

  const reportCsv = await request("/api/v1/admin/laporan/export?from=2026-08-01&to=2026-08-31", { cookie: admin.cookie });
  assert.equal(reportCsv.response.status, 200);
  assert.match(reportCsv.response.headers.get("content-type") || "", /text\/csv/);
  assert.match(reportCsv.response.headers.get("content-disposition") || "", /limo-laporan-2026-08-01-2026-08-31\.csv/);
  assert.match(String(reportCsv.payload), /Laporan Operasional LIMO/);
  assert.match(String(reportCsv.payload), /"Siswa","Nomor Induk","Program"/);
  ok("Admin report CSV contains period and student columns");

  const forbiddenReportCsv = await request("/api/v1/admin/laporan/export?from=2026-08-01&to=2026-08-31", { cookie: wali.cookie });
  assert.equal(forbiddenReportCsv.response.status, 403);
  ok("Wali cannot access Admin report CSV");

  const sesi = await prisma.sesiKelas.findFirstOrThrow({
    where: { status: "DRAFT", kelas: { guruProfile: { user: { email: "guru@limo.local" } } } },
    orderBy: { sessionDate: "asc" },
    select: { id: true, kelasId: true },
  });
  const enrollment = await prisma.kelasSiswa.findFirstOrThrow({
    where: { kelasId: sesi.kelasId, status: "ACTIVE", siswa: { waliRelations: { some: { waliProfile: { user: { email: "wali@limo.local" } } } } } },
    select: { siswaId: true },
  });

  const guruClassPage = await request(`/guru/kelas/${sesi.kelasId}`, { cookie: guru.cookie });
  assert.equal(guruClassPage.response.status, 200);
  assert.match(String(guruClassPage.payload), /Roster Siswa/);
  assert.match(String(guruClassPage.payload), /Ahmad Dev/);
  assert.match(String(guruClassPage.payload), /Cari nama atau nomor induk/);
  ok("Guru class detail exposes a scoped searchable student roster");

  const guruStudentHistory = await request(`/guru/kelas/${sesi.kelasId}/ringkasan?siswaId=${enrollment.siswaId}`, { cookie: guru.cookie });
  assert.equal(guruStudentHistory.response.status, 200);
  assert.match(String(guruStudentHistory.payload), /Histori/);
  assert.match(String(guruStudentHistory.payload), /Ahmad Dev/);
  assert.match(String(guruStudentHistory.payload), /Presensi/);
  assert.match(String(guruStudentHistory.payload), /Nilai/);
  ok("Guru can open one student's class-scoped history");

  const onlineExam = await prisma.ujian.findFirstOrThrow({
    where: { title: "LIMO SD Assessment Types Demo", status: "PUBLISHED", deliveryMode: "ONLINE_VIA_WALI", questions: { some: {} }, kelas: { enrollments: { some: { siswaId: enrollment.siswaId, status: "ACTIVE" } } } },
    select: { id: true },
  });
  const onlineQuestion = await prisma.ujianSoal.findFirstOrThrow({ where: { ujianId: onlineExam.id }, select: { id: true } });
  const onlineAttempt = await request(`/api/v1/wali/tugas/${enrollment.siswaId}/ujian/${onlineExam.id}/attempt`, { method: "POST", cookie: wali.cookie, body: {} });
  assert.equal(onlineAttempt.response.status, 201, JSON.stringify(onlineAttempt.payload));
  const attemptId = onlineAttempt.payload.data.attemptId;

  const draft = await request(`/api/v1/wali/attempt/${attemptId}`, {
    method: "PATCH",
    cookie: wali.cookie,
    body: { answers: [{ ujianSoalId: onlineQuestion.id, selectedOption: "A" }] },
  });
  assert.equal(draft.response.status, 200, JSON.stringify(draft.payload));
  const savedAttempt = await prisma.ujianAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { status: true, draftAnswers: true, draftSavedAt: true } });
  assert.equal(savedAttempt.status, "IN_PROGRESS");
  assert.equal(savedAttempt.draftSavedAt instanceof Date, true);
  assert.deepEqual(savedAttempt.draftAnswers, [{ ujianSoalId: onlineQuestion.id, selectedOption: "A" }]);
  ok("Wali autosave persists an online exam draft without finalizing the result");

  const forbiddenDraft = await request(`/api/v1/wali/attempt/${attemptId}`, {
    method: "PATCH",
    cookie: guru.cookie,
    body: { answers: [{ ujianSoalId: onlineQuestion.id, selectedOption: "B" }] },
  });
  assert.equal(forbiddenDraft.response.status, 403);
  ok("Non-Wali cannot write an online exam draft");

  const presensi = await request("/api/v1/presensi", {
    method: "POST",
    cookie: guru.cookie,
    body: { sesiKelasId: sesi.id, items: [{ siswaId: enrollment.siswaId, status: "HADIR", note: "Week 3 acceptance" }] },
  });
  assert.equal(presensi.response.status, 200, JSON.stringify(presensi.payload));
  const attendanceAfterSubmit = await prisma.presensi.findUniqueOrThrow({
    where: { siswaId_sesiKelasId: { siswaId: enrollment.siswaId, sesiKelasId: sesi.id } },
    select: { status: true, note: true },
  });
  ok("Guru can submit attendance per session");

  const progres = await request("/api/v1/progres", {
    method: "POST",
    cookie: guru.cookie,
    body: { sesiKelasId: sesi.id, items: [{ siswaId: enrollment.siswaId, category: "week3", understandingScore: 5, publicNote: "Progress bagus", internalNote: "Acceptance" }] },
  });
  assert.equal(progres.response.status, 200, JSON.stringify(progres.payload));
  const attendanceAfterProgress = await prisma.presensi.findUniqueOrThrow({
    where: { siswaId_sesiKelasId: { siswaId: enrollment.siswaId, sesiKelasId: sesi.id } },
    select: { status: true, note: true },
  });
  assert.deepEqual(attendanceAfterProgress, attendanceAfterSubmit);
  ok("Guru can submit 1-5 learning progress notes");
  ok("Saving progress does not modify attendance");
  const progressNotification = await prisma.notifikasi.findFirst({ where: { template: "progress-updated", recipient: "wali@limo.local" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  assert.ok(progressNotification);
  ok("Progress submission creates a Wali notification");

  const waliProgress = await request(`/wali/progres/${enrollment.siswaId}`, { cookie: wali.cookie });
  assert.equal(waliProgress.response.status, 200);
  assert.match(String(waliProgress.payload), /Grafik Pemahaman/);
  assert.match(String(waliProgress.payload), /Kehadiran Bulanan/);
  ok("Wali progress page shows progress and attendance graphs");

  const waliMateri = await request("/wali/materi", { cookie: wali.cookie });
  assert.equal(waliMateri.response.status, 200);
  assert.match(String(waliMateri.payload), /Greeting Flashcards/);
  assert.match(String(waliMateri.payload), /Video Colors Song/);
  ok("Wali can read published learning materials");

  const waliPresensi = await request("/wali/presensi", { cookie: wali.cookie });
  assert.equal(waliPresensi.response.status, 200);
  assert.match(String(waliPresensi.payload), /Presensi Anak/);
  ok("Wali can view monthly attendance recap");

  const guruRingkasan = await request(`/guru/kelas/${sesi.kelasId}/ringkasan`, { cookie: guru.cookie });
  assert.equal(guruRingkasan.response.status, 200);
  assert.match(String(guruRingkasan.payload), /Ringkasan/);
  ok("Guru class summary shows graph-ready progress rows");

  const waliTagihan = await request("/wali/tagihan", { cookie: wali.cookie });
  assert.equal(waliTagihan.response.status, 200);
  assert.match(String(waliTagihan.payload), /QRIS|Pakasir|Virtual Account|Buat Instruksi Bayar/);
  ok("Wali billing page shows payment gateway instructions");

  if (String(waliTagihan.payload).includes("Buat Instruksi Bayar")) {
    const tagihan = await prisma.tagihan.findFirstOrThrow({
      where: { siswa: { waliRelations: { some: { waliProfile: { user: { email: "wali@limo.local" } } } } } },
      orderBy: { dueDate: "desc" },
      select: { id: true },
    });
    await prisma.tagihan.update({ where: { id: tagihan.id }, data: { status: "UNPAID", paidAt: null } });
    await prisma.pembayaran.deleteMany({ where: { tagihanId: tagihan.id } });

    const payment = await request(`/api/v1/tagihan/${tagihan.id}/payment`, {
      method: "POST",
      cookie: wali.cookie,
      body: { method: "qris" },
    });
    assert.equal(payment.response.status, 201, JSON.stringify(payment.payload));
    assert.match(payment.payload.data.paymentUrl, /app\.pakasir\.com\/pay/);
    ok("Wali can create Pakasir payment instructions");
  } else {
    ok("Pakasir payment creation skipped because PAKASIR_PROJECT is not configured");
  }

  await prisma.notifikasi.create({
    data: {
      channel: "email",
      template: "week3-dashboard-test",
      recipient: "wali@limo.local",
      subject: "Instruksi Pembayaran LIMO",
      body: "Acceptance notification for dashboard dropdown.",
    },
  });

  const dashboardAfterPayment = await request("/wali", { cookie: wali.cookie });
  assert.equal(dashboardAfterPayment.response.status, 200);
  assert.match(String(dashboardAfterPayment.payload), /Notifikasi/);
  assert.match(String(dashboardAfterPayment.payload), /Instruksi Pembayaran LIMO/);
  ok("Dashboard notification dropdown is backed by notification records");
} finally {
  await prisma.$disconnect();
}
