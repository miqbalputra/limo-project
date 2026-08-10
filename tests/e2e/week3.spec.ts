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
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/jadwal");
  await expect(page.getByRole("heading", { name: "Jadwal Kelas" })).toBeVisible();
  await expect(page.getByText("Agenda Kalender").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/guru/kelas");
  const classHref = await page.getByRole("link", { name: "Kelola Kelas" }).first().getAttribute("href");
  expect(classHref).toBeTruthy();
  await page.goto(classHref || "/guru/kelas");
  await expect(page.getByRole("heading", { name: "Daftar siswa" })).toBeVisible();
  await expect(page.getByPlaceholder("Cari nama atau nomor induk")).toBeVisible();
  await expect(page.getByText("Ahmad Dev").first()).toBeVisible();
  await page.getByRole("link", { name: "Ahmad Dev" }).first().click();
  await expect(page.getByRole("heading", { name: "Histori Ahmad Dev" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Presensi" })).toBeVisible();

  await page.goto("/guru/sesi");
  await expect(page.getByRole("heading", { name: "Sesi kelas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sesi terjadwal" })).toBeVisible();

  await page.goto("/guru/presensi");
  await expect(page.getByRole("heading", { name: "Presensi" })).toBeVisible();
  const inputHref = await page.getByRole("link", { name: "Input" }).first().getAttribute("href");
  expect(inputHref).toBeTruthy();
  await expectNoHorizontalOverflow(page);

  await page.goto(inputHref || "/guru/presensi");
  await expect(page.locator("#presensi-form").getByRole("button", { name: "Simpan Presensi" })).toBeVisible();
  await page.locator("#presensi-form").getByRole("button", { name: "Hadir Semua" }).click();
  await expect(page.locator("#presensi-form").getByRole("status")).toContainText("siswa ditandai hadir");
  const presenceGroups = page.locator('fieldset[aria-label^="Status presensi "]');
  expect(await presenceGroups.count()).toBeGreaterThan(0);
  for (let index = 0; index < await presenceGroups.count(); index += 1) {
    await expect(presenceGroups.nth(index).locator('input[type="radio"][value="HADIR"]')).toBeChecked();
    await expect(presenceGroups.nth(index).getByRole("radio")).toHaveCount(5);
    for (const label of ["Hadir", "Terlambat", "Sakit", "Izin", "Alfa"]) {
      await expect(presenceGroups.nth(index).getByText(label, { exact: true })).toBeVisible();
    }
  }
  await expect(page.locator('select[name^="presence-"]')).toHaveCount(0);
  await presenceGroups.first().getByText("Terlambat", { exact: true }).click();
  await page.reload();
  await expect(presenceGroups.first().getByRole("radio", { name: "Terlambat" })).toBeChecked();
  await expect(page.locator('select[name^="score-"]')).toHaveCount(0);

  await page.goto("/guru/progres");
  const progressInputHref = await page.getByRole("link", { name: "Input" }).first().getAttribute("href");
  expect(progressInputHref).toBeTruthy();
  await page.goto(progressInputHref || "/guru/progres");
  await expect(page.locator("#progres-form").getByRole("button", { name: "Simpan Progres" })).toBeVisible();
  await expect(page.locator('select[name^="score-"]').first()).toContainText("Pemahaman 5");
  const progressForm = page.locator("#progres-form");
  const categoryInput = progressForm.getByLabel("Kategori progres");
  const firstScore = progressForm.locator('select[name^="score-"]').first();
  const firstPublicNote = progressForm.locator('input[name^="publicNote-"]').first();
  await categoryInput.fill("p0-kategori-awal");
  await firstScore.selectOption("5");
  await firstPublicNote.fill("Catatan kategori awal");
  await categoryInput.fill("p0-kategori-berikutnya");
  await expect(firstScore).toHaveValue("3");
  await expect(firstPublicNote).toHaveValue("");
});

test("Week 3 progress category changes keep saved values isolated", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });

  await page.goto("/guru/progres");
  const progressInputHref = await page.getByRole("link", { name: "Input" }).first().getAttribute("href");
  if (!progressInputHref) throw new Error("Sesi progres tidak ditemukan");
  const sessionId = progressInputHref.split("/").at(-1);
  if (!sessionId) throw new Error("ID sesi progres tidak ditemukan");
  const sessionData = await page.evaluate(async () => {
    const response = await fetch("/api/v1/guru/sesi");
    return response.json();
  }) as { data: { items: { id: string; kelas: { id: string } }[] } };
  const session = sessionData.data.items.find((item) => item.id === sessionId);
  if (!session) throw new Error("Data sesi progres tidak ditemukan");

  await page.goto(progressInputHref);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  const progressForm = page.locator("#progres-form");
  await expect(progressForm.getByRole("button", { name: "Simpan Progres" })).toBeVisible();
  const categoryInput = progressForm.getByLabel("Kategori progres");
  const firstScore = progressForm.locator('select[name^="score-"]').first();
  const firstPublicNote = progressForm.locator('input[name^="publicNote-"]').first();
  const categoryA = `g2-category-a-${Date.now()}`;
  const categoryB = `g2-category-b-${Date.now()}`;
  const categoryC = `g2-category-c-${Date.now()}`;

  async function saveProgress(category: string, score: string, note: string) {
    await categoryInput.fill(category);
    await firstScore.selectOption(score);
    await firstPublicNote.fill(note);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/progres") && response.request().method() === "POST");
    await progressForm.getByRole("button", { name: "Simpan Progres" }).click();
    expect((await responsePromise).status()).toBe(200);
  }

  await saveProgress(categoryA, "5", "Catatan kategori A");
  await page.reload();
  await saveProgress(categoryB, "4", "Catatan kategori B");
  await page.reload();

  await categoryInput.fill("g2-transition");
  await expect(firstScore).toHaveValue("3");
  await expect(firstPublicNote).toHaveValue("");
  await categoryInput.fill("umum");
  await expect(firstScore).toHaveValue("3");
  await expect(firstPublicNote).toHaveValue("");
  await saveProgress("umum", "2", categoryC);

  await page.goto(`/guru/kelas/${session.kelas.id}`);
  const studentHistoryHref = await page.getByRole("link", { name: "Ahmad Dev" }).first().getAttribute("href");
  if (!studentHistoryHref) throw new Error("Histori siswa tidak ditemukan");
  await page.goto(studentHistoryHref);
  await expect(page.getByText(new RegExp(`Skor 5/5 / ${categoryA}`))).toBeVisible();
  await expect(page.getByText(new RegExp(`Skor 4/5 / ${categoryB}`))).toBeVisible();
  await expect(page.getByText(new RegExp(`Skor 2/5 / umum`))).toBeVisible();
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
  await expect(page.getByText("Tingkat").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/wali/tagihan");
  await expect(page.getByRole("heading", { name: "Tagihan" })).toBeVisible();
  await expect(page.getByText(/Mayar|QRIS|Virtual Account|Buat Instruksi Bayar/).first()).toBeVisible();
  const paidInvoice = page.getByRole("heading", { name: "Aisyah Dev" }).locator("xpath=ancestor::article[1]");
  await expect(paidInvoice.locator("summary")).toContainText("Riwayat transaksi");
  await paidInvoice.locator("summary").click();
  await expect(paidInvoice.getByText("MAYAR / QRIS")).toBeVisible();
  await expect(paidInvoice.getByText("Lunas").first()).toBeVisible();
  await expect(paidInvoice.getByText(/Referensi:/)).toBeVisible();
  await expect(paidInvoice.getByText("Rp 450.000").last()).toBeVisible();
  await expect(paidInvoice.getByText(/Dicatat/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Notifikasi" }).click();
  await expect(page.getByText("Notifikasi").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Admin billing preserves DRAFT query state and requires preview confirmation", async ({ page }) => {
  await login(page, "admin@limo.local");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.goto("/admin/tagihan?status=DRAFT");
  await expect(page).toHaveURL((url) => url.pathname === "/admin/tagihan" && url.searchParams.get("status") === "DRAFT");
  await expect(page.getByLabel("Filter status tagihan")).toHaveValue("DRAFT");

  const generationBodies: { period: string; dueDate: string; jenis: string; dryRun: boolean }[] = [];
  await page.route("**/api/v1/admin/tagihan/generate", async (route) => {
    const body = route.request().postDataJSON() as { period: string; dueDate: string; jenis: string; dryRun: boolean };
    generationBodies.push(body);
    await route.fulfill({ json: { data: { created: 2, skipped: 1, failed: 0, failures: [], dryRun: body.dryRun } } });
  });

  await page.locator('input[name="period"]').fill("2030-01");
  await page.locator('input[name="dueDate"]').fill("2030-01-10");
  await page.locator('input[name="jenis"]').fill("E2E Preview");
  await page.getByRole("button", { name: "Tinjau tagihan" }).click();
  await expect.poll(() => generationBodies.length).toBe(1);
  expect(generationBodies[0]).toEqual({ period: "2030-01", dueDate: "2030-01-10", jenis: "E2E Preview", dryRun: true });
  await expect(page.getByText("Tinjau sebelum membuat tagihan")).toBeVisible();

  const createButton = page.getByRole("button", { name: "Buat 2 tagihan" });
  await createButton.focus();
  await createButton.click();
  const confirmation = page.getByRole("alertdialog", { name: "Buat tagihan dari hasil tinjauan?" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveAttribute("aria-modal", "true");
  await expect(confirmation.getByRole("button", { name: "Batal" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirmation.getByRole("button", { name: "Ya, buat tagihan" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(createButton).toBeFocused();
  expect(generationBodies).toHaveLength(1);

  await createButton.click();
  await confirmation.getByRole("button", { name: "Ya, buat tagihan" }).click();
  await expect.poll(() => generationBodies.length).toBe(2);
  expect(generationBodies[1]).toEqual({ period: "2030-01", dueDate: "2030-01-10", jenis: "E2E Preview", dryRun: false });
});

test("Wali child selector keeps URL, header, and data in one child context", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  const childSelector = page.getByRole("combobox", { name: "Pilih anak" });
  await expect(childSelector).toHaveValue("__all__");
  const ahmadId = await childSelector.locator("option").filter({ hasText: "Ahmad Dev / LIMO-DEV-001" }).getAttribute("value");
  if (!ahmadId) throw new Error("Pilihan Ahmad Dev tidak ditemukan");
  await childSelector.selectOption(ahmadId);
  await expect(page).toHaveURL((url) => url.pathname === "/wali" && url.searchParams.get("anak") === ahmadId);
  await expect(childSelector).toHaveValue(ahmadId);
  await expect(page.getByText("Anak Terhubung").locator("..").getByText("1")).toBeVisible();

  await page.goto(`/wali/nilai?anak=${encodeURIComponent(ahmadId)}`);
  await expect(page.getByRole("heading", { name: "Ahmad Dev" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aisyah Dev" })).toHaveCount(0);

  const aisyahId = await childSelector.locator("option").filter({ hasText: "Aisyah Dev / LIMO-DEV-002" }).getAttribute("value");
  if (!aisyahId) throw new Error("Pilihan Aisyah Dev tidak ditemukan");
  await page.goto(`/wali/progres/${ahmadId}`);
  await expect(childSelector).toHaveValue(ahmadId);
  await childSelector.selectOption(aisyahId);
  await expect(page).toHaveURL((url) => url.pathname === `/wali/progres/${aisyahId}` && !url.searchParams.has("anak"));
  await expect(page.getByRole("heading", { name: "Aisyah Dev" })).toBeVisible();

  await childSelector.selectOption("__all__");
  await expect(page).toHaveURL((url) => url.pathname === "/wali/progres" && !url.searchParams.has("anak"));
  await expect(childSelector).toHaveValue("__all__");
  await expect(page.locator("main").getByText("Ahmad Dev").first()).toBeVisible();
  await expect(page.locator("main").getByText("Aisyah Dev").first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === `/wali/progres/${aisyahId}`);
  await expect(childSelector).toHaveValue(aisyahId);
  await expectNoHorizontalOverflow(page);
});

test("Wali can read published learning materials", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });

  await page.goto("/wali/materi");
  await expect(page.getByRole("heading", { name: "Materi Pembelajaran" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Greeting Flashcards" }).first()).toBeVisible();
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
