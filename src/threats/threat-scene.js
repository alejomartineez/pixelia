// Capa de amenazas sobre la escena de la ciudad (DESIGN-CORE.md §3.4): no es otra escena, se monta encima.
//  - attach(cityApi, threatId) → { detach, onTap, update }: la defensa por turnos (cuadrillas, reservas, avance, golpes)
//  - createDecor(cityApi) → { sync, update, dispose }: cartel de la amenaza, señales previas (cielo, lluvia, humo,
//    escarcha) y la marca de los edificios dañados
//  - createCoverage(cityApi) → { update(defId, x, z, rot, level), dispose }: radio de una defensa al colocarla
// cityApi = { ctx, r, ov, entries, fx, cam, container, sideEl, world, HALF, topPos(e, extra), openInfo(uid) }
import * as THREE from 'three';
import { icon } from '../core/icons.js';
import { BUILDING_BY_ID, DEFENSES } from '../core/data.js';
import * as T from './threats.js';
import { THREAT_TYPES } from './threat-data.js';
import { tileXZ, tileIndex } from './threat-rules.js';
import { ensureStyle, openThreatPanel, openResult } from './threat-ui.js';

const COLORS = {
  crecida: ['#9fd3ea', '#5aa9d6', '#3d86b8'], sequia: ['#ecd9a0', '#d9b46a', '#b8904a'], incendio: ['#ffc07a', '#ff8a3d', '#e0542a'],
  tormenta: ['#ffd77a', '#ffb347', '#ff7a3d'], helada: ['#f2fbff', '#d8f0ff', '#b6dcf2'],
};
const LOOK_ICON = { crecida: '💧', sequia: '🍂', incendio: '💨', tormenta: '⛺', helada: '❄️' };
const TINT = {
  crecida: 'linear-gradient(rgba(90,110,140,0.22), rgba(90,110,140,0.04))', tormenta: 'linear-gradient(rgba(50,58,80,0.32), rgba(50,58,80,0.08))',
  incendio: 'linear-gradient(rgba(190,120,80,0.20), rgba(190,120,80,0.03))', sequia: 'linear-gradient(rgba(230,190,110,0.22), rgba(230,190,110,0.04))',
  helada: 'linear-gradient(rgba(200,225,245,0.30), rgba(200,225,245,0.06))',
};
const hex = (c) => new THREE.Color(c);

// =====================================================================
// Radio de cobertura al colocar una defensa
// =====================================================================
export function createCoverage(api) {
  const { r, ov, entries, HALF } = api;
  const geo = new THREE.PlaneGeometry(0.92, 0.92);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, depthTest: false });
  const MAX = 900;
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.count = 0;
  r.scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const badges = new Map();
  let sig = '';
  return {
    update(defId, x, z, rot = 0, level = 1) {
      const s = [defId, x, z, rot, level].join('|');
      if (s === sig) return;
      sig = s;
      const dd = DEFENSES[defId];
      if (!dd) { mesh.count = 0; return; }
      mat.color.set(dd.threat === '*' ? '#8fe0b0' : COLORS[dd.threat][1]);
      const tiles = T.coverageTiles(defId, x, z, rot, level);
      let n = 0;
      for (const [tx, tz] of tiles) { if (n >= MAX) break; p.set(tx + 0.5 - HALF, 0.05, tz + 0.5 - HALF); m4.compose(p, q, s1); mesh.setMatrixAt(n++, m4); }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
      // escudos sobre los edificios en riesgo que cubriría
      const cov = new Set(T.wouldCover(defId, x, z, rot, level));
      for (const [uid, it] of badges) if (!cov.has(uid)) { ov.remove(it); badges.delete(uid); }
      for (const uid of cov) {
        const e = entries.get(uid);
        if (!e || badges.has(uid)) continue;
        badges.set(uid, ov.add(Object.assign(document.createElement('div'), { className: 'th-badge cov', innerHTML: `${icon('🛡️', 14)}cubierto` }), api.topPos(e, 0.25).clone()));
      }
    },
    dispose() { r.scene.remove(mesh); geo.dispose(); mat.dispose(); mesh.dispose?.(); for (const it of badges.values()) ov.remove(it); badges.clear(); },
  };
}

// =====================================================================
// Cartel, señales previas y daño
// =====================================================================
export function createDecor(api) {
  ensureStyle();
  const { ctx, ov, entries, fx, container, sideEl, HALF } = api;
  // el cartel de la amenaza vive en el HUD (capa Hoy, hud.js con chipText); tocarlo emite 'threat:panel'
  const tint = Object.assign(document.createElement('div'), { className: 'th-tint' });
  const flash = Object.assign(document.createElement('div'), { className: 'th-flash' });
  container.prepend(tint); container.append(flash);
  const marks = new Map();
  let st = null, acc = 0, flashT = 0, nextFlash = 3, lastSt = -1e9;
  const offs = [
    ctx.bus.on('threat:announced', ({ id, type } = {}) => {
      lastSt = -1e9;
      const name = id === 'sim' ? 'un simulacro de crecida' : (THREAT_TYPES[type]?.name || 'una amenaza').toLowerCase();
      setTimeout(() => { const s = T.threatStatus(); ctx.ui.toast(`Se viene ${name}: ${s?.when || 'pronto'}. Tocá el aviso de arriba para prepararte.`, { icon: THREAT_TYPES[type]?.icon || 'info' }); }, 600);
    }),
    ...['threat:resolved', 'threat:started', 'building:damaged', 'building:repaired', 'craft:done', 'building:built'].map(ev => ctx.bus.on(ev, () => { lastSt = -1e9; })),
  ];
  function sync() {
    const now = performance.now();
    // el estado de la amenaza (preparación de toda la ciudad) se recalcula cada 1,5 s o cuando algo cambia
    if (now - lastSt > 1500) { lastSt = now; try { st = T.threatStatus(); } catch (e) { console.warn('[threats] estado', e); st = null; } }
    const signs = st && (st.phase === 'señales' || st.phase === 'hoy');
    tint.style.background = signs ? TINT[st.type] : 'transparent';
    api.world?.setStream?.(signs && st.type === 'crecida' ? 1 : st?.type === 'sequia' && signs ? -1 : 0);
    // marcas de daño
    for (const e of entries.values()) {
      const b = e.b;
      const has = marks.get(b.uid);
      if (b.damaged && e.root.visible) {
        if (!has) marks.set(b.uid, ov.add(Object.assign(document.createElement('div'), { className: 'th-dmg', innerHTML: icon(LOOK_ICON[b.damagedBy] || '🔧', 26) }), api.topPos(e, 0.1).clone()));
        else has.pos.copy(api.topPos(e, 0.1));
      } else if (has) { ov.remove(has); marks.delete(b.uid); }
    }
  }
  function update(dt) {
    if (!st || api.hidden === 'all') return;
    const signs = st.phase === 'señales' || st.phase === 'hoy';
    // humo suave de lo dañado
    acc += dt;
    if (acc > 0.5) {
      acc = 0;
      for (const uid of marks.keys()) {
        const e = entries.get(uid);
        if (e && Math.random() < 0.35) fx.burst(e.root.position.x, e.height * 0.7, e.root.position.z, { n: 3, colors: ['#d8d2c8', '#bdb6aa', '#ffffff'], speed: 0.25, up: 0.7, gravity: -0.4, size: 0.1, life: 1.4, spread: 0.4, drag: 2 });
      }
      if (signs && !ctx.ui.reducedMotion()) signParticles(st.type);
    }
    if (signs && st.type === 'tormenta' && !ctx.ui.reducedMotion()) {
      nextFlash -= dt;
      if (nextFlash <= 0) { nextFlash = 4 + Math.random() * 6; flashT = 0.35; }
      if (flashT > 0) { flashT -= dt; flash.style.opacity = String(Math.max(0, flashT) * 1.2); }
    }
  }
  function signParticles(type) {
    const L = ctx.economy.landBounds();
    const rx = () => L.min + Math.random() * (L.max - L.min) - HALF;
    if (type === 'crecida' || type === 'tormenta') for (let i = 0; i < 4; i++) fx.burst(rx(), 7, rx(), { n: 1, colors: ['#9fc3dd', '#c7deef'], speed: 0.1, up: -5, gravity: 6, size: 0.06, life: 1.1, spread: 0.2, drag: 0 });
    else if (type === 'helada') for (let i = 0; i < 3; i++) fx.burst(rx(), 6, rx(), { n: 1, colors: ['#ffffff', '#e8f4ff'], speed: 0.3, up: -0.6, gravity: 0.6, size: 0.07, life: 4, spread: 0.3, drag: 0.5 });
    else if (type === 'incendio') fx.burst(rx(), 0.3, L.min - HALF - 1.5, { n: 4, colors: ['#9a928a', '#bdb6aa', '#d8d2c8'], speed: 0.3, up: 1.6, gravity: -0.5, size: 0.18, life: 2.6, spread: 1.4, drag: 1 });
    else if (type === 'sequia') fx.burst(rx(), 0.2, rx(), { n: 3, colors: ['#e3cf98', '#d9b46a'], speed: 0.8, up: 0.4, gravity: 0.3, size: 0.06, life: 1.2, spread: 0.6, drag: 1.5 });
  }
  return {
    sync, update,
    dispose() { offs.forEach(f => f()); tint.remove(); flash.remove(); for (const it of marks.values()) ov.remove(it); marks.clear(); },
  };
}

/** Abre el panel de la amenaza con los ganchos de la ciudad. */
export function openPanel(api) {
  const { ctx } = api;
  return openThreatPanel(ctx, {
    onFace: (id) => api.startDefense?.(id),
    onHighlight: (uid) => api.highlight?.(uid),
    onBuild: (defId) => setTimeout(() => ctx.bus.emit('hud:build', { focus: defId }), 240),
    onWorkshop: () => setTimeout(() => ctx.openPanel('workshop'), 240),
  });
}

// =====================================================================
// Defensa por turnos
// =====================================================================
export function attach(api, threatId) {
  ensureStyle();
  const { ctx, r, ov, entries, fx, cam, container, HALF } = api;
  const { ui, audio } = ctx;
  const started = T.startDefense(threatId);
  if (!started || started.error) { ui.toast(started?.error || 'No se pudo empezar', { icon: 'info' }); return null; }
  let d = started;
  const type = d.type, cols = COLORS[type].map(hex);
  const N = d.W * d.W;
  audio.music('threat');
  // ----- mallas -----
  const group = new THREE.Group();
  group.name = 'threat';
  r.scene.add(group);
  const boxGeo = new THREE.BoxGeometry(0.86, 1, 0.86);
  const lvMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: type === 'helada' ? 0.85 : 0.78 });
  const lvMesh = new THREE.InstancedMesh(boxGeo, lvMat, N);
  lvMesh.frustumCulled = false; lvMesh.count = 0;
  const bagMat = new THREE.MeshLambertMaterial({ color: type === 'crecida' ? 0xb59a6a : type === 'incendio' ? 0x8a7a6a : 0x9a8a72 });
  const bagMesh = new THREE.InstancedMesh(boxGeo, bagMat, 64);
  bagMesh.frustumCulled = false; bagMesh.count = 0;
  const crewGeo = new THREE.BoxGeometry(0.22, 0.42, 0.22);
  const crewMat = new THREE.MeshLambertMaterial({ color: 0x3d6fb8 });
  const crewMesh = new THREE.InstancedMesh(crewGeo, crewMat, 6 * 3);
  crewMesh.frustumCulled = false; crewMesh.count = 0;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6fe3c1, transparent: true, opacity: 0.55, depthWrite: false });
  const ringMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.96, 0.96), ringMat, 6);
  ringMesh.frustumCulled = false; ringMesh.count = 0; ringMesh.renderOrder = 4;
  group.add(lvMesh, bagMesh, crewMesh, ringMesh);
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), qf = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const pv = new THREE.Vector3(), sv = new THREE.Vector3();
  const wx = (x) => x + 0.5 - HALF;
  // ----- carteles sobre lo que está en riesgo -----
  const badges = new Map();
  const rayIcons = [];
  function syncBadges() {
    for (const t of d.targets) {
      const e = entries.get(t.uid);
      if (!e) continue;
      let it = badges.get(t.uid);
      if (!it) { it = ov.add(Object.assign(document.createElement('div'), { className: 'th-badge' }), api.topPos(e, 0.25).clone()); badges.set(t.uid, it); }
      const dead = d.damaged.includes(t.uid), hits = d.hits[t.uid] || 0;
      const html = dead ? `${icon('🔧', 14)}dañado` : `${t.eff > 0 ? icon('🛡️', 14) + Math.round(t.eff * 100) + '% · ' : ''}${'●'.repeat(hits)}${'○'.repeat(Math.max(0, 2 - hits))}`;
      if (it.el.innerHTML !== html) it.el.innerHTML = html;
      it.el.className = 'th-badge' + (dead ? ' dead' : hits ? ' hit' : t.eff > 0 ? ' cov' : '');
    }
    for (const it of rayIcons) ov.remove(it);
    rayIcons.length = 0;
    if (type === 'tormenta') for (const i of d.nextRays || []) {
      const [x, z] = tileXZ(d, i);
      rayIcons.push(ov.add(Object.assign(document.createElement('div'), { className: 'th-ray', innerHTML: icon('⚡', 26) }), new THREE.Vector3(wx(x), 1.6, wx(z))));
    }
  }
  let anim = 0;
  function syncMeshes() {
    let n = 0;
    for (let i = 0; i < N; i++) {
      const lv = d.levels[i];
      if (!lv) continue;
      const [x, z] = tileXZ(d, i);
      const h = type === 'crecida' || type === 'sequia' || type === 'helada' ? 0.08 + lv * 0.11 : 0.12 + lv * 0.18;
      pv.set(wx(x), h / 2 + 0.02, wx(z)); sv.set(1, h, 1);
      m4.compose(pv, q0, sv); lvMesh.setMatrixAt(n, m4); lvMesh.setColorAt(n, cols[Math.min(2, lv - 1)]); n++;
    }
    lvMesh.count = n; lvMesh.instanceMatrix.needsUpdate = true; if (lvMesh.instanceColor) lvMesh.instanceColor.needsUpdate = true;
    n = 0;
    for (const i of d.blocked) { if (n >= 64) break; const [x, z] = tileXZ(d, i); pv.set(wx(x), 0.13, wx(z)); sv.set(1, 0.26, 1); m4.compose(pv, q0, sv); bagMesh.setMatrixAt(n++, m4); }
    bagMesh.count = n; bagMesh.instanceMatrix.needsUpdate = true;
    n = 0; let k = 0;
    for (const [x, z] of d.crews) {
      for (let j = 0; j < 3; j++) { const a = j * 2.1 + x; pv.set(wx(x) + Math.cos(a) * 0.22, 0.21, wx(z) + Math.sin(a) * 0.22); sv.set(1, 1, 1); m4.compose(pv, q0, sv); crewMesh.setMatrixAt(n++, m4); }
      pv.set(wx(x), 0.03, wx(z)); sv.set(1, 1, 1); m4.compose(pv, qf, sv); ringMesh.setMatrixAt(k++, m4);
    }
    crewMesh.count = n; crewMesh.instanceMatrix.needsUpdate = true; ringMesh.count = k; ringMesh.instanceMatrix.needsUpdate = true;
    syncBadges();
    syncBar();
  }
  // ----- barra de abajo -----
  let mode = 'crew';
  const bar = ui.h('div.th-bar');
  const title = ui.h('h3');
  const msg = ui.h('div.th-msg');
  const bCrew = ui.h('button.btn.sky.on', { html: icon('people', 18) + 'Cuadrilla' });
  const resName = { crecida: 'Bolsas', sequia: 'Tinajas', incendio: 'Baldes', tormenta: 'Lonas', helada: 'Leña' }[type];
  const bRes = ui.h('button.btn.sky', { html: icon({ crecida: '🧱', sequia: '🏺', incendio: '🪣', tormenta: '⛺', helada: '🪵' }[type], 18) + resName });
  const bEnd = ui.h('button.btn.primary', { html: 'Terminar turno' });
  const bOut = ui.h('button.btn', { html: 'Seguir después', title: 'Podés retomarla hoy' });
  bar.append(title, msg, ui.h('div.th-btns', {}, bCrew, bRes, bEnd), ui.h('div.th-btns', {}, bOut));
  container.append(bar);
  bCrew.addEventListener('click', () => { audio.sfx('tap'); mode = 'crew'; syncBar(); });
  bRes.addEventListener('click', () => { if (d.reservesLeft <= 0) { audio.sfx('error'); ui.toast('No te quedan: se fabrican en el Taller', { icon: 'info' }); return; } audio.sfx('tap'); mode = mode === 'res' ? 'crew' : 'res'; syncBar(); });
  bEnd.addEventListener('click', () => doEndTurn());
  bOut.addEventListener('click', () => { audio.sfx('close'); T.pauseDefense(); api.onDefenseEnd?.(); });
  function syncBar() {
    title.innerHTML = `<span>${icon(THREAT_TYPES[type].icon, 20)}${ui.esc(T.threatName({ id: d.id, type }))}</span><span>Turno ${Math.min(d.turn, d.turns)}/${d.turns}</span>`;
    bCrew.innerHTML = icon('people', 18) + `Cuadrillas ${d.crewsLeft}/${d.K}`;
    bRes.innerHTML = icon({ crecida: '🧱', sequia: '🏺', incendio: '🪣', tormenta: '⛺', helada: '🪵' }[type], 18) + `${resName} ${d.reservesLeft}`;
    bCrew.classList.toggle('on', mode === 'crew'); bRes.classList.toggle('on', mode === 'res');
    if (!msg.dataset.lock) msg.textContent = mode === 'res'
      ? 'Tocá una casilla para cerrarla hasta el final.'
      : type === 'tormenta' ? 'Los rayos marcados caen al terminar el turno: una cuadrilla en esa casilla los frena.'
        : d.turn === 1 ? 'Tocá una casilla: la cuadrilla baja la amenaza ahí y alrededor. Lo cubierto resiste solo.' : 'Mandá las cuadrillas y terminá el turno.';
  }
  function say(text, ms = 2200) { msg.textContent = text; msg.dataset.lock = '1'; clearTimeout(say.t); say.t = setTimeout(() => { delete msg.dataset.lock; syncBar(); }, ms); }
  // ----- cámara al grupo en riesgo -----
  if (d.targets.length) {
    const cx = d.targets.reduce((s, t) => s + t.x + t.w / 2, 0) / d.targets.length, cz = d.targets.reduce((s, t) => s + t.z + t.d / 2, 0) / d.targets.length;
    cam.flyTo(cx - HALF, cz - HALF);
  }
  syncMeshes();
  // ----- toques -----
  function onTap(x, y) {
    const p = r.pickGround(x, y);
    if (!p) return true;
    const tx = Math.floor(p.x + HALF), tz = Math.floor(p.z + HALF);
    if (tx < d.min || tz < d.min || tx >= d.min + d.W || tz >= d.min + d.W) return true;
    if (mode === 'res') {
      const res = T.reserve(tx, tz);
      if (!res.ok) { audio.sfx('error'); say(d.reservesLeft <= 0 ? 'No te quedan reservas.' : 'Esa casilla ya está cerrada.'); return true; }
      audio.sfx('place'); fx.dust(wx(tx), 0.1, wx(tz), 0.4);
      if (d.reservesLeft <= 0) mode = 'crew';
    } else {
      const res = T.crew(tx, tz);
      if (!res.ok) { audio.sfx('error'); say(d.crewsLeft <= 0 ? 'No quedan cuadrillas este turno: terminá el turno.' : 'Ya hay una cuadrilla ahí.'); return true; }
      audio.sfx('tap');
      fx.burst(wx(tx), 0.3, wx(tz), { n: 10, colors: type === 'incendio' || type === 'tormenta' ? ['#cfe8ff', '#ffffff'] : ['#ffffff', '#f3e6d6'], speed: 1.1, up: 1.4, gravity: 3, size: 0.07, life: 0.6, spread: 0.4, drag: 2 });
    }
    d = T.activeDefense() || d;
    syncMeshes();
    return true;
  }
  let busy = false;
  async function doEndTurn() {
    if (busy) return;
    busy = true;
    audio.sfx('swoosh');
    const out = T.endTurn();
    const log = out.log || { spread: [], hits: [], damaged: [], rays: [] };
    d = T.activeDefense() || d;
    for (const ray of log.rays || []) {
      const [x, z] = tileXZ(d, ray.i);
      if (ray.stopped) fx.sparkle(wx(x), 0.6, wx(z), ['#ffffff', '#cfe8ff']);
      else { fx.burst(wx(x), 2.5, wx(z), { n: 12, colors: ['#fff6c2', '#ffd166', '#ffffff'], speed: 0.4, up: -6, gravity: 2, size: 0.1, life: 0.4, spread: 0.1, drag: 0 }); audio.sfx('swoosh'); }
    }
    for (const h of log.hits) {
      const e = entries.get(h.uid);
      if (!e) continue;
      const sp = ov.project(api.topPos(e, 0.4), {});
      ui.floatText(sp.x, sp.y, h.ignored ? 'Resistió' : log.damaged.includes(h.uid) ? 'Dañado' : 'Golpe', h.ignored ? '' : 'bad');
      if (!h.ignored) { e.anim = { type: 'squish', t: 0 }; audio.sfx(log.damaged.includes(h.uid) ? 'error' : 'tap'); }
    }
    syncMeshes();
    if (out.done) {
      const res = out.result || { pct: 100, damaged: [], reward: {} };
      setTimeout(async () => {
        await openResult(ctx, res, T.threatName({ id: threatId, type }));
        api.onDefenseEnd?.();
      }, 700);
    } else busy = false;
  }
  function update(dt) {
    anim += dt;
    lvMat.opacity = (type === 'helada' ? 0.85 : 0.72) + Math.sin(anim * 3) * 0.06;
    ringMat.opacity = 0.45 + Math.sin(anim * 5) * 0.15;
    if (type === 'incendio' || type === 'tormenta') {
      if (Math.random() < dt * 6) {
        const hot = []; for (let i = 0; i < N; i++) if (d.levels[i] >= 2) hot.push(i);
        if (hot.length) { const [x, z] = tileXZ(d, hot[Math.floor(Math.random() * hot.length)]); fx.burst(wx(x), 0.5, wx(z), { n: 3, colors: ['#ffb347', '#ff7a3d', '#9a928a'], speed: 0.3, up: 1.4, gravity: -0.6, size: 0.09, life: 0.9, spread: 0.3, drag: 1.5 }); }
      }
    }
  }
  function detach() {
    clearTimeout(say.t);
    r.scene.remove(group);
    for (const o of [lvMesh, bagMesh, crewMesh, ringMesh]) { o.geometry.dispose?.(); o.dispose?.(); }
    boxGeo.dispose(); crewGeo.dispose(); lvMat.dispose(); bagMat.dispose(); crewMat.dispose(); ringMat.dispose();
    for (const it of badges.values()) ov.remove(it);
    for (const it of rayIcons) ov.remove(it);
    bar.remove();
    audio.music('city');
  }
  // gancho de pruebas (tools/test-threats.mjs)
  const hook = { onTap, endTurn: doEndTurn, get d() { return d; }, tileCenter: (x, z) => new THREE.Vector3(wx(x), 0, wx(z)), tileIndex: (x, z) => tileIndex(d, x, z) };
  return { detach, onTap, update, hook };
}
export const defenseOf = (id) => BUILDING_BY_ID[id] && DEFENSES[id];
