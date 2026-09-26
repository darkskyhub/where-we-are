const CACHE = "sky-tonight-v20260926";

async function precache(cache) {
  let list = [];
  try {
    const res = await fetch(new URL("precache.json", self.location));
    if (res.ok) list = await res.json();
  } catch (err) {
    console.warn("precache list missing", err);
  }
  if (!Array.isArray(list)) return;
  for (const item of list) {
    try {
      await cache.add(new URL(item, self.location));
    } catch (err) {
      console.warn("precache miss", item, err);
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => precache(cache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const scoped = new URL(".", self.location);
      const shell = new URL("./", self.location).href;
      if (request.mode === "navigate") {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) await cache.put(request, fresh.clone());
          if (fresh.ok) return fresh;
        } catch {
          /* use the cached sky page */
        }
        return (
          (await cache.match(request)) ||
          (await cache.match(shell)) ||
          (await cache.match(new URL("index.html", scoped))) ||
          (await cache.match(new URL("offline.html", scoped))) ||
          Response.error()
        );
      }
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return hit || Response.error();
      }
    })(),
  );
});
