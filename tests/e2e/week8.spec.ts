import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Guru can open Calendar and To-do without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
   await page.goto("/guru/kalender");
   await expect(page.getByRole("heading", { name: "Kalender Guru" })).toBeVisible();
   await expect(page.getByRole("heading", { name: "Tambah agenda kalender" })).toBeVisible();
   await expect(page.getByRole("combobox", { name: "Pilih kelas kalender" })).toBeVisible();
  await page.goto("/guru/todo");
  await expect(page.getByRole("heading", { name: "Daftar Tugas Guru" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Siswa and Wali can open scoped Calendar and To-do pages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "LIMO-DEV-001");
  await expect(page).toHaveURL(/\/siswa$/);
  await page.goto("/siswa/kalender");
  await expect(page.getByRole("heading", { name: "Kalender Saya" })).toBeVisible();
  await page.goto("/siswa/todo");
  await expect(page.getByRole("heading", { name: "Daftar Tugas Saya" })).toBeVisible();

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/);
   await page.goto("/wali/kalender");
   await expect(page.getByRole("heading", { name: "Kalender Anak" })).toBeVisible();
   await expect(page.getByRole("combobox", { name: "Pilih kelas kalender" })).toBeVisible();
  await page.goto("/wali/todo");
  await expect(page.getByRole("heading", { name: "Daftar Tugas Anak" })).toBeVisible();
});

test("Admin deletes a test-owned agenda only after confirmation", async ({ page }) => {
  const title = `E2E hapus agenda ${Date.now()}`;
  let deleteRequests = 0;
  const trackDelete = (request: import("@playwright/test").Request) => {
    if (request.method() === "DELETE" && new URL(request.url()).pathname.startsWith("/api/v1/calendar/events/")) deleteRequests += 1;
  };
  page.on("request", trackDelete);

  try {
    await page.context().clearCookies();
    await login(page, "admin@limo.local");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/kalender?month=2030-01");
    await page.getByRole("button", { name: "Tambah agenda" }).click();
    const createDialog = page.getByRole("dialog", { name: "Tambah agenda kalender" });
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel("Judul agenda").fill(title);
    await createDialog.getByLabel("Mulai").fill("2030-01-15T09:00");
    await createDialog.getByRole("button", { name: "Simpan agenda" }).click();
    await expect(createDialog).toBeHidden();

    const eventButton = page.getByRole("button", { name: `Buka agenda ${title}` });
    await expect(eventButton).toBeVisible();
    await eventButton.click();
    const eventDialog = page.getByRole("dialog", { name: title });
    await eventDialog.getByRole("button", { name: "Hapus agenda" }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Hapus agenda kalender?" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText(title);
    expect(deleteRequests).toBe(0);
    await confirmation.getByRole("button", { name: "Batal" }).click();
    await expect(eventButton).toBeVisible();
    expect(deleteRequests).toBe(0);

    await eventButton.click();
    await page.getByRole("dialog", { name: title }).getByRole("button", { name: "Hapus agenda" }).click();
    const deleteResponse = page.waitForResponse((response) => response.request().method() === "DELETE" && new URL(response.url()).pathname.startsWith("/api/v1/calendar/events/"));
    await page.getByRole("alertdialog", { name: "Hapus agenda kalender?" }).getByRole("button", { name: "Ya, hapus agenda" }).click();
    expect((await deleteResponse).status()).toBe(200);
    await expect(eventButton).toHaveCount(0);
  } finally {
    page.off("request", trackDelete);
  }
});
