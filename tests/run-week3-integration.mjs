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
  const admin = await login("admin@limo.local");

  const unauthorizedBackup = await request("/api/internal/backup", { method: "POST" });
  assert.equal(unauthorizedBackup.response.status, 401);
  ok("Backup trigger rejects requests without the dedicated secret");

  const guruDashboard = await request("/guru", { cookie: guru.cookie });
  assert.equal(guruDashboard.response.status, 200);
  assert.match(String(guruDashboard.payload), /Agenda Hari Ini/);
  assert.match(String(guruDashboard.payload), /Buka semua sesi/);
  const guruPendingNotification = await prisma.notifikasi.findFirst({ where: { recipient: "guru@limo.local", template: "guru-pending-progres" }, orderBy: { createdAt: "desc" }, select: { id: true, metadata: true } });
  assert.ok(guruPendingNotification);
  assert.equal(guruPendingNotification.metadata?.taskType, "progres");
  ok("Guru dashboard exposes today's scoped teaching agenda");

  const pendingCountBeforeRepeat = await prisma.notifikasi.count({ where: { recipient: "guru@limo.local", template: { startsWith: "guru-pending-" } } });
  const repeatedGuruDashboard = await request("/guru", { cookie: guru.cookie });
  assert.equal(repeatedGuruDashboard.response.status, 200);
  const pendingCountAfterRepeat = await prisma.notifikasi.count({ where: { recipient: "guru@limo.local", template: { startsWith: "guru-pending-" } } });
  assert.equal(pendingCountAfterRepeat, pendingCountBeforeRepeat);
  ok("Guru pending-work notifications are idempotent");

  const guruSchedule = await request("/guru/jadwal", { cookie: guru.cookie });
  assert.equal(guruSchedule.response.status, 200);
  assert.match(String(guruSchedule.payload), /Jadwal Kelas/);
  assert.match(String(guruSchedule.payload), /Family Members/);
  ok("Guru schedule calendar shows scoped class sessions");

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

  const auditCsv = await request("/api/v1/admin/audit/export?search=LOGIN", { cookie: admin.cookie });
  assert.equal(auditCsv.response.status, 200);
  assert.match(auditCsv.response.headers.get("content-type") || "", /text\/csv/);
  assert.match(auditCsv.response.headers.get("content-disposition") || "", /limo-audit-\d{4}-\d{2}-\d{2}\.csv/);
  assert.match(String(auditCsv.payload), /"Waktu","Aksi","Tipe Entitas"/);
  ok("Admin audit CSV supports filtered export");

  const forbiddenAuditCsv = await request("/api/v1/admin/audit/export", { cookie: wali.cookie });
  assert.equal(forbiddenAuditCsv.response.status, 403);
  ok("Wali cannot access Admin audit CSV");

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
  const sessionEnrollments = await prisma.kelasSiswa.findMany({ where: { kelasId: sesi.kelasId, status: "ACTIVE" }, select: { siswaId: true } });

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

  const sourceMaterialCount = await prisma.materi.count({ where: { sesiKelasId: sesi.id } });
  const duplicateSession = await request(`/api/v1/guru/sesi/${sesi.id}/duplicate`, { method: "POST", cookie: guru.cookie, body: {} });
  assert.equal(duplicateSession.response.status, 201, JSON.stringify(duplicateSession.payload));
  assert.equal(duplicateSession.payload.data.item.status, "DRAFT");
  assert.equal(duplicateSession.payload.data.item.materialCount, sourceMaterialCount);
  const duplicateSessionAudit = await prisma.auditLog.findFirst({ where: { action: "SESI_KELAS_DUPLICATED", entityId: duplicateSession.payload.data.item.id }, orderBy: { createdAt: "desc" }, select: { metadata: true } });
  assert.equal(duplicateSessionAudit?.metadata?.sourceSesiKelasId, sesi.id);
  ok("Guru can duplicate a session as a draft template");

  const forbiddenSessionDuplicate = await request(`/api/v1/guru/sesi/${sesi.id}/duplicate`, { method: "POST", cookie: wali.cookie, body: {} });
  assert.equal(forbiddenSessionDuplicate.response.status, 403, JSON.stringify(forbiddenSessionDuplicate.payload));
  ok("Wali cannot duplicate a Guru session");

  const onlineExam = await prisma.ujian.findFirstOrThrow({
    where: { title: "LIMO SD Assessment Types Demo", status: "PUBLISHED", deliveryMode: "ONLINE_VIA_WALI", questions: { some: {} }, kelas: { enrollments: { some: { siswaId: enrollment.siswaId, status: "ACTIVE" } } } },
    select: { id: true },
  });
  const onlineQuestion = await prisma.ujianSoal.findFirstOrThrow({ where: { ujianId: onlineExam.id }, select: { id: true } });
  // Keep the seeded online-exam scenario repeatable when the local SQLite database is reused.
  await prisma.ujianAttempt.updateMany({ where: { ujianId: onlineExam.id, siswaId: enrollment.siswaId }, data: { status: "CANCELLED" } });
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
    body: { sesiKelasId: sesi.id, items: sessionEnrollments.map(({ siswaId }) => ({ siswaId, status: "HADIR", note: "Week 3 acceptance" })) },
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
    body: { sesiKelasId: sesi.id, items: sessionEnrollments.map(({ siswaId }) => ({ siswaId, category: "week3", understandingScore: 5, publicNote: "Progress bagus", internalNote: "Acceptance" })) },
  });
  assert.equal(progres.response.status, 200, JSON.stringify(progres.payload));
  const attendanceAfterProgress = await prisma.presensi.findUniqueOrThrow({
    where: { siswaId_sesiKelasId: { siswaId: enrollment.siswaId, sesiKelasId: sesi.id } },
    select: { status: true, note: true },
  });
  assert.deepEqual(attendanceAfterProgress, attendanceAfterSubmit);
  ok("Guru can submit 1-5 learning progress notes");
  ok("Saving progress does not modify attendance");
  const finalizeSession = await request(`/api/v1/guru/sesi/${sesi.id}/finalize`, { method: "POST", cookie: guru.cookie, body: {} });
  assert.equal(finalizeSession.response.status, 200, JSON.stringify(finalizeSession.payload));
  const finalizedAttendance = await prisma.presensi.findUniqueOrThrow({ where: { siswaId_sesiKelasId: { siswaId: enrollment.siswaId, sesiKelasId: sesi.id } }, select: { finalizedAt: true } });
  assert.ok(finalizedAttendance.finalizedAt);
  ok("Guru can finalize a complete session and lock attendance");
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
  assert.match(String(waliTagihan.payload), /Mayar|QRIS|Virtual Account|Buat Instruksi Bayar/);
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
     assert.match(payment.payload.data.paymentUrl, /mayar|myr\.id/i);
     ok("Wali can create Mayar payment instructions");
  } else {
    ok("Mayar payment creation skipped because MAYAR_API_KEY is not configured");
  }

  const mayarWebhookTagihan = await prisma.tagihan.upsert({
    where: { siswaId_periode_jenis: { siswaId: enrollment.siswaId, periode: new Date("2030-01-01T00:00:00.000Z"), jenis: "MAYAR_WEBHOOK_TEST" } },
    update: { amount: 123456, status: "UNPAID", paidAt: null },
    create: { siswaId: enrollment.siswaId, periode: new Date("2030-01-01T00:00:00.000Z"), jenis: "MAYAR_WEBHOOK_TEST", description: "Mayar webhook integration test", amount: 123456, status: "UNPAID", dueDate: new Date("2030-01-10T00:00:00.000Z") },
    select: { id: true },
  });
  const mayarWebhookBody = { event: "payment.received", data: { id: `mayar-test-${runId}`, transactionId: `mayar-test-${runId}`, amount: 123456, status: "SUCCESS", extraData: { tagihanId: mayarWebhookTagihan.id } } };
  const mayarWebhook = await request("/api/v1/webhooks/mayar", { method: "POST", body: mayarWebhookBody });
  assert.equal(mayarWebhook.response.status, 200, JSON.stringify(mayarWebhook.payload));
  assert.equal(mayarWebhook.payload.data.paid, true);
  const paidMayarTagihan = await prisma.tagihan.findUniqueOrThrow({ where: { id: mayarWebhookTagihan.id }, select: { status: true } });
  assert.equal(paidMayarTagihan.status, "PAID");
  const mayarSuccessPage = await request(`/wali/tagihan/success?tagihanId=${mayarWebhookTagihan.id}`, { cookie: wali.cookie });
  assert.equal(mayarSuccessPage.response.status, 200);
  assert.match(String(mayarSuccessPage.payload), /Pembayaran Berhasil/);
  const duplicateMayarWebhook = await request("/api/v1/webhooks/mayar", { method: "POST", body: mayarWebhookBody });
  assert.equal(duplicateMayarWebhook.response.status, 200, JSON.stringify(duplicateMayarWebhook.payload));
  assert.equal(duplicateMayarWebhook.payload.data.duplicate, true);
  ok("Mayar payment webhook marks local invoice paid idempotently");

  const dashboardNotification = await prisma.notifikasi.create({
    data: {
      channel: "email",
      template: "week3-dashboard-test",
      recipient: "wali@limo.local",
      subject: "Instruksi Pembayaran LIMO",
      body: "Acceptance notification for dashboard dropdown.",
    },
    select: { id: true },
  });

  const dashboardAfterPayment = await request("/wali", { cookie: wali.cookie });
  assert.equal(dashboardAfterPayment.response.status, 200);
  assert.match(String(dashboardAfterPayment.payload), /Notifikasi/);
  assert.match(String(dashboardAfterPayment.payload), /Instruksi Pembayaran LIMO/);
  ok("Dashboard notification dropdown is backed by notification records");

  const markRead = await request(`/api/v1/notifications/${dashboardNotification.id}/read`, { method: "POST", cookie: wali.cookie, body: {} });
  assert.equal(markRead.response.status, 200, JSON.stringify(markRead.payload));
  const readNotification = await prisma.notifikasi.findUniqueOrThrow({ where: { id: dashboardNotification.id }, select: { readAt: true } });
  assert.equal(readNotification.readAt instanceof Date, true);
  ok("Wali can mark a dashboard notification as read");

  const foreignNotification = await prisma.notifikasi.create({
    data: {
      channel: "email",
      template: "week3-dashboard-idor-test",
      recipient: "admin@limo.local",
      subject: "Admin-only notification",
      body: "Wali must not be able to mark this notification as read.",
    },
    select: { id: true },
  });
  const foreignRead = await request(`/api/v1/notifications/${foreignNotification.id}/read`, { method: "POST", cookie: wali.cookie, body: {} });
  assert.equal(foreignRead.response.status, 404, JSON.stringify(foreignRead.payload));
  const unreadForeignNotification = await prisma.notifikasi.findUniqueOrThrow({ where: { id: foreignNotification.id }, select: { readAt: true } });
  assert.equal(unreadForeignNotification.readAt, null);
  ok("Wali cannot mark another user's notification as read");
} finally {
  await prisma.$disconnect();
}
