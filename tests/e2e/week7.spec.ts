import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("Guru can open the Gradebook manager from class detail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
  await page.goto("/guru/kelas");
  await page.getByRole("link", { name: "Kelola Kelas" }).first().click();
  await page.getByRole("link", { name: "Buka Buku Nilai" }).click();
  await expect(page.getByRole("heading", { name: /Buku Nilai/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kategori dan item" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("Siswa and Wali can open read-only Gradebook views", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "LIMO-DEV-001");
  await expect(page).toHaveURL(/\/siswa$/);
  await page.goto("/siswa/kelas");
  await page.getByRole("link", { name: "Buka detail kelas" }).first().click();
  await page.getByRole("link", { name: "Lihat Nilai" }).click();
  await expect(page.getByRole("heading", { name: /Nilai/ }).first()).toBeVisible();

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/);
  await page.goto("/wali/progres");
  await page.getByRole("link", { name: "Detail" }).first().click();
  await page.getByRole("link", { name: "Buku Nilai" }).click();
  await expect(page.getByRole("heading", { name: /Nilai/ }).first()).toBeVisible();
});

test("Siswa and Wali cannot see a Guru's unpublished calculated grade", async ({ page }) => {
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/);
  await page.goto("/guru/kelas");
  const classHref = await page.getByRole("link", { name: "Kelola Kelas" }).first().getAttribute("href");
  if (!classHref) throw new Error("Kelas Guru tidak ditemukan");
  const classId = classHref.split("/").at(-1);
  if (!classId) throw new Error("ID kelas Guru tidak ditemukan");

  await page.goto(classHref);
  const studentHref = await page.locator(`a[href^="/guru/kelas/${classId}/ringkasan?siswaId="]`).first().getAttribute("href");
  if (!studentHref) throw new Error("Siswa aktif pada kelas Guru tidak ditemukan");
  const studentId = new URL(studentHref, "http://127.0.0.1:3000").searchParams.get("siswaId");
  if (!studentId) throw new Error("ID siswa pada roster Guru tidak ditemukan");

  const setup = await page.evaluate(async ({ classId, studentId }) => {
    async function request(path: string, body?: unknown, method = "POST") {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const raw = await response.text();
      let payload: { data?: { item?: { id?: string } }; error?: unknown };
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(`${path} returned ${response.status} (${response.headers.get("content-type")}): ${raw.slice(0, 240)}`);
      }
      if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(payload)}`);
      const item = payload.data?.item;
      if (!item) throw new Error(`${path} returned ${response.status} without a data.item payload`);
      return item;
    }

    const category = await request(`/api/v1/guru/kelas/${classId}/gradebook/categories`, { name: `R5 E2E draft ${Date.now()}`, weight: 100, order: 0 });
    await request(`/api/v1/guru/gradebook/categories/${category.id}`, { status: "PUBLISHED" }, "PATCH");
    const item = await request(`/api/v1/guru/kelas/${classId}/gradebook/items`, { categoryId: category.id, sourceType: "MANUAL", title: "R5 E2E provisional score", maxScore: 100 });
    await request(`/api/v1/guru/gradebook/items/${item.id}`, { status: "PUBLISHED" }, "PATCH");
    await request(`/api/v1/guru/gradebook/items/${item.id}/entries`, { studentId, rawScore: 97, status: "GRADED" }, "PUT");
    return { categoryId: category.id, itemId: item.id };
  }, { classId, studentId });
  expect(setup.categoryId).toBeTruthy();
  expect(setup.itemId).toBeTruthy();

  await page.context().clearCookies();
  await login(page, "LIMO-DEV-001");
  await expect(page).toHaveURL(/\/siswa$/);
  const studentResponse = await page.evaluate(async (path) => {
    const response = await fetch(path);
    return { status: response.status, payload: await response.json() };
  }, `/api/v1/siswa/kelas/${classId}/gradebook`);
  expect(studentResponse.status).toBe(200);
  expect(studentResponse.payload.data.rows[0].finalGrade).toBeNull();
  expect(studentResponse.payload.data.rows[0].calculatedScore).toBeNull();
  await page.goto(`/siswa/kelas/${classId}/gradebook`);
  await expect(page.getByText("Menunggu publikasi guru")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("97");

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/);
  const waliResponse = await page.evaluate(async (path) => {
    const response = await fetch(path);
    return { status: response.status, payload: await response.json() };
  }, `/api/v1/wali/anak/${studentId}/kelas/${classId}/gradebook`);
  expect(waliResponse.status).toBe(200);
  expect(waliResponse.payload.data.rows[0].finalGrade).toBeNull();
  expect(waliResponse.payload.data.rows[0].calculatedScore).toBeNull();
  await page.goto(`/wali/progres/${studentId}/gradebook`);
  await expect(page.getByText("Menunggu publikasi guru")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("97");
});
