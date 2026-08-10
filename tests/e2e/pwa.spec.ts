import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const CACHE_PREFIX = "limo-";
const CACHED_PUBLIC_PATH = "/kebijakan-privasi";
const FALLBACK_PUBLIC_PATH = "/syarat-penggunaan";
const SENSITIVE_CACHE_PATH = /^\/(?:api(?:\/|$)|admin(?:\/|$)|guru(?:\/|$)|siswa(?:\/|$)|wali(?:\/|$)|login(?:\/|$)|lupa-password(?:\/|$)|reset-password(?:\/|$)|ubah-password(?:\/|$))/;

type WebManifest = {
  name?: string;
  icons?: { src: string; type?: string }[];
};

async function waitForActiveServiceWorker(page: Page) {
  await expect.poll(async () => page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    return (await navigator.serviceWorker.getRegistration())?.active?.state === "activated";
  }), { timeout: 30_000 }).toBe(true);

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 30_000 }).toBe(true);
}

async function cachePaths(page: Page) {
  return page.evaluate(async (prefix) => {
    const paths: string[] = [];
    const names = await caches.keys();

    for (const name of names.filter((cacheName) => cacheName.startsWith(prefix))) {
      const requests = await (await caches.open(name)).keys();
      paths.push(...requests.map((request) => {
        const url = new URL(request.url);
        return `${url.pathname}${url.search}`;
      }));
    }

    return paths;
  }, CACHE_PREFIX);
}

async function removeCachedPath(page: Page, path: string) {
  return page.evaluate(async ({ prefix, path }) => {
    let removed = false;
    const names = await caches.keys();

    for (const name of names.filter((cacheName) => cacheName.startsWith(prefix))) {
      removed = (await (await caches.open(name)).delete(path)) || removed;
    }

    return removed;
  }, { prefix: CACHE_PREFIX, path });
}

test("production PWA exposes its manifest, activates its worker, and caches only exact public pages", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await waitForActiveServiceWorker(page);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifestUrl = new URL(manifestHref || "/manifest.webmanifest", page.url()).toString();
  const manifestResponse = await page.request.get(manifestUrl);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json() as WebManifest;
  const icons = manifest.icons || [];

  expect(manifest.name).toBe("LIMO LMS");
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) {
    const iconResponse = await page.request.get(new URL(icon.src, page.url()).toString());
    expect(iconResponse.ok(), `Manifest icon is unavailable: ${icon.src}`).toBe(true);
    expect(iconResponse.headers()["content-type"]).toMatch(/^image\/png/);
  }

  const cachedPaths = await cachePaths(page);
  expect(cachedPaths).toContain(CACHED_PUBLIC_PATH);
  expect(cachedPaths).toContain(FALLBACK_PUBLIC_PATH);
  expect(cachedPaths.filter((path) => SENSITIVE_CACHE_PATH.test(path))).toEqual([]);

  await page.setExtraHTTPHeaders({ "Cache-Control": "no-cache" });
  await page.context().setOffline(true);
  try {
    const cachedResponse = await page.goto(CACHED_PUBLIC_PATH, { waitUntil: "domcontentloaded" });
    expect(cachedResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Kebijakan Privasi" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "LIMO sedang offline" })).toHaveCount(0);
  } finally {
    await page.context().setOffline(false);
    await page.setExtraHTTPHeaders({});
  }

  expect(await removeCachedPath(page, FALLBACK_PUBLIC_PATH)).toBe(true);
  expect((await cachePaths(page)).includes(FALLBACK_PUBLIC_PATH)).toBe(false);

  await page.setExtraHTTPHeaders({ "Cache-Control": "no-cache" });
  await page.context().setOffline(true);
  try {
    const fallbackResponse = await page.goto(FALLBACK_PUBLIC_PATH, { waitUntil: "domcontentloaded" });
    expect(fallbackResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "LIMO sedang offline" })).toBeVisible();
  } finally {
    await page.context().setOffline(false);
    await page.setExtraHTTPHeaders({});
  }
});
