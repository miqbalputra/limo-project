import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function login(page: Page, identifier: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(identifier);
  await page.locator('input[name="password"]').fill("password-dev-only");
  await page.getByRole("button", { name: "Masuk" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function expectWithinViewport(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  await expect(locator).toBeInViewport();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error("Viewport atau bounding box tidak tersedia");
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
}

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Bounding box target sentuh tidak tersedia");
  expect(box.height).toBeGreaterThanOrEqual(44);
}

async function hideNextDevTools(page: Page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

test("Admin mobile sees agenda cards, invoice cards, and empty states without clipping", async ({ page }) => {
  test.setTimeout(90_000);
  const title = `E2E agenda mobile ${Date.now()}`;
  let createdEventId: string | null = null;

  await login(page, "admin@limo.local");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.goto("/admin/kalender?month=2030-01");

  try {
    const created = await page.evaluate(async (eventTitle) => {
      const response = await fetch("/api/v1/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: eventTitle, eventType: "ANNOUNCEMENT", startAt: "2030-01-15T09:00", visibility: "ALL" }),
      });
      return { status: response.status, payload: await response.json() as { data?: { item?: { id?: string } } } };
    }, title);
    expect(created.status).toBe(201);
    createdEventId = created.payload.data?.item?.id || null;
    expect(createdEventId).toBeTruthy();
    await page.reload();

    const agenda = page.getByTestId("calendar-mobile-agenda");
    const event = agenda.getByRole("button", { name: `Buka agenda ${title}` });
    await expect(event).toBeVisible();
    await expectWithinViewport(page, event);
    await expectTouchTarget(event);
    await expect(event).toHaveScreenshot("calendar-mobile-event.png", { animations: "disabled", mask: [event.getByText(title, { exact: true })] });
    await expectNoHorizontalOverflow(page);

    await page.goto("/admin/tagihan");
    const invoiceCards = page.getByTestId("admin-invoices-cards");
    await expect(invoiceCards).toBeVisible();
    await expect(page.getByTestId("admin-invoices-table")).toBeHidden();
    const firstInvoice = invoiceCards.locator("article").first();
    await expectWithinViewport(page, firstInvoice);
    const detailButton = firstInvoice.getByRole("button", { name: "Lihat detail" });
    await expectTouchTarget(detailButton);
    await expect(firstInvoice).toHaveScreenshot("admin-invoice-card.png", { animations: "disabled" });
    await expectNoHorizontalOverflow(page);

    await page.goto("/admin/siswa?search=__e2e_mobile_no_match__");
    const emptyState = page.getByRole("heading", { name: "Siswa tidak ditemukan" });
    await expectWithinViewport(page, emptyState);
    await expect(emptyState.locator("..")).toHaveScreenshot("admin-students-empty.png", { animations: "disabled" });
    await expectNoHorizontalOverflow(page);
  } finally {
    if (createdEventId) {
      await page.evaluate(async (eventId) => {
        await fetch(`/api/v1/calendar/events/${eventId}`, { method: "DELETE" });
      }, createdEventId);
    }
  }
});

test("Guru and Wali hero asides fit real mobile browser viewports", async ({ page }) => {
  await login(page, "guru@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });
  await page.goto("/guru/kelas");
  const guruAside = page.getByTestId("dashboard-hero-aside");
  await expectWithinViewport(page, guruAside);
  await expect(guruAside).toHaveScreenshot("guru-classes-hero-aside.png", { animations: "disabled" });
  await expectNoHorizontalOverflow(page);

  await page.context().clearCookies();
  await login(page, "wali@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  await page.goto("/wali/tagihan");
  const waliAside = page.getByTestId("dashboard-hero-aside");
  await expectWithinViewport(page, waliAside);
  await expect(waliAside).toHaveScreenshot("wali-billing-hero-aside.png", { animations: "disabled" });
  await expectNoHorizontalOverflow(page);
});

test("Guru Arabic question form and seeded RTL card use localized content", async ({ page }) => {
  test.setTimeout(60_000);
  const arabicPrompt = "مَرْحَبًا يا Bilal، ماذا تتعلّم في LIMO A1؟";

  await login(page, "guru.arab@limo.local");
  await expect(page).toHaveURL(/\/guru$/, { timeout: 15_000 });
  await page.goto("/guru/bank-soal");
  await hideNextDevTools(page);

  const form = page.getByTestId("bank-soal-form");
  await expect(form).toBeVisible();
  await form.locator('select[name="kelasId"]').selectOption({ label: "Bahasa Arab - Arabic Pemula A" });
  await form.getByLabel("Bahasa konten").fill("ar");
  await form.getByLabel("Arah konten").selectOption("rtl");
  const questionField = page.getByTestId("bank-soal-question-field");
  await questionField.fill(arabicPrompt);
  await expect(questionField).toHaveAttribute("lang", "ar");
  await expect(questionField).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("bank-soal-primary-content")).toHaveScreenshot("guru-arabic-bank-soal-form.png", { animations: "disabled" });

  const fontVariable = await page.locator("html").evaluate((element) => getComputedStyle(element).getPropertyValue("--font-arabic").trim());
  expect(fontVariable).not.toBe("");

  const seededQuestion = page.getByTestId("bank-soal-question").filter({ hasText: "ما معنى واحد؟" });
  await expect(seededQuestion).toHaveAttribute("lang", "ar");
  await expect(seededQuestion).toHaveAttribute("dir", "rtl");
  await expect(seededQuestion.locator("bdi")).toHaveAttribute("dir", "rtl");
  const seededCard = page.getByTestId("bank-soal-card").filter({ hasText: "ما معنى واحد؟" });
  await expectWithinViewport(page, seededCard);
  await expect(seededCard).toHaveScreenshot("guru-arabic-bank-soal-card.png", { animations: "disabled" });
  await expectNoHorizontalOverflow(page);
});

test("Wali Arabic material isolates bidi content and preserves child context", async ({ page }) => {
  test.setTimeout(60_000);

  await login(page, "wali.demo@limo.local");
  await expect(page).toHaveURL(/\/wali$/, { timeout: 15_000 });
  await page.goto("/wali/materi");
  await hideNextDevTools(page);

  const childSelector = page.getByRole("combobox", { name: "Pilih anak" });
  const bilalOption = childSelector.locator("option", { hasText: "Bilal Pratama / LIMO-DEV-003" });
  const bilalId = await bilalOption.getAttribute("value");
  if (!bilalId) throw new Error("Fixture Bilal tidak ditemukan");
  await childSelector.selectOption(bilalId);
  await expect(page).toHaveURL(new RegExp(`/wali/materi\\?anak=${bilalId}$`), { timeout: 15_000 });

  const materialCard = page.getByTestId("wali-material-card").filter({ hasText: "Sapaan Bahasa Arab" });
  await expect(materialCard).toContainText("Untuk: Bilal Pratama (LIMO-DEV-003)");
  const arabicContent = materialCard.getByTestId("wali-material-content");
  await expect(arabicContent).toContainText("السلام عليكم");
  await expect(arabicContent).toHaveAttribute("lang", "ar");
  await expect(arabicContent).toHaveAttribute("dir", "rtl");
  await expect(arabicContent.locator("bdi")).toHaveAttribute("dir", "rtl");
  await expectWithinViewport(page, materialCard);
  await expect(materialCard).toHaveScreenshot("wali-arabic-text-material.png", { animations: "disabled" });
  await expectNoHorizontalOverflow(page);
});
