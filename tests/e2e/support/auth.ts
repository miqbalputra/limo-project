import { expect, type Page } from "@playwright/test";

const DEFAULT_PASSWORD = "password-dev-only";
const DEFAULT_ORIGIN = "http://127.0.0.1:3000";
const DASHBOARD_TIMEOUT = 30_000;
const MAX_API_ATTEMPTS = 4;

function destinationFor(identifier: string) {
  const value = identifier.toLowerCase();
  if (value.startsWith("admin")) return "/admin";
  if (value.startsWith("guru")) return "/guru";
  if (value.startsWith("wali")) return "/wali";
  if (value.startsWith("limo-") || value.includes("siswa")) return "/siswa";
  return null;
}

/**
 * Ekstrak cookie sesi dari respons login tanpa menebak namanya — nama
 * mengikuti SESSION_COOKIE_NAME server (CI memakai limo_session_ci).
 */
export function sessionCookieFrom(response: { headers(): Record<string, string> }) {
  const setCookie = (response.headers()["set-cookie"] || "").split("\n").find(Boolean) || "";
  const [nameValue] = setCookie.split(";");
  const separator = nameValue.indexOf("=");
  const name = nameValue.slice(0, separator).trim();
  const value = nameValue.slice(separator + 1).trim();
  return name && value ? { name, value } : null;
}

/**
 * Tunggu hidrasi React selesai (penanda `data-hydrated` dari ToastProvider)
 * sebelum berinteraksi dengan elemen — mencegah klik jatuh saat handler
 * belum terpasang pada halaman dev yang baru selesai dikompilasi.
 */
export async function waitHydrated(page: Page, timeout = 30_000) {
  await page.waitForSelector("html[data-hydrated='true']", { timeout }).catch(() => undefined);
}

export async function gotoLogin(page: Page) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
}

/**
 * Login melalui API lalu pasang cookie sesi dan buka dashboard sesuai peran.
 *
 * Login lewat form UI rawan flaky karena klik bisa jatuh sebelum React
 * ter-hydrate (dev server baru dikompilasi) sehingga request tidak terkirim.
 * API login bersifat deterministik; tampilan form login tetap diuji terpisah
 * oleh spec week1/accessibility.
 */
export async function loginViaForm(page: Page, identifier: string, password = DEFAULT_PASSWORD) {
  const origin = page.url().startsWith("http") ? new URL(page.url()).origin : DEFAULT_ORIGIN;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt += 1) {
    const response = await page.request.post("/api/v1/auth/login", {
      data: { email: identifier, password },
      headers: { Origin: origin },
    });

    if (response.ok()) {
      const session = sessionCookieFrom(response);
      if (!session) throw new Error(`Cookie sesi tidak diterima untuk ${identifier}`);
      await page.context().addCookies([{ name: session.name, value: session.value, domain: "127.0.0.1", path: "/" }]);

      const destination = destinationFor(identifier);
      if (!destination) {
        await gotoLogin(page);
        await waitHydrated(page);
        return;
      }

      await page.goto(destination);
      await expect(page.locator("#dashboard-content")).toBeVisible({ timeout: DASHBOARD_TIMEOUT });
      await waitHydrated(page);
      return;
    }

    const body = await response.text();
    const contentType = response.headers()["content-type"] || "";
    lastError = `HTTP ${response.status()} (${contentType})`;

    // Dev server (Turbopack) kadang membalas 404 HTML saat route baru pertama
    // kali dikompilasi. Coba lagi setelah jeda; kegagalan lain tetap dilempar.
    if (!(response.status() === 404 && contentType.includes("text/html"))) {
      throw new Error(`Login API gagal untuk ${identifier}: ${lastError} ${body.slice(0, 200)}`);
    }

    await page.waitForTimeout(700);
  }

  throw new Error(`Login API gagal untuk ${identifier}: ${lastError}`);
}
