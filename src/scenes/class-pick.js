// Elegir la clase de quien lidera (El Quiebre, paso 5b tercera parte; DESIGN-COMBAT.md §16). Lo usan el onboarding
// (un paso entre el personaje y los nombres), la pestaña Progreso de la Bitácora y la ficha del líder en el panel de
// Expedición. Las tarjetas muestran al personaje del jugador con el equipo de cada clase (classLook del 4a).
//
//   classCardsHtml(look, cur, esc)      -> html de la grilla de tarjetas (data-cls); las miniaturas se cargan con
//                                          loadClassThumbs(root) de a poco, para no trabar el primer cuadro
//   openClassPicker(ctx, { first })     -> modal para elegir o cambiar la clase; resuelve con la clase elegida o null
//   initClassNudge(ctx, { idle })       -> en una partida vieja sin clase avisa una vez dónde se elige
import { CLASSES, CLASS_IDS } from '../combat/classes.js';
import * as K from '../core/classes.js';
import { normalizeLook } from '../avatar/avatar.js';
import { thumbnail, hasThumb } from '../avatar/wardrobe-stage.js';

/** Cómo se presenta cada clase al elegirla: una línea propia y el equipo que lleva. */
export const CLASS_PITCH = {
  guerrero: { line: 'Va adelante y aguanta los golpes por el resto.', kit: 'Cota, espada y casco' },
  cazador: { line: 'Pega de lejos, marca al enemigo y ve antes los peligros.', kit: 'Cuero, arco y capucha' },
  forjador: { line: 'Levanta barreras, arma trampas y abre camino donde no lo hay.', kit: 'Delantal y martillo' },
  curandero: { line: 'Cura, protege y mantiene alto el ánimo del grupo.', kit: 'Hábito y bolso de remedios' },
  monje: { line: 'Se mueve rápido, empuja y guía al grupo por el mejor paso.', kit: 'Hábito y bastón' },
  saqueador: { line: 'Golpea por la espalda y vuelve con la mochila más llena.', kit: 'Cuero, hacha y pañuelo' },
};
export const DEFAULT_CLASS = 'guerrero';

const CSS = `
.cls-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }
.cls-card { position:relative; display:grid; grid-template-columns:56px 1fr; gap:2px 8px; align-items:start; text-align:left; padding:6px 8px 8px 6px;
  background:var(--surface); color:var(--ink); border:var(--line, 3px) solid var(--edge); border-radius:12px; box-shadow:0 3px 0 var(--shade);
  font-family:inherit; cursor:pointer; }
.cls-card:active { transform:translateY(2px); box-shadow:0 1px 0 var(--shade); }
.cls-card.on { background:var(--gold-l); outline:3px solid var(--gold-d); outline-offset:2px; }
.cls-card .th { grid-row:span 3; width:56px; height:56px; border-radius:10px; opacity:0; transition:opacity .2s;
  background:radial-gradient(circle at 50% 42%, var(--surface) 0 38%, var(--surface-2) 72%); }
.cls-card .th.ok { opacity:1; }
.cls-card b { font-size:16px; line-height:1.1; }
.cls-card small { font-size:12.5px; line-height:1.2; color:var(--ink-l); }
.cls-card .cls-kit { color:var(--ink-ll); font-size:12px; }
.cls-note { margin:10px 2px 0; font-size:13px; color:var(--ink-l); }
@media (max-width: 420px) { .cls-grid { grid-template-columns:1fr; } }
`;
let styled = false;
export function ensureClassCss() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'class-pick-style';
  st.textContent = CSS;
  document.head.append(st);
}

const thumbSpec = (look, cls) => ({ type: 'avatar', look: normalizeLook(look), frame: 'tallbody', cls });

/** Grilla de tarjetas: una por clase, con el personaje del jugador vestido de esa clase. */
export function classCardsHtml(look, cur, esc) {
  ensureClassCss();
  return `<div class="cls-grid">${CLASS_IDS.map(id => {
    const C = CLASSES[id], P = CLASS_PITCH[id] || {};
    const spec = thumbSpec(look, id), ok = hasThumb(spec);
    return `<button class="cls-card${id === cur ? ' on' : ''}" data-cls="${id}" aria-pressed="${id === cur}">`
      + `<img class="th${ok ? ' ok' : ''}" alt="" draggable="false" ${ok ? `src="${thumbnail(spec)}"` : ''} data-k="${encodeURIComponent(JSON.stringify(spec))}">`
      + `<b>${esc(C.name)}</b><small>${esc(P.line || C.combat)}</small><small class="cls-kit">${esc(P.kit || '')}</small></button>`;
  }).join('')}</div>`;
}
/** Carga las miniaturas que faltan, unas pocas por cuadro. alive(): si la pantalla sigue abierta. */
export function loadClassThumbs(root, alive = () => true) {
  const queue = [...root.querySelectorAll('.cls-card img.th:not(.ok)')];
  const step = () => {
    if (!alive()) return;
    const t0 = performance.now();
    while (queue.length && performance.now() - t0 < 12) {
      const img = queue.shift();
      if (!img.isConnected) continue;
      try { img.src = thumbnail(JSON.parse(decodeURIComponent(img.dataset.k))); img.classList.add('ok'); } catch (e) { console.warn('[clase] miniatura', e); }
    }
    if (queue.length) requestAnimationFrame(step);
  };
  if (queue.length) requestAnimationFrame(step);
}
/** Marca la tarjeta elegida dentro de root. */
export function markClassCard(root, cls) {
  for (const b of root.querySelectorAll('.cls-card')) { const on = b.dataset.cls === cls; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
}

/**
 * Modal para elegir (first) o cambiar la clase de quien lidera, en la ciudad. Resuelve con la clase o null.
 * Cambiar no toca el nivel del líder: solo vuelve a cero la subclase y las activas elegidas.
 */
export function openClassPicker(ctx, { first = false } = {}) {
  const { ui, audio, store } = ctx;
  const s = store.state;
  const L = K.classesState(s).leader;
  let cur = L.cls || DEFAULT_CLASS;
  return new Promise(res => {
    let chosen = null;
    const wrap = ui.h('div.cls-pick');
    const note = first || !L.cls ? 'La clase cambia cómo pelea y cómo explora quien lidera. Después la podés cambiar desde la Bitácora.'
      : 'Cambiar de clase no baja el nivel de quien lidera. La subclase y las habilidades elegidas se vuelven a elegir.';
    wrap.innerHTML = classCardsHtml(s.avatar || {}, cur, ui.esc) + `<p class="cls-note">${ui.esc(note)}</p>`;
    let alive = true;
    wrap.addEventListener('click', (e) => {
      const c = e.target.closest('.cls-card');
      if (!c) return;
      cur = c.dataset.cls; markClassCard(wrap, cur); audio?.sfx?.('select');
    });
    ui.modal({
      title: L.cls ? 'Clase de quien lidera' : 'Elegí tu clase', icon: 'people', className: 'cls-modal', content: wrap,
      onClose: () => { alive = false; res(chosen); },
      actions: [{ label: 'Ahora no', cls: 'ghost' }, { label: 'Elegir', cls: 'primary', onClick: () => {
        if (cur === L.cls) return;
        if (!K.setLeaderClass(cur, s)) { ui.toast('La clase se cambia en la ciudad, sin una salida en curso.', { icon: 'info' }); return false; }
        chosen = cur;
        ui.toast(`Quien lidera ahora es ${CLASSES[cur].name.toLowerCase()}.`, { icon: 'people' });
      } }],
    });
    loadClassThumbs(wrap, () => alive);
  });
}

let nudged = false;
/** Partida vieja sin clase: un aviso, una vez por sesión, cuando la ciudad está tranquila. */
export function initClassNudge(ctx, { idle = () => true } = {}) {
  if (nudged) return;
  const tick = setInterval(() => {
    const s = ctx.store.state;
    if (!s.onboarded) return;
    if (K.classesState(s).leader.cls) { clearInterval(tick); return; }
    if (!idle() || document.querySelector('.st-card:not(.bark), .st-epic, .modal')) return;
    clearInterval(tick);
    nudged = true;
    ctx.ui.toast('Ya se puede elegir la clase de quien lidera: Bitácora, pestaña Progreso.', { icon: 'people' });
  }, 4000);
}
