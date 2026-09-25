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

const created = { tagihanIds: [], voucherIds: [] };

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

  const inactiveVoucher = await request("/api/v1/admin/voucher", { method: "POST", cookie: admin.cookie, body: { code: inactiveCode, discountType: "FIXED", discountValue: 5000 } });
  assert.equal(inactiveVoucher.response.status, 201, JSON.stringify(inactiveVoucher.payload));
  const inactiveId = inactiveVoucher.payload.data.item.id;
  created.voucherIds.push(inactiveId);

  const archived = await request(`/api/v1/admin/voucher/${inactiveId}`, { method: "PATCH", cookie: admin.cookie, body: { isActive: false } });
  assert.equal(archived.response.status, 200, JSON.stringify(archived.payload));
  const useInactive = await request(`/api/v1/tagihan/${invoice2.id}/voucher`, { method: "POST", cookie: wali.cookie, body: { code: inactiveCode } });
  assert.equal(useInactive.response.status, 409, JSON.stringify(useInactive.payload));
  ok("Voucher nonaktif ditolak saat dipakai");

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
} finally {
  await prisma.pembayaran.deleteMany({ where: { tagihanId: { in: created.tagihanIds } } }).catch(() => undefined);
  await prisma.tagihan.deleteMany({ where: { id: { in: created.tagihanIds } } }).catch(() => undefined);
  await prisma.voucher.deleteMany({ where: { id: { in: created.voucherIds } } }).catch(() => undefined);
  await prisma.$disconnect();
}
