import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
}

test("Week 3 guru attendance and progress UI is mobile friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/presensi");
  await expect(page.getByRole("heading", { name: "Presensi" })).toBeVisible();
  const inputHref = await page.getByRole("link", { name: "Input" }).first().getAttribute("href");
  expect(inputHref).toBeTruthy();
  await expectNoHorizontalOverflow(page);

  await page.goto(inputHref || "/guru/presensi");
  await expect(page.locator("#presensi-form").getByRole("button", { name: "Simpan Presensi" })).toBeVisible();
  await expect(page.locator('select[name^="presence-"]').first()).toContainText("Hadir");
  await expect(page.locator('select[name^="score-"]')).toHaveCount(0);

  await page.goto("/guru/progres");
  const progressInputHref = await page.getByRole("link", { name: "Input" }).first().getAttribute("href");
  expect(progressInputHref).toBeTruthy();
  await page.goto(progressInputHref || "/guru/progres");
  await expect(page.locator("#progres-form").getByRole("button", { name: "Simpan Progres" })).toBeVisible();
  await expect(page.locator('select[name^="score-"]').first()).toContainText("Pemahaman 5");
  await expectNoHorizontalOverflow(page);
});

test("Week 3 wali graphs, attendance recap, and billing are mobile friendly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  await page.goto("/wali/progres");
  await expect(page.getByRole("heading", { name: "Progres Anak" })).toBeVisible();
  const progressHref = await page.getByRole("link", { name: "Detail" }).first().getAttribute("href");
  expect(progressHref).toBeTruthy();
  await page.goto(progressHref || "/wali/progres");
  await expect(page.getByRole("heading", { name: "Grafik Pemahaman" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kehadiran Bulanan" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/wali/presensi");
  await expect(page.getByRole("heading", { name: "Presensi Anak" })).toBeVisible();
  await expect(page.getByText("Rate").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/wali/tagihan");
  await expect(page.getByRole("heading", { name: "Tagihan" })).toBeVisible();
  await expect(page.getByText(/QRIS|Pakasir|Virtual Account|Buat Instruksi Bayar/).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Notifikasi" }).click();
  await expect(page.getByText("Notifikasi").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Wali global child selector scopes and restores dashboard data", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  const childSelector = page.getByRole("combobox", { name: "Pilih anak" });
  await expect(childSelector).toHaveValue("__all__");
  await childSelector.selectOption({ label: "Ahmad Dev / LIMO-DEV-001" });
  await expect(childSelector).toHaveValue(/.+/);
  await expect(page.getByText("Anak Terhubung").locator("..").getByText("1")).toBeVisible();

  await page.goto("/wali/nilai");
  await expect(page.getByRole("heading", { name: "Ahmad Dev" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aisyah Dev" })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Pilih anak" }).selectOption("__all__");
  await expect(page.getByRole("combobox", { name: "Pilih anak" })).toHaveValue("__all__");
  await page.reload();
  await expect(page.locator("main").getByText("Aisyah Dev").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Wali can read published learning materials", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  await page.goto("/wali/materi");
  await expect(page.getByRole("heading", { name: "Materi Pembelajaran" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Greeting Flashcards" })).toBeVisible();
  await expect(page.getByText("Video Colors Song")).toBeVisible();
  await expect(page.getByText("Buka video pembelajaran")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Wali help center explains common LMS flows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  await page.goto("/wali/bantuan");
  await expect(page.getByRole("heading", { name: "Bantuan untuk Wali" })).toBeVisible();
  const question = page.getByText("Bagaimana cara membuka tugas anak?");
  await expect(question).toBeVisible();
  await question.click();
  await expect(page.getByText(/Buka menu Tugas Anak, pilih anak/)).toBeVisible();
  await expect(page.getByRole("link", { name: "admin@limo.local" })).toHaveAttribute("href", "mailto:admin@limo.local");
  await expectNoHorizontalOverflow(page);
});
