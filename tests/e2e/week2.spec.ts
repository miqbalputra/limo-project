import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
}

test("Week 2 guru LMS and exam pages are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/materi");
  await expect(page.getByRole("heading", { name: "Materi Pembelajaran" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kelola Materi" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const materiHref = await page.getByRole("link", { name: "Kelola Materi" }).first().getAttribute("href");
  expect(materiHref).toBeTruthy();
  await page.goto(materiHref || "/guru/materi");
  await expect(page.getByRole("heading", { name: "Kelola Kelas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tambah Materi" })).toBeVisible();
  await expect(page.locator('select[name="type"]')).toContainText("PDF");
  await expectNoHorizontalOverflow(page);

  await page.goto("/guru/bank-soal");
  await expect(page.getByRole("heading", { name: "Assessment Bank", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tambah Bank Soal" })).toBeVisible();
  await expect(page.getByPlaceholder("Tulis pertanyaan atau prompt untuk siswa")).toBeVisible();
  await expect(page.locator('select[name="type"]')).toContainText("Roleplay");
  await expectNoHorizontalOverflow(page);

  await page.goto("/guru/ujian");
  await expect(page.getByRole("heading", { name: "Ujian", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Buat Ujian" })).toBeVisible();
  await expect(page.getByPlaceholder("Durasi ujian dalam menit")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const hasilHref = await page.getByRole("link", { name: "Input Hasil" }).first().getAttribute("href");
  expect(hasilHref).toBeTruthy();
  await page.goto(hasilHref || "/guru/ujian");
  await expect(page.getByRole("heading", { name: "Input Hasil Offline" })).toBeVisible();
  await expect(page.getByText(/Timer \d{2}:\d{2}/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Week 2 wali score history is readable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  await page.goto("/wali/nilai");
  await expect(page.getByRole("heading", { name: "Riwayat Nilai" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mid Semester Demo English" })).toBeVisible();
  await expect(page.getByText("Skor").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
