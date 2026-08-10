import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);
const baseURL = "http://127.0.0.1:3001";
const pwaProductionSpec = /pwa\.spec\.ts/;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: pwaProductionSpec,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  expect: {
    timeout: 15_000,
  },
  outputDir: "test-results/pwa",
  reporter: isCI
    ? [
      ["github"],
      ["html", { open: "never", outputFolder: "playwright-report-pwa" }],
      ["junit", { outputFile: "test-results/pwa-junit.xml" }],
    ]
    : [
      ["list"],
      ["html", { open: "never", outputFolder: "playwright-report-pwa" }],
    ],
  use: {
    baseURL,
    serviceWorkers: "allow",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-pwa",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3001",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      APP_URL: baseURL,
      MAYAR_API_KEY: "playwright-pwa-placeholder-api-key",
      MAYAR_MERCHANT_ID: "playwright-pwa-placeholder-merchant",
      MAYAR_WEBHOOK_SECRET: "playwright-pwa-placeholder-webhook-secret",
      NODE_ENV: "production",
      NOTIFICATION_PROVIDER: "whatsapp",
    },
  },
});
