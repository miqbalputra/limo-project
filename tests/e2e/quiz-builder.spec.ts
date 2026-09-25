import AxeBuilder from "@axe-core/playwright";
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
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(link).toHaveValue(/\/kuis\//, { timeout: 30_000 });
});

test("Builder punya handle urut, dan pemutar publik mode satu soal per halaman rapi di 360px", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaForm(page, "guru@limo.local");
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Buat Formulir Baru" })).toBeVisible();

  await page.getByLabel("Judul formulir").fill(`Kuis Satu Soal ${Date.now()}`);
  await page.getByLabel("Kelas").selectOption({ index: 1 });
  await page.getByLabel("Pertanyaan soal 1").fill("Soal pertama?");
  await page.getByLabel("Opsi A soal 1").fill("Ya");
  await page.getByLabel("Opsi B soal 1").fill("Tidak");
  await page.getByRole("button", { name: "Tandai opsi A benar" }).click();
  await page.getByRole("button", { name: "+ Isian singkat" }).click();
  await page.getByLabel("Pertanyaan soal 2").fill("Soal kedua?");
  await page.getByLabel("Kunci jawaban").fill("dua");

  // Handle drag & drop tersedia dan punya label aksesibilitas.
  await expect(page.getByRole("button", { name: "Tarik untuk mengurutkan soal 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tarik untuk mengurutkan opsi A" }).first()).toBeVisible();

  // Kartu soal dapat dilipat dan dibuka kembali.
  await page.getByRole("button", { name: "Lipat soal 1" }).click();
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeHidden();
  await page.getByRole("button", { name: "Buka soal 1" }).click();
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeVisible();

  // Pencarian soal menyaring kartu.
  await page.getByLabel("Cari soal").fill("Soal kedua");
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeHidden();
  await expect(page.getByText("1 dari 2 soal cocok")).toBeVisible();
  await page.getByLabel("Cari soal").fill("");
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeVisible();

  // Jadikan semua soal opsional agar tombol Kumpulkan langsung membuka tinjauan.
  await page.getByRole("checkbox", { name: "Wajib diisi" }).nth(0).uncheck();
  await page.getByRole("checkbox", { name: "Wajib diisi" }).nth(1).uncheck();

  // Setelan: satu soal per halaman.
  await page.getByRole("button", { name: "Pengaturan" }).click();
  await page.getByLabel("Tampilan soal").selectOption("ONE_PER_PAGE");

  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/guru\/kuis\/[^/]+\/edit$/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Publikasikan" }).click();
  await expect(page.getByText("Terbit", { exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Bagikan kuis" }).click();
  const shareValue = await page.getByLabel("Tautan kuis").inputValue();
  const sharePath = new URL(shareValue, page.url()).pathname;
  expect(sharePath).toMatch(/^\/kuis\//);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(sharePath);
  await page.getByRole("button", { name: "Mulai Kerjakan" }).click();

  await expect(page.getByText(/Soal 1 dari 2/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("progressbar", { name: "Progres pengisian" })).toBeVisible();

  // Audit aksesibilitas pemutar publik.
  const axeResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).include("main").analyze();
  expect(axeResults.violations, axeResults.violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);

  // Lanjut ke soal terakhir lalu buka dialog tinjau jawaban.
  await page.getByRole("button", { name: "Berikutnya" }).click();
  await expect(page.getByText(/Soal 2 dari 2/)).toBeVisible();
  await page.getByRole("button", { name: "Kumpulkan Jawaban" }).click();
  const review = page.getByRole("dialog", { name: "Tinjau jawaban" });
  await expect(review).toBeVisible();
  await expect(review).toContainText("terisi");
  await review.getByRole("button", { name: "Kembali" }).click();
  await expect(review).toBeHidden();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
