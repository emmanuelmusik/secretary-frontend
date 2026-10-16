// Keeps the app itself (its screens and scripts) on the phone so Secretary opens without a connection.
// Data is NOT handled here: that is the app's own offline cache. Only this site's files are touched.
const VERSION = 'v1';
const SHELL = `secretary-shell-${VERSION}`;
const ASSETS = `secretary-assets-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add(new Request('/index.html', { cache: 'reload' }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('secretary-') && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API, Supabase, fonts: never touched
  if (url.pathname === '/sw.js') return;

  // Opening a screen: the live page when there is signal, the kept copy when there is not.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await withTimeout(fetch(req), 4000);
        if (res.ok) { const c = await caches.open(SHELL); c.put('/index.html', res.clone()); }
        return res;
      } catch {
        const kept = await caches.match('/index.html');
        return kept || Response.error();
      }
    })());
    return;
  }

  // Built scripts and styles have a hash in their name, so a kept copy never goes stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const kept = await caches.match(req);
      if (kept) return kept;
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(ASSETS); c.put(req, res.clone()); }
      return res;
    })());
    return;
  }

  // Icons and other small files: show the kept copy, refresh it in the background.
  event.respondWith((async () => {
    const c = await caches.open(ASSETS);
    const kept = await c.match(req);
    const fresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => kept);
    return kept || fresh;
  })());
});
