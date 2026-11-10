// Reproductor de cinemáticas (PLAN-TRAVESIA §3a): lleva una lista de planos 3D y viñetas 2D sobre la línea de tiempo
// (timeline.js), con barras de cine, fundido entre planos, subtítulos de una o varias líneas, título, puntos de avance,
// "Saltar", voz del narrador (audio.voice, con la música baja), stingers y efectos, carteles 3D (labels.js) y temblor.
// Lo usa intro.js ("El Quiebre") y lo van a usar las llegadas a cada isla (3c).
//
//   const cin = createCinema(ctx, container, { r, shots, prefix: 'in', title: 'El Quiebre', applyLight, onShot, onFinish })
//   cin.frame(dt, tt) en el bucle del renderer · cin.next() · cin.finish('skip') · cin.go(i) · cin.seek(s) · cin.dispose()
//
// Un plano: { dur, set (THREE.Group con userData.update(dt, tt, t) y reset) | vignette (pixel2d: createVignette),
//   cam (timeline: keys o travel), camFn(t, cam, u) (ajuste fino: seguir a alguien), light (base), lights (fundidos),
//   subs [{ at, text | lines, voice }], events [{ at, sfx | stinger | voice | shake | label | run }], title, hold,
//   fadeIn (0,6 s), fadeOut (0,5 s; 0 = sin fundido de salida),
//   post (acabado de cámara, voxel.js setPost; dof.focus 'look' = enfoca lo que mira la cámara) }
// opts.post: el acabado de toda la cinemática (cada plano lo pisa con el suyo).
import * as THREE from 'three';
import { createTimeline, camAt, subAt, lightAt } from './timeline.js';
import { createLabels } from './labels.js';
import { t as tr } from '../core/i18n.js';

export function createCinema(ctx, container, opts = {}) {
  const { r, shots, prefix = 'cn', title = '', applyLight = null, onShot = null, onFinish = null, labelsSeen, advanceSfx = null } = opts;
  ensureStyle(prefix);
  const audio = ctx.audio || {};
  const tl = createTimeline(shots, { voiceDur: (id) => audio.voiceDur?.(id) ?? null });
  const reduce = () => document.documentElement.classList.contains('reduce-motion');
  // temblor: { amp, decay } (decay 0 = lo maneja el plano cuadro a cuadro, como la grieta de El Quiebre)
  const shake = opts.shake || { amp: 0, decay: 3 };
  let finished = false, titleOn = false, voice = null, alive = true, vignette = null;

  // ---------- interfaz ----------
  const { h } = ctx.ui;
  const P = (s) => `div.${prefix}-${s}`;
  const el = h(P('root'));
  const fade = h(P('fade'));
  const sub = h(`p.${prefix}-sub`, { 'aria-live': 'polite' });
  const titleEl = h(P('title'), {}, title);
  const skip = h(`button.btn.ghost.small.${prefix}-skip`, { html: tr('cinema.skip') });
  const dots = h(P('dots'), { html: shots.map(() => '<i></i>').join('') });
  const stage2d = h(P('stage2d'));
  const lab2d = h(`div.cn-labels.${prefix}-lab2d`);   // carteles sobre la viñeta 2D (encima del canvas)
  el.append(stage2d, lab2d, h(`${P('bar')}.top`), h(`${P('bar')}.bot`), fade, sub, titleEl, dots, skip);
  container.append(el);
  skip.addEventListener('click', (e) => { e.stopPropagation(); try { audio.sfx?.('close'); } catch {} finish('skip'); });
  el.addEventListener('click', () => next());
  const labels = r ? createLabels(container, r, labelsSeen ? { seen: labelsSeen } : {}) : null;

  // las voces: se baja el manifest y, cuando llega, los subtítulos se estiran a la duración real
  const voiceIds = shots.flatMap(s => (s.subs || []).filter(x => x.voice).map(x => x.voice));
  if (voiceIds.length && audio.prepareVoice) audio.prepareVoice(voiceIds).then(() => { if (alive) tl.refit(); }).catch(() => {});

  // ---------- planos ----------
  function setSub(text) {
    if (sub.dataset.text === text) return;
    sub.dataset.text = text;
    sub.textContent = '';
    text.split('\n').forEach((line, i) => { if (i) sub.append(document.createElement('br')); sub.append(line); });
  }
  function enter(i) {
    const S = tl.S;
    voice?.stop?.(); voice = null;
    // un mismo decorado puede servir a dos planos seguidos (otra cámara): queda visible el del plano actual
    for (const s of shots) if (s.set) s.set.visible = false;
    if (S.set) S.set.visible = true;
    S.set?.userData.reset?.();
    if (applyLight && S.light) applyLight(S.light, S.shadow ?? 24);
    // acabado de cámara del plano (voxel.js setPost): el de la cinemática y encima el del plano
    if (r?.setPost) { r.setPost(null); r.setPost({ ...(opts.post || {}), ...(S.post || {}) }); }
    shake.amp = 0;
    const first = S.subs[0];
    setSub(first ? (first.lines ? first.lines.join('\n') : first.text) : '');
    sub.classList.remove('on');
    dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k <= i));
    titleEl.classList.remove('on'); titleOn = false;
    labels?.clear();
    // viñeta 2D: un canvas sobre el 3D
    vignette?.dispose?.(); vignette = null; stage2d.textContent = '';
    if (S.vignette) {
      vignette = S.vignette();
      stage2d.append(vignette.canvas);
      el.classList.add('is-2d');
    } else el.classList.remove('is-2d');
    onShot?.(i, S);
  }
  function go(i) { tl.go(i); enter(tl.index); }
  function next() {
    if (finished) return;
    if (tl.next()) { try { audio.sfx?.('select'); } catch {} enter(tl.index); }
    else finish('done');
  }
  async function finish(how) {
    if (finished) return;
    finished = true;
    voice?.stop?.(); voice = null;
    el.classList.add('out');
    await onFinish?.(how);
  }

  function fire(e, S) {
    try {
      if (e.sfx) audio.sfx?.(e.sfx, e.arg);
      if (e.stinger) audio.stinger?.(e.stinger);
      if (e.voice) { voice?.stop?.(); voice = audio.voice?.(e.voice) || null; }
      if (e.shake) { shake.amp = e.shake; shake.decay = e.decay ?? 3; }
      if (e.label && labels) {
        const L = e.label, name = typeof L.name === 'function' ? L.name() : L.name, line = typeof L.line === 'function' ? L.line() : L.line;
        // en una viñeta, px: [x, y] (o una función que lo da) en píxeles del mundo 2D
        if (L.px && vignette) labels.introduce(L.id, null, name, line, { ...L, host: lab2d, screen: () => vigToScreen(typeof L.px === 'function' ? L.px(vignette) : L.px) });
        else labels.introduce(L.id, L.pos, name, line, L.followFn ? { ...L, follow: L.followFn() } : L);
      }
      if (e.run) e.run(S, { labels, shake, vignette });
    } catch (err) { console.warn('[cine]', err); }
  }

  /** Punto del mundo de la viñeta → píxeles del contenedor (el canvas se estira con object-fit: contain). */
  function vigToScreen(p) {
    if (!vignette || !p) return null;
    const cv = vignette.canvas, R = cv.getBoundingClientRect(), C = el.getBoundingClientRect();
    const k = Math.min(R.width / cv.width, R.height / cv.height) || 1;
    const z = Math.max(1, Math.round(vignette.cam.zoom));
    const x = (p[0] - vignette.cam.x) * z + cv.width / 2, y = (p[1] - vignette.cam.y) * z + cv.height / 2;
    return { x: R.left - C.left + (R.width - cv.width * k) / 2 + x * k, y: R.top - C.top + (R.height - cv.height * k) / 2 + y * k };
  }

  // ---------- bucle ----------
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function frame(dt, tt) {
    if (finished) return;
    dt = Math.min(dt, 0.05);
    const before = tl.index;
    const res = tl.update(dt);
    if (res.changed) { if (advanceSfx) try { audio.sfx?.(advanceSfx); } catch {} enter(tl.index); }
    if (res.done) { finish('done'); return; }
    const S = tl.S, t = tl.t;
    for (const e of before === tl.index ? res.fired : []) fire(e, S);
    S.set?.userData.update?.(dt, tt, t);
    if (S.lights?.length && applyLight) applyLight(lightAt(S.light, S.lights, t), S.shadow ?? 24, true);
    // cámara
    if (r && S.cam) {
      const c = camAt(S.cam, t);
      camPos.set(...c.pos); camLook.set(...c.look);
      const u = Math.min(1, t / S.dur);
      S.camFn?.(t, { pos: camPos, look: camLook }, u);
      if (shake.amp > 0) {
        if (!reduce()) { camPos.x += (Math.random() - 0.5) * shake.amp * 2; camPos.y += (Math.random() - 0.5) * shake.amp * 2; }
        shake.amp = Math.max(0, shake.amp - shake.amp * (shake.decay || 0) * dt);
        if (shake.amp < 0.002) shake.amp = 0;
      }
      // los encuadres están pensados para 16:9: en una ventana más angosta la cámara se aleja un poco
      const wide = 16 / 9, asp = r.camera.aspect || wide;
      if (asp < wide) camPos.sub(camLook).multiplyScalar(Math.min(1.5, wide / asp)).add(camLook);
      r.camera.position.copy(camPos);
      r.camera.lookAt(camLook);
      if (c.fov && r.camera.fov !== c.fov) { r.camera.fov = c.fov; r.camera.updateProjectionMatrix(); }
      // foco que sigue a la cámara: 'look' = el punto que mira; focusFn(t) = distancia a mano
      const d = S.post?.dof;
      if (d && r.setPost && (d.focus === 'look' || d.focusFn)) {
        r.setPost({ dof: { amt: d.amt ?? 1, range: d.range ?? 3, focus: d.focusFn ? d.focusFn(t, camPos) : camPos.distanceTo(camLook) } });
      }
    }
    if (vignette) { vignette.update(dt, t); vignette.draw(); }
    // fundido a negro entre planos
    const fi = S.fadeIn ?? 0.6, fo = S.title ? 0 : S.fadeOut ?? 0.5;
    const fadeIn = fi > 0 ? Math.max(0, 1 - t / fi) : 0, fadeOut = fo > 0 ? Math.max(0, (t - (S.dur - fo)) / fo) : 0;
    fade.style.opacity = String(Math.min(1, Math.max(fadeIn, fadeOut)));
    // subtítulo
    const cur = subAt(S, t);
    if (cur) setSub(cur.text);
    sub.classList.toggle('on', !!cur);
    if (S.title && !titleOn && t > S.dur - 3.6) { titleOn = true; titleEl.classList.add('on'); }
    labels?.update(dt);
  }

  enter(0);
  return {
    el, sub, labels, timeline: tl,
    frame, next, finish, go,
    get shot() { return tl.index; },
    get t() { return tl.t; },
    get count() { return shots.length; },
    get finished() { return finished; },
    get vignette() { return vignette; },
    /** Para las pruebas y la galería: rearma el plano y avanza s segundos en pasos de 1/30. */
    seek(s) { const k = tl.index; go(k); let n = 0; while (tl.t < s && n++ < 4000 && tl.index === k) frame(1 / 30, tl.t); },
    resize() { labels?.resize(); },
    dispose() {
      alive = false; finished = true;
      voice?.stop?.(); voice = null;
      vignette?.dispose?.(); vignette = null;
      labels?.dispose();
      el.remove();
    },
  };
}

// ---------- estilos (por prefijo: intro.js usa 'in', así sus clases de siempre siguen) ----------
const styled = new Set();
function ensureStyle(p) {
  if (styled.has(p) || typeof document === 'undefined') return;
  styled.add(p);
  const el = document.createElement('style');
  el.id = `cinema-style-${p}`;
  el.textContent = `
.${p}-root { position: absolute; inset: 0; z-index: 5; pointer-events: auto; cursor: pointer; user-select: none; transition: opacity .38s; }
.${p}-root.out { opacity: 0; }
.${p}-stage2d { position: absolute; left: 0; right: 0; top: 9vh; bottom: calc(9vh + 2.6em + 30px); font-size: clamp(20px, 2.3vw, 28px); z-index: 0; display: none; background: #050506; }
.${p}-root.is-2d { background: #050506; }
.${p}-root.is-2d .${p}-stage2d { display: flex; align-items: center; justify-content: center; }
.${p}-lab2d { z-index: 1; }
.${p}-stage2d canvas { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; image-rendering: crisp-edges; }
.${p}-bar { position: absolute; left: 0; right: 0; height: 9vh; background: #050506; z-index: 2; }
.${p}-bar.top { top: 0; } .${p}-bar.bot { bottom: 0; }
.${p}-fade { position: absolute; inset: 0; background: #050506; opacity: 1; z-index: 1; pointer-events: none; }
.${p}-sub { position: absolute; z-index: 3; left: 50%; bottom: calc(9vh + 22px); transform: translate(-50%, 6px); margin: 0;
  width: min(900px, calc(100% - 48px)); text-align: center; color: #efe6d8; font-size: clamp(20px, 2.3vw, 28px); line-height: 1.3;
  text-shadow: 0 2px 0 #000, 0 0 18px rgba(0,0,0,.85); opacity: 0; transition: opacity .6s, transform .6s; }
.${p}-sub.on { opacity: 1; transform: translate(-50%, 0); }
.${p}-title { position: absolute; z-index: 3; left: 0; right: 0; top: calc(9vh + 7%); text-align: center; color: #e8c676;
  font-size: clamp(42px, 6.5vw, 86px); font-weight: 800; letter-spacing: .28em; text-transform: uppercase;
  text-shadow: 0 4px 0 #000, 0 0 30px rgba(0,0,0,.8); opacity: 0; transform: scale(.96); transition: opacity 1.4s, transform 3s ease-out; }
.${p}-title.on { opacity: 1; transform: none; }
.${p}-skip { position: absolute; z-index: 4; top: calc(9vh + 12px); right: 18px; }
.${p}-dots { position: absolute; z-index: 3; top: calc(9vh + 22px); left: 22px; display: flex; gap: 5px; }
.${p}-dots i { width: 18px; height: 3px; background: rgba(239,230,216,.22); }
.${p}-dots i.on { background: #e8c676; }
html.reduce-motion .${p}-sub, html.reduce-motion .${p}-title { transition: opacity .2s; transform: translate(-50%, 0); }
html.reduce-motion .${p}-title { transform: none; }
`;
  document.head.append(el);
}
