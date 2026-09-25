import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const guruEmail = `guru-${runId}@example.test`;
const waliEmail = `wali-${runId}@example.test`;
const importEmails = [`guru-imp-1-${runId}@example.test`, `guru-imp-2-${runId}@example.test`];
const cleanupEmails = [guruEmail, waliEmail, ...importEmails];

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

  const create = await request("/api/v1/admin/guru", { method: "POST", cookie: adminCookie, body: { name: "Guru Uji CRUD", email: guruEmail, phone: "081200000", address: "Jakarta" } });
  assert.equal(create.response.status, 201, JSON.stringify(create.payload));
  const guruId = create.payload.data.item.id;
  ok("Admin dapat membuat akun Guru");

  const update = await request(`/api/v1/admin/guru/${guruId}`, { method: "PATCH", cookie: adminCookie, body: { name: "Guru Uji Diubah", email: guruEmail, phone: "081211111", address: "Bandung" } });
  assert.equal(update.response.status, 200, JSON.stringify(update.payload));
  assert.equal(update.payload.data.item.phone, "081211111");
  ok("Admin dapat memperbarui profil Guru");

  const user = await prisma.user.findUnique({ where: { email: guruEmail }, select: { id: true, status: true, deletedAt: true } });
  assert.ok(user, "User guru harus ada");

  const resetLink = await request(`/api/v1/admin/guru/${guruId}/reset-password`, { method: "POST", cookie: adminCookie });
  assert.equal(resetLink.response.status, 200, JSON.stringify(resetLink.payload));
  assert.ok(resetLink.payload.data.resetUrl, "Link reset harus dikembalikan pada mode development");
  const resetTokens = await prisma.passwordResetToken.count({ where: { userId: user.id } });
  const resetNotif = await prisma.notifikasi.count({ where: { recipient: guruEmail, template: "password-reset" } });
  assert.ok(resetTokens >= 1, "PasswordResetToken harus dibuat");
  assert.ok(resetNotif >= 1, "Notifikasi reset password harus dibuat");
  ok("Kirim link reset password tercatat (token + notifikasi)");

  const activation = await request(`/api/v1/admin/guru/${guruId}/kirim-aktivasi`, { method: "POST", cookie: adminCookie });
  assert.equal(activation.response.status, 200, JSON.stringify(activation.payload));
  assert.ok(activation.payload.data.activationUrl, "Link aktivasi harus dikembalikan pada mode development");
  const activationNotif = await prisma.notifikasi.count({ where: { recipient: guruEmail, template: "account-activation" } });
  assert.ok(activationNotif >= 1, "Notifikasi aktivasi harus dibuat");
  ok("Kirim ulang aktivasi membuat notifikasi account-activation");

  const archive = await request(`/api/v1/admin/guru/${guruId}`, { method: "DELETE", cookie: adminCookie });
  assert.equal(archive.response.status, 200, JSON.stringify(archive.payload));
  const archived = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true, deletedAt: true } });
  assert.equal(archived.status, "INACTIVE");
  assert.ok(archived.deletedAt, "deletedAt harus terisi setelah arsip");

  const hiddenList = await request(`/api/v1/admin/guru?search=${encodeURIComponent(guruEmail)}`, { cookie: adminCookie });
  assert.equal(hiddenList.payload.data.items.length, 0, "Akun terarsip harus hilang dari daftar biasa");
  const archivedList = await request(`/api/v1/admin/guru?search=${encodeURIComponent(guruEmail)}&arsip=1`, { cookie: adminCookie });
  assert.equal(archivedList.payload.data.items.length, 1, "Akun terarsip harus muncul saat arsip=1");
  ok("Arsip menyembunyikan akun dari daftar biasa dan menampilkannya pada filter arsip");

  const restore = await request(`/api/v1/admin/guru/${guruId}/restore`, { method: "POST", cookie: adminCookie });
  assert.equal(restore.response.status, 200, JSON.stringify(restore.payload));
  const restored = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true, deletedAt: true } });
  assert.equal(restored.status, "ACTIVE");
  assert.equal(restored.deletedAt, null);
  ok("Restore mengaktifkan kembali akun Guru");

  const csv = `name,email,phone,address\nGuru Imp One,${importEmails[0]},0812,Jakarta\nGuru Imp Two,${importEmails[1]},0813,Bogor\nGuru Imp One Duplikat,${importEmails[0]},0814,Depok\n`;
  const preview = await request("/api/v1/admin/guru/impor", { method: "POST", cookie: adminCookie, body: { csv, dryRun: true } });
  assert.equal(preview.response.status, 200, JSON.stringify(preview.payload));
  assert.equal(preview.payload.data.created, 0, "Pratinjau tidak boleh menulis data");
  assert.ok(preview.payload.data.errors >= 1, "Email duplikat di dalam file harus dilaporkan error");
  const beforeCommit = await prisma.user.count({ where: { email: { in: importEmails } } });
  assert.equal(beforeCommit, 0);
  ok("Pratinjau impor memvalidasi per baris tanpa menulis data");

  const commit = await request("/api/v1/admin/guru/impor", { method: "POST", cookie: adminCookie, body: { csv, dryRun: false } });
  assert.equal(commit.response.status, 200, JSON.stringify(commit.payload));
  assert.equal(commit.payload.data.created, 2, "Dua akun baru harus dibuat");
  const afterCommit = await prisma.user.count({ where: { email: { in: importEmails } } });
  assert.equal(afterCommit, 2, "Akun hasil impor harus tersimpan");

  const rerun = await request("/api/v1/admin/guru/impor", { method: "POST", cookie: adminCookie, body: { csv, dryRun: false } });
  assert.equal(rerun.payload.data.skipped, 2, "Email aktif yang diimpor ulang harus dilewati");
  assert.equal(rerun.payload.data.created, 0);
  assert.equal(await prisma.user.count({ where: { email: { in: importEmails } } }), 2, "Tidak boleh ada duplikat setelah impor ulang");
  ok("Impor membuat akun, melaporkan duplikat, dan idempoten saat diulang");

  const waliCreate = await request("/api/v1/admin/wali", { method: "POST", cookie: adminCookie, body: { name: "Wali Uji CRUD", email: waliEmail, phone: "081299999" } });
  assert.equal(waliCreate.response.status, 201, JSON.stringify(waliCreate.payload));
  const waliProfileId = waliCreate.payload.data.item.id;
  const waliArchive = await request(`/api/v1/admin/wali/${waliProfileId}`, { method: "DELETE", cookie: adminCookie });
  assert.equal(waliArchive.response.status, 200);
  const waliRestore = await request(`/api/v1/admin/wali/${waliProfileId}/restore`, { method: "POST", cookie: adminCookie });
  assert.equal(waliRestore.response.status, 200);
  ok("Arsip dan restore akun Wali berfungsi");

  const programCreate = await request("/api/v1/admin/program", { method: "POST", cookie: adminCookie, body: { name: `Program Uji ${runId}`, kind: "ENGLISH" } });
  assert.equal(programCreate.response.status, 201, JSON.stringify(programCreate.payload));
  const programId = programCreate.payload.data.item.id;

  const programArchive = await request(`/api/v1/admin/program/${programId}`, { method: "DELETE", cookie: adminCookie });
  assert.equal(programArchive.response.status, 200, JSON.stringify(programArchive.payload));
  assert.equal(programArchive.payload.data.item.isActive, false);

  const programRestore = await request(`/api/v1/admin/program/${programId}/restore`, { method: "POST", cookie: adminCookie });
  assert.equal(programRestore.response.status, 200, JSON.stringify(programRestore.payload));
  assert.equal(programRestore.payload.data.item.isActive, true);

  const programUpdate = await request(`/api/v1/admin/program/${programId}`, { method: "PATCH", cookie: adminCookie, body: { name: `Program Uji Diubah ${runId}`, description: "Diperbarui" } });
  assert.equal(programUpdate.response.status, 200, JSON.stringify(programUpdate.payload));
  assert.equal(programUpdate.payload.data.item.name, `Program Uji Diubah ${runId}`);
  ok("Master data program: ubah, arsip, dan pulihkan berfungsi");

  await prisma.program.delete({ where: { id: programId } }).catch(() => undefined);

  const forbidden = await request("/api/v1/admin/guru/impor", { method: "POST", cookie: waliCookie, body: { csv, dryRun: true } });
  assert.equal(forbidden.response.status, 403, "Non-admin harus ditolak");
  const notFound = await request("/api/v1/admin/guru/tidak-ada", { method: "DELETE", cookie: adminCookie });
  assert.equal(notFound.response.status, 404, "ID tidak ditemukan harus 404");
  ok("Endpoint impor/arsip menolak non-admin (403) dan id tidak ditemukan (404)");
} finally {
  await prisma.user.deleteMany({ where: { email: { in: cleanupEmails } } }).catch(() => undefined);
  await prisma.notifikasi.deleteMany({ where: { recipient: { in: cleanupEmails } } }).catch(() => undefined);
  await prisma.$disconnect();
}
