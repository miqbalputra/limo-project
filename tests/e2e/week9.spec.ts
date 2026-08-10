import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Guru can open Activity Completion progress without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
  await page.goto("/guru/kelas");
  await page.getByRole("link", { name: "Kelola Kelas" }).first().click();
  const progressLink = page.getByRole("link", { name: "Progres Aktivitas" });
  await expect(progressLink).toHaveAttribute("href", /\/progres$/);
  await page.goto(await progressLink.getAttribute("href") || "");
  await expect(page.getByRole("heading", { name: /Progres Aktivitas/ })).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Siswa and Wali can open read-only learning module progress", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "LIMO-DEV-001");
  await expect(page).toHaveURL(/\/siswa$/, { timeout: 15_000 });
  await page.goto("/siswa/kelas");
  await page.getByRole("link", { name: "Buka detail kelas" }).first().click();
  const studentModuleLink = page.getByRole("link", { name: "Lihat Alur Modul" });
  await expect(studentModuleLink).toHaveAttribute("href", /\/modul$/);
  await page.goto(await studentModuleLink.getAttribute("href") || "");
  await expect(page.getByRole("heading", { name: /Alur Belajar/ })).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  await page.goto("/wali/progres");
  await page.getByRole("link", { name: "Detail" }).first().click();
  const waliModuleLink = page.getByRole("link", { name: "Lihat Modul" });
  await expect(waliModuleLink).toHaveAttribute("href", /\/modul$/);
  await page.goto(await waliModuleLink.getAttribute("href") || "");
  await expect(page.getByRole("heading", { name: /Modul Belajar/ })).toBeVisible({ timeout: 15_000 });
});
