import { expect, test } from "@playwright/test";
import { loginViaForm, waitHydrated } from "./support/auth";

test("Guru dapat membuat, mengubah, dan membatalkan sesi kelas", async ({ page }) => {
  test.setTimeout(240_000);
  await loginViaForm(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/sesi");
  await waitHydrated(page);
  await expect(page.getByRole("heading", { name: "Tambah sesi" })).toBeVisible();

  const topic = `Sesi E2E ${Date.now()}`;
  const updatedTopic = `${topic} revisi`;
  await page.getByLabel("Kelas sesi baru").selectOption({ index: 0 });
  await page.getByLabel("Pertemuan ke").first().fill(String(100 + (Date.now() % 500)));
  await page.getByLabel("Topik").first().fill(topic);
  await page.getByLabel("Tanggal sesi").first().fill("2026-10-01");
  // Tombol bisa ter-disable sesaat saat daftar kelas diambil ulang.
  const simpanButton = page.getByRole("button", { name: "Simpan sesi" });
  await expect(simpanButton).toBeEnabled({ timeout: 30_000 });
  await simpanButton.click();

  const card = page.locator("article", { hasText: topic });
  await expect(card).toBeVisible({ timeout: 15_000 });

  await card.getByRole("button", { name: "Edit sesi" }).click();
  await card.getByLabel("Topik").fill(updatedTopic);
  await card.getByRole("button", { name: "Simpan perubahan" }).click();

  const updatedCard = page.locator("article", { hasText: updatedTopic });
  await expect(updatedCard).toBeVisible({ timeout: 15_000 });

  await updatedCard.getByRole("button", { name: "Batalkan sesi" }).click();
  await page.getByRole("button", { name: "Ya, batalkan sesi" }).click();
  await expect(updatedCard.getByText("Dibatalkan")).toBeVisible({ timeout: 15_000 });
});

test("Guru dapat mengoreksi esai dari antrean lalu merilis nilai", async ({ page }) => {
  test.setTimeout(180_000);
  await loginViaForm(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/penilaian-esai");
  await waitHydrated(page);
  await expect(page.getByRole("heading", { name: "Antrean penilaian esai" })).toBeVisible();
  await expect(page.getByText("Mid Semester Demo English")).toBeVisible();

  const koreksiHref = await page.getByRole("link", { name: "Nilai jawaban" }).first().getAttribute("href");
  if (!koreksiHref) throw new Error("Tautan koreksi tidak ditemukan di antrean penilaian esai");
  const ujianId = koreksiHref.split("/")[3];

  await page.goto(koreksiHref);
  await waitHydrated(page);
  await expect(page.getByRole("heading", { name: /^Koreksi:/ })).toBeVisible();
  await page.getByPlaceholder("Alasan koreksi").fill("Skor esai dilengkapi saat verifikasi");
  await page.getByPlaceholder("Skor manual, kosongkan jika perlu ditinjau").first().fill("45");
  // Tunggu POST koreksi selesai sebelum pindah halaman — goto yang mendahului
  // commit membuat halaman hasil dirender dari status lama (flaky).
  const koreksiResponse = page.waitForResponse((response) => response.url().includes("/correction") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Simpan Koreksi" }).click();
  expect((await koreksiResponse).ok()).toBeTruthy();

  await page.goto(`/guru/ujian/${ujianId}/hasil`);
  await waitHydrated(page);
  await expect(page.getByText(/Status Dikoreksi/)).toBeVisible({ timeout: 15_000 });

  const releaseButtons = page.getByRole("button", { name: "Rilis nilai ke siswa/wali" });
  await expect(releaseButtons).toHaveCount(2);
  await releaseButtons.last().click();
  await expect(page.getByText("Nilai dirilis")).toBeVisible({ timeout: 15_000 });
});
