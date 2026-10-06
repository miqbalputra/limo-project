import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

test("Guru dapat membuat formulir kuis ala Google Forms dan membagikannya", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaForm(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Formulir baru" })).toBeVisible();

  await page.getByLabel("Judul formulir").fill("Kuis E2E Builder");
  await page.getByLabel("Pertanyaan soal 1").fill("Ibu kota Indonesia?");
  await page.getByLabel("Teks opsi A").fill("Jakarta");
  await page.getByLabel("Teks opsi B").fill("Bandung");
  await page.getByRole("radio", { name: "Tandai jawaban benar opsi A" }).check();

  // Tambah soal kedua (isian) lewat menu tambah pertanyaan ala Google Forms.
  await page.getByRole("button", { name: "+ Pertanyaan" }).click();
  await page.getByRole("button", { name: /Isian singkat/ }).click();
  await page.getByLabel("Pertanyaan soal 2").fill("Lambang air?");
  await page.getByRole("button", { name: "Kunci jawaban" }).click();
  await page.getByLabel("Kunci jawaban", { exact: true }).fill("H2O");
  await expect(page.getByText("Semua perubahan tersimpan")).toBeVisible({ timeout: 30_000 });

  // Duplikat soal lalu hapus salinannya agar tidak mengganggu.
  await page.getByRole("button", { name: "Duplikat soal" }).click();
  const duplicated = page.getByRole("button", { name: /Lambang air\?/ });
  await expect(duplicated).toBeVisible({ timeout: 30_000 });
  await duplicated.click();
  await page.getByRole("button", { name: "Hapus soal" }).click();
  await expect(page.getByRole("button", { name: /Lambang air\?/ })).toHaveCount(0);

  // Kirim → preflight verifikasi kunci → publikasi.
  await page.getByRole("button", { name: "Kirim" }).click();
  const preflight = page.getByRole("dialog", { name: "Verifikasi formulir" });
  await expect(preflight).toBeVisible({ timeout: 30_000 });
  await expect(preflight.getByText("belum siap dikirim")).toBeVisible(); // mode online default tanpa kelas

  // Pilih kelas lewat sheet pengaturan lalu kirim ulang.
  await preflight.getByLabel("Tutup", { exact: true }).click();
  await page.getByRole("button", { name: "Pengaturan formulir" }).click();
  const settings = page.getByRole("dialog", { name: "Pengaturan formulir" });
  await settings.getByLabel(/Kelas \(opsional/).selectOption({ index: 1 });
  await settings.getByRole("button", { name: "Tutup" }).click();

  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByRole("dialog", { name: "Verifikasi formulir" }).getByText("Semua kunci jawaban terpasang")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Publikasikan sekarang" }).click();

  const share = page.getByRole("dialog", { name: "Formulir siap dikirim" });
  const link = share.getByLabel("Tautan publik formulir");
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(link).toHaveValue(/\/kuis\//, { timeout: 30_000 });
});

test("Builder punya handle urut, dan pemutar publik mode satu soal per halaman rapi di 360px", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaForm(page, "guru@limo.local");
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Formulir baru" })).toBeVisible();

  await page.getByLabel("Judul formulir").fill(`Kuis Satu Soal ${Date.now()}`);
  await page.getByLabel("Pertanyaan soal 1").fill("Soal pertama?");
  await page.getByLabel("Teks opsi A").fill("Ya");
  await page.getByLabel("Teks opsi B").fill("Tidak");
  await page.getByRole("radio", { name: "Tandai jawaban benar opsi A" }).check();

  await page.getByRole("button", { name: "+ Pertanyaan" }).click();
  await page.getByRole("button", { name: /Isian singkat/ }).click();
  await page.getByLabel("Pertanyaan soal 2").fill("Soal kedua?");
  await page.getByRole("button", { name: "Kunci jawaban" }).click();
  await page.getByLabel("Kunci jawaban", { exact: true }).fill("dua");

  // Handle drag & drop tersedia dan punya label aksesibilitas (kartu aktif).
  await expect(page.getByRole("button", { name: "Tarik untuk mengurutkan soal 2" })).toBeVisible();

  // Kartu non-aktif bisa diklik untuk diaktifkan (kartu aktif penuh editor).
  await page.getByRole("button", { name: /Soal pertama\?/ }).click();
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tarik untuk mengurutkan opsi A" }).first()).toBeVisible();

  // Pencarian soal menyaring kartu; setelah dibersihkan kartu aktif kembali tampil.
  await page.getByLabel("Cari soal").fill("Soal kedua");
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeHidden();
  await page.getByLabel("Cari soal").fill("");
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeVisible();

  // Jadikan semua soal opsional agar tombol Kumpulkan langsung membuka tinjauan.
  await page.getByLabel("Wajib", { exact: true }).uncheck();
  await page.getByRole("button", { name: /Soal kedua\?/ }).click();
  await page.getByLabel("Wajib", { exact: true }).uncheck();

  // Setelan: satu soal per halaman.
  await page.getByRole("button", { name: "Pengaturan formulir" }).click();
  const settings = page.getByRole("dialog", { name: "Pengaturan formulir" });
  await settings.getByLabel("Tampilan soal").selectOption("ONE_PER_PAGE");
  await settings.getByLabel(/Kelas \(opsional/).selectOption({ index: 1 });
  await settings.getByRole("button", { name: "Tutup" }).click();

  await expect(page.getByText("Semua perubahan tersimpan")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Kirim" }).click();
  await expect(page.getByRole("dialog", { name: "Verifikasi formulir" }).getByText("Semua kunci jawaban terpasang")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Publikasikan sekarang" }).click();

  const share = page.getByRole("dialog", { name: "Formulir siap dikirim" });
  const linkInput = share.getByLabel("Tautan publik formulir");
  await expect(linkInput).toHaveValue(/\/kuis\//, { timeout: 30_000 });
  const shareValue = await linkInput.inputValue();
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
