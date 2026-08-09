import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, email: string, destination: string) {
  const response = await page.request.post("/api/v1/auth/login", {
    data: { email, password: "password-dev-only" },
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const sessionCookie = response.headers()["set-cookie"]?.match(/limo_session=([^;]+)/)?.[1];
  expect(sessionCookie).toBeTruthy();
  await page.context().addCookies([{ name: "limo_session", value: sessionCookie as string, domain: "127.0.0.1", path: "/" }]);
  await page.goto(destination);
}

async function assertDismissibleDialog(page: import("@playwright/test").Page, trigger: import("@playwright/test").Locator, title: string) {
  await trigger.focus();
  await trigger.click();
  const dialog = page.getByRole("alertdialog", { name: title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Batal" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: /Ya,/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
}

test("A8/G12 critical mutations use the shared accessible confirmation dialog", async ({ page }) => {
  test.setTimeout(120_000);

  await login(page, "admin@limo.local", "/admin/pendaftaran?status=SUBMITTED");
  const registration = page.locator("article").filter({ hasText: "Hana Putri" });
  await expect(registration).toBeVisible();
  let registrationRequests = 0;
  const blockRegistration = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "POST") {
      registrationRequests += 1;
      await route.fulfill({ status: 500, json: { error: { message: "Mutasi belum dikonfirmasi" } } });
      return;
    }
    await route.continue();
  };
  await page.route("**/api/v1/admin/pendaftaran/**", blockRegistration);
  await assertDismissibleDialog(page, registration.getByRole("button", { name: "Setujui" }), "Setujui pendaftaran?");
  expect(registrationRequests).toBe(0);
  await page.unroute("**/api/v1/admin/pendaftaran/**", blockRegistration);

  await page.context().clearCookies();
  await login(page, "guru@limo.local", "/guru/materi");
  const material = page.locator("article").filter({ hasText: "Greeting Flashcards" });
  await expect(material).toBeVisible();
  let materialRequests = 0;
  const blockMaterial = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") {
      materialRequests += 1;
      await route.fulfill({ status: 500, json: { error: { message: "Mutasi belum dikonfirmasi" } } });
      return;
    }
    await route.continue();
  };
  await page.route("**/api/v1/guru/materi/**", blockMaterial);
  await assertDismissibleDialog(page, material.getByRole("button", { name: "Arsipkan" }), "Arsipkan materi?");
  expect(materialRequests).toBe(0);
  await page.unroute("**/api/v1/guru/materi/**", blockMaterial);

  await page.goto("/guru/ujian");
  const exam = page.locator("article").filter({ hasText: "Mid Semester Demo English" });
  await expect(exam).toBeVisible();
  let examRequests = 0;
  const blockExam = async (route: import("@playwright/test").Route) => {
    if (route.request().method() === "PATCH") {
      examRequests += 1;
      await route.fulfill({ status: 500, json: { error: { message: "Mutasi belum dikonfirmasi" } } });
      return;
    }
    await route.continue();
  };
  await page.route("**/api/v1/ujian/**", blockExam);
  await assertDismissibleDialog(page, exam.getByRole("button", { name: "Arsipkan" }), "Arsipkan ujian?");
  expect(examRequests).toBe(0);
});
