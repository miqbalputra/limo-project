import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Wali attendance keeps TERLAMBAT separate and exposes session details", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/presensi");
  const inputHref = await page.getByRole("link", { name: "Input" }).first().getAttribute("href");
  if (!inputHref) throw new Error("Sesi presensi tidak ditemukan");
  const sessionId = inputHref.split("/").at(-1);
  if (!sessionId) throw new Error("ID sesi presensi tidak ditemukan");
  const sessionData = await page.evaluate(async () => {
    const response = await fetch("/api/v1/guru/sesi");
    return response.json();
  }) as { data: { items: { id: string; sessionDate: string }[] } };
  const session = sessionData.data.items.find((item) => item.id === sessionId);
  if (!session) throw new Error("Data sesi presensi tidak ditemukan");

  await page.goto(inputHref);
  const form = page.locator("#presensi-form");
  await expect(form.getByRole("button", { name: "Simpan Presensi" })).toBeVisible();
  await form.getByRole("button", { name: "Hadir Semua" }).click();
  const firstGroup = form.locator('fieldset[aria-label^="Status presensi "]').first();
  await firstGroup.getByText("Terlambat", { exact: true }).click();
  await form.locator('input[name^="presenceNote-"]').first().fill("W4 detail sesi");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/presensi") && response.request().method() === "POST");
  await form.getByRole("button", { name: "Simpan Presensi" }).click();
  expect((await responsePromise).status()).toBe(200);

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  await page.goto(`/wali/presensi?month=${session.sessionDate.slice(0, 7)}`);
  await expect(page.getByText("Tingkat hadir").first()).toBeVisible();
  await expect(page.getByText("Terlambat", { exact: true }).first()).toBeVisible();
  const detailSummary = page.getByText("Detail sesi").first();
  await expect(detailSummary).toBeVisible();
  await detailSummary.click();
  await expect(page.getByText("W4 detail sesi")).toBeVisible();
});
