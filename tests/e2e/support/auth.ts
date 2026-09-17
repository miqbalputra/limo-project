import { expect, type Page } from "@playwright/test";

const DEFAULT_PASSWORD = "password-dev-only";
const LOGIN_REDIRECT_TIMEOUT = 6_000;
const LOGIN_CLICK_TIMEOUT = 10_000;
const MAX_LOGIN_ATTEMPTS = 4;

export async function gotoLogin(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
}

/**
 * Mengisi formulir login dan menunggu keluar dari /login.
 *
 * Klik bisa jatuh sebelum komponen React ter-hydrate (terutama pada dev server
 * yang baru dikompilasi). Jika URL belum berubah, halaman dimuat ulang lalu
 * formulir diisi dan diklik lagi, sehingga test tidak flaky.
 */
export async function loginViaForm(page: Page, identifier: string, password = DEFAULT_PASSWORD) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt += 1) {
    try {
      await gotoLogin(page);
      await page.getByLabel("Email").fill(identifier);
      await page.locator('input[name="password"]').fill(password);
      await page.getByRole("button", { name: "Masuk" }).click({ timeout: LOGIN_CLICK_TIMEOUT });
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: LOGIN_REDIRECT_TIMEOUT });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(300);
    }
  }

  throw lastError;
}
