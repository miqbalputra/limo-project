import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Guru can open the scoped Remedial manager", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });
  await page.goto("/guru/kelas");
  await page.getByRole("link", { name: "Kelola Kelas" }).first().click();
  const remedialLink = page.getByRole("link", { name: "Remedial" });
  await expect(remedialLink).toHaveAttribute("href", /\/remedial$/);
  await page.goto(await remedialLink.getAttribute("href") || "");
  await expect(page.getByRole("heading", { name: /Remedial/ }).first()).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Siswa and Wali can open read-only remedial views", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "LIMO-DEV-001");
  await expect(page).toHaveURL(/\/siswa$/, { timeout: 15_000 });
  await page.goto("/siswa/remedial");
  await expect(page.getByRole("heading", { name: "Remedial Saya" })).toBeVisible({ timeout: 15_000 });

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  await page.goto("/wali/progres");
  const detailLink = page.getByRole("link", { name: "Detail" }).first();
  await expect(detailLink).toHaveAttribute("href", /\/wali\/progres\//);
  await page.goto(await detailLink.getAttribute("href") || "");
  const remedialLink = page.getByRole("link", { name: "Remedial" });
  await expect(remedialLink).toHaveAttribute("href", /\/remedial$/);
  await page.goto(await remedialLink.getAttribute("href") || "");
  await expect(page.getByRole("heading", { name: /Remedial/ }).first()).toBeVisible({ timeout: 15_000 });
});
