// Paneles de Ajustes y Cómo jugar.
import { icon, iconUrl } from '../core/icons.js';
import { OUTFIT_COLORS } from '../core/data.js';
import { openShell, askConfirm, art, flagArt } from './panels-common.js';

const isStandalone = () => !!(navigator.standalone || matchMedia?.('(display-mode: standalone)').matches);
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function openSettings(ctx) {
  const sh = openShell(ctx, 'settings', { title: 'Ajustes', ic: 'gear', sheet: true, className: 'pnl-settings' });
  if (!sh) return;
  const { ui, audio, store, bus } = ctx;
  const { h, esc } = ui;
  const s = () => ctx.state;
  const root = h('div.col.pnl-gap');
  sh.body.append(root);

  const section = (ic, title, ...children) => h('section.card.pnl-sec', {}, h('h3.pnl-sec-title', { html: `${ic}<span>${title}</span>` }), ...children);

  // ---------- Sonido ----------
  function toggle(key, label, ic) {
    const btn = h('button.pnl-toggle', { role: 'switch' });
    const paint = () => {
      const on = !!s().settings[key];
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.classList.toggle('on', on);
      btn.innerHTML = `<span class="pnl-toggle-lbl">${icon(on ? ic : 'mute', 24)}<b>${label}</b></span><span class="pnl-switch"><i></i></span>`;
    };
    btn.onclick = () => {
      s().settings[key] = !s().settings[key];
      store.markDirty();
      audio.configure(s().settings);
      audio.sfx('select');
      paint();
    };
    paint();
    return btn;
  }
  root.append(section(icon('music', 24), 'Sonido', h('div.pnl-toggles', {}, toggle('music', 'Música', 'music'), toggle('sfx', 'Sonidos', 'sound'))));

  // ---------- Nombres ----------
  function nameField(label, ic, get, set, fallback, max) {
    const input = h('input', { type: 'text', maxlength: String(max), value: get(), autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', 'aria-label': label });
    const save = (final) => {
      let v = input.value.replace(/\s+/g, ' ');
      if (final) { v = v.trim() || fallback; input.value = v; }
      if (!v.trim()) return;
      if (v.trim() !== get()) { set(v.trim()); store.markDirty(); ctx.hud?.refresh?.(); }
    };
    input.addEventListener('input', () => save(false));
    input.addEventListener('change', () => save(true));
    input.addEventListener('blur', () => save(true));
    // que las teclas no lleguen a la escena de atrás (pero Esc/Enter cierran el teclado)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key !== 'Escape') e.stopPropagation();
    });
    return h('label.pnl-field', {}, h('span.pnl-field-lbl', { html: `${icon(ic, 20)} ${label}` }), input);
  }
  root.append(section(icon('crown', 24), 'Tu reino',
    nameField('Nombre de la princesa', 'crown', () => s().player.name, v => { s().player.name = v; }, 'Princesa', 16),
    nameField('Nombre de la ciudad', 'castle', () => s().player.cityName, v => { s().player.cityName = v; }, 'Pixelia', 18),
  ));

  // ---------- Bandera ----------
  const flagPrev = h('span.pnl-flag-prev');
  const sw = h('div.swatches.pnl-swatches');
  const paintFlag = () => {
    const cur = OUTFIT_COLORS.find(c => c.id === s().city.flagColor) || OUTFIT_COLORS[0];
    flagPrev.innerHTML = flagArt(cur.hex, 56);
    for (const b of sw.children) b.classList.toggle('active', b.dataset.id === cur.id);
  };
  for (const c of OUTFIT_COLORS) {
    sw.append(h('button.swatch', {
      'data-id': c.id, 'aria-label': 'Color ' + c.id, style: { background: c.hex },
      onclick: () => {
        if (s().city.flagColor === c.id) return;
        s().city.flagColor = c.id;
        store.markDirty();
        audio.sfx('select');
        bus.emit('city:flag', { color: c.id, hex: c.hex });
        paintFlag();
        flagPrev.classList.remove('pnl-wave'); void flagPrev.offsetWidth; flagPrev.classList.add('pnl-wave');
      },
    }));
  }
  paintFlag();
  root.append(section(icon('castle', 24), 'Bandera del castillo', h('div.pnl-flag-row', {}, flagPrev, sw)));

  // ---------- Instalar ----------
  const install = h('div.col');
  if (isStandalone()) {
    install.append(h('div.pnl-note.good', { html: `${icon('check', 22)}<span>¡Ya tenés Pixelia instalada! Abrila desde tu pantalla de inicio cuando quieras.</span>` }));
  } else {
    install.append(h('p.small.muted', {}, 'Así se abre a pantalla completa, como una app de verdad, y funciona sin internet.'));
    if (!isIOS()) install.append(h('b.pnl-install-sub', { html: `${icon('star', 16)} En el iPhone:` }));
    install.append(h('div.pnl-steps', { html: [
      ['1', `<img class="pi" src="${iconUrl('🧭')}" width="40" height="40" alt="">`, 'Abrí el juego en <b>Safari</b>'],
      ['2', art('share', 40), 'Tocá <b>Compartir</b> (abajo)'],
      ['3', art('addHome', 40), 'Elegí <b>Agregar a inicio</b>'],
      ['4', `<img class="pi pnl-appicon" src="icons/icon-192.png" width="40" height="40" alt="">`, '¡Listo! Tocá el ícono'],
    ].map(([n, ic, t]) => `<div class="pnl-stepc"><i>${n}</i>${ic}<span>${t}</span></div>`).join('') }));
    const deferred = window.__pixeliaInstallPrompt;
    if (!isIOS() && deferred && typeof deferred.prompt === 'function') {
      const btn = h('button.btn.lilac.block', { html: `${icon('plus', 20)} Instalar en esta compu` });
      btn.onclick = async () => {
        // el aviso de instalación del navegador se puede usar una sola vez
        btn.disabled = true;
        try { await deferred.prompt(); } catch (e) { console.warn(e); }
        window.__pixeliaInstallPrompt = null;
        btn.remove();
      };
      install.append(btn);
    } else if (!isIOS()) {
      install.append(h('p.pnl-note', { html: `${icon('info', 18)}<span><b>En la compu:</b> en Chrome o Edge tocá el botón de instalar que aparece a la derecha de la barra de direcciones.</span>` }));
    }
  }
  root.append(section(icon('home', 24), isIOS() || isStandalone() ? 'Instalar en el iPhone' : 'Instalar como app', install));

  // ---------- Copia de seguridad ----------
  const exportBox = h('div.col.hidden');
  const exportArea = h('textarea.pnl-code', { readonly: true, rows: '3', 'aria-label': 'Código de tu partida' });
  const exportHint = h('p.small.muted', {}, '');
  exportBox.append(exportHint, exportArea);
  const copyBtn = h('button.btn.sky.block', { html: `${icon('save', 20)} Copiar código` });
  copyBtn.onclick = async () => {
    store.save();
    const code = store.exportCode();
    exportArea.value = code;
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(code); ok = true; } } catch { ok = false; }
    // el cuadro se muestra siempre: así se ve qué se copió y se puede volver a copiar a mano
    exportBox.classList.remove('hidden');
    if (!ok) {
      exportArea.focus(); exportArea.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
    }
    exportHint.textContent = ok
      ? '¡Listo! Pegalo en tus notas o mandátelo por chat. Este es tu código:'
      : 'Mantené apretado (o Ctrl+C) para copiar este código y guardalo en un lugar seguro:';
    if (ok) { audio.sfx('done'); ui.toast('¡Código copiado! Guardalo bien', { icon: 'check', type: 'good' }); }
    else { audio.sfx('select'); ui.toast('Copialo a mano desde el cuadro', { icon: 'info' }); }
  };
  const importArea = h('textarea.pnl-code', { rows: '3', placeholder: 'Pegá acá un código de partida…', 'aria-label': 'Código para cargar', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off' });
  importArea.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
  const importBtn = h('button.btn.lilac.block', { html: `${icon('key', 20)} Cargar partida` });
  importBtn.onclick = async () => {
    // al pegar desde un chat pueden colarse espacios, saltos de línea o comillas: dejamos solo base64
    const code = importArea.value.replace(/[^A-Za-z0-9+/=]/g, '');
    if (!code) { audio.sfx('error'); ui.toast('Primero pegá el código', { icon: 'info' }); importArea.focus(); return; }
    const ok = await askConfirm(ctx, { title: '¿Cargar partida?', html: 'Tu partida actual se va a reemplazar por la del código.', ok: 'Cargar', cancel: 'Mejor no', ic: 'key' });
    if (!ok) return;
    try {
      store.importCode(code);
      ui.toast('¡Partida cargada!', { icon: 'check', type: 'good' });
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      console.warn('import', e);
      audio.sfx('error');
      ui.toast('Ese código no funciona', { icon: 'close', type: 'bad' });
    }
  };
  root.append(section(icon('save', 24), 'Copia de seguridad',
    h('p.small.muted', {}, 'Guardá un código con tu partida para pasarla a otro celu o compu.'),
    copyBtn, exportBox,
    h('div.pnl-sep'),
    importArea, importBtn,
  ));

  // ---------- Ayuda y créditos ----------
  root.append(h('button.btn.mint.block.pnl-helpbtn', { html: `${icon('info', 22)} Cómo jugar`, onclick: () => ctx.openPanel('help') }));
  root.append(h('section.card.pnl-credits', { html: `
    <div class="pnl-credits-crown pnl-bob">${icon('crown', 48)}</div>
    <b class="pnl-credits-title">Pixelia · Ciudad de Princesas</b>
    <p>Hecho con mucho ${icon('heart', 18)} y muchos píxeles,<br>especialmente para vos.</p>
    <p class="small muted">Música y sonidos chiptune hechos a mano · Tipografía Jersey 10 (OFL) · Gráficos 3D con three.js</p>
    <span class="chip pink">${icon('sparkle', 14)} Versión 1.0</span>` }));

  // ---------- Borrar ----------
  const resetBtn = h('button.btn.block.pnl-danger', { html: `${icon('trash', 20)} Borrar partida` });
  resetBtn.onclick = async () => {
    const a = await askConfirm(ctx, { title: '¿Borrar partida?', html: 'Se borra <b>toda</b> tu ciudad, tus monedas y tus logros.', ok: 'Sí, borrar', cancel: 'No', okCls: 'pnl-danger', ic: 'trash' });
    if (!a || sh.closed) return;
    const b = await askConfirm(ctx, { title: '¿Segurísima?', html: 'Esto <b>no se puede deshacer</b>. Si querés, antes copiá tu código de respaldo.', ok: 'Borrar todo', cancel: 'Me arrepentí', okCls: 'pnl-danger', ic: 'trash' });
    if (!b) return;
    store.reset();
    location.reload();
  };
  root.append(h('div.pnl-dangerzone', {}, resetBtn));

  return sh.done;
}

// ---------- Cómo jugar ----------
export function openHelp(ctx) {
  const sh = openShell(ctx, 'help', { title: 'Cómo jugar', ic: 'info', className: 'pnl-md pnl-help', actions: [{ label: '¡Entendido!', cls: 'pink' }] });
  if (!sh) return;
  const { h } = ctx.ui;
  const items = [
    ['coin', 'Cobrá', 'Cuando aparece una burbujita arriba de un edificio, tocala para juntar monedas. Si se llena, deja de producir: ¡volvé seguido!'],
    ['hammer', 'Construí', 'Tocá <b>Construir</b>, elegí algo y ubicalo en el pasto. Podés rotarlo y moverlo cuando quieras.'],
    ['people', 'Población', 'Las casas traen vecinas. Muchos negocios piden un mínimo de vecinas para abrir.'],
    ['smile', 'Felicidad', 'Árboles, flores y deco hacen feliz a tu ciudad: ¡todo produce hasta un 50% más!'],
    ['👷', 'Constructoras', 'Cada obra ocupa una constructora un ratito. Si faltan menos de 5 segundos, terminala gratis.'],
    ['games', 'Minijuegos', 'Construí la Joyería, la Torre, el Garaje y la Pista para jugar y ganar premios.'],
    ['quest', 'Misiones', 'Seguí la misión principal, hacé las 3 diarias para abrir el cofre y juntá estrellas de logro.'],
    ['gem', 'Gemas', 'Se ganan con misiones, logros, subiendo de nivel y jugando. Sirven para cosas especiales.'],
  ];
  const list = h('div.pnl-help-list', { html: items.map(([ic, t, d]) => `
    <div class="pnl-help-item"><span class="pnl-help-ic">${icon(ic, 32)}</span><span><b>${t}</b><small>${d}</small></span></div>`).join('') });
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
