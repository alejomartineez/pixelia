// Pantalla de la elección de extracción en la mina sellada (PLAN-QUIEBRE L1). Tres opciones con lo que dan, lo que
// cuestan y una línea de Vera; arriba, la Grieta de hoy y lo que hace. La primera vez no se puede cerrar sin elegir
// (la galería está abierta); al volver a la mina sí, y queda la extracción de antes.
// La lógica vive en src/core/raiz.js; acá solo se muestra y se elige.
import { EXTRACTION, EXTRACTION_IDS, raizState, syncGrieta, chooseExtraction, grietaText, grietaPower, grietaExtra } from '../core/raiz.js';
import { portrait } from './story-ui.js';
import { icon } from '../core/icons.js';
import { store } from '../core/state.js';

const CSS = `
.rz-choice { width: min(860px, 100%); }
.rz-choice .rz-top { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
.rz-choice .rz-top p { margin: 0; color: var(--ink-l); font-size: 16px; line-height: 1.35; }
.rz-choice .rz-meter { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: 15px; color: var(--ink-l); }
.rz-choice .rz-meter .rz-bar { flex: 1; height: 10px; border: 2px solid var(--edge); border-radius: 6px; background: var(--track); overflow: hidden; }
.rz-choice .rz-meter .rz-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--gold-d), var(--coral)); }
.rz-choice .rz-opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 640px) { .rz-choice .rz-opts { grid-template-columns: 1fr; } }
.rz-choice .rz-opt { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--surface); border: 2px solid var(--edge);
  border-radius: 14px; box-shadow: 0 3px 0 var(--shade); }
.rz-choice .rz-opt.now { box-shadow: inset 0 0 0 2px var(--gold-d), 0 3px 0 var(--shade); }
.rz-choice .rz-opt h3 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 20px; color: var(--gold-t); }
.rz-choice .rz-opt h3 small { margin-left: auto; font-size: 12px; color: var(--ink-l); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.rz-choice .rz-opt .rz-row { font-size: 15px; line-height: 1.3; white-space: normal; overflow-wrap: anywhere; }
.rz-choice .rz-opt .rz-row b { color: var(--ink); }
.rz-choice .rz-opt .rz-row.cost { color: var(--ink-l); }
.rz-choice .rz-opt blockquote { margin: 2px 0 4px; padding: 6px 8px; border-left: 3px solid var(--gold-d); background: var(--surface-2);
  font-size: 14px; font-style: italic; color: var(--ink-l); border-radius: 0 8px 8px 0; }
.rz-choice .rz-opt .btn { margin-top: auto; }
.rz-choice canvas.rz-face { width: 48px; height: 48px; image-rendering: pixelated; border: 2px solid var(--edge); border-radius: 10px; background: var(--surface-2); flex: none; }
.rz-choice .rz-note { margin: 10px 0 0; font-size: 14px; color: var(--ink-ll); text-align: center; }
`;
let styleEl = null;
function injectStyle() {
  if (styleEl?.isConnected) return;
  styleEl = document.createElement('style');
  styleEl.id = 'rz-style';
  styleEl.textContent = CSS;
  document.head.append(styleEl);
}

/** Lo que cada opción hace con la Grieta, en números (para que el costo esté a la vista). */
function costLine(id, g, cur) {
  const E = EXTRACTION[id];
  const up = !cur || E.mult > EXTRACTION[cur].mult;
  const now = up && E.add ? Math.min(100, g + E.add) : g;
  const parts = [];
  if (up && E.add) parts.push(`Grieta +${E.add} al elegir`);
  if (E.perDay) parts.push(`+${String(E.perDay).replace('.', ',')} por día${E.cap < 100 ? ` hasta ${E.cap}` : ''}`);
  if (!parts.length) parts.push('la Grieta no sube');
  const in30 = Math.min(Math.max(now, E.cap ? Math.min(E.cap, now + E.perDay * 30) : now), 100);
  const fx = [];
  if (grietaPower(in30) > grietaPower(g)) fx.push(`amenazas +${grietaPower(in30)} de fuerza`);
  if (grietaExtra(in30) > grietaExtra(g)) fx.push(`${grietaExtra(in30)} amenaza${grietaExtra(in30) > 1 ? 's' : ''} más por temporada`);
  return `${parts.join(', ')}. En 30 días: ${Math.round(in30)}${fx.length ? ` (${fx.join(', ')})` : ''}.`;
}

/**
 * Abre la elección. Devuelve una promesa con el id elegido (o null si se cerró al volver a la mina).
 * opts.first: la primera vez (no se puede cerrar).
 */
export function openExtraction(ctx, { first = false } = {}) {
  injectStyle();
  const { ui } = ctx;
  const { h, esc } = ui;
  const r = raizState(ctx.state);
  const g = syncGrieta(ctx.state);
  const cur = r.mode;
  return new Promise(res => {
    let picked = null;
    const wrap = h('div');
    const top = h('div.rz-top');
    const face = portrait('cartografa', 'rz-face');
    if (face) top.append(face);
    top.append(h('p', { html: first
      ? 'El Núcleo de Raíz late en la roca. Se le puede sacar mucho o poco. <b>Vos también podés repetir el Quiebre.</b>'
      : `Volviste a la mina. Hoy la Raíz está <b>${esc(EXTRACTION[cur]?.name.toLowerCase() || 'sin tocar')}</b>. Se puede subir o bajar.` }));
    wrap.append(top);
    wrap.append(h('div.rz-meter', { html: `${icon('bolt', 16)}<span>Grieta ${Math.round(g)}/100</span><span class="rz-bar"><i style="width:${Math.max(2, g)}%"></i></span><span>${esc(grietaText(g))}</span>` }));
    const opts = h('div.rz-opts');
    for (const id of EXTRACTION_IDS) {
      const E = EXTRACTION[id];
      const card = h('div.rz-opt' + (id === cur ? '.now' : ''), { 'data-raiz': id });
      card.append(h('h3', { html: `${icon(E.ic, 20)}${esc(E.name)}${id === cur ? '<small>Ahora</small>' : ''}` }));
      card.append(h('div.rz-row', { html: `<b>Da:</b> ${esc(E.gives)}` }));
      card.append(h('div.rz-row.cost', { html: `<b>Cuesta:</b> ${esc(E.costs)}` }));
      card.append(h('div.rz-row', { html: esc(costLine(id, g, cur)) }));
      card.append(h('blockquote', {}, `Vera: "${E.vera}"`));
      card.append(h('button.btn.' + (id === 'sellar' ? 'ghost' : id === 'medida' ? 'mint' : 'primary'), {
        html: id === cur ? 'Dejarla así' : 'Elegir',
        onclick: () => {
          const out = chooseExtraction(id, ctx.state);
          if (out.error) { ctx.audio.sfx('error'); ui.toast(out.error, { icon: 'info' }); return; }
          picked = id;
          ctx.audio.sfx(id === 'exprimir' ? 'build' : 'done');
          m.close();
        },
      }));
      opts.append(card);
    }
    wrap.append(opts);
    wrap.append(h('p.rz-note', {}, 'Ninguna decisión es para siempre: se puede volver a la mina y la Grieta se cose con obras de Raíz en el Invernadero.'));
    const m = ui.modal({ title: first ? 'El Núcleo de Raíz' : 'La mina sellada', icon: '🌱', content: wrap, closable: !first, className: 'rz-choice',
      onClose: () => {
        // al cerrar sin elegir (solo al volver), la elección queda cerrada y sigue la extracción de antes
        if (!picked && !first) { r.pending = false; store.markDirty(); }
        res(picked);
      } });
  });
}
