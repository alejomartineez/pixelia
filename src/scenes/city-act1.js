// El Acto 1 en la ciudad (paso 6b): los ecos de noche en el borde de la isla (L6) y el dirigible de la capitana amarrado
// al borde mientras espera el abordaje (act1.js), con su tarjeta para salir a defender.
//   createCityAct1({ ctx, r, container, cam, screenOf, night }) -> { update(dt), hit(x, y) → true si lo tomó, openAbordaje(), dispose() }
// screenOf(v3) → {x, y} en pixeles CSS (el de city.js). night() → ¿es de noche en la ciudad?
// Atajos: ?echo=1 muestra el eco que toca aunque sea de día (capturas); ?abordaje=1 trae el dirigible (act1.js).
import * as THREE from 'three';
import { voxelModel } from '../city/models.js';
import { islandEdgeSpots } from './city-world.js';
import { createEcho } from '../story/echo-fx.js';
import { cityEcho, seeEcho, echoState } from '../story/echoes.js';
import * as A from '../story/act1.js';
import { ENCOUNTERS, ENEMIES } from '../combat/combat-data.js';
import { CLASSES } from '../combat/classes.js';
import { icon } from '../core/icons.js';
import { PAGE_BY_ID } from '../story/story-data.js';

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const Q_ECHO = qs.get('echo') === '1';

/** El dirigible pirata: casco de madera oscura, velas remendadas, góndola con faroles y garfios. */
function drawShip(m) {
  const v = m.v;
  const hull = '#3b2a20', hull_d = '#2a1e17', trim = '#6b4a2e', sail = '#b9ad94', sail_d = '#8f846e', patch = '#7a2f2a';
  // globo alargado
  v.sphere(8, 13, 8, 7.5, 4.2, 4.2, (x, y) => (y < 11 ? sail_d : (x % 5 === 0 ? patch : sail)));
  for (let x = 1; x < 16; x += 3) v.box(x, 12, 4, 1, 1, 9, sail_d);
  // jarcias
  for (const x of [4, 8, 12]) for (const z of [5, 11]) v.box(x, 6, z, 1, 4, 1, '#5a4632');
  // casco
  v.box(2, 3, 5, 13, 3, 7, (x, y) => (y === 5 ? trim : (x + y) % 4 === 0 ? hull_d : hull));
  v.box(0, 4, 6, 2, 2, 5, hull_d); v.box(15, 4, 6, 2, 2, 5, hull);
  v.box(4, 2, 6, 9, 1, 5, hull_d);
  // timón y mástil de popa
  v.box(1, 6, 8, 1, 4, 1, trim);
  // faroles
  m.light.set(2, 6, 5, '#ffb347'); m.light.set(14, 6, 5, '#ffb347'); m.light.set(8, 3, 4, '#ffd166');
  // bandera
  v.box(16, 6, 8, 1, 6, 1, trim); v.box(17, 10, 8, 3, 2, 1, patch);
}

export function createCityAct1({ ctx, r, container, cam, screenOf, night }) {
  const { ui, audio, bus, state } = ctx;
  const root = new THREE.Group();
  root.name = 'act1';
  r.scene.add(root);
  const offs = [];
  let t = 0;

  // ---------- ecos ----------
  const spots = islandEdgeSpots(3, 31).map(s => ({ x: s.x - s.nx * 1.1, z: s.z - s.nz * 1.1, face: Math.atan2(-s.nx, -s.nz) }));
  let echo = null, echoId = null, chime = false;
  function wantEcho() {
    if (!Q_ECHO && !night()) return null;
    return cityEcho(state);
  }
  function syncEcho(dt) {
    const e = wantEcho();
    if (echo && !echo.leaving && (!e || e.id !== echoId)) echo.leave();
    if (!echo && e) {
      echo = createEcho(e.scene, { scale: 1.45, opacity: 0.55, beacon: true });
      const sp = spots[e.spot % spots.length];
      echo.group.position.set(sp.x, 0, sp.z);
      echo.group.rotation.y = sp.face;
      root.add(echo.group);
      echoId = e.id;
      chime = true;
      // la primera vez (todavía no se vio ninguno), una marca lo señala hasta que se lo toca
      if (!Object.keys(echoState(state)).length) showMark();
    }
    // un sonido de vidrio, bajo y lento, cuando aparece (si recién se entra a la ciudad, después de que cargó)
    if (chime && echo && t > 1.5) { chime = false; audio.sfx('echo'); }
    if (echo && echo.update(t) === false) { echo.dispose(); echo = null; echoId = null; }
    syncMark();
  }
  // ---------- la marca del primer eco ----------
  // Una etiqueta chica sobre el eco ("Algo se mueve en el borde"). Si el eco queda fuera de cuadro, se queda en el borde
  // de la pantalla del lado donde está; un clic lleva la cámara hasta él.
  let mark = null;
  function showMark() {
    if (mark) return;
    markStyle();
    mark = document.createElement('button');
    mark.className = 'ec-mark';
    mark.type = 'button';
    mark.innerHTML = `<span class="ec-mark-dot"></span>Algo se mueve en el borde`;
    mark.addEventListener('click', () => {
      if (!echo) return;
      audio.sfx('tap');
      const p = echo.group.position;
      cam?.flyTo(p.x, p.z);
    });
    container.append(mark);
  }
  function hideMark() { mark?.remove(); mark = null; }
  const v3m = new THREE.Vector3();
  function syncMark() {
    if (!mark) return;
    if (!echo || echo.leaving) { hideMark(); return; }
    const s = screenOf(v3m.copy(echo.group.position).setY(2.2));
    const W = container.clientWidth || innerWidth, H = container.clientHeight || innerHeight;
    // centrada en x y apoyada sobre el punto: el margen deja la etiqueta entera adentro de la pantalla
    const mx = (mark.offsetWidth || 220) / 2 + 16, my = 90;
    const x = Math.max(mx, Math.min(W - mx, s.x)), y = Math.max(my + (mark.offsetHeight || 34), Math.min(H - my, s.y));
    const out = x !== s.x || y !== s.y;
    mark.style.left = `${x}px`; mark.style.top = `${y}px`;
    mark.classList.toggle('off', out);
  }
  const v3 = new THREE.Vector3();
  function hitEcho(x, y) {
    if (!echo || echo.leaving) return false;
    const s = screenOf(v3.copy(echo.group.position).setY(0.45));
    return (s.x - x) ** 2 + (s.y - y) ** 2 < 46 * 46;
  }
  function openEcho() {
    const e = seeEcho(echoId);
    echo?.leave();
    hideMark();
    if (!e) return;
    audio.sfx('page');
    const page = e.page ? PAGE_BY_ID[e.page] : null;
    const wrap = ui.h('div.ec-card');
    wrap.append(ui.h('p', { html: `<i>${ui.esc(e.line)}</i>` }));
    wrap.append(ui.h('p.ec-note', { html: page ? `${icon('quest', 16)} Página nueva del diario: <b>${ui.esc(page.title)}</b>.` : `${icon('quest', 16)} Queda anotado en el Diario de la Bitácora.` }));
    ui.modal({ title: e.title, icon: 'moon', content: wrap, className: 'ec-modal' });
  }

  function markStyle() {
    if (document.getElementById('ec-mark-style')) return;
    const st = document.createElement('style');
    st.id = 'ec-mark-style';
    st.textContent = `
.ec-mark { position:absolute; z-index:5; transform:translate(-50%, -100%); display:flex; align-items:center; gap:8px;
  padding:6px 12px 6px 10px; font:inherit; font-size:15px; font-weight:700; color:#e4f6ff; cursor:pointer; white-space:nowrap;
  background:rgba(22,34,52,.82); border:2px solid #a9dcf0; border-radius:999px; box-shadow:0 0 14px rgba(169,220,240,.45), 0 3px 0 rgba(0,0,0,.35);
  animation:ecMarkIn .6s ease-out, ecMarkPulse 2.8s ease-in-out .6s infinite; }
.ec-mark-dot { width:9px; height:9px; border-radius:50%; background:#d8f3ff; box-shadow:0 0 8px #a9dcf0; }
.ec-mark.off { opacity:.9; }
body.no-hud .ec-mark { display:none; }
@keyframes ecMarkIn { from { opacity:0; } to { opacity:1; } }
@keyframes ecMarkPulse { 0%, 100% { box-shadow:0 0 10px rgba(169,220,240,.3), 0 3px 0 rgba(0,0,0,.35); } 50% { box-shadow:0 0 20px rgba(169,220,240,.65), 0 3px 0 rgba(0,0,0,.35); } }
html.reduce-motion .ec-mark { animation:none; }`;
    document.head.append(st);
  }

  // ---------- el dirigible del abordaje ----------
  let ship = null;
  // el borde de adelante a la izquierda con la cámara inicial (ángulo π/4: +z queda abajo a la izquierda de la pantalla),
  // donde no hay tarjetas del HUD; mientras está amarrado, la cámara puede alejarse un poco más (limitBonus)
  const edge = islandEdgeSpots(48, 77).reduce((a, s) => (s.z > a.z ? s : a));
  function syncShip() {
    const st = A.abordajeStatus(state);
    if (st === 'ready' && !ship) {
      ship = new THREE.Group();
      // del tamaño de un dirigible: unas 6 casillas de largo, de costado contra el borde
      const K = 2.7;
      const hullG = voxelModel('act1:dirigible', 18, 16, drawShip);
      hullG.scale.setScalar(K);
      ship.add(hullG);
      // la pasarela de tablones: de la cubierta (y ≈ 6 vóxeles) al pasto del borde
      const out = 5.6, y0 = 0.15, deckY = (6 / 8) * K - 0.1, fromZ = (16 / 2 / 8) * K - 0.2;
      const dz = out - fromZ, dy = deckY + y0, len = Math.hypot(dz, dy);
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, len), new THREE.MeshLambertMaterial({ color: '#6b4a2e' }));
      plank.position.set(0, deckY - dy / 2, fromZ + dz / 2); plank.rotation.x = Math.atan2(dy, dz);
      plank.castShadow = true;
      ship.add(plank);
      ship.position.set(edge.x + edge.nx * out, y0, edge.z + edge.nz * out);
      ship.rotation.y = Math.atan2(-edge.nx, -edge.nz);
      ship.userData.baseY = y0;
      root.add(ship);
    } else if (st !== 'ready' && ship) { ship.removeFromParent(); ship = null; }
    if (ship) ship.position.y = ship.userData.baseY + Math.sin(t * 0.8) * 0.05;
  }
  function hitShip(x, y) {
    if (!ship) return false;
    const s = screenOf(v3.copy(ship.position).setY(ship.position.y + 2.4));
    return (s.x - x) ** 2 + (s.y - y) ** 2 < 120 * 120;
  }
  // botón a la vista mientras el dirigible espera
  const btn = document.createElement('button');
  btn.className = 'btn primary act1-alert';
  btn.innerHTML = `${icon('fight', 18)} Abordaje: defendé el borde`;
  btn.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:14px;z-index:6;display:none;';
  btn.addEventListener('click', () => { audio.sfx('tap'); openAbordaje(); });
  container.append(btn);

  let cardOpen = false;
  function openAbordaje() {
    if (cardOpen || A.abordajeStatus(state) !== 'ready') return;
    cardOpen = true;
    // la cámara se aleja hacia el borde donde está amarrado el dirigible
    if (cam && edge) cam.flyTo(edge.x + edge.nx * 2.5, edge.z + edge.nz * 2.5, 26);
    const enc = ENCOUNTERS[A.ABORDAJE.enc];
    const attempt = A.bossAttempt(state, A.ABORDAJE.enc);
    const party = A.defenders(state);
    const items = A.defenseItems(state);
    const wrap = ui.h('div.ab-card');
    wrap.append(ui.h('p', {}, enc.text));
    wrap.append(ui.h('p', { html: `${icon('people', 16)} Defienden: quien lidera, ${ui.esc(party.map(id => CLASSES[id]?.name || id).join(', '))}.` }));
    if (items.length) wrap.append(ui.h('p', { html: `${icon('hammer', 16)} Del depósito: ${ui.esc(items.join(', '))} (se gastan si se usan).` }));
    wrap.append(ui.h('p', { html: `${icon('fight', 16)} ${ui.esc(ENEMIES.capitana.name)}, un grumete y un tirador. Por la pasarela llegan más hasta que se corta.` }));
    if (attempt > 1) wrap.append(ui.h('p.good', { html: `${icon('up', 16)} Revancha ${attempt - 1}: el grupo con más vida y la capitana más cansada.` }));
    wrap.append(ui.h('p.muted', { html: 'Si se pierde, los piratas siguen en el borde y se puede volver a pelear. No se llevan nada mientras tanto.' }));
    const row = ui.h('div.row', { style: 'gap:8px;justify-content:flex-end;margin-top:8px' });
    const later = ui.h('button.btn.ghost', { onclick: () => m.close() }, 'Ahora no');
    const go = ui.h('button.btn.primary', { 'data-abordaje': 'go', onclick: () => { m.close(); audio.sfx('horn'); A.startAbordaje(ctx); } }, 'Defender el borde');
    row.append(later, go);
    wrap.append(row);
    const m = ui.modal({ title: 'Velas en el cielo', icon: 'fight', content: wrap, className: 'ab-modal', onClose: () => { cardOpen = false; } });
  }
  offs.push(bus.on('abordaje:panel', () => openAbordaje()));
  // después de la escena de llegada, la tarjeta se abre sola
  offs.push(bus.on('story:scene', ({ id } = {}) => { if (id === 'abordaje_1') setTimeout(openAbordaje, 500); }));

  return {
    update(dt) {
      t += dt;
      syncEcho(dt);
      syncShip();
      btn.style.display = ship ? '' : 'none';
    },
    /** Clic en la ciudad: el eco o el dirigible. */
    hit(x, y) {
      if (hitEcho(x, y)) { openEcho(); return true; }
      if (hitShip(x, y)) { audio.sfx('tap'); openAbordaje(); return true; }
      return false;
    },
    hover(x, y) { return hitEcho(x, y) || hitShip(x, y); },
    openAbordaje,
    get echo() { return echo ? { id: echoId, leaving: echo.leaving, pos: echo.group.position.clone() } : null; },
    get ship() { return ship; },
    /** Cuánto más se puede correr la cámara (en casillas): con el dirigible amarrado, hasta verlo entero; con un eco (en el borde de la isla, a ±15), hasta centrarlo. */
    get limitBonus() { return ship ? 7 : echo ? 9 : 0; },
    dispose() {
      offs.forEach(f => f && f());
      echo?.dispose(); echo = null;
      hideMark();
      root.removeFromParent();
      btn.remove();
    },
  };
}
