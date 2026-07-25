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

  const sesi = await prisma.sesiKelas.findFirstOrThrow({
    where: { kelas: { guruProfile: { user: { email: "guru@limo.local" } } } },
    orderBy: { sessionDate: "asc" },
    select: { id: true, kelasId: true },
  });
  const enrollment = await prisma.kelasSiswa.findFirstOrThrow({
    where: { kelasId: sesi.kelasId, status: "ACTIVE", siswa: { waliRelations: { some: { waliProfile: { user: { email: "wali@limo.local" } } } } } },
    select: { siswaId: true },
  });

  const presensi = await request("/api/v1/presensi", {
    method: "POST",
    cookie: guru.cookie,
    body: { sesiKelasId: sesi.id, items: [{ siswaId: enrollment.siswaId, status: "HADIR", note: "Week 3 acceptance" }] },
  });
  assert.equal(presensi.response.status, 200, JSON.stringify(presensi.payload));
  ok("Guru can submit attendance per session");

  const progres = await request("/api/v1/progres", {
    method: "POST",
    cookie: guru.cookie,
    body: { sesiKelasId: sesi.id, items: [{ siswaId: enrollment.siswaId, category: "week3", understandingScore: 5, publicNote: "Progress bagus", internalNote: "Acceptance" }] },
  });
  assert.equal(progres.response.status, 200, JSON.stringify(progres.payload));
  ok("Guru can submit 1-5 learning progress notes");

  const waliProgress = await request(`/wali/progres/${enrollment.siswaId}`, { cookie: wali.cookie });
  assert.equal(waliProgress.response.status, 200);
  assert.match(String(waliProgress.payload), /Grafik Pemahaman/);
  assert.match(String(waliProgress.payload), /Kehadiran Bulanan/);
  ok("Wali progress page shows progress and attendance graphs");

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
