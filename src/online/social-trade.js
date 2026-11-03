// Editor de intercambio (figuritas 1×1 o monedas/gemas/objetos) y creador de pedidos ("Pedí una mano").
import { h, esc, modal, toast, confetti } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { store } from '../core/state.js';
import { fmtNum, isBusy, remainingMs } from '../core/economy.js';
import { BUILDING_BY_ID } from '../core/data.js';
import { ITEMS, itemCount } from '../chests/chests.js';
import { STICKERS, stickerDef, stickerCount, duplicates } from '../album/album.js';
import { canAffordPayload } from './sync.js';
import {
  socialCache as cache, refreshSocial, friendProfiles, friendAlbum, stickerRules, stickerPairProblem, proposeTrade,
  createHelpRequest, requestCoinOptions, TRADE_ITEMS, REQUEST_KINDS, SPEEDUP_MINUTES,
} from './social.js';
import { useSocialStyle, avatarHtml, stickerCard, itemIcon, loadingHtml, emptyHtml, busy, fmtLeft } from './social-common.js';

function edModal(title, ic, content, onClose) {
  const release = useSocialStyle();
  const m = modal({ title, icon: ic, content, className: 'soc soc-ed', onClose: () => { release(); onClose?.(); } });
  return m;
}
async function ensureFriends() {
  if (!cache.friends) await refreshSocial(['friends']);
  await friendProfiles();
  return (cache.friends || []).filter(f => f.status === 'accepted');
}

// ---------- Elegir amiga ----------
function pickFriend(ctx, { title = '¿Con quién?', hint = () => '' } = {}) {
  return new Promise(async (resolve) => {
    let chosen = null;
    const box = h('div.soc-fpick', { html: loadingHtml('Buscando a tus amigos…') });
    const m = edModal(title, 'people', box, () => resolve(chosen));
    const friends = await ensureFriends();
    if (!friends.length) {
      box.innerHTML = emptyHtml('🌷', 'Todavía no tenés amigos', 'Sumalos con su código en la pestaña Amigos y después intercambian.');
      return;
    }
    box.replaceChildren(...friends.map(f => h('button', {
      html: `${avatarHtml(f.look, f.name, 40)}<span><b>${esc(f.name)}</b><small>${esc(f.friendship.name)} · nivel ${f.level}</small></span>${hint(f)}`,
      onclick: () => { audio.sfx('tap'); chosen = f; m.close(); },
    })));
  });
}

// ---------- Editor de intercambio ----------
/**
 * opts: { friend?, offerSticker?, askSticker?, onDone? }
 * Si no viene la amiga, primero se elige (marcando a quién le falta / quién la tiene repetida).
 */
export async function openTradeEditor(ctx, opts = {}) {
  let friend = opts.friend;
  if (!friend) {
    friend = await pickFriend(ctx, {
      title: 'Intercambiar con…',
      hint: (f) => {
        const al = friendAlbum(f.id);
        if (!al) return '';
        if (opts.offerSticker && !al[opts.offerSticker]) return '<span class="soc-tag ok">¡Le falta!</span>';
        if (opts.askSticker && al[opts.askSticker] >= 2) return '<span class="soc-tag ok">La tiene repe</span>';
        return '';
      },
    });
    if (!friend) return;
  } else await friendProfiles();
  const rules = stickerRules(friend);
  const fal = friendAlbum(friend.id);
  const dups = duplicates();
  let mode = opts.offerSticker || opts.askSticker ? 'stickers' : dups.length ? 'stickers' : 'res';
  let offerSt = opts.offerSticker && stickerCount(opts.offerSticker) >= 2 ? opts.offerSticker : null;
  let askSt = opts.askSticker || null;
  const give = { coins: 0, gems: 0, items: {} }, get = { coins: 0, gems: 0, items: {} };

  const body = h('div');
  const err = h('div.soc-err');
  const send = h('button.btn.lilac', { html: `${icon('🔄', 20)} Proponer` });
  const m = edModal(`Cambiar con ${friend.name}`, '🔄', body);
  const foot = h('div.modal-foot');
  foot.append(h('button.btn.ghost', { html: 'Cancelar', onclick: () => { audio.sfx('close'); m.close(); } }), send);
  m.el.append(foot);

  const seg = h('div.soc-seg');
  const area = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
  body.append(
    h('div.soc-row', { html: `${avatarHtml(friend.look, friend.name, 36)}<div class="soc-grow soc-muted">${esc(friend.friendship.name)} · ${friend.days || 0} día${friend.days === 1 ? '' : 's'} de amistad</div>` }),
    seg, area,
    h('p.soc-muted', { style: { fontSize: '13px', textAlign: 'center' }, html: `${icon('lock', 12)} Lo que ofrecés queda guardado hasta que ${esc(friend.name)} responda. Si no acepta, vuelve a tu buzón.` }),
    err,
  );

  function drawSeg() {
    seg.innerHTML = '';
    for (const [id, label, ic] of [['stickers', 'Figuritas', '🃏'], ['res', 'Monedas y más', 'coin']]) {
      seg.append(h('button' + (mode === id ? '.on' : ''), { html: `${icon(ic, 18)}${label}`, onclick: () => { if (mode !== id) { audio.sfx('tap'); mode = id; draw(); } } }));
    }
  }
  function validate() {
    let problem = null;
    if (mode === 'stickers') {
      if (!offerSt || !askSt) problem = 'Elegí una figurita de cada lado';
      else problem = stickerPairProblem(offerSt, askSt, friend);
    } else {
      const empty = p => !p.coins && !p.gems && !Object.values(p.items).some(Boolean);
      if (empty(give) && empty(get)) problem = 'Elegí qué das y qué pedís';
      else if (!canAffordPayload(clean(give))) problem = 'No te alcanza para ofrecer eso';
    }
    err.textContent = problem && (mode === 'res' || offerSt || askSt) ? problem : '';
    send.disabled = !!problem;
    return !problem;
  }
  const clean = p => {
    const o = {};
    if (p.coins) o.coins = p.coins;
    if (p.gems) o.gems = p.gems;
    const it = Object.fromEntries(Object.entries(p.items).filter(([, n]) => n > 0));
    if (Object.keys(it).length) o.items = it;
    return o;
  };

  function stickerGrid(list, sel, onPick, mark) {
    const g = h('div.soc-pickgrid');
    if (!list.length) return null;
    for (const it of list) {
      const b = h('button.soc-pick' + (sel === it.id ? '.on' : '') + (it.off ? '.off' : ''), { 'aria-label': stickerDef(it.id).name, disabled: !!it.off });
      b.append(stickerCard(it.id, { owned: it.owned !== false }));
      const mk = mark(it);
      if (mk) b.append(h('span.soc-has', { html: mk }));
      if (it.cnt) b.append(h('span.soc-cnt', { html: '×' + it.cnt }));
      b.onclick = () => { audio.sfx('select'); onPick(it.id); };
      g.append(b);
    }
    return g;
  }
  function drawStickers() {
    const offerDef = offerSt && stickerDef(offerSt);
    // lo que doy: mis repetidas
    const gBox = h('div.soc-pane-box.give', { html: `<h5>${icon('gift', 20)} Vos das <small>una repetida</small></h5>` });
    const mine = dups.map(d => ({ id: d.id, cnt: d.count, off: d.stars === 5 && !rules.fiveOk }));
    const gg = stickerGrid(mine, offerSt, id => { offerSt = id; if (askSt && stickerPairProblem(offerSt, askSt, friend)?.includes('parecidas')) askSt = null; draw(); },
      it => (fal && !fal[it.id] ? '¡Le falta!' : ''));
    gBox.append(gg || h('div', { html: emptyHtml('🃏', 'No tenés repetidas', 'Abrí cofres y sobres: las repetidas se pueden cambiar con amigos.') }));
    // lo que recibo
    const rBox = h('div.soc-pane-box.get', { html: `<h5>${icon('🃏', 20)} Vos recibís <small>${fal ? `repetidas de ${esc(friend.name)}` : 'una que te falte'}</small></h5>` });
    let cand = fal
      ? Object.entries(fal).filter(([, n]) => n >= 2).map(([id]) => id)
      : STICKERS.filter(s => stickerCount(s.id) === 0).map(s => s.id);
    if (askSt && !cand.includes(askSt)) cand.unshift(askSt);
    cand = cand.filter(id => stickerDef(id)).map(id => {
      const d = stickerDef(id);
      const bad = (offerDef && Math.abs(offerDef.stars - d.stars) > 1) || (d.stars === 5 && !rules.fiveOk);
      return { id, owned: true, missing: stickerCount(id) === 0, off: bad, stars: d.stars, n: d.n };
    }).sort((a, b) => (a.off - b.off) || (b.missing - a.missing) || (b.stars - a.stars) || (a.n - b.n));
    const rg = stickerGrid(cand, askSt, id => { askSt = id; draw(); }, it => (it.missing ? '¡Te falta!' : ''));
    rBox.append(rg || h('div', { html: emptyHtml('🙈', `${friend.name} no tiene repetidas todavía`, 'Probá con monedas y objetos, o hacé un pedido.') }));
    const rulesEl = h('div.soc-rules', {
      html: `<span>${icon('🃏', 14)} 1 por lado</span><span>${icon('star', 14)} estrellas parecidas (±1)</span><span>${rules.fiveOk ? `${icon('check', 14)} 5★ habilitadas${rules.golden ? ' (Semana Dorada)' : ''}` : `${icon('lock', 14)} 5★ con 14 días de amistad`}</span>`,
    });
    area.replaceChildren(gBox, rBox, rulesEl);
  }
  function stepper(label, ic, obj, key, max, stepFn) {
    const row = h('div.soc-step-row');
    const minus = h('button', { html: '−', 'aria-label': `Menos ${label}` });
    const plus = h('button', { html: '+', 'aria-label': `Más ${label}` });
    const val = h('b');
    const sync = () => { val.textContent = fmtNum(obj[key]); minus.disabled = obj[key] <= 0; plus.disabled = obj[key] >= max; validate(); };
    minus.onclick = () => { audio.sfx('tap'); obj[key] = Math.max(0, obj[key] - stepFn(obj[key] - 1)); sync(); };
    plus.onclick = () => { audio.sfx('tap'); obj[key] = Math.min(max, obj[key] + stepFn(obj[key])); sync(); };
    row.append(h('span', { html: `${icon(ic, 20)}${label}` }), h('span'), minus, val, plus);
    sync();
    return row;
  }
  const coinStep = v => (v >= 2000 ? 500 : v >= 500 ? 100 : 50);
  const gemStep = v => (v >= 20 ? 5 : 1);
  function itemChips(obj, ids, maxOf) {
    const wrap = h('div.soc-items');
    for (const id of ids) {
      const max = maxOf(id);
      const n = obj.items[id] || 0;
      const b = h('button.soc-item' + (n ? '.on' : ''), { disabled: max <= 0, title: ITEMS[id].desc || '', html: `${itemIcon(id, 22)}${esc(ITEMS[id].name)}${n ? ` <b>×${n}</b>` : ''}${maxOf === mineMax ? ` <small>(${max})</small>` : ''}` });
      b.onclick = () => { audio.sfx('tap'); obj.items[id] = n >= max ? 0 : n + 1; draw(); };
      wrap.append(b);
    }
    return wrap;
  }
  const mineMax = id => itemCount(id);
  function drawRes() {
    const s = store.state;
    const gBox = h('div.soc-pane-box.give', { html: `<h5>${icon('gift', 20)} Vos das</h5>` });
    gBox.append(stepper('Monedas', 'coin', give, 'coins', s.coins, coinStep), stepper('Gemas', 'gem', give, 'gems', s.gems, gemStep));
    const mineIds = TRADE_ITEMS.filter(id => itemCount(id) > 0);
    if (mineIds.length) gBox.append(itemChips(give, mineIds, mineMax));
    else gBox.append(h('small.soc-muted', { html: 'Tu mochila no tiene objetos para dar.' }));
    const rBox = h('div.soc-pane-box.get', { html: `<h5>${icon('🎁', 20)} Vos pedís</h5>` });
    rBox.append(stepper('Monedas', 'coin', get, 'coins', 99999, coinStep), stepper('Gemas', 'gem', get, 'gems', 999, gemStep));
    rBox.append(itemChips(get, TRADE_ITEMS, () => 3));
    area.replaceChildren(gBox, rBox);
  }
  function draw() {
    drawSeg();
    if (mode === 'stickers') drawStickers(); else drawRes();
    validate();
  }
  send.onclick = () => busy(send, async () => {
    if (!validate()) return null;
    let offer, request;
    if (mode === 'stickers') {
      offer = { stickers: { [offerSt]: 1 }, stars: stickerDef(offerSt).stars };
      request = { stickers: { [askSt]: 1 }, stars: stickerDef(askSt).stars };
    } else { offer = clean(give); request = clean(get); }
    const r = await proposeTrade(friend, offer, request);
    if (r?.error) { audio.sfx('error'); err.textContent = r.error; return null; }
    audio.sfx('swoosh');
    toast(`¡Propuesta enviada a ${friend.name}! Te avisamos en el buzón`, { icon: '🔄', type: 'good' });
    m.close();
    opts.onDone?.();
    return r;
  });
  draw();
}

// ---------- Creador de pedidos ----------
/** opts: { kind?, sticker?, onDone? } */
export async function openRequestCreator(ctx, opts = {}) {
  let kind = opts.kind || null;
  let sticker = opts.sticker && stickerCount(opts.sticker) === 0 ? opts.sticker : null;
  let item = null, coins = null, uid = null;
  const body = h('div');
  const err = h('div.soc-err');
  const send = h('button.btn.pink', { html: `${icon('🤝', 20)} Publicar pedido` });
  const m = edModal('Pedí una mano', '🤝', body);
  const foot = h('div.modal-foot');
  foot.append(h('button.btn.ghost', { html: 'Cancelar', onclick: () => { audio.sfx('close'); m.close(); } }), send);
  m.el.append(foot);
  const kindsEl = h('div.soc-kinds');
  const area = h('div.soc-pane-box', { style: { minHeight: '80px' } });
  body.append(h('p.soc-muted', { html: 'Tus amigos ven tu pedido durante 24 horas. Quien ayude primero te lo manda a tu buzón.' }), kindsEl, area, err);
  if (opts.sticker) {
    body.append(h('button.btn.ghost.small', {
      html: `${icon('🔄', 18)} O proponé un intercambio por esta figurita`,
      onclick: () => { audio.sfx('tap'); m.close(); openTradeEditor(ctx, { askSticker: opts.sticker }); },
    }));
  }
  const now = Date.now();
  const busyB = store.state.city.buildings.filter(b => isBusy(b, now));
  friendProfiles().then(() => { if (kind === 'sticker' && area.isConnected) draw(); });

  function friendsWith(id) {
    return (cache.friends || []).filter(f => f.status === 'accepted' && (friendAlbum(f.id)?.[id] || 0) >= 2).map(f => f.name);
  }
  function drawKinds() {
    kindsEl.innerHTML = '';
    for (const [id, k] of Object.entries(REQUEST_KINDS)) {
      const dis = id === 'speedup' && !busyB.length;
      kindsEl.append(h('button.soc-kind' + (kind === id ? '.on' : ''), {
        disabled: dis,
        html: `${icon(k.icon, 30)}${k.name}${dis ? '<small>No hay obras en curso</small>' : ''}`,
        onclick: () => { audio.sfx('tap'); kind = id; draw(); },
      }));
    }
  }
  function drawArea() {
    area.innerHTML = '';
    if (!kind) { area.innerHTML = `<div class="soc-muted" style="text-align:center;padding:16px">Elegí qué necesitás 👆</div>`; return; }
    if (kind === 'sticker') {
      area.append(h('h5', { html: `${icon('🃏', 18)} ¿Qué figurita te falta? <small>las que tienen tus amigos, primero</small>` }));
      const miss = STICKERS.filter(s => stickerCount(s.id) === 0).map(s => ({ id: s.id, who: friendsWith(s.id), s }))
        .sort((a, b) => (b.who.length > 0) - (a.who.length > 0) || a.s.n - b.s.n);
      if (!miss.length) { area.append(h('div', { html: emptyHtml('👑', '¡No te falta ninguna!', 'Completaste el álbum. Sos una estrella.') })); return; }
      const g = h('div.soc-pickgrid');
      for (const it of miss) {
        const b = h('button.soc-pick' + (sticker === it.id ? '.on' : ''), { 'aria-label': `Figurita ${it.s.n}` });
        b.append(stickerCard(it.id, { owned: false }));
        if (it.who.length) b.append(h('span.soc-has', { html: esc(it.who[0]) + (it.who.length > 1 ? ` +${it.who.length - 1}` : '') }));
        b.onclick = () => { audio.sfx('select'); sticker = it.id; draw(); };
        g.append(b);
      }
      area.append(g);
      if (sticker) {
        const d = stickerDef(sticker);
        area.append(h('small.soc-muted', { html: `Elegiste la <b>#${d.n}</b> de ${esc(d.setName)} (${'★'.repeat(d.stars)}). Te la puede dar alguien que la tenga repetida.` }));
      }
    } else if (kind === 'item') {
      area.append(h('h5', { html: `${icon('🔨', 18)} ¿Qué objeto?` }));
      const w = h('div.soc-items');
      for (const id of TRADE_ITEMS) {
        w.append(h('button.soc-item' + (item === id ? '.on' : ''), { title: ITEMS[id].desc || '', html: `${itemIcon(id, 22)}${esc(ITEMS[id].name)}`, onclick: () => { audio.sfx('tap'); item = id; draw(); } }));
      }
      area.append(w);
      if (item) area.append(h('small.soc-muted', { html: esc(ITEMS[item].desc || '') }));
    } else if (kind === 'coins') {
      area.append(h('h5', { html: `${icon('coin', 18)} ¿Cuántas monedas?` }));
      const w = h('div.soc-items');
      for (const c of requestCoinOptions()) w.append(h('button.soc-item' + (coins === c ? '.on' : ''), { html: `${icon('coin', 22)}${fmtNum(c)}`, onclick: () => { audio.sfx('tap'); coins = c; draw(); } }));
      area.append(w);
    } else {
      area.append(h('h5', { html: `${icon('⏳', 18)} ¿Qué obra? <small>-${SPEEDUP_MINUTES} min</small>` }));
      const w = h('div.soc-items');
      for (const b of busyB) {
        const d = BUILDING_BY_ID[b.id];
        w.append(h('button.soc-item' + (uid === b.uid ? '.on' : ''), {
          html: `${icon('build', 22)}${esc(d?.name || b.id)} <small>${fmtLeft(remainingMs(b, now))}</small>`,
          onclick: () => { audio.sfx('tap'); uid = b.uid; draw(); },
        }));
      }
      area.append(w);
    }
  }
  function payload() {
    if (kind === 'sticker' && sticker) return { stickers: { [sticker]: 1 } };
    if (kind === 'item' && item) return { items: { [item]: 1 } };
    if (kind === 'coins' && coins) return { coins };
    if (kind === 'speedup' && uid != null) return { minutes: SPEEDUP_MINUTES, uid };
    return null;
  }
  function draw() { drawKinds(); drawArea(); send.disabled = !payload(); err.textContent = ''; }
  send.onclick = () => busy(send, async () => {
    const p = payload();
    if (!p) return null;
    const r = await createHelpRequest(kind, p);
    if (r?.error) { audio.sfx('error'); err.textContent = r.error; return null; }
    audio.sfx('swoosh'); confetti(30);
    toast('¡Pedido publicado! Tus amigos lo van a ver', { icon: '🤝', type: 'good' });
    m.close();
    opts.onDone?.();
    return r;
  });
  draw();
}
