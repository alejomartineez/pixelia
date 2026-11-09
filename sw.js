// Service worker: juega offline. Estrategia: red primero para HTML/JS (así llegan las actualizaciones;
// si la red tarda más de NET_TIMEOUT se usa la copia guardada), caché primero para fuentes, íconos y vendor.
// Subí VERSION en cada deploy grande.
// CORE precachea TODOS los módulos (también los que se cargan con import() dinámico: escenas, minijuegos,
// paneles...), así una escena que nunca se abrió con internet igual funciona offline.
// Si agregás un archivo .js nuevo en src/, sumalo acá. Un archivo que falte no rompe la instalación.
const VERSION = 'pixelia-v40';
const NET_TIMEOUT = 4000;
const CORE = [
  './', './index.html', './styles.css', './manifest.webmanifest', './vendor/supabase.min.js',
  './vendor/three.min.js', './fonts/jersey10.woff2', './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-maskable-512.png', './assets/audio/amb/amb_cave.m4a', './assets/audio/amb/amb_crickets.m4a', './assets/audio/amb/amb_fire.m4a',
  './assets/audio/amb/amb_forest.m4a', './assets/audio/amb/amb_rain.m4a', './assets/audio/amb/amb_sea.m4a', './assets/audio/amb/amb_town.m4a', './assets/audio/amb/amb_wind.m4a',
  './assets/audio/inst/choir_aah.m4a', './assets/audio/inst/flute_A3.m4a', './assets/audio/inst/flute_A4.m4a', './assets/audio/inst/flute_A5.m4a', './assets/audio/inst/flute_C3.m4a',
  './assets/audio/inst/flute_C4.m4a', './assets/audio/inst/flute_C5.m4a', './assets/audio/inst/flute_C6.m4a', './assets/audio/inst/flute_E3.m4a', './assets/audio/inst/flute_E4.m4a',
  './assets/audio/inst/flute_E5.m4a', './assets/audio/inst/piano_A3.m4a', './assets/audio/inst/piano_A4.m4a', './assets/audio/inst/piano_A5.m4a', './assets/audio/inst/piano_B2.m4a',
  './assets/audio/inst/piano_C4.m4a', './assets/audio/inst/piano_C5.m4a', './assets/audio/inst/piano_C6.m4a', './assets/audio/inst/piano_Ds3.m4a', './assets/audio/inst/piano_Ds4.m4a',
  './assets/audio/inst/piano_Ds5.m4a', './assets/audio/inst/piano_Ds6.m4a', './assets/audio/inst/piano_Fs2.m4a', './assets/audio/inst/piano_Fs3.m4a', './assets/audio/inst/piano_Fs4.m4a',
  './assets/audio/inst/piano_Fs5.m4a', './assets/audio/inst/pizz_A2.m4a', './assets/audio/inst/pizz_A3.m4a', './assets/audio/inst/pizz_B2.m4a', './assets/audio/inst/pizz_B4.m4a',
  './assets/audio/inst/pizz_C4.m4a', './assets/audio/inst/pizz_D3.m4a', './assets/audio/inst/pizz_D5.m4a', './assets/audio/inst/pizz_E4.m4a', './assets/audio/inst/pizz_Fs3.m4a',
  './assets/audio/inst/pizz_G2.m4a', './assets/audio/inst/pizz_G4.m4a', './assets/audio/inst/timp_1.m4a', './assets/audio/inst/timp_2.m4a', './assets/audio/inst/timp_3.m4a',
  './assets/audio/inst/timp_4.m4a', './assets/audio/inst/timp_5.m4a', './assets/audio/manifest.json', './assets/audio/sfx/act_bookClose.m4a', './assets/audio/sfx/act_bookFlip1.m4a',
  './assets/audio/sfx/act_bookFlip2.m4a', './assets/audio/sfx/act_bookOpen.m4a', './assets/audio/sfx/act_chop.m4a', './assets/audio/sfx/act_cloth1.m4a', './assets/audio/sfx/act_cloth3.m4a',
  './assets/audio/sfx/act_creak1.m4a', './assets/audio/sfx/act_creak2.m4a', './assets/audio/sfx/act_doorClose1.m4a', './assets/audio/sfx/act_doorOpen1.m4a', './assets/audio/sfx/act_drawKnife1.m4a',
  './assets/audio/sfx/act_dropLeather.m4a', './assets/audio/sfx/act_footstep00.m4a', './assets/audio/sfx/act_footstep01.m4a', './assets/audio/sfx/act_footstep02.m4a', './assets/audio/sfx/act_footstep03.m4a',
  './assets/audio/sfx/act_footstep04.m4a', './assets/audio/sfx/act_footstep05.m4a', './assets/audio/sfx/act_handleCoins.m4a', './assets/audio/sfx/act_handleCoins2.m4a', './assets/audio/sfx/act_knifeSlice.m4a',
  './assets/audio/sfx/act_metalClick.m4a', './assets/audio/sfx/act_metalLatch.m4a', './assets/audio/sfx/act_metalPot1.m4a', './assets/audio/sfx/sfx_anvil1.m4a', './assets/audio/sfx/sfx_anvil2.m4a',
  './assets/audio/sfx/sfx_birds1.m4a', './assets/audio/sfx/sfx_birds2.m4a', './assets/audio/sfx/sfx_owl.m4a', './assets/audio/sfx/sfx_thunder.m4a', './assets/audio/sfx/ui_click1.m4a',
  './assets/audio/sfx/ui_click2.m4a', './assets/audio/sfx/ui_click3.m4a', './assets/audio/sfx/ui_close1.m4a', './assets/audio/sfx/ui_close2.m4a', './assets/audio/sfx/ui_confirmation1.m4a',
  './assets/audio/sfx/ui_confirmation2.m4a', './assets/audio/sfx/ui_drop2.m4a', './assets/audio/sfx/ui_error4.m4a', './assets/audio/sfx/ui_error6.m4a', './assets/audio/sfx/ui_glass1.m4a',
  './assets/audio/sfx/ui_kclick3.m4a', './assets/audio/sfx/ui_krollover2.m4a', './assets/audio/sfx/ui_kswitch22.m4a', './assets/audio/sfx/ui_kswitch7.m4a', './assets/audio/sfx/ui_open1.m4a',
  './assets/audio/sfx/ui_open2.m4a', './assets/audio/sfx/ui_pluck1.m4a', './assets/audio/sfx/ui_scroll2.m4a', './assets/audio/sfx/ui_select1.m4a', './assets/audio/sfx/ui_select2.m4a',
  './assets/audio/sfx/ui_tick2.m4a', './assets/audio/sfx/ui_toggle2.m4a',
  './src/main.js',
  './src/album/album-art.js', './src/album/album-ui.js', './src/album/album.js',
  './src/audio/composer.js', './src/audio/engine.js', './src/audio/mixer.js', './src/audio/pieces.js', './src/audio/sampler.js',
  './src/audio/soundscape.js', './src/audio/synth.js',
  './src/avatar/avatar-kit.js', './src/avatar/avatar.js', './src/avatar/car.js', './src/avatar/figure.js', './src/avatar/lowpoly.js',
  './src/avatar/skiff.js', './src/avatar/wardrobe-stage.js',
  './src/chests/chest-model.js', './src/chests/chests-ui-common.js', './src/chests/chests-ui-opening.js', './src/chests/chests-ui-style.js', './src/chests/chests-ui.js',
  './src/chests/chests.js',
  './src/city/models-cycle.js', './src/city/models-deco.js', './src/city/models-defense.js', './src/city/models-home.js', './src/city/models-houses.js',
  './src/city/models-kit.js', './src/city/models-monuments.js', './src/city/models-raiz.js', './src/city/models-shops.js', './src/city/models-shops3.js',
  './src/city/models-special.js', './src/city/models-town.js', './src/city/models.js', './src/city/themes-ui.js', './src/city/themes.js',
  './src/combat/boss-models.js', './src/combat/classes.js', './src/combat/combat-data.js', './src/combat/combat-rules.js', './src/combat/combat-scene.js',
  './src/combat/combat-ui.js', './src/combat/enemy-models.js',
  './src/core/ambience-fx.js', './src/core/ambience.js', './src/core/audio.js', './src/core/bus.js', './src/core/classes-migrate.js',
  './src/core/classes.js', './src/core/data.js', './src/core/desktop.js', './src/core/economy.js', './src/core/frame-cap.js',
  './src/core/hud.js', './src/core/icons.js', './src/core/keys.js', './src/core/monuments.js', './src/core/palette.js',
  './src/core/people-data.js', './src/core/people.js', './src/core/quests.js', './src/core/raiz.js', './src/core/settings.js',
  './src/core/state.js', './src/core/tips.js', './src/core/ui.js', './src/core/unlocks.js', './src/core/voxel.js',
  './src/expedition/exp-ambience.js', './src/expedition/exp-data.js', './src/expedition/exp-gen.js', './src/expedition/exp-guide.js', './src/expedition/exp-rules.js',
  './src/expedition/exp-scene.js', './src/expedition/exp-ui.js', './src/expedition/expedition.js',
  './src/home/furniture-models.js', './src/home/furniture.js',
  './src/online/config.js', './src/online/net-mock.js', './src/online/net-supabase.js', './src/online/net.js', './src/online/social-account.js',
  './src/online/social-common.js', './src/online/social-mail.js', './src/online/social-style.js', './src/online/social-trade.js', './src/online/social-ui.js',
  './src/online/social-week.js', './src/online/social.js', './src/online/sync.js', './src/online/telemetry.js',
  './src/scenes/arrival.js', './src/scenes/city-act1.js', './src/scenes/city-ambience.js', './src/scenes/city-batch.js', './src/scenes/city-camera.js',
  './src/scenes/city-common.js', './src/scenes/city-fx.js', './src/scenes/city-grieta.js', './src/scenes/city-life.js', './src/scenes/city-place.js',
  './src/scenes/city-ui.js', './src/scenes/city-visit.js', './src/scenes/city-world.js', './src/scenes/city.js', './src/scenes/home.js',
  './src/scenes/install-card.js', './src/scenes/onboarding.js', './src/scenes/panels-common.js', './src/scenes/panels-expedition.js', './src/scenes/panels-progress.js',
  './src/scenes/panels-quests.js', './src/scenes/panels-rank.js', './src/scenes/panels-rewards.js', './src/scenes/panels-settings.js', './src/scenes/panels-story.js',
  './src/scenes/panels-style.js', './src/scenes/panels-works.js', './src/scenes/panels-workshop.js', './src/scenes/panels.js', './src/scenes/wardrobe.js',
  './src/season/events-ui.js', './src/season/events.js', './src/season/season-data.js', './src/season/season-ui-common.js', './src/season/season-ui.js',
  './src/season/season.js',
  './src/story/act1.js', './src/story/echo-fx.js', './src/story/echoes.js', './src/story/raiz-ui.js', './src/story/story-data.js',
  './src/story/story-ui.js', './src/story/story.js',
  './src/threats/threat-calendar.js', './src/threats/threat-data.js', './src/threats/threat-rules.js', './src/threats/threat-scene.js', './src/threats/threat-ui.js',
  './src/threats/threats.js',
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
