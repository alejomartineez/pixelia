// Paneles de Ajustes (por pestañas) y Cómo jugar.
import { icon } from '../core/icons.js';
import { OUTFIT_COLORS } from '../core/data.js';
import { openShell, askConfirm, art, flagArt, chestArt } from './panels-common.js';
import { setSetting, WIN_RES } from '../core/settings.js';
import { isDesktop, isMac, monitorInfo } from '../core/desktop.js';
import { KEY_ACTIONS, codeFor, keyLabel, assignKey } from '../core/keys.js';

const isStandalone = () => !!(navigator.standalone || matchMedia?.('(display-mode: standalone)').matches);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Pestañas de Ajustes (docs/PLAN-QUIEBRE.md §G). Cada control escribe con setSetting (src/core/settings.js), que
// guarda, aplica en vivo y avisa por el bus ('settings:changed').
const TABS = [
  ['gfx', 'sparkle', 'Gráficos'],
  ['screen', 'home', 'Pantalla'],
  ['sound', 'music', 'Sonido'],
  ['game', 'castle', 'Juego'],
  ['keys', 'key', 'Controles'],
  ['a11y', 'smile', 'Accesibilidad'],
  ['save', 'save', 'Partida'],
];
let lastTab = 'gfx';

export function openSettings(ctx, p = {}) {
  const sh = openShell(ctx, 'settings', { title: 'Ajustes', ic: 'gear', sheet: true, className: 'pnl-settings set-panel' });
  if (!sh) return;
  const { ui, audio } = ctx;
  const { h } = ui;
  const s = () => ctx.state.settings;
  const set = (patch) => setSetting(patch);
  const tabs = h('nav.set-tabs', { role: 'tablist', 'aria-label': 'Secciones de Ajustes' });
  const pane = h('div.set-pane', { role: 'tabpanel' });
  sh.body.append(h('div.set-wrap', {}, tabs, pane));
  let tab = TABS.some(t => t[0] === p.tab) ? p.tab : lastTab;

  // ---------- piezas ----------
  const section = (ic, title, ...children) => h('section.card.pnl-sec', {}, h('h3.pnl-sec-title', { html: `${icon(ic, 24)}<span>${title}</span>` }), ...children);
  const hint = (t) => h('p.small.muted.set-hint', { html: t });
  /** Fila: etiqueta (y ayuda) a la izquierda, control a la derecha (abajo en pantallas angostas). */
  const row = (label, control, help) => h('div.set-row', {}, h('div.set-lbl', {}, h('b', {}, label), help ? h('small', { html: help }) : null), control);
  /** Opción de a una. options: [[valor, texto]]. */
  function seg(key, options, { onPick, disabled = [] } = {}) {
    const el = h('div.a11y-seg.set-seg', { role: 'radiogroup', 'data-key': key });
    const paint = () => { for (const b of el.children) { const on = String(s()[key]) === b.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); } };
    for (const [v, txt] of options) {
      el.append(h('button.a11y-opt', { role: 'radio', 'data-v': String(v), html: txt, disabled: disabled.includes(v) || undefined, onclick: () => {
        if (s()[key] === v) return;
        audio.sfx('select');
        if (onPick) onPick(v); else set({ [key]: v });
        paint();
      } }));
    }
    paint();
    el.paint = paint;
    return el;
  }
  /** Interruptor sí/no. */
  function sw(key, label, help, { onChange } = {}) {
    const btn = h('button.pnl-toggle.set-switch' + (key === 'telemetry' ? '.a11y-stats' : ''), { role: 'switch', 'data-key': key });
    const paint = () => {
      const on = !!s()[key];
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.classList.toggle('on', on);
      btn.innerHTML = `<span class="pnl-toggle-lbl"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</span><span class="pnl-switch"><i></i></span>`;
    };
    btn.onclick = () => {
      const next = !s()[key];
      set({ [key]: next });
      onChange?.(next);
      audio.sfx('select');
      paint();
    };
    paint();
    return btn;
  }
  /** Deslizador. live: aplica mientras se arrastra (si no, al soltar). */
  function slider(key, { min, max, step, fmt, scale = 1, live = true, onDone }) {
    const val = () => Math.round(s()[key] * scale);
    const out = h('output.set-val', {}, fmt(val()));
    const input = h('input.set-range', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(val()), 'data-key': key, 'aria-valuetext': fmt(val()) });
    const fill = () => input.style.setProperty('--p', ((input.value - min) / (max - min) * 100).toFixed(1) + '%');
    const apply = () => { set({ [key]: Number(input.value) / scale }); };
    input.addEventListener('input', () => { out.textContent = fmt(Number(input.value)); input.setAttribute('aria-valuetext', out.textContent); fill(); if (live) apply(); });
    input.addEventListener('change', () => { if (!live) apply(); onDone?.(); });
    input.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
    fill();
    return h('div.set-slider', {}, input, out);
  }
  const pct = v => `${v} %`;

  // ---------- pestañas ----------
  const PANES = {
    gfx() {
      const presetSeg = seg('gfxPreset', [['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta'], ['custom', 'Personalizada']],
        { disabled: ['custom'], onPick: v => { set({ gfxPreset: v }); show('gfx'); } });
      const auto = s().gfxPreset === 'auto';
      return [
        section('sparkle', 'Calidad',
          row('Preset', presetSeg, auto ? 'Todavía no elegiste: en el primer rato en la ciudad medimos tu compu y elegimos uno.' : 'Cambia todo lo de abajo de una vez.'),
          row('Escala de resolución', slider('renderScale', { min: 50, max: 200, step: 10, fmt: pct, live: false, onDone: () => show('gfx') }),
            'Pixeles de dibujo por pixel de pantalla. Con 200 % se ve más nítido; con menos, la placa de video trabaja menos.'),
          sw('aa', 'Suavizado de bordes', 'Antialias: bordes diagonales sin serrucho.', { onChange: () => show('gfx') }),
          sw('shadows', 'Sombras', null, { onChange: () => show('gfx') }),
          sw('outline', 'Contorno tinta', 'La línea oscura alrededor de cada cosa: es parte del estilo del juego.', { onChange: () => show('gfx') }),
          row('Partículas', seg('particles', [['few', 'Pocas'], ['normal', 'Normales'], ['many', 'Muchas']], { onPick: v => { set({ particles: v }); show('gfx'); } }), 'Confeti, polvo y brillos.'),
        ),
        section('clock', 'Cuadros por segundo',
          row('Límite de FPS', seg('maxFps', [[30, '30'], [60, '60'], [120, '120'], [144, '144'], [240, '240'], [0, 'Sin límite']], { onPick: v => set({ maxFps: v }) }),
            'Con un monitor rápido, más FPS se ve más suave. Con 30 la compu trabaja menos.'),
          row('Con la ventana atrás', seg('bgFps', [[10, '10'], [15, '15'], [30, '30'], [60, '60']]), 'Tope de FPS cuando estás en otra ventana.'),
          sw('showFps', 'Mostrar contador de FPS', 'Un número discreto arriba a la izquierda.'),
          hint('La sincronización vertical la maneja siempre el sistema, así que nunca vas a ver cortes en la imagen.'),
        ),
      ];
    },
    screen() {
      const out = [];
      const modes = isDesktop ? [['window', 'Ventana'], ['fullscreen', 'Pantalla completa'], ['borderless', 'Sin bordes']] : [['window', 'Ventana'], ['fullscreen', 'Pantalla completa']];
      const resBox = h('div.set-resbox');
      const modeSeg = seg('winMode', modes, { onPick: v => { set({ winMode: v }); paintRes(); } });
      function paintRes() {
        resBox.innerHTML = '';
        if (!isDesktop || s().winMode !== 'window') return;
        monitorInfo().then(m => {
          if (sh.closed) return;
          const fits = WIN_RES.filter(([w, hh]) => !m || (w <= m.aw && hh <= m.ah));
          const opts = [['auto', 'Automática'], ...fits.map(([w, hh]) => [`${w}x${hh}`, `${w}×${hh}`])];
          resBox.innerHTML = '';
          resBox.append(row('Resolución de la ventana', seg('winRes', opts), m ? `Tu monitor: ${m.w}×${m.h}. Automática ajusta la ventana al abrir el juego.` : null));
        });
      }
      paintRes();
      const fsKey = isMac ? 'Ctrl + Cmd + F' : 'F11';
      out.push(section('home', 'Ventana',
        row('Modo', modeSeg, isDesktop ? `<kbd>${fsKey}</kbd> pasa a pantalla completa y vuelve. Sin bordes ocupa todo el monitor sin cambiar de modo.` : 'En el navegador, Esc sale de la pantalla completa.'),
        resBox,
      ));
      out.push(section('sparkle', 'Interfaz',
        row('Escala de la interfaz', slider('uiScale', { min: 80, max: 150, step: 5, fmt: pct, live: false }), 'Agranda o achica botones, menús y textos. En monitores grandes, 120 % o más se lee mejor.'),
      ));
      return out;
    },
    sound() {
      const vol = (key, label, help, test) => row(label, slider(key, { min: 0, max: 100, step: 5, scale: 100, fmt: pct, onDone: test }), help);
      return [section('music', 'Volumen',
        vol('volMaster', 'General', null, () => audio.sfx('select')),
        vol('volMusic', 'Música', null),
        vol('volSfx', 'Efectos', 'Monedas, botones, obras.', () => audio.sfx('coin')),
        vol('volAmb', 'Ambiente', 'Brisa y pájaros en la ciudad, viento en la expedición.'),
        vol('volUi', 'Interfaz', 'Clics, menús y pestañas.', () => audio.sfx('select')),
        sw('muteBg', 'Silenciar en segundo plano', 'Cuando la ventana del juego queda atrás.'),
      )];
    },
    game() {
      return [
        section('people', 'Vos y tu ciudad',
          nameField('Nombre de tu personaje', 'people', () => ctx.state.player.name, v => { ctx.state.player.name = v; }, 'Pixelín', 16),
          nameField('Nombre de la ciudad', 'castle', () => ctx.state.player.cityName, v => { ctx.state.player.cityName = v; }, 'Pixelia', 18),
          h('div.pnl-acc-btns', {},
            h('button.btn.primary.block', { html: `${icon('dress', 20)} Cambiar personaje`, onclick: () => { sh.close(); ctx.router.go('wardrobe', { tab: 'type' }); } }),
            h('button.btn.second.block', { html: `${icon('palette', 20)} Estilo de la ciudad`, onclick: () => { sh.close(); import('../city/themes-ui.js').then(m => m.openThemePicker(ctx)).catch(e => console.warn('[ajustes] temas', e)); } })),
        ),
        flagSection(),
        section('quest', 'Historia y combate',
          row('Velocidad de los diálogos', seg('textSpeed', [['slow', 'Lenta'], ['normal', 'Normal'], ['fast', 'Rápida'], ['instant', 'Al instante']])),
          sw('skipSeen', 'Saltear las cinemáticas ya vistas', 'Igual las podés volver a ver desde la Bitácora.'),
          row('Velocidad de las animaciones del combate', seg('combatSpeed', [[1, 'x1'], [2, 'x2'], [3, 'x3']])),
          sw('confirmEnd', 'Confirmar el fin de turno', 'Pregunta antes si a alguien del grupo le quedan acciones.'),
          sw('hints', 'Pistas de la guía', 'La flecha que señala el próximo paso de la misión.'),
        ),
        section('rotate', 'Cámara',
          row('Velocidad de la cámara', slider('camSpeed', { min: 50, max: 200, step: 10, scale: 100, fmt: pct }), 'Con el teclado y con los bordes.'),
          sw('edgeScroll', 'Mover la cámara con los bordes', 'Llevá el mouse al borde de la ventana para desplazarte por la ciudad.'),
        ),
      ];
    },
    keys() {
      const list = h('div.set-keys');
      let listening = null;
      function paint() {
        list.innerHTML = '';
        let group = null;
        for (const a of KEY_ACTIONS) {
          if (a.group !== group) { group = a.group; list.append(h('h4.set-kgroup', {}, group)); }
          const b = h('button.set-key', { 'data-act': a.id, 'aria-label': `${a.label}: ${keyLabel(codeFor(a.id))}. Clic para cambiar` }, h('kbd', {}, keyLabel(codeFor(a.id))));
          b.onclick = () => listen(a, b);
          list.append(h('div.set-krow', {}, h('span', {}, a.label), b));
        }
      }
      function listen(a, b) {
        stop();
        audio.sfx('tap');
        b.classList.add('wait');
        b.innerHTML = '<kbd>Apretá una tecla…</kbd>';
        const onKey = (e) => {
          e.preventDefault(); e.stopImmediatePropagation();
          if (e.key === 'Escape') { stop(); paint(); return; }
          if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code) && e.type !== 'keyup') return;
          const before = { ...s().keys };
          const next = assignKey(before, a.id, e.code);
          if (!next) { audio.sfx('error'); ui.toast(`${keyLabel(e.code)} ya está reservada para el juego`, { icon: 'info' }); return; }
          const swapped = KEY_ACTIONS.find(o => o.id !== a.id && (before[o.id] || o.def) === e.code);
          stop();
          set({ keys: next });
          audio.sfx('done');
          if (swapped) ui.toast(`${swapped.label} pasó a ${keyLabel(codeFor(swapped.id))}`, { icon: 'rotate' });
          paint();
        };
        listening = onKey;
        addEventListener('keydown', onKey, true);
      }
      function stop() { if (listening) { removeEventListener('keydown', listening, true); listening = null; } }
      sh.onCleanup(stop);
      paint();
      const reset = h('button.btn.second.block', { html: `${icon('rotate', 20)} Volver a las teclas de fábrica`, onclick: () => { stop(); set({ keys: {} }); audio.sfx('select'); paint(); } });
      const fixed = h('div.set-fixed', { html: `
        <div><kbd>Flechas</kbd><span>Mover y elegir (siempre andan)</span></div>
        <div><kbd>Esc</kbd><span>Cerrar o pausa</span></div>
        <div><kbd>Enter</kbd><span>Confirmar</span></div>
        <div><kbd>${isMac ? 'Ctrl+Cmd+F' : 'F11'}</kbd><span>Pantalla completa</span></div>
        <div><kbd>Arrastrar</kbd><span>Mover la cámara</span></div>
        <div><kbd>Rueda</kbd><span>Zoom</span></div>
        <div><kbd>1 – 4</kbd><span>Elegir opción en las cartas de la expedición</span></div>` });
      return [section('key', 'Atajos de teclado', hint('Hacé clic en una tecla y apretá la nueva. Si ya la usaba otra acción, se intercambian.'), list, reset),
        section('info', 'Fijas', fixed)];
    },
    a11y() {
      return [section('smile', 'Accesibilidad',
        row('Tamaño de texto', seg('textSize', [['normal', 'Normal'], ['large', 'Grande'], ['xlarge', 'Muy grande']])),
        row('Reducir movimiento', seg('motion', [['auto', 'Automático'], ['on', 'Sí'], ['off', 'No']]), 'Automático hace lo que elegiste en tu sistema. Con “Sí” no hay sacudones, confeti ni cosas volando.'),
        sw('subtitles', 'Subtítulos siempre', 'En las cinemáticas y las escenas de la historia.'),
        sw('hiContrast', 'Alto contraste en el combate', 'Las casillas que marca el enemigo se ven con borde grueso y rayado.'),
      )];
    },
    save() {
      const out = [accountSection(ctx, sh, (ic, t, ...c) => section('people', t, ...c)), backupSection(ctx, sh, section)];
      if (!isDesktop) out.push(installSection(ctx, section));
      out.push(statsSection(), creditsCard(), dangerZone());
      return out;
    },
  };

  // ---------- secciones de la pestaña Partida y Juego ----------
  function flagSection() {
    const flagPrev = h('span.pnl-flag-prev');
    const swatches = h('div.swatches.pnl-swatches');
    const paintFlag = () => {
      const cur = OUTFIT_COLORS.find(c => c.id === ctx.state.city.flagColor) || OUTFIT_COLORS[0];
      flagPrev.innerHTML = flagArt(cur.hex, 56);
      for (const b of swatches.children) b.classList.toggle('active', b.dataset.id === cur.id);
    };
    for (const c of OUTFIT_COLORS) {
      swatches.append(h('button.swatch', {
        'data-id': c.id, 'aria-label': 'Color ' + c.id, style: { background: c.hex },
        onclick: () => {
          if (ctx.state.city.flagColor === c.id) return;
          ctx.state.city.flagColor = c.id;
          ctx.store.markDirty();
          audio.sfx('select');
          ctx.bus.emit('city:flag', { color: c.id, hex: c.hex });
          paintFlag();
          flagPrev.classList.remove('pnl-wave'); void flagPrev.offsetWidth; flagPrev.classList.add('pnl-wave');
        },
      }));
    }
    paintFlag();
    return section('castle', 'Bandera de la municipalidad', h('div.pnl-flag-row', {}, flagPrev, swatches));
  }
  function nameField(label, ic, get, put, fallback, max) {
    const input = h('input', { type: 'text', maxlength: String(max), value: get(), autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': label });
    const save = (final) => {
      let v = input.value.replace(/\s+/g, ' ');
      if (final) { v = v.trim() || fallback; input.value = v; }
      if (!v.trim()) return;
      if (v.trim() !== get()) { put(v.trim()); ctx.store.markDirty(); ctx.hud?.refresh?.(); }
    };
    input.addEventListener('input', () => save(false));
    input.addEventListener('change', () => save(true));
    input.addEventListener('blur', () => save(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key !== 'Escape') e.stopPropagation();
    });
    return h('label.pnl-field', {}, h('span.pnl-field-lbl', { html: `${icon(ic, 20)} ${label}` }), input);
  }
  function statsSection() {
    return section('heart', 'Ayudanos a mejorar',
      sw('telemetry', 'Enviar estadísticas anónimas de uso', null, { onChange: (on) => import('../online/telemetry.js').then(m => m.setEnabled(on)).catch(() => {}) }),
      hint('Mandamos qué partes del juego usás (niveles, expediciones, menús), cuánto dura cada sesión y los errores, con un código al azar de este dispositivo. Nunca tu nombre, tu email ni tu ciudad.'));
  }
  function creditsCard() {
    const ver = h('span.chip.primary', { html: `${icon('sparkle', 14)} Versión …` });
    gameVersion().then(v => { ver.innerHTML = `${icon('sparkle', 14)} Versión ${v}`; });
    return h('section.card.pnl-credits.set-credits', {},
      h('div.set-dz', { html: DEZ_MARK, 'aria-hidden': 'true' }),
      h('b.pnl-credits-title', {}, 'Pixelia'),
      h('p', { html: 'Un juego de <b>Dezings</b>' }),
      h('p.small.muted', {}, 'Diseño, código, arte vóxel y música: Dezings · Música y sonidos sintetizados en el momento · Tipografía Jersey 10 (OFL) · Gráficos 3D con three.js · Juego de PC con Tauri'),
      h('button.btn.mint.small', { html: `${icon('info', 18)} Cómo jugar`, onclick: () => ctx.openPanel('help') }),
      ver);
  }
  function dangerZone() {
    const resetBtn = h('button.btn.block.pnl-danger', { html: `${icon('trash', 20)} Borrar partida` });
    resetBtn.onclick = async () => {
      const a = await askConfirm(ctx, { title: '¿Borrar partida?', html: 'Se borra <b>toda</b> tu ciudad, tus monedas y tus logros.', ok: 'Sí, borrar', cancel: 'No', okCls: 'pnl-danger', ic: 'trash' });
      if (!a || sh.closed) return;
      const b = await askConfirm(ctx, { title: '¿Seguro?', html: 'Esto <b>no se puede deshacer</b>. Si querés, antes guardá una copia en un archivo.', ok: 'Borrar todo', cancel: 'Me arrepentí', okCls: 'pnl-danger', ic: 'trash' });
      if (!b) return;
      ctx.store.reset();
      location.reload();
    };
    return h('div.pnl-dangerzone', {}, resetBtn);
  }

  // ---------- armado ----------
  function show(id) {
    tab = lastTab = id;
    for (const b of tabs.children) { const on = b.dataset.tab === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }
    const keep = pane.scrollTop;
    pane.innerHTML = '';
    const col = h('div.col.pnl-gap.set-col');
    for (const el of PANES[id]()) if (el) col.append(el);
    pane.append(col);
    pane.scrollTop = show.same === id ? keep : 0;
    show.same = id;
  }
  for (const [id, ic, label] of TABS) {
    tabs.append(h('button.set-tab', { role: 'tab', 'data-tab': id, html: `${icon(ic, 22)}<span>${label}</span>`, onclick: () => { if (tab !== id) { audio.sfx('tap'); show(id); } } }));
  }
  // flechas arriba/abajo (o izquierda/derecha) entre pestañas cuando el foco está en la lista
  tabs.addEventListener('keydown', (e) => {
    const i = TABS.findIndex(t => t[0] === tab);
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    const n = TABS[(i + d + TABS.length) % TABS.length][0];
    show(n);
    tabs.querySelector(`[data-tab="${n}"]`)?.focus();
  });
  // si algo cambia los ajustes desde afuera (F11, el preset automático), la pestaña se repinta
  sh.on(ctx.bus, 'settings:changed', ({ keys } = {}) => {
    if (keys?.includes('winMode') && tab === 'screen') show('screen');
    if (keys?.includes('gfxPreset') && tab === 'gfx' && !document.activeElement?.closest?.('.set-pane')) show('gfx');
  });
  show(tab);
  return sh.done;
}

/** Versión del juego: la de la app de PC, o la del service worker en la web. */
async function gameVersion() {
  try { const v = await window.__TAURI__?.app?.getVersion?.(); if (v) return 'v' + (Number(v.split('.')[1]) || v); } catch {}
  try { const t = await (await fetch('sw.js', { cache: 'no-store' })).text(); const m = /pixelia-v(\d+)/.exec(t); if (m) return 'v' + m[1]; } catch {}
  return '—';
}

// La "D" de cubos del logo de estudio, en chico (los colores de index.html: azul Dezings y blanco)
const DEZ_MARK = `<svg viewBox="0 0 64 64" width="56" height="56" shape-rendering="crispEdges"><rect width="64" height="64" rx="10" fill="#3d55b8"/>
<path fill="#fff" d="M18 14h18v6h6v6h4v12h-4v6h-6v6H18zM26 22v20h8v-4h4V26h-4v-4z"/></svg>`;

// ---------- Copia de seguridad (archivo .json o código) ----------
function backupSection(ctx, sh, section) {
  const { ui, audio, store } = ctx;
  const { h } = ui;
  const box = h('div.col.set-backup');
  const dateStr = () => new Date().toISOString().slice(0, 10);
  const slug = (t) => String(t || 'pixelia').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'pixelia';

  async function exportFile() {
    store.save();
    const payload = JSON.stringify({ juego: 'Pixelia', formato: 1, fecha: new Date().toISOString(), ciudad: ctx.state.player.cityName, codigo: store.exportCode() });
    const name = `pixelia-${slug(ctx.state.player.cityName)}-${dateStr()}.json`;
    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const fh = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Partida de Pixelia', accept: { 'application/json': ['.json'] } }] });
        const w = await fh.createWritable(); await w.write(payload); await w.close();
        audio.sfx('done'); ui.toast('Partida guardada en el archivo', { icon: 'check', type: 'good' });
        return;
      } catch (e) { if (e?.name === 'AbortError') return; console.warn('[ajustes] guardar archivo', e); }
    }
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    audio.sfx('done');
    ui.toast(`Listo: ${name} quedó en tu carpeta de descargas`, { icon: 'check', type: 'good' });
  }

  async function load(code) {
    code = String(code || '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (!code) { audio.sfx('error'); ui.toast('No encontramos una partida ahí', { icon: 'info' }); return; }
    const ok = await askConfirm(ctx, { title: '¿Cargar partida?', html: 'Tu partida actual se va a reemplazar por esta.', ok: 'Cargar', cancel: 'Mejor no', ic: 'key' });
    if (!ok) return;
    try {
      store.importCode(code);
      ui.toast('Partida cargada', { icon: 'check', type: 'good' });
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      console.warn('import', e);
      audio.sfx('error');
      ui.toast('Esa partida no se pudo leer', { icon: 'close', type: 'bad' });
    }
  }
  /** Lee un archivo de partida: el .json de Exportar, o un texto con el código suelto. */
  function codeFromText(txt) {
    try { const j = JSON.parse(txt); if (j && typeof j === 'object') return j.codigo || j.code || ''; } catch {}
    return txt;
  }
  const fileInput = h('input.set-file', { type: 'file', accept: '.json,application/json,text/plain', 'aria-label': 'Archivo de partida' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 8e6) { audio.sfx('error'); ui.toast('Ese archivo es demasiado grande para ser una partida', { icon: 'info' }); return; }
    load(codeFromText(await f.text()));
  });

  // código para copiar y pegar (como antes)
  const exportBox = h('div.col.hidden');
  const exportArea = h('textarea.pnl-code', { readonly: true, rows: '3', 'aria-label': 'Código de tu partida' });
  exportBox.append(exportArea);
  const copyBtn = h('button.btn.sky.block', { html: `${icon('save', 20)} Copiar código` });
  copyBtn.onclick = async () => {
    store.save();
    const code = store.exportCode();
    exportArea.value = code;
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); ok = true; } } catch { ok = false; }
    exportBox.classList.remove('hidden');
    if (!ok) { exportArea.focus(); exportArea.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } }
    if (ok) { audio.sfx('done'); ui.toast('Código copiado', { icon: 'check', type: 'good' }); }
    else { audio.sfx('select'); ui.toast('Copialo a mano desde el cuadro (Ctrl+C)', { icon: 'info' }); }
  };
  const importArea = h('textarea.pnl-code', { rows: '3', placeholder: 'Pegá acá un código de partida…', 'aria-label': 'Código para cargar', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off' });
  importArea.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
  const codeMore = h('details.set-more', {},
    h('summary', {}, 'Con un código (para pegar en un chat)'),
    h('div.col.pnl-gap', {}, copyBtn, exportBox, importArea,
      h('button.btn.second.block', { html: `${icon('key', 20)} Cargar código`, onclick: () => load(importArea.value) })));

  box.append(
    h('p.small.muted', {}, 'Guardá tu partida en un archivo para pasarla de la web al juego de PC, a otra compu o para tener una copia.'),
    h('div.pnl-acc-btns', {},
      h('button.btn.primary.block.set-export', { html: `${icon('save', 20)} Guardar en un archivo`, onclick: exportFile }),
      h('button.btn.second.block.set-import', { html: `${icon('key', 20)} Cargar desde un archivo`, onclick: () => fileInput.click() })),
    fileInput, codeMore);
  return section('save', 'Copia de seguridad', box);
}

function installSection(ctx, section) {
  const { h } = ctx.ui;
  const install = h('div.col');
  if (isStandalone()) install.append(h('div.pnl-note.good', { html: `${icon('check', 22)}<span>Pixelia ya está instalada. Abrila desde tu pantalla de inicio.</span>` }));
  else {
    install.append(h('p.small.muted', {}, 'Así se abre a pantalla completa, como una app, y funciona sin internet. También hay un juego de PC para Windows y Mac.'));
    const deferred = window.__pixeliaInstallPrompt;
    if (!isIOS() && deferred && typeof deferred.prompt === 'function') {
      const btn = h('button.btn.second.block', { html: `${icon('plus', 20)} Instalar en esta compu` });
      btn.onclick = async () => { btn.disabled = true; try { await deferred.prompt(); } catch (e) { console.warn(e); } window.__pixeliaInstallPrompt = null; btn.remove(); };
      install.append(btn);
    } else if (isIOS()) {
      install.append(h('div.pnl-steps', { html: [
        ['1', icon('🧭', 40), 'Abrí el juego en <b>Safari</b>'],
        ['2', art('share', 40), 'Tocá <b>Compartir</b> (abajo)'],
        ['3', art('addHome', 40), 'Elegí <b>Agregar a inicio</b>'],
      ].map(([n, ic, t]) => `<div class="pnl-stepc"><i>${n}</i>${ic}<span>${t}</span></div>`).join('') }));
    } else {
      install.append(h('p.pnl-note', { html: `${icon('info', 18)}<span>En Chrome o Edge, hacé clic en el botón de instalar a la derecha de la barra de direcciones.</span>` }));
    }
  }
  return section('home', 'Instalar como app', install);
}

// ---------- Cuenta y amigos (online) ----------
/** "hace 3 min" / "recién" a partir de un ISO o ms. */
function agoText(t) {
  const ms = Date.now() - new Date(t).getTime();
  if (!isFinite(ms)) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  const hh = Math.round(m / 60);
  if (hh < 24) return `hace ${hh} h`;
  const d = Math.round(hh / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}
/** Carga social.js (lo hace otro módulo); si todavía no existe o falla, devuelve null. */
async function loadSocial() {
  try { return await import('../online/social.js'); } catch (e) { console.warn('[settings] social', e); return null; }
}

function accountSection(ctx, sh, section) {
  const { ui, audio, bus } = ctx;
  const { h, esc } = ui;
  const box = h('div.col.pnl-acc');
  const sec = section(icon('people', 24), 'Cuenta y amigos', box);
  let net = null, sync = null, loading = true, failed = false, unavailable = false;
  let code = null, codeFor = null, codeBusy = false;

  async function load() {
    try { net = (await import('../online/net.js')).net; } catch (e) { console.warn('[settings] net', e); failed = true; }
    try { sync = await import('../online/sync.js'); } catch (e) { sync = null; }
    loading = false;
    if (sh.closed) return;
    paint();
    if (net) {
      sh.onCleanup(net.onAuth(() => { code = null; codeFor = null; paint(); fetchCode(); }));
      if (net.mode !== 'off') { await net.init(); if (!sh.closed) { paint(); fetchCode(); } }
    }
  }
  async function fetchCode() {
    if (!net?.user || codeBusy || codeFor === net.user.id) return;
    codeBusy = true;
    const uid = net.user.id;
    const r = await net.getMyProfile();
    codeBusy = false;
    if (sh.closed || net.user?.id !== uid) return;
    codeFor = uid;
    code = r && !r.error && r.code ? String(r.code) : null;
    paint();
  }

  async function open(kind) {
    audio.sfx('tap');
    const m = await loadSocial();
    const f = m && (kind === 'account' ? m.openAccount : kind === 'conflict' ? m.handleConflict : m.openSocial);
    if (typeof f !== 'function') {
      unavailable = true;
      paint();
      ui.toast('La parte de amigos todavía se está preparando', { icon: 'heart' });
      return;
    }
    try {
      if (kind === 'account') await f(ctx);
      else if (kind === 'conflict') await f(ctx, sync?.getSyncStatus?.().conflictInfo);
      else await f(ctx, 'amigas');
    } catch (e) { console.warn('[settings] social', e); ui.toast('Ups, no se pudo abrir', { icon: 'info' }); }
    if (!sh.closed) paint();
  }

  async function copyCode() {
    if (!code) return;
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); ok = true; } } catch { ok = false; }
    if (!ok && navigator.share) {
      try { await navigator.share({ text: `¡Sumame en Pixelia! Mi código de amistad es ${code}` }); ok = true; } catch { ok = false; }
    }
    if (ok) { audio.sfx('done'); ui.toast('¡Código copiado! Pasáselo a tu gente', { icon: 'check', type: 'good' }); }
    else { audio.sfx('select'); ui.toast(`Tu código es ${code}`, { icon: 'info' }); }
  }

  function paint() {
    if (sh.closed) return;
    box.innerHTML = '';
    if (loading) { box.append(h('p.small.muted', { html: `${icon('clock', 16)} Mirando tu conexión…` })); return; }
    if (failed || !net) {
      box.append(h('p.pnl-note', { html: `${icon('heart', 18)}<span>Por ahora no pudimos cargar lo online. ¡No pasa nada! Tu partida se guarda en este dispositivo.</span>` }));
      return;
    }
    const st = sync?.getSyncStatus?.() || {};
    const mode = net.mode;
    let chip, text;
    if (mode === 'off') {
      chip = `<span class="chip">${icon('home', 14)} Sin conexión</span>`;
      text = 'Tu partida se guarda en este dispositivo. Cuando el juego esté online vas a poder visitar a tus amigos y mandarles regalitos.';
    } else if (!net.ready) {
      chip = `<span class="chip sky">${icon('clock', 14)} Conectando…</span>`;
      text = 'Un segundito…';
    } else if (net.user) {
      chip = net.online ? `<span class="chip mint">${icon('check', 14)} En línea</span>` : `<span class="chip gold">${icon('info', 14)} Sin internet</span>`;
      const who = net.user.email ? `Entraste como <b>${esc(net.user.email)}</b>.` : 'Entraste con tu cuenta.';
      const when = st.lastSync ? ` Guardado en la nube ${agoText(st.lastSync)}.` : '';
      text = who + when + (net.online ? '' : ' Cuando vuelva internet se sincroniza sola.');
    } else {
      chip = `<span class="chip second">${icon('people', 14)} Sin cuenta</span>`;
      text = 'Creá tu cuenta para visitar las ciudades de tus amigos, mandarles regalos, intercambiar hallazgos y guardar tu partida en la nube.';
    }
    if (mode === 'mock') chip += ` <span class="chip primary">${icon('sparkle', 14)} Modo prueba</span>`;
    box.append(h('div.pnl-acc-status', { html: `<div class="pnl-chips">${chip}</div><p class="small muted">${text}</p>` }));

    if (net.user) {
      const codeBox = h('div.pnl-friendcode');
      codeBox.innerHTML = `<span class="pnl-friendcode-l"><small>Tu código de amistad</small><b class="pnl-friendcode-txt">${code ? esc(code) : (codeFor ? '—' : '······')}</b></span>`;
      if (code) codeBox.append(h('button.btn.sky.small', { html: `${icon('save', 18)} Copiar`, 'aria-label': 'Copiar código de amistad', onclick: copyCode }));
      box.append(codeBox);
    }
    if (st.conflict) {
      box.append(h('p.pnl-note', { html: `${icon('info', 18)}<span>Hay una partida distinta guardada en la nube. Elegí con cuál te quedás.</span>` }));
      box.append(h('button.btn.gold.block', { html: `${icon('key', 20)} Elegir partida`, onclick: () => open('conflict') }));
    }
    if (unavailable) {
      box.append(h('p.pnl-note', { html: `${icon('heart', 18)}<span>La parte de amigos todavía se está preparando. ¡Muy pronto vas a poder jugar con tu gente!</span>` }));
    }
    const row = h('div.pnl-acc-btns');
    if (mode !== 'off') {
      row.append(h('button.btn.second.block', { html: `${icon('key', 20)} ${net.user ? 'Mi cuenta' : 'Crear cuenta o entrar'}`, onclick: () => open('account') }));
      if (net.user) row.append(h('button.btn.primary.block', { html: `${icon('people', 20)} Amigos`, onclick: () => open('social') }));
    } else {
      row.append(h('button.btn.second.block', { html: `${icon('people', 20)} Cuenta y amigos`, onclick: () => open('account') }));
    }
    box.append(row);
  }

  sh.on(bus, 'online:status', () => paint());
  paint();
  load();
  return sec;
}

// ---------- Cómo jugar ----------
export function openHelp(ctx) {
  const sh = openShell(ctx, 'help', { title: 'Cómo jugar', ic: 'info', className: 'pnl-md pnl-help', actions: [{ label: '¡Entendido!', cls: 'primary' }] });
  if (!sh) return;
  const { h } = ctx.ui;
  const groups = [
    ['castle', 'Tu ciudad', [
      ['coin', 'Cobrá', 'Cuando aparece una burbujita arriba de un edificio, hacé clic para juntar monedas. Si se llena, deja de producir: ¡volvé seguido!'],
      ['hammer', 'Construí', 'Hacé clic en <b>Construir</b>, elegí algo y ubicalo en el pasto. Podés rotarlo y moverlo cuando quieras.'],
      ['dress', 'Tu personaje', 'Elegí quién sos y vestite en el <b>Equipaje</b>. Cambiar de personaje es gratis y lo que compraste queda guardado.'],
      ['palette', 'Estilo de la ciudad', 'Con el botón de la <b>paleta</b> en la ciudad (o en Ajustes) elegís cómo se ve: pastel, moderna, bosque, playa, invierno o noche. Es gratis.'],
      ['people', 'Población', 'Las casas traen vecinos. Muchos negocios piden un mínimo de vecinos para abrir.'],
      ['smile', 'Felicidad', 'Árboles, flores y deco hacen feliz a tu ciudad: ¡todo produce hasta un 50% más!'],
      ['castle', 'Rango y Encanto', 'Mejorá la <b>Municipalidad</b> para subir de rango, de Aldea a Capital. Cada rango pide un expediente: vecinos, felicidad, tipos de negocio y <b>Encanto</b> (deco variada y edificios mejorados). Hacé clic en el cartel de tu rango, arriba a la izquierda.'],
      ['monument', 'Monumentos', 'Desde el rango Pueblo construís monumentos por etapas con los <b>materiales</b> que trae la expedición: madera, piedra, mineral y hierbas. Cada uno terminado da un bonus para siempre. Mirá <b>Obras</b>.'],
      ['👷', 'Constructoras', 'Cada obra ocupa una constructora un ratito. Si faltan menos de 5 segundos, terminala gratis.'],
      ['🧭', 'Expedición', 'Con la <b>Casa de Expediciones</b> salís a explorar la región: cada paso gasta provisiones y lo que traés (materiales, planos, hallazgos) sirve para crecer.'],
      ['quest', 'Misiones', 'Seguí la misión principal, hacé las 3 diarias para abrir el cofre y juntá estrellas de logro.'],
      ['gem', 'Gemas', 'Se ganan con misiones, logros, subiendo de nivel, en las amenazas y en las salidas de 3★. Sirven para cosas especiales.'],
    ]],
    ['gift', 'Premios y colección', [
      ['fire', 'Racha diaria', 'Entrá cada día por tu regalo. Si un día no podés, tu <b>escudo de racha</b> de la semana la cuida. Y si volvés después de unos días, ¡te espera un regalo de bienvenida!'],
      ['chest:plata', 'Cofres', 'Salen en las expediciones de 3★, las amenazas, el Pase, cada 5 niveles y con las misiones, y cada día hay uno <b>gratis</b>. Traen monedas, gemas, equipo, prendas y construcciones sorpresa.'],
      ['bag', 'Mochila y equipo', 'Lo que sale de los cofres se guarda en tu <b>mochila</b> (martillos, relojes, pociones). El <b>equipo</b> (cuerda, pala, lona, farol) se elige al preparar una salida.'],
      ['🃏', 'Hallazgos', 'Lo que encontrás explorando: 12 colecciones repartidas entre las regiones. Salen en ruinas, objetivos y algunos cofres. Completá una página para ganar un premio grande. Los repetidos se cambian por <b>recortes</b> o se intercambian con tus contactos.'],
      ['sparkle', 'Pase de Temporada', 'Cada temporada dura 4 semanas. Todo lo que hacés suma <b>chispas</b> y cada nivel del pase trae premios gratis. ¡Sin apuro!'],
      ['calendar', 'Eventos', 'Cada semana hay eventos especiales: producción doble, semanas de región, lluvia de cofres, hallazgos dobles, carrera de estrellas… Mirá el cartelito arriba de la pantalla.'],
    ]],
    ['heart', 'Con tus amigos', [
      ['people', 'Amigos', 'Sumá gente con tu <b>código de amistad</b> (está en Amigos y en Ajustes). Cuanto más juegan en equipo, más crece la amistad.'],
      ['home', 'Visitas', 'Visitá sus ciudades, dejales un corazón y una notita, y dales una mano para terminar sus obras.'],
      ['gift', 'Regalos', 'Mandá un regalito por día a cada persona de tu lista. Lo que te mandan llega a tu <b>Buzón</b>.'],
      ['🙋', 'Pedidos', '¿Te falta algo? Pedí una mano (hasta 3 por día) y tu gente te ayuda. Ayudar a los demás también da premios.'],
      ['rotate', 'Intercambios', 'Cambiá hallazgos repetidos, monedas u objetos con tus contactos: del otro lado aceptan o rechazan.'],
      ['build', 'Obra en Equipo', 'Entre todos llenan una barra semanal con 5 escalones de premios. ¡Todo lo que jugás suma!'],
      ['trophy', 'Ranking', 'Cada semana se comparan récords y estrellas. Hay premio para todos, ¡y medalla si superás tu mejor marca!'],
    ]],
  ];
  const itemIc = (ic) => (ic.startsWith('chest:') ? chestArt(ic.slice(6), 34) : icon(ic, 32));
  const list = h('div.pnl-help-groups', { html: groups.map(([gic, gt, items]) => `
    <section class="pnl-help-group">
      <h3 class="pnl-help-h">${icon(gic, 22)}<span>${gt}</span></h3>
      <div class="pnl-help-list">${items.map(([ic, t, d]) => `
        <div class="pnl-help-item"><span class="pnl-help-ic">${itemIc(ic)}</span><span><b>${t}</b><small>${d}</small></span></div>`).join('')}</div>
    </section>`).join('') });
  const pc = h('div.pnl-help-pc', { html: `
    <b>${icon('🖱️', 20)} En la compu</b>
    <ul>
      <li><kbd>Arrastrar</kbd> mueve la cámara · <kbd>Rueda</kbd> hace zoom</li>
      <li><kbd>Esc</kbd> cierra ventanas o pausa · <kbd>Enter</kbd> confirma</li>
      <li>Para manejar: <kbd>flechas</kbd> o <kbd>WASD</kbd></li>
    </ul>` });
  sh.body.append(list);
  // controles de teclado/mouse solo si hay un puntero fino (PC, o iPad con mouse)
  if (matchMedia?.('(any-pointer: fine)').matches) sh.body.append(pc);
  sh.keyHandler = (e) => { if (e.key === 'Enter') { e.preventDefault(); sh.close(); } };
  return sh.done;
}
