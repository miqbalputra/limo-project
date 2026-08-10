import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Guru can reach the structured module builder from class detail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
  await page.goto("/guru/kelas");
  await page.getByRole("link", { name: "Kelola Kelas" }).first().click();
  await page.getByRole("link", { name: "Susun Modul" }).click();
  await expect(page).toHaveURL(/\/guru\/kelas\/[^/]+\/modul$/);
  await expect(page.getByRole("heading", { name: "Buat alur belajar baru" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Siswa and Wali can reach read-only module structures", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "LIMO-DEV-001");
  await expect(page).toHaveURL(/\/siswa$/);
  await page.goto("/siswa/kelas");
  await page.getByRole("link", { name: "Buka detail kelas" }).first().click();
  const studentModuleHref = await page.getByRole("link", { name: "Lihat Alur Modul" }).getAttribute("href");
  await page.goto(studentModuleHref || "");
  await expect(page.getByRole("heading", { name: /Alur Belajar/ })).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/);
  await page.goto("/wali/progres");
  await page.getByRole("link", { name: "Detail" }).first().click();
  const waliModuleHref = await page.getByRole("link", { name: "Lihat Modul" }).getAttribute("href");
  await page.goto(waliModuleHref || "");
  await expect(page.getByRole("heading", { name: /Modul Belajar/ })).toBeVisible({ timeout: 15_000 });
});
