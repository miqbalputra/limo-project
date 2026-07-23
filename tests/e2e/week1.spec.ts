import { expect, test } from "@playwright/test";

test("landing page works at 360px with accessible navigation and public links", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /Daftarkan Anak Sekarang/i })).toHaveAttribute("href", "/daftar");
  await expect(page.getByRole("link", { name: /Daftar Sekarang/i }).first()).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);

  const menuButton = page.getByRole("button", { name: "Buka menu" });
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Navigasi mobile" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Privasi" })).toHaveAttribute("href", "/kebijakan-privasi");
  await expect(page.getByRole("link", { name: "Syarat" })).toHaveAttribute("href", "/syarat-penggunaan");
});

test("login redirects each role to its own dashboard and blocks external next paths", async ({ page }) => {
  const cases = [
    ["admin@limo.local", "/admin"],
    ["guru@limo.local", "/guru"],
    ["wali@limo.local", "/wali"],
  ] as const;

  for (const [email, expectedPath] of cases) {
    await page.context().clearCookies();
    await page.goto(email.startsWith("admin") ? "/login?next=https://example.com" : "/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password-dev-only");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(new RegExp(`${expectedPath}$`), { timeout: 15_000 });
  }
});

test("privacy, terms, sitemap, and social metadata are public", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /LIMO/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect((await request.get("/kebijakan-privasi")).status()).toBe(200);
  await expect((await request.get("/syarat-penggunaan")).status()).toBe(200);
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("kebijakan-privasi");
});

test("TailAdmin dashboard shell works on desktop and mobile", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@limo.local");
  await page.getByLabel("Password").fill("password-dev-only");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });

  await expect(page.getByRole("heading", { name: /Selamat datang/i })).toBeVisible();
  const commandSearch = page.getByPlaceholder("Cari menu atau halaman...");
  await page.keyboard.press("Control+k");
  await expect(commandSearch).toBeFocused();
  await commandSearch.fill("Siswa");
  await expect(page.getByRole("link", { name: "Siswa", exact: true }).last()).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle sidebar" }).click();
  await expect(page.getByRole("navigation", { name: "Navigasi dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pendaftaran", exact: true })).toBeVisible();
});
