import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Admin can use schedule, payment ledger, and editable people profiles while other roles are rejected", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "admin@limo.local");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

  await page.goto("/admin/jadwal");
  await expect(page.getByRole("heading", { name: "Jadwal dan sesi" })).toBeVisible();
  await expect(page.getByText("Ownership sesi:")).toBeVisible();
  await expect(page.getByLabel("Kelas sesi baru")).toContainText("Arabic Pemula A");

  await page.goto("/admin/pembayaran");
  await expect(page.getByRole("heading", { name: "Pembayaran", exact: true })).toBeVisible();
  await expect(page.getByText("Riwayat pembayaran lintas tagihan")).toBeVisible();

  await page.goto("/admin/guru");
  const guruHref = await page.getByRole("link", { name: "Lihat profil" }).first().getAttribute("href");
  if (!guruHref) throw new Error("Tautan profil Guru tidak ditemukan");
  const guruId = guruHref.split("/").at(-1);
  if (!guruId) throw new Error("ID profil Guru tidak ditemukan");
  await page.goto(guruHref);
  await expect(page.getByRole("heading", { name: "Data kontak dan akun" })).toBeVisible();
  await expect(page.getByLabel("Nomor HP")).toHaveValue(/08000000000/);
  await expect(page.getByRole("heading", { name: "Kelas yang diampu" })).toBeVisible();

  await page.goto("/admin/wali");
  const waliHref = await page.getByRole("link", { name: "Lihat profil" }).first().getAttribute("href");
  if (!waliHref) throw new Error("Tautan profil Wali tidak ditemukan");
  const waliId = waliHref.split("/").at(-1);
  if (!waliId) throw new Error("ID profil Wali tidak ditemukan");
  await page.goto(waliHref);
  await expect(page.getByRole("heading", { name: "Data kontak dan akun" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Siswa yang terhubung" })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });
  const statuses = await page.evaluate(async ({ guruId, waliId }) => {
    const paths = [
      "/api/v1/admin/sesi",
      "/api/v1/pembayaran",
      `/api/v1/admin/guru/${guruId}`,
      `/api/v1/admin/wali/${waliId}`,
    ];
    const results = [];
    for (const path of paths) results.push((await fetch(path)).status);
    return results;
  }, { guruId, waliId });
  expect(statuses).toEqual([403, 403, 403, 403]);
});

test("Guru session, material, and essay workspaces only expose assigned classes", async ({ page }) => {
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/sesi");
  await expect(page.getByRole("heading", { name: "Sesi kelas" })).toBeVisible();
  await expect(page.getByLabel("Kelas sesi baru")).toContainText("English Beginner A");
  await expect(page.getByLabel("Kelas sesi baru")).not.toContainText("Arabic Pemula A");

  await page.goto("/guru/materi");
  await expect(page.getByRole("heading", { name: "Materi Pembelajaran" })).toBeVisible();
  await expect(page.getByLabel("Pilih kelas materi")).toContainText("English Beginner A");
  await expect(page.getByLabel("Pilih kelas materi")).not.toContainText("Arabic Pemula A");

  await page.goto("/guru/penilaian-esai");
  await expect(page.getByRole("heading", { name: "Antrean penilaian esai" })).toBeVisible();
  await expect(page.getByText("Mid Semester Demo English")).toBeVisible();
  await expect(page.getByText("Quiz Angka Arab Demo")).toHaveCount(0);

  const queue = await page.evaluate(async () => {
    const response = await fetch("/api/v1/guru/penilaian-esai");
    return { status: response.status, payload: await response.json() };
  });
  expect(queue.status).toBe(200);
  expect(queue.payload.data.items.every((item: { ujian: { kelas: { name: string } } }) => item.ujian.kelas.name !== "Arabic Pemula A")).toBe(true);
});

test("Wali payment ledger is scoped to the selected child", async ({ page }) => {
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  const allLedger = await page.evaluate(async () => {
    const response = await fetch("/api/v1/pembayaran");
    return { status: response.status, payload: await response.json() };
  });
  expect(allLedger.status).toBe(200);
  const firstPayment = allLedger.payload.data.items[0] as { tagihan: { siswa: { id: string; name: string } } } | undefined;
  if (!firstPayment) throw new Error("Tidak ada transaksi Wali untuk memverifikasi scoping anak");
  const childId = firstPayment.tagihan.siswa.id;

  await page.goto(`/wali/pembayaran?anak=${encodeURIComponent(childId)}`);
  await expect(page.getByRole("heading", { name: "Riwayat pembayaran", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Pilih anak" })).toHaveValue(childId);

  const ledger = await page.evaluate(async (childId) => {
    const response = await fetch(`/api/v1/pembayaran?anak=${encodeURIComponent(childId)}`);
    return { status: response.status, payload: await response.json() };
  }, childId);
  expect(ledger.status).toBe(200);
  expect(ledger.payload.data.items.length).toBeGreaterThan(0);
  expect(ledger.payload.data.items.every((item: { tagihan: { siswa: { id: string } } }) => item.tagihan.siswa.id === childId)).toBe(true);
});
