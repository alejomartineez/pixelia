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
//
// Cámara de cine (PLAN-FOTO §R2, la matemática está en camera.js). Todo son datos del plano; un sujeto es [x, y, z],
// una función que devuelve eso o un objeto 3D, o { of, off: [x, y, z] }:
//   lens: 'wide' | 'normal' | 'portrait' | 'tele' | 'macro' | { preset, focal, f, match }   focal y apertura: dan el
//         campo de visión y la profundidad de campo; con match la cámara se corre para conservar el encuadre
//   focus: [{ t, on: sujeto | 'look', ease? }]   cambio de foco: entre dos claves el foco viaja de un sujeto al otro
//   handheld: 0 a 1 (cámara en mano) · breath: 0 a 1 (respiración; sola en los planos quietos, 0 la apaga)
//   frame: { subject, third: 'left' | 'right' | 'center' | 'auto', line: 'top' | 'mid' | 'bottom', gaze, w }
//         encuadre por tercios: la cámara gira para dejar al sujeto en ese tercio, con aire hacia donde mira
//   rig: { subject, at, key: { az, el, i, color }, fill: { az, el, ratio, color }, rim: { … } }   luz de tres puntos
//         con el sol del plano de principal (opts.lights = { sun }) y dos luces sin sombra de relleno y contra
//   cam: { segs: [{ from, keys, lens, focus, frame, rig, … }] }   cortes dentro del plano (plano y contraplano con
//         shotReverse de camera.js); cada tramo pisa lo del plano
// opts.camIn / opts.camOut: { pos, look, fov, dur } o true (la cámara que tenía el renderer al crear la cinemática):
//   fundido de cámara del juego al primer plano y del último plano de vuelta al juego (sin fundido a negro ahí).
// opts.guides: modo de revisión, con la guía de tercios, la marca del sujeto y los datos del lente encima.
import * as THREE from 'three';
import { createTimeline, camAt, camSeg, subAt, lightAt, EASE } from './timeline.js';
import { resolveLens, matchDolly, dofOf, focusAt, handheldAt, breathAt, camTravel, basis, frameThirds, blendCam, threePoint, SENSOR_H } from './camera.js';
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
  // modo de revisión: tercios entre las barras, marca del sujeto y datos del lente (en la barra de abajo)
  const guides = opts.guides ? h(P('guides'), { html: '<i class="v1"></i><i class="v2"></i><i class="h1"></i><i class="h2"></i><b></b><span></span>' }) : null;
  if (guides) el.append(guides);
  container.append(el);

  // ---------- cámara de cine ----------
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const baseFov = r?.camera?.fov ?? 42;
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  /** Sujeto → [x, y, z] (o null): arreglo, función, objeto 3D o { of, off }. */
  function tgt(x) {
    const off = x && !Array.isArray(x) && typeof x === 'object' && 'of' in x ? x.off || [0, 0, 0] : null;
    let v = off ? x.of : x;
    if (typeof v === 'function') v = v();
    if (!v) return null;
    if (v.isObject3D) v = v.getWorldPosition(_v).toArray(); else if (v.isVector3) v = v.toArray();
    return off ? [v[0] + off[0], v[1] + off[1], v[2] + off[2]] : v;
  }
  const distTo = (p) => (p ? camPos.distanceTo(_w.set(p[0], p[1], p[2])) : camPos.distanceTo(camLook));
  // la cámara del juego para el fundido de entrada y de salida
  const snap = (o) => {
    if (!o || !r) return null;
    if (o.pos) return { dur: 1.4, fov: baseFov, ...o };
    const p = r.camera.position, d = r.camera.getWorldDirection(_v);
    return { dur: o.dur ?? 1.4, pos: p.toArray(), look: [p.x + d.x * 10, p.y + d.y * 10, p.z + d.z * 10], fov: r.camera.fov };
  };
  const camIn = snap(opts.camIn), camOut = snap(opts.camOut);
  if (camIn) el.classList.add('blend-in');
  // relleno y contra de la luz de tres puntos: siempre en la escena (apagadas), así no se recompilan los materiales
  const rigL = r && opts.lights?.sun ? Object.fromEntries(['fill', 'rim'].map(k => { const l = new THREE.DirectionalLight(0xffffff, 0); r.scene.add(l, l.target); return [k, l]; })) : null;
  let rigSeg = null, focusNow = 0;
  const quietOf = new WeakMap();
  const quiet = (seg) => { if (!quietOf.has(seg)) quietOf.set(seg, camTravel(seg) < 0.8); return quietOf.get(seg); };
  /** Cámara del plano en t, en camPos y camLook: pista, ajuste fino y lente. La usan el cuadro y la luz. */
  function pose(S, t) {
    const c = camAt(S.cam, t), seg = camSeg(S.cam, t);
    const spec = seg !== S.cam ? { ...S, ...seg } : S;
    camPos.set(...c.pos); camLook.set(...c.look);
    S.camFn?.(t, { pos: camPos, look: camLook }, Math.min(1, t / S.dur));
    const lens = resolveLens(spec.lens), fov = c.fov ?? lens?.fov ?? baseFov;
    if (lens?.match && !c.fov) camPos.sub(camLook).multiplyScalar(matchDolly(fov, typeof lens.match === 'number' ? lens.match : baseFov)).add(camLook);
    return { spec, seg, lens, fov };
  }
  function applyRig(S, t) {
    if (!rigL) return;
    const seg = camSeg(S.cam, t), rig = seg?.rig ?? S.rig, sun = opts.lights.sun;
    if (applyLight && S.light) applyLight(S.light, S.shadow ?? 24);
    rigL.fill.intensity = rigL.rim.intensity = 0;
    if (!rig) return;
    pose(S, rig.at ?? (seg === S.cam ? S.dur / 2 : t));
    const subject = tgt(rig.subject) || camLook.toArray();
    const k = threePoint({ pos: camPos.toArray(), subject, key: rig.key, fill: rig.fill, rim: rig.rim, keyI: sun.intensity, keyColor: sun.color.getHex() });
    sun.position.set(...k.key.pos); sun.target.position.set(...subject); sun.intensity = k.key.i; sun.color.setHex(k.key.color);
    for (const n of ['fill', 'rim']) { const l = rigL[n]; l.position.set(...k[n].pos); l.target.position.set(...subject); l.intensity = k[n].i; l.color.setHex(k[n].color); }
  }
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
    shake.amp = 0; rigSeg = null;
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
      // luz de tres puntos: al entrar al plano y en cada corte de cámara
      const seg0 = camSeg(S.cam, t);
      if (seg0 !== rigSeg) { rigSeg = seg0; applyRig(S, t); }
      const P = pose(S, t), { spec, lens, seg } = P;
      let fov = P.fov;
      // los encuadres están pensados para 16:9: en una ventana más angosta la cámara se aleja un poco
      const wide = 16 / 9, asp = r.camera.aspect || wide;
      if (asp < wide) camPos.sub(camLook).multiplyScalar(Math.min(1.5, wide / asp)).add(camLook);
      // encuadre por tercios: la cámara gira hasta dejar al sujeto en su tercio
      const F = spec.frame, subject = F ? tgt(F.subject) : null;
      if (subject) {
        const fr = frameThirds({ pos: camPos.toArray(), subject, fov, aspect: asp, third: F.third, line: F.line, gaze: typeof F.gaze === 'function' ? F.gaze() : F.gaze });
        camLook.lerp(_w.set(...fr.look), F.w ?? 1);
      }
      // fundido de cámara: del juego al primer plano y del último plano al juego
      let live = 1;
      const end = S.dur + (S.hold || 0);
      const g = camIn && tl.index === 0 && t < camIn.dur ? [camIn, EASE.smooth(t / camIn.dur)]
        : camOut && tl.index === shots.length - 1 && t > end - camOut.dur ? [camOut, EASE.smooth(Math.max(0, end - t) / camOut.dur)] : null;
      if (g) {
        const bl = blendCam(g[0], { pos: camPos.toArray(), look: camLook.toArray(), fov }, g[1]);
        camPos.set(...bl.pos); camLook.set(...bl.look); fov = bl.fov; live = g[1];
      }
      // cámara en mano o respiración (ruido coherente: depende del segundo del plano, no del cuadro)
      let roll = 0;
      const hh = spec.handheld ?? 0, br = spec.breath ?? (!hh && !F && quiet(seg) ? 1 : 0);
      if ((hh || br) && live > 0 && !reduce()) {
        const o = hh ? handheldAt(t, hh * live, tl.index) : breathAt(t, br * live, tl.index);
        const B = basis(camPos.toArray(), camLook.toArray()), dl = camPos.distanceTo(camLook);
        const lx = o.dx + o.yaw * dl, ly = o.dy + o.pitch * dl;
        camPos.x += B.r[0] * o.dx + B.u[0] * o.dy; camPos.y += B.r[1] * o.dx + B.u[1] * o.dy; camPos.z += B.r[2] * o.dx + B.u[2] * o.dy;
        camLook.x += B.r[0] * lx + B.u[0] * ly; camLook.y += B.r[1] * lx + B.u[1] * ly; camLook.z += B.r[2] * lx + B.u[2] * ly;
        roll = o.roll;
      }
      if (shake.amp > 0) {
        if (!reduce()) { camPos.x += (Math.random() - 0.5) * shake.amp * 2; camPos.y += (Math.random() - 0.5) * shake.amp * 2; }
        shake.amp = Math.max(0, shake.amp - shake.amp * (shake.decay || 0) * dt);
        if (shake.amp < 0.002) shake.amp = 0;
      }
      r.camera.position.copy(camPos);
      r.camera.lookAt(camLook);
      if (roll) r.camera.rotateZ(roll);
      if (Math.abs(r.camera.fov - fov) > 1e-4) { r.camera.fov = fov; r.camera.updateProjectionMatrix(); }
      // foco: claves de cambio de foco > focusFn > el sujeto del encuadre > lo que mira la cámara. La profundidad de
      // campo sale del lente (focal y apertura) salvo que el plano la escriba a mano en post.dof.
      const d = S.post?.dof, fk = spec.focus;
      if (r.setPost && (fk || lens || (d && (d.focus === 'look' || d.focusFn)))) {
        focusNow = fk ? focusAt(fk, t, (on) => distTo(on === 'look' ? null : tgt(on))) : d?.focusFn ? d.focusFn(t, camPos) : distTo(subject);
        const auto = lens ? dofOf(lens, focusNow) : { range: 3, amt: 1 };
        r.setPost({ dof: { amt: d?.amt ?? auto.amt, range: d?.range ?? auto.range, focus: focusNow } });
      } else focusNow = 0;
      if (guides) {
        let mark = subject;
        if (!mark && fk) { let k = fk[0]; for (const x of fk) if (t >= x.t) k = x; mark = k.on === 'look' ? null : tgt(k.on); }
        const dot = guides.querySelector('b');
        dot.style.display = mark ? 'block' : 'none';
        if (mark) {
          r.camera.updateMatrixWorld();
          _w.set(...mark).project(r.camera);
          dot.style.left = ((_w.x + 1) / 2 * el.clientWidth) + 'px';
          dot.style.top = ((1 - _w.y) / 2 * el.clientHeight - guides.offsetTop) + 'px';
        }
        const focal = lens?.focal ?? SENSOR_H / 2 / Math.tan(fov * Math.PI / 360);
        guides.querySelector('span').textContent = `#${tl.index + 1} · ${t.toFixed(1)} s · ${focal.toFixed(0)} mm · ${fov.toFixed(0)}°${lens ? ' · f/' + lens.f : ''}${focusNow ? ' · ⌖ ' + focusNow.toFixed(1) : ''}${hh ? ' · ≈ ' + hh : br ? ' · ~' : ''}`;
      }
    }
    if (vignette) { vignette.update(dt, t); vignette.draw(); }
    // fundido a negro entre planos
    const fi = S.fadeIn ?? 0.6, fo = S.title ? 0 : S.fadeOut ?? 0.5;
    let fadeIn = fi > 0 ? Math.max(0, 1 - t / fi) : 0, fadeOut = fo > 0 ? Math.max(0, (t - (S.dur - fo)) / fo) : 0;
    if (camIn && tl.index === 0) fadeIn = 0;
    if (camOut && tl.index === shots.length - 1) fadeOut = 0;
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
      if (rigL) for (const l of Object.values(rigL)) { l.target.removeFromParent(); l.removeFromParent(); l.dispose?.(); }
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
.${p}-root.blend-in .${p}-bar { animation: ${p}-barin 1.2s ease-out both; }
@keyframes ${p}-barin { from { height: 0; } }
.${p}-guides { position: absolute; left: 0; right: 0; top: 9vh; bottom: 9vh; z-index: 3; pointer-events: none; }
.${p}-guides i { position: absolute; background: rgba(140, 225, 255, .6); }
.${p}-guides .v1, .${p}-guides .v2 { top: 0; bottom: 0; width: 1px; } .${p}-guides .v1 { left: 33.333%; } .${p}-guides .v2 { left: 66.667%; }
.${p}-guides .h1, .${p}-guides .h2 { left: 0; right: 0; height: 1px; } .${p}-guides .h1 { top: 33.333%; } .${p}-guides .h2 { top: 66.667%; }
.${p}-guides b { position: absolute; width: 16px; height: 16px; margin: -10px 0 0 -10px; border: 2px solid #ffd34d; border-radius: 50%; display: none; }
.${p}-guides span { position: absolute; left: 22px; top: 100%; margin-top: 3vh; font: 13px/1 ui-monospace, Consolas, monospace; color: #9fd8ff; white-space: nowrap; }
html.reduce-motion .${p}-sub, html.reduce-motion .${p}-title { transition: opacity .2s; transform: translate(-50%, 0); }
html.reduce-motion .${p}-title { transform: none; }
`;
  document.head.append(el);
}
