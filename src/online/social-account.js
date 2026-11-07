// Cuenta online (crear / entrar / salir / estado de sincronización / modo simulado) y elección de partida.
import { h, esc, modal, toast, confirm } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { fmtNum } from '../core/economy.js';
import { net, isDefaultName, DEFAULT_PLAYER_NAME } from './net.js';
import { getSyncStatus, pushNow, resolveConflict, publishProfileNow } from './sync.js';
import { socialState } from './social.js';
import { useSocialStyle, avatarHtml, timeAgo, busy } from './social-common.js';

let open = null;
/** opts.reason: 'trade' (vino del álbum) para explicar por qué hace falta la cuenta. */
export function openAccountUI(ctx, opts = {}) {
  if (open) { open.draw(); return open; }
  const release = useSocialStyle();
  const body = h('div.soc-form');
  const offs = [];
  let tab = 'signup';
  const m = modal({
    title: 'Tu cuenta', icon: 'key', content: body, className: 'soc soc-account',
    onClose: () => { offs.forEach(f => f()); release(); open = null; },
  });
  const api = { draw: () => draw(), close: () => m.close() };
  open = api;
  offs.push(bus.on('online:status', () => draw()));
  offs.push(net.onAuth(() => draw()));

  function draw() {
    if (net.mode === 'off') return drawOff();
    if (!net.ready) { body.innerHTML = '<div class="soc-loading"><span class="soc-dots"><i></i><i></i><i></i></span>Conectando…</div>'; net.init().then(() => open === api && draw()); return; }
    if (net.user) return drawIn();
    return drawOut();
  }

  function drawOff() {
    body.innerHTML = `
      <div class="soc-off-art">${icon('🏡', 40)}${icon('💌', 40)}${icon('👭', 40)}</div>
      <h3 class="center" style="font-size:21px">Jugar online, ¡muy pronto!</h3>
      <p class="center soc-muted" style="font-size:16px">${opts.reason === 'trade' ? 'Los intercambios de figuritas son con tus contactos online. ' : ''}El modo online se activa cuando se configure el servidor del juego. Ahí vas a poder crear tu cuenta, sumar contactos con un código, visitar sus ciudades, mandarse regalos e intercambiar figuritas.</p>
      <div class="soc-card mint soc-row">${icon('save', 28)}<span class="soc-muted">Mientras tanto, <b>tu ciudad se guarda en este dispositivo</b> y podés jugar todo igual.</span></div>`;
    const test = h('div.soc-card.soc-sec', { html: `<b>${icon('🧪', 18)} Modo simulado (para pruebas)</b><span class="soc-muted">Simula el servidor en este navegador: abrí dos pestañas con nombres distintos y probá la amistad.</span>` });
    const row = h('div.soc-row');
    const who = h('input', { type: 'text', placeholder: 'Ej: ana', maxlength: '16', 'aria-label': 'Nombre de prueba' });
    const go = h('button.btn.gold.small', { html: 'Probar' });
    go.onclick = () => {
      const u = who.value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      const q = new URLSearchParams(location.search);
      q.set('mock', '1');
      if (u) q.set('mockuser', u); else q.delete('mockuser');
      q.delete('scene');
      location.search = q.toString();
    };
    row.append(who, go);
    test.append(row);
    body.append(test);
    body.append(h('button.btn.primary.block', { html: 'Entendido', onclick: () => { audio.sfx('tap'); m.close(); } }));
  }

  function drawOut() {
    body.innerHTML = '';
    if (net.mode === 'mock') body.append(h('span.soc-mock', { html: `${icon('🧪', 14)} Modo simulado: las cuentas viven en este navegador` }));
    body.append(h('div.soc-row', {
      html: `${avatarHtml(store.state.avatar, store.state.player.name, 56, 'me')}<p class="soc-muted soc-grow">${opts.reason === 'trade' ? 'Para intercambiar figuritas con tus contactos necesitás tu cuenta. ' : ''}Con tu cuenta, tu ciudad se guarda en la nube y podés jugar con tus contactos.</p>`,
    }));
    const seg = h('div.soc-seg');
    for (const [id, label] of [['signup', 'Crear cuenta'], ['signin', 'Ya tengo cuenta']]) {
      seg.append(h('button' + (tab === id ? '.on' : ''), { html: label, onclick: () => { if (tab !== id) { audio.sfx('tap'); tab = id; drawOut(); } } }));
    }
    body.append(seg);
    const err = h('div.soc-err');
    const name = h('input', { type: 'text', maxlength: '24', autocomplete: 'nickname', value: isDefaultName(store.state.player.name) ? '' : store.state.player.name });
    const email = h('input', { type: 'email', autocomplete: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false' });
    const pass = h('input', { type: 'password', autocomplete: tab === 'signup' ? 'new-password' : 'current-password', minlength: '6' });
    if (tab === 'signup') body.append(h('label', {}, 'Tu nombre (lo ven tus contactos)', name));
    body.append(h('label', {}, 'Email', email), h('label', {}, tab === 'signup' ? 'Contraseña (6 o más)' : 'Contraseña', pass));
    const go = h('button.btn.primary.block', { html: tab === 'signup' ? `${icon('sparkle', 20)} Crear mi cuenta` : `${icon('key', 20)} Entrar` });
    const submit = () => busy(go, async () => {
      err.textContent = '';
      // el nombre elegido se aplica ANTES de crear la cuenta: signUp avisa la sesión nueva (y redibuja la
      // tarjeta "con sesión") antes de volver, así la tarjeta ya muestra el nombre nuevo. Si falla, se revierte.
      const prevName = store.state.player.name;
      const chosen = tab === 'signup' && name.value.trim() && isDefaultName(prevName)
        ? [...name.value.replace(/\s+/g, ' ').trim()].slice(0, 16).join('').trim() || DEFAULT_PLAYER_NAME : null;
      if (chosen) store.state.player.name = chosen;
      const r = tab === 'signup' ? await net.signUp(email.value, pass.value, name.value) : await net.signIn(email.value, pass.value);
      const revert = () => { if (chosen && store.state.player.name === chosen) { store.state.player.name = prevName; store.markDirty(); } };
      if (r?.error) { revert(); audio.sfx('error'); err.textContent = r.error; return null; }
      if (r?.needsConfirm) { revert(); toast(r.message, { icon: 'info' }); tab = 'signin'; drawOut(); return null; }
      if (chosen) {
        store.markDirty(); store.save();
        ctx?.hud?.refresh?.();
      }
      const z = socialState(); if (z) { z.skipAccount = false; store.markDirty(); }
      audio.sfx('win');
      toast(tab === 'signup' ? 'Cuenta creada. Ya estás en Pixelia online.' : `¡Hola de nuevo, ${store.state.player.name}!`, { icon: 'heart', type: 'good' });
      publishProfileNow(true);
      return r;
    });
    go.onclick = submit;
    for (const i of [name, email, pass]) i.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    body.append(err, go);
    body.append(h('button.btn.ghost.block', {
      html: 'Jugar sin cuenta',
      onclick: () => { audio.sfx('tap'); const z = socialState(); if (z) { z.skipAccount = true; store.markDirty(); } m.close(); },
    }));
  }

  function drawIn() {
    const st = getSyncStatus();
    const s = store.state;
    body.innerHTML = '';
    if (net.mode === 'mock') body.append(h('span.soc-mock', { html: `${icon('🧪', 14)} Modo simulado` }));
    body.append(h('div.soc-card.soc-row', {
      html: `${avatarHtml(s.avatar, s.player.name, 60, 'me')}<div class="soc-grow"><b style="font-size:20px">${esc(s.player.name)}</b>
        <div class="soc-muted soc-ellip">${esc(net.user.email || '')}</div><div class="soc-muted">Nivel ${s.player.level} · ${esc(s.player.cityName || 'Pixelia')}</div></div>`,
    }));
    const online = st.online;
    let line;
    if (st.conflict) line = `${icon('info', 16)} Hay dos partidas distintas: elegí cuál seguir`;
    else if (!online) line = 'Sin conexión: se guarda en este dispositivo y se sube sola cuando vuelva internet.';
    else if (st.syncing) line = 'Guardando en la nube…';
    else if (st.lastSync) line = `Guardado en la nube ${timeAgo(st.lastSync)}.`;
    else line = 'Tu ciudad se guarda sola en la nube cada pocos minutos.';
    body.append(h('div.soc-card.sky.soc-sync' + (online ? '' : '.off'), {
      html: `<span class="soc-cloud">${icon(online ? '☁️' : '📴', 32)}</span><div class="soc-grow"><b>${online ? 'Sincronizada' : 'Sin conexión'}</b><div class="soc-muted">${line}</div></div>`,
    }));
    const row = h('div.soc-row');
    const save = h('button.btn.sky.small', { html: `${icon('save', 18)} Guardar ahora`, style: { flex: '1' } });
    save.onclick = () => busy(save, async () => {
      if (st.conflict) { const { handleConflict } = await import('./social.js'); handleConflict(ctx); return null; }
      const r = await pushNow();
      if (r?.error) return r;
      if (r?.conflict) return null;
      await publishProfileNow(true);
      audio.sfx('done');
      toast('¡Guardado en la nube!', { icon: 'check', type: 'good' });
      draw();
      return r;
    });
    const out = h('button.btn.ghost.small', { html: 'Cerrar sesión', style: { flex: '1' } });
    out.onclick = async () => {
      audio.sfx('tap');
      if (!(await confirm('¿Cerrar sesión?', 'Tu ciudad queda guardada en la nube y en este dispositivo. Podés volver a entrar cuando quieras.', 'Cerrar sesión', 'Cancelar'))) return;
      await busy(out, async () => { await pushNow(); return net.signOut(); });
      toast('Sesión cerrada. Hasta la próxima.', { icon: 'info' });
    };
    row.append(save, out);
    body.append(row);
    body.append(h('button.btn.primary.block', {
      html: `${icon('people', 20)} Ir a mis contactos`,
      onclick: () => { audio.sfx('tap'); m.close(); import('./social.js').then(mod => mod.openSocial(ctx, 'amigas')); },
    }));
  }

  draw();
  return api;
}

// ---------- Elegir partida ----------
/** Dos partidas distintas (este dispositivo vs nube). -> Promise<'local'|'cloud'|null> */
export function conflictModal(ctx, info) {
  return new Promise((resolve) => {
    const release = useSocialStyle();
    let result = null;
    const loc = info.local || {}, cl = info.cloud || {};
    const rec = (cl.level || 0) > (loc.level || 0) || ((cl.level || 0) === (loc.level || 0) && (cl.xp || 0) > (loc.xp || 0)) ? 'cloud' : 'local';
    const body = h('div.soc-form');
    body.append(h('p.center.soc-muted', { html: 'Encontramos <b>dos partidas distintas</b>: una en este dispositivo y otra guardada en la nube. ¿Con cuál seguís? La otra se reemplaza.' }));
    const grid = h('div.soc-cf');
    const err = h('div.soc-err');
    const card = (which, d, title, ic) => {
      const c = h('div.soc-card' + (rec === which ? '.rec' : ''), {
        html: `${icon(ic, 34)}<b>${title}</b><span class="soc-tag ok" style="${rec === which ? '' : 'visibility:hidden'}">Más avanzada</span>
          <div class="soc-big">Nv ${d.level || 1}</div>
          <dl><dt>${icon('coin', 16)}</dt><dd>${fmtNum(d.coins || 0)}</dd><dt>${icon('gem', 16)}</dt><dd>${fmtNum(d.gems || 0)}</dd>
          <dt>${icon('home', 16)}</dt><dd>${fmtNum(d.buildings || 0)} edif.</dd></dl>
          <small class="soc-muted">${d.at ? `Guardada ${timeAgo(d.at)}` : 'Sin fecha'}</small>`,
      });
      const b = h('button.btn.' + (rec === which ? 'primary' : 'ghost'), { html: 'Usar esta' });
      b.onclick = () => busy(b, async () => {
        err.textContent = '';
        const r = await resolveConflict(which);
        if (r?.error) { err.textContent = r.error; return null; }
        result = which;
        audio.sfx('done');
        if (which === 'local') toast('¡Listo! Seguís con la partida de este dispositivo', { icon: 'check', type: 'good' });
        m.close();
        return r;
      });
      c.append(b);
      return c;
    };
    grid.append(card('local', loc, 'Este dispositivo', '📱'), card('cloud', cl, 'En la nube', '☁️'));
    body.append(grid, err);
    const m = modal({ title: '¿Qué partida seguimos?', icon: 'save', content: body, className: 'soc soc-account', closable: false, onClose: () => { release(); resolve(result); } });
  });
}
