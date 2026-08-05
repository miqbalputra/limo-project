import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
  const dashboard = identifier.startsWith("guru") ? /\/guru$/ : identifier.startsWith("wali") ? /\/wali$/ : /\/siswa$/;
  await expect(page).toHaveURL(dashboard, { timeout: 15_000 });
}

test("Guru can reach assignment builder and Siswa can open an assignment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await page.goto("/guru/kelas");
  await page.getByRole("link", { name: "Kelola Kelas" }).first().click();
  const guruTaskHref = await page.getByRole("link", { name: "Kelola Tugas" }).getAttribute("href");
  expect(guruTaskHref).toBeTruthy();
  await page.goto(guruTaskHref!);
  await expect(page.getByRole("heading", { name: "Buat tugas baru" })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "LIMO-DEV-001");
  await page.goto("/siswa/kelas");
  await page.getByRole("link", { name: "Buka detail kelas" }).first().click();
  const studentTaskHref = await page.getByRole("link", { name: "Lihat Tugas" }).getAttribute("href");
  expect(studentTaskHref).toBeTruthy();
  await page.goto(studentTaskHref!);
  await expect(page.getByRole("heading", { name: /Tugas/ }).first()).toBeVisible();
  await page.getByRole("link", { name: /Buka Tugas|Lanjutkan Draft/ }).first().click();
  await expect(page.getByRole("heading", { name: "Jawaban Anda" })).toBeVisible();
});

test("Wali can reach the read-only assignment monitoring page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await page.goto("/wali/progres");
  await page.getByRole("link", { name: "Detail" }).first().click();
  const waliTaskHref = await page.getByRole("link", { name: "Lihat Tugas" }).getAttribute("href");
  expect(waliTaskHref).toBeTruthy();
  await page.goto(waliTaskHref!);
  await expect(page.getByRole("heading", { name: /Tugas/ }).first()).toBeVisible();
});
