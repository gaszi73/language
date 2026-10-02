// Offline gyorsítótár: az app fájljai internet nélkül is betöltődnek (az AI-beszélgetés kivételével).
const CACHE = "angol-beszed-v2";
const FILES = [
  "./", "index.html", "manifest.json", "icon.svg", "css/style.css",
  "js/app.js", "js/assessment.js", "js/carmode.js", "js/drills.js", "js/mistakes.js", "js/report.js", "js/score.js",
  "js/speech.js", "js/storage.js", "js/tutor.js", "js/tutorview.js", "js/ui.js",
  "data/assessment.js", "data/exercises.js", "data/phrases.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Hálózat először (így a frissítések azonnal megjelennek), hiba esetén a gyorsítótár.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
