import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

async function startNewForm(page: import("@playwright/test").Page) {
  await loginViaForm(page, "guru@limo.local");
  await page.goto("/guru/kuis/baru");
  await expect(page.getByRole("heading", { name: "Formulir baru" })).toBeVisible();
  await page.getByLabel("Judul formulir").fill(`Editor ${Date.now()}`);
}

async function addQuestion(page: import("@playwright/test").Page, typeLabel: string) {
  await page.getByRole("button", { name: "+ Pertanyaan" }).click();
  await page.getByRole("button", { name: new RegExp(typeLabel) }).click();
}

async function waitForAutosave(page: import("@playwright/test").Page) {
  await expect(page).toHaveURL(/\/guru\/kuis\/[^/]+\/edit$/, { timeout: 30_000 });
  await expect(page.getByText("Semua perubahan tersimpan", { exact: true })).toBeVisible({ timeout: 30_000 });
}

async function openMetadata(page: import("@playwright/test").Page, _questionNumber: number) {
  const metaToggle = page.getByRole("button", { name: "Metadata" }).first();
  if ((await metaToggle.getAttribute("aria-expanded")) !== "true") {
    await metaToggle.click();
  }
}

test("Builder menyimpan editor skala, urutan, menjodohkan, dan tabel", async ({ page }) => {
  test.setTimeout(180_000);
  await startNewForm(page);

  // Soal 1 -> skala linier
  await page.getByLabel("Pertanyaan soal 1").fill("Seberapa puas kamu?");
  await page.getByLabel("Tipe soal 1").selectOption("SKALA");
  await page.getByLabel("Skala dari").fill("0");
  await page.getByLabel("Sampai", { exact: true }).fill("6");
  await page.getByLabel("Label sisi kiri (opsional)").fill("Rendah");
  await page.getByLabel("Label sisi kanan (opsional)").fill("Tinggi");
  await page.getByLabel("Jawaban benar (skor penuh)").fill("3");

  // Soal 2 -> urutan
  await addQuestion(page, "Urutkan");
  await page.getByLabel("Pertanyaan soal 2").fill("Urutkan langkahnya");
  await page.getByLabel("Item urutan 1").fill("Satu");
  await page.getByLabel("Item urutan 2").fill("Dua");
  await page.getByRole("button", { name: "+ Tambah item" }).click();
  await page.getByLabel("Item urutan 3").fill("Tiga");

  // Soal 3 -> menjodohkan
  await addQuestion(page, "Menjodohkan");
  await page.getByLabel("Pertanyaan soal 3").fill("Pasangkan kata Arabnya");
  await page.getByLabel("Pasangan kiri 1").fill("satu");
  await page.getByLabel("Pasangan kanan 1").fill("one");
  await page.getByLabel("Pasangan kiri 2").fill("dua");
  await page.getByLabel("Pasangan kanan 2").fill("two");

  // Soal 4 -> tabel pilihan (butuh isi kolom + baris + kunci)
  await addQuestion(page, "Kisi-kisi");
  await page.getByLabel("Pertanyaan soal 4").fill("Tabel penilaian");
  await page.getByLabel("Teks opsi A").fill("Setuju");
  await page.getByLabel("Teks opsi B").fill("Tidak setuju");
  await page.getByLabel("Teks opsi C").fill("Ragu");
  await page.getByLabel("Baris 1", { exact: true }).fill("Baris satu");
  await page.getByLabel("Baris 2", { exact: true }).fill("Baris dua");
  await page.getByLabel("Kunci kolom untuk baris 1").selectOption("A");

  await waitForAutosave(page);

  // Nilai kembali setelah dimuat dari server — aktifkan kartu satu per satu.
  await page.getByRole("button", { name: /Seberapa puas kamu\?/ }).click();
  await expect(page.getByLabel("Sampai", { exact: true })).toHaveValue("6");
  await expect(page.getByLabel("Label sisi kanan (opsional)")).toHaveValue("Tinggi");
  await expect(page.getByLabel("Jawaban benar (skor penuh)")).toHaveValue("3");

  await page.getByRole("button", { name: /Urutkan langkahnya/ }).click();
  await expect(page.getByLabel("Item urutan 3")).toHaveValue("Tiga");

  await page.getByRole("button", { name: /Pasangkan kata Arabnya/ }).click();
  await expect(page.getByLabel("Pasangan kanan 2")).toHaveValue("two");

  await page.getByRole("button", { name: /Tabel penilaian/ }).click();
  await expect(page.getByLabel("Kunci kolom untuk baris 1")).toHaveValue("A");

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
  await page.getByRole("button", { name: "Kunci jawaban" }).click();
  await page.getByLabel("Kunci jawaban", { exact: true }).fill("kucing");

  // Soal 2 -> unggah berkas
  await addQuestion(page, "Unggah berkas");
  await page.getByLabel("Pertanyaan soal 2").fill("Unggah berkas tugas");
  await page.getByLabel("Tipe berkas diizinkan (satu per baris, kosong = semua)").fill("application/pdf");
  await page.getByLabel("Ukuran maksimum (MB, 0 = tanpa batas)").fill("2");

  // Soal 3 -> berbicara (rubrik + metadata pedagogis)
  await addQuestion(page, "Berbicara");
  await page.getByLabel("Pertanyaan soal 3").fill("Rekam suara perkenalan");
  await page.getByLabel("Kriteria rubrik 1").fill("Kelancaran");
  await page.getByLabel("Nilai maksimum kriteria 1").fill("4");
  await openMetadata(page, 3);
  await page.getByLabel("Bahasa konten soal 3").fill("ar");
  await page.getByLabel("Arah konten soal 3").selectOption("rtl");
  await page.getByLabel("Level kognitif soal 3").selectOption("HOTS");
  await page.getByLabel("Kesulitan soal 3").selectOption("HARD");
  await page.getByLabel("Tipe asesmen soal 3").selectOption("SUMMATIVE");

  await waitForAutosave(page);

  // Nilai kembali setelah dimuat dari server — aktifkan kartu cloze lalu buka kunci
  // bila masih tertutup (panel kunci bertahan per kartu, seperti Google Forms).
  await page.getByRole("button", { name: /Lengkapi kalimat berikut/ }).click();
  await expect(page.getByLabel("Pertanyaan soal 1")).toBeVisible();
  const keyToggle = page.getByRole("button", { name: "Kunci jawaban" });
  if ((await keyToggle.getAttribute("aria-pressed")) !== "true") {
    await keyToggle.click();
  }
  await expect(page.getByLabel("Kunci jawaban", { exact: true })).toHaveValue("kucing");
  await expect(page.getByLabel("Stimulus soal 1")).toHaveValue("Teks rumpang untuk uji");

  await page.getByRole("button", { name: /Unggah berkas tugas/ }).click();
  await expect(page.getByLabel("Ukuran maksimum (MB, 0 = tanpa batas)")).toHaveValue("2");

  await page.getByRole("button", { name: /Rekam suara perkenalan/ }).click();
  await expect(page.getByLabel("Kriteria rubrik 1")).toHaveValue("Kelancaran");
  await expect(page.getByLabel("Nilai maksimum kriteria 1")).toHaveValue("4");
  await openMetadata(page, 3);
  await expect(page.getByLabel("Bahasa konten soal 3")).toHaveValue("ar");
  await expect(page.getByLabel("Arah konten soal 3")).toHaveValue("rtl");
  await expect(page.getByLabel("Kesulitan soal 3")).toHaveValue("HARD");
  await expect(page.getByLabel("Tipe asesmen soal 3")).toHaveValue("SUMMATIVE");
});
