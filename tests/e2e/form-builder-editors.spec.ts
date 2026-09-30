import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

async function startNewForm(page: import("@playwright/test").Page) {
  await loginViaForm(page, "guru@limo.local");
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Buat Formulir Baru" })).toBeVisible();
  await page.getByLabel("Judul formulir").fill(`Editor ${Date.now()}`);
  await page.getByLabel("Kelas").selectOption({ index: 1 });
}

async function addQuestion(page: import("@playwright/test").Page, type: string) {
  const existing = await page.getByLabel(/^Tipe soal \d+$/).count();
  await page.getByRole("button", { name: "+ Isian singkat" }).click();
  await page.getByLabel(`Tipe soal ${existing + 1}`).selectOption(type);
}

async function saveAndWaitForEditUrl(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page).toHaveURL(/\/guru\/kuis\/[^/]+\/edit$/, { timeout: 30_000 });
}

async function openMetadata(page: import("@playwright/test").Page, questionNumber: number) {
  await page.getByText("Metadata & pedagogi").nth(questionNumber - 1).click();
}

test("Builder menyimpan editor skala, urutan, menjodohkan, dan tabel", async ({ page }) => {
  test.setTimeout(180_000);
  await startNewForm(page);

  // Soal 1 -> skala linier
  await page.getByLabel("Pertanyaan soal 1").fill("Seberapa puas kamu?");
  await page.getByLabel("Tipe soal 1").selectOption("SKALA");
  await page.getByLabel("Nilai minimum").fill("0");
  await page.getByLabel("Nilai maksimum").fill("6");
  await page.getByLabel("Label minimum (opsional)").fill("Rendah");
  await page.getByLabel("Label maksimum (opsional)").fill("Tinggi");
  await page.getByLabel("Jawaban benar").selectOption("3");

  // Soal 2 -> urutan
  await addQuestion(page, "URUTAN");
  await page.getByLabel("Pertanyaan soal 2").fill("Urutkan langkahnya");
  await page.getByLabel("Item urutan 1 soal 2").fill("Satu");
  await page.getByLabel("Item urutan 2 soal 2").fill("Dua");
  await page.getByRole("button", { name: "+ Tambah item" }).click();
  await page.getByLabel("Item urutan 3 soal 2").fill("Tiga");

  // Soal 3 -> menjodohkan
  await addQuestion(page, "MENJODOHKAN");
  await page.getByLabel("Pertanyaan soal 3").fill("Pasangkan kata Arabnya");
  await page.getByLabel("Item kiri 1 soal 3").fill("satu");
  await page.getByLabel("Pasangan kanan 1 soal 3").fill("one");
  await page.getByLabel("Item kiri 2 soal 3").fill("dua");
  await page.getByLabel("Pasangan kanan 2 soal 3").fill("two");

  // Soal 4 -> tabel pilihan (butuh isi kolom + baris + kunci)
  await addQuestion(page, "GRID");
  await page.getByLabel("Pertanyaan soal 4").fill("Tabel penilaian");
  await page.getByLabel("Opsi A soal 4").fill("Setuju");
  await page.getByLabel("Opsi B soal 4").fill("Tidak setuju");
  await page.getByLabel("Opsi C soal 4").fill("Ragu");
  await page.getByPlaceholder("Pernyataan 1").fill("Baris satu");
  await page.getByPlaceholder("Pernyataan 2").fill("Baris dua");
  await page.getByLabel("Kunci baris 1").selectOption("A");

  await saveAndWaitForEditUrl(page);

  // Nilai kembali setelah dimuat dari server.
  await expect(page.getByLabel("Nilai maksimum")).toHaveValue("6");
  await expect(page.getByLabel("Label maksimum (opsional)")).toHaveValue("Tinggi");
  await expect(page.getByLabel("Jawaban benar")).toHaveValue("3");
  await expect(page.getByLabel("Item urutan 3 soal 2")).toHaveValue("Tiga");
  await expect(page.getByLabel("Pasangan kanan 2 soal 3")).toHaveValue("two");
  await expect(page.getByPlaceholder("Pernyataan 2")).toHaveValue("Baris dua");
  await expect(page.getByLabel("Kunci baris 1")).toHaveValue("A");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("Builder menyimpan editor cloze, unggah berkas, rubrik, dan metadata", async ({ page }) => {
  test.setTimeout(180_000);
  await startNewForm(page);

  // Soal 1 -> cloze (kunci + stimulus)
  await page.getByLabel("Pertanyaan soal 1").fill("Lengkapi kalimat berikut");
  await page.getByLabel("Tipe soal 1").selectOption("CLOZE");
  await page.getByLabel("Stimulus soal 1").fill("Teks rumpang untuk uji");
  await page.getByLabel("Kunci jawaban").fill("kucing");

  // Soal 2 -> unggah berkas
  await addQuestion(page, "FILE_UPLOAD");
  await page.getByLabel("Pertanyaan soal 2").fill("Unggah berkas tugas");
  await page.getByLabel("Tipe berkas diizinkan (satu per baris, kosong = semua)").fill("application/pdf");
  await page.getByLabel("Ukuran maksimum (MB, 0 = tanpa batas)").fill("2");

  // Soal 3 -> berbicara (rubrik + metadata pedagogis)
  await addQuestion(page, "SPEAKING");
  await page.getByLabel("Pertanyaan soal 3").fill("Rekam suara perkenalan");
  await page.getByLabel("Kriteria rubrik 1 soal 3").fill("Kelancaran");
  await page.getByLabel("Skor maksimum kriteria 1 soal 3").fill("4");
  await openMetadata(page, 3);
  await page.getByLabel("Bahasa konten soal 3").fill("ar");
  await page.getByLabel("Arah konten soal 3").selectOption("rtl");
  await page.getByLabel("Level kognitif soal 3").selectOption("HOTS");
  await page.getByLabel("Keterampilan soal 3").selectOption("SPEAKING");
  await page.getByLabel("Kesulitan soal 3").selectOption("HARD");
  await page.getByLabel("Tipe asesmen soal 3").selectOption("SUMMATIVE");

  await saveAndWaitForEditUrl(page);

  // Nilai kembali setelah dimuat dari server.
  await expect(page.getByLabel("Stimulus soal 1")).toHaveValue("Teks rumpang untuk uji");
  await expect(page.getByLabel("Kunci jawaban")).toHaveValue("kucing");
  await expect(page.getByLabel("Ukuran maksimum (MB, 0 = tanpa batas)")).toHaveValue("2");
  await expect(page.getByLabel("Kriteria rubrik 1 soal 3")).toHaveValue("Kelancaran");
  await expect(page.getByLabel("Skor maksimum kriteria 1 soal 3")).toHaveValue("4");
  await openMetadata(page, 3);
  await expect(page.getByLabel("Bahasa konten soal 3")).toHaveValue("ar");
  await expect(page.getByLabel("Arah konten soal 3")).toHaveValue("rtl");
  await expect(page.getByLabel("Kesulitan soal 3")).toHaveValue("HARD");
  await expect(page.getByLabel("Tipe asesmen soal 3")).toHaveValue("SUMMATIVE");
});
