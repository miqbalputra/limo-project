import { expect, test } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { loginViaForm } from "./support/auth";

const ORIGIN = "http://127.0.0.1:3000";

let prisma: PrismaClient;
let tagihanId = "";
const runId = `${Date.now()}`;
const voucherCode = `E2E${runId}`;
const invoiceJenis = `E2EV-${runId}`;

test.beforeAll(async () => {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
});

// Dijalankan ulang tiap attempt (termasuk retry) agar tagihan kembali UNPAID.
test.beforeEach(async () => {
  await prisma.pembayaran.deleteMany({ where: { tagihan: { jenis: invoiceJenis } } }).catch(() => undefined);
  await prisma.tagihan.deleteMany({ where: { jenis: invoiceJenis } }).catch(() => undefined);
  await prisma.voucher.deleteMany({ where: { code: voucherCode } }).catch(() => undefined);

  const siswa = await prisma.siswa.findFirstOrThrow({ where: { nomorInduk: "LIMO-DEV-001" }, select: { id: true } });
  const tagihan = await prisma.tagihan.create({
    data: {
      siswaId: siswa.id,
      periode: new Date("2099-01-01T00:00:00.000Z"),
      jenis: invoiceJenis,
      description: "Uji voucher e2e",
      amount: 450000,
      status: "UNPAID",
      dueDate: new Date("2099-02-01T00:00:00.000Z"),
    },
    select: { id: true },
  });
  tagihanId = tagihan.id;
});

test.afterAll(async () => {
  await prisma.pembayaran.deleteMany({ where: { tagihan: { jenis: invoiceJenis } } }).catch(() => undefined);
  await prisma.tagihan.deleteMany({ where: { jenis: invoiceJenis } }).catch(() => undefined);
  await prisma.voucher.deleteMany({ where: { code: voucherCode } }).catch(() => undefined);
  await prisma.$disconnect();
});

test("Admin membuat voucher, Wali memakainya, dan kuitansi PDF dapat diunduh", async ({ page }) => {
  test.setTimeout(240_000);

  // 1. Admin membuat voucher.
  await loginViaForm(page, "admin@limo.local");
  await page.goto("/admin/tagihan");
  await page.getByPlaceholder("Kode voucher (mis. AWAL25)").fill(voucherCode);
  await page.getByLabel("Jenis diskon").selectOption("PERCENT");
  await page.getByPlaceholder("Nilai diskon").fill("10");
  await page.getByRole("button", { name: "Simpan Voucher" }).click();
  await expect(page.getByText(voucherCode, { exact: true })).toBeVisible({ timeout: 20_000 });

  // 2. Wali memakai voucher pada tagihan anak.
  await page.context().clearCookies();
  await loginViaForm(page, "wali@limo.local");
  await page.goto("/wali/tagihan");
  const invoiceCard = page.locator(`[data-invoice-id="${tagihanId}"]`);
  await expect(invoiceCard).toBeVisible();
  await invoiceCard.getByPlaceholder("Masukkan kode").fill(voucherCode);
  await invoiceCard.getByRole("button", { name: "Pakai" }).click();
  await expect(invoiceCard.getByText(`Voucher ${voucherCode} diterapkan`)).toBeVisible({ timeout: 20_000 });

  // 3. Admin merekonsiliasi pembayaran lunas (lewat API agar deterministik).
  const login = await page.request.post("/api/v1/auth/login", {
    data: { email: "admin@limo.local", password: "password-dev-only" },
    headers: { Origin: ORIGIN },
  });
  expect(login.ok(), await login.text()).toBe(true);
  const adminCookie = (login.headers()["set-cookie"] || "").match(/limo_session=([^;]+)/)?.[1];
  expect(adminCookie).toBeTruthy();
  await page.context().addCookies([{ name: "limo_session", value: adminCookie as string, domain: "127.0.0.1", path: "/" }]);

  const reconcile = await page.request.post("/api/v1/admin/pembayaran/reconcile", {
    data: { tagihanId, reason: "Uji e2e kuitansi voucher" },
    headers: { Origin: ORIGIN },
  });
  expect(reconcile.ok(), await reconcile.text()).toBe(true);

  // 4. Wali mengunduh kuitansi untuk tagihan lunas.
  await loginViaForm(page, "wali@limo.local");
  await page.goto("/wali/tagihan");
  const paidCard = page.locator(`[data-invoice-id="${tagihanId}"]`);
  await expect(paidCard.getByRole("link", { name: "Unduh kuitansi PDF" })).toBeVisible({ timeout: 20_000 });

  const receipt = await page.request.get(`/api/v1/tagihan/${tagihanId}/kuitansi`);
  expect(receipt.status()).toBe(200);
  expect(receipt.headers()["content-type"]).toContain("application/pdf");
  const bytes = await receipt.body();
  expect(bytes.subarray(0, 4).toString("ascii")).toBe("%PDF");
});
