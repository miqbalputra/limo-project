import { expect, test } from "@playwright/test";

const runId = `${Date.now()}`;
const currentYear = new Date().getFullYear();

const PROGRAM_GROUPS = ["Bahasa & Bahasa Arab", "Akademik"];
const PROGRAM_OPTIONS = ["Bahasa Inggris", "Arabic for Kids", "Nahwu", "Math & Academic Support for Akhwat"];

const SELF_FIELDS = ["Nama Lengkap", "Nama Panggilan", "Jenis Kelamin", "Tanggal Lahir", "Nomor WhatsApp", "Email", "Alamat"];
const CHILD_FIELDS_ORDER = [
  "Nama Lengkap Anak",
  "Nama Panggilan Anak",
  "Tanggal Lahir Anak",
  "Nama Orang Tua / Wali",
  "Nomor WhatsApp Orang Tua / Wali",
  "Email Orang Tua / Wali",
  "Alamat",
  "Sekolah Anak",
  "Kelas / Jenjang",
];

const CONSENT_STATEMENTS = [
  "Saya menyatakan bahwa data yang saya berikan adalah benar dan dapat dipertanggungjawabkan.",
  "Saya menyetujui penggunaan data yang diberikan untuk keperluan administrasi, pembelajaran, penjadwalan, dan komunikasi LIMO.",
  "Saya menyetujui LIMO menghubungi saya melalui WhatsApp, telepon, atau email terkait program yang saya pilih.",
];

const DOCUMENTATION_STATEMENTS = [
  "Saya mengizinkan LIMO menggunakan foto atau video peserta untuk dokumentasi kegiatan dan publikasi/promosi LIMO tanpa melakukan blur wajah.",
  "Saya mengizinkan foto atau video peserta digunakan untuk publikasi/promosi LIMO dengan syarat wajah harus diblur.",
];

const SUCCESS_STAGES = ["Pendaftaran Diterima", "Assessment / Konsultasi Awal", "Penempatan Kelas", "Pembayaran", "Enrollment Dikonfirmasi"];

async function expectTexts(page: import("@playwright/test").Page, texts: string[]) {
  for (const text of texts) {
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
  }
}

async function openProgramStep(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Kembali" }).click();
  await page.getByRole("button", { name: "Kembali" }).click();
  await expect(page.getByRole("button", { name: "Lanjutkan Pendaftaran" })).toBeVisible();
}

async function continueToProgramForm(page: import("@playwright/test").Page, programName: string | RegExp) {
  await page.getByRole("radio", { name: programName }).click();
  await page.getByRole("button", { name: "Lanjutkan Pendaftaran" }).click();
  await page.getByRole("button", { name: "Lanjutkan" }).click();
  await expect(page.getByText("Informasi Pembelajaran").first()).toBeVisible();
}

async function selectRadio(page: import("@playwright/test").Page, group: string, option: string) {
  await page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: option }).click();
}

test.describe("Alur pendaftaran v2 sesuai revisi_v2.md", () => {
  test("halaman 1-4 tampil sesuai dokumen dan kirim pendaftaran berhasil", async ({ page }) => {
    test.setTimeout(240_000);

    // HALAMAN 1 — PILIH PROGRAM
    await page.goto("/daftar");
    await expect(page.getByRole("heading", { name: "Pendaftaran Murid Baru" })).toBeVisible();
    await expectTexts(page, ["Pendaftaran LIMO", "Selamat datang di LIMO.", "Pilih Program"]);
    await expect(page.getByRole("radio", { name: /Bahasa Inggris/ })).toBeVisible({ timeout: 30_000 });
    await expectTexts(page, PROGRAM_GROUPS);
    await expectTexts(page, PROGRAM_OPTIONS);
    await expect(page.getByRole("button", { name: "Lanjutkan Pendaftaran" })).toBeVisible();

    await page.getByRole("radio", { name: /Bahasa Inggris/ }).click();
    await page.getByRole("button", { name: "Lanjutkan Pendaftaran" }).click();

    // HALAMAN 2 — DATA PESERTA
    await expect(page.getByText("Data Peserta", { exact: true })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Pendaftaran untuk" }).getByRole("radio", { name: "Diri sendiri" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Pendaftaran untuk" }).getByRole("radio", { name: "Anak" })).toBeVisible();

    await page.getByRole("radio", { name: "Diri sendiri" }).click();
    await expectTexts(page, SELF_FIELDS);

    await page.getByRole("radio", { name: "Anak" }).click();
    await expectTexts(page, CHILD_FIELDS_ORDER);

    const childLabels = await page
      .locator("section")
      .filter({ hasText: "Data Peserta" })
      .locator("label > span")
      .allTextContents();
    const normalized = childLabels.map((text) => text.replace(/\s+/g, " ").replace(/ \*$/, "").replace(/ \(opsional\)$/, "").trim());
    const positions = CHILD_FIELDS_ORDER.map((label) => normalized.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));

    await page.getByLabel(/^Nama Lengkap Anak/).fill(`Anak E2E ${runId}`);
    await page.getByLabel(/^Nama Panggilan Anak/).fill("Aisyah");
    await selectRadio(page, "Jenis kelamin anak", "Perempuan");
    await page.getByLabel(/^Tanggal Lahir Anak/).fill("2016-05-04");
    await page.getByLabel(/^Nama Orang Tua \/ Wali/).fill("Wali E2E");
    await page.getByLabel(/^Nomor WhatsApp Orang Tua \/ Wali/).fill("081234567890");
    await page.getByLabel(/^Email Orang Tua \/ Wali/).fill(`e2e-${runId}@example.test`);
    await page.getByLabel(/^Alamat/).fill("Jl. E2E No. 1");
    await page.getByLabel(/^Sekolah Anak/).fill("SD Negeri 1");
    await page.getByLabel(/^Kelas \/ Jenjang/).fill("Kelas 4");
    await page.getByRole("button", { name: "Lanjutkan" }).click();

    // HALAMAN 3 — FORMULIR PROGRAM BAHASA INGGRIS
    await expect(page.getByText("Formulir Program Bahasa Inggris")).toBeVisible();
    await expectTexts(page, [
      "Informasi Pembelajaran",
      "Siapa yang akan mengikuti program?",
      "Apakah peserta pernah belajar Bahasa Inggris sebelumnya?",
      "Bagaimana kemampuan Bahasa Inggris saat ini?",
      "Kemampuan yang ingin dikembangkan",
      "Apa tujuan utama mengikuti program Bahasa Inggris?",
      "Format pembelajaran",
      "Jenis kelas",
      "Pilihan hari dan waktu",
      "Catatan tambahan",
    ]);
    await expectTexts(page, [
      "Anak",
      "Remaja",
      "Dewasa",
      "Belum pernah",
      "Sedikit",
      "Pernah belajar",
      "Sedang mengikuti kursus",
      "Pemula",
      "Dasar",
      "Menengah",
      "Lanjutan",
      "Tidak yakin",
      "Listening / Mendengarkan",
      "Speaking / Berbicara",
      "Reading / Membaca",
      "Writing / Menulis",
      "Vocabulary / Kosakata",
      "Pronunciation / Pelafalan",
      "Grammar",
      "Confidence / Kepercayaan diri",
      "English for School",
      "English for Work",
      "Conversation",
      "Lainnya",
      "Online",
      "Offline",
      "Privat",
      "Kelompok kecil",
    ]);

    // HALAMAN 3 — cek 3 formulir program lainnya
    await openProgramStep(page);
    await continueToProgramForm(page, /Arabic for Kids/);
    await expect(page.getByText("Formulir Program Bahasa Arab")).toBeVisible();
    await expectTexts(page, [
      "Apakah peserta pernah belajar Bahasa Arab sebelumnya?",
      "Kemampuan Bahasa Arab saat ini",
      "Apa tujuan utama mengikuti program Bahasa Arab?",
      "Sedang belajar",
      "Catatan tambahan",
    ]);

    await openProgramStep(page);
    await continueToProgramForm(page, /^Nahwu/);
    await expect(page.getByText("Formulir Program Nahwu")).toBeVisible();
    await expectTexts(page, [
      "Apakah peserta pernah belajar Nahwu sebelumnya?",
      "Pernah belajar dasar",
      "Sudah cukup memahami dasar Nahwu",
      "Materi yang pernah dipelajari",
      "Apa tujuan utama mengikuti program Nahwu?",
    ]);

    await openProgramStep(page);
    await continueToProgramForm(page, /Math & Academic Support/);
    await expect(page.getByText("Formulir Program Matematika/Bimbel")).toBeVisible();
    await expectTexts(page, [
      "Sekolah / Institusi",
      "Kelas / Tingkat",
      "Bagaimana kemampuan Matematika",
      "Materi yang ingin dipelajari",
      "Tujuan mengikuti program Matematika / bimbel",
      "Apa kesulitan utama yang sedang dialami?",
      "Perlu penguatan dasar",
      "Cukup",
      "Baik",
      "Sangat baik",
      "Memahami materi sekolah",
      "Meningkatkan nilai",
      "Persiapan ujian",
      "Memperkuat konsep dasar",
      "Pendalaman materi",
    ]);

    // Kembali ke Bahasa Inggris dan lengkapi
    await openProgramStep(page);
    await page.getByRole("radio", { name: /Bahasa Inggris/ }).click();
    await page.getByRole("button", { name: "Lanjutkan Pendaftaran" }).click();
    await page.getByRole("button", { name: "Lanjutkan" }).click();
    await expect(page.getByText("Formulir Program Bahasa Inggris")).toBeVisible();

    await selectRadio(page, "Siapa yang akan mengikuti program?", "Anak");
    await selectRadio(page, "Apakah peserta pernah belajar Bahasa Inggris sebelumnya?", "Sedikit");
    await selectRadio(page, "Bagaimana kemampuan Bahasa Inggris saat ini?", "Dasar");
    await page.getByLabel("Listening / Mendengarkan").check();
    await page.getByLabel("Conversation").check();
    await page.getByLabel("Lainnya").first().check();
    await page.getByLabel(/^Apa tujuan utama mengikuti program Bahasa Inggris?/).fill("Meningkatkan kemampuan berbicara.");
    await selectRadio(page, "Format pembelajaran", "Online");
    await selectRadio(page, "Jenis kelas", "Privat");
    await page.getByLabel(/^Pilihan hari dan waktu/).fill("Senin & Rabu, 16.00-17.30");
    await page.getByRole("button", { name: "Lanjutkan" }).click();

    // HALAMAN TERAKHIR — PERSETUJUAN
    await expect(page.getByText("Persetujuan Pendaftaran")).toBeVisible();
    await expectTexts(page, CONSENT_STATEMENTS);
    await expectTexts(page, ["Persetujuan Dokumentasi", ...DOCUMENTATION_STATEMENTS]);
    await expect(page.getByRole("button", { name: "Kembali & Periksa Data" })).toBeVisible();
    await expect(page.getByText("Periksa Data Anda")).toBeVisible();

    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("radio", { name: /tanpa melakukan blur wajah/ }).check();
    await page.getByRole("button", { name: "Kirim Pendaftaran" }).click();

    // PENDAFTARAN BERHASIL
    await page.waitForURL("**/daftar/berhasil", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Pendaftaran Berhasil!" })).toBeVisible();
    await expectTexts(page, ["Terima kasih telah mendaftar di LIMO.", "Data pendaftaran Anda telah berhasil kami terima."]);
    await expectTexts(page, ["Nomor Pendaftaran", "Program", "Peserta", "Status", "Tahapan Selanjutnya", ...SUCCESS_STAGES]);
    await expect(page.getByText(new RegExp(`^LIMO-${currentYear}-`))).toBeVisible();
    await expect(page.getByText("Bahasa Inggris", { exact: true })).toBeVisible();
    await expect(page.getByText(`Anak E2E ${runId}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Pendaftaran Diterima", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Cek Status Pendaftaran" })).toHaveAttribute("href", "/status-pendaftaran");
  });

  test("kirim pendaftaran untuk diri sendiri pada program Nahwu", async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto("/daftar");
    await expect(page.getByRole("radio", { name: /^Nahwu/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("radio", { name: /^Nahwu/ }).click();
    await page.getByRole("button", { name: "Lanjutkan Pendaftaran" }).click();

    await page.getByRole("radio", { name: "Diri sendiri" }).click();
    await page.getByLabel(/^Nama Lengkap \*/).fill(`Diri E2E ${runId}`);
    await page.getByLabel(/^Nama Panggilan/).fill("Fulan");
    await selectRadio(page, "Jenis kelamin", "Laki-laki");
    await page.getByLabel(/^Tanggal Lahir \*/).fill("1998-11-02");
    await page.getByLabel(/^Nomor WhatsApp \*/).fill("081377788899");
    await page.getByLabel(/^Email/).fill(`diri-${runId}@example.test`);
    await page.getByLabel(/^Alamat/).fill("Jl. E2E No. 2");
    await page.getByRole("button", { name: "Lanjutkan" }).click();

    await expect(page.getByText("Formulir Program Nahwu")).toBeVisible();
    await selectRadio(page, "Siapa yang akan mengikuti program?", "Dewasa");
    await selectRadio(page, "Apakah peserta pernah belajar Nahwu sebelumnya?", "Belum pernah");
    await page.getByLabel(/^Materi yang pernah dipelajari/).fill("Belum ada");
    await page.getByLabel(/^Apa tujuan utama mengikuti program Nahwu?/).fill("Memahami kaidah dasar Nahwu.");
    await selectRadio(page, "Format pembelajaran", "Offline");
    await selectRadio(page, "Jenis kelas", "Kelompok kecil");
    await page.getByLabel(/^Pilihan hari dan waktu/).fill("Ahad pagi");
    await page.getByRole("button", { name: "Lanjutkan" }).click();

    await expect(page.getByText("Persetujuan Pendaftaran")).toBeVisible();
    await page.locator('input[type="checkbox"]').nth(0).check();
    await page.locator('input[type="checkbox"]').nth(1).check();
    await page.locator('input[type="checkbox"]').nth(2).check();
    await page.getByRole("radio", { name: /dengan syarat wajah harus diblur/ }).check();
    await page.getByRole("button", { name: "Kirim Pendaftaran" }).click();

    await page.waitForURL("**/daftar/berhasil", { timeout: 30_000 });
    await expect(page.getByText("Nahwu", { exact: true })).toBeVisible();
    await expect(page.getByText(`Diri E2E ${runId}`, { exact: true })).toBeVisible();
    await expect(page.getByText(new RegExp(`^LIMO-${currentYear}-`))).toBeVisible();
  });
});
