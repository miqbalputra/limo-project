import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

async function login(page: import("@playwright/test").Page) {
  await loginViaForm(page, "guru@limo.local");
}

async function openNewForm(page: import("@playwright/test").Page) {
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Formulir baru" })).toBeVisible();
  const title = `Bagian ${Date.now()}`;
  await page.getByLabel("Judul formulir").fill(title);
  return title;
}

async function waitForAutosave(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(/\/guru\/kuis\/[^/]+\/edit$/, { timeout: 30_000 });
  await expect(page.getByText("Semua perubahan tersimpan", { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function fillChoice(page: import("@playwright/test").Page, questionNumber: number, text: string) {
  await page.getByLabel(`Pertanyaan soal ${questionNumber}`).fill(text);
  await page.getByLabel("Teks opsi A").fill("Ya");
  await page.getByLabel("Teks opsi B").fill("Tidak");
  await page.getByRole("radio", { name: "Tandai jawaban benar opsi A" }).check();
}

test("Pengelola bagian bisa menambah, mengubah, mengurutkan, dan menghapus bagian", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);
  await openNewForm(page);
  await page.getByLabel("Pertanyaan soal 1").fill("Soal bagian?");

  // Pilihan bagian per soal hanya muncul bila bagian lebih dari satu.
  await expect(page.getByLabel("Bagian soal 1")).toHaveCount(0);

  await page.getByRole("button", { name: "+ Bagian baru" }).click();
  await expect(page.getByLabel("Judul bagian 2")).toBeVisible();
  await expect(page.getByLabel("Bagian soal 1")).toBeVisible();

  await page.getByLabel("Judul bagian 2").fill("Bagian Latihan");
  await page.getByRole("button", { name: "Naikkan bagian" }).click();
  // Bagian pertama menjadi header formulir; "Bagian 1" turun ke kartu kedua.
  await expect(page.getByLabel("Judul bagian 2")).toHaveValue("Bagian 1");

  await page.getByRole("button", { name: "Hapus bagian 2" }).click();
  await expect(page.getByLabel("Judul bagian 2")).toHaveCount(0);
  await expect(page.getByLabel("Bagian soal 1")).toHaveCount(0);
});

test("Sheet pustaka soal bisa mencari dan menambahkan soal ke formulir", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await openNewForm(page);
  await fillChoice(page, 1, "Soal awal?");
  await waitForAutosave(page);

  await page.getByRole("button", { name: "Pustaka soal" }).click();
  const dialog = page.getByRole("dialog", { name: "Ambil dari pustaka soal" });
  await expect(dialog).toBeVisible();

  // Cari soal lama dari seed (bukan soal yang baru dibuat) agar tidak dianggap duplikat.
  await dialog.getByLabel("Cari bank soal").fill("greeting");
  await dialog.getByRole("button", { name: "Cari" }).click();
  const firstResult = dialog.getByRole("checkbox").first();
  await expect(firstResult).toBeVisible({ timeout: 30_000 });
  await firstResult.check();

  await dialog.getByRole("button", { name: /Tambahkan \(1\)/ }).click();
  // Penambahan dari bank memuat ulang halaman; formulir kini punya dua kartu soal.
  await expect(page.locator("main article")).toHaveCount(2, { timeout: 45_000 });
});

test("Sheet impor soal memuat daftar soal dari formulir sumber", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  await openNewForm(page);
  await fillChoice(page, 1, "Tujuan satu?");
  await waitForAutosave(page);

  await page.getByRole("button", { name: "Impor dari formulir lain" }).click();
  const dialog = page.getByRole("dialog", { name: "Impor soal dari formulir lain" });
  await expect(dialog).toBeVisible();

  const source = dialog.getByLabel("Pilih formulir sumber");
  const sourceValues = await source.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
  expect(sourceValues.length).toBeGreaterThan(0);

  await source.selectOption(sourceValues[0]);
  // Daftar soal (atau pesan "belum memiliki soal") muncul setelah formulir sumber dimuat.
  await expect(dialog.locator("ul li").first()).toBeVisible({ timeout: 30_000 });
  await expect(dialog.getByRole("button", { name: /Impor/ }).first()).toBeVisible();
});
