import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

test("Guru dapat membuat, mengubah, dan membatalkan sesi kelas", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaForm(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/sesi");
  await expect(page.getByRole("heading", { name: "Tambah sesi" })).toBeVisible();

  const topic = `Sesi E2E ${Date.now()}`;
  const updatedTopic = `${topic} revisi`;
  await page.getByLabel("Kelas sesi baru").selectOption({ index: 0 });
  await page.getByLabel("Pertemuan ke").first().fill(String(100 + (Date.now() % 500)));
  await page.getByLabel("Topik").first().fill(topic);
  await page.getByLabel("Tanggal sesi").first().fill("2026-10-01");
  await page.getByRole("button", { name: "Simpan sesi" }).click();

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
  await expect(page.getByRole("heading", { name: "Antrean penilaian esai" })).toBeVisible();
  await expect(page.getByText("Mid Semester Demo English")).toBeVisible();

  const koreksiHref = await page.getByRole("link", { name: "Nilai jawaban" }).first().getAttribute("href");
  if (!koreksiHref) throw new Error("Tautan koreksi tidak ditemukan di antrean penilaian esai");
  const ujianId = koreksiHref.split("/")[3];

  await page.goto(koreksiHref);
  await expect(page.getByRole("heading", { name: /^Koreksi:/ })).toBeVisible();
  await page.getByPlaceholder("Alasan koreksi").fill("Skor esai dilengkapi saat verifikasi");
  await page.getByPlaceholder("Skor manual, kosongkan jika perlu ditinjau").first().fill("45");
  await page.getByRole("button", { name: "Simpan Koreksi" }).click();

  await page.goto(`/guru/ujian/${ujianId}/hasil`);
  await expect(page.getByText(/Status Dikoreksi/)).toBeVisible({ timeout: 15_000 });

  const releaseButtons = page.getByRole("button", { name: "Rilis nilai ke siswa/wali" });
  await expect(releaseButtons).toHaveCount(2);
  await releaseButtons.last().click();
  await expect(page.getByText("Nilai dirilis")).toBeVisible({ timeout: 15_000 });
});
