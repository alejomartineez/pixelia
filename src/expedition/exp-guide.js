// La primera expedición, guiada (plan §E6; paso 6c). La salida corta del tutorial (TUTORIAL_SEED, t5) trae a Vera en un
// panel abajo a la derecha, como la primera pelea: una línea por vez, en el momento en que sirve, y cada una una sola
// vez (state.tutorial.expTips). Lo esencial, sin guiar todo: moverse, juntar, la carga, un imprevisto, el paso que no
// alcanza para volver, el objetivo y cómo volver. Las mismas pistas aparecen en la primera salida normal si en la corta
// no hizo falta alguna (por ejemplo, si no se pisó un imprevisto).
//   const g = createExpGuide({ root, store, run }); g.on('start' | 'loot' | 'hazard' | 'unsafe' | 'objSeen' | 'objDone' | 'cargoFull'); g.dispose()
import { CHARACTERS } from '../story/story-data.js';
import { portrait } from '../story/story-ui.js';

/** when: el momento que la dispara (exp-scene llama a on(when)). */
export const EXP_GUIDE = [
  { id: 'start', when: 'start', text: 'Desde la base, hacé clic en una casilla vecina para avanzar. El número de cada casilla es lo que cuesta en provisiones.' },
  { id: 'loot', when: 'loot', text: 'Lo que juntás va a la carga, arriba a la derecha. Lo que no entra queda en la casilla.' },
  { id: 'hazard', when: 'hazard', text: 'Un imprevisto. Cada opción dice lo que cuesta y qué puede salir mal. Retroceder siempre es gratis.' },
  { id: 'unsafe', when: 'unsafe', text: 'Las casillas en rojo son pasos sin vuelta: con ese paso no te alcanza para volver. El botón de abajo dice cuánto cuesta volver.' },
  { id: 'objSeen', when: 'objSeen', text: 'La bandera marca el objetivo de la zona. Llegá y después volvé: así se cuenta.' },
  { id: 'objDone', when: 'objDone', text: 'Objetivo cumplido. Ahora volvé a la base con el botón de abajo: lo que traés entra a la ciudad.' },
  { id: 'cargoFull', when: 'cargoFull', text: 'La carga está llena. Volver así da una estrella; si querés llevar otra cosa, soltá algo.' },
];
export const EXP_GUIDE_IDS = EXP_GUIDE.map(t => t.id);

const CSS = `
.scene-expedition .ex-guide { position:absolute; z-index:7; right:calc(var(--safe-r, 0px) + 12px); bottom:calc(var(--safe-b, 0px) + 96px);
  width:min(360px, calc(100vw - 24px)); display:grid; grid-template-columns:56px 1fr; gap:10px; padding:10px 12px;
  background:var(--panel); border:var(--line, 3px) solid var(--edge); border-radius:16px; box-shadow:0 4px 0 var(--shade);
  pointer-events:auto; transition:opacity .25s, transform .25s; }
.scene-expedition .ex-guide.gone { opacity:0; transform:translateY(8px); pointer-events:none; }
.scene-expedition .ex-guide canvas { width:56px; height:56px; image-rendering:pixelated; border:2px solid var(--edge); border-radius:10px; background:var(--surface-2); }
.scene-expedition .ex-guide .gw { font-size:15px; color:var(--gold-t); }
.scene-expedition .ex-guide .gw small { color:var(--ink-l); }
.scene-expedition .ex-guide p { margin:4px 0 6px; font-size:15px; line-height:1.3; color:var(--ink); }
.scene-expedition .ex-guide .gf { display:flex; justify-content:flex-end; }
/* con una tarjeta de decisión abierta, la pista no la tapa: va arriba de todo (pantalla angosta: la tarjeta deja libre el 28 % de arriba) o a la izquierda de la tarjeta */
.scene-expedition:has(.ex-sheet .ex-card.in) .ex-guide { bottom:auto; top:calc(var(--safe-t, 0px) + 8px); z-index:8; }
@media (min-width: 900px) {
  .scene-expedition:has(.ex-sheet .ex-card.in) .ex-guide { top:auto; bottom:calc(var(--safe-b, 0px) + 16px); right:calc(var(--safe-r, 0px) + 16px + 440px + 12px); }
}
`;
let styleEl = null;
function injectStyle() {
  if (styleEl?.isConnected) return;
  styleEl = document.createElement('style');
  styleEl.id = 'ex-guide-style';
  styleEl.textContent = CSS;
  document.head.append(styleEl);
}

/** ¿Esta salida va guiada? La corta del tutorial, o una normal mientras falten pistas (nunca la Expedición del día). */
export function guidedRun(run, state) {
  if (!run || run.prototype || run.city?.daily) return false;
  if (run.city?.tutorial) return true;
  const seen = state.tutorial?.expTips || {};
  return run.kind === 'normal' && !!seen.start && EXP_GUIDE_IDS.some(id => !seen[id]) && (state.stats?.expeditions || 0) <= 2;
}

export function createExpGuide({ root, store, run }) {
  injectStyle();
  const el = document.createElement('div');
  el.className = 'ex-guide gone';
  el.setAttribute('role', 'status');
  root.append(el);
  let timer = 0;
  const tips = () => { const st = store.state; st.tutorial ||= {}; return (st.tutorial.expTips ||= {}); };
  function show(text, who = 'cartografa') {
    const ch = CHARACTERS[who] || {};
    el.innerHTML = `<div class="gp"></div><div><div class="gw">${ch.name || ''}${ch.title ? ` <small>· ${ch.title}</small>` : ''}</div>
      <p></p><div class="gf"><button class="btn ghost small" data-a="ok">Entendido</button></div></div>`;
    el.querySelector('p').textContent = text;
    const face = portrait(who);
    if (face) el.querySelector('.gp').append(face);
    el.querySelector('[data-a="ok"]').onclick = () => hide();
    el.classList.remove('gone');
    clearTimeout(timer);
    timer = setTimeout(hide, 14000);
  }
  function hide() { el.classList.add('gone'); clearTimeout(timer); }
  const api = {
    get active() { return guidedRun(run, store.state); },
    /** Muestra la pista de ese momento si esta salida va guiada y todavía no se vio. Devuelve true si la mostró. */
    on(when) {
      if (!guidedRun(run, store.state)) return false;
      const t = tips();
      const g = EXP_GUIDE.find(x => x.when === when && !t[x.id]);
      if (!g) return false;
      t[g.id] = Date.now();
      store.markDirty();
      show(g.text);
      return true;
    },
    get text() { return el.classList.contains('gone') ? '' : el.querySelector('p')?.textContent || ''; },
    hide,
    dispose() { clearTimeout(timer); el.remove(); },
  };
  return api;
}
