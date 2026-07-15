const CACHE_NAME = "mom-home-v3";
const APP_SHELL = ["./", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const scopeUrl = new URL(self.registration.scope);
const staticPrefix = `${scopeUrl.pathname}_next/static/`;
const appShellPathnames = new Set(APP_SHELL.map((path) => new URL(path, self.registration.scope).pathname));

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(new URL("./", self.registration.scope).toString())) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  const urls = APP_SHELL.map((path) => new URL(path, self.registration.scope).toString());
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urls)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.startsWith(staticPrefix) || appShellPathnames.has(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
  }
});
