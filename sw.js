// TEN X service worker. App files: network first, cached copy as the offline fallback.
// Camera model files (/mediapipe/): cache first, in their own cache so app updates do not delete them.
const V = 'tenx-v7', M = 'tenx-models';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== M).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const q = e.request;
  if (q.method !== 'GET') return;
  const u = new URL(q.url);
  if (u.origin === location.origin && u.pathname.includes('/mediapipe/')) {
    e.respondWith(caches.open(M).then(c => c.match(q).then(h => h || fetch(q).then(r => { if (r.ok) c.put(q, r.clone()); return r; }))));
    return;
  }
  e.respondWith(
    fetch(q).then(r => {
      if (u.origin === location.origin && r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(q, c)); }
      return r;
    }).catch(() => caches.match(q).then(r => r || caches.match('index.html')))
  );
});
