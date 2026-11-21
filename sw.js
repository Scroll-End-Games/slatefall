// Playing without internet (design v1.3, sections 2 and 9): this worker keeps every file of the
// game in a cache and answers from it first.
// A phone fetches the game anew only when this file itself has changed. So the cache carries two
// things in its name: the version of texts.js, and the mark of the files listed below.
// test/offline.test.js works that mark out from the files and fails until it stands here: any
// change to a file of the game then changes this file too, and phones stop showing the old game.
const VERSION = "0.1.3";
const STAMP = "ad99bd3c";
const CACHE = `slatefall-${VERSION}-${STAMP}`;

// Every file the browser gets.
const FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "core.js",
  "input.js",
  "pixel.js",
  "sound.js",
  "store.js",
  "texts.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];

// On install: fetch every file afresh, past the browser's own cache, and take over at once.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

// On activate: remove the caches of older versions, and serve the pages that are open already.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("slatefall-") && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Every request for a file of the game is answered from the cache first, then from the network.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const kept = await cache.match(request, { ignoreSearch: true });
      if (kept) return kept;
      try {
        return await fetch(request);
      } catch (error) {
        // Without a connection, any page of the game is the game itself.
        if (request.mode === "navigate") {
          const page = await cache.match("index.html");
          if (page) return page;
        }
        throw error;
      }
    }),
  );
});
