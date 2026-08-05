import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Guru can open Calendar and To-do without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
  await page.goto("/guru/kalender");
  await expect(page.getByRole("heading", { name: "Kalender Guru" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tambah pengumuman atau hari libur" })).toBeVisible();
  await page.goto("/guru/todo");
  await expect(page.getByRole("heading", { name: "To-do Guru" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Siswa and Wali can open scoped Calendar and To-do pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "LIMO-DEV-001");
  await expect(page).toHaveURL(/\/siswa$/);
  await page.goto("/siswa/kalender");
  await expect(page.getByRole("heading", { name: "Kalender Saya" })).toBeVisible();
  await page.goto("/siswa/todo");
  await expect(page.getByRole("heading", { name: "To-do Saya" })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/);
  await page.goto("/wali/kalender");
  await expect(page.getByRole("heading", { name: "Kalender Anak" })).toBeVisible();
  await page.goto("/wali/todo");
  await expect(page.getByRole("heading", { name: "To-do Anak" })).toBeVisible();
});
