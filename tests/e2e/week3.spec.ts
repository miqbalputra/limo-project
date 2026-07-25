import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-dev-only");
  await page.getByRole("button", { name: "Login" }).click();
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
}

test("Week 3 guru attendance and progress UI is mobile friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/presensi");
  await expect(page.getByRole("heading", { name: "Presensi" })).toBeVisible();
  const inputHref = await page.getByRole("link", { name: "Input" }).first().getAttribute("href");
  expect(inputHref).toBeTruthy();
  await expectNoHorizontalOverflow(page);

  await page.goto(inputHref || "/guru/presensi");
  await expect(page.getByRole("button", { name: /Simpan Presensi dan Progres/i })).toBeVisible();
  await expect(page.locator('select[name^="score-"]').first()).toContainText("Pemahaman 5");
  await expectNoHorizontalOverflow(page);
});

test("Week 3 wali graphs, attendance recap, and billing are mobile friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  await page.goto("/wali/progres");
  await expect(page.getByRole("heading", { name: "Progres Anak" })).toBeVisible();
  const progressHref = await page.getByRole("link", { name: "Lihat Ringkasan" }).first().getAttribute("href");
  expect(progressHref).toBeTruthy();
  await page.goto(progressHref || "/wali/progres");
  await expect(page.getByRole("heading", { name: "Grafik Pemahaman" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kehadiran Bulanan" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/wali/presensi");
  await expect(page.getByRole("heading", { name: "Presensi Anak" })).toBeVisible();
  await expect(page.getByText("Rate").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/wali/tagihan");
  await expect(page.getByRole("heading", { name: "Tagihan" })).toBeVisible();
  await expect(page.getByText(/QRIS|Pakasir|Virtual Account/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
