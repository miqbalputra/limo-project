import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

const DASHBOARD_INTERACTION_SCOPE = "#dashboard-content :is(h1, h2, button, input, select, textarea)";
const runId = `${Date.now()}`;
const guruEmail = `e2e-guru-${runId}@example.test`;
const waliEmail = `e2e-wali-${runId}@example.test`;
const importedGuruEmail = `e2e-imp-${runId}@example.test`;

async function expectNoAxeViolations(page: import("@playwright/test").Page, selector?: string) {
  const axe = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (selector) axe.include(selector);
  const results = await axe.analyze();
  const violationSummary = results.violations
    .map((violation) => `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => `  ${node.target.join(", ")}: ${node.failureSummary || "No failure summary"}`).join("\n")}`)
    .join("\n\n");

  expect(results.violations, violationSummary || "No WCAG 2 A/AA violations").toEqual([]);
}

test("admin mengelola akun Guru: buat, arsip, restore, dan impor CSV", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaForm(page, "admin@limo.local");
  await page.goto("/admin/guru");
  await expect(page.locator("#dashboard-content")).toBeVisible();

  await page.getByPlaceholder("Nama guru").fill("Guru E2E");
  await page.getByPlaceholder("Email", { exact: true }).fill(guruEmail);
  await page.getByPlaceholder("Nomor HP").fill("081234567");
  await page.getByPlaceholder("Alamat").fill("Jakarta");
  await page.getByRole("button", { name: "Simpan Guru" }).click();

  const card = page.locator("article").filter({ hasText: guruEmail });
  await expect(card).toBeVisible({ timeout: 15_000 });

  await card.getByRole("button", { name: "Arsipkan" }).click();
  const archiveDialog = page.getByRole("alertdialog", { name: "Konfirmasi akun guru" });
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.getByRole("button", { name: "Ya, lanjutkan" }).click();
  await expect(card).toBeHidden({ timeout: 15_000 });

  await page.getByRole("link", { name: "Tampilkan arsip" }).click();
  await expect(page).toHaveURL(/arsip=1/);
  const archivedCard = page.locator("article").filter({ hasText: guruEmail });
  await expect(archivedCard).toBeVisible();
  await expect(archivedCard.getByText("Arsip", { exact: true })).toBeVisible();

  await archivedCard.getByRole("button", { name: "Pulihkan akun" }).click();
  const restoreDialog = page.getByRole("alertdialog", { name: "Konfirmasi akun guru" });
  await restoreDialog.getByRole("button", { name: "Ya, lanjutkan" }).click();
  await expect(archivedCard.getByText("Arsip", { exact: true })).toBeHidden({ timeout: 15_000 });

  await page.goto("/admin/guru");
  await expect(page.locator("article").filter({ hasText: guruEmail })).toBeVisible();
  await page.goto("/admin/guru/impor");
  await page.getByLabel("Isi CSV").fill(`name,email,phone,address\nGuru Impor,${importedGuruEmail},0812,Jakarta\n`);
  await page.getByRole("button", { name: "Pratinjau" }).click();
  await expect(page.getByRole("heading", { name: "Hasil pratinjau" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Akun baru", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Impor sekarang" }).click();
  await expect(page.getByRole("heading", { name: "Hasil impor" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Akun baru", exact: true })).toBeVisible();
});

test("admin membuat akun Wali dan halaman akun bebas violation WCAG di 360px", async ({ page }) => {
  test.setTimeout(120_000);
  await loginViaForm(page, "admin@limo.local");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/admin/wali");
  await expect(page.locator("#dashboard-content")).toBeVisible();

  await page.getByPlaceholder("Nama wali").fill("Wali E2E");
  await page.getByPlaceholder("Email", { exact: true }).fill(waliEmail);
  await page.getByPlaceholder("Nomor HP").fill("081298765");
  await page.getByRole("button", { name: "Simpan Wali" }).click();
  await expect(page.locator("article").filter({ hasText: waliEmail })).toBeVisible({ timeout: 15_000 });

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
  await expectNoAxeViolations(page, DASHBOARD_INTERACTION_SCOPE);
});
