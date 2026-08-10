import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

const PUBLIC_NAVIGATION_SCOPE = "main > div:first-child > header";
const DASHBOARD_INTERACTION_SCOPE = "#dashboard-content :is(h1, h2, button, input, select, textarea)";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function expectNoAxeViolations(page: Page, selector?: string) {
  const axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (selector) axe.include(selector);
  const results = await axe.analyze();
  const evaluatedRules = [...results.passes, ...results.violations, ...results.incomplete, ...results.inapplicable];
  const violationSummary = results.violations
    .map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `  ${node.target.join(", ")}: ${node.failureSummary || "No failure summary"}`).join("\n")}`)
    .join("\n\n");

  expect(evaluatedRules.some((rule) => rule.id === "color-contrast"), "axe did not evaluate the color-contrast rule").toBe(true);
  expect(results.violations, violationSummary || "No WCAG 2 A/AA violations").toEqual([]);
}

async function expectTouchTarget(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("Touch target is not visible");
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

test("public navigation, login, and seeded role dashboard controls have no WCAG 2 A/AA violations", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page, PUBLIC_NAVIGATION_SCOPE);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
  await expectNoAxeViolations(page);

  const roles = [
    { identifier: "admin@limo.local", path: "/admin" },
    { identifier: "guru@limo.local", path: "/guru" },
    { identifier: "LIMO-DEV-001", path: "/siswa" },
    { identifier: "wali@limo.local", path: "/wali" },
  ] as const;

  for (const role of roles) {
    await page.context().clearCookies();
    await login(page, role.identifier);
    await expect(page).toHaveURL(new RegExp(`${role.path}$`), { timeout: 15_000 });
    await expect(page.locator("#dashboard-content")).toBeVisible();
    await expectNoAxeViolations(page, DASHBOARD_INTERACTION_SCOPE);
  }
});

test("dashboard skip link and role navigation work with a keyboard", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, "admin@limo.local");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.goto("/admin");

  const skipLink = page.getByRole("link", { name: "Lewati ke konten utama" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#dashboard-content")).toBeFocused();

  const studentsLink = page.getByRole("navigation", { name: "Navigasi dashboard" }).getByRole("link", { name: "Siswa", exact: true });
  await studentsLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/siswa$/, { timeout: 15_000 });
});

test("Wali calendar controls meet the 44px touch-target minimum", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  await page.goto("/wali/kalender");

  await expectTouchTarget(page.getByRole("combobox", { name: "Pilih anak" }));
  await expectTouchTarget(page.getByRole("link", { name: "Bulan sebelumnya" }));
  await expectTouchTarget(page.getByRole("link", { name: "Bulan ini", exact: true }));
  await expectTouchTarget(page.getByRole("link", { name: "Bulan berikutnya" }));
  await expectTouchTarget(page.getByRole("button", { name: "Notifikasi" }));
});
