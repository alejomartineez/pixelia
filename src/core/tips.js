// Pistas contextuales (plan §H): al dejar el mouse sobre algo con data-tip aparece un cartel corto con qué es y de
// dónde sale. Solo con mouse (en pantallas táctiles no hay hover). data-tip lleva HTML simple; data-tip-title, un título.
// Un solo cartel para todo el juego, debajo de los modales si el elemento está en el HUD y encima si está en un modal.
let el = null, timer = 0, cur = null;

const CSS = `
#tip-pop { position: fixed; z-index: 75; max-width: 260px; padding: 7px 10px 8px; pointer-events: none; opacity: 0; transform: translateY(4px);
  background: var(--panel); color: var(--ink); border: 2px solid var(--edge); border-radius: 10px; box-shadow: 0 0 0 2px var(--metal) inset, 0 4px 0 var(--shade);
  font-size: 14px; line-height: 1.25; transition: opacity .12s, transform .12s; }
#tip-pop.show { opacity: 1; transform: none; }
#tip-pop b { display: block; color: var(--gold-t); font-size: 15px; margin-bottom: 2px; }
#tip-pop small { color: var(--ink-l); }
`;
function ensure() {
  if (el) return el;
  const st = document.createElement('style');
  st.id = 'tip-style';
  st.textContent = CSS;
  document.head.append(st);
  el = document.createElement('div');
  el.id = 'tip-pop';
  el.setAttribute('role', 'tooltip');
  document.body.append(el);
  return el;
}
function place(target) {
  const r = target.getBoundingClientRect();
  const t = el.getBoundingClientRect();
  let x = r.left + r.width / 2 - t.width / 2;
  let y = r.bottom + 8;
  if (y + t.height > innerHeight - 6) y = r.top - t.height - 8;
  x = Math.max(6, Math.min(innerWidth - t.width - 6, x));
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(Math.max(6, y)) + 'px';
}
function show(target) {
  ensure();
  const title = target.getAttribute('data-tip-title');
  el.innerHTML = (title ? `<b>${title}</b>` : '') + target.getAttribute('data-tip');
  el.classList.add('show');
  place(target);
}
export function hideTip() { clearTimeout(timer); cur = null; el?.classList.remove('show'); }

/** Una vez al arrancar. */
export function initTips() {
  addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target.closest?.('[data-tip]');
    if (t === cur) return;
    hideTip();
    if (!t) return;
    cur = t;
    timer = setTimeout(() => { if (cur === t && t.isConnected) show(t); }, 350);
  }, { passive: true });
  addEventListener('pointerdown', hideTip, { passive: true, capture: true });
  addEventListener('wheel', hideTip, { passive: true });
  addEventListener('keydown', hideTip, { passive: true });
}
