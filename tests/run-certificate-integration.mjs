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

let sertifikatId = null;

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const adminCookie = await login("admin@limo.local");
  const waliCookie = await login("wali@limo.local");

  const enrollment = await prisma.kelasSiswa.findFirst({
    where: {
      status: "ACTIVE",
      siswa: { deletedAt: null, waliRelations: { none: { endedAt: null, waliProfile: { user: { email: "wali@limo.local" } } } } },
    },
    select: { kelasId: true, siswaId: true },
    orderBy: { createdAt: "asc" },
  });
  assert.ok(enrollment, "Fixture enrollment aktif (di luar wali penguji) harus tersedia");

  const created = await request("/api/v1/sertifikat", {
    method: "POST",
    cookie: adminCookie,
    body: { siswaId: enrollment.siswaId, kelasId: enrollment.kelasId, note: "Uji integrasi sertifikat" },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  sertifikatId = created.payload.data.item.id;
  const code = created.payload.data.item.code;
  assert.match(code, /^LIMO-\d{4}-[A-Z0-9]{8}$/);
  ok("Admin dapat menerbitkan sertifikat dengan kode verifikasi");

  const duplicate = await request("/api/v1/sertifikat", {
    method: "POST",
    cookie: adminCookie,
    body: { siswaId: enrollment.siswaId, kelasId: enrollment.kelasId },
  });
  assert.equal(duplicate.response.status, 409, "Sertifikat ganda untuk siswa+kelas+judul harus ditolak");
  ok("Penerbitan ganda ditolak (409)");

  const verify = await request(`/api/v1/public/sertifikat/${code}`);
  assert.equal(verify.response.status, 200, JSON.stringify(verify.payload));
  assert.equal(verify.payload.data.found, true);
  assert.equal(verify.payload.data.item.revokedAt, null);

  const unknown = await request("/api/v1/public/sertifikat/LIMO-2000-TIDAKADA");
  assert.equal(unknown.payload.data.found, false);
  ok("Verifikasi publik mengenali kode valid dan menolak kode tak dikenal");

  const verifyPage = await request(`/verifikasi-sertifikat/${code}`);
  assert.equal(verifyPage.response.status, 200, "Halaman verifikasi publik harus 200");
  assert.match(String(verifyPage.payload), /Sertifikat sah/);
  const notFoundPage = await request("/verifikasi-sertifikat/LIMO-2000-TIDAKADA");
  assert.equal(notFoundPage.response.status, 200);
  assert.match(String(notFoundPage.payload), /tidak ditemukan/i);
  ok("Halaman verifikasi publik menampilkan status sah dan tidak ditemukan");

  const pdf = await request(`/api/v1/sertifikat/${sertifikatId}/pdf`, { cookie: adminCookie, raw: true });
  assert.equal(pdf.response.status, 200, "Unduhan PDF sertifikat harus 200");
  assert.match(pdf.response.headers.get("content-type") || "", /application\/pdf/);
  assert.equal(pdf.buffer.subarray(0, 4).toString("ascii"), "%PDF");
  ok("PDF sertifikat dapat diunduh oleh admin");

  const forbiddenIssue = await request("/api/v1/sertifikat", { method: "POST", cookie: waliCookie, body: { siswaId: enrollment.siswaId, kelasId: enrollment.kelasId } });
  assert.equal(forbiddenIssue.response.status, 403, "Wali tidak boleh menerbitkan sertifikat");
  const forbiddenPdf = await request(`/api/v1/sertifikat/${sertifikatId}/pdf`, { cookie: waliCookie });
  assert.equal(forbiddenPdf.response.status, 403, "Wali hanya boleh mengunduh sertifikat anaknya");
  const forbiddenRevoke = await request(`/api/v1/admin/sertifikat/${sertifikatId}/revoke`, { method: "POST", cookie: waliCookie, body: { reason: "Percobaan tanpa izin" } });
  assert.equal(forbiddenRevoke.response.status, 403, "Non-admin tidak boleh mencabut sertifikat");
  ok("Otorisasi sertifikat ditegakkan (403 untuk non-berwenang)");

  const revoke = await request(`/api/v1/admin/sertifikat/${sertifikatId}/revoke`, { method: "POST", cookie: adminCookie, body: { reason: "Uji pencabutan sertifikat" } });
  assert.equal(revoke.response.status, 200, JSON.stringify(revoke.payload));
  const verifyRevoked = await request(`/api/v1/public/sertifikat/${code}`);
  assert.ok(verifyRevoked.payload.data.item.revokedAt, "Sertifikat tercabut harus menandai revokedAt");
  const revokeAgain = await request(`/api/v1/admin/sertifikat/${sertifikatId}/revoke`, { method: "POST", cookie: adminCookie, body: { reason: "Percobaan kedua" } });
  assert.equal(revokeAgain.response.status, 409, "Pencabutan kedua harus 409");
  ok("Pencabutan sertifikat tercatat dan idempoten terhadap pengulangan");
} finally {
  if (sertifikatId) {
    await prisma.sertifikat.delete({ where: { id: sertifikatId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
