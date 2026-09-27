import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

function originOf(page: import("@playwright/test").Page) {
  return page.url().startsWith("http") ? new URL(page.url()).origin : "http://127.0.0.1:3000";
}

test("Admin dapat membuat akun Guru dengan password langsung (tanpa tautan aktivasi)", async ({ page }) => {
  test.setTimeout(150_000);
  await loginViaForm(page, "admin@limo.local");

  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "Pengguna", exact: true })).toBeVisible();

  const email = `guru.password.${Date.now()}@limo.local`;
  const password = "GuruLangsung2026";

  await page.getByLabel("Nama pengguna").fill("Guru Password E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Role pengguna").selectOption("GURU");
  await page.getByLabel("Password awal").fill(password);
  await page.getByRole("button", { name: "Simpan Pengguna" }).click();

  // Form hanya ter-reset saat pembuatan akun berhasil; tunggu sinyal itu dulu
  // sebelum navigasi berikutnya agar POST tidak dibatalkan.
  await expect(page.getByLabel("Nama pengguna")).toHaveValue("", { timeout: 30_000 });

  await page.getByLabel("Cari pengguna").fill(email);
  await page.getByRole("button", { name: "Terapkan" }).click();
  await expect(page.getByText(email)).toBeVisible({ timeout: 30_000 });

  // Akun harus bisa login langsung memakai password yang diisi admin.
  await page.context().clearCookies();
  await loginViaForm(page, email, password);
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });
});

test("Admin dapat mengubah password akun; sesi lama dicabut dan password lama tidak berlaku", async ({ page }) => {
  test.setTimeout(180_000);
  await loginViaForm(page, "admin@limo.local");
  const origin = originOf(page);

  const email = `guru.ubah.${Date.now()}@limo.local`;
  const firstPassword = "PasswordAwal2026";
  const secondPassword = "PasswordBaru2026";

  const created = await page.request.post("/api/v1/admin/users", {
    data: { name: "Guru Ubah Password E2E", email, role: "GURU", password: firstPassword },
    headers: { Origin: origin },
  });
  expect(created.status(), await created.text()).toBe(201);
  const userId = (await created.json()).data.item.id as string;

  await page.goto(`/admin/users/${userId}`);
  await expect(page.getByRole("heading", { name: "Guru Ubah Password E2E" })).toBeVisible();

  await page.getByRole("button", { name: "Ubah password" }).click();
  await page.getByLabel("Password baru").fill(secondPassword);
  await page.getByLabel("Alasan perubahan password").fill("Reset oleh admin untuk uji E2E");
  await page.getByRole("button", { name: "Simpan password" }).click();
  await page.getByRole("button", { name: "Ya, ubah password" }).click();
  await expect(page.getByText("Password diperbarui. Semua sesi pengguna dicabut.")).toBeVisible({ timeout: 30_000 });

  const oldPasswordLogin = await page.request.post("/api/v1/auth/login", {
    data: { email, password: firstPassword },
    headers: { Origin: origin },
  });
  expect(oldPasswordLogin.status(), "password lama tidak boleh lagi berlaku").not.toBe(200);

  await page.context().clearCookies();
  await loginViaForm(page, email, secondPassword);
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });
});

test("Endpoint set password menolak tamu dan non-admin", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  const origin = originOf(page);

  const anonymous = await page.request.post("/api/v1/admin/users/tidak-ada/password", {
    data: { password: "apapun12345" },
    headers: { Origin: origin },
  });
  expect(anonymous.status()).toBe(401);

  await loginViaForm(page, "guru@limo.local");
  const asGuru = await page.request.post("/api/v1/admin/users/tidak-ada/password", {
    data: { password: "apapun12345" },
    headers: { Origin: originOf(page) },
  });
  expect(asGuru.status()).toBe(403);
});
