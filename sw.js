// Service worker: juega offline. Estrategia: red primero para HTML/JS (así llegan las actualizaciones;
// si la red tarda más de NET_TIMEOUT se usa la copia guardada), caché primero para fuentes, íconos y vendor.
// Subí VERSION en cada deploy grande.
// CORE precachea TODOS los módulos (también los que se cargan con import() dinámico: escenas, minijuegos,
// paneles...), así una escena que nunca se abrió con internet igual funciona offline.
// Si agregás un archivo .js nuevo en src/, sumalo acá. Un archivo que falte no rompe la instalación.
const VERSION = 'pixelia-v8';
const NET_TIMEOUT = 4000;
const CORE = [
  './', './index.html', './styles.css', './manifest.webmanifest', './vendor/supabase.min.js',
  './vendor/three.min.js', './fonts/jersey10.woff2', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './src/main.js',
  './src/album/album-art.js', './src/album/album-ui.js', './src/album/album.js',
  './src/avatar/avatar-heads.js', './src/avatar/avatar-kit.js', './src/avatar/avatar-outfits.js', './src/avatar/avatar-props.js', './src/avatar/avatar.js',
  './src/avatar/car.js', './src/avatar/princess.js', './src/avatar/wardrobe-stage.js',
  './src/chests/chest-model.js', './src/chests/chests-ui-common.js', './src/chests/chests-ui-opening.js', './src/chests/chests-ui-style.js', './src/chests/chests-ui.js',
  './src/chests/chests.js',
  './src/city/models-deco.js', './src/city/models-houses.js', './src/city/models-kit.js', './src/city/models-shops.js', './src/city/models-special.js',
  './src/city/models.js', './src/city/themes-ui.js', './src/city/themes.js',
  './src/core/audio.js', './src/core/bus.js', './src/core/data.js', './src/core/economy.js', './src/core/hud.js',
  './src/core/icons.js', './src/core/quests.js', './src/core/state.js', './src/core/ui.js', './src/core/voxel.js',
  './src/games/blocks-art.js', './src/games/blocks-logic.js', './src/games/blocks.js', './src/games/boosters.js', './src/games/driving-sky.js',
  './src/games/driving-world.js', './src/games/driving.js', './src/games/match3-engine.js', './src/games/match3-levels.js', './src/games/match3-sprites.js',
  './src/games/match3-style.js', './src/games/match3.js', './src/games/parking-levels.js', './src/games/parking-physics.js', './src/games/parking-style.js',
  './src/games/parking-world.js', './src/games/parking.js',
  './src/online/config.js', './src/online/net-mock.js', './src/online/net-supabase.js', './src/online/net.js', './src/online/social-account.js',
  './src/online/social-common.js', './src/online/social-mail.js', './src/online/social-style.js', './src/online/social-trade.js', './src/online/social-ui.js',
  './src/online/social-week.js', './src/online/social.js', './src/online/sync.js',
  './src/scenes/city-batch.js', './src/scenes/city-camera.js', './src/scenes/city-common.js', './src/scenes/city-fx.js', './src/scenes/city-life.js',
  './src/scenes/city-ui.js', './src/scenes/city-visit.js', './src/scenes/city-world.js', './src/scenes/city.js', './src/scenes/onboarding.js',
  './src/scenes/panels-common.js', './src/scenes/panels-games.js', './src/scenes/panels-quests.js', './src/scenes/panels-rewards.js', './src/scenes/panels-settings.js',
  './src/scenes/panels-style.js', './src/scenes/panels.js', './src/scenes/wardrobe.js',
  './src/season/events-ui.js', './src/season/events.js', './src/season/season-data.js', './src/season/season-ui-common.js', './src/season/season-ui.js',
  './src/season/season.js',
];

self.addEventListener('install', e => {
  // de a uno y tolerante: si un archivo no existe (404) se saltea en vez de cancelar toda la instalación
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  const static_ = /\.(woff2|png|webmanifest)$/.test(url.pathname) || url.pathname.includes('/vendor/');
  if (static_) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  // red primero, con tope de espera: con señal mala en el celu no queremos una pantalla rosa eterna
  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    });
    const timer = setTimeout(() => fromCache(req).then(finish), NET_TIMEOUT);
    net.then(res => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); fromCache(req).then(hit => finish(hit || Response.error())); });
  }));
});
