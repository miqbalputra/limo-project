import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { loginViaForm } from "./support/auth";

// Mikrofon palsu agar MediaRecorder benar-benar menghasilkan berkas audio di headless.
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

let prisma: PrismaClient;
const ujianIds: string[] = [];
const bankSoalIds: string[] = [];
const runId = `${Date.now()}`;
const examTitle = `Ujian Mandiri E2E ${runId}`;
const secureExamTitle = `Ujian Aman E2E ${runId}`;

test.beforeAll(async () => {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();

  const siswa = await prisma.siswa.findFirstOrThrow({ where: { nomorInduk: "LIMO-DEV-001" }, select: { id: true } });
  const enrollment = await prisma.kelasSiswa.findFirstOrThrow({ where: { siswaId: siswa.id, status: "ACTIVE" }, select: { kelasId: true } });

  const choice = await prisma.bankSoal.create({
    data: {
      kelasId: enrollment.kelasId,
      type: "PILIHAN_GANDA",
      question: "Ibu kota Indonesia? (uji siswa)",
      expectedAnswer: "A",
      options: {
        create: [
          { label: "A", content: "Jakarta", isCorrect: true, order: 0 },
          { label: "B", content: "Bandung", isCorrect: false, order: 1 },
        ],
      },
    },
    select: { id: true },
  });
  const upload = await prisma.bankSoal.create({
    data: {
      kelasId: enrollment.kelasId,
      type: "FILE_UPLOAD",
      question: "Rekam jawaban suara Anda (uji siswa)",
      fileUploadConfig: { allowedTypes: ["audio/webm"], maxSizeMb: 5 },
      options: { create: [] },
    },
    select: { id: true },
  });
  bankSoalIds.push(choice.id, upload.id);

  const ujian = await prisma.ujian.create({
    data: {
      kelasId: enrollment.kelasId,
      title: examTitle,
      description: "Ujian uji otomatis.",
      status: "PUBLISHED",
      deliveryMode: "ONLINE_VIA_SISWA",
      durationMinutes: 30,
      maxAttempts: 2,
      showResultToSiswa: true,
      showResultToWali: true,
      questions: {
        create: [
          { bankSoalId: choice.id, order: 0, weight: 1, required: true },
          { bankSoalId: upload.id, order: 1, weight: 1, required: true },
        ],
      },
    },
    select: { id: true },
  });
  ujianIds.push(ujian.id);

  // Ujian mode aman: satu soal esai untuk menguji anti-tempel + tombol layar penuh.
  const essay = await prisma.bankSoal.create({
    data: { kelasId: enrollment.kelasId, type: "ESAI", question: "Ceritakan kegiatanmu (uji mode aman)", options: { create: [] } },
    select: { id: true },
  });
  bankSoalIds.push(essay.id);

  const secureExam = await prisma.ujian.create({
    data: {
      kelasId: enrollment.kelasId,
      title: secureExamTitle,
      status: "PUBLISHED",
      deliveryMode: "ONLINE_VIA_SISWA",
      durationMinutes: 30,
      maxAttempts: 1,
      secureMode: true,
      showResultToSiswa: true,
      questions: { create: [{ bankSoalId: essay.id, order: 0, weight: 1, required: false }] },
    },
    select: { id: true },
  });
  ujianIds.push(secureExam.id);
});

test.afterAll(async () => {
  for (const id of ujianIds) {
    await prisma.hasilUjian.deleteMany({ where: { ujianId: id } }).catch(() => undefined);
    await prisma.ujian.delete({ where: { id } }).catch(() => undefined);
  }
  if (bankSoalIds.length > 0) await prisma.bankSoal.deleteMany({ where: { id: { in: bankSoalIds } } }).catch(() => undefined);
  await prisma.$disconnect();
});

test("Siswa mengerjakan ujian mandiri dan merekam jawaban suara", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaForm(page, "siswa@limo.local");
  await page.goto("/siswa/ujian");
  await expect(page.getByRole("heading", { name: "Ujian Saya" })).toBeVisible();

  const card = page.getByRole("article").filter({ hasText: examTitle });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: /Buka instruksi|Lanjutkan/ }).click();
  await expect(page.getByRole("heading", { name: examTitle })).toBeVisible();

  await page.getByRole("button", { name: "Mulai Kerjakan" }).click();
  await expect(page).toHaveURL(/\/siswa\/ujian\/attempt\/[^/]+$/, { timeout: 30_000 });

  // Soal pilihan ganda.
  await expect(page.getByText("Ibu kota Indonesia? (uji siswa)")).toBeVisible();
  await page.getByRole("radio").first().check();

  // Rekaman suara langsung (MediaRecorder) untuk soal unggah berkas.
  await expect(page.getByText("Rekam jawaban suara Anda (uji siswa)")).toBeVisible();
  await page.getByRole("button", { name: "Mulai Rekam" }).click();
  const stopButton = page.getByRole("button", { name: "Berhenti" });
  await expect(stopButton).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await stopButton.click();

  // Hasil rekaman terunggah dan muncul sebagai berkas jawaban.
  await expect(page.getByRole("link", { name: /rekaman-\d+\.webm/i })).toBeVisible({ timeout: 30_000 });

  const axeResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).include("main").analyze();
  expect(axeResults.violations, axeResults.violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n")).toEqual([]);

  await page.getByRole("button", { name: "Kumpulkan Jawaban" }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Ya, kumpulkan" }).click();

  await expect(page).toHaveURL(/\/siswa\/ujian$/, { timeout: 30_000 });
  await expect(page.getByRole("article").filter({ hasText: examTitle })).toBeVisible();
});

test("Mode aman menampilkan kontrol layar penuh dan mencatat upaya tempel", async ({ page }) => {
  test.setTimeout(180_000);

  await loginViaForm(page, "siswa@limo.local");
  await page.goto("/siswa/ujian");
  const card = page.getByRole("article").filter({ hasText: secureExamTitle });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: /Buka instruksi|Lanjutkan/ }).click();
  await page.getByRole("button", { name: "Mulai Kerjakan" }).click();
  await expect(page).toHaveURL(/\/siswa\/ujian\/attempt\/[^/]+$/, { timeout: 30_000 });

  await expect(page.getByRole("button", { name: "Aktifkan layar penuh" })).toBeVisible();
  await expect(page.getByText("Mode aman · 0 peringatan")).toBeVisible();

  // Upaya menempel teks dicatat sebagai pelanggaran.
  await page.locator("textarea").first().focus();
  await page.evaluate(() => {
    const field = document.querySelector("textarea");
    field?.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true }));
  });
  await expect(page.getByText("Mode aman · 1 peringatan")).toBeVisible({ timeout: 10_000 });
});
