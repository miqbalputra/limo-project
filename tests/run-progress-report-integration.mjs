import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;

async function request(path, { method = "GET", body, cookie, raw = false } = {}) {
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

  if (raw) {
    return { response, buffer: Buffer.from(await response.arrayBuffer()) };
  }

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

function monthPeriod() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
}

const created = [];

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const guruCookie = await login("guru@limo.local");
  const waliCookie = await login("wali@limo.local");
  const adminCookie = await login("admin@limo.local");
  const period = monthPeriod();

  const guruEnrollment = await prisma.kelasSiswa.findFirst({
    where: { status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null }, kelas: { status: "ACTIVE", guruProfile: { user: { email: "guru@limo.local" } } } },
    select: { kelasId: true, siswaId: true },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(guruEnrollment, "Fixture kelas + siswa milik guru@limo.local harus tersedia");

  const draft = await request("/api/v1/guru/reports", {
    method: "POST",
    cookie: guruCookie,
    body: { kelasId: guruEnrollment.kelasId, studentId: guruEnrollment.siswaId, reportType: "MONTHLY", ...period },
  });
  assert.equal(draft.response.status, 201, JSON.stringify(draft.payload));
  const draftId = draft.payload.data.item.id;
  created.push(draftId);
  assert.equal(draft.payload.data.item.status, "DRAFT");
  assert.ok(draft.payload.data.item.snapshotData?.generatedAt, "Snapshot data harus tersimpan saat draf dibuat");
  ok("Guru membuat draf laporan dengan snapshot data periode");

  const edited = await request(`/api/v1/guru/reports/${draftId}`, {
    method: "PATCH",
    cookie: guruCookie,
    body: { summary: "Ringkasan uji integrasi", strengths: "Konsisten", improvementAreas: "Perbanyak latihan", teacherRecommendation: "Lanjutkan" },
  });
  assert.equal(edited.response.status, 200, JSON.stringify(edited.payload));
  assert.equal(edited.payload.data.item.summary, "Ringkasan uji integrasi");
  ok("Draf dapat diubah tanpa menyentuh snapshot sumber");

  const published = await request(`/api/v1/guru/reports/${draftId}/publish`, { method: "POST", cookie: guruCookie, body: {} });
  assert.equal(published.response.status, 200, JSON.stringify(published.payload));
  assert.equal(published.payload.data.item.status, "PUBLISHED");
  assert.ok(published.payload.data.item.publishedAt, "publishedAt harus diisi setelah terbit");
  ok("Laporan dapat diterbitkan");

  const editAfterPublish = await request(`/api/v1/guru/reports/${draftId}`, { method: "PATCH", cookie: guruCookie, body: { summary: "Diubah diam-diam" } });
  assert.equal(editAfterPublish.response.status, 400, "Laporan terbit tidak boleh diubah lewat jalur draf");
  ok("Laporan terbit tidak dapat diubah melalui jalur draf (400)");

  const reviseNoReason = await request(`/api/v1/guru/reports/${draftId}/revise`, { method: "POST", cookie: guruCookie, body: { summary: "Revisi tanpa alasan" } });
  assert.equal(reviseNoReason.response.status, 400, "Revisi wajib menyertakan alasan");
  const revised = await request(`/api/v1/guru/reports/${draftId}/revise`, { method: "POST", cookie: guruCookie, body: { reason: "Koreksi narasi", summary: "Revisi ringkasan" } });
  assert.equal(revised.response.status, 200, JSON.stringify(revised.payload));
  assert.equal(revised.payload.data.item.status, "REVISED");
  assert.equal(revised.payload.data.item.revisionReason, "Koreksi narasi");
  ok("Revisi laporan menyimpan alasan dan status REVISED");

  const guruList = await request("/api/v1/guru/reports", { cookie: guruCookie });
  assert.equal(guruList.response.status, 200);
  assert.ok(guruList.payload.data.items.some((item) => item.id === draftId), "Daftar guru harus memuat laporan baru");
  ok("Daftar laporan guru memuat laporan baru");

  const pdf = await request(`/api/v1/reports/${draftId}/pdf`, { cookie: guruCookie, raw: true });
  assert.equal(pdf.response.status, 200, "PDF laporan harus 200");
  assert.match(pdf.response.headers.get("content-type") || "", /application\/pdf/);
  assert.equal(pdf.buffer.subarray(0, 4).toString("ascii"), "%PDF");
  ok("PDF laporan dapat diunduh guru");

  // Skenario wali: anak wali@limo.local yang punya kelas aktif.
  const waliRelation = await prisma.waliSiswa.findFirst({
    where: { endedAt: null, waliProfile: { user: { email: "wali@limo.local" } }, siswa: { status: "ACTIVE", deletedAt: null } },
    select: { siswaId: true },
  });
  assert.ok(waliRelation, "Fixture relasi wali harus tersedia");
  const waliEnrollment = await prisma.kelasSiswa.findFirst({
    where: { siswaId: waliRelation.siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } },
    select: { kelasId: true },
  });
  assert.ok(waliEnrollment, "Fixture kelas anak wali harus tersedia");

  const waliDraft = await request("/api/v1/guru/reports", {
    method: "POST",
    cookie: adminCookie,
    body: { kelasId: waliEnrollment.kelasId, studentId: waliRelation.siswaId, reportType: "MONTHLY", ...period },
  });
  assert.equal(waliDraft.response.status, 201, JSON.stringify(waliDraft.payload));
  const waliReportId = waliDraft.payload.data.item.id;
  created.push(waliReportId);

  const waliDraftPdf = await request(`/api/v1/reports/${waliReportId}/pdf`, { cookie: waliCookie });
  assert.equal(waliDraftPdf.response.status, 404, "Wali tidak boleh melihat laporan yang belum terbit");
  ok("Wali tidak dapat mengakses laporan draf (404)");

  const waliPublish = await request(`/api/v1/guru/reports/${waliReportId}/publish`, { method: "POST", cookie: adminCookie, body: {} });
  assert.equal(waliPublish.response.status, 200, JSON.stringify(waliPublish.payload));

  const waliList = await request(`/api/v1/wali/reports?studentId=${waliRelation.siswaId}`, { cookie: waliCookie });
  assert.equal(waliList.response.status, 200, JSON.stringify(waliList.payload));
  const seen = waliList.payload.data.items.find((item) => item.id === waliReportId);
  assert.ok(seen, "Wali harus melihat laporan terbit anaknya");
  assert.equal(seen.isRead, false);
  ok("Wali hanya melihat laporan terbit anaknya");

  const read = await request(`/api/v1/wali/reports/${waliReportId}/read`, { method: "POST", cookie: waliCookie, body: {} });
  assert.equal(read.response.status, 200, JSON.stringify(read.payload));
  assert.equal(read.payload.data.success, true);
  const waliListAfter = await request(`/api/v1/wali/reports?studentId=${waliRelation.siswaId}`, { cookie: waliCookie });
  assert.equal(waliListAfter.payload.data.items.find((item) => item.id === waliReportId).isRead, true);
  ok("Wali dapat menandai laporan sudah dibaca");

  const waliPdf = await request(`/api/v1/reports/${waliReportId}/pdf`, { cookie: waliCookie, raw: true });
  assert.equal(waliPdf.response.status, 200);
  assert.equal(waliPdf.buffer.subarray(0, 4).toString("ascii"), "%PDF");
  ok("Wali dapat mengunduh PDF laporan anaknya");

  const guruKelasIds = (await prisma.kelas.findMany({ where: { guruProfile: { user: { email: "guru@limo.local" } } }, select: { id: true } })).map((kelas) => kelas.id);
  const foreignEnrollment = await prisma.kelasSiswa.findFirst({
    where: { status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null }, kelas: { status: "ACTIVE", id: { notIn: guruKelasIds } } },
    select: { kelasId: true, siswaId: true },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(foreignEnrollment, "Fixture kelas di luar pengampuan guru@limo.local harus tersedia");
  const foreignReport = await request("/api/v1/guru/reports", {
    method: "POST",
    cookie: adminCookie,
    body: { kelasId: foreignEnrollment.kelasId, studentId: foreignEnrollment.siswaId, reportType: "MONTHLY", ...period },
  });
  assert.equal(foreignReport.response.status, 201, JSON.stringify(foreignReport.payload));
  const foreignReportId = foreignReport.payload.data.item.id;
  created.push(foreignReportId);
  await request(`/api/v1/guru/reports/${foreignReportId}/publish`, { method: "POST", cookie: adminCookie, body: {} });
  const guruForeignPdf = await request(`/api/v1/reports/${foreignReportId}/pdf`, { cookie: guruCookie });
  assert.equal(guruForeignPdf.response.status, 404, "Guru bukan pengampu tidak boleh mengakses laporan kelas lain");
  ok("Guru non-pengampu ditolak (404) pada laporan kelas lain");
  const siswaForbidden = await request("/api/v1/siswa/reports", { cookie: waliCookie });
  assert.equal(siswaForbidden.response.status, 403, "Wali tidak boleh memakai endpoint siswa");
  const adminForbidden = await request("/api/v1/admin/reports", { cookie: waliCookie });
  assert.equal(adminForbidden.response.status, 403, "Non-admin tidak boleh memakai endpoint admin");
  ok("Otorisasi lintas peran ditegakkan (403/404)");

  assert.equal(await request(`/api/v1/guru/reports/${draftId}`).then((result) => result.response.status), 401);
  ok("Tanpa sesi ditolak (401)");
} finally {
  for (const reportId of created) {
    await prisma.progressReportRead.deleteMany({ where: { reportId } }).catch(() => undefined);
    await prisma.progressReport.delete({ where: { id: reportId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
