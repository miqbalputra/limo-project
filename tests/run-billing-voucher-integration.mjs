import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

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
  assert.equal(result.response.status, 200, `Login gagal untuk ${email}: ${JSON.stringify(result.payload)}`);
  return { ...result, cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
}

function ok(label) {
  console.log(`ok - ${label}`);
}

const created = { tagihanIds: [], voucherIds: [], tarifIds: [] };

try {
  const admin = await login("admin@limo.local");
  const wali = await login("wali@limo.local");
  const guru = await login("guru@limo.local");

  const waliUser = await prisma.user.findUniqueOrThrow({ where: { email: "wali@limo.local" }, select: { waliProfile: { select: { id: true } } } });
  const relation = await prisma.waliSiswa.findFirstOrThrow({ where: { waliProfileId: waliUser.waliProfile.id, endedAt: null }, select: { siswaId: true } });
  const siswaId = relation.siswaId;

  const periode = new Date("2099-01-01T00:00:00.000Z");
  const jenis = `SPP-${runId}`.slice(0, 60);
  const invoice = await prisma.tagihan.create({
    data: { siswaId, periode, jenis, description: `Uji voucher ${runId}`, amount: 100000, status: "UNPAID", dueDate: new Date("2099-02-01T00:00:00.000Z") },
    select: { id: true },
  });
  created.tagihanIds.push(invoice.id);

  const code = `DISC${runId.replace(/[^a-z0-9]/gi, "").toUpperCase()}`.slice(0, 32);
  const inactiveCode = `${code}OFF`.slice(0, 32);

  const forbiddenCreate = await request("/api/v1/admin/voucher", { method: "POST", cookie: guru.cookie, body: { code: `X${code}`.slice(0, 32), discountType: "PERCENT", discountValue: 10 } });
  assert.equal(forbiddenCreate.response.status, 403, JSON.stringify(forbiddenCreate.payload));
  ok("Hanya Admin yang dapat membuat voucher");

  const invalidCreate = await request("/api/v1/admin/voucher", { method: "POST", cookie: admin.cookie, body: { code, discountType: "PERCENT", discountValue: 150 } });
  assert.equal(invalidCreate.response.status, 400, JSON.stringify(invalidCreate.payload));

  const createdVoucher = await request("/api/v1/admin/voucher", { method: "POST", cookie: admin.cookie, body: { code, description: "Diskon uji", discountType: "PERCENT", discountValue: 25, maxUses: 1 } });
  assert.equal(createdVoucher.response.status, 201, JSON.stringify(createdVoucher.payload));
  const voucherId = createdVoucher.payload.data.item.id;
  created.voucherIds.push(voucherId);
  ok("Admin dapat membuat voucher persen dengan kuota");

  const forbiddenApply = await request(`/api/v1/tagihan/${invoice.id}/voucher`, { method: "POST", cookie: guru.cookie, body: { code } });
  assert.equal(forbiddenApply.response.status, 403, JSON.stringify(forbiddenApply.payload));

  const applied = await request(`/api/v1/tagihan/${invoice.id}/voucher`, { method: "POST", cookie: wali.cookie, body: { code } });
  assert.equal(applied.response.status, 200, JSON.stringify(applied.payload));
  assert.equal(applied.payload.data.item.amount, 75000);
  assert.equal(applied.payload.data.item.discountAmount, 25000);
  assert.equal(applied.payload.data.item.voucherCode, code);
  const voucherRow = await prisma.voucher.findUniqueOrThrow({ where: { id: voucherId }, select: { usedCount: true } });
  assert.equal(voucherRow.usedCount, 1);
  ok("Wali dapat memakai voucher dan nominal tagihan berkurang");

  const doubleApply = await request(`/api/v1/tagihan/${invoice.id}/voucher`, { method: "POST", cookie: wali.cookie, body: { code } });
  assert.equal(doubleApply.response.status, 409, JSON.stringify(doubleApply.payload));

  const earlyReceipt = await request(`/api/v1/tagihan/${invoice.id}/kuitansi`, { cookie: wali.cookie });
  assert.equal(earlyReceipt.response.status, 409, JSON.stringify(earlyReceipt.payload));
  ok("Kuitansi hanya tersedia untuk tagihan lunas");

  const invoice2 = await prisma.tagihan.create({
    data: { siswaId, periode, jenis: `${jenis}-2`, amount: 100000, status: "UNPAID", dueDate: new Date("2099-02-01T00:00:00.000Z") },
    select: { id: true },
  });
  created.tagihanIds.push(invoice2.id);

  const quotaExceeded = await request(`/api/v1/tagihan/${invoice2.id}/voucher`, { method: "POST", cookie: wali.cookie, body: { code } });
  assert.equal(quotaExceeded.response.status, 409, JSON.stringify(quotaExceeded.payload));
  ok("Kuota voucher ditegakkan lintas tagihan");

  const removed = await request(`/api/v1/tagihan/${invoice.id}/voucher`, { method: "DELETE", cookie: wali.cookie });
  assert.equal(removed.response.status, 200, JSON.stringify(removed.payload));
  const reverted = await prisma.tagihan.findUniqueOrThrow({ where: { id: invoice.id }, select: { amount: true, voucherId: true, discountAmount: true } });
  assert.equal(Number(reverted.amount), 100000);
  assert.equal(reverted.voucherId, null);
  assert.equal(Number(reverted.discountAmount), 0);
  const voucherAfterRemove = await prisma.voucher.findUniqueOrThrow({ where: { id: voucherId }, select: { usedCount: true } });
  assert.equal(voucherAfterRemove.usedCount, 0);
  ok("Melepas voucher memulihkan nominal dan kuota");

  const reapplied = await request(`/api/v1/tagihan/${invoice.id}/voucher`, { method: "POST", cookie: wali.cookie, body: { code } });
  assert.equal(reapplied.response.status, 200, JSON.stringify(reapplied.payload));

  const reconcile = await request("/api/v1/admin/pembayaran/reconcile", { method: "POST", cookie: admin.cookie, body: { tagihanId: invoice.id, reason: "Uji kuitansi voucher" } });
  assert.equal(reconcile.response.status, 200, JSON.stringify(reconcile.payload));

  const receipt = await fetch(`${baseUrl}/api/v1/tagihan/${invoice.id}/kuitansi`, { headers: { Cookie: admin.cookie }, redirect: "manual" });
  assert.equal(receipt.status, 200);
  assert.match(receipt.headers.get("content-type") || "", /application\/pdf/);
  const bytes = Buffer.from(await receipt.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "%PDF");
  ok("Kuitansi PDF tersedia untuk tagihan lunas (dengan diskon)");

  const waliReceipt = await fetch(`${baseUrl}/api/v1/tagihan/${invoice.id}/kuitansi`, { headers: { Cookie: wali.cookie }, redirect: "manual" });
  assert.equal(waliReceipt.status, 200, "Wali pemilik dapat mengunduh kuitansi");

  // Invoice tersedia untuk semua status (termasuk tagihan yang belum lunas).
  const unpaidInvoice = await fetch(`${baseUrl}/api/v1/tagihan/${invoice2.id}/invoice`, { headers: { Cookie: wali.cookie }, redirect: "manual" });
  assert.equal(unpaidInvoice.status, 200, "Invoice harus tersedia walau tagihan belum lunas");
  assert.match(unpaidInvoice.headers.get("content-type") || "", /application\/pdf/);
  const unpaidBytes = Buffer.from(await unpaidInvoice.arrayBuffer());
  assert.equal(unpaidBytes.subarray(0, 4).toString("ascii"), "%PDF");

  const invoiceImage = await fetch(`${baseUrl}/api/v1/tagihan/${invoice2.id}/invoice.png`, { headers: { Cookie: wali.cookie }, redirect: "manual" });
  assert.equal(invoiceImage.status, 200, "Gambar invoice harus tersedia");
  assert.match(invoiceImage.headers.get("content-type") || "", /image\/png/);
  const imageBytes = Buffer.from(await invoiceImage.arrayBuffer());
  assert.equal(imageBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  ok("Invoice PDF & PNG dapat diunduh walau tagihan belum lunas");

  const adminInvoice = await fetch(`${baseUrl}/api/v1/tagihan/${invoice.id}/invoice`, { headers: { Cookie: admin.cookie }, redirect: "manual" });
  assert.equal(adminInvoice.status, 200, "Admin dapat mengunduh invoice mana pun");
  const guruInvoice = await fetch(`${baseUrl}/api/v1/tagihan/${invoice.id}/invoice`, { headers: { Cookie: guru.cookie }, redirect: "manual" });
  assert.equal(guruInvoice.status, 403, "Guru tidak boleh mengunduh invoice");
  const anonInvoice = await fetch(`${baseUrl}/api/v1/tagihan/${invoice.id}/invoice`, { redirect: "manual" });
  assert.equal(anonInvoice.status, 401, "Tanpa sesi harus 401");

  const outsiderEmail = `wali.outsider.${runId}@limo.local`.slice(0, 250);
  const outsider = await request("/api/v1/admin/users", { method: "POST", cookie: admin.cookie, body: { name: "Wali Outsider", email: outsiderEmail, role: "WALI", password: "Outsider2026" } });
  assert.equal(outsider.response.status, 201, JSON.stringify(outsider.payload));
  const outsiderLogin = await login(outsiderEmail, "Outsider2026");
  const outsiderInvoice = await fetch(`${baseUrl}/api/v1/tagihan/${invoice.id}/invoice`, { headers: { Cookie: outsiderLogin.cookie }, redirect: "manual" });
  assert.equal(outsiderInvoice.status, 403, "Wali tanpa relasi anak tidak boleh mengunduh invoice");
  await prisma.user.deleteMany({ where: { email: outsiderEmail } }).catch(() => undefined);
  ok("Akses invoice dibatasi untuk admin dan wali pemilik");

  const inactiveVoucher = await request("/api/v1/admin/voucher", { method: "POST", cookie: admin.cookie, body: { code: inactiveCode, discountType: "FIXED", discountValue: 5000 } });
  assert.equal(inactiveVoucher.response.status, 201, JSON.stringify(inactiveVoucher.payload));
  const inactiveId = inactiveVoucher.payload.data.item.id;
  created.voucherIds.push(inactiveId);

  const archived = await request(`/api/v1/admin/voucher/${inactiveId}`, { method: "PATCH", cookie: admin.cookie, body: { isActive: false } });
  assert.equal(archived.response.status, 200, JSON.stringify(archived.payload));
  const useInactive = await request(`/api/v1/tagihan/${invoice2.id}/voucher`, { method: "POST", cookie: wali.cookie, body: { code: inactiveCode } });
  assert.equal(useInactive.response.status, 409, JSON.stringify(useInactive.payload));
  ok("Voucher nonaktif ditolak saat dipakai");

  // Edit voucher: ubah nilai diskon, kuota, cakupan, dan masa berlaku via PATCH.
  const editDenied = await request(`/api/v1/admin/voucher/${inactiveId}`, { method: "PATCH", cookie: wali.cookie, body: { discountValue: 10 } });
  assert.equal(editDenied.response.status, 403);
  const editInvalid = await request(`/api/v1/admin/voucher/${inactiveId}`, { method: "PATCH", cookie: admin.cookie, body: { discountType: "PERCENT", discountValue: 150 } });
  assert.equal(editInvalid.response.status, 400);
  const editOk = await request(`/api/v1/admin/voucher/${inactiveId}`, { method: "PATCH", cookie: admin.cookie, body: { description: "Diskon direvisi", discountType: "FIXED", discountValue: 8000, maxUses: 3, validFrom: "2030-01-01", validUntil: "2030-12-31" } });
  assert.equal(editOk.response.status, 200, JSON.stringify(editOk.payload));
  assert.equal(editOk.payload.data.item.discountType, "FIXED");
  assert.equal(editOk.payload.data.item.discountValue, 8000);
  assert.equal(editOk.payload.data.item.maxUses, 3);
  const editAudit = await prisma.auditLog.findFirst({ where: { action: "VOUCHER_UPDATED", entityId: inactiveId }, orderBy: { createdAt: "desc" }, select: { id: true } });
  assert.ok(editAudit, "Perubahan voucher harus tercatat di audit log");
  ok("Voucher dapat diedit (nilai, kuota, cakupan, masa berlaku) dengan audit");

  // Cakupan voucher per program: program lain ditolak.
  const siswaRow = await prisma.siswa.findUniqueOrThrow({ where: { id: siswaId }, select: { programId: true } });
  const otherProgram = await prisma.program.findFirst({ where: { id: { not: siswaRow.programId } }, select: { id: true } });
  assert.ok(otherProgram, "Seed harus memiliki program lain untuk uji cakupan voucher");
  const scoped = await request("/api/v1/admin/voucher", { method: "POST", cookie: admin.cookie, body: { code: `${code}PROG`, discountType: "FIXED", discountValue: 1000, programId: otherProgram.id } });
  assert.equal(scoped.response.status, 201, JSON.stringify(scoped.payload));
  created.voucherIds.push(scoped.payload.data.item.id);
  const scopedApply = await request(`/api/v1/tagihan/${invoice2.id}/voucher`, { method: "POST", cookie: wali.cookie, body: { code: `${code}PROG` } });
  assert.equal(scopedApply.response.status, 400, JSON.stringify(scopedApply.payload));
  ok("Cakupan voucher per program ditegakkan");

  // Tarif: ubah nominal, arsip, dan pulihkan.
  const siswaTarif = await prisma.siswa.findUniqueOrThrow({ where: { id: siswaId }, select: { programId: true } });
  const createdTarif = await request("/api/v1/admin/tarif", { method: "POST", cookie: admin.cookie, body: { name: `Tarif uji ${runId}`.slice(0, 120), programId: siswaTarif.programId, amount: 123000, effectiveFrom: "2099-01-01" } });
  assert.equal(createdTarif.response.status, 201, JSON.stringify(createdTarif.payload));
  const tarifId = createdTarif.payload.data.item.id;
  created.tarifIds.push(tarifId);

  const forbiddenTarifUpdate = await request(`/api/v1/admin/tarif/${tarifId}`, { method: "PATCH", cookie: guru.cookie, body: { amount: 50000 } });
  assert.equal(forbiddenTarifUpdate.response.status, 403, JSON.stringify(forbiddenTarifUpdate.payload));

  const invalidTarifUpdate = await request(`/api/v1/admin/tarif/${tarifId}`, { method: "PATCH", cookie: admin.cookie, body: { amount: 0 } });
  assert.equal(invalidTarifUpdate.response.status, 400, JSON.stringify(invalidTarifUpdate.payload));

  const updatedTarif = await request(`/api/v1/admin/tarif/${tarifId}`, { method: "PATCH", cookie: admin.cookie, body: { amount: 150000 } });
  assert.equal(updatedTarif.response.status, 200, JSON.stringify(updatedTarif.payload));
  assert.equal(Number(updatedTarif.payload.data.item.amount), 150000);

  const archivedTarif = await request(`/api/v1/admin/tarif/${tarifId}`, { method: "DELETE", cookie: admin.cookie });
  assert.equal(archivedTarif.response.status, 200, JSON.stringify(archivedTarif.payload));
  assert.equal(archivedTarif.payload.data.item.isActive, false);
  const tarifRowAfterArchive = await prisma.tarif.findUniqueOrThrow({ where: { id: tarifId }, select: { isActive: true } });
  assert.equal(tarifRowAfterArchive.isActive, false);

  const restoredTarif = await request(`/api/v1/admin/tarif/${tarifId}/restore`, { method: "POST", cookie: admin.cookie });
  assert.equal(restoredTarif.response.status, 200, JSON.stringify(restoredTarif.payload));
  assert.equal(restoredTarif.payload.data.item.isActive, true);
  ok("Tarif dapat diubah, diarsipkan, dan dipulihkan");

  const missingTarif = await request("/api/v1/admin/tarif/tidak-ada", { method: "PATCH", cookie: admin.cookie, body: { amount: 10000 } });
  assert.equal(missingTarif.response.status, 404, JSON.stringify(missingTarif.payload));

  // Tarif per siswa (prioritas siswa > kelas > program) + penyesuaian manual.
  const siswaInfo = await prisma.siswa.findUniqueOrThrow({ where: { id: siswaId }, select: { programId: true, enrollments: { where: { status: "ACTIVE" }, take: 1, select: { kelasId: true } } } });
  const kelasId = siswaInfo.enrollments[0]?.kelasId;
  assert.ok(kelasId, "Siswa uji harus memiliki kelas aktif");

  const programTarif = await prisma.tarif.create({ data: { name: `Program ${runId}`.slice(0, 120), programId: siswaInfo.programId, amount: 100000, effectiveFrom: new Date("2099-01-01T00:00:00.000Z") }, select: { id: true } });
  const kelasTarif = await prisma.tarif.create({ data: { name: `Kelas ${runId}`.slice(0, 120), kelasId, amount: 200000, effectiveFrom: new Date("2099-01-01T00:00:00.000Z") }, select: { id: true } });
  const tarifKhususSiswa = await request("/api/v1/admin/tarif", { method: "POST", cookie: admin.cookie, body: { name: `Siswa ${runId}`.slice(0, 120), siswaId, amount: 333000, effectiveFrom: "2099-01-01" } });
  assert.equal(tarifKhususSiswa.response.status, 201, JSON.stringify(tarifKhususSiswa.payload));
  created.tarifIds.push(programTarif.id, kelasTarif.id, tarifKhususSiswa.payload.data.item.id);

  const withoutScope = await request("/api/v1/admin/tarif", { method: "POST", cookie: admin.cookie, body: { name: `Tanpa cakupan ${runId}`.slice(0, 120), amount: 50000, effectiveFrom: "2099-01-01" } });
  assert.equal(withoutScope.response.status, 400, JSON.stringify(withoutScope.payload));

  const priorityPeriod = "2099-03";
  const priorityJenis = `SPP-PRIORITY-${runId}`.slice(0, 60);
  const priorityGenerate = await request("/api/v1/admin/tagihan/generate", { method: "POST", cookie: admin.cookie, body: { period: priorityPeriod, dueDate: `${priorityPeriod}-10`, jenis: priorityJenis, dryRun: false } });
  assert.equal(priorityGenerate.response.status, 200, JSON.stringify(priorityGenerate.payload));
  const priorityInvoice = await prisma.tagihan.findFirstOrThrow({ where: { siswaId, jenis: priorityJenis }, select: { amount: true, tarifId: true } });
  assert.equal(Number(priorityInvoice.amount), 333000, "Tarif khusus siswa harus menang atas tarif kelas/program");
  assert.equal(priorityInvoice.tarifId, tarifKhususSiswa.payload.data.item.id);

  const feePeriod = "2099-04";
  const feeJenis = `SPP-FEE-${runId}`.slice(0, 60);
  const feeGenerate = await request("/api/v1/admin/tagihan/generate", { method: "POST", cookie: admin.cookie, body: { period: feePeriod, dueDate: `${feePeriod}-10`, jenis: feeJenis, dryRun: false, amountOverride: 500000, extraFee: -25000 } });
  assert.equal(feeGenerate.response.status, 200, JSON.stringify(feeGenerate.payload));
  const feeInvoice = await prisma.tagihan.findFirstOrThrow({ where: { siswaId, jenis: feeJenis }, select: { amount: true, subtotal: true, discountAmount: true } });
  assert.equal(Number(feeInvoice.subtotal), 500000);
  assert.equal(Number(feeInvoice.discountAmount), 25000);
  assert.equal(Number(feeInvoice.amount), 475000);

  const invalidGenerate = await request("/api/v1/admin/tagihan/generate", { method: "POST", cookie: admin.cookie, body: { period: "2099-06", dueDate: "2099-06-10", jenis: `SPP-BAD-${runId}`.slice(0, 60), dryRun: true, amountOverride: -5 } });
  assert.equal(invalidGenerate.response.status, 400, JSON.stringify(invalidGenerate.payload));
  ok("Tarif per siswa diprioritaskan dan penyesuaian nominal dihormati");
} finally {
  await prisma.tagihan.deleteMany({ where: { jenis: { contains: runId } } }).catch(() => undefined);
  await prisma.tarif.deleteMany({ where: { id: { in: created.tarifIds } } }).catch(() => undefined);
  await prisma.pembayaran.deleteMany({ where: { tagihanId: { in: created.tagihanIds } } }).catch(() => undefined);
  await prisma.tagihan.deleteMany({ where: { id: { in: created.tagihanIds } } }).catch(() => undefined);
  await prisma.voucher.deleteMany({ where: { id: { in: created.voucherIds } } }).catch(() => undefined);
  await prisma.$disconnect();
}
