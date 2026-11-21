/* Cache do app shell — funciona offline, mas prioriza rede para HTML/CSS/JS
   (evita que uma correção de CSS fique presa no cache antigo). */
const CACHE = 'relatorio-mestre-v3';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './layout.js',
  './logo.js', './logo.png', './logo-512.png', './sample-photos.js',
  './vendor/html2canvas.min.js', './manifest.webmanifest',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const isCode = e.request.mode === 'navigate' || /\.(html|css|js|webmanifest)(\?|$)/.test(url.pathname);
  if (isCode) {
    /* network-first: sempre pega a versão publicada mais recente */
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
    );
    return;
  }
  /* assets: cache-first, com download em segundo plano */
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }))
  );
});
