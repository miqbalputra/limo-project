import { expect, test } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { loginViaForm } from "./support/auth";

let prisma: PrismaClient;
let kelasId = "";
const runId = `${Date.now()}`;
const announcementTitle = `Pengumuman E2E ${runId}`;
const threadTitle = `Diskusi E2E ${runId}`;

test.beforeAll(async () => {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();

  const guru = await prisma.user.findFirstOrThrow({ where: { email: "guru@limo.local" }, select: { guruProfile: { select: { id: true } } } });
  const kelas = await prisma.kelas.findFirstOrThrow({
    where: { guruProfileId: guru.guruProfile!.id, status: "ACTIVE" },
    select: { id: true },
  });
  kelasId = kelas.id;
});

test.afterAll(async () => {
  await prisma.diskusiThread.deleteMany({ where: { title: { startsWith: `Diskusi E2E ${runId}` } } }).catch(() => undefined);
  await prisma.pengumuman.deleteMany({ where: { title: { startsWith: `Pengumuman E2E ${runId}` } } }).catch(() => undefined);
  await prisma.$disconnect();
});

test("Pengumuman dan diskusi kelas berjalan lintas peran", async ({ page }) => {
  test.setTimeout(240_000);

  // 1. Guru membuat pengumuman.
  await loginViaForm(page, "guru@limo.local");
  await page.goto(`/guru/kelas/${kelasId}/pengumuman`);
  await page.getByLabel("Judul pengumuman").fill(announcementTitle);
  await page.getByLabel("Isi pengumuman").fill("Isi pengumuman uji otomatis.");
  await page.getByRole("button", { name: "Buat pengumuman" }).click();
  await expect(page.getByRole("heading", { name: announcementTitle })).toBeVisible({ timeout: 20_000 });

  // 2. Siswa melihat dan menandai sudah dibaca.
  await page.context().clearCookies();
  await loginViaForm(page, "siswa@limo.local");
  await page.goto(`/siswa/kelas/${kelasId}/pengumuman`);
  await expect(page.getByRole("heading", { name: announcementTitle })).toBeVisible();
  await page.getByRole("button", { name: "Tandai sudah dibaca" }).click();
  await expect(page.getByText("Dibaca", { exact: true })).toBeVisible({ timeout: 15_000 });

  // 3. Siswa membuat diskusi kelas.
  await page.goto(`/siswa/kelas/${kelasId}/diskusi`);
  await page.getByLabel("Judul diskusi").fill(threadTitle);
  await page.getByLabel("Isi diskusi").fill("Bagaimana cara mengerjakan soal nomor tiga?");
  await page.getByRole("button", { name: "Buat diskusi" }).click();
  await expect(page.getByRole("link", { name: threadTitle })).toBeVisible({ timeout: 20_000 });

  // 4. Wali membalas diskusi anak.
  await page.context().clearCookies();
  await loginViaForm(page, "wali@limo.local");
  await page.goto("/wali/diskusi");
  await page.getByRole("link", { name: threadTitle }).click();
  await page.getByLabel("Isi balasan").fill("Coba baca kembali materi halaman lima.");
  await page.getByRole("button", { name: "Kirim balasan" }).click();
  await expect(page.getByText("Coba baca kembali materi halaman lima.")).toBeVisible({ timeout: 20_000 });

  // 5. Guru menyematkan diskusi.
  await page.context().clearCookies();
  await loginViaForm(page, "guru@limo.local");
  await page.goto(`/guru/kelas/${kelasId}/diskusi`);
  await page.getByRole("link", { name: threadTitle }).click();
  await page.getByRole("button", { name: "Sematkan" }).click();
  await expect(page.getByText("Disematkan", { exact: true })).toBeVisible({ timeout: 20_000 });
});
