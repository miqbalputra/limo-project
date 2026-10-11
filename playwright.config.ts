import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const baseURL = "http://127.0.0.1:3000";
const mobileLayoutSpec = /mobile-layout\.spec\.ts/;
const pwaProductionSpec = /pwa\.spec\.ts/;
const reuseExistingServer = !isCI && process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== "false";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: pwaProductionSpec,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: 1,
  timeout: isCI ? 120_000 : 90_000,
  // Snapshot visual dipinding per-platform (berakhiran -win32, dibuat lokal);
  // rendering webkit/chromium lintas OS tidak identik (font & antialiasing),
  // jadi di CI perbandingan piksel dilewati — asersi layout lain tetap jalan.
  ignoreSnapshots: isCI,
  expect: {
    // Dev server di CI mengompilasi tiap halaman dari nol; beri anggaran
    // lebih besar untuk toBeVisible/toHaveURL sebelum test dinyalakan.
    timeout: isCI ? 40_000 : 15_000,
  },
  outputDir: "test-results/e2e",
  reporter: isCI
    ? [
      ["github"],
      ["html", { open: "never", outputFolder: "playwright-report" }],
      ["junit", { outputFile: "test-results/e2e-junit.xml" }],
    ]
    : [
      ["list"],
      ["html", { open: "never", outputFolder: "playwright-report" }],
    ],
  use: {
    baseURL,
    serviceWorkers: "block",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [mobileLayoutSpec, pwaProductionSpec],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium-360",
      testMatch: mobileLayoutSpec,
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-chromium-390",
      testMatch: mobileLayoutSpec,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-webkit-360",
      testMatch: mobileLayoutSpec,
      use: {
        browserName: "webkit",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-webkit-390",
      testMatch: mobileLayoutSpec,
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${baseURL}/api/health/ready`,
    reuseExistingServer,
    timeout: 120_000,
    env: {
      APP_URL: baseURL,
      NODE_ENV: "development",
    },
  },
});
