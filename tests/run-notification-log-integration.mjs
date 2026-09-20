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

let notificationId = null;

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const admin = await login("admin@limo.local");
  const wali = await login("wali@limo.local");

  notificationId = (await prisma.notifikasi.create({
    data: {
      channel: "email",
      template: "notification-log-test",
      recipient: `log-${runId}@example.test`,
      subject: "Uji log notifikasi",
      body: "Pesan uji track record",
      dedupeKey: `notification-log-test-${runId}`,
    },
    select: { id: true },
  })).id;

  const page = await request("/admin/notifikasi", { cookie: admin.cookie });
  assert.equal(page.response.status, 200, "Halaman log notifikasi harus 200");
  assert.match(String(page.payload), /Log Notifikasi/);
  ok("Halaman admin Log Notifikasi dapat dibuka (ADMIN)");

  const forbidden = await request(`/api/v1/admin/notifikasi/${notificationId}/retry`, { method: "POST", cookie: wali.cookie, body: {} });
  assert.equal(forbidden.response.status, 403);
  const notFound = await request(`/api/v1/admin/notifikasi/tidak-ada/retry`, { method: "POST", cookie: admin.cookie, body: {} });
  assert.equal(notFound.response.status, 404);
  ok("Kirim ulang notifikasi menolak non-admin (403) dan id tidak ditemukan (404)");

  const retry = await request(`/api/v1/admin/notifikasi/${notificationId}/retry`, { method: "POST", cookie: admin.cookie, body: {} });
  assert.equal(retry.response.status, 200, JSON.stringify(retry.payload));
  assert.ok(retry.payload.data.sent >= 1, "Retry harus mencatat pengiriman");

  const stored = await prisma.notifikasi.findUnique({ where: { id: notificationId }, select: { status: true, deliveries: { select: { provider: true, status: true, attempt: true } } } });
  assert.equal(stored.status, "SENT");
  assert.ok(stored.deliveries.length >= 1, "NotificationDelivery harus tercatat");
  ok("Pengiriman ulang tercatat di Notifikasi + NotificationDelivery");
} finally {
  if (notificationId) {
    await prisma.notifikasi.delete({ where: { id: notificationId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
