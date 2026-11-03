// Pestañas "Pedidos" (pedí una mano / ayudá a tus amigas) y "Buzón" (regalos, entregas, intercambios, visitas).
import { h, esc, toast, confetti } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { fmtNum } from '../core/economy.js';
import { POINTS } from '../season/season-data.js';
import { stickerDef, stickerCount } from '../album/album.js';
import { net } from './net.js';
import { canAffordPayload } from './sync.js';
import {
  socialCache as cache, refreshSocial, helperReward, canFill, fillFriendRequest, claimAll, claimOne,
  acceptTrade, declineTrade, cancelTrade, utcDay, REQUEST_KINDS,
} from './social.js';
import {
  avatarHtml, timeAgo, fmtLeft, loadingHtml, emptyHtml, busy, payloadChips, stickerCard, itemIcon, itemName, flyFrom,
} from './social-common.js';
import { connectCard } from './social-ui.js';

const nameOf = (id) => cache.friends?.find(f => f.id === id)?.name || 'Alguien';
const lookOf = (id) => cache.friends?.find(f => f.id === id)?.look || null;

// ---------- Pedidos ----------
/** {icon html, title} de lo que se pide. */
export function requestWhat(req, size = 40) {
  const p = req.payload || {};
  if (req.kind === 'sticker') {
    const id = Object.keys(p.stickers || {})[0];
    const d = stickerDef(id);
    return { ic: null, sticker: id, title: d ? `${d.name}` : 'Una figurita', sub: d ? `Figurita #${d.n} · ${d.setName} · ${'★'.repeat(d.stars)}` : '' };
  }
  if (req.kind === 'item') {
    const id = Object.keys(p.items || {})[0];
    return { ic: itemIcon(id, size), title: itemName(id), sub: 'Objeto de la mochila' };
  }
  if (req.kind === 'coins') return { ic: icon('coin', size), title: `${fmtNum(p.coins || 0)} monedas`, sub: 'Para terminar algo lindo' };
  return { ic: icon('⏳', size), title: `Acelerar una obra`, sub: `Le adelantás ${p.minutes || 30} minutos (no te cuesta nada)` };
}
function needIcon(w) {
  const box = h('div.soc-need-ic');
  if (w.sticker) box.append(stickerCard(w.sticker, { owned: stickerCount(w.sticker) > 0 }));
  else box.innerHTML = w.ic;
  return box;
}
const todayCount = () => (cache.myReqs || []).filter(r => (r.created_at || '').slice(0, 10) === utcDay()).length;

export async function renderRequests(api, tok) {
  const { pane } = api;
  if (!net.user) { pane.replaceChildren(connectCard(api, 'pedidos')); return; }
  if (!cache.friendReqs || !cache.myReqs) pane.innerHTML = loadingHtml('Mirando quién necesita una mano…');
  else draw();
  await refreshSocial(['requests', ...(cache.friends ? [] : ['friends'])]);
  if (api.live(tok)) draw();

  function draw() {
    const nodes = [];
    // --- mis pedidos ---
    const used = Math.min(3, todayCount());
    const mine = h('div.soc-sec');
    const head = h('div.soc-card.sky.soc-mine', {
      html: `${icon('🤝', 40)}<div class="soc-grow"><b style="font-size:18px">Pedí una mano</b>
        <div class="soc-muted">Hasta 3 pedidos por día. Tu gente te ayuda y gana premios.</div>
        <div class="soc-row" style="margin-top:4px"><span class="soc-slots">${[0, 1, 2].map(i => `<i class="${i < used ? 'used' : ''}"></i>`).join('')}</span><small class="soc-muted">${3 - used} disponible${3 - used === 1 ? '' : 's'} hoy</small></div></div>`,
    });
    const ask = h('button.btn.pink', { html: `${icon('plus', 18)} Pedir`, disabled: used >= 3 });
    ask.onclick = () => { audio.sfx('tap'); import('./social-trade.js').then(m => m.openRequestCreator(api.ctx, { onDone: () => api.rerender() })); };
    head.append(ask);
    mine.append(head);
    for (const r of cache.myReqs || []) mine.append(myRequestCard(r));
    nodes.push(mine);

    // --- pedidos de amigas ---
    const fr = cache.friendReqs || [];
    const sec = h('div.soc-sec', { html: `<h4>${icon('people', 22)} Pedidos de tus amigos<small>${fr.length}</small></h4>` });
    if (!fr.length) sec.append(h('div.soc-card', { html: emptyHtml('🌤️', 'Nadie necesita nada por ahora', 'Cuando alguien pida una mano, aparece acá. Ayudar te da monedas, chispas del pase y amistad.') }));
    for (const r of fr) sec.append(friendRequestCard(api, r));
    nodes.push(sec);
    pane.replaceChildren(...nodes);
  }
}

function myRequestCard(r) {
  const w = requestWhat(r, 32);
  const expired = !r.filled_by && Date.parse(r.expires_at) <= Date.now();
  const tag = r.filled_by
    ? `<span class="soc-tag ok">${icon('check', 14)} ${esc(r.filled_by_name || 'Alguien')} te ayudó ${timeAgo(r.filled_at)}</span>`
    : expired ? '<span class="soc-tag old">Venció</span>'
    : `<span class="soc-tag wait">${icon('clock', 14)} Vence en ${fmtLeft(Date.parse(r.expires_at) - Date.now())}</span>`;
  const c = h('div.soc-card.soc-need', { style: expired ? { opacity: '.7' } : null });
  c.append(needIcon(w), h('div.soc-grow', { html: `<b>${esc(w.title)}</b><div class="soc-muted">${esc(w.sub)}</div><div style="margin-top:4px">${tag}</div>` }));
  return c;
}

function friendRequestCard(api, r) {
  const w = requestWhat(r, 36);
  const can = canFill(r);
  const reward = helperReward(r);
  const c = h('div.soc-card.soc-need');
  c.append(needIcon(w), h('div.soc-grow', {
    html: `<div class="soc-row">${avatarHtml(lookOf(r.from_id), r.from_name, 28)}<b class="soc-ellip">${esc(r.from_name || 'Alguien')}</b><small class="soc-muted" style="margin-left:auto">${fmtLeft(Date.parse(r.expires_at) - Date.now())}</small></div>
      <div style="margin-top:3px"><b>${esc(w.title)}</b></div><div class="soc-muted">${esc(w.sub)}${w.sticker ? ` · tenés ${stickerCount(w.sticker)}` : ''}</div>`,
  }));
  const acts = h('div.soc-acts');
  acts.append(h('div.soc-chips', { html: `<span class="soc-muted">Ganás</span>${payloadChips(reward, 16)}<span class="soc-chip">${icon('sparkle', 16)}${POINTS.helped}</span><span class="soc-chip">${icon('heart', 16)}</span>` }));
  const btn = h('button.btn.mint.small', {
    html: can ? `${icon('🤝', 18)} Ayudar` : needText(r), disabled: !can,
  });
  btn.onclick = () => busy(btn, async () => {
    const res = await fillFriendRequest(r);
    if (res?.error) { audio.sfx('error'); api.rerender(); return res; }
    audio.sfx('win');
    flyFrom(btn, res.reward);
    confetti(40);
    toast(`¡Le diste una mano a ${r.from_name || 'alguien'}! 💖`, { icon: 'heart', type: 'good' });
    setTimeout(() => api.rerender(), 650);
    return res;
  });
  acts.append(btn);
  c.append(acts);
  return c;
}
function needText(r) {
  if (r.kind === 'sticker') return 'Necesitás una repetida';
  if (r.kind === 'item') return 'No lo tenés';
  return 'No te alcanza';
}

// ---------- Buzón ----------
const KIND = {
  gift: { ic: 'gift', t: g => `Regalito de ${g.from_name || 'alguien'}` },
  help: { ic: '🔨', t: g => `${g.from_name || 'Alguien'} te ayudó con una obra` },
  trade: { ic: '🔄', t: g => (/devoluci/i.test(g.note || '') ? 'Te devolvieron lo de un intercambio' : `Entrega del intercambio con ${g.from_name || 'alguien'}`) },
  sticker: { ic: '🃏', t: g => `${g.from_name || 'Alguien'} te regaló una figurita` },
  like: { ic: 'heart', t: g => `A ${g.from_name || 'alguien'} le encantó tu ciudad` },
  request_fill: { ic: '🤝', t: g => `${g.from_name || 'Alguien'} completó tu pedido` },
};

export async function renderInbox(api, tok) {
  const { pane } = api;
  if (!net.user) { pane.replaceChildren(connectCard(api, 'buzon')); return; }
  const first = !cache.trades || !cache.visitors;
  if (first) pane.innerHTML = loadingHtml('Abriendo el buzón…');
  else draw();
  await refreshSocial(['inbox', 'trades', 'visitors', ...(cache.friends ? [] : ['friends'])]);
  if (api.live(tok)) draw();

  function draw() {
    const nodes = [];
    const inbox = cache.inbox || [];
    const trades = cache.trades || [];
    const forMe = trades.filter(t => t.status === 'pending' && !t.outgoing);
    const mineP = trades.filter(t => t.status === 'pending' && t.outgoing);
    const resolved = trades.filter(t => t.status !== 'pending' && t.outgoing).slice(0, 3);

    // cobrar todo
    const top = h('div.soc-card.soc-claimall', {
      html: `${icon('📮', 44)}<div class="soc-grow"><b style="font-size:18px">${inbox.length ? `Tenés ${inbox.length} cosita${inbox.length > 1 ? 's' : ''} para cobrar` : 'Tu buzón está al día ✨'}</b>
        <div class="soc-muted">${inbox.length ? 'Regalos, ayudas y entregas de tus amigos.' : 'Cuando tus amigos te manden algo, aparece acá.'}</div></div>`,
    });
    if (inbox.length) {
      const all = h('button.btn.gold', { html: `${icon('gift', 20)} Cobrar todo` });
      all.onclick = () => busy(all, async () => {
        const r = await claimAll();
        if (r?.error) return r;
        celebrate(all, r.total, r.count);
        setTimeout(() => api.rerender(), 600);
        return r;
      });
      top.append(all);
    }
    nodes.push(top);

    if (forMe.length) {
      const sec = h('div.soc-sec', { html: `<h4>${icon('🔄', 22)} Intercambios para vos<small>${forMe.length}</small></h4>` });
      for (const t of forMe) sec.append(tradeCard(api, t));
      nodes.push(sec);
    }
    if (inbox.length) {
      const sec = h('div.soc-sec', { html: `<h4>${icon('gift', 22)} Regalos y entregas</h4>` });
      for (const g of inbox) sec.append(giftRow(api, g));
      nodes.push(sec);
    }
    if (mineP.length || resolved.length) {
      const sec = h('div.soc-sec', { html: `<h4>${icon('clock', 20)} Tus intercambios<small>${mineP.length} esperando</small></h4>` });
      for (const t of mineP) sec.append(tradeCard(api, t));
      for (const t of resolved) sec.append(resolvedRow(t));
      nodes.push(sec);
    }
    const vis = (cache.visitors || []).filter(v => v.visited || v.liked || v.note || v.helped);
    const sv = h('div.soc-sec', { html: `<h4>${icon('home', 22)} Visitas a tu ciudad<small>últimos 7 días</small></h4>` });
    if (!vis.length) sv.append(h('div.soc-card', { html: emptyHtml('🏡', 'Todavía no pasó nadie', 'Cuando alguien visite tu ciudad, te va a dejar corazones, ayudas y notitas.') }));
    for (const v of vis.slice(0, 20)) sv.append(visitRow(v));
    nodes.push(sv);
    pane.replaceChildren(...nodes);
  }
}

function celebrate(el, total, count) {
  audio.sfx('win');
  flyFrom(el, total);
  confetti(70);
  const bits = [];
  if (total.coins) bits.push(`${fmtNum(total.coins)} monedas`);
  if (total.gems) bits.push(`${fmtNum(total.gems)} gemas`);
  const items = Object.values(total.items || {}).reduce((a, b) => a + b, 0);
  if (items) bits.push(`${items} objeto${items > 1 ? 's' : ''}`);
  const st = Object.values(total.stickers || {}).reduce((a, b) => a + b, 0);
  if (st) bits.push(`${st} figurita${st > 1 ? 's' : ''}`);
  toast(bits.length ? `¡Cobraste ${bits.join(', ')}!` : `¡Listo! ${count} cosita${count > 1 ? 's' : ''} cobrada${count > 1 ? 's' : ''}`, { icon: 'gift', type: 'good' });
  if (total.likes) setTimeout(() => toast(`+${total.likes} corazón${total.likes > 1 ? 'es' : ''} para tu ciudad ❤️`, { icon: 'heart' }), 700);
  if (total.speedups) setTimeout(() => toast(`¡Tus amigos adelantaron ${total.speedups} obra${total.speedups > 1 ? 's' : ''}!`, { icon: 'hammer', type: 'good' }), 1300);
}

function giftRow(api, g) {
  const k = KIND[g.kind] || KIND.gift;
  const p = { ...(g.payload || {}) };
  delete p.request; delete p.uid;
  const row = h('div.soc-card.soc-mail', {
    html: `<div class="soc-mail-ic k-${esc(g.kind)}">${icon(k.ic, 30)}</div>
      <div class="soc-grow"><b>${esc(k.t(g))}</b><div class="soc-muted">${timeAgo(g.created_at)}${g.kind === 'help' ? ' · obra más rápida' : ''}</div>
      <div class="soc-chips">${payloadChips(p, 16)}</div></div>`,
  });
  const btn = h('button.btn.gold.small', { html: g.kind === 'like' ? '¡Gracias!' : 'Cobrar' });
  btn.onclick = () => busy(btn, async () => {
    const r = await claimOne(g);
    if (r?.error) return r;
    audio.sfx(g.kind === 'like' ? 'pop' : 'coin');
    if (r?.summary) flyFrom(btn, r.summary);
    row.style.transition = 'opacity .25s, transform .25s'; row.style.opacity = '0'; row.style.transform = 'scale(.95)';
    setTimeout(() => api.rerender(), 260);
    return r;
  });
  row.append(btn);
  return row;
}

/** Los dos lados de un intercambio (lo que da quien propone y lo que pide). */
export function sidesEl(offer, request, labels = ['Te da', 'Te pide']) {
  const side = (p, label) => {
    const s = h('div.soc-side', { html: `<small>${label}</small>` });
    const st = Object.keys(p?.stickers || {})[0];
    if (st) {
      s.append(stickerCard(st, { owned: true }));
      s.append(h('small', { html: stickerCount(st) ? `Tenés ${stickerCount(st)}` : '<b style="color:var(--mint-d)">¡Te falta!</b>' }));
    }
    else s.append(h('div.soc-chips', { html: payloadChips(p, 20) || '<span class="soc-muted">Nada</span>' }));
    return s;
  };
  return h('div.soc-sides', {}, side(offer, labels[0]), h('span.soc-swap', { html: icon('🔄', 26) }), side(request, labels[1]));
}

function tradeCard(api, t) {
  const c = h('div.soc-card.soc-trade' + (t.outgoing ? '' : '.tint'));
  c.append(h('div.soc-row', {
    html: `${avatarHtml(lookOf(t.other_id), t.other_name, 34)}<div class="soc-grow"><b>${esc(t.other_name || 'Alguien')}</b>
      <div class="soc-muted">${t.outgoing ? `Esperando que responda · ${timeAgo(t.created_at)}` : `Te propone un intercambio · ${timeAgo(t.created_at)}`}</div></div>`,
  }));
  c.append(t.outgoing ? sidesEl(t.offer, t.request, ['Ofreciste', 'Pediste']) : sidesEl(t.offer, t.request));
  const row = h('div.soc-row');
  if (t.outgoing) {
    row.append(h('span.soc-muted.soc-grow', { html: 'Lo que ofreciste está guardado: si cancelás o no acepta, vuelve a tu buzón.' }));
    const x = h('button.btn.ghost.small', { html: 'Cancelar' });
    x.onclick = () => busy(x, async () => {
      const r = await cancelTrade(t);
      if (r?.error) return r;
      toast('Intercambio cancelado: lo tenés en el buzón', { icon: 'info' });
      api.rerender();
      return r;
    });
    row.append(x);
  } else {
    const can = canAffordPayload(t.request);
    const no = h('button.btn.ghost.small', { html: 'No, gracias' });
    const yes = h('button.btn.mint.small', { html: can ? `${icon('check', 18)} Aceptar` : 'Te falta', disabled: !can });
    no.onclick = () => busy(no, async () => {
      const r = await declineTrade(t);
      if (r?.error) return r;
      audio.sfx('close');
      api.rerender();
      return r;
    });
    yes.onclick = () => busy(yes, async () => {
      const r = await acceptTrade(t);
      if (r?.error) { api.rerender(); return r; }
      audio.sfx('win'); confetti(60);
      toast(`¡Trato hecho con ${t.other_name}! Cobrá tu parte en el buzón`, { icon: 'gift', type: 'good' });
      api.rerender();
      return r;
    });
    row.style.justifyContent = 'flex-end';
    if (!can) row.append(h('span.soc-muted.soc-grow', { html: 'No tenés lo que te pide (las figuritas tienen que ser repetidas).' }));
    row.append(no, yes);
  }
  c.append(row);
  return c;
}
function resolvedRow(t) {
  const txt = t.status === 'accepted' ? `${esc(t.other_name || 'Alguien')} aceptó tu intercambio 🎉` : t.status === 'declined' ? `${esc(t.other_name || 'Alguien')} prefirió no cambiar` : 'Cancelaste un intercambio';
  return h('div.soc-card.soc-row', { style: { opacity: '.75' }, html: `${icon(t.status === 'accepted' ? 'check' : 'info', 22)}<span class="soc-grow">${txt}</span><small class="soc-muted">${timeAgo(t.resolved_at)}</small>` });
}
function visitRow(v) {
  const chips = [];
  if (v.liked) chips.push(`<span class="soc-chip">${icon('heart', 16)} Le encantó</span>`);
  if (v.helped) chips.push(`<span class="soc-chip">${icon('🔨', 16)} Ayudó ${v.helped}</span>`);
  const day = v.day === utcDay() ? 'hoy' : timeAgo(v.at);
  return h('div.soc-card.soc-visit', {
    html: `${avatarHtml(lookOf(v.id), v.name, 42)}<div class="soc-grow"><b>${esc(v.name || 'Alguien')}</b> <span class="soc-muted">pasó por tu ciudad · ${day}</span>
      ${chips.length ? `<div class="soc-chips" style="margin-top:3px">${chips.join('')}</div>` : ''}
      ${v.note ? `<div class="soc-note">“${esc(v.note)}”</div>` : ''}</div>`,
  });
}

export { nameOf };
