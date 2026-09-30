import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

function originOf(page: import("@playwright/test").Page) {
  return page.url().startsWith("http") ? new URL(page.url()).origin : "http://127.0.0.1:3000";
}

async function createSoal(page: import("@playwright/test").Page, data: Record<string, unknown>) {
  const response = await page.request.post("/api/v1/bank-soal", { data, headers: { Origin: originOf(page) } });
  expect(response.status(), await response.text()).toBe(201);
}

test("Pustaka Soal menampilkan soal dari formulir tanpa jalur pembuatan soal terpisah", async ({ page }) => {
  test.setTimeout(150_000);
  await loginViaForm(page, "guru@limo.local");

  const prompt = `Soal pustaka (E2E ${Date.now()})`;
  await createSoal(page, {
    type: "PILIHAN_GANDA",
    question: prompt,
    expectedAnswer: "Jakarta",
    explanation: "Ibu kota Indonesia.",
    options: [
      { label: "A", content: "Jakarta", isCorrect: true },
      { label: "B", content: "Bandung", isCorrect: false },
    ],
  });

  await page.goto("/guru/bank-soal");
  await expect(page.getByRole("heading", { name: "Pustaka Soal", exact: true })).toBeVisible();

  const card = page.locator('[data-testid="bank-soal-card"]', { hasText: prompt });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText(/Kunci:/)).toBeVisible();

  // Soal kini hanya dibuat di dalam formulir; pustaka tidak punya halaman pembuatan/penyuntingan sendiri.
  await expect(page.getByRole("link", { name: /Buat soal/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Buat formulir baru" })).toHaveAttribute("href", "/guru/kuis/baru");

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});

test("Pustaka Soal bisa dicari dan difilter berdasarkan tipe", async ({ page }) => {
  test.setTimeout(150_000);
  await loginViaForm(page, "guru@limo.local");

  const marker = `E2E${Date.now()}`;
  await createSoal(page, {
    type: "PILIHAN_GANDA",
    question: `Pilihan ${marker}`,
    expectedAnswer: "Satu",
    options: [
      { label: "A", content: "Satu", isCorrect: true },
      { label: "B", content: "Dua", isCorrect: false },
    ],
  });
  await createSoal(page, { type: "ESAI", question: `Uraian ${marker}`, options: [] });

  await page.goto(`/guru/bank-soal?search=${encodeURIComponent(marker)}`);
  await expect(page.locator('[data-testid="bank-soal-card"]')).toHaveCount(2, { timeout: 30_000 });

  await page.goto(`/guru/bank-soal?search=${encodeURIComponent(marker)}&type=ESAI`);
  const cards = page.locator('[data-testid="bank-soal-card"]');
  await expect(cards).toHaveCount(1, { timeout: 30_000 });
  await expect(cards.first()).toContainText(`Uraian ${marker}`);
});

test("Soal di Pustaka Soal dapat diduplikat", async ({ page }) => {
  test.setTimeout(150_000);
  await loginViaForm(page, "guru@limo.local");

  const prompt = `Soal duplikat (E2E ${Date.now()})`;
  await createSoal(page, {
    type: "ISIAN_SINGKAT",
    question: prompt,
    expectedAnswer: "H2O",
  });

  await page.goto(`/guru/bank-soal?search=${encodeURIComponent(prompt)}`);
  const card = page.locator('[data-testid="bank-soal-card"]', { hasText: prompt });
  await expect(card).toBeVisible({ timeout: 30_000 });

  await card.getByRole("button", { name: "Duplikat" }).click();
  await expect(page.getByText("Soal berhasil diduplikat.")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="bank-soal-card"]', { hasText: prompt })).toHaveCount(2, { timeout: 30_000 });
});
