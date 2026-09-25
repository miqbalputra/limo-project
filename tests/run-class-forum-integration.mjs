/**
 * Uji integrasi pengumuman + diskusi kelas (Fase A/B/C).
 *
 * Catatan: rate limit aplikasi in-process (per instance, jendela 15 menit).
 * Jalankan terhadap dev server yang baru dinyalakan; menjalankan test ini
 * berulang tanpa restart dapat membuat percobaan create ditolak 429.
 */
import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;

async function request(path, { method = "GET", body, cookie, raw = false } = {}) {
  const headers = new Headers();
  if (method !== "GET") headers.set("Origin", origin);
  if (cookie) headers.set("Cookie", cookie);
  if (body !== undefined && !(body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    redirect: "manual",
  });

  if (raw) return { response, buffer: Buffer.from(await response.arrayBuffer()) };

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

/** Hanya menandai judul yang tampil sebagai kartu, bukan notifikasi di lonceng. */
function asCardTitle(title) {
  return `>${title}</h2>`;
}

function asThreadTitle(title) {
  return `>${title}</a>`;
}

const PNG_BYTES = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f4f0000000049454e44ae426082", "hex");

const state = {
  kelasId: null,
  previousGuruProfileId: null,
  createdEnrollmentId: null,
  createdWaliRelationId: null,
  createdPengumumanIds: [],
  createdThreadIds: [],
  createdLaporanIds: [],
  createdAttachmentPaths: [],
  outsider: null,
};

async function cleanup() {
  for (const threadId of state.createdThreadIds) {
    await prisma.diskusiThread.delete({ where: { id: threadId } }).catch(() => undefined);
  }
  for (const pengumumanId of state.createdPengumumanIds) {
    await prisma.pengumuman.delete({ where: { id: pengumumanId } }).catch(() => undefined);
  }
  if (state.previousGuruProfileId && state.kelasId) {
    await prisma.kelas.update({ where: { id: state.kelasId }, data: { guruProfileId: state.previousGuruProfileId } }).catch(() => undefined);
  }
  if (state.createdEnrollmentId) {
    await prisma.kelasSiswa.delete({ where: { id: state.createdEnrollmentId } }).catch(() => undefined);
  }
  if (state.createdWaliRelationId) {
    await prisma.waliSiswa.delete({ where: { id: state.createdWaliRelationId } }).catch(() => undefined);
  }
  if (state.outsider) {
    await prisma.kelasSiswa.deleteMany({ where: { siswaId: state.outsider.siswaId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: state.outsider.userId } }).catch(() => undefined);
    await prisma.siswa.delete({ where: { id: state.outsider.siswaId } }).catch(() => undefined);
  }
  for (const storagePath of state.createdAttachmentPaths) {
    await unlink(storagePath).catch(() => undefined);
  }
}

async function createPengumuman(cookie, kelasId, body) {
  const result = await request("/api/v1/pengumuman", { method: "POST", cookie, body: { kelasId, ...body } });
  if (result.response.status === 201) state.createdPengumumanIds.push(result.payload.data.item.id);
  return result;
}

async function createThread(cookie, kelasId, title) {
  const result = await request("/api/v1/diskusi/threads", { method: "POST", cookie, body: { kelasId, title, content: `Isi dari ${title}.` } });
  if (result.response.status === 201) state.createdThreadIds.push(result.payload.data.item.id);
  return result;
}

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const adminCookie = await login("admin@limo.local");
  const guruCookie = await login("guru@limo.local");
  const siswaCookie = await login("siswa@limo.local");
  const waliCookie = await login("wali@limo.local");

  // ---------- fixture: kelas yang dikelola guru uji ----------
  const guruUser = await prisma.user.findUnique({ where: { email: "guru@limo.local" }, select: { id: true, guruProfile: { select: { id: true } } } });
  assert.ok(guruUser?.guruProfile, "Guru uji memiliki profil");

  let kelas = await prisma.kelas.findFirst({
    where: { status: "ACTIVE", guruProfileId: guruUser.guruProfile.id },
    select: { id: true, name: true, programId: true, guruProfileId: true },
  });
  if (!kelas) {
    kelas = await prisma.kelas.findFirst({ where: { status: "ACTIVE" }, select: { id: true, name: true, programId: true, guruProfileId: true } });
    assert.ok(kelas, "Seed harus memiliki kelas aktif");
    state.previousGuruProfileId = kelas.guruProfileId;
    await prisma.kelas.update({ where: { id: kelas.id }, data: { guruProfileId: guruUser.guruProfile.id } });
  }
  state.kelasId = kelas.id;

  const siswaUser = await prisma.user.findUnique({ where: { email: "siswa@limo.local" }, select: { id: true, siswaAccount: { select: { siswaId: true, status: true } } } });
  assert.ok(siswaUser?.siswaAccount && siswaUser.siswaAccount.status === "ACTIVE", "Akun siswa uji aktif");
  const siswaId = siswaUser.siswaAccount.siswaId;

  const enrollment = await prisma.kelasSiswa.findFirst({ where: { kelasId: kelas.id, siswaId, status: "ACTIVE" }, select: { id: true } });
  if (!enrollment) {
    const created = await prisma.kelasSiswa.create({
      data: { kelasId: kelas.id, siswaId, status: "ACTIVE", startDate: new Date() },
      select: { id: true },
    });
    state.createdEnrollmentId = created.id;
  }

  const waliUser = await prisma.user.findUnique({ where: { email: "wali@limo.local" }, select: { id: true, waliProfile: { select: { id: true } } } });
  assert.ok(waliUser?.waliProfile, "Wali uji memiliki profil");
  const waliLink = await prisma.waliSiswa.findFirst({ where: { waliProfileId: waliUser.waliProfile.id, siswaId, endedAt: null }, select: { id: true } });
  if (!waliLink) {
    const created = await prisma.waliSiswa.create({ data: { waliProfileId: waliUser.waliProfile.id, siswaId }, select: { id: true } });
    state.createdWaliRelationId = created.id;
  }

  // Siswa di luar kelas (uji isolasi + uji rate limit). Akun dibuat segar tiap run
  // karena kuota rate limit disimpan in-process per instance.
  const runKey = Date.now().toString(36);
  const leftovers = await prisma.user.findMany({
    where: { email: { startsWith: "siswa-luar-forum-" } },
    select: { id: true, siswaAccount: { select: { id: true, siswaId: true } } },
  });
  for (const leftover of leftovers) {
    const leftoverSiswaId = leftover.siswaAccount?.siswaId;
    if (leftoverSiswaId) await prisma.kelasSiswa.deleteMany({ where: { siswaId: leftoverSiswaId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: leftover.id } }).catch(() => undefined);
    if (leftoverSiswaId) await prisma.siswa.delete({ where: { id: leftoverSiswaId } }).catch(() => undefined);
  }

  const argon2 = (await import("argon2")).default;
  const outsiderPasswordHash = await argon2.hash("password-dev-only");
  const outsiderEmail = `siswa-luar-forum-${runKey}@limo.local`;
  const outsiderNomor = `LIMO-FORUM-${runKey}`;
  const outsiderUser = await prisma.user.create({
    data: { email: outsiderEmail, name: "Siswa Luar Forum", passwordHash: outsiderPasswordHash, role: "SISWA", status: "ACTIVE" },
    select: { id: true },
  });
  const outsiderSiswa = await prisma.siswa.create({
    data: { nomorInduk: outsiderNomor, name: "Siswa Luar Forum", status: "ACTIVE", programId: kelas.programId },
    select: { id: true },
  });
  const outsiderAccount = await prisma.siswaAccount.create({
    data: {
      siswaId: outsiderSiswa.id,
      userId: outsiderUser.id,
      loginIdentifier: outsiderNomor.toLowerCase(),
      contactEmail: outsiderEmail,
      status: "ACTIVE",
      activatedAt: new Date(),
    },
    select: { id: true },
  });
  state.outsider = { userId: outsiderUser.id, siswaId: outsiderSiswa.id, accountId: outsiderAccount.id };
  const outsiderCookie = await login(outsiderEmail);

  // ================= FASE A: PENGUMUMAN =================

  const guruCreate = await createPengumuman(guruCookie, kelas.id, {
    title: "Pengumuman utama",
    content: "Seluruh kelas harus membaca ini.",
    priority: "IMPORTANT",
    audience: "SEMUA",
  });
  assert.equal(guruCreate.response.status, 201, JSON.stringify(guruCreate.payload));
  ok("Guru kelas dapat membuat pengumuman");

  const siswaCreate = await createPengumuman(siswaCookie, kelas.id, { title: "Dari siswa", content: "Harus ditolak." });
  assert.equal(siswaCreate.response.status, 403, "Siswa tidak boleh membuat pengumuman");
  const waliCreate = await createPengumuman(waliCookie, kelas.id, { title: "Dari wali", content: "Harus ditolak." });
  assert.equal(waliCreate.response.status, 403, "Wali tidak boleh membuat pengumuman");
  ok("Pembuatan pengumuman dibatasi pada guru/admin");

  await createPengumuman(guruCookie, kelas.id, { title: "Audiens siswa saja", content: "Tidak untuk wali.", audience: "SISWA" });
  await createPengumuman(guruCookie, kelas.id, { title: "Audiens wali saja", content: "Tidak untuk siswa.", audience: "WALI" });

  const siswaList = await request(`/siswa/kelas/${kelas.id}/pengumuman`, { cookie: siswaCookie });
  assert.equal(siswaList.response.status, 200);
  const siswaHtml = String(siswaList.payload);
  assert.ok(siswaHtml.includes(asCardTitle("Audiens siswa saja")), "Siswa melihat pengumuman ber-audience siswa");
  assert.ok(siswaHtml.includes(asCardTitle("Pengumuman utama")), "Siswa melihat pengumuman SEMUA");
  assert.ok(!siswaHtml.includes(asCardTitle("Audiens wali saja")), "Siswa tidak melihat pengumuman ber-audience wali");

  const waliList = await request("/wali/pengumuman", { cookie: waliCookie });
  assert.equal(waliList.response.status, 200);
  const waliHtml = String(waliList.payload);
  assert.ok(waliHtml.includes(asCardTitle("Audiens wali saja")), "Wali melihat pengumuman ber-audience wali");
  assert.ok(waliHtml.includes(asCardTitle("Pengumuman utama")), "Wali melihat pengumuman SEMUA");
  assert.ok(!waliHtml.includes(asCardTitle("Audiens siswa saja")), "Wali tidak melihat pengumuman ber-audience siswa");
  ok("Filter audience pengumuman (siswa vs wali) berlaku");

  // Pengumuman sekolah-wide (kelasId null) — hanya admin.
  const guruSchool = await createPengumuman(guruCookie, "", { title: "Sekolah dari guru", content: "Harus ditolak." });
  assert.equal(guruSchool.response.status, 403, "Guru tidak boleh membuat pengumuman sekolah");
  const adminSchool = await createPengumuman(adminCookie, "", { title: "Pengumuman sekolah", content: "Untuk seluruh sekolah.", audience: "SEMUA" });
  assert.equal(adminSchool.response.status, 201, JSON.stringify(adminSchool.payload));

  const schoolSiswa = String((await request(`/siswa/kelas/${kelas.id}/pengumuman`, { cookie: siswaCookie })).payload);
  assert.ok(schoolSiswa.includes(asCardTitle("Pengumuman sekolah")), "Siswa melihat pengumuman sekolah-wide di halaman kelas");
  const schoolWali = String((await request("/wali/pengumuman", { cookie: waliCookie })).payload);
  assert.ok(schoolWali.includes(asCardTitle("Pengumuman sekolah")), "Wali melihat pengumuman sekolah-wide");
  const schoolAdminPage = await request("/admin/pengumuman", { cookie: adminCookie });
  assert.equal(schoolAdminPage.response.status, 200);
  assert.ok(String(schoolAdminPage.payload).includes(asCardTitle("Pengumuman sekolah")), "Halaman admin menampilkan pengumuman sekolah");
  ok("Pengumuman sekolah-wide: hanya admin, terlihat semua peran");

  const scheduled = await createPengumuman(guruCookie, kelas.id, {
    title: "Pengumuman terjadwal",
    content: "Belum waktunya.",
    publishAt: "2199-01-01T00:00",
  });
  const scheduledId = scheduled.payload.data.item.id;
  const beforeSchedule = String((await request(`/siswa/kelas/${kelas.id}/pengumuman`, { cookie: siswaCookie })).payload);
  assert.ok(!beforeSchedule.includes(asCardTitle("Pengumuman terjadwal")), "Pengumuman berjadwal belum tampil sebelum waktu terbit");

  const republish = await request(`/api/v1/pengumuman/${scheduledId}`, {
    method: "PATCH",
    cookie: guruCookie,
    body: { title: "Pengumuman terjadwal", content: "Sudah waktunya.", priority: "NORMAL", audience: "SEMUA", publishAt: "2020-01-01T00:00", expiresAt: "" },
  });
  assert.equal(republish.response.status, 200, JSON.stringify(republish.payload));
  const afterSchedule = String((await request(`/siswa/kelas/${kelas.id}/pengumuman`, { cookie: siswaCookie })).payload);
  assert.ok(afterSchedule.includes(asCardTitle("Pengumuman terjadwal")), "Pengumuman tampil setelah waktu terbit lewat");
  ok("Jadwal terbit pengumuman ditegakkan secara idempoten");

  const expired = await createPengumuman(guruCookie, kelas.id, {
    title: "Pengumuman lewat berlaku",
    content: "Sudah kedaluwarsa.",
    expiresAt: "2020-01-01T00:00",
  });
  assert.equal(expired.response.status, 201);
  const expiredHtml = String((await request(`/siswa/kelas/${kelas.id}/pengumuman`, { cookie: siswaCookie })).payload);
  assert.ok(!expiredHtml.includes(asCardTitle("Pengumuman lewat berlaku")), "Pengumuman kedaluwarsa tidak tampil");
  ok("Pengumuman kedaluwarsa disembunyikan");

  const readFirst = await request(`/api/v1/pengumuman/${guruCreate.payload.data.item.id}/read`, { method: "POST", cookie: siswaCookie, body: {} });
  assert.equal(readFirst.response.status, 200, JSON.stringify(readFirst.payload));
  const readAgain = await request(`/api/v1/pengumuman/${guruCreate.payload.data.item.id}/read`, { method: "POST", cookie: siswaCookie, body: {} });
  assert.equal(readAgain.response.status, 200, "Tandai baca idempoten");
  const readForeign = await request(`/api/v1/pengumuman/${guruCreate.payload.data.item.id}/read`, { method: "POST", cookie: outsiderCookie, body: {} });
  assert.equal(readForeign.response.status, 404, "Siswa luar kelas tidak boleh menandai baca");
  ok("Status baca pengumuman tersimpan idempoten dan terbatas anggota kelas");

  const notificationCount = await prisma.notifikasi.count({ where: { template: "pengumuman-baru", recipient: "siswa@limo.local" } });
  assert.ok(notificationCount > 0, "Notifikasi pengumuman-baru terkirim ke siswa");
  const scheduledNotifications = await prisma.notifikasi.findMany({
    where: { template: "pengumuman-baru", recipient: "siswa@limo.local" },
    select: { metadata: true },
  });
  assert.ok(
    scheduledNotifications.some((notification) => notification.metadata && notification.metadata.pengumumanId === scheduledId),
    "Notifikasi pengumuman terjadwal menyusul setelah terbit",
  );
  ok("Notifikasi pengumuman dibuat (instan dan menyusul untuk jadwal)");

  const statusArchive = await request(`/api/v1/pengumuman/${guruCreate.payload.data.item.id}/status`, { method: "POST", cookie: guruCookie, body: { status: "ARCHIVED" } });
  assert.equal(statusArchive.response.status, 200);
  const afterArchive = String((await request(`/siswa/kelas/${kelas.id}/pengumuman`, { cookie: siswaCookie })).payload);
  assert.ok(!afterArchive.includes(asCardTitle("Pengumuman utama")), "Pengumuman diarsipkan hilang dari daftar siswa");
  ok("Arsip/restore pengumuman bekerja");

  // ================= FASE B: DISKUSI =================

  const threadFromSiswa = await createThread(siswaCookie, kelas.id, "Thread utama siswa");
  assert.equal(threadFromSiswa.response.status, 201, JSON.stringify(threadFromSiswa.payload));
  const threadId = threadFromSiswa.payload.data.item.id;

  const threadFromWali = await createThread(waliCookie, kelas.id, "Thread dari wali");
  assert.equal(threadFromWali.response.status, 403, "Wali tidak boleh membuat thread");
  ok("Siswa dapat memulai diskusi; wali hanya boleh membalas");

  const outsiderThread = await createThread(outsiderCookie, kelas.id, "Thread siswa luar kelas");
  assert.equal(outsiderThread.response.status, 404, "Siswa di luar kelas ditolak 404");
  const outsiderReport = await request("/api/v1/diskusi/report", {
    method: "POST",
    cookie: outsiderCookie,
    body: { threadId, alasan: "Mencoba mengakses kelas lain" },
  });
  assert.equal(outsiderReport.response.status, 404, "Siswa luar kelas tidak boleh membaca/lapor thread");
  ok("Isolasi kelas ditegakkan (tulis dan baca ditolak 404)");

  const replyFromWali = await request(`/api/v1/diskusi/threads/${threadId}/replies`, { method: "POST", cookie: waliCookie, body: { content: "Saya ikut menjawab sebagai wali." } });
  assert.equal(replyFromWali.response.status, 201, JSON.stringify(replyFromWali.payload));
  const replyFromGuru = await request(`/api/v1/diskusi/threads/${threadId}/replies`, { method: "POST", cookie: guruCookie, body: { content: "Jawaban resmi dari guru." } });
  assert.equal(replyFromGuru.response.status, 201, JSON.stringify(replyFromGuru.payload));
  const guruReplyId = replyFromGuru.payload.data.item.id;
  ok("Wali dan guru dapat membalas thread");

  const notifThread = await prisma.notifikasi.count({ where: { template: "diskusi-baru", recipient: "guru@limo.local" } });
  assert.ok(notifThread > 0, "Guru diberi tahu saat siswa memulai diskusi");
  const notifReply = await prisma.notifikasi.count({ where: { template: "diskusi-balasan", recipient: "guru@limo.local" } });
  assert.ok(notifReply > 0, "Guru diberi tahu saat ada balasan siswa/wali");
  ok("Notifikasi diskusi terkirim ke guru pengampu");

  const markAnswer = await request(`/api/v1/diskusi/replies/${guruReplyId}/moderate`, { method: "POST", cookie: guruCookie, body: { action: "markTeacherAnswer" } });
  assert.equal(markAnswer.response.status, 200, JSON.stringify(markAnswer.payload));
  const markAsSiswa = await request(`/api/v1/diskusi/replies/${guruReplyId}/moderate`, { method: "POST", cookie: siswaCookie, body: { action: "hide" } });
  assert.equal(markAsSiswa.response.status, 403, "Siswa tidak boleh memoderasi");
  ok("Penandaan jawaban guru terbatas pada guru/admin");

  const threadView = String((await request(`/siswa/kelas/${kelas.id}/diskusi/${threadId}`, { cookie: siswaCookie })).payload);
  assert.ok(threadView.includes("Jawaban guru"), "Tampilan thread menandai jawaban guru");
  ok("Halaman detail thread dirender untuk siswa");

  // Lampiran pada balasan (penulis balasan = guru, sebelum balasan di-soft-delete).
  const replyFileForm = new FormData();
  replyFileForm.set("file", new File([PNG_BYTES], "lampiran-balasan.png", { type: "image/png" }));
  const replyUpload = await request(`/api/v1/diskusi/replies/${guruReplyId}/attachments`, { method: "POST", cookie: guruCookie, body: replyFileForm });
  assert.equal(replyUpload.response.status, 201, JSON.stringify(replyUpload.payload));
  const replyFileId = replyUpload.payload.data.item.id;
  const replyFileRow = await prisma.fileAsset.findUnique({ where: { id: replyFileId }, select: { storagePath: true } });
  if (replyFileRow?.storagePath) state.createdAttachmentPaths.push(replyFileRow.storagePath);

  const replyAttachView = String((await request(`/siswa/kelas/${kelas.id}/diskusi/${threadId}`, { cookie: siswaCookie })).payload);
  assert.ok(replyAttachView.includes("lampiran-balasan.png"), "Lampiran balasan tampil di thread");

  const replyFileDownload = await request(`/api/v1/diskusi/replies/${guruReplyId}/attachments/${replyFileId}`, { cookie: siswaCookie, raw: true });
  assert.equal(replyFileDownload.response.status, 200, "Anggota kelas dapat mengunduh lampiran balasan");
  assert.match(replyFileDownload.response.headers.get("content-type") || "", /image\/png/);

  const replyFileDenied = await request(`/api/v1/diskusi/replies/${guruReplyId}/attachments/${replyFileId}`, { cookie: outsiderCookie });
  assert.equal(replyFileDenied.response.status, 404, "Pengguna di luar kelas tidak boleh mengunduh lampiran balasan");

  const replyAttachBySiswa = await request(`/api/v1/diskusi/replies/${guruReplyId}/attachments`, {
    method: "POST",
    cookie: siswaCookie,
    body: (() => { const form = new FormData(); form.set("file", new File([PNG_BYTES], "nakal.png", { type: "image/png" })); return form; })(),
  });
  assert.equal(replyAttachBySiswa.response.status, 403, "Bukan penulis balasan tidak boleh melampirkan berkas");

  const replyFileRemove = await request(`/api/v1/diskusi/replies/${guruReplyId}/attachments/${replyFileId}/remove`, { method: "DELETE", cookie: guruCookie });
  assert.equal(replyFileRemove.response.status, 200, JSON.stringify(replyFileRemove.payload));
  const replyAfterRemove = String((await request(`/siswa/kelas/${kelas.id}/diskusi/${threadId}`, { cookie: siswaCookie })).payload);
  assert.ok(!replyAfterRemove.includes("lampiran-balasan.png"), "Lampiran balasan hilang setelah dihapus");
  ok("Lampiran balasan: penulis dapat melampirkan, anggota dapat mengunduh, luar kelas ditolak");

  const locked = await request(`/api/v1/diskusi/threads/${threadId}/moderate`, { method: "POST", cookie: guruCookie, body: { action: "lock" } });
  assert.equal(locked.response.status, 200);
  const replyWhileLocked = await request(`/api/v1/diskusi/threads/${threadId}/replies`, { method: "POST", cookie: siswaCookie, body: { content: "Seharusnya ditolak." } });
  assert.equal(replyWhileLocked.response.status, 409, "Thread terkunci menolak balasan siswa");

  const pinned = await request(`/api/v1/diskusi/threads/${threadId}/moderate`, { method: "POST", cookie: guruCookie, body: { action: "pin" } });
  assert.equal(pinned.response.status, 200);
  const threadRow = await prisma.diskusiThread.findUnique({ where: { id: threadId }, select: { isPinned: true, status: true, replyCount: true } });
  assert.equal(threadRow.isPinned, true, "Sematan thread tersimpan");
  assert.equal(threadRow.replyCount, 2, "Jumlah balasan terhitung");
  ok("Sematan & penguncian thread ditegakkan");

  const hideReply = await request(`/api/v1/diskusi/replies/${guruReplyId}/moderate`, { method: "POST", cookie: guruCookie, body: { action: "softDelete" } });
  assert.equal(hideReply.response.status, 200);
  const afterDelete = String((await request(`/siswa/kelas/${kelas.id}/diskusi/${threadId}`, { cookie: siswaCookie })).payload);
  assert.ok(!afterDelete.includes("Jawaban resmi dari guru"), "Balasan terhapus hilang dari tampilan siswa");
  const auditDelete = await prisma.auditLog.count({ where: { action: "DISKUSI_BALASAN_SOFTDELETE", entityId: guruReplyId } });
  assert.equal(auditDelete, 1, "Soft delete terekam di audit log");
  ok("Soft delete balasan disembunyikan dari siswa dan diaudit");

  // urutkan reply kronologis + lepas kunci/sematan agar thread uji tidak memengaruhi urutan pagination
  await request(`/api/v1/diskusi/threads/${threadId}/moderate`, { method: "POST", cookie: guruCookie, body: { action: "unlock" } });
  await request(`/api/v1/diskusi/threads/${threadId}/moderate`, { method: "POST", cookie: guruCookie, body: { action: "unpin" } });

  // Hanya 3 thread tambahan + `pageSize=2` agar penggunaan kuota rate limit per run tetap kecil.
  for (let index = 1; index <= 3; index += 1) {
    const created = await createThread(adminCookie, kelas.id, `Thread latihan halaman dua ${index}`);
    assert.equal(created.response.status, 201, `Gagal membuat thread ke-${index}: ${JSON.stringify(created.payload)}`);
  }

  const pageOne = String((await request(`/guru/kelas/${kelas.id}/diskusi?page=1&pageSize=2`, { cookie: guruCookie })).payload);
  const pageTwo = String((await request(`/guru/kelas/${kelas.id}/diskusi?page=2&pageSize=2`, { cookie: guruCookie })).payload);
  assert.ok(pageOne.includes(asThreadTitle("Thread utama siswa")), "Halaman 1 diurutkan dari aktivitas terakhir (thread berbalasan dulu)");
  assert.ok(pageOne.includes(asThreadTitle("Thread latihan halaman dua 3")), "Halaman 1 berisi thread admin terbaru");
  assert.ok(!pageTwo.includes(asThreadTitle("Thread utama siswa")), "Halaman 2 tidak berisi thread aktivitas terakhir");
  assert.ok(pageTwo.includes(asThreadTitle("Thread latihan halaman dua 1")), "Halaman 2 berisi thread paling tua");
  ok("Pagination daftar thread berfungsi (urut aktivitas terakhir, sematan didepan)");

  // ================= FASE C: LAPORAN & LAMPIRAN =================
  const report = await request("/api/v1/diskusi/report", {
    method: "POST",
    cookie: siswaCookie,
    body: { threadId, replyId: "", alasan: "Isi thread melanggar aturan kelas" },
  });
  assert.equal(report.response.status, 201, JSON.stringify(report.payload));
  state.createdLaporanIds.push(report.payload.data.item.id);

  const reportAgain = await request("/api/v1/diskusi/report", {
    method: "POST",
    cookie: siswaCookie,
    body: { threadId, alasan: "Laporan berulang seharusnya tidak ganda" },
  });
  assert.equal(reportAgain.response.status, 201, "Pelaporan berulang idempoten");
  const openReports = await prisma.diskusiLaporan.count({ where: { threadId, reporterId: siswaUser.id, status: "OPEN" } });
  assert.equal(openReports, 1, "Hanya satu laporan terbuka per pelapor");

  const adminQueue = await request("/api/v1/admin/diskusi-laporan?status=OPEN", { cookie: adminCookie });
  assert.equal(adminQueue.response.status, 200);
  assert.ok(adminQueue.payload.data.items.some((item) => item.thread.id === threadId), "Antrean admin memuat laporan");
  const guruQueue = await request("/api/v1/admin/diskusi-laporan", { cookie: guruCookie });
  assert.equal(guruQueue.response.status, 403, "Antrean laporan hanya untuk admin");
  ok("Laporan konten masuk antrean admin dan ditolak untuk non-admin");

  const resolveLaporanId = adminQueue.payload.data.items.find((item) => item.thread.id === threadId).id;
  const resolved = await request(`/api/v1/admin/diskusi-laporan/${resolveLaporanId}/resolve`, { method: "POST", cookie: adminCookie, body: { status: "RESOLVED" } });
  assert.equal(resolved.response.status, 200, JSON.stringify(resolved.payload));
  const resolveAsGuru = await request(`/api/v1/admin/diskusi-laporan/${resolveLaporanId}/resolve`, { method: "POST", cookie: guruCookie, body: { status: "DISMISSED" } });
  assert.equal(resolveAsGuru.response.status, 403, "Guru tidak boleh menyelesaikan laporan");
  ok("Penyelesaian laporan admin ditegakkan");

  const formData = new FormData();
  formData.set("file", new File([PNG_BYTES], "lampiran-diskusi.png", { type: "image/png" }));
  const uploaded = await request(`/api/v1/diskusi/threads/${threadId}/attachments`, { method: "POST", cookie: siswaCookie, body: formData });
  assert.equal(uploaded.response.status, 201, JSON.stringify(uploaded.payload));
  const attachmentId = uploaded.payload.data.item.id;
  const attachmentRow = await prisma.fileAsset.findUnique({ where: { id: attachmentId }, select: { storagePath: true } });
  if (attachmentRow) state.createdAttachmentPaths.push(attachmentRow.storagePath);

  const uploadAsWali = await request(`/api/v1/diskusi/threads/${threadId}/attachments`, {
    method: "POST",
    cookie: waliCookie,
    body: (() => { const form = new FormData(); form.set("file", new File([PNG_BYTES], "wali.png", { type: "image/png" })); return form; })(),
  });
  assert.equal(uploadAsWali.response.status, 403, "Wali non-pembuat tidak boleh melampirkan berkas");

  const download = await request(`/api/v1/diskusi/threads/${threadId}/attachments/${attachmentId}`, { cookie: siswaCookie, raw: true });
  assert.equal(download.response.status, 200, "Anggota kelas dapat mengunduh lampiran");
  assert.match(download.response.headers.get("content-type") || "", /image\/png/);
  assert.equal(download.buffer.subarray(0, 4).toString("hex"), "89504e47", "Isi berkas PNG utuh");
  const downloadByOutsider = await request(`/api/v1/diskusi/threads/${threadId}/attachments/${attachmentId}`, { cookie: outsiderCookie });
  assert.equal(downloadByOutsider.response.status, 404, "Siswa luar kelas tidak boleh mengunduh lampiran");
  ok("Lampiran thread tersimpan privat, terunduh anggota kelas, ditolak untuk di luar kelas");

  const attachmentPage = String((await request(`/siswa/kelas/${kelas.id}/diskusi/${threadId}`, { cookie: siswaCookie })).payload);
  assert.ok(attachmentPage.includes("lampiran-diskusi.png"), "Lampiran tampil di halaman thread");

  const removed = await request(`/api/v1/diskusi/threads/${threadId}/attachments/${attachmentId}/remove`, { method: "DELETE", cookie: siswaCookie });
  assert.equal(removed.response.status, 200, JSON.stringify(removed.payload));
  const downloadAfterRemove = await request(`/api/v1/diskusi/threads/${threadId}/attachments/${attachmentId}`, { cookie: siswaCookie });
  assert.equal(downloadAfterRemove.response.status, 404, "Lampiran terhapus tidak dapat diunduh");
  ok("Lampiran dihapus dengan soft delete dan tidak dapat diunduh lagi");

  const adminPage = await request("/admin/diskusi-laporan", { cookie: adminCookie });
  assert.equal(adminPage.response.status, 200, "Halaman antrean laporan admin dirender");
  const guruClassPage = await request(`/guru/kelas/${kelas.id}/diskusi`, { cookie: guruCookie });
  assert.equal(guruClassPage.response.status, 200, "Halaman diskusi kelas guru dirender");
  const waliDiscPage = await request("/wali/diskusi", { cookie: waliCookie });
  assert.equal(waliDiscPage.response.status, 200, "Halaman diskusi wali dirender");
  ok("Halaman admin/guru/wali terkait dirender tanpa error");

  // Rate limit diuji dengan akun segar khusus (baru dibuat run ini) agar kuota
  // akun utama tidak terpakai oleh percobaan berulang dalam jendela 15 menit.
  await prisma.kelasSiswa.create({
    data: { kelasId: kelas.id, siswaId: state.outsider.siswaId, status: "ACTIVE", startDate: new Date() },
    select: { id: true },
  });

  let rateLimited = false;
  for (let index = 0; index < 40 && !rateLimited; index += 1) {
    const response = await request("/api/v1/diskusi/threads", {
      method: "POST",
      cookie: outsiderCookie,
      body: { kelasId: kelas.id, title: `Batas posting ${index}`, content: "Menguji rate limit postingan diskusi." },
    });
    if (response.response.status === 429) rateLimited = true;
  }
  assert.ok(rateLimited, "Rate limit postingan diskusi ditegakkan");
  ok("Rate limit posting diskusi aktif");
} finally {
  await cleanup();
  // Notifikasi uji ikut dibersihkan agar run berikutnya tidak terkontaminasi
  // lonceng dashboard (judul pengumuman/diskusi tampil di sana).
  await prisma.notifikasi
    .deleteMany({ where: { template: { in: ["pengumuman-baru", "diskusi-baru", "diskusi-balasan"] } } })
    .catch(() => undefined);
  await prisma.$disconnect();
}
