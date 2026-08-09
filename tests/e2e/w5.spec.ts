import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  const response = await page.request.post("/api/v1/auth/login", {
    data: { email, password: "password-dev-only" },
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const sessionCookie = response.headers()["set-cookie"]?.match(/limo_session=([^;]+)/)?.[1];
  expect(sessionCookie).toBeTruthy();
  await page.context().addCookies([{ name: "limo_session", value: sessionCookie as string, domain: "127.0.0.1", path: "/" }]);
  await page.goto("/wali");
}

test("W5 Wali billing totals reconcile billed and excluded statuses", async ({ page }) => {
  await login(page, "wali.demo@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  await page.goto("/wali/tagihan");

  const summary = page.getByRole("region", { name: "Ringkasan tagihan anak" });
  await expect(summary.locator("article").filter({ hasText: "Total tagihan" })).toContainText("Rp 800.000");
  await expect(summary.locator("article").filter({ hasText: "Sudah dibayar" })).toContainText("Rp 0");
  await expect(summary.locator("article").filter({ hasText: "Perlu dibayar" })).toContainText("Rp 800.000");

  const reconciliation = page.getByTestId("billing-reconciliation");
  await expect(reconciliation).toContainText("Total tertagih");
  await expect(reconciliation).toContainText("Rp 800.000 perlu dibayar");
  await expect(reconciliation).toContainText("Rp 350.000 dibatalkan");
});
