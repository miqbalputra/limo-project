const CACHE_VERSION = "limo-public-v1";
const PUBLIC_CACHE_URLS = ["/", "/daftar", "/status-pendaftaran", "/offline.html"];
const PRIVATE_PREFIXES = [
  "/api/",
  "/admin",
  "/guru",
  "/wali",
  "/login",
  "/lupa-password",
  "/reset-password",
];

function isPrivateRequest(url) {
  return PRIVATE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PUBLIC_CACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || isPrivateRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (PUBLIC_CACHE_URLS.includes(url.pathname)) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match("/offline.html")),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PURGE_LIMO_CACHE") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }
});
