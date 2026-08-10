import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

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
    ["LIMO-DEV-001", "/siswa"],
  ] as const;

  for (const [email, expectedPath] of cases) {
    await page.context().clearCookies();
    await page.goto(email.startsWith("admin") ? "/login?next=https://example.com" : "/login");
    await page.getByLabel("Email").fill(email);
    await page.locator('input[name="password"]').fill("password-dev-only");
    await page.getByRole("button", { name: "Masuk" }).click();
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
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
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

test("Admin student mutations wait for explicit confirmation", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, "admin@limo.local");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.goto("/admin/siswa?search=LIMO-DEV-001");
  const studentRow = page.locator("article").filter({ hasText: "LIMO-DEV-001" });
  const studentHref = await studentRow.getByRole("link", { name: "Kelola" }).getAttribute("href");
  if (!studentHref) throw new Error("Detail Ahmad Dev tidak ditemukan");
  const studentId = new URL(studentHref, page.url()).pathname.split("/").at(-1);
  if (!studentId) throw new Error("ID siswa tidak ditemukan");
  await page.goto(studentHref);

  let studentStatusRequests = 0;
  const blockStudentStatus = async (route: import("@playwright/test").Route) => {
    const request = route.request();
    if (request.method() === "PATCH" && new URL(request.url()).pathname === `/api/v1/admin/siswa/${studentId}`) {
      studentStatusRequests += 1;
      await route.fulfill({ status: 500, json: { error: { message: "Mutasi tidak boleh dipanggil sebelum konfirmasi" } } });
      return;
    }
    await route.continue();
  };
  await page.route("**/api/v1/admin/siswa/**", blockStudentStatus);
  const studentForm = page.locator("form").filter({ hasText: "Data Siswa" });
  await studentForm.locator('select[name="status"]').selectOption("INACTIVE");
  await studentForm.getByRole("button", { name: "Simpan Perubahan" }).click();
  const studentStatusDialog = page.getByRole("alertdialog", { name: "Ubah status siswa?" });
  await expect(studentStatusDialog).toBeVisible();
  await expect(studentStatusDialog).toContainText("Perubahan ke status nonaktif");
  await studentStatusDialog.getByRole("button", { name: "Batal" }).click();
  expect(studentStatusRequests).toBe(0);
  await page.unroute("**/api/v1/admin/siswa/**", blockStudentStatus);

  let transferRequests = 0;
  const blockTransfer = async (route: import("@playwright/test").Route) => {
    transferRequests += 1;
    await route.fulfill({ status: 500, json: { error: { message: "Transfer tidak boleh dipanggil sebelum konfirmasi" } } });
  };
  await page.route("**/api/v1/admin/siswa/*/transfer", blockTransfer);
  const transferForm = page.locator("form").filter({ hasText: "Mutasi Kelas" });
  await transferForm.locator('select[name="kelasId"]').selectOption({ label: "Intermediate - English Intermediate B" });
  await transferForm.locator('input[name="startDate"]').fill("2030-01-02");
  await transferForm.getByRole("button", { name: "Pindahkan Kelas" }).click();
  const transferDialog = page.getByRole("alertdialog", { name: "Pindahkan siswa ke kelas baru?" });
  await expect(transferDialog).toBeVisible();
  await expect(transferDialog).toContainText("Keanggotaan kelas aktif akan ditutup");
  await expect(transferDialog).toContainText("Intermediate - English Intermediate B");
  await transferDialog.getByRole("button", { name: "Batal" }).click();
  expect(transferRequests).toBe(0);
  await page.unroute("**/api/v1/admin/siswa/*/transfer", blockTransfer);

  const origin = new URL(page.url()).origin;
  const deactivateAccount = await page.request.patch(`/api/v1/admin/siswa/${studentId}/akun/status`, { data: { status: "INACTIVE" }, headers: { Origin: origin } });
  expect(deactivateAccount.status()).toBe(200);
  try {
    await page.goto(`/admin/siswa/${studentId}/akun`);
    await expect(page.getByText("Tidak aktif", { exact: true })).toBeVisible();
    let accountStatusRequests = 0;
    const blockAccountStatus = async (route: import("@playwright/test").Route) => {
      accountStatusRequests += 1;
      await route.fulfill({ status: 500, json: { error: { message: "Aktivasi tidak boleh dipanggil sebelum konfirmasi" } } });
    };
    await page.route("**/api/v1/admin/siswa/*/akun/status", blockAccountStatus);
    const activateButton = page.getByRole("button", { name: "Aktifkan" });
    await activateButton.focus();
    await activateButton.click();
    const activationDialog = page.getByRole("alertdialog", { name: "Aktifkan akun siswa?" });
    await expect(activationDialog).toBeVisible();
    await expect(activationDialog).toContainText("Akses portal siswa akan diaktifkan kembali.");
    await expect(activationDialog.getByRole("button", { name: "Batal" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(activationDialog).toBeHidden();
    await expect(activateButton).toBeFocused();
    expect(accountStatusRequests).toBe(0);
    await page.unroute("**/api/v1/admin/siswa/*/akun/status", blockAccountStatus);
  } finally {
    const reactivateAccount = await page.request.patch(`/api/v1/admin/siswa/${studentId}/akun/status`, { data: { status: "ACTIVE" }, headers: { Origin: origin } });
    expect(reactivateAccount.status()).toBe(200);
  }
});
