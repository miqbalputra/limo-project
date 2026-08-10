const LIMO_CACHE_PREFIX = "limo-";
const CACHE_NAME = "limo-pwa-public-v2";
const OFFLINE_URL = "/offline.html";
const PUBLIC_PAGE_PATHS = ["/", "/daftar", "/status-pendaftaran", "/kebijakan-privasi", "/syarat-penggunaan"];
const PUBLIC_STATIC_PATHS = [
  OFFLINE_URL,
  "/icon.svg",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/icon-maskable-512x512.png",
  "/apple-touch-icon.png",
  "/logo.jpg",
  "/flag-english.svg",
  "/flag-arabic.svg",
];
const PRE_CACHE_URLS = [...PUBLIC_PAGE_PATHS, ...PUBLIC_STATIC_PATHS];
const PRIVATE_PATH_PREFIXES = [
  "/api",
  "/admin",
  "/guru",
  "/siswa",
  "/wali",
  "/login",
  "/lupa-password",
  "/reset-password",
  "/ubah-password",
];

function hasPathPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPrivatePath(pathname) {
  return PRIVATE_PATH_PREFIXES.some((prefix) => hasPathPrefix(pathname, prefix));
}

function isNamedPublicPage(url) {
  return url.search === "" && PUBLIC_PAGE_PATHS.includes(url.pathname);
}

function isPublicStaticAsset(url) {
  return url.search === "" && (PUBLIC_STATIC_PATHS.includes(url.pathname) || url.pathname.startsWith("/_next/static/"));
}

function isCacheableResponse(response) {
  return response.ok && response.type === "basic" && !response.headers.has("set-cookie");
}

function deleteLimoCaches(exceptCacheName) {
  return caches
    .keys()
    .then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(LIMO_CACHE_PREFIX) && cacheName !== exceptCacheName)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    );
}

async function servePublicNavigation(request, url) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (isCacheableResponse(response) && response.headers.get("content-type")?.includes("text/html")) {
      try {
        await cache.put(url.pathname, response.clone());
      } catch {
        // A cache write failure must not prevent the public page from loading.
      }
    }

    return response;
  } catch {
    const cachedPage = await cache.match(url.pathname);

    if (cachedPage) {
      return cachedPage;
    }

    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function servePublicStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedAsset = await cache.match(request);

  if (cachedAsset) {
    return cachedAsset;
  }

  const response = await fetch(request);

  if (isCacheableResponse(response)) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // A cache write failure must not prevent a public asset from loading.
    }
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(deleteLimoCaches(CACHE_NAME).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // API, authenticated, and unlisted routes stay outside the service worker.
  if (request.method !== "GET" || url.origin !== self.location.origin || isPrivatePath(url.pathname)) {
    return;
  }

  if (request.mode === "navigate" && isNamedPublicPage(url)) {
    event.respondWith(servePublicNavigation(request, url));
    return;
  }

  if (isPublicStaticAsset(url)) {
    event.respondWith(servePublicStaticAsset(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (event.data?.type === "PURGE_LIMO_CACHE") {
    event.waitUntil(deleteLimoCaches());
  }
});
