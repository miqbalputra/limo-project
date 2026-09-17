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
