/* Living House — offline service worker (hand-rolled, no dependencies).
   The two app pages are stale-while-revalidate: they open instantly from
   cache (fully offline after the first visit) and silently refresh in the
   background for the next visit. Manifest + icons are cache-first.
   Everything else passes through to the network untouched.
   Bump VERSION whenever a deliberate cache reset is wanted. */
const VERSION = 'lh-v1-20261106';
const CACHE = 'living-house-' + VERSION;
const CORE_FILES = ['imran-house-explorer.html', 'client-studio.html', 'field-survey-online.html'];
const STATIC_FILES = ['manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // allSettled: a file that does not exist on one host (the survey page
    // is PythonAnywhere-only) must not fail the whole install.
    await Promise.allSettled([...CORE_FILES, ...STATIC_FILES].map((f) => cache.add(f)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('living-house-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const name = new URL(req.url).pathname.split('/').pop();
  if (CORE_FILES.includes(name)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      const refresh = fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await refresh) || Response.error();
    })());
  } else if (STATIC_FILES.includes(name)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })());
  }
});
