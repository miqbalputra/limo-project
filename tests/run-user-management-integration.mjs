import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const adminEmail = `user-admin-${runId}@example.test`;
const guruEmail = `user-guru-${runId}@example.test`;
const waliEmail = `user-wali-${runId}@example.test`;
const cleanupEmails = [adminEmail, guruEmail, waliEmail];

async function request(path, { method = "GET", body, cookie, skipOrigin = false } = {}) {
  const headers = new Headers();
  if (method !== "GET" && !skipOrigin) headers.set("Origin", origin);
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

async function login(email, password = "password-dev-only") {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.response.status, 200, `Login gagal untuk ${email}: ${JSON.stringify(result.payload)}`);
  return (result.response.headers.get("set-cookie") || "").split(";")[0];
}

function ok(label) {
  console.log(`ok - ${label}`);
}

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const adminCookie = await login("admin@limo.local");
  const waliCookie = await login("wali@limo.local");
  const seededAdmin = await prisma.user.findUnique({ where: { email: "admin@limo.local" }, select: { id: true } });
  assert.ok(seededAdmin, "Admin seed harus ada");

  const created = {};
  for (const [role, email, name] of [["ADMIN", adminEmail, "Admin Uji"], ["GURU", guruEmail, "Guru Uji"], ["WALI", waliEmail, "Wali Uji"]]) {
    const result = await request("/api/v1/admin/users", { method: "POST", cookie: adminCookie, body: { name, email, role, phone: "081200000", address: "Jakarta" } });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    assert.equal(result.payload.data.item.role, role);
    assert.equal(result.payload.data.item.status, "ACTIVE");
    assert.ok(result.payload.data.activationUrl, "Link aktivasi harus dikembalikan pada mode development");
    created[role] = result.payload.data.item.id;
  }
  ok("Admin dapat membuat akun ADMIN, GURU, dan WALI");

  const guruProfile = await prisma.guruProfile.findFirst({ where: { user: { email: guruEmail } }, select: { id: true, phone: true } });
  const waliProfile = await prisma.waliProfile.findFirst({ where: { user: { email: waliEmail } }, select: { id: true } });
  assert.ok(guruProfile, "Profil guru harus dibuat untuk role GURU");
  assert.equal(guruProfile.phone, "081200000");
  assert.ok(waliProfile, "Profil wali harus dibuat untuk role WALI");
  const activationNotif = await prisma.notifikasi.count({ where: { recipient: guruEmail, template: "account-activation" } });
  assert.ok(activationNotif >= 1, "Notifikasi aktivasi harus dibuat");
  ok("Pembuatan akun menyiapkan profil dan notifikasi aktivasi");

  const duplicate = await request("/api/v1/admin/users", { method: "POST", cookie: adminCookie, body: { name: "Duplikat", email: guruEmail, role: "GURU" } });
  assert.equal(duplicate.response.status, 409, "Email yang sudah dipakai harus 409");
  ok("Email duplikat ditolak dengan 409");

  const filtered = await request(`/api/v1/admin/users?search=${encodeURIComponent(guruEmail)}&role=GURU`, { cookie: adminCookie });
  assert.equal(filtered.response.status, 200);
  assert.equal(filtered.payload.data.items.length, 1, "Filter search+role harus diteruskan ke query");
  assert.equal(filtered.payload.data.items[0].email, guruEmail);
  assert.equal(filtered.payload.data.filters.role, "GURU");
  ok("GET daftar pengguna meneruskan query param (search, role)");

  const updated = await request(`/api/v1/admin/users/${created.GURU}`, { method: "PATCH", cookie: adminCookie, body: { name: "Guru Uji Diubah", email: guruEmail, role: "WALI", phone: "081211111", address: "Bandung" } });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.payload));
  assert.equal(updated.payload.data.item.role, "WALI");
  assert.equal(updated.payload.data.item.name, "Guru Uji Diubah");
  const roleChangeLogs = await prisma.auditLog.count({ where: { entityType: "User", entityId: created.GURU, action: "USER_ROLE_CHANGED" } });
  assert.ok(roleChangeLogs >= 1, "Perubahan role harus tercatat di audit log");
  const newWaliProfile = await prisma.waliProfile.findFirst({ where: { userId: created.GURU }, select: { id: true } });
  assert.ok(newWaliProfile, "Profil wali baru harus dibuat setelah perubahan role");
  ok("Admin dapat memperbarui data dan mengubah role pengguna (tercatat di audit)");

  const archive = await request(`/api/v1/admin/users/${created.GURU}`, { method: "DELETE", cookie: adminCookie });
  assert.equal(archive.response.status, 200, JSON.stringify(archive.payload));
  const archived = await prisma.user.findUnique({ where: { id: created.GURU }, select: { status: true, deletedAt: true } });
  assert.equal(archived.status, "INACTIVE");
  assert.ok(archived.deletedAt, "deletedAt harus terisi setelah arsip");

  const hiddenList = await request(`/api/v1/admin/users?search=${encodeURIComponent(guruEmail)}`, { cookie: adminCookie });
  assert.equal(hiddenList.payload.data.items.length, 0, "Akun terarsip harus hilang dari daftar biasa");
  const archivedList = await request(`/api/v1/admin/users?search=${encodeURIComponent(guruEmail)}&includeArchived=1`, { cookie: adminCookie });
  assert.equal(archivedList.payload.data.items.length, 1, "Akun terarsip harus muncul saat includeArchived=1");
  ok("Arsip menyembunyikan akun dan filter includeArchived menampilkannya");

  const restore = await request(`/api/v1/admin/users/${created.GURU}/restore`, { method: "POST", cookie: adminCookie });
  assert.equal(restore.response.status, 200, JSON.stringify(restore.payload));
  const restored = await prisma.user.findUnique({ where: { id: created.GURU }, select: { status: true, deletedAt: true } });
  assert.equal(restored.status, "ACTIVE");
  assert.equal(restored.deletedAt, null);
  ok("Restore mengaktifkan kembali akun");

  const resetLink = await request(`/api/v1/admin/users/${created.WALI}/reset-password`, { method: "POST", cookie: adminCookie });
  assert.equal(resetLink.response.status, 200, JSON.stringify(resetLink.payload));
  assert.ok(resetLink.payload.data.resetUrl, "Link reset harus dikembalikan pada mode development");
  const resetTokens = await prisma.passwordResetToken.count({ where: { userId: created.WALI } });
  const resetNotif = await prisma.notifikasi.count({ where: { recipient: waliEmail, template: "password-reset" } });
  assert.ok(resetTokens >= 1, "PasswordResetToken harus dibuat");
  assert.ok(resetNotif >= 1, "Notifikasi reset password harus dibuat");
  ok("Kirim link reset password tercatat (token + notifikasi)");

  const activation = await request(`/api/v1/admin/users/${created.WALI}/kirim-aktivasi`, { method: "POST", cookie: adminCookie });
  assert.equal(activation.response.status, 200, JSON.stringify(activation.payload));
  assert.ok(activation.payload.data.activationUrl, "Link aktivasi harus dikembalikan pada mode development");
  ok("Kirim ulang aktivasi mengembalikan link aktivasi");

  const selfRole = await request(`/api/v1/admin/users/${seededAdmin.id}`, { method: "PATCH", cookie: adminCookie, body: { name: "Admin", email: "admin@limo.local", role: "GURU" } });
  assert.equal(selfRole.response.status, 400, "Admin tidak boleh mengubah role akunnya sendiri");
  const selfArchive = await request(`/api/v1/admin/users/${seededAdmin.id}`, { method: "DELETE", cookie: adminCookie });
  assert.equal(selfArchive.response.status, 400, "Admin tidak boleh mengarsipkan akunnya sendiri");
  ok("Guard akun sendiri berfungsi (400)");

  const forbidden = await request("/api/v1/admin/users", { method: "POST", cookie: waliCookie, body: { name: "Nakal", email: `nakal-${runId}@example.test`, role: "GURU" } });
  assert.equal(forbidden.response.status, 403, "Non-admin harus ditolak");
  const notFound = await request("/api/v1/admin/users/tidak-ada", { method: "DELETE", cookie: adminCookie });
  assert.equal(notFound.response.status, 404, "ID tidak ditemukan harus 404");
  ok("Non-admin 403 dan id tidak ditemukan 404");
} finally {
  await prisma.user.deleteMany({ where: { email: { in: cleanupEmails } } }).catch(() => undefined);
  await prisma.notifikasi.deleteMany({ where: { recipient: { in: cleanupEmails } } }).catch(() => undefined);
  await prisma.$disconnect();
}
