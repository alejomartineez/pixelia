// Paneles de Ajustes y Cómo jugar.
import { icon } from '../core/icons.js';
import { OUTFIT_COLORS } from '../core/data.js';
import { openShell, askConfirm, art, flagArt, chestArt } from './panels-common.js';

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
  root.append(section(icon('people', 24), 'Vos y tu ciudad',
    nameField('Nombre de tu personaje', 'people', () => s().player.name, v => { s().player.name = v; }, 'Pixelín', 16),
    nameField('Nombre de la ciudad', 'castle', () => s().player.cityName, v => { s().player.cityName = v; }, 'Pixelia', 18),
    // personaje y estilo de ciudad: gratis y cambiables (también desde el Vestidor y el botón paleta de la ciudad)
    h('div.pnl-acc-btns', {},
      h('button.btn.primary.block', { html: `${icon('dress', 20)} Cambiar personaje`, onclick: () => { sh.close(); ctx.router.go('wardrobe', { tab: 'type' }); } }),
      h('button.btn.second.block', { html: `${icon('palette', 20)} Estilo de la ciudad`, onclick: () => { sh.close(); import('../city/themes-ui.js').then(m => m.openThemePicker(ctx)).catch(e => console.warn('[ajustes] temas', e)); } })),
  ));

  // ---------- Cuenta y amigos ----------
  root.append(accountSection(ctx, sh, section));

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
  root.append(section(icon('castle', 24), 'Bandera de la municipalidad', h('div.pnl-flag-row', {}, flagPrev, sw)));

  // ---------- Instalar ----------
  const install = h('div.col');
  if (isStandalone()) {
    install.append(h('div.pnl-note.good', { html: `${icon('check', 22)}<span>¡Ya tenés Pixelia instalada! Abrila desde tu pantalla de inicio cuando quieras.</span>` }));
  } else {
    install.append(h('p.small.muted', {}, 'Así se abre a pantalla completa, como una app de verdad, y funciona sin internet.'));
    if (!isIOS()) install.append(h('b.pnl-install-sub', { html: `${icon('star', 16)} En el iPhone:` }));
    install.append(h('div.pnl-steps', { html: [
      ['1', icon('🧭', 40), 'Abrí el juego en <b>Safari</b>'],
      ['2', art('share', 40), 'Tocá <b>Compartir</b> (abajo)'],
      ['3', art('addHome', 40), 'Elegí <b>Agregar a inicio</b>'],
      ['4', `<img class="pi pnl-appicon" src="icons/icon-192.png" width="40" height="40" alt="">`, '¡Listo! Tocá el ícono'],
    ].map(([n, ic, t]) => `<div class="pnl-stepc"><i>${n}</i>${ic}<span>${t}</span></div>`).join('') }));
    const deferred = window.__pixeliaInstallPrompt;
    if (!isIOS() && deferred && typeof deferred.prompt === 'function') {
      const btn = h('button.btn.second.block', { html: `${icon('plus', 20)} Instalar en esta compu` });
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
  const importBtn = h('button.btn.second.block', { html: `${icon('key', 20)} Cargar partida` });
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
    <b class="pnl-credits-title">Pixelia · Tu ciudad, tu estilo</b>
    <p>Hecho con mucho ${icon('heart', 18)} y muchos píxeles,<br>especialmente para vos.</p>
    <p class="small muted">Música y sonidos chiptune hechos a mano · Tipografía Jersey 10 (OFL) · Gráficos 3D con three.js</p>
    <span class="chip primary">${icon('sparkle', 14)} Versión 1.0</span>` }));

  // ---------- Borrar ----------
  const resetBtn = h('button.btn.block.pnl-danger', { html: `${icon('trash', 20)} Borrar partida` });
  resetBtn.onclick = async () => {
    const a = await askConfirm(ctx, { title: '¿Borrar partida?', html: 'Se borra <b>toda</b> tu ciudad, tus monedas y tus logros.', ok: 'Sí, borrar', cancel: 'No', okCls: 'pnl-danger', ic: 'trash' });
    if (!a || sh.closed) return;
    const b = await askConfirm(ctx, { title: '¿De verdad, de verdad?', html: 'Esto <b>no se puede deshacer</b>. Si querés, antes copiá tu código de respaldo.', ok: 'Borrar todo', cancel: 'Me arrepentí', okCls: 'pnl-danger', ic: 'trash' });
    if (!b) return;
    store.reset();
    location.reload();
  };
  root.append(h('div.pnl-dangerzone', {}, resetBtn));

  return sh.done;
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
      text = 'Creá tu cuenta para visitar las ciudades de tus amigos, mandarles regalitos, intercambiar figuritas y guardar tu partida en la nube.';
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
      ['coin', 'Cobrá', 'Cuando aparece una burbujita arriba de un edificio, tocala para juntar monedas. Si se llena, deja de producir: ¡volvé seguido!'],
      ['hammer', 'Construí', 'Tocá <b>Construir</b>, elegí algo y ubicalo en el pasto. Podés rotarlo y moverlo cuando quieras.'],
      ['dress', 'Tu personaje', 'Elegí quién sos (persona o animalito) y vestilo en el <b>Vestidor</b>. Cambiar de personaje es gratis y lo que compraste queda guardado.'],
      ['palette', 'Estilo de la ciudad', 'Con el botón de la <b>paleta</b> en la ciudad (o en Ajustes) elegís cómo se ve: pastel, moderna, bosque, playa, invierno o noche. Es gratis.'],
      ['people', 'Población', 'Las casas traen vecinos. Muchos negocios piden un mínimo de vecinos para abrir.'],
      ['smile', 'Felicidad', 'Árboles, flores y deco hacen feliz a tu ciudad: ¡todo produce hasta un 50% más!'],
      ['castle', 'Rango y Encanto', 'Mejorá la <b>Municipalidad</b> para subir de rango, de Aldea a Capital. Cada rango pide un expediente: vecinos, felicidad, tipos de negocio y <b>Encanto</b> (deco variada y edificios mejorados). Tocá el cartel de tu rango, arriba a la izquierda.'],
      ['monument', 'Monumentos', 'Desde el rango Pueblo construís monumentos por etapas con los <b>materiales</b> que ganás en los minijuegos: cristales, ladrillos, tuercas y mapas. Cada uno terminado da un bonus para siempre. Mirá <b>Obras</b>.'],
      ['👷', 'Constructoras', 'Cada obra ocupa una constructora un ratito. Si faltan menos de 5 segundos, terminala gratis.'],
      ['games', 'Minijuegos', 'Construí la Joyería, la Torre, el Garaje y la Pista para jugar y ganar premios.'],
      ['quest', 'Misiones', 'Seguí la misión principal, hacé las 3 diarias para abrir el cofre y juntá estrellas de logro.'],
      ['gem', 'Gemas', 'Se ganan con misiones, logros, subiendo de nivel y jugando. Sirven para cosas especiales.'],
    ]],
    ['gift', 'Premios y colección', [
      ['fire', 'Racha diaria', 'Entrá cada día por tu regalo. Si un día no podés, tu <b>escudo de racha</b> de la semana la cuida. Y si volvés después de unos días, ¡te espera un regalo de bienvenida!'],
      ['chest:plata', 'Cofres', 'Los ganás jugando, subiendo de nivel y con misiones, y cada 4 horas hay uno <b>gratis</b>. Traen monedas, gemas, potenciadores, prendas y construcciones sorpresa.'],
      ['bag', 'Mochila y potenciadores', 'Lo que sale de los cofres se guarda en tu <b>mochila</b>. Los potenciadores (movidas extra, bombas, relojes, escudos) se eligen antes de empezar un minijuego.'],
      ['🃏', 'Álbum de figuritas', 'Juntá figuritas de 12 colecciones: salen en cofres y minijuegos. Completá una página para ganar un premio grande. Las repetidas se cambian por <b>brillitos</b> o se intercambian con amigos.'],
      ['sparkle', 'Pase de Temporada', 'Cada temporada dura 4 semanas. Todo lo que hacés suma <b>chispas</b> y cada nivel del pase trae premios gratis. ¡Sin apuro!'],
      ['calendar', 'Eventos', 'Cada semana hay eventos especiales: producción doble, lluvia de cofres, fiebre de figuritas, carrera de estrellas… Mirá el cartelito arriba de la pantalla.'],
    ]],
    ['heart', 'Con tus amigos', [
      ['people', 'Amigos', 'Sumá gente con tu <b>código de amistad</b> (está en Amigos y en Ajustes). Cuanto más juegan en equipo, más crece la amistad.'],
      ['home', 'Visitas', 'Visitá sus ciudades, dejales un corazón y una notita, y dales una mano para terminar sus obras.'],
      ['gift', 'Regalos', 'Mandá un regalito por día a cada persona de tu lista. Lo que te mandan llega a tu <b>Buzón</b>.'],
      ['🙋', 'Pedidos', '¿Te falta algo? Pedí una mano (hasta 3 por día) y tu gente te ayuda. Ayudar a los demás también da premios.'],
      ['rotate', 'Intercambios', 'Cambiá figuritas repetidas, monedas u objetos con tus amigos: del otro lado aceptan o rechazan.'],
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
