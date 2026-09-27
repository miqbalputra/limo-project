import { expect, test } from "@playwright/test";
import { loginViaForm } from "./support/auth";

function originOf(page: import("@playwright/test").Page) {
  return page.url().startsWith("http") ? new URL(page.url()).origin : "http://127.0.0.1:3000";
}

test("Guru dapat menyimpan soal dari builder tanpa error reset", async ({ page }) => {
  test.setTimeout(150_000);
  await loginViaForm(page, "guru@limo.local");

  await page.goto("/guru/bank-soal/baru");
  await expect(page.getByRole("heading", { name: "Buat soal", exact: true })).toBeVisible();

  const prompt = `Ibu kota Indonesia? (E2E ${Date.now()})`;
  await page.getByTestId("bank-soal-question-field").fill(prompt);
  await page.getByPlaceholder("Opsi A").fill("Jakarta");
  await page.getByPlaceholder("Opsi B").fill("Bandung");
  await page.getByRole("button", { name: "Tandai opsi A sebagai jawaban benar" }).click();

  await page.getByRole("button", { name: "Simpan Soal" }).click();

  // Regresi: dulu handler melempar "Cannot read properties of null (reading 'reset')".
  await expect(page.getByText("Soal berhasil disimpan ke bank soal.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Cannot read properties of null/)).toHaveCount(0);

  await page.goto("/guru/bank-soal");
  await expect(page.getByText(prompt)).toBeVisible({ timeout: 30_000 });
});

test("Pratinjau draft membuka tab baru berisi soal dan kunci", async ({ page, context }) => {
  test.setTimeout(120_000);
  await loginViaForm(page, "guru@limo.local");

  await page.goto("/guru/bank-soal/baru");
  const prompt = `Soal pratinjau draft (E2E ${Date.now()})`;
  await page.getByTestId("bank-soal-question-field").fill(prompt);
  await page.getByPlaceholder("Opsi A").fill("Satu");
  await page.getByPlaceholder("Opsi B").fill("Dua");
  await page.getByRole("button", { name: "Tandai opsi A sebagai jawaban benar" }).click();

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: "Pratinjau di tab baru" }).click(),
  ]);
  await popup.waitForLoadState();

  await expect(popup.getByRole("heading", { name: "Pratinjau soal", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(popup.getByText(prompt)).toBeVisible();
  await expect(popup.getByText("Kunci & pembahasan")).toBeVisible();
  await expect(popup.getByText("Opsi benar")).toBeVisible();
  await popup.close();
});

test("Pratinjau soal tersimpan membuka tab baru dari daftar", async ({ page, context }) => {
  test.setTimeout(120_000);
  await loginViaForm(page, "guru@limo.local");
  const origin = originOf(page);

  const prompt = `Soal tersimpan (E2E ${Date.now()})`;
  const created = await page.request.post("/api/v1/bank-soal", {
    data: {
      type: "PILIHAN_GANDA",
      question: prompt,
      expectedAnswer: "Satu",
      explanation: "Pembahasan uji pratinjau.",
      options: [
        { label: "A", content: "Satu", isCorrect: true },
        { label: "B", content: "Dua", isCorrect: false },
      ],
    },
    headers: { Origin: origin },
  });
  expect(created.status(), await created.text()).toBe(201);

  await page.goto("/guru/bank-soal");
  const card = page.locator('[data-testid="bank-soal-card"]', { hasText: prompt });
  await expect(card).toBeVisible({ timeout: 30_000 });

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    card.getByRole("link", { name: "Pratinjau (tab baru)" }).click(),
  ]);
  await popup.waitForLoadState();

  await expect(popup.getByRole("heading", { name: "Pratinjau soal tersimpan" })).toBeVisible({ timeout: 30_000 });
  await expect(popup.getByText(prompt)).toBeVisible();
  await expect(popup.getByText("Kunci & pembahasan")).toBeVisible();
  await popup.close();
});
