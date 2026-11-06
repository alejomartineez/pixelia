// Modo visita: la ciudad de una amistad, solo lectura (ctx.router.go('city', { visit: friendId })).
// Se ve su ciudad con su personaje y su auto; se puede dar ❤️ (1 por día), dejar una notita (80 letras),
// ayudar en obras en curso (hasta 3 por día en cada ciudad) y volver. Nada se rompe ni se mueve.
import * as THREE from 'three';
import { createPixelRenderer, addLights } from '../core/voxel.js';
import { buildingModel, constructionModel } from '../city/models.js';
import { icon } from '../core/icons.js';
import { rewardScale, MAX_EXPANSIONS } from '../core/data.js';
import { def, population, happiness, landBounds, fmtTime, fmtNum } from '../core/economy.js';
import { HALF, footCenter, clamp } from './city-common.js';
import { createWorld } from './city-world.js';
import { createCameraCtl } from './city-camera.js';
import { createLife } from './city-life.js';
import { createParticles, createOverlays } from './city-fx.js';
import { createBatcher } from './city-batch.js';
import { STYLE } from './city-ui.js';
import { themeOf } from '../city/themes.js';

const TAP_PX = 8;
const HELPS_PER_DAY = 3;
const HELP_MINUTES = 15;
const NOTE_MAX = 80;

const VSTYLE = `
.cv-top { position: absolute; top: calc(var(--safe-t) + 10px); left: 50%; transform: translateX(-50%); z-index: 25; max-width: calc(100% - 24px);
  background: var(--panel); border: 3px solid var(--ink); border-radius: 16px; box-shadow: 0 5px 0 var(--ink), 0 10px 24px rgba(59,35,64,.2);
  padding: 6px 16px 8px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 3px; animation: cv-drop .35s cubic-bezier(.3,1.5,.6,1); }
@keyframes cv-drop { from { transform: translate(-50%, -30px); opacity: 0; } }
.cv-top h2 { margin: 0; font-size: 20px; line-height: 1.1; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cv-top h2 span { overflow: hidden; text-overflow: ellipsis; }
.cv-top .cv-sub { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; font-size: 13px; }
.cv-top .cv-sub .chip { font-size: 12px; padding: 1px 7px 1px 3px; gap: 2px; border-width: 2px; }
.cv-bar { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-b) + 10px); z-index: 30; width: min(560px, calc(100% - 16px));
  background: var(--panel); border: 3px solid var(--ink); border-radius: 16px; box-shadow: 0 5px 0 var(--ink), 0 12px 30px rgba(59,35,64,.25);
  padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 7px; animation: cx-slideup .3s cubic-bezier(.3,1.5,.6,1); }
.cv-hint { font-size: 13px; color: var(--ink-l); line-height: 1.2; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 18px; }
.cv-btns { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.cv-btns .btn { padding: 6px 6px; font-size: 15px; min-height: 48px; line-height: 1.05; gap: 4px; min-width: 0; white-space: normal; text-align: center; }
.cv-btns .btn img { flex: none; }
.cv-btns .btn.done { filter: saturate(.6); }
@media (max-width: 380px) { .cv-btns .btn { font-size: 13px; } }
.cv-help { position: relative; padding-bottom: 9px; animation: cx-bob 1.1s steps(4) infinite; }
.cv-help .cv-hb { display: flex; align-items: center; gap: 3px; padding: 3px 9px 3px 5px; background: var(--mint); border: 3px solid var(--ink); border-radius: 12px;
  box-shadow: inset 0 -4px 0 var(--mint-d), 0 3px 0 rgba(59,35,64,.3); font-weight: 700; font-size: 14px; white-space: nowrap; color: var(--ink); }
.cv-help .cv-hb small { font-size: 11px; font-weight: 700; opacity: .75; margin-left: 2px; }
.cv-help::after { content: ''; position: absolute; left: 50%; bottom: 1px; width: 10px; height: 10px; background: var(--mint); border: 3px solid var(--ink);
  border-top: 0; border-left: 0; transform: translateX(-50%) rotate(45deg); }
.cv-help.busy { opacity: .6; }
.cv-help.done .cv-hb { background: #fff; box-shadow: inset 0 -4px 0 #eadcf0, 0 3px 0 rgba(59,35,64,.3); }
.cv-help.done::after { background: #fff; }
.cv-help.pop { animation: cx-bpop .25s ease-in forwards; }
.cv-name { padding-bottom: 6px; }
.cv-name > span { display: flex; align-items: center; gap: 4px; padding: 2px 9px 2px 5px; background: var(--pink); color: #fff; border: 3px solid var(--ink); border-radius: 10px;
  box-shadow: inset 0 -4px 0 var(--pink-d), 0 3px 0 var(--ink); font-weight: 700; font-size: 13px; white-space: nowrap; text-shadow: 0 2px 0 rgba(59,35,64,.35); }
.cv-load { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; pointer-events: none; }
.cv-load > div { pointer-events: auto; background: var(--panel); border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 5px 0 var(--ink); padding: 18px 22px;
  display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: min(320px, calc(100% - 32px)); text-align: center; }
.cv-load b { font-size: 18px; }
.cv-load .cv-car { animation: cv-drive 1s steps(4) infinite; }
@keyframes cv-drive { 50% { transform: translateY(-4px) rotate(-4deg); } }
.cv-heart { position: absolute; z-index: 45; pointer-events: none; animation: cv-rise var(--d, 1.6s) cubic-bezier(.2,.7,.4,1) forwards; }
@keyframes cv-rise { 0% { transform: translate(-50%, 0) scale(.4); opacity: 0; } 15% { opacity: 1; transform: translate(-50%, -20px) scale(1.15); }
  100% { transform: translate(calc(-50% + var(--dx, 0px)), var(--dy, -320px)) scale(.9); opacity: 0; } }
.cv-note textarea { width: 100%; min-height: 84px; resize: none; font-family: var(--font); font-size: 17px; color: var(--ink); background: #fff; border: 3px solid var(--ink);
  border-radius: 12px; padding: 8px 10px; box-sizing: border-box; }
.cv-note .cv-count { text-align: right; font-size: 13px; color: var(--ink-l); margin-top: 4px; }
.cv-note .cv-count.max { color: var(--coral); font-weight: 700; }
.cv-note .cv-ideas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.cv-note .cv-ideas button { font-family: var(--font); font-size: 13px; background: #fff; border: 2px solid var(--ink); border-radius: 10px; padding: 3px 8px; color: var(--ink); cursor: pointer; }
`;

const NOTE_IDEAS = ['¡Qué linda ciudad! 🌸', '¡Me encantó tu castillo! 👑', 'Pasé a saludarte 💕', '¡Qué talento para construir! ✨'];

/** Día UTC (igual que el servidor) para los límites diarios. */
const dayKey = () => new Date().toISOString().slice(0, 10);

/** Copia segura de la ciudad pública de una amistad (descarta edificios que esta versión no conoce). */
function sanitizeCity(city, now = Date.now()) {
  const used = new Set();
  let fake = -1;
  const buildings = [];
  for (const raw of Array.isArray(city?.buildings) ? city.buildings : []) {
    if (!raw || !def(raw.id) || !Number.isFinite(+raw.x) || !Number.isFinite(+raw.z)) continue;
    let uid = Number.isFinite(+raw.uid) && raw.uid !== null && raw.uid !== '' ? +raw.uid : null;
    const realUid = uid != null && !used.has(uid);
    if (!realUid) uid = fake--;
    used.add(uid);
    const busyUntil = Number.isFinite(+raw.busyUntil) ? +raw.busyUntil : 0;
    const b = { uid, id: raw.id, x: Math.round(+raw.x), z: Math.round(+raw.z), rot: ((Math.round(+raw.rot) || 0) % 4 + 4) % 4,
      level: clamp(Math.round(+raw.level) || 1, 1, 9), buildEnd: 0, upgradeEnd: 0, lastCollect: now, realUid };
    // obra en curso: si el perfil no dice si es construcción o mejora, se muestra como mejora (edificio + andamio)
    if (busyUntil > now) { if (raw.busyKind === 'build') b.buildEnd = busyUntil; else b.upgradeEnd = busyUntil; }
    buildings.push(b);
  }
  // tema de su ciudad (si es uno que esta versión no conoce, o no hay, se ve como Dulce Pastel)
  return { buildings, nextUid: 1, expansions: clamp(Math.round(+city?.expansions) || 0, 0, MAX_EXPANSIONS), flagColor: city?.flagColor, theme: themeOf(city?.theme).id, camera: null };
}

function safeModel(fn, size) {
  try { const g = fn(); if (g && g.isObject3D) return g; } catch (err) { console.warn('[visit] modelo con error', err); }
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(size[0] * 0.8, 0.6, size[1] * 0.8), new THREE.MeshLambertMaterial({ color: 0xffc2dc }));
  m.position.y = 0.3; g.add(m); g.userData.height = 0.6;
  return g;
}

export function createVisit(ctx) {
  const { store, bus, ui, audio } = ctx;
  let container, styleEl, r, cam, world, life, fx, ov, batch, bGroup, ro, topEl, barEl, loadEl, hintEl, likeBtn, noteBtn;
  let disposed = false, net = null, host = null, hostName = 'tu amistad', vstate = null, busyAct = false, nameTag = null;
  const entries = new Map();
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enableAll();
  const tmpV = new THREE.Vector3();
  const timers = [];
  const later = (fn, ms) => { const id = setTimeout(() => { if (!disposed) fn(); }, ms); timers.push(id); return id; };

  // ---------- registro local de lo que hice hoy (para no ofrecer lo que ya no se puede) ----------
  function hostLog() {
    const s = ctx.state;
    if (!s.visitLog || s.visitLog.day !== dayKey()) s.visitLog = { day: dayKey(), hosts: {} };
    const H = s.visitLog.hosts;
    return (H[host] ||= { liked: false, note: false, helped: [] });
  }
  const helpsLeft = () => Math.max(0, HELPS_PER_DAY - hostLog().helped.length);

  // ---------- salir ----------
  let leaving = false;
  function goHome() {
    if (disposed || leaving) return;
    leaving = true;
    const tryGo = () => {
      if (disposed) return;
      Promise.resolve(ctx.router.go('city')).then(ok => { if (!ok && !disposed) setTimeout(tryGo, 300); });
    };
    tryGo();
  }
  function fail(msg) {
    if (disposed) return;
    audio.sfx('error');
    ui.toast(msg || 'No pudimos abrir esa ciudad. Probá de nuevo en un ratito.', { icon: 'info' });
    later(goHome, 250);
  }

  // =====================================================================
  // Carga
  // =====================================================================
  async function load(id) {
    try {
      net = (await import('../online/net.js')).net;
    } catch (err) { console.warn('[visit] net', err); return fail('No pudimos conectarnos. Probá de nuevo en un ratito.'); }
    if (disposed) return;
    if (net.mode === 'off') return fail('Para visitar ciudades tenés que jugar online.');
    await net.init();
    if (disposed) return;
    if (!net.user) return fail('Iniciá sesión para visitar a tus amigos.');
    if (id === net.user.id) return fail('¡Esa es tu ciudad! 😄');
    const res = await net.getProfiles([id]);
    if (disposed) return;
    if (res?.error) return fail(res.error);
    const p = Array.isArray(res) ? res.find(x => x && x.id === id) || res[0] : null;
    if (!p) return fail('No encontramos esa ciudad.');
    hostName = String(p.name || hostName).slice(0, 24);
    if (p.friend === false) return fail(`Para visitar a ${hostName}, primero agréguense con su código de amistad.`);
    if (!p.city || !Array.isArray(p.city.buildings) || !p.city.buildings.length) return fail(`${hostName} todavía no publicó su ciudad. ¡Probá más tarde!`);
    try { build(p); } catch (err) { console.error('[visit] armando la ciudad', err); return fail('Ups, no pudimos dibujar esa ciudad.'); }
    // visita del día (suma amistad); no hace falta esperarla
    Promise.resolve(net.visit(id)).then(v => {
      if (disposed || !v || v.error) return;
      if (v.first) later(() => { const s = screenOfCastle(); ui.floatText(s.x, s.y - 30, `${icon('heart', 20)}+1 amistad`); }, 900);
    }).catch(() => {});
  }

  // =====================================================================
  // Escena
  // =====================================================================
  function build(p) {
    const now = Date.now();
    vstate = {
      princess: p.look && typeof p.look === 'object' ? p.look : {},
      car: p.car && typeof p.car === 'object' ? p.car : {},
      city: sanitizeCity(p.city, now),
      player: { level: Math.max(1, p.level | 0), name: hostName, cityName: p.city_name || '' },
    };
    const lowQ = !!ctx.state.settings?.lowQuality;
    r = createPixelRenderer(container, { background: null, viewSize: 14, lowQuality: lowQ, outline: true });
    r.renderer.setClearColor(0x000000, 0);
    const { hemi, sun } = addLights(r.scene, { shadowSize: 50, shadowRes: lowQ ? 1024 : 2048 });
    // se ve con el estilo que eligió su dueño/a: cielo, luces, terreno y colores
    const T = themeOf(vstate.city.theme);
    container.style.setProperty('--cx-sky', T.sky);
    container.style.setProperty('--cx-stars', String(T.stars));
    hemi.color.setHex(T.lights.sky); hemi.groundColor.setHex(T.lights.ground); hemi.intensity = T.lights.hemi;
    sun.color.setHex(T.lights.sun); sun.intensity = T.lights.sunI;
    sun.shadow.camera.far = 120;
    sun.position.set(17, 26, 5);
    sun.shadow.camera.updateProjectionMatrix();
    fx = createParticles(r.scene);
    const lb = landBounds(vstate);
    world = createWorld(r, { bounds: { ...lb, canExpand: false }, theme: T.id });
    bGroup = new THREE.Group();
    r.scene.add(bGroup);
    batch = createBatcher(r.scene);
    for (const b of vstate.city.buildings) createEntry(b);
    // la vida (vecinos, su personaje y su auto) usa el estado de la amistad
    life = createLife(r, { state: vstate, economy: { population: () => population(vstate) } });

    const castle = vstate.city.buildings.find(b => b.id === 'castillo');
    // la cámara arranca mirando el centro de lo construido (con un poco más de zoom-out si la ciudad es grande)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of vstate.city.buildings) {
      const c = footCenter(b.id, b.x, b.z, b.rot);
      x0 = Math.min(x0, c.x - c.w / 2); x1 = Math.max(x1, c.x + c.w / 2); z0 = Math.min(z0, c.z - c.d / 2); z1 = Math.max(z1, c.z + c.d / 2);
    }
    const cc = Number.isFinite(x0) ? { x: (x0 + x1) / 2, z: (z0 + z1) / 2 } : { x: 0.5, z: 1 };
    const span = Number.isFinite(x0) ? Math.max(x1 - x0, z1 - z0) : 8;
    const phone = Math.min(innerWidth, innerHeight) < 600;
    cam = createCameraCtl(r, { x: cc.x + 0.5, z: cc.z + 0.5, u: clamp(span * (phone ? 1.05 : 1.2), phone ? 11 : 16, phone ? 18 : 24), rot: 0 }, { limit: () => lb.side / 2 + 2.5 });
    ov = createOverlays(container, r);
    ro = new ResizeObserver(() => { cam.applyProj(); ov.resize(); });
    ro.observe(container);
    if (castle) {
      const ce = entries.get(castle.uid);
      nameTag = ov.add(ui.h('div.cv-name', { html: `<span>${icon('crown', 16)}${ui.esc(hostName)}</span>` }), topPos(ce, 0.25));
    }

    makeTop();
    makeBar();
    loadEl?.remove(); loadEl = null;

    const cv = r.canvas;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('lostpointercapture', (ev) => { if (pointers.has(ev.pointerId)) onUp({ pointerId: ev.pointerId, type: 'pointercancel', clientX: 0, clientY: 0 }); });
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
    document.addEventListener('visibilitychange', onVisibility);
    syncHelp();
    r.onFrame(frame);
    r.start();
    if (window.__pixelia) window.__pixelia.visit = { r, cam, entries, life, ov, host, theme: T.id, get state() { return vstate; }, help: (uid) => { const e = entries.get(uid); if (e) help(e); }, like, sendNote };
    audio.sfx('swoosh');
  }

  function topPos(e, extra = 0.15) { return tmpV.set(e.root.position.x, (e.height || 1) + extra, e.root.position.z); }
  function screenOf(v3) { return ov.project(v3, {}); }
  function screenOfCastle() {
    const c = vstate?.city.buildings.find(b => b.id === 'castillo');
    const e = c && entries.get(c.uid);
    return e && ov ? screenOf(topPos(e, 0.3)) : { x: innerWidth / 2, y: innerHeight / 2 };
  }

  function createEntry(b) {
    const root = new THREE.Group();
    root.userData.uid = b.uid;
    bGroup.add(root);
    const e = { b, root, model: null, scaffold: null, mode: null, height: 1, live: false, anim: null, help: null };
    entries.set(b.uid, e);
    refreshEntry(e);
    return e;
  }
  function refreshEntry(e) {
    const b = e.b, now = Date.now();
    const mode = b.buildEnd > now ? 'build' : b.upgradeEnd > now ? 'upgrade' : 'done';
    if (mode === e.mode) return false;
    const c = footCenter(b.id, b.x, b.z, b.rot);
    e.root.position.set(c.x, 0, c.z);
    if (e.model) { e.root.remove(e.model); e.model = null; }
    if (e.scaffold) { e.root.remove(e.scaffold); e.scaffold = null; }
    if (mode !== 'build') {
      e.model = safeModel(() => buildingModel(b.id, b.level, { flagColor: vstate.city.flagColor, theme: vstate.city.theme }), [c.w, c.d]);
      e.model.rotation.y = b.rot * Math.PI / 2;
      e.root.add(e.model);
      e.height = e.model.userData.height || 1;
    }
    if (mode !== 'done') {
      e.scaffold = safeModel(() => constructionModel(c.w, c.d, vstate.city.theme), [c.w, c.d]);
      e.root.add(e.scaffold);
      e.height = Math.max(mode === 'build' ? 0 : e.height, e.scaffold.userData.height || 0.8);
    } else if (e.mode && e.mode !== 'done') {
      // la obra terminó mientras mirábamos
      e.anim = { t: 0 };
      fx.sparkle(c.x, e.height * 0.6, c.z);
    }
    e.mode = mode;
    batch.markDirty();
    if (e.help) e.help.pos.copy(topPos(e, 0.15));
    return true;
  }

  // ---------- burbujas de ayuda ----------
  function canHelp(e, now = Date.now()) {
    const b = e.b;
    return b.realUid && (b.buildEnd > now || b.upgradeEnd > now);
  }
  function syncHelp() {
    const now = Date.now();
    const L = hostLog();
    const left = helpsLeft();
    let n = 0;
    for (const e of entries.values()) {
      if (refreshEntry(e)) life?.refreshGrid();
      const helped = L.helped.includes(e.b.uid);
      const show = canHelp(e, now) && (left > 0 || helped);
      if (show) {
        n++;
        if (!e.help) {
          const el = ui.h('div.cv-help', { html: `<div class="cv-hb">${icon('hammer', 20)}<span></span><small></small></div>` });
          e.help = ov.add(el, topPos(e, 0.15));
          e.help.txt = el.querySelector('span'); e.help.tm = el.querySelector('small');
        }
        e.help.el.classList.toggle('done', helped);
        const label = helped ? '¡Gracias!' : 'Ayudar';
        if (e.help.txt.textContent !== label) e.help.txt.textContent = label;
        const rem = Math.max(e.b.buildEnd, e.b.upgradeEnd) - now;
        const tt = fmtTime(rem / 1000);
        if (e.help.tm.textContent !== tt) e.help.tm.textContent = tt;
      } else if (e.help) { ov.remove(e.help); e.help = null; }
    }
    if (hintEl) {
      const busy = [...entries.values()].filter(e => canHelp(e, now)).length;
      const html = !busy ? `${icon('sparkle', 16)}Paseá por la ciudad de ${ui.esc(hostName)}`
        : left > 0 ? `${icon('hammer', 16)}Tocá una obra para ayudar · te quedan <b>${left}</b> ayuda${left === 1 ? '' : 's'} hoy`
          : `${icon('check', 16)}¡Ya ayudaste ${HELPS_PER_DAY} veces hoy! Mañana más`;
      if (hintEl.innerHTML !== html) hintEl.innerHTML = html;
    }
    return n;
  }

  async function help(e) {
    if (busyAct || !e?.help || disposed) return;
    const L = hostLog();
    if (L.helped.includes(e.b.uid)) { audio.sfx('tap'); ui.toast(`Ya ayudaste en esta obra. ¡${hostName} te lo agradece!`, { icon: 'heart' }); return; }
    if (helpsLeft() <= 0) { audio.sfx('error'); ui.toast('Ya ayudaste 3 veces hoy en esta ciudad. ¡Mañana más!', { icon: 'info' }); return; }
    if (!canHelp(e)) return;
    busyAct = true;
    const it = e.help;
    it.el.classList.add('busy');
    audio.sfx('tap');
    const res = await net.sendGift(host, 'help', { uid: e.b.uid, minutes: HELP_MINUTES });
    busyAct = false;
    if (disposed) return;
    it.el.classList.remove('busy');
    if (res?.error) {
      audio.sfx('error');
      ui.toast(res.error, { icon: 'info' });
      if (/3 veces/.test(res.error)) { while (L.helped.length < HELPS_PER_DAY) L.helped.push(null); store.markDirty(); syncHelp(); }
      return;
    }
    L.helped.push(e.b.uid);
    store.markDirty();
    // la obra de ella avanza 15 minutos (también acá, para que se vea)
    const ms = HELP_MINUTES * 60e3;
    if (e.b.buildEnd > Date.now()) e.b.buildEnd -= ms; else if (e.b.upgradeEnd > Date.now()) e.b.upgradeEnd -= ms;
    // premio para quien ayuda (escalado con su nivel)
    const coins = Math.round(40 * rewardScale(ctx.state.player.level || 1));
    store.grant({ coins, xp: 5 }, 'social:help');
    bus.emit('social:helped', { to: host, uid: e.b.uid, kind: 'help', coins });
    const s = screenOf(topPos(e, 0.4));
    audio.sfx('coin');
    ui.floatText(s.x, s.y - 20, `+${fmtNum(coins)} ${icon('coin', 22)}`);
    later(() => ui.floatText(s.x, s.y - 50, `${icon('hammer', 18)}-${HELP_MINUTES} min`), 280);
    const c = e.root.position;
    fx.sparkle(c.x, e.height + 0.2, c.z, ['#6fe3c1', '#ffffff', '#ffd166']);
    fx.dust(c.x, 0.05, c.z, 0.7);
    e.anim = { t: 0 };
    syncHelp();
    if (!helpsLeft()) later(() => ui.toast(`¡Gracias por ayudar a ${hostName}! 💕`, { icon: 'heart', type: 'good' }), 700);
  }

  // ---------- ❤️ ----------
  async function like() {
    if (busyAct || disposed || !net) return;
    const L = hostLog();
    if (L.liked) { audio.sfx('tap'); hearts(6); ui.toast(`Ya le diste ❤️ a ${hostName} hoy. ¡Mañana podés de nuevo!`, { icon: 'heart' }); return; }
    busyAct = true;
    likeBtn.disabled = true;
    const res = await net.like(host);
    busyAct = false;
    if (disposed) return;
    if (res?.error) {
      if (/ya le diste/i.test(res.error)) { L.liked = true; store.markDirty(); renderBar(); }
      else likeBtn.disabled = false;
      audio.sfx('error');
      ui.toast(res.error, { icon: 'info' });
      return;
    }
    L.liked = true;
    store.markDirty();
    audio.sfx('star');
    hearts(18);
    const c = vstate.city.buildings.find(b => b.id === 'castillo');
    const ce = c && entries.get(c.uid);
    if (ce) fx.burst(ce.root.position.x, ce.height * 0.8, ce.root.position.z, { n: 30, colors: ['#ff7eb6', '#ff9ccb', '#ffffff', '#ffd6ec'], speed: 1.6, up: 3.5, gravity: 3, size: 0.09, life: 1.4, spread: 0.8 });
    ui.toast(`¡Le diste ❤️ a la ciudad de ${hostName}!`, { icon: 'heart', type: 'good' });
    renderBar();
  }
  function hearts(n) {
    if (!container) return;
    const rb = likeBtn?.getBoundingClientRect();
    const crc = container.getBoundingClientRect();
    const x0 = rb && rb.width ? rb.left + rb.width / 2 - crc.left : crc.width / 2;
    const y0 = rb && rb.width ? rb.top - crc.top : crc.height - 120;
    for (let i = 0; i < n; i++) {
      const el = ui.h('div.cv-heart', { html: icon('heart', 18 + Math.round(Math.random() * 18)) });
      el.style.left = (x0 + (Math.random() - 0.5) * 40) + 'px';
      el.style.top = y0 + 'px';
      el.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 220) + 'px');
      el.style.setProperty('--dy', -Math.round(220 + Math.random() * Math.max(120, y0 * 0.5)) + 'px');
      el.style.setProperty('--d', (1.2 + Math.random() * 0.9).toFixed(2) + 's');
      el.style.animationDelay = (i * 0.06).toFixed(2) + 's';
      container.append(el);
      later(() => el.remove(), 2600 + i * 60);
    }
  }

  // ---------- notita ----------
  function openNote() {
    if (!net) return;
    const L = hostLog();
    if (L.note) { audio.sfx('tap'); ui.toast(`Ya le dejaste una notita a ${hostName} hoy`, { icon: 'info' }); return; }
    const body = ui.h('div.cv-note');
    const ta = ui.h('textarea', { maxlength: String(NOTE_MAX), placeholder: `Escribile algo lindo a ${hostName}…`, 'aria-label': 'Notita' });
    const cnt = ui.h('div.cv-count', {}, `0/${NOTE_MAX}`);
    const upd = () => {
      const chars = [...ta.value];
      if (chars.length > NOTE_MAX) ta.value = chars.slice(0, NOTE_MAX).join('');
      const n = [...ta.value].length;
      cnt.textContent = `${n}/${NOTE_MAX}`;
      cnt.classList.toggle('max', n >= NOTE_MAX);
    };
    ta.addEventListener('input', upd);
    const ideas = ui.h('div.cv-ideas');
    for (const t of NOTE_IDEAS) ideas.append(ui.h('button', { type: 'button', onclick: () => { ta.value = t; upd(); ta.focus(); } }, t));
    body.append(ta, cnt, ideas);
    let sending = false;
    const m = ui.modal({ title: `Notita para ${hostName}`, icon: '💌', content: body, className: 'cx-modal',
      actions: [{ label: 'Cancelar', cls: 'ghost' }, { html: `${icon('💌', 20)}Dejar notita`, label: 'Dejar notita', cls: 'pink', onClick: async () => {
        if (sending) return false;
        const t = ta.value.trim();
        if (!t) { audio.sfx('error'); ui.toast('Escribí algo cortito', { icon: 'info' }); return false; }
        sending = true;
        const ok = await sendNote(t);
        sending = false;
        return ok ? undefined : false;
      } }] });
    modals.add(m);
    setTimeout(() => { try { ta.focus(); } catch {} }, 250);
  }
  async function sendNote(text) {
    const t = String(text || '').trim();
    const res = await net.leaveNote(host, [...t].slice(0, NOTE_MAX).join(''));
    if (disposed) return false;
    const L = hostLog();
    if (res?.error) {
      audio.sfx('error');
      ui.toast(res.error, { icon: 'info' });
      if (/ya le dejaste/i.test(res.error)) { L.note = true; store.markDirty(); renderBar(); return true; }
      return false;
    }
    L.note = true;
    store.markDirty();
    audio.sfx('done');
    ui.toast(`¡Le dejaste una notita a ${hostName}! 💌`, { icon: 'heart', type: 'good' });
    const s = screenOfCastle();
    ui.floatText(s.x, s.y - 20, icon('💌', 30));
    renderBar();
    return true;
  }
  const modals = new Set();

  // ---------- UI fija ----------
  function makeTop() {
    topEl?.remove();
    let pop = 0, hp = 0;
    try { pop = population(vstate); hp = happiness(vstate).pct; } catch {}
    const cityName = vstate.player.cityName && vstate.player.cityName !== 'Pixelia' ? `<span class="chip">${icon('flower', 14)}${ui.esc(vstate.player.cityName)}</span>` : '';
    topEl = ui.h('div.cv-top', { html: `<h2>${icon('castle', 24)}<span>Ciudad de ${ui.esc(hostName)}</span></h2>
      <div class="cv-sub"><span class="chip gold">${icon('star', 14)}Nivel ${vstate.player.level}</span>${cityName}
      <span class="chip pink">${icon('people', 14)}${fmtNum(pop)}</span><span class="chip mint">${icon('smile', 14)}${hp}%</span></div>` });
    container.append(topEl);
  }
  function makeBar() {
    barEl?.remove();
    barEl = ui.h('div.cv-bar');
    hintEl = ui.h('div.cv-hint');
    const btns = ui.h('div.cv-btns');
    likeBtn = ui.h('button.btn.pink', { onclick: () => like() });
    noteBtn = ui.h('button.btn.lilac', { onclick: () => { audio.sfx('tap'); openNote(); } });
    const home = ui.h('button.btn.mint', { html: `${icon('home', 20)}Volver a mi ciudad`, onclick: () => { audio.sfx('tap'); goHome(); } });
    btns.append(likeBtn, noteBtn, home);
    barEl.append(hintEl, btns);
    container.append(barEl);
    renderBar();
  }
  function renderBar() {
    if (!likeBtn) return;
    const L = hostLog();
    likeBtn.innerHTML = L.liked ? `${icon('heart', 20)}¡Te encantó!` : `${icon('heart', 20)}¡Qué linda!`;
    likeBtn.classList.toggle('done', L.liked);
    likeBtn.disabled = false;
    noteBtn.innerHTML = L.note ? `${icon('check', 18)}Notita enviada` : `${icon('💌', 20)}Dejar notita`;
    noteBtn.classList.toggle('done', L.note);
  }
  function makeLoading(name) {
    loadEl = ui.h('div.cv-load', { html: `<div><span class="cv-car">${icon('car', 48)}</span><b>Viajando a la ciudad de ${ui.esc(name)}…</b></div>` });
    const back = ui.h('button.btn.ghost.small', { html: `${icon('back', 18)}Volver`, onclick: () => { audio.sfx('tap'); goHome(); } });
    loadEl.firstChild.append(back);
    container.append(loadEl);
  }

  // =====================================================================
  // Entrada
  // =====================================================================
  const pointers = new Map();
  let gesture = null;
  function onDown(ev) {
    if (ev.button !== undefined && ev.button > 0 && ev.pointerType === 'mouse') return;
    try { r.canvas.setPointerCapture(ev.pointerId); } catch {}
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY });
    if (pointers.size === 1) { gesture = 'pending'; cam.stop(); }
    else if (pointers.size === 2) {
      if (gesture === 'pan') cam.endGrab();
      const [a, b] = [...pointers.values()];
      gesture = 'pinch';
      cam.beginPinch(a, b);
    }
  }
  function onMove(ev) {
    const p = pointers.get(ev.pointerId);
    if (!p) { if (ev.pointerType === 'mouse') hover(ev.clientX, ev.clientY); return; }
    p.x = ev.clientX; p.y = ev.clientY;
    if (gesture === 'pinch') { if (pointers.size >= 2) { const [a, b] = [...pointers.values()]; cam.movePinch(a, b); } }
    else if (gesture === 'pending') {
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_PX) { gesture = 'pan'; cam.beginGrab(p.sx, p.sy); cam.moveGrab(p.x, p.y); r.canvas.style.cursor = 'grabbing'; }
    } else if (gesture === 'pan') cam.moveGrab(p.x, p.y);
  }
  function onUp(ev) {
    const p = pointers.get(ev.pointerId);
    if (!p) return;
    pointers.delete(ev.pointerId);
    try { r.canvas.releasePointerCapture(ev.pointerId); } catch {}
    if (gesture === 'pinch') {
      cam.endPinch();
      if (pointers.size === 1) { const [q] = [...pointers.values()]; gesture = 'pan'; cam.beginGrab(q.x, q.y); }
      else if (!pointers.size) gesture = null;
      return;
    }
    if (gesture === 'pending' && ev.type === 'pointerup') onTap(ev.clientX, ev.clientY);
    else if (gesture === 'pan') cam.endGrab();
    if (!pointers.size) { gesture = null; r.canvas.style.cursor = ''; }
  }
  function onWheel(ev) {
    ev.preventDefault();
    const dy = ev.deltaMode === 1 ? ev.deltaY * 30 : ev.deltaY;
    cam.zoomAt(ev.clientX, ev.clientY, Math.exp(clamp(dy, -200, 200) * 0.0018));
  }
  function hitHelp(x, y) {
    const k = ov.scale;
    let best = null, bd = (44 * k) ** 2;
    for (const e of entries.values()) {
      const it = e.help;
      if (!it || !it.onScreen) continue;
      const dx = it.sx - x, dy = (it.sy - 24 * k) - y, dd = dx * dx * 0.5 + dy * dy;
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }
  function hitWalker(w, x, y, rad) {
    if (!w || !w.obj.visible) return false;
    const s = screenOf(tmpV.copy(w.obj.position).setY(w.obj.position.y + 0.35));
    return (s.x - x) ** 2 + (s.y - y) ** 2 < rad * rad;
  }
  function raycastBuilding(x, y) {
    raycaster.setFromCamera(r.toNDC(x, y), r.camera);
    for (const h of raycaster.intersectObjects(bGroup.children, true)) {
      let o = h.object;
      while (o && o.userData.uid == null) o = o.parent;
      if (o) return o.userData.uid;
    }
    return null;
  }
  let hoverAt = 0;
  function hover(x, y) {
    const now = performance.now();
    if (now - hoverAt < 90 || !ov) return;
    hoverAt = now;
    r.canvas.style.cursor = hitHelp(x, y) || hitWalker(life.player, x, y, 30) ? 'pointer' : '';
  }
  function onTap(x, y) {
    if (!ov) return;
    const he = hitHelp(x, y);
    if (he) { help(he); return; }
    if (hitWalker(life.player, x, y, 30)) {
      audio.sfx('pop');
      ui.floatText(x, y - 30, `${icon('heart', 22)}¡Hola!`);
      return;
    }
    for (const w of life.npcs) if (hitWalker(w, x, y, 22)) {
      audio.sfx('pop');
      ui.floatText(x, y - 26, icon('heart', 22));
      w.idle = 1.6; w.t = 1; w.tx = w.fx; w.tz = w.fz;
      return;
    }
    if (life.car && life.car.obj.visible && hitWalker(life.car, x, y, 26)) { audio.sfx('horn'); return; }
    const uid = raycastBuilding(x, y);
    const e = uid != null && entries.get(uid);
    if (e) {
      audio.sfx('tap');
      e.anim = { t: 0 };
      if (canHelp(e) && e.help) { help(e); return; }
      const d = def(e.b);
      const s = screenOf(topPos(e, 0.3));
      const lv = e.b.level > 1 && (d.cat === 'casa' || d.cat === 'negocio' || d.id === 'castillo') ? ` · ${icon('star', 16)}${e.b.level}` : '';
      ui.floatText(s.x, s.y, `${ui.esc(d.name)}${lv}`);
    }
  }
  function onKey(ev) {
    const tag = ev.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (tag === 'BUTTON' && (ev.code === 'Enter' || ev.code === 'Space')) return;
    const isDown = ev.type === 'keydown';
    if (ui.hasModal()) { cam?.clearKeys(); return; }
    if (isDown && ev.key === 'Escape') { ev.preventDefault(); goHome(); return; }
    if (!cam) return;
    const map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Equal: 'in', NumpadAdd: 'in', Minus: 'out', NumpadSubtract: 'out' };
    if (map[ev.code]) { cam.key(map[ev.code], isDown); ev.preventDefault(); return; }
    if (!isDown || ev.repeat) return;
    if (ev.code === 'KeyQ') { cam.rotate(-1); audio.sfx('swoosh'); }
    else if (ev.code === 'KeyE') { cam.rotate(1); audio.sfx('swoosh'); }
  }
  function onBlur() { cam?.clearKeys(); }
  function onVisibility() { if (!r) return; if (document.hidden) r.stop(); else r.start(); }

  // =====================================================================
  // Loop
  // =====================================================================
  let syncAcc = 0;
  function frame(dt, t) {
    cam.update(dt);
    world.setCamAngle(cam.angle);
    world.update(dt, t);
    for (const e of entries.values()) {
      e.model?.userData.update?.(dt, t);
      e.scaffold?.userData.update?.(dt, t);
      if (e.anim) {
        e.anim.t += dt;
        const k = Math.min(1, e.anim.t / 0.3), s = Math.sin(k * Math.PI);
        e.root.scale.set(1 + s * 0.06, 1 - s * 0.1, 1 + s * 0.06);
        if (k >= 1) { e.root.scale.set(1, 1, 1); e.anim = null; }
      }
      const live = !!e.anim;
      if (live !== e.live) { e.live = live; batch.markDirty(); }
    }
    batch.update(entries.values());
    life.setCamAngle(cam.angle);
    life.update(dt, t);
    fx.update(dt);
    syncAcc += dt;
    if (syncAcc > 0.5) { syncAcc = 0; syncHelp(); }
    ov.update();
  }

  return {
    async mount(el, params = {}) {
      container = el;
      host = String(params.visit);
      if (params.name) hostName = String(params.name).slice(0, 24);
      container.classList.add('scene-city', 'cv-visit');
      styleEl = document.createElement('style');
      styleEl.id = 'city-visit-style';
      styleEl.textContent = STYLE + VSTYLE;
      document.head.append(styleEl);
      ctx.hud.hide();
      addEventListener('keydown', onKey);
      addEventListener('keyup', onKey);
      addEventListener('blur', onBlur);
      makeLoading(hostName);
      // no esperamos la red acá: el router libera la navegación y "Volver" funciona mientras carga
      load(host).catch(err => { console.warn('[visit]', err); fail(); });
    },
    unmount() {
      disposed = true;
      if (window.__pixelia?.visit?.host === host) delete window.__pixelia.visit;
      timers.forEach(clearTimeout);
      removeEventListener('keydown', onKey);
      removeEventListener('keyup', onKey);
      removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const m of [...modals]) m.close();
      ro?.disconnect();
      ov?.dispose();
      life?.dispose();
      world?.dispose();
      fx?.dispose();
      batch?.dispose();
      entries.clear();
      r?.dispose();
      topEl?.remove(); barEl?.remove(); loadEl?.remove();
      styleEl?.remove();
      ctx.hud.show();
    },
  };
}
