import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

test("Guru dapat membuat formulir kuis ala Google Forms dan membagikannya", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaForm(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Buat Formulir Baru" })).toBeVisible();

  // Validasi: belum pilih kelas → error
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Pilih kelas terlebih dahulu." })).toBeVisible();

  await page.getByLabel("Judul formulir").fill("Kuis E2E Builder");
  await page.getByLabel("Kelas").selectOption({ index: 1 });
  await page.getByLabel("Pertanyaan soal 1").fill("Ibu kota Indonesia?");
  await page.getByLabel("Opsi A soal 1").fill("Jakarta");
  await page.getByLabel("Opsi B soal 1").fill("Bandung");
  await page.getByRole("button", { name: "Tandai opsi A benar" }).click();

  // Tambah soal kedua (isian)
  await page.getByRole("button", { name: "+ Isian singkat" }).click();
  await page.getByLabel("Pertanyaan soal 2").fill("Lambang air?");
  await page.getByLabel("Kunci jawaban").fill("H2O");
  await expect(page.getByText("Soal 2")).toBeVisible();

  // Duplikat soal lalu hapus agar tidak mengganggu
  await page.getByRole("button", { name: "Duplikat" }).first().click();
  await expect(page.getByText("Soal 3")).toBeVisible();
  await page.getByRole("button", { name: "Hapus" }).last().click();
  await expect(page.getByText("Soal 3")).toHaveCount(0);

  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/guru\/kuis\/[^/]+\/edit$/, { timeout: 30_000 });

  await page.getByRole("button", { name: "Publikasikan" }).click();
  await expect(page.getByText("Terbit", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Bagikan kuis" }).click();
  const link = page.getByLabel("Tautan kuis");
  await expect(link).toBeVisible();
  await expect(link).toHaveValue(/\/kuis\//);
});
