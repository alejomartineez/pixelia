// Pestañas "Ranking" (semana de amigas, podio pixel, premio para todas) y "Equipo" (Obra en Equipo semanal).
import { h, esc, toast } from '../core/ui.js';
import { icon } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { store } from '../core/state.js';
import { fmtNum, cityCharm } from '../core/economy.js';
import { CHESTS } from '../chests/chests.js';
import { chestIcon } from '../season/season-ui-common.js';
import { net } from './net.js';
import {
  socialCache as cache, refreshSocial, flushCoop, coopInfo, claimCoopTier, rankInfo, claimRankPrize,
  RANK_CATS, RANK_BEST_GEMS, COOP_POINTS, myName, openAccount, dailyStatus,
} from './social.js';
import { DAILY_PRIZE } from '../expedition/expedition.js';
import { avatarHtml, fmtLeft, loadingHtml, busy, payloadChips, flyFrom } from './social-common.js';

const lookOf = (id) => (cache.friends?.find(f => f.id === id)?.look) || null;
function celebrateGot(el, got) {
  audio.sfx('win');
  flyFrom(el, got);
  const ch = Object.keys(got.chests || {});
  if (ch.length) setTimeout(() => toast(`¡${CHESTS[ch[0]]?.name || 'Cofre'} a tus cofres!`, { icon: 'gift', type: 'good' }), 500);
  if (got.stickers?.length) setTimeout(() => toast(`¡${got.stickers.length} hallazgos nuevos en tu colección!`, { icon: '🃏', type: 'good' }), 1000);
}
function weekLabel(w) { return `Semana ${Number(String(w).split('W')[1]) || ''}`; }
function smallConnect(api, text) {
  const c = h('div.soc-card.sky.soc-row', { html: `${icon('people', 30)}<span class="soc-grow soc-muted">${text}</span>` });
  if (net.mode !== 'off') c.append(h('button.btn.primary.small', { html: 'Entrar', onclick: () => { audio.sfx('tap'); openAccount(api.ctx); } }));
  return c;
}

// ---------- Ranking ----------
let cat = 'stars';
let board = null;
export async function renderRanking(api, tok) {
  const { pane } = api;
  if (net.user && !board) pane.innerHTML = loadingHtml('Armando el podio…');
  else draw();
  if (net.user) {
    const [lb] = await Promise.all([net.leaderboard(), cache.friends ? null : refreshSocial(['friends']), refreshSocial(['daily'])]);
    if (!lb?.error) board = lb;
  } else board = null;
  if (api.live(tok)) draw();

  function draw() {
    const info = rankInfo();
    let charm = 0;
    try { charm = cityCharm(); } catch {}
    const me = { id: 'me', name: myName(), level: store.state.player.level, week: { ...info.mine, charm }, me: true, look: store.state.avatar };
    let rows = net.user && board ? board.map(r => (r.me ? { ...me, id: r.id } : { ...r, look: lookOf(r.id) })) : [me];
    const val = r => (cat === 'level' ? r.level || 1 : r.week?.[cat] || 0);
    if (!RANK_CATS.some(k => k.id === cat)) cat = RANK_CATS[0].id;
    rows = rows.map(r => ({ ...r, v: val(r) })).sort((a, b) => b.v - a.v || (b.me ? 1 : 0) - (a.me ? 1 : 0) || String(a.name).localeCompare(String(b.name)));
    const c = RANK_CATS.find(x => x.id === cat);
    const fmtV = (v) => (cat === 'level' ? `Nv ${v}` : `${fmtNum(v)}${c?.unit || ''}`);
    const nodes = [];
    nodes.push(dailyCard(api));

    nodes.push(h('div.soc-row', { html: `<b style="font-size:18px">${icon('trophy', 24)} ${weekLabel(info.week)}</b><span class="soc-muted" style="margin-left:auto">${icon('clock', 16)} termina en ${fmtLeft(info.endsInMs)}</span>` }));
    const cats = h('div.soc-cats');
    for (const k of RANK_CATS) {
      cats.append(h('button.soc-cat' + (k.id === cat ? '.on' : ''), {
        html: `${icon(k.icon, 18)}${k.short}`,
        onclick: () => { if (cat !== k.id) { audio.sfx('tap'); cat = k.id; draw(); } },
      }));
    }
    nodes.push(cats);

    // podio pixel: 2º · 1º · 3º
    const pod = h('div.soc-podium');
    for (const [pos, cls] of [[1, 'p2'], [0, 'p1'], [2, 'p3']]) {
      const r = rows[pos];
      const has = r && (r.v > 0 || cat === 'level');
      pod.append(h('div.soc-pod.' + cls + (has ? '' : '.empty'), {
        html: `${pos === 0 && has ? `<span class="soc-crown">${icon('crown', 26)}</span>` : ''}
          ${avatarHtml(r?.look, r?.name || '?', pos === 0 ? 56 : 46, r?.me ? 'me' : '')}
          <span class="soc-pn">${has ? esc(r.me ? 'Vos' : r.name) : '—'}</span>
          <span class="soc-pv">${has ? `${icon(c.icon, 14)}${fmtV(r.v)}` : '&nbsp;'}</span>
          <div class="soc-block">${pos + 1}</div>`,
      }));
    }
    nodes.push(pod);

    const list = h('div.soc-rank');
    rows.forEach((r, i) => {
      const pb = r.me && cat !== 'level' && info.best[cat];
      list.append(h('div.soc-card.soc-rrow' + (r.me ? '.me' : ''), {
        html: `<span class="soc-pos">${i + 1}</span>${avatarHtml(r.look, r.name, 36, r.me ? 'me' : '')}
          <div class="soc-grow"><b class="soc-ellip" style="display:block">${esc(r.me ? `${r.name} (vos)` : r.name)}</b>
          ${pb ? `<span class="soc-pb">${icon('sparkle', 12)} ¡Mejor marca personal!</span>` : r.me ? '' : `<small class="soc-muted">Nivel ${r.level}</small>`}</div>
          <b class="v">${icon(c.icon, 18)}${fmtV(r.v)}</b>`,
      }));
    });
    nodes.push(list);
    if (!net.user) nodes.push(smallConnect(api, net.mode === 'off' ? 'Cuando se active el modo online vas a competir (en buena ley) con tus contactos. Igual el premio de la semana es tuyo.' : 'Entrá a tu cuenta para ver el ranking con tus contactos.'));

    // premio para todas
    const prize = h('div.soc-card.gold.soc-prize');
    const ready = info.prizeWeeks;
    const anyBest = Object.values(info.best).some(Boolean);
    const chips = payloadChips({ ...info.prize, gems: anyBest ? RANK_BEST_GEMS : 0 }, 18);
    if (ready.length) {
      prize.innerHTML = `${chestIcon('madera', 48)}<div><b style="font-size:18px">¡Premio de la semana!</b><div class="soc-muted">Para quienes jugaron. ${anyBest ? 'Y gemas extra por tu mejor marca.' : ''}</div><div class="soc-chips" style="margin-top:4px">${chips}</div></div>`;
      const b = h('button.btn.gold', { html: `${icon('gift', 20)} Cobrar premio` });
      b.onclick = () => busy(b, async () => {
        const got = claimRankPrize(ready[0]);
        if (!got) return { error: 'Ese premio ya se cobró' };
        celebrateGot(b, got);
        toast(got.best ? '¡Premio de la semana + gemas por tu mejor marca!' : '¡Premio de la semana cobrado!', { icon: 'trophy', type: 'good' });
        setTimeout(() => api.rerender(), 500);
        return got;
      });
      prize.append(b);
    } else {
      const played = info.mine.played > 0;
      prize.innerHTML = `${chestIcon('madera', 48)}<div><b style="font-size:17px">Premio para quienes jueguen · el domingo</b>
        <div class="soc-muted">${played ? `${icon('check', 14)} Ya estás participando. ${info.daysToSunday ? `Faltan ${info.daysToSunday} día${info.daysToSunday > 1 ? 's' : ''}.` : ''}` : 'Hacé al menos una expedición esta semana para participar.'}
        ${anyBest ? ' Con mejor marca personal sumás gemas.' : ''}</div><div class="soc-chips" style="margin-top:4px">${chips}</div></div>`;
    }
    nodes.push(prize);
    nodes.push(h('p.soc-muted', { style: { textAlign: 'center', fontSize: '13px' }, html: 'Acá no pierde nadie: el ranking es para divertirse y el premio es para quienes jugaron.' }));
    pane.replaceChildren(...nodes);
  }
}

// ---------- Expedición del día (Fase 7b) ----------
function dailyCard(api) {
  const { info, rows, pending } = dailyStatus();
  const card = h('div.soc-card.sky.soc-daily');
  const mine = info.last;
  const gems = DAILY_PRIZE.gems || 0;
  const sub = mine
    ? `Tu botín de hoy: <b>${fmtNum(mine.score)}</b>${pending ? ' (se manda cuando haya conexión)' : ''}. Mañana hay otra.`
    : info.done ? 'Tu grupo está en camino.' : `La misma salida para todo el mundo, sin gastar provisiones. Por participar: ${icon('gem', 14)} ${gems}.`;
  card.innerHTML = `${icon('trophy', 40)}<div><b style="font-size:17px">Expedición del día · ${esc(info.regionName || '')}</b><div class="soc-muted">${sub}</div></div>`;
  if (!info.done) {
    const b = h('button.btn.gold', { html: `${icon('map', 20)} Preparar la Expedición del día` });
    b.onclick = () => { audio.sfx('tap'); api.close(); api.ctx.openPanel?.('expedition'); };
    card.append(b);
  }
  if (net.user && rows?.length) {
    const list = h('div.soc-dlist');
    rows.slice(0, 6).forEach((r, i) => list.append(h('div.soc-drow' + (r.me ? '.me' : ''), {
      html: `<span class="soc-pos">${i + 1}</span><span class="soc-ellip">${esc(r.me ? 'Vos' : r.name)}</span><b class="v">${icon('trophy', 16)}${fmtNum(r.score)}</b>`,
    })));
    card.append(list);
  } else if (net.user && mine) card.append(h('p.soc-muted', { style: { gridColumn: '1 / -1', margin: 0 }, html: 'Todavía ningún contacto la hizo hoy.' }));
  return card;
}

// ---------- Obra en Equipo ----------
const SITE = ['🚧', '🧱', '🏗️', '🏠', '🏡', '🏛️'];
export async function renderTeam(api, tok) {
  const { pane } = api;
  if (net.user && !cache.coop) pane.innerHTML = loadingHtml('Mirando la obra…');
  else draw();
  if (net.user) { await flushCoop(); await refreshSocial(['coop', ...(cache.friends ? [] : ['friends'])]); }
  if (api.live(tok)) draw();

  function draw() {
    const info = coopInfo();
    const reached = info.tiers.filter(t => t.reached).length;
    const pct = Math.min(1, info.total / info.goal);
    const nodes = [];
    const hero = h('div.soc-card.soc-coop-hero', {
      html: `<div class="soc-site">${icon(SITE[reached], 52)}</div>
        <div><h3>Obra en Equipo</h3>
        <div class="soc-muted">${info.online ? (info.members.length > 1 ? `Entre ${info.members.length} contactos: cada quien suma jugando y los premios son para el grupo.` : 'Sumá contactos y la obra se arma en grupo. Acá nadie pierde.') : 'Tu meta personal de la semana. Con contactos online, la obra es compartida.'}</div>
        <div class="soc-row" style="margin-top:4px"><b style="font-size:20px">${fmtNum(info.total)}</b><span class="soc-muted">/ ${fmtNum(info.goal)} puntos</span>
        <span class="soc-muted" style="margin-left:auto">${icon('clock', 14)} ${fmtLeft(info.endsInMs)}</span></div></div>`,
    });
    nodes.push(hero);

    const track = h('div.soc-track');
    track.append(h('div.soc-track-bar', { html: `<i style="width:${(pct * 100).toFixed(1)}%"></i>` }));
    for (const t of info.tiers) {
      const st = t.claimed ? 'claimed' : t.reached ? 'claimable' : '';
      track.append(h('div.soc-step' + (t.reached ? '.reached' : '') + (st ? '.' + st : ''), {
        style: { left: `${t.pct * 100}%` },
        html: `<span class="soc-node">${t.claimed ? icon('check', 22) : t.n === 5 ? chestIcon('oro', 28) : `<b>${t.n}</b>`}</span><small>${fmtNum(t.at)}</small>`,
      }));
    }
    nodes.push(track);

    const tiers = h('div.soc-tiers');
    for (const t of info.tiers) {
      const st = t.claimed ? 'claimed' : t.reached ? 'claimable' : 'locked';
      const box = h('div.soc-tier.' + st, { html: `<small>Escalón ${t.n}</small><div class="soc-chips">${payloadChips(t.reward, 16)}</div>` });
      if (st === 'claimable') {
        const b = h('button.btn.gold.small', { html: 'Cobrar' });
        b.onclick = () => busy(b, async () => {
          const got = claimCoopTier(t.n);
          if (!got) return { error: 'Ese escalón ya se cobró' };
          celebrateGot(b, got);
          setTimeout(() => api.rerender(), 500);
          return got;
        });
        box.append(b);
      } else box.append(h('small', { html: st === 'claimed' ? `${icon('check', 12)} Listo` : `${icon('lock', 12)} ${fmtNum(t.at)}` }));
      tiers.append(box);
    }
    nodes.push(tiers);

    if (info.carry.length) {
      const sec = h('div.soc-sec', { html: `<h4>${icon('gift', 20)} De semanas anteriores<small>¡no se pierden!</small></h4>` });
      info.carry.forEach((c, i) => {
        const row = h('div.soc-card.gold.soc-row', { html: `<b>Escalón ${c.tier}</b><span class="soc-muted">${weekLabel(c.week)}</span><span class="soc-chips soc-grow">${payloadChips(c.reward, 16)}</span>` });
        const b = h('button.btn.gold.small', { html: 'Cobrar' });
        b.onclick = () => busy(b, async () => {
          const got = claimCoopTier(null, i);
          if (!got) return { error: 'Ya se cobró' };
          celebrateGot(b, got);
          setTimeout(() => api.rerender(), 500);
          return got;
        });
        row.append(b);
        sec.append(row);
      });
      nodes.push(sec);
    }

    const ms = h('div.soc-sec', { html: `<h4>${icon('people', 22)} Aportes de la semana</h4>` });
    const max = Math.max(1, ...info.members.map(m => m.points));
    for (const m of info.members) {
      ms.append(h('div.soc-card.soc-mem' + (m.me ? '.me' : ''), {
        html: `${avatarHtml(m.me ? store.state.avatar : lookOf(m.id), m.name, 36, m.me ? 'me' : '')}
          <div class="soc-grow"><b class="soc-ellip" style="display:block">${esc(m.me ? `${myName()} (vos)` : m.name || 'Alguien')}</b><div class="soc-mbar"><i style="width:${(m.points / max * 100).toFixed(1)}%"></i></div></div>
          <b>${fmtNum(m.points)}</b>`,
      }));
    }
    if (info.pending > 0) ms.append(h('p.soc-muted', { style: { fontSize: '13px', textAlign: 'center' }, html: `${icon('rotate', 14)} ${fmtNum(info.pending)} puntos tuyos se suben en un rato` }));
    nodes.push(ms);
    if (!net.user) nodes.push(smallConnect(api, net.mode === 'off' ? 'Cuando se active el modo online, la obra se arma entre tus contactos.' : 'Entrá a tu cuenta para sumar puntos con tus contactos.'));

    const how = h('div.soc-sec', { html: `<h4>${icon('sparkle', 20)} ¿Cómo sumo puntos?</h4>` });
    how.append(h('div.soc-how', {
      html: [
        ['🧭', 'Volver de una expedición', COOP_POINTS.win],
        ['build', 'Terminar una obra', COOP_POINTS.built],
        ['up', 'Mejorar un edificio', COOP_POINTS.upgraded],
        ['🤝', 'Cumplir un pedido', COOP_POINTS.request],
        ['gift', 'Mandar un regalo', COOP_POINTS.gift],
        ['🔨', 'Ayudar en una visita', COOP_POINTS.help],
      ].map(([ic, t, p]) => `<div>${icon(ic, 20)}<span>${t}</span><b>+${p}</b></div>`).join(''),
    }));
    nodes.push(how);
    pane.replaceChildren(...nodes);
  }
}
