// Fachada de sonido del juego (DESIGN-AUDIO.md). El motor vive en src/audio/: mezclador por buses, sampler de .m4a,
// compositor adaptativo y paisaje sonoro. La API de siempre sigue igual:
//   audio.sfx('coin') · audio.music('city') · audio.music(null) · audio.configure(settings) · audio.unlock()
// y suma: audio.setScene({ place, night, weather, light, threat, indoor, danger }) · audio.stinger('hallazgo')
// · audio.intensity(0..1) · audio.epic(true) · audio.motif('quiebre') · audio.step('piedra') · audio.thunder()
// · audio.dialog(true) (baja la música en los diálogos) · audio.connect(bus) (stingers, trueno y noche por eventos)
// · audio.track('intro') (pista grabada .m4a del manifest, categoría music: la de Suno entra así) · audio.voice('intro/01')
// (una línea del narrador por el bus de voz, con la música baja mientras habla; PLAN-TRAVESIA §3a).
// El audio se habilita con el primer gesto (unlock en main.js). Sin muestras cargadas suena la síntesis de respaldo.
import { createEngine, SFX, UI_SFX, PLACE_PIECE } from '../audio/engine.js';
import { resolvePiece } from '../audio/composer.js';
import { PIECES } from '../audio/pieces.js';

const PRIO_TRACK = 6;   // pista grabada y voz: no las roba el límite de voces
let ctx = null, engine = null, timer = null, unlocking = null, userUnlocked = false, preloaded = null;
// volúmenes 0..1 de Ajustes (src/core/settings.js); music/sfx son el sí/no de siempre
let settings = { music: true, sfx: true, volMaster: 0.8, volMusic: 0.7, volSfx: 0.8, volAmb: 0.6, volUi: 0.8, volVoice: 1 };
let bgMuted = false;
// con los valores por defecto de Ajustes cada bus queda en un nivel cómodo (ver DESIGN-AUDIO.md → Mezcla)
const BASE = { master: 0.875, sfx: 0.8 / 0.8, music: 0.62 / 0.7, amb: 0.7 / 0.6, ui: 0.6 / 0.8, voice: 0.9 };
const vol = (k, d = 1) => (typeof settings[k] === 'number' ? settings[k] : d);
function gains() {
  return {
    master: bgMuted ? 0 : BASE.master * vol('volMaster', 0.8),
    sfx: settings.sfx ? BASE.sfx * vol('volSfx', 0.8) : 0,
    music: settings.music ? BASE.music * vol('volMusic', 0.7) : 0,
    amb: BASE.amb * vol('volAmb', 0.6),
    ui: settings.sfx ? BASE.ui * vol('volUi', 0.8) : 0,
    voice: BASE.voice * vol('volVoice', 1),
  };
}
let currentSong = null, currentTrack = null, trackPlay = null, scene = { place: 'city', night: false, weather: 'despejado', light: 1 }, lastHooked = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC({ latencyHint: 'interactive' });
  engine = createEngine(ctx);
  engine.mixer.setLevels(gains());
  return ctx;
}
function startTimer() {
  if (timer || !engine) return;
  timer = setInterval(() => { if (ctx.state === 'running') engine.tick(ctx.currentTime + 0.6); }, 120);
}
function running() { return !!ctx && ctx.state === 'running'; }
function preload() {
  // las pistas grabadas (categoría music) se bajan también durante el splash
  if (!preloaded && engine) preloaded = engine.preload().then(() => engine.sampler.loadGroup('music')).catch(() => {});
  return preloaded;
}
// lugar por defecto de cada pista, para las escenas que no lo dicen (Equipaje, onboarding)
const SONG_PLACE = { city: 'city', calm: 'silent', expedition: 'exp:cerca', expedition_far: 'exp:lejos', threat: 'city', battle: 'combat', epic: 'silent', mine: 'mina', coast: 'faros', under: 'bajo' };

export const audio = {
  unlock() {
    if (!ensure()) return;
    userUnlocked = true;
    const go = () => {
      startTimer(); preload();
      if (currentTrack) audio.track(currentTrack.id, { ...currentTrack.o, force: true });
      else if (currentSong) audio.music(currentSong, true);
      engine.setScene(scene, { now: true, follow: false });
    };
    // resume() es asíncrono: la música recién puede arrancar cuando el contexto pasa a 'running'
    if (ctx.state !== 'running') {
      if (!unlocking) {
        try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch {}
        unlocking = ctx.resume().catch(() => {}).then(() => { unlocking = null; if (running()) go(); });
      }
    } else if (!timer) go();
  },
  configure(s) {
    settings = { ...settings, ...s };
    engine?.mixer.setLevels(gains());
  },
  /** Ventana en segundo plano (Ajustes → Silenciar en segundo plano): muted baja el general; suspend frena el contexto. */
  setBackground(muted, suspend = muted) {
    bgMuted = !!muted;
    engine?.mixer.setLevels(gains());
    if (!ctx) return;
    if (suspend && ctx.state === 'running') ctx.suspend();
    else if (!suspend && ctx.state === 'suspended' && userUnlocked) ctx.resume().then(() => audio.unlock()).catch(() => {});
  },
  /** Volumen efectivo (0..1, sin el silencio de segundo plano) de un canal: 'music' | 'sfx' | 'amb' | 'ui' | 'voice' | 'master'. */
  level(ch) { const g = gains(); return ch === 'master' ? BASE.master * vol('volMaster', 0.8) : g[ch] ?? 0; },
  sfx(name, arg) {
    const isUi = UI_SFX.has(name);
    if (!settings.sfx || !(vol(isUi ? 'volUi' : 'volSfx', 0.8) > 0)) return;
    if (!running()) return;
    // si un evento ya tocó su stinger, el efecto musical chico de la misma acción no se pisa encima
    if (SFX[name]?.st && ctx.currentTime - lastHooked < 1.5) return;
    try { engine.sfx(name, arg); } catch (e) { console.warn('[audio]', e); }
  },
  /** Cambia la música: 'city' | 'calm' | 'expedition' | 'threat' | 'battle' | 'epic' | … | null. Cae en el compás. */
  music(name, force = false) {
    if (currentTrack) audio.track(null);
    const p = resolvePiece(name);
    if (p === currentSong && !force) return;
    currentSong = p;
    if (!running()) return;
    engine.composer.play(p);
  },
  /** Al entrar a una escena (main.js): la pista y el lugar por defecto (las escenas con ambiente propio lo pisan). */
  enterScene(id, song) {
    const p = resolvePiece(song);
    if (id !== 'city' && id !== 'expedition') audio.setScene({ place: SONG_PLACE[p] || 'silent', indoor: false });
    else audio.setScene({ indoor: false });
    audio.music(p);
  },
  /** Lugar, hora y clima de ahora (city-ambience, exp-ambience, combate). */
  setScene(s = {}) {
    scene = { ...scene, ...s };
    if (running()) engine.setScene(scene);
  },
  /** Intensidad musical 0..1 (combate: el peligro). null = la del lugar. */
  intensity(x) { scene = { ...scene, intensity: x ?? undefined }; if (running()) engine.setScene(scene, { follow: false }); },
  /** Modo épico (intro, jefes, revelaciones): coro, timbales y reverb de sala. */
  epic(on = true) { if (running()) engine.composer.setEpic(on); },
  /** Un leitmotiv en la próxima frase: 'isla' | 'cartografa' | 'quiebre'. */
  motif(name) { if (running()) engine.composer.motif(name); },
  stinger(name) { if (!settings.sfx || !running()) return false; lastHooked = ctx.currentTime; return engine.composer.stinger(name); },
  step(surface) { if (settings.sfx && running()) engine.soundscape.step(surface); },
  thunder(o) { if (running()) engine.soundscape.thunder(o); },
  /** Diálogos: la música baja mientras dura. */
  dialog(on) { engine?.mixer.duckHold('dialog', on ? 0.45 : null); },
  /** Stingers, trueno y noche por eventos del juego. */
  connect(bus) {
    const st = (name) => () => audio.stinger(name);
    bus.on('ambience:thunder', () => audio.thunder());
    bus.on('ambience:night', ({ night } = {}) => audio.setScene({ night: !!night }));
    bus.on('story:page', st('pagina'));
    bus.on('story:element', st('elemento'));
    bus.on('reward:stickers', st('hallazgo'));
    bus.on('threat:announced', st('amenaza'));
    bus.on('town:rankup', ({ eraChanged } = {}) => audio.stinger(eraChanged ? 'epoca' : 'rango'));
    bus.on('world:light', ({ to } = {}) => { if (typeof to === 'number') audio.setScene({ light: to }); });
    // enganche para el combate (paso 5): bus.emit('combat:music', { danger: 0..1 }) y 'combat:end' { won }
    bus.on('combat:music', ({ danger = 0.3 } = {}) => { audio.setScene({ place: 'combat', danger }); audio.music('battle'); });
    bus.on('combat:end', ({ won } = {}) => audio.stinger(won ? 'victoria' : 'derrota'));
  },
  /** Créditos de los sonidos (Ajustes → Partida). */
  async credits() {
    try { const r = await fetch('assets/audio/manifest.json'); return r.ok ? (await r.json()).credits || [] : []; } catch { return []; }
  },
  get songs() { return Object.keys(PIECES); },
  get placePiece() { return PLACE_PIECE; },
  /**
   * Pista grabada: 'track/<id>' del manifest (.m4a, categoría music), por el bus de música, en loop salvo { loop: false }.
   * Reemplaza a la música compuesta mientras suena; audio.track(null) la corta con fundido y audio.music(…) vuelve a la
   * compuesta. Si la pista no está en el manifest (todavía no se grabó) suena { fallback } (una pieza, por defecto nada
   * cambia). Devuelve una promesa: true si sonó la grabación.
   */
  async track(id, o = {}) {
    const { loop = true, fade = 1.2, fallback = null, force = false, gain = 1 } = o;
    if (!id) {
      const tp = trackPlay; trackPlay = null; currentTrack = null;
      if (tp && running()) tp.stop(ctx.currentTime, fade);
      return false;
    }
    if (currentTrack?.id === id && trackPlay && !force) return true;
    if (trackPlay && running()) trackPlay.stop(ctx.currentTime, fade);
    trackPlay = null;
    currentTrack = { id, o: { loop, fade, fallback, gain } };
    if (!ensure()) return false;
    const key = 'track/' + id;
    await engine.sampler.loadManifest();
    if (!engine.sampler.manifest?.files?.[key]) {
      currentTrack = null;
      if (fallback) audio.music(fallback);
      return false;
    }
    await engine.sampler.load([key]);
    if (currentTrack?.id !== id || !running() || !engine.sampler.has(key)) return false;
    engine.composer.stop(); currentSong = null;
    trackPlay = engine.sampler.play(key, { out: engine.mixer.music, loop, gain, attack: fade, release: fade, prio: PRIO_TRACK });
    return !!trackPlay;
  },
  /** La pista grabada que suena (o null). */
  get trackId() { return currentTrack?.id || null; },
  /** Duración (s) de una línea grabada del narrador según el manifest, o null si no hay (o no cargó el manifest). */
  voiceDur(id) { return engine?.sampler.manifest?.files?.['voice/' + id]?.dur ?? null; },
  /** Baja el manifest y las líneas pedidas (para que voiceDur sepa y la voz arranque sin espera). */
  async prepareVoice(ids = []) {
    if (!ensure()) return;
    await engine.sampler.loadManifest();
    await engine.sampler.load(ids.map(i => 'voice/' + i));
  },
  /**
   * Una línea del narrador ('intro/01' → voice/intro/01.m4a) por el bus de voz. La música baja mientras habla.
   * Devuelve { dur, end, stop() } o null si no hay grabación o el audio no arrancó (el subtítulo sigue con su tiempo).
   */
  voice(id, { duck = 0.35 } = {}) {
    if (!running() || !(vol('volVoice', 1) > 0)) return null;
    const key = 'voice/' + id;
    if (!engine.sampler.has(key)) { engine.sampler.load([key]); return null; }
    const v = engine.sampler.play(key, { out: engine.mixer.voice, prio: PRIO_TRACK + 1, attack: 0.01, release: 0.15 });
    if (!v) return null;
    const holdKey = 'voice:' + id;
    engine.mixer.duckHold(holdKey, duck);
    const release = () => engine?.mixer.duckHold(holdKey, null);
    const ms = Math.max(0, (v.end - ctx.currentTime) * 1000 + 250);
    const tm = setTimeout(release, ms);
    return { dur: v.end - ctx.currentTime, end: v.end, stop: () => { clearTimeout(tm); release(); v.stop(ctx.currentTime, 0.2); } };
  },
  /** Para las pruebas: estado del motor. */
  debug() {
    if (!engine) return { ctx: ctx?.state || 'none' };
    return { ctx: ctx.state, levels: engine.mixer.levels(), music: engine.composer.state, scape: engine.soundscape.state,
      track: currentTrack?.id || null, voices: engine.mixer.voiceStats, loaded: engine.sampler.loaded, failed: engine.sampler.failed, reverb: engine.mixer.reverb, scene: engine.scene };
  },
  get engine() { return engine; },
};

// al recargar o cerrar, el contexto se cierra (si queda sonando, la recarga puede trabarse esperando al audio)
const closeAudio = () => {
  clearInterval(timer); timer = null;
  try { ctx?.close(); } catch {}
};
if (typeof window !== 'undefined') { window.addEventListener('beforeunload', closeAudio); window.addEventListener('pagehide', closeAudio); }
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  // con "Silenciar en segundo plano" apagado la música sigue aunque la ventana quede atrás
  if (document.hidden) { if (settings.muteBg !== false) ctx.suspend(); }
  else ctx.resume().catch(() => {});
});
