// Generated at build time.
const CACHE = 'riftkeepers-34d1c1c212';
const PRECACHE = ["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","assets/index-CBS4fuWM.js","assets/fredoka-latin-400-normal-17JuUzdy.woff2","assets/fredoka-latin-400-normal-DbXSrOeS.woff","assets/fredoka-latin-600-normal-C4zohCW5.woff2","assets/fredoka-latin-600-normal-CcrEjrB4.woff","assets/fredoka-latin-700-normal-BOIZVyIN.woff2","assets/fredoka-latin-700-normal-C8FeHd3X.woff","assets/index-BOX4ggjz.css"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('riftkeepers-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html', { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
