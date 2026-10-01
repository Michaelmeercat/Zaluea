import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';

/** Emits sw.js precaching every built asset so the game works offline after the first load. */
function serviceWorker(): Plugin {
  return {
    name: 'riftkeepers-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const extra = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
      const list = [...new Set([...extra, ...files])];
      const version = createHash('sha1').update(list.join('|') + Date.now()).digest('hex').slice(0, 10);
      const src = `// Generated at build time.
const CACHE = 'riftkeepers-${version}';
const PRECACHE = ${JSON.stringify(list)};
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
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig(({ mode }) => {
  // `--mode artifact` produces a single self-contained page (fonts inlined, one JS chunk, no service worker)
  const artifact = mode === 'artifact';
  return {
    base: './',
    plugins: artifact ? [] : [serviceWorker()],
    build: {
      target: 'es2020',
      outDir: artifact ? 'dist-artifact' : 'dist',
      assetsInlineLimit: artifact ? 10_000_000 : 0,
      cssCodeSplit: !artifact,
      modulePreload: artifact ? false : undefined,
      rollupOptions: { input: 'index.html', output: artifact ? { inlineDynamicImports: true } : undefined },
    },
    server: { host: true, port: 5173 },
  };
});
