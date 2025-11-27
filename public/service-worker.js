self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open("tbw-cache").then((cache) => {
      return cache.addAll([
        "/",
        "/index.html",
        "/style.css",
        "/app.js",
        "/manifest.json",
        "/assets/placeholder-hero.jpg"
      ]);
    })
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return (
        response ||
        fetch(e.request).catch(() => caches.match("/assets/placeholder-hero.jpg"))
      );
    })
  );
});
