// Panel de Ajustes (por pestañas). El "Cómo jugar" de antes es ahora el Manual de la Bitácora (panels-story.js).
import { icon } from '../core/icons.js';
import { OUTFIT_COLORS } from '../core/data.js';
import { openShell, askConfirm, art, flagArt, chestArt } from './panels-common.js';
import { setSetting, WIN_RES } from '../core/settings.js';
import { isDesktop, isMac, monitorInfo } from '../core/desktop.js';
import { KEY_ACTIONS, codeFor, keyLabel, assignKey } from '../core/keys.js';
import { t, tn, LANGS, getLang, matchLang } from '../core/i18n.js';

const isStandalone = () => !!(navigator.standalone || matchMedia?.('(display-mode: standalone)').matches);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Pestañas de Ajustes (docs/PLAN-QUIEBRE.md §G). Cada control escribe con setSetting (src/core/settings.js), que
// guarda, aplica en vivo y avisa por el bus ('settings:changed').
// [id, ícono]; el nombre sale de t('settings.tab.<id>')
const TABS = [
  ['gfx', 'sparkle'],
  ['screen', 'home'],
  ['sound', 'music'],
  ['game', 'castle'],
  ['lang', 'map'],
  ['keys', 'key'],
  ['a11y', 'smile'],
  ['save', 'save'],
];
let lastTab = 'gfx';

export function openSettings(ctx, p = {}) {
  const sh = openShell(ctx, 'settings', { title: t('settings.title'), ic: 'gear', sheet: true, className: 'pnl-settings set-panel' });
  if (!sh) return;
  const { ui, audio } = ctx;
  const { h } = ui;
  const s = () => ctx.state.settings;
  const set = (patch) => setSetting(patch);
  const tabs = h('nav.set-tabs', { role: 'tablist', 'aria-label': t('settings.tabsLabel') });
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
      const presetSeg = seg('gfxPreset', ['low', 'medium', 'high', 'custom'].map(v => [v, t('settings.preset.' + v)]),
        { disabled: ['custom'], onPick: v => { set({ gfxPreset: v }); show('gfx'); } });
      const auto = s().gfxPreset === 'auto';
      return [
        section('sparkle', t('settings.gfx.quality'),
          row(t('settings.gfx.preset'), presetSeg, t(auto ? 'settings.gfx.presetAuto' : 'settings.gfx.presetHelp')),
          row(t('settings.gfx.scale'), slider('renderScale', { min: 50, max: 200, step: 10, fmt: pct, live: false, onDone: () => show('gfx') }),
            t('settings.gfx.scaleHelp')),
          sw('aa', t('settings.gfx.aa'), t('settings.gfx.aaHelp'), { onChange: () => show('gfx') }),
          sw('shadows', t('settings.gfx.shadows'), null, { onChange: () => show('gfx') }),
          sw('outline', t('settings.gfx.outline'), t('settings.gfx.outlineHelp'), { onChange: () => show('gfx') }),
          row(t('settings.gfx.particles'), seg('particles', ['few', 'normal', 'many'].map(v => [v, t('settings.gfx.particles.' + v)]), { onPick: v => { set({ particles: v }); show('gfx'); } }), t('settings.gfx.particlesHelp')),
        ),
        section('clock', t('settings.gfx.fps'),
          row(t('settings.gfx.maxFps'), seg('maxFps', [[30, '30'], [60, '60'], [120, '120'], [144, '144'], [240, '240'], [0, t('settings.gfx.noLimit')]], { onPick: v => set({ maxFps: v }) }),
            t('settings.gfx.maxFpsHelp')),
          row(t('settings.gfx.bgFps'), seg('bgFps', [[10, '10'], [15, '15'], [30, '30'], [60, '60']]), t('settings.gfx.bgFpsHelp')),
          sw('showFps', t('settings.gfx.showFps'), t('settings.gfx.showFpsHelp')),
          hint(t('settings.gfx.vsync')),
        ),
      ];
    },
    screen() {
      const out = [];
      const modes = (isDesktop ? ['window', 'fullscreen', 'borderless'] : ['window', 'fullscreen']).map(v => [v, t('settings.screen.' + v)]);
      const resBox = h('div.set-resbox');
      const modeSeg = seg('winMode', modes, { onPick: v => { set({ winMode: v }); paintRes(); } });
      function paintRes() {
        resBox.innerHTML = '';
        if (!isDesktop || s().winMode !== 'window') return;
        monitorInfo().then(m => {
          if (sh.closed) return;
          const fits = WIN_RES.filter(([w, hh]) => !m || (w <= m.aw && hh <= m.ah));
          const opts = [['auto', t('settings.preset.auto')], ...fits.map(([w, hh]) => [`${w}x${hh}`, `${w}×${hh}`])];
          resBox.innerHTML = '';
          resBox.append(row(t('settings.screen.res'), seg('winRes', opts), m ? t('settings.screen.resHelp', { w: String(m.w), h: String(m.h) }) : null));
        });
      }
      paintRes();
      const fsKey = isMac ? 'Ctrl + Cmd + F' : 'F11';
      out.push(section('home', t('settings.screen.window'),
        row(t('settings.screen.mode'), modeSeg, isDesktop ? t('settings.screen.modeHelpPc', { key: fsKey }) : t('settings.screen.modeHelpWeb')),
        resBox,
      ));
      out.push(section('sparkle', t('settings.screen.ui'),
        row(t('settings.screen.uiScale'), slider('uiScale', { min: 80, max: 150, step: 5, fmt: pct, live: false }), t('settings.screen.uiScaleHelp')),
      ));
      return out;
    },
    sound() {
      const vol = (key, label, help, test) => row(label, slider(key, { min: 0, max: 100, step: 5, scale: 100, fmt: pct, onDone: test }), help);
      return [section('music', t('settings.sound.volume'),
        vol('volMaster', t('settings.sound.master'), null, () => audio.sfx('select')),
        vol('volMusic', t('settings.sound.music'), null),
        vol('volSfx', t('settings.sound.sfx'), t('settings.sound.sfxHelp'), () => audio.sfx('coin')),
        vol('volAmb', t('settings.sound.amb'), t('settings.sound.ambHelp')),
        vol('volUi', t('settings.sound.ui'), t('settings.sound.uiHelp'), () => audio.sfx('select')),
        vol('volVoice', t('settings.sound.voice'), t('settings.sound.voiceHelp')),
        sw('muteBg', t('settings.sound.muteBg'), t('settings.sound.muteBgHelp')),
      )];
    },
    game() {
      return [
        section('people', t('settings.game.you'),
          nameField(t('settings.game.charName'), 'people', () => ctx.state.player.name, v => { ctx.state.player.name = v; }, 'Pixelín', 16),
          nameField(t('settings.game.cityName'), 'castle', () => ctx.state.player.cityName, v => { ctx.state.player.cityName = v; }, 'Pixelia', 18),
          h('div.pnl-acc-btns', {},
            h('button.btn.primary.block', { html: `${icon('dress', 20)} ${t('settings.game.changeChar')}`, onclick: () => { sh.close(); ctx.router.go('wardrobe', { tab: 'type' }); } }),
            h('button.btn.second.block', { html: `${icon('palette', 20)} ${t('settings.game.cityStyle')}`, onclick: () => { sh.close(); import('../city/themes-ui.js').then(m => m.openThemePicker(ctx)).catch(e => console.warn('[ajustes] temas', e)); } })),
        ),
        flagSection(),
        section('quest', t('settings.game.story'),
          row(t('settings.game.textSpeed'), seg('textSpeed', ['slow', 'normal', 'fast', 'instant'].map(v => [v, t('settings.game.textSpeed.' + v)]))),
          sw('skipSeen', t('settings.game.skipSeen'), t('settings.game.skipSeenHelp')),
          row(t('settings.game.combatSpeed'), seg('combatSpeed', [[1, 'x1'], [2, 'x2'], [3, 'x3']])),
          sw('confirmEnd', t('settings.game.confirmEnd'), t('settings.game.confirmEndHelp')),
          sw('hints', t('settings.game.hints'), t('settings.game.hintsHelp')),
        ),
        section('rotate', t('settings.game.camera'),
          row(t('settings.game.camSpeed'), slider('camSpeed', { min: 50, max: 200, step: 10, scale: 100, fmt: pct }), t('settings.game.camSpeedHelp')),
          sw('edgeScroll', t('settings.game.edgeScroll'), t('settings.game.edgeScrollHelp')),
        ),
        section('star', t('settings.game.ambience'),
          sw('dayNight', t('settings.game.dayNight'), t('settings.game.dayNightHelp')),
        ),
      ];
    },
    lang() {
      const cur = getLang();
      const forced = matchLang(new URLSearchParams(location.search).get('lang'));
      const sys = matchLang(navigator.language);
      const list = h('div.set-langs', { role: 'radiogroup', 'aria-label': t('settings.lang.title') });
      for (const [code, name] of LANGS) {
        const on = code === cur;
        list.append(h('button.set-lang' + (on ? '.on' : ''), { role: 'radio', lang: code, 'data-lang': code, 'aria-checked': on ? 'true' : 'false',
          onclick: () => { if (getLang() === code) return; audio.sfx('select'); set({ lang: code }); } }, name));
      }
      const notes = [hint(t('settings.lang.help'))];
      if (sys) notes.push(hint(t('settings.lang.system', { name: LANGS.find(l => l[0] === sys)[1] })));
      if (cur !== 'es') notes.push(hint(t('settings.lang.partial')));
      if (forced) notes.push(hint(t('settings.lang.urlForced', { code: forced })));
      return [section('map', t('settings.lang.title'), list, ...notes)];
    },
    keys() {
      const list = h('div.set-keys');
      let listening = null;
      function paint() {
        list.innerHTML = '';
        let group = null;
        for (const a of KEY_ACTIONS) {
          if (a.group !== group) { group = a.group; list.append(h('h4.set-kgroup', {}, group)); }
          const b = h('button.set-key', { 'data-act': a.id, 'aria-label': t('settings.keys.aria', { action: a.label, key: keyLabel(codeFor(a.id)) }) }, h('kbd', {}, keyLabel(codeFor(a.id))));
          b.onclick = () => listen(a, b);
          list.append(h('div.set-krow', {}, h('span', {}, a.label), b));
        }
      }
      function listen(a, b) {
        stop();
        audio.sfx('tap');
        b.classList.add('wait');
        b.innerHTML = `<kbd>${t('settings.keys.press')}</kbd>`;
        const onKey = (e) => {
          e.preventDefault(); e.stopImmediatePropagation();
          if (e.key === 'Escape') { stop(); paint(); return; }
          if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code) && e.type !== 'keyup') return;
          const before = { ...s().keys };
          const next = assignKey(before, a.id, e.code);
          if (!next) { audio.sfx('error'); ui.toast(t('settings.keys.reserved', { key: keyLabel(e.code) }), { icon: 'info' }); return; }
          const swapped = KEY_ACTIONS.find(o => o.id !== a.id && (before[o.id] || o.def) === e.code);
          stop();
          set({ keys: next });
          audio.sfx('done');
          if (swapped) ui.toast(t('settings.keys.swapped', { action: swapped.label, key: keyLabel(codeFor(swapped.id)) }), { icon: 'rotate' });
          paint();
        };
        listening = onKey;
        addEventListener('keydown', onKey, true);
      }
      function stop() { if (listening) { removeEventListener('keydown', listening, true); listening = null; } }
      sh.onCleanup(stop);
      paint();
      const reset = h('button.btn.second.block', { html: `${icon('rotate', 20)} ${t('settings.keys.reset')}`, onclick: () => { stop(); set({ keys: {} }); audio.sfx('select'); paint(); } });
      const fixed = h('div.set-fixed', { html: `
        <div><kbd>${t('settings.keys.arrows')}</kbd><span>${t('settings.keys.arrowsDo')}</span></div>
        <div><kbd>Esc</kbd><span>${t('settings.keys.escDo')}</span></div>
        <div><kbd>Enter</kbd><span>${t('settings.keys.enterDo')}</span></div>
        <div><kbd>${isMac ? 'Ctrl+Cmd+F' : 'F11'}</kbd><span>${t('settings.keys.fsDo')}</span></div>
        <div><kbd>${t('settings.keys.drag')}</kbd><span>${t('settings.keys.dragDo')}</span></div>
        <div><kbd>${t('settings.keys.wheel')}</kbd><span>${t('settings.keys.wheelDo')}</span></div>
        <div><kbd>1 – 4</kbd><span>${t('settings.keys.cardsDo')}</span></div>` });
      return [section('key', t('settings.keys.title'), hint(t('settings.keys.help')), list, reset),
        section('info', t('settings.keys.fixed'), fixed)];
    },
    a11y() {
      return [section('smile', t('settings.a11y.title'),
        row(t('settings.a11y.textSize'), seg('textSize', ['normal', 'large', 'xlarge'].map(v => [v, t('settings.a11y.textSize.' + v)]))),
        row(t('settings.a11y.motion'), seg('motion', [['auto', t('common.auto')], ['on', t('common.yes')], ['off', t('common.no')]]), t('settings.a11y.motionHelp')),
        sw('subtitles', t('settings.a11y.subtitles'), t('settings.a11y.subtitlesHelp')),
        sw('hiContrast', t('settings.a11y.hiContrast'), t('settings.a11y.hiContrastHelp')),
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
        'data-id': c.id, 'aria-label': t('settings.game.flagColor', { id: c.id }), style: { background: c.hex },
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
    return section('castle', t('settings.game.flag'), h('div.pnl-flag-row', {}, flagPrev, swatches));
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
    return section('heart', t('settings.stats.title'),
      sw('telemetry', t('settings.stats.send'), null, { onChange: (on) => import('../online/telemetry.js').then(m => m.setEnabled(on)).catch(() => {}) }),
      hint(t('settings.stats.help')));
  }
  function creditsCard() {
    const ver = h('span.chip.primary', { html: `${icon('sparkle', 14)} ${t('settings.credits.version', { v: '…' })}` });
    gameVersion().then(v => { ver.innerHTML = `${icon('sparkle', 14)} ${t('settings.credits.version', { v })}`; });
    return h('section.card.pnl-credits.set-credits', {},
      h('div.set-dz', { html: DEZ_MARK, 'aria-hidden': 'true' }),
      h('b.pnl-credits-title', {}, 'Pixelia'),
      h('p', { html: t('settings.credits.by') }),
      h('p.small.muted', {}, t('settings.credits.text')),
      soundCredits(),
      h('button.btn.mint.small', { html: `${icon('info', 18)} ${t('settings.credits.manual')}`, onclick: () => { sh.close(); setTimeout(() => ctx.openPanel('story', { tab: 'manual' }), 240); } }),
      ver);
  }
  // créditos de los sonidos (assets/audio/LICENSES.md, todo CC0): se arman desde el manifest
  function soundCredits() {
    const box = h('details.set-sound-credits', {}, h('summary.small', {}, t('settings.credits.sounds')));
    audio.credits().then(list => {
      if (!list.length) { box.remove(); return; }
      box.append(h('p.small.muted', {}, list.map(c => `${c.name} · ${c.author} (${c.license})`).join(' · ')));
    });
    return box;
  }
  function dangerZone() {
    const resetBtn = h('button.btn.block.pnl-danger', { html: `${icon('trash', 20)} ${t('settings.reset.btn')}` });
    resetBtn.onclick = async () => {
      const a = await askConfirm(ctx, { title: t('settings.reset.q1'), html: t('settings.reset.q1Text'), ok: t('settings.reset.q1Ok'), cancel: t('common.no'), okCls: 'pnl-danger', ic: 'trash' });
      if (!a || sh.closed) return;
      const b = await askConfirm(ctx, { title: t('settings.reset.q2'), html: t('settings.reset.q2Text'), ok: t('settings.reset.q2Ok'), cancel: t('settings.reset.q2Cancel'), okCls: 'pnl-danger', ic: 'trash' });
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
  for (const [id, ic] of TABS) {
    tabs.append(h('button.set-tab', { role: 'tab', 'data-tab': id, html: `${icon(ic, 22)}<span>${t('settings.tab.' + id)}</span>`, onclick: () => { if (tab !== id) { audio.sfx('tap'); show(id); } } }));
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
  // idioma nuevo (i18n.js ya cargó el diccionario): se repintan el título, las pestañas y la pestaña abierta
  sh.on(ctx.bus, 'lang:changed', () => {
    const ttl = sh.el?.querySelector('.modal-head h2'); if (ttl) ttl.textContent = t('settings.title');
    tabs.setAttribute('aria-label', t('settings.tabsLabel'));
    for (const b of tabs.children) { const sp = b.querySelector('span'); if (sp) sp.textContent = t('settings.tab.' + b.dataset.tab); }
    show(tab);
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
        const fh = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: t('settings.backup.fileDesc'), accept: { 'application/json': ['.json'] } }] });
        const w = await fh.createWritable(); await w.write(payload); await w.close();
        audio.sfx('done'); ui.toast(t('settings.backup.savedFile'), { icon: 'check', type: 'good' });
        return;
      } catch (e) { if (e?.name === 'AbortError') return; console.warn('[ajustes] guardar archivo', e); }
    }
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    audio.sfx('done');
    ui.toast(t('settings.backup.savedDownload', { name }), { icon: 'check', type: 'good' });
  }

  async function load(code) {
    code = String(code || '').replace(/[^A-Za-z0-9+/=]/g, '');
    if (!code) { audio.sfx('error'); ui.toast(t('settings.backup.noGame'), { icon: 'info' }); return; }
    const ok = await askConfirm(ctx, { title: t('settings.backup.loadQ'), html: t('settings.backup.loadQText'), ok: t('settings.backup.loadOk'), cancel: t('settings.backup.loadCancel'), ic: 'key' });
    if (!ok) return;
    try {
      store.importCode(code);
      ui.toast(t('settings.backup.loaded'), { icon: 'check', type: 'good' });
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      console.warn('import', e);
      audio.sfx('error');
      ui.toast(t('settings.backup.unreadable'), { icon: 'close', type: 'bad' });
    }
  }
  /** Lee un archivo de partida: el .json de Exportar, o un texto con el código suelto. */
  function codeFromText(txt) {
    try { const j = JSON.parse(txt); if (j && typeof j === 'object') return j.codigo || j.code || ''; } catch {}
    return txt;
  }
  const fileInput = h('input.set-file', { type: 'file', accept: '.json,application/json,text/plain', 'aria-label': t('settings.backup.fileAria') });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (!f) return;
    if (f.size > 8e6) { audio.sfx('error'); ui.toast(t('settings.backup.tooBig'), { icon: 'info' }); return; }
    load(codeFromText(await f.text()));
  });

  // código para copiar y pegar (como antes)
  const exportBox = h('div.col.hidden');
  const exportArea = h('textarea.pnl-code', { readonly: true, rows: '3', 'aria-label': t('settings.backup.codeAria') });
  exportBox.append(exportArea);
  const copyBtn = h('button.btn.sky.block', { html: `${icon('save', 20)} ${t('settings.backup.copy')}` });
  copyBtn.onclick = async () => {
    store.save();
    const code = store.exportCode();
    exportArea.value = code;
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); ok = true; } } catch { ok = false; }
    exportBox.classList.remove('hidden');
    if (!ok) { exportArea.focus(); exportArea.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } }
    if (ok) { audio.sfx('done'); ui.toast(t('settings.backup.copied'), { icon: 'check', type: 'good' }); }
    else { audio.sfx('select'); ui.toast(t('settings.backup.copyByHand'), { icon: 'info' }); }
  };
  const importArea = h('textarea.pnl-code', { rows: '3', placeholder: t('settings.backup.pastePh'), 'aria-label': t('settings.backup.pasteAria'), spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off' });
  importArea.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
  const codeMore = h('details.set-more', {},
    h('summary', {}, t('settings.backup.withCode')),
    h('div.col.pnl-gap', {}, copyBtn, exportBox, importArea,
      h('button.btn.second.block', { html: `${icon('key', 20)} ${t('settings.backup.loadCode')}`, onclick: () => load(importArea.value) })));

  box.append(
    h('p.small.muted', {}, t('settings.backup.help')),
    h('div.pnl-acc-btns', {},
      h('button.btn.primary.block.set-export', { html: `${icon('save', 20)} ${t('settings.backup.export')}`, onclick: exportFile }),
      h('button.btn.second.block.set-import', { html: `${icon('key', 20)} ${t('settings.backup.import')}`, onclick: () => fileInput.click() })),
    fileInput, codeMore);
  return section('save', t('settings.backup.title'), box);
}

function installSection(ctx, section) {
  const { h } = ctx.ui;
  const install = h('div.col');
  if (isStandalone()) install.append(h('div.pnl-note.good', { html: `${icon('check', 22)}<span>${t('settings.install.done')}</span>` }));
  else {
    install.append(h('p.small.muted', {}, t('settings.install.help')));
    const deferred = window.__pixeliaInstallPrompt;
    if (!isIOS() && deferred && typeof deferred.prompt === 'function') {
      const btn = h('button.btn.second.block', { html: `${icon('plus', 20)} ${t('settings.install.btn')}` });
      btn.onclick = async () => { btn.disabled = true; try { await deferred.prompt(); } catch (e) { console.warn(e); } window.__pixeliaInstallPrompt = null; btn.remove(); };
      install.append(btn);
    } else if (isIOS()) {
      install.append(h('div.pnl-steps', { html: [
        ['1', icon('🧭', 40), t('settings.install.ios1')],
        ['2', art('share', 40), t('settings.install.ios2')],
        ['3', art('addHome', 40), t('settings.install.ios3')],
      ].map(([n, ic, t]) => `<div class="pnl-stepc"><i>${n}</i>${ic}<span>${t}</span></div>`).join('') }));
    } else {
      install.append(h('p.pnl-note', { html: `${icon('info', 18)}<span>${t('settings.install.chrome')}</span>` }));
    }
  }
  return section('home', t('settings.install.title'), install);
}

// ---------- Cuenta y amigos (online) ----------
/** "hace 3 min" / "recién" a partir de un ISO o ms. */
function agoText(t) {
  const ms = Date.now() - new Date(t).getTime();
  if (!isFinite(ms)) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return t('time.justNow');
  if (m < 60) return t('time.minAgo', { n: m });
  const hh = Math.round(m / 60);
  if (hh < 24) return t('time.hoursAgo', { n: hh });
  return tn('time.daysAgo', Math.round(hh / 24));
}
/** Carga social.js (lo hace otro módulo); si todavía no existe o falla, devuelve null. */
async function loadSocial() {
  try { return await import('../online/social.js'); } catch (e) { console.warn('[settings] social', e); return null; }
}

function accountSection(ctx, sh, section) {
  const { ui, audio, bus } = ctx;
  const { h, esc } = ui;
  const box = h('div.col.pnl-acc');
  const sec = section(icon('people', 24), t('settings.acc.title'), box);
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
      ui.toast(t('settings.acc.preparing'), { icon: 'heart' });
      return;
    }
    try {
      if (kind === 'account') await f(ctx);
      else if (kind === 'conflict') await f(ctx, sync?.getSyncStatus?.().conflictInfo);
      else await f(ctx, 'amigas');
    } catch (e) { console.warn('[settings] social', e); ui.toast(t('settings.acc.cantOpen'), { icon: 'info' }); }
    if (!sh.closed) paint();
  }

  async function copyCode() {
    if (!code) return;
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); ok = true; } } catch { ok = false; }
    if (!ok && navigator.share) {
      try { await navigator.share({ text: t('settings.acc.shareText', { code }) }); ok = true; } catch { ok = false; }
    }
    if (ok) { audio.sfx('done'); ui.toast(t('settings.acc.codeCopied'), { icon: 'check', type: 'good' }); }
    else { audio.sfx('select'); ui.toast(t('settings.acc.yourCodeIs', { code }), { icon: 'info' }); }
  }

  function paint() {
    if (sh.closed) return;
    box.innerHTML = '';
    if (loading) { box.append(h('p.small.muted', { html: `${icon('clock', 16)} ${t('settings.acc.checking')}` })); return; }
    if (failed || !net) {
      box.append(h('p.pnl-note', { html: `${icon('heart', 18)}<span>${t('settings.acc.loadFail')}</span>` }));
      return;
    }
    const st = sync?.getSyncStatus?.() || {};
    const mode = net.mode;
    let chip, text;
    if (mode === 'off') {
      chip = `<span class="chip">${icon('home', 14)} ${t('settings.acc.offline')}</span>`;
      text = t('settings.acc.offlineText');
    } else if (!net.ready) {
      chip = `<span class="chip sky">${icon('clock', 14)} ${t('settings.acc.connecting')}</span>`;
      text = t('settings.acc.connectingText');
    } else if (net.user) {
      chip = net.online ? `<span class="chip mint">${icon('check', 14)} ${t('settings.acc.online')}</span>` : `<span class="chip gold">${icon('info', 14)} ${t('settings.acc.noInternet')}</span>`;
      const who = net.user.email ? t('settings.acc.signedAs', { email: esc(net.user.email) }) : t('settings.acc.signed');
      const when = st.lastSync ? t('settings.acc.synced', { ago: agoText(st.lastSync) }) : '';
      text = who + when + (net.online ? '' : t('settings.acc.willSync'));
    } else {
      chip = `<span class="chip second">${icon('people', 14)} ${t('settings.acc.noAccount')}</span>`;
      text = t('settings.acc.noAccountText');
    }
    if (mode === 'mock') chip += ` <span class="chip primary">${icon('sparkle', 14)} ${t('settings.acc.testMode')}</span>`;
    box.append(h('div.pnl-acc-status', { html: `<div class="pnl-chips">${chip}</div><p class="small muted">${text}</p>` }));

    if (net.user) {
      const codeBox = h('div.pnl-friendcode');
      codeBox.innerHTML = `<span class="pnl-friendcode-l"><small>${t('settings.acc.yourCode')}</small><b class="pnl-friendcode-txt">${code ? esc(code) : (codeFor ? '—' : '······')}</b></span>`;
      if (code) codeBox.append(h('button.btn.sky.small', { html: `${icon('save', 18)} ${t('settings.acc.copy')}`, 'aria-label': t('settings.acc.copyAria'), onclick: copyCode }));
      box.append(codeBox);
    }
    if (st.conflict) {
      box.append(h('p.pnl-note', { html: `${icon('info', 18)}<span>${t('settings.acc.conflict')}</span>` }));
      box.append(h('button.btn.gold.block', { html: `${icon('key', 20)} ${t('settings.acc.pick')}`, onclick: () => open('conflict') }));
    }
    if (unavailable) {
      box.append(h('p.pnl-note', { html: `${icon('heart', 18)}<span>${t('settings.acc.soon')}</span>` }));
    }
    const row = h('div.pnl-acc-btns');
    if (mode !== 'off') {
      row.append(h('button.btn.second.block', { html: `${icon('key', 20)} ${t(net.user ? 'settings.acc.mine' : 'settings.acc.signIn')}`, onclick: () => open('account') }));
      if (net.user) row.append(h('button.btn.primary.block', { html: `${icon('people', 20)} ${t('settings.acc.contacts')}`, onclick: () => open('social') }));
    } else {
      row.append(h('button.btn.second.block', { html: `${icon('people', 20)} ${t('settings.acc.title')}`, onclick: () => open('account') }));
    }
    box.append(row);
  }

  sh.on(bus, 'online:status', () => paint());
  paint();
  load();
  return sec;
}
