// Elegir la clase de quien lidera (El Quiebre, paso 5b tercera parte; DESIGN-COMBAT.md §16). Lo usan el onboarding
// (un paso entre el personaje y los nombres), la pestaña Progreso de la Bitácora y la ficha del líder en el panel de
// Expedición. Las tarjetas muestran al personaje del jugador con el equipo de cada clase (classLook del 4a).
//
//   classCardsHtml(look, cur, esc)      -> html de la grilla de tarjetas (data-cls); las miniaturas se cargan con
//                                          loadClassThumbs(root) de a poco, para no trabar el primer cuadro
//   openClassPicker(ctx, { first })     -> modal para elegir o cambiar la clase; resuelve con la clase elegida o null
//   initClassNudge(ctx, { idle })       -> en una partida vieja sin clase avisa una vez dónde se elige
//   openKitPicker(ctx, who)             -> (cuarta parte) elegir las activas y la subclase: who 'leader' o una clase de la
//                                          ciudad; resuelve true si cambió algo
import { CLASSES, CLASS_IDS, POOL_UNLOCK, LEADER, unlockedPool, validPicks, availableSubclasses, leaderPerks } from '../combat/classes.js';
import { ABILITIES } from '../combat/combat-data.js';
import { ELEMENTS as STORY_ELEMENTS } from '../story/story-data.js';
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
.kit-pick h3 { display:flex; align-items:baseline; gap:8px; margin:14px 2px 6px; font-size:16px; }
.kit-pick h3:first-child { margin-top:0; }
.kit-pick h3 small { margin-left:auto; font-size:13px; font-weight:700; color:var(--ink-l); }
.kit-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; }
.kit-card { position:relative; display:flex; flex-direction:column; gap:2px; text-align:left; padding:7px 9px 8px; min-height:64px;
  background:var(--surface); color:var(--ink); border:var(--line, 3px) solid var(--edge); border-radius:12px; box-shadow:0 3px 0 var(--shade);
  font-family:inherit; cursor:pointer; }
.kit-card:active:not(:disabled) { transform:translateY(2px); box-shadow:0 1px 0 var(--shade); }
.kit-card.on { background:var(--gold-l); outline:3px solid var(--gold-d); outline-offset:2px; }
.kit-card:disabled { cursor:default; border-style:dashed; border-color:var(--rule); box-shadow:none; color:var(--ink-ll); background:var(--surface-2); }
.kit-card b { font-size:15px; line-height:1.1; padding-right:34px; }
.kit-card small { font-size:12.5px; line-height:1.2; color:var(--ink-l); }
.kit-card:disabled small { color:var(--ink-ll); }
.kit-card .kit-n { position:absolute; top:6px; right:7px; min-width:22px; padding:1px 5px; border-radius:8px; font-size:12px; font-weight:800; text-align:center;
  background:var(--gold-d); color:var(--surface); }
.kit-card .kit-n.off { background:var(--track); color:var(--ink-l); }
.kit-fixed { margin:0 2px 6px; font-size:13px; color:var(--ink-l); }
.kit-fixed b { color:var(--ink); }
.kit-pas { margin:0; padding:0 2px; list-style:none; font-size:13px; color:var(--ink-l); }
.kit-pas li + li { margin-top:3px; }
.kit-pas li b { color:var(--ink); }
.kit-pas li.off { color:var(--ink-ll); }
.kit-pas li.off b { color:var(--ink-l); }
@media (max-width: 420px) { .kit-grid { grid-template-columns:1fr; } }
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
    let alive = true, toKit = false;
    wrap.addEventListener('click', (e) => {
      const c = e.target.closest('.cls-card');
      if (!c) return;
      cur = c.dataset.cls; markClassCard(wrap, cur); audio?.sfx?.('select');
    });
    ui.modal({
      title: L.cls ? 'Clase de quien lidera' : 'Elegí tu clase', icon: 'people', className: 'cls-modal', content: wrap,
      onClose: () => {
        alive = false;
        // "Habilidades": se cierra el selector y se abre el de las activas y la subclase (cuarta parte)
        if (toKit) openKitPicker(ctx, 'leader').then(ch => res(chosen || (ch ? K.classesState(s).leader.cls : null)));
        else res(chosen);
      },
      actions: [L.cls ? { label: 'Habilidades', cls: 'sky', onClick: () => { toKit = true; } } : { label: 'Ahora no', cls: 'ghost' }, { label: 'Elegir', cls: 'primary', onClick: () => {
        if (cur === L.cls) return;
        if (!K.setLeaderClass(cur, s)) { ui.toast('La clase se cambia en la ciudad, sin una salida en curso.', { icon: 'info' }); return false; }
        chosen = cur;
        ui.toast(`Quien lidera ahora es ${CLASSES[cur].name.toLowerCase()}.`, { icon: 'people' });
      } }],
    });
    loadClassThumbs(wrap, () => alive);
  });
}

// ---------- activas y subclase (paso 5b, cuarta parte; DESIGN-COMBAT.md §17) ----------
/** Primer nivel de quien lidera con ese nivel de clase (LEADER.classLevel: 1, 4, 7, … → 1, 2, 3, …). */
const leaderLevelForClass = (cl) => 3 * (Math.max(1, cl) - 1) + 1;
const inCity = (s) => !(s.expedition?.active && !s.expedition.active.ended);
function abilityCard(id, { on = false, n = '', nOff = false, locked = '', esc }) {
  const A = ABILITIES[id] || { name: id, text: '' };
  const cd = A.cd ? ` Recarga ${A.cd}.` : '';
  return `<button class="kit-card${on ? ' on' : ''}" data-ab="${id}" aria-pressed="${on}"${locked ? ' disabled' : ''}>`
    + (n ? `<span class="kit-n${nOff ? ' off' : ''}">${n}</span>` : '')
    + `<b>${esc(A.name)}</b><small>${esc(locked || (A.text + cd))}</small></button>`;
}
const passiveList = (list, esc) => `<ul class="kit-pas">${list.map(p => `<li class="${p.open ? '' : 'off'}" data-pas="${p.id}"><b>${esc(p.name)}</b>: ${esc(p.text)}${p.open ? '' : ` (${esc(p.when)})`}</li>`).join('')}</ul>`;

/**
 * Elegir las activas (2 de las 4 de la clase) y, para quien lidera, la subclase. who: 'leader' o una clase de la
 * ciudad. Se cambia en la ciudad, sin una salida en curso. Resuelve true si se guardó algún cambio.
 * Quien lidera deja elegidas 2 en orden: la 1.ª entra con el primer espacio de clase (nivel 6) y la 2.ª con el segundo
 * (nivel 12). Un integrante lleva siempre 2: cambiar una es tocar otra.
 */
export function openKitPicker(ctx, who = 'leader') {
  ensureClassCss();
  const { ui, audio, store } = ctx;
  const s = store.state, esc = ui.esc;
  const lead = who === 'leader';
  const st = K.classesState(s);
  const cls = lead ? st.leader.cls : who;
  const C = CLASSES[cls];
  if (!C) return lead ? openClassPicker(ctx).then(c => !!c) : Promise.resolve(false);
  const li = lead ? K.leaderInfo(s) : null;
  const mi = lead ? null : K.memberInfo(cls, s);
  const perks = lead ? leaderPerks(li.level) : null;
  const cl = lead ? perks.classLevel : Math.max(1, mi.level);
  const slots = lead ? perks.classSlots : 2;
  const open = unlockedPool(cls, cl);
  const sel = validPicks(cls, cl, lead ? st.leader.picks : st.members[cls].picks, 2);
  const subs = lead ? availableSubclasses(cls, Array.isArray(s.story?.elements) ? s.story.elements : []) : [];
  let sub = lead ? li.sub : null;
  const elName = (id) => STORY_ELEMENTS.find(e => e.id === id)?.name || id;
  return new Promise(res => {
    let changed = false;
    const wrap = ui.h('div.kit-pick');
    const draw = () => {
      let html = '';
      const slotTxt = lead ? (slots >= 2 ? '2 espacios' : slots === 1 ? '1 espacio de 2' : 'sin espacios todavía') : 'elegí 2';
      html += `<h3>Activas de ${esc(C.name.toLowerCase())} <small>${slotTxt}</small></h3>`;
      html += `<p class="kit-fixed">Siempre: <b>${esc(ABILITIES[C.basic]?.name || C.basic)}</b>. ${esc(ABILITIES[C.basic]?.text || '')}</p>`;
      html += `<div class="kit-grid" data-kit="pool">${C.pool.map((id, i) => {
        const k = sel.indexOf(id);
        const need = POOL_UNLOCK[i];
        const locked = open.includes(id) ? '' : lead ? `Se abre en el nivel ${leaderLevelForClass(need)} de quien lidera.` : `Se abre con la clase en nivel ${need}.`;
        return abilityCard(id, { on: k >= 0, n: k < 0 ? '' : lead ? `${k + 1}.ª` : '✓', nOff: lead && k >= slots, locked, esc });
      }).join('')}</div>`;
      if (lead) {
        const [s1, s2] = LEADER.slots.clase;
        html += `<p class="cls-note">${esc(slots >= 2 ? 'Usa las dos elegidas.' : slots === 1 ? `Usa la 1.ª elegida. La 2.ª entra en el nivel ${s2}.` : `La 1.ª activa entra en el nivel ${s1} y la 2.ª en el ${s2}. Ya las podés dejar elegidas.`)}</p>`;
      } else if (open.length <= 2) html += `<p class="cls-note">${esc(`La 3.ª activa se abre con la clase en nivel ${POOL_UNLOCK[2]}.`)}</p>`;
      const pas = C.passives.map(p => ({ ...p, open: cl >= p.lv, when: lead ? `nivel ${leaderLevelForClass(p.lv)} de quien lidera` : `clase en nivel ${p.lv}` }));
      html += '<h3>Pasivas</h3>' + passiveList(pas, esc);
      if (lead) {
        html += `<h3>Subclase <small>${subs.length ? (subs.length > 1 ? `${subs.length} para elegir` : '1 disponible') : 'cerrada'}</small></h3>`;
        if (!subs.length) html += `<p class="cls-note">${esc(`Se abre con el primer elemento que encuentres. Cada elemento trae una subclase de ${C.name.toLowerCase()}.`)}</p>`;
        else {
          html += `<div class="kit-grid" data-kit="sub">${subs.map(S => {
            const abil = S.abilities.map((id, i) => `${ABILITIES[id]?.name || id}${perks.subSlots > i ? '' : ` (nivel ${LEADER.slots.sub[i]})`}`).join(', ');
            const pas2 = `${S.passive.name}${perks.subPassive ? '' : ` (nivel ${LEADER.slots.subPassive})`}`;
            return `<button class="kit-card${S.id === sub ? ' on' : ''}" data-sub="${S.id}" aria-pressed="${S.id === sub}">`
              + `<b>${esc(S.name)}</b><small>${esc(S.text)} Elemento: ${esc(elName(S.element))}.</small><small>${esc(abil)} · ${esc(pas2)}</small></button>`;
          }).join('')}</div>`;
        }
      }
      wrap.innerHTML = html;
    };
    draw();
    wrap.addEventListener('click', (e) => {
      const a = e.target.closest('.kit-card[data-ab]:not(:disabled)'), b = e.target.closest('.kit-card[data-sub]');
      if (a) {
        const id = a.dataset.ab, k = sel.indexOf(id);
        if (k >= 0) { if (lead) sel.splice(k, 1); else return; }
        else if (sel.length < 2) sel.push(id);
        else sel[sel.length - 1] = id;
        audio?.sfx?.('select'); draw();
      } else if (b) { sub = b.dataset.sub; audio?.sfx?.('select'); draw(); }
    });
    const snap = () => JSON.stringify([lead ? st.leader.picks : st.members[cls].picks, lead ? st.leader.sub : null]);
    ui.modal({
      title: lead ? `Habilidades de ${s.player?.name || 'quien lidera'}` : `Habilidades de ${C.name.toLowerCase()}`, icon: 'star', className: 'kit-modal', content: wrap,
      onClose: () => res(changed),
      actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Listo', cls: 'primary', onClick: () => {
        if (!inCity(s)) { ui.toast('Las habilidades se eligen en la ciudad, sin una salida en curso.', { icon: 'info' }); return false; }
        const before = snap();
        if (lead) { K.setLeaderPicks(sel, s); if (sub && sub !== st.leader.sub) K.setSubclass(sub, s); }
        else K.setPicks(cls, sel, s);
        changed = before !== snap();
        if (changed) ui.toast(lead ? 'Quien lidera ya tiene sus habilidades.' : `${C.name}: habilidades elegidas.`, { icon: 'star' });
      } }],
    });
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
