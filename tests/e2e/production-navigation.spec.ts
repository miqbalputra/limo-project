import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

async function login(page: import("@playwright/test").Page, identifier: string) {
  await loginViaForm(page, identifier);
}

test("production-default navigation hides feature-gated routes", async ({ page }) => {
  test.setTimeout(90_000);
  const roles = [
    { identifier: "admin@limo.local", path: "/admin", hidden: [{ labels: ["Kalender"], href: "/admin/kalender" }] },
    { identifier: "guru@limo.local", path: "/guru", hidden: [{ labels: ["Kalender"], href: "/guru/kalender" }, { labels: ["Perlu Ditindaklanjuti", "To-do"], href: "/guru/todo" }] },
    { identifier: "wali@limo.local", path: "/wali", hidden: [{ labels: ["Tugas Anak"], href: "/wali/tugas" }, { labels: ["Kalender"], href: "/wali/kalender" }, { labels: ["Perlu Ditindaklanjuti", "To-do"], href: "/wali/todo" }] },
  ] as const;

  for (const role of roles) {
    await page.context().clearCookies();
    await login(page, role.identifier);
    await expect(page).toHaveURL(new RegExp(`${role.path}$`), { timeout: 15_000 });
    const navigation = page.getByRole("navigation", { name: "Navigasi dashboard" });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole("link")).not.toHaveCount(0);
    for (const item of role.hidden) {
      await expect(navigation.locator(`a[href="${item.href}"]`)).toHaveCount(0);
      for (const label of item.labels) {
        await expect(navigation.getByRole("link", { name: label, exact: true })).toHaveCount(0);
      }
    }
  }
});

test("production-default guru navigation only links to reachable routes", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  const navigation = page.getByRole("navigation", { name: "Navigasi dashboard" });
  const hrefs = await navigation
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") || "").filter((href) => href.startsWith("/")));
  expect(hrefs.length).toBeGreaterThan(0);

  for (const href of hrefs) {
    const response = await page.request.get(href);
    expect(response.status(), `${href} tidak boleh 404 saat flag produksi mati`).not.toBe(404);
  }

  // Sub-fitur kelas yang di-guard flag tidak boleh dirender sebagai tautan mati.
  await page.goto("/guru/kelas");
  const classLink = page.locator('a[href^="/guru/kelas/"]').first();
  await expect(classLink).toBeVisible();
  await classLink.click();
  await expect(page.getByRole("heading", { name: "Kelola Kelas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Susun Modul" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Progres Aktivitas" })).toHaveCount(0);
});
