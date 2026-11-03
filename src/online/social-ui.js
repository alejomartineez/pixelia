// Pantalla social: hoja con pestañas Amigas · Pedidos · Buzón · Ranking · Equipo.
// Las pestañas Pedidos/Buzón están en social-mail.js y Ranking/Equipo en social-week.js.
import { h, esc, modal, toast, confirm, confetti } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/bus.js';
import { store } from '../core/state.js';
import { fmtNum } from '../core/economy.js';
import { net } from './net.js';
import {
  socialCache as cache, refreshSocial, tabCounts, openAccount, giftSentToday, giftPreview, sendDailyGift, myName,
} from './social.js';
import {
  useSocialStyle, avatarHtml, timeAgo, isOnlineNow, friendshipHtml, loadingHtml, emptyHtml, busy,
} from './social-common.js';
import { renderRequests, renderInbox } from './social-mail.js';
import { renderRanking, renderTeam } from './social-week.js';

export const TABS = [
  { id: 'amigas', name: 'Amigos', icon: 'people' },
  { id: 'pedidos', name: 'Pedidos', icon: '🤝' },
  { id: 'buzon', name: 'Buzón', icon: '📮' },
  { id: 'ranking', name: 'Ranking', icon: 'trophy' },
  { id: 'equipo', name: 'Equipo', icon: '🏗️' },
];
const RENDER = { amigas: renderFriends, pedidos: renderRequests, buzon: renderInbox, ranking: renderRanking, equipo: renderTeam };

let current = null;
/** Abre (o trae al frente) la hoja social en la pestaña pedida. */
export function openSocialUI(ctx, tab = 'amigas', opts = {}) {
  if (!RENDER[tab]) tab = 'amigas';
  if (current) { current.go(tab); return current; }
  const release = useSocialStyle();
  const pane = h('div.soc-wrap');
  const offs = [];
  let closed = false, token = 0, tabNow = tab;
  const m = modal({
    title: 'Amigos', icon: 'people', content: pane, className: 'sheet soc',
    onClose: () => { closed = true; offs.forEach(f => f()); release(); current = null; },
  });
  m.el.classList.add('soc');
  const tabsEl = h('div.soc-tabs', { role: 'tablist' });
  m.el.insertBefore(tabsEl, m.body);
  const acc = h('button.soc-acc', { 'aria-label': 'Tu cuenta', onclick: () => { audio.sfx('tap'); openAccount(ctx); } });
  m.el.querySelector('.modal-head').insertBefore(acc, m.el.querySelector('.modal-x'));

  const api = {
    ctx, m, pane, opts,
    get tab() { return tabNow; },
    live: (tok) => !closed && tok === token,
    go,
    rerender: () => go(tabNow, true),
    close: () => m.close(),
  };

  function drawAcc() {
    const u = net.user;
    const st = net.mode === 'off' ? 'off' : !u ? 'warn' : net.online ? '' : 'warn';
    acc.innerHTML = `${avatarHtml(store.state.princess, myName(), 26)}<span>${u ? esc(myName()) : net.mode === 'off' ? 'Sin conexión' : 'Entrar'}</span><b class="st ${st}"></b>`;
  }
  function drawTabs() {
    const c = tabCounts();
    tabsEl.innerHTML = '';
    for (const t of TABS) {
      const b = h('button.soc-tab' + (t.id === tabNow ? '.on' : ''), {
        role: 'tab', 'aria-selected': t.id === tabNow ? 'true' : 'false', 'data-tab': t.id,
        html: `${icon(t.icon, 20)}<span>${t.name}</span>${c[t.id] ? `<i class="soc-dot">${c[t.id] > 9 ? '9+' : c[t.id]}</i>` : ''}`,
        onclick: () => { if (t.id !== tabNow) { audio.sfx('tap'); go(t.id); } },
      });
      tabsEl.append(b);
    }
  }
  async function go(t, keepScroll = false) {
    if (!RENDER[t]) return;
    tabNow = t;
    const tok = ++token;
    const top = keepScroll ? m.body.scrollTop : 0;
    drawTabs(); drawAcc();
    tabsEl.querySelector('.soc-tab.on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    try { await RENDER[t](api, tok); }
    catch (e) { console.error('[social] pestaña', t, e); if (api.live(tok)) pane.innerHTML = emptyHtml('info', 'Ups, algo falló', 'Cerrá y volvé a abrir, o probá de nuevo en un ratito.'); }
    if (api.live(tok)) { m.body.scrollTop = top; drawTabs(); }
  }

  offs.push(bus.on('social:badge', () => !closed && drawTabs()));
  offs.push(bus.on('social:changed', () => !closed && drawTabs()));
  offs.push(bus.on('online:status', () => { if (closed) return; drawAcc(); }));
  // al entrar/salir de la cuenta, volver a dibujar todo
  let lastUser = net.user?.id || null;
  offs.push(net.onAuth(u => { if (closed) return; if ((u?.id || null) !== lastUser) { lastUser = u?.id || null; api.rerender(); } }));

  current = api;
  go(tab);
  return api;
}
export function closeSocialUI() { current?.close(); }

// ---------- Tarjeta "conectate" (sin servidor o sin sesión) ----------
export function connectCard(api, what = 'amigas') {
  const off = net.mode === 'off';
  const txt = {
    amigas: 'sumar amigos, visitar sus ciudades y mandarse regalitos',
    pedidos: 'pedirle una mano a tu gente y darles una mano',
    buzon: 'recibir regalitos, ayudas e intercambios',
  }[what] || 'jugar con tus amigos';
  const box = h('div.soc-card.soc-connect', {
    html: `<div class="soc-pals">${avatarHtml(null, 'ana', 44)}${avatarHtml(store.state.princess, myName(), 52, 'me')}${avatarHtml(null, 'bea', 44)}</div>
      <h3>${off ? 'Pixelia con amigos' : '¡Entrá a tu cuenta!'}</h3>
      <p>${off
        ? `El modo online se activa cuando se configure el servidor del juego. Ahí vas a poder ${txt}. Mientras tanto tu ciudad se guarda en este dispositivo y podés jugar todo igual 💖`
        : `Creá tu cuenta (o entrá con la que ya tenés) para ${txt}. Tu ciudad se guarda en la nube y la podés seguir desde cualquier dispositivo.`}</p>`,
  });
  box.append(h('button.btn.' + (off ? 'sky' : 'pink'), {
    html: off ? `${icon('info', 20)} ¿Cómo funciona?` : `${icon('key', 20)} Crear cuenta o entrar`,
    onclick: () => { audio.sfx('tap'); openAccount(api.ctx); },
  }));
  return box;
}

// ---------- Pestaña Amigas ----------
let myProfile = null;
async function renderFriends(api, tok) {
  const { pane } = api;
  if (!net.user) { pane.replaceChildren(connectCard(api, 'amigas')); return; }
  if (!cache.friends || !myProfile || myProfile.id !== net.user.id) pane.innerHTML = loadingHtml('Buscando a tus amigos…');
  else draw();
  const [p] = await Promise.all([myProfile?.id === net.user.id ? myProfile : net.getMyProfile(), refreshSocial(['friends'])]);
  if (p && !p.error) myProfile = p;
  if (api.live(tok)) draw();

  function draw() {
    const friends = cache.friends || [];
    const incoming = friends.filter(f => f.incoming);
    const outgoing = friends.filter(f => f.status === 'pending' && !f.incoming);
    const accepted = friends.filter(f => f.status === 'accepted');
    const nodes = [meCard(api), addCard(api)];
    if (incoming.length) {
      const sec = h('div.soc-sec', { html: `<h4>${icon('💌', 22)} Te quieren agregar<small>${incoming.length}</small></h4>` });
      for (const f of incoming) sec.append(incomingCard(api, f));
      nodes.push(sec);
    }
    const sec = h('div.soc-sec', { html: `<h4>${icon('people', 22)} Tus amigos<small>${accepted.length}</small></h4>` });
    if (!accepted.length) {
      sec.append(h('div.soc-card', { html: emptyHtml('🌷', 'Todavía no tenés amigos en Pixelia', 'Compartí tu código con tu grupo, o pedile el suyo a alguien y escribilo arriba. ¡Es gratis y súper lindo!') }));
    } else for (const f of accepted) sec.append(friendCard(api, f));
    nodes.push(sec);
    if (outgoing.length) {
      const so = h('div.soc-sec', { html: `<h4>${icon('clock', 20)} Esperando respuesta<small>${outgoing.length}</small></h4>` });
      for (const f of outgoing) so.append(outgoingCard(api, f));
      nodes.push(so);
    }
    pane.replaceChildren(...nodes);
  }
}

function meCard(api) {
  const code = myProfile?.code || '······';
  const card = h('div.soc-card.soc-me', {
    html: `${avatarHtml(store.state.princess, myName(), 64, 'me')}
      <div><small class="soc-muted">Tu código de amistad</small>
      <div class="soc-code" aria-label="Código ${esc(code)}">${[...code].map(c => `<b>${esc(c)}</b>`).join('')}</div></div>`,
  });
  const btns = h('div.soc-me-btns');
  btns.append(h('button.btn.lilac.small', {
    html: `${icon('📋', 18)} Copiar`,
    onclick: async () => {
      audio.sfx('tap');
      try { await navigator.clipboard.writeText(code); toast('¡Código copiado! Pasáselo a tu gente', { icon: 'check', type: 'good' }); }
      catch { toast(`Tu código es ${code}`, { icon: 'people' }); }
    },
  }));
  if (navigator.share) {
    btns.append(h('button.btn.pink.small', {
      html: `${icon('💌', 18)} Compartir`,
      onclick: async () => {
        audio.sfx('tap');
        const url = location.origin + location.pathname;
        try { await navigator.share({ title: 'Pixelia', text: `¡Sumate a Pixelia y juguemos! Mi código es ${code} 👑`, url }); } catch {}
      },
    }));
  }
  card.append(btns);
  return card;
}

function addCard(api) {
  const card = h('div.soc-card.soc-sec');
  card.append(h('b', { html: `${icon('plus', 18)} Sumar amistad` }));
  const row = h('div.soc-add');
  const input = h('input', { type: 'text', maxlength: '6', placeholder: 'Código de 6 letras', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Código de amistad' });
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
  const btn = h('button.btn.pink', { html: 'Agregar' });
  const send = () => busy(btn, async () => {
    const code = input.value.trim();
    if (code.length !== 6) { audio.sfx('error'); return { error: 'El código tiene 6 letras y números' }; }
    const r = await net.requestFriend(code);
    if (r?.error) { audio.sfx('error'); return r; }
    input.value = '';
    if (r.status === 'accepted') { audio.sfx('win'); confetti(50); toast(`¡Ahora vos y ${r.name} son amigos!`, { icon: 'heart', type: 'good' }); }
    else { audio.sfx('swoosh'); toast(`Solicitud enviada a ${r.name} 💌`, { icon: 'check', type: 'good' }); }
    await refreshSocial(['friends']);
    api.rerender();
    return r;
  });
  btn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  row.append(input, btn);
  card.append(row);
  return card;
}

function incomingCard(api, f) {
  const c = h('div.soc-card.pink.soc-req', {
    html: `${avatarHtml(f.look, f.name, 48)}<div class="soc-grow"><b class="soc-ellip">${esc(f.name)}</b><span class="soc-muted">Nivel ${f.level} · te quiere agregar</span></div>`,
  });
  const no = h('button.btn.ghost.small', { 'aria-label': 'Rechazar', html: icon('close', 16) });
  const yes = h('button.btn.mint.small', { html: `${icon('check', 18)} Aceptar` });
  yes.onclick = () => busy(yes, async () => {
    const r = await net.respondFriend(f.id, true);
    if (r?.error) return r;
    audio.sfx('win'); confetti(50);
    toast(`¡Ahora vos y ${f.name} son amigos!`, { icon: 'heart', type: 'good' });
    await refreshSocial(['friends']); api.rerender();
    return r;
  });
  no.onclick = () => busy(no, async () => {
    const r = await net.respondFriend(f.id, false);
    if (r?.error) return r;
    audio.sfx('close');
    await refreshSocial(['friends']); api.rerender();
    return r;
  });
  c.append(no, yes);
  return c;
}

function outgoingCard(api, f) {
  const c = h('div.soc-card.soc-req', {
    html: `${avatarHtml(f.look, f.name, 40)}<div class="soc-grow"><b class="soc-ellip">${esc(f.name)}</b><span class="soc-muted">Le mandaste solicitud · código ${esc(f.code)}</span></div>`,
  });
  const x = h('button.btn.ghost.small', { html: 'Cancelar' });
  x.onclick = () => busy(x, async () => {
    const r = await net.removeFriend(f.id);
    if (r?.error) return r;
    await refreshSocial(['friends']); api.rerender();
    return r;
  });
  c.append(x);
  return c;
}

function friendCard(api, f) {
  const on = isOnlineNow(f.last_seen);
  const card = h('div.soc-card.soc-friend', {
    'data-friend': f.id,
    html: `<span style="position:relative">${avatarHtml(f.look, f.name, 56)}${on ? '<i class="soc-on" title="En línea"></i>' : ''}</span>
      <div class="soc-grow">
        <div class="soc-name"><b>${esc(f.name)}</b><span class="soc-lv">${icon('star', 14)}${f.level}</span></div>
        <div class="soc-seen${on ? ' on' : ''}">${on ? '¡En línea ahora!' : `Se conectó ${timeAgo(f.last_seen)}`}${f.city_name ? ` · ${esc(f.city_name)}` : ''}</div>
        ${friendshipHtml(f)}
      </div>`,
  });
  const rm = h('button.soc-x', { 'aria-label': `Dejar de ser amigos con ${f.name}`, html: icon('close', 14) });
  rm.onclick = async () => {
    audio.sfx('tap');
    if (!(await confirm('¿Dejar de ser amigos?', `Vas a dejar de ver a <b>${esc(f.name)}</b> y se pierde su nivel de amistad. Los intercambios pendientes se devuelven.`, 'Sí, quitar', 'No'))) return;
    const r = await net.removeFriend(f.id);
    if (r?.error) { toast(r.error, { icon: 'info', type: 'bad' }); return; }
    await refreshSocial(['friends', 'trades']); api.rerender();
  };
  card.append(rm);
  const acts = h('div.soc-acts');
  acts.append(h('button.btn.sky.small', {
    html: `${icon('home', 18)} Visitar`,
    onclick: () => { audio.sfx('tap'); api.close(); api.ctx.router.go('city', { visit: f.id, name: f.name }); },
  }));
  const sent = giftSentToday(f.id);
  const gift = h('button.btn.pink.small' + (sent ? '.done' : ''), {
    html: sent ? `${icon('check', 16)} Enviado` : `${icon('gift', 18)} Regalito`,
    disabled: sent, title: sent ? 'Mañana le podés mandar otro' : `Le mandás ${fmtNum(giftPreview(f).coins)} monedas y a veces una sorpresa`,
  });
  gift.onclick = () => busy(gift, async () => {
    const r = await sendDailyGift(f);
    if (r?.error) { if (/Ya le mandaste/.test(r.error)) api.rerender(); return r; }
    audio.sfx('swoosh');
    const extra = r.payload.items || r.payload.stickers ? ' ¡con sorpresa!' : '';
    toast(`¡Regalito enviado a ${f.name}!${extra}`, { icon: 'gift', type: 'good' });
    gift.classList.add('done'); gift.innerHTML = `${icon('check', 16)} Enviado`;
    setTimeout(() => { if (gift.isConnected) gift.disabled = true; }, 0);
    return r;
  });
  acts.append(gift);
  acts.append(h('button.btn.lilac.small', {
    html: `${icon('🔄', 18)} Cambiar`,
    'aria-label': `Intercambiar con ${f.name}`,
    onclick: () => { audio.sfx('tap'); import('./social-trade.js').then(mod => mod.openTradeEditor(api.ctx, { friend: f, onDone: () => api.rerender() })); },
  }));
  card.append(acts);
  return card;
}

