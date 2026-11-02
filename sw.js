// Service worker: juega offline. Estrategia: red primero para HTML/JS (así llegan las actualizaciones),
// caché primero para fuentes, íconos y three.js. Subí VERSION en cada deploy grande.
const VERSION = 'pixelia-v1';
const CORE = [
  './', './index.html', './styles.css', './manifest.webmanifest', './vendor/three.min.js',
  './fonts/pixelify-400.woff2', './fonts/pixelify-600.woff2', './fonts/pixelify-700.woff2',
  './icons/icon-192.png', './icons/apple-touch-icon.png',
  './src/main.js', './src/core/bus.js', './src/core/state.js', './src/core/data.js', './src/core/economy.js', './src/core/quests.js',
  './src/core/ui.js', './src/core/icons.js', './src/core/audio.js', './src/core/voxel.js', './src/core/hud.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  const static_ = /\.(woff2|png|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('three.min.js');
  if (static_) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })));
  } else {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
  }
});
