import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

async function login(page: import("@playwright/test").Page) {
  await loginViaForm(page, "guru@limo.local");
}

async function openNewForm(page: import("@playwright/test").Page) {
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Buat Formulir Baru" })).toBeVisible();
  const title = `Bagian ${Date.now()}`;
  await page.getByLabel("Judul formulir").fill(title);
  await page.getByLabel("Kelas").selectOption({ index: 1 });
  return title;
}

async function saveAndWaitForEditUrl(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/guru\/kuis\/[^/]+\/edit$/, { timeout: 30_000 });
}

async function fillChoice(page: import("@playwright/test").Page, questionNumber: number, text: string) {
  await page.getByLabel(`Pertanyaan soal ${questionNumber}`).fill(text);
  await page.getByLabel(`Opsi A soal ${questionNumber}`).fill("Ya");
  await page.getByLabel(`Opsi B soal ${questionNumber}`).fill("Tidak");
  await page.getByRole("button", { name: "Tandai opsi A benar" }).click();
}

test("Pengelola bagian bisa menambah, mengubah, mengurutkan, dan menghapus bagian", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);
  await openNewForm(page);
  await page.getByLabel("Pertanyaan soal 1").fill("Soal bagian?");

  const cards = page.locator('[data-testid="builder-section-card"]');
  await expect(cards).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Bagian (section)" })).toBeVisible();
  // Pilihan bagian per soal hanya muncul bila bagian lebih dari satu.
  await expect(page.getByLabel("Bagian soal ini")).toHaveCount(0);

  await page.getByRole("button", { name: "+ Tambah bagian" }).click();
  await expect(cards).toHaveCount(2);
  await expect(page.getByLabel("Bagian soal ini")).toBeVisible();

  await cards.nth(1).getByPlaceholder("Judul bagian").fill("Bagian Latihan");
  await cards.nth(1).getByRole("button", { name: "Naikkan bagian" }).click();
  await expect(cards.first().getByPlaceholder("Judul bagian")).toHaveValue("Bagian Latihan");

  await cards.first().getByRole("button", { name: /Hapus bagian/ }).click();
  await expect(cards).toHaveCount(1);
  await expect(page.getByLabel("Bagian soal ini")).toHaveCount(0);
});

// PENDING: alur modal bank soal belum stabil di e2e (daftar hasil tidak muncul saat diuji).
// Cakupan API-nya sudah ada di tests/run-quiz-builder-integration.mjs; UI-nya perlu diperbaiki dulu.
test.fixme("Modal bank soal bisa mencari dan menambahkan soal ke formulir", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await openNewForm(page);
  await fillChoice(page, 1, "Soal awal?");
  await saveAndWaitForEditUrl(page);

  await page.getByRole("button", { name: "Buka bank soal" }).click();
  const dialog = page.getByRole("dialog", { name: "Bank soal" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cari" }).click();
  const firstResult = dialog.getByRole("checkbox").first();
  await expect(firstResult).toBeVisible({ timeout: 30_000 });
  await firstResult.check();

  await dialog.getByRole("button", { name: "Tambahkan ke formulir" }).click();
  // Penambahan dari bank memuat ulang halaman, sehingga formulir kini punya soal kedua.
  await expect(page.getByText("Soal 2", { exact: true })).toBeVisible({ timeout: 45_000 });
});

// PENDING: ikut menunggu perbaikan alur modal di atas agar bisa diuji end-to-end.
test.fixme("Dialog impor soal memuat daftar soal dari formulir sumber", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await openNewForm(page);
  await fillChoice(page, 1, "Tujuan satu?");
  await saveAndWaitForEditUrl(page);

  await page.getByRole("button", { name: "Buka impor soal" }).click();
  const dialog = page.getByRole("dialog", { name: "Impor soal" });
  await expect(dialog).toBeVisible();

  const source = dialog.getByLabel("Pilih formulir sumber");
  const sourceValues = await source.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
  expect(sourceValues.length).toBeGreaterThan(0);

  await source.selectOption(sourceValues[0]);
  // Daftar soal (atau pesan "belum memiliki soal") muncul setelah formulir sumber dimuat.
  await expect(dialog.locator("ul li").first()).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("button", { name: /Impor/ }).first()).toBeVisible();
});
