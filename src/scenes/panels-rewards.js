// Paneles festivos: premio diario (login) y subida de nivel.
import { icon } from '../core/icons.js';
import { BUILDINGS, GAMES, CUSTOM_CATALOG, TOWN_RANKS, LOGIN_REWARDS, MAX_EXPANSIONS, fitsType, avatarType } from '../core/data.js';
import { openShell, rewardFx, art, GAME_ART, rewardHtml, chestArt, chestList } from './panels-common.js';
import { CHESTS, chestCount, levelUpChests } from '../chests/chests.js';

// ---------- Premio diario ----------
export function openLogin(ctx) {
  const { ui, quests, audio } = ctx;
  const { h, costHtml } = ui;
  const status = quests.loginStatus();
  let claimed = !status;
  const streakNow = status ? status.streak : ctx.state.login.streak || 1;
  const day = status ? status.day : ((Math.max(1, streakNow) - 1) % LOGIN_REWARDS.length) + 1;

  let primaryBtn = null;
  const sh = openShell(ctx, 'login', {
    title: 'Premio diario', ic: 'gift', className: 'pnl-md pnl-login reward-modal', closable: false,
    actions: [{
      html: claimed ? `${icon('check', 20)} Hasta mañana` : `${icon('gift', 22)} Abrir regalo`, cls: 'gold',
      onClick: () => { if (claimed) return; claim(); return false; },
    }],
  });
  if (!sh) return;
  primaryBtn = sh.el.querySelector('.modal-foot .btn');

  const wrap = h('div.pnl-login-wrap');
  const stage = h('div.pnl-stage');
  const streakTxt = claimed ? `Ya cobraste hoy. Racha de <b>${streakNow}</b> ${streakNow === 1 ? 'día' : 'días'}` : streakNow > 1 ? `Volviste. Racha de <b>${streakNow}</b> días` : 'Tu regalo de hoy:';
  const head = h('p.pnl-streak', { html: `${icon(streakNow > 1 ? 'fire' : 'sparkle', 22)}<span>${streakTxt}</span>` });
  const grid = h('div.pnl-days');
  const cells = [];
  LOGIN_REWARDS.forEach((rw, i) => {
    const d = i + 1;
    const state = d < day ? 'past' : d === day ? (claimed ? 'past today' : 'today') : 'future';
    const big = d === LOGIN_REWARDS.length;
    const chest = chestList(rw)[0];
    const ic = chest ? chestArt(chest.type, big ? 44 : 32) : big ? icon('gift', 40) : icon(rw.gems ? 'gem' : 'coin', 30);
    const cell = h('div.pnl-day.' + state.split(' ').join('.') + (big ? '.big' : '') + (chest ? '.chest' : ''), { html: `
      <small>Día ${d}</small>
      <span class="pnl-day-ic">${ic}</span>
      <span class="pnl-day-rw">${rewardHtml(rw, 14, { names: big }) || costHtml(rw, 14)}</span>
      <span class="pnl-day-check">${icon('check', 22)}</span>` });
    cells.push(cell);
    grid.append(cell);
  });

  function paintStage() {
    if (claimed) {
      stage.innerHTML = `<div class="pnl-rays"></div><div class="pnl-stage-ic">${icon('calendar', 72)}</div><p class="pnl-stage-txt">Volvé mañana por el <b>día ${(day % LOGIN_REWARDS.length) + 1}</b></p>`;
    } else {
      const ch = chestList(status.reward)[0];
      stage.innerHTML = `<div class="pnl-rays"></div><div class="pnl-stage-ic pnl-bob">${ch ? chestArt(ch.type, 88) : icon('gift', 88)}</div><p class="pnl-stage-txt">Día ${day}: ${rewardHtml(status.reward, 20) || costHtml(status.reward, 20)}</p>`;
    }
  }
  paintStage();
  wrap.append(head);
  // escudo de racha: si ayer faltó, la racha se pausó en vez de reiniciarse
  if (status?.shielded) {
    wrap.append(h('div.pnl-shield', { html: `
      <span class="pnl-shield-ic pnl-pop">${icon('🛡️', 40)}</span>
      <span><b>¡Tu racha se salvó!</b><small>Ayer no pudiste entrar, pero tu escudo de la semana la cuidó. ¡Seguimos sumando días!</small></span>` }));
  }
  wrap.append(stage, grid);
  sh.body.append(wrap);

  function claim() {
    if (claimed) return;
    const reward = quests.claimLogin();
    if (!reward) { claimed = true; paintStage(); return; }
    claimed = true;
    audio.sfx('pop');
    const gift = stage.querySelector('.pnl-stage-ic');
    gift?.classList.remove('pnl-bob');
    gift?.classList.add('pnl-shake-hard');
    primaryBtn.disabled = true;
    sh.later(650, () => {
      audio.sfx('buy');
      stage.classList.add('open');
      const ch = chestList(reward)[0];
      const coinsGems = (reward.coins || reward.gems || reward.xp) ? costHtml(reward, ch ? 28 : 34) : '';
      stage.innerHTML = `<div class="pnl-rays spin"></div><div class="pnl-stage-reward pnl-pop">${ch ? `<span class="pnl-stage-chest">${chestArt(ch.type, 48)}</span>` : ''}${coinsGems}</div>`
        + `<p class="pnl-stage-txt">${ch ? `¡${CHESTS[ch.type].name}! Te espera en Cofres` : 'Es tuyo.'}</p>`;
      const cell = cells[day - 1];
      cell.classList.remove('today'); cell.classList.add('past', 'today', 'pnl-pop');
      rewardFx(stage, reward, { chestText: false });
      const st = ctx.state.login.streak || 1;
      head.innerHTML = `${icon(status?.shielded ? '🛡️' : 'fire', 22)}<span>Racha de <b>${st}</b> ${st === 1 ? 'día' : 'días'}. Volvé mañana.</span>`;
      primaryBtn.disabled = false;
      primaryBtn.innerHTML = `${icon('check', 20)} Gracias`;
      sh.escAction = () => sh.close();
    });
  }

  sh.keyHandler = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!primaryBtn.disabled) primaryBtn.click(); }
  };
  if (claimed) sh.escAction = () => sh.close();
  return sh.done;
}

// ---------- Subida de nivel ----------
const KIND = {
  hair: ['Peinado', 'ribbon'], dress: ['Ropa', 'dress'], crown: ['Cabeza', 'crown'], acc: ['Accesorio', 'wand'],
  body: ['Auto', 'car'], wheels: ['Ruedas', 'sparkle'], topper: ['Adorno de auto', 'ribbon'],
};
const CAT_ICON = { casa: 'home', negocio: 'shop', deco: 'flower', especial: 'castle', camino: 'map' };
const CAT_NAME = { casa: 'Casa', negocio: 'Negocio', deco: 'Deco', especial: 'Especial', camino: 'Camino' };

function unlocksAt(level, state) {
  const list = [];
  for (const g of GAMES.filter(g => g.unlock === level)) list.push({ kind: 'Minijuego', name: g.name, ic: art(GAME_ART[g.id], 44), hot: true });
  // rango actual de la ciudad (nivel de la Municipalidad): algunos edificios además piden rango
  const rank = state?.city?.buildings?.find(b => b.id === 'castillo')?.level || 1;
  for (const b of BUILDINGS.filter(b => b.unlock === level)) {
    const needRank = b.rank && b.rank > rank ? TOWN_RANKS[b.rank - 1] : null;
    list.push({ kind: (CAT_NAME[b.cat] || 'Edificio') + (needRank ? ` · rango ${needRank.name}` : ''), name: b.name, ic: icon(CAT_ICON[b.cat] || 'home', 40), building: b.id });
  }
  for (const r of TOWN_RANKS.filter(r => r.reqLevel === level && r.rank > rank)) list.push({ kind: 'Tu ciudad', name: `Expediente para ${r.name}`, ic: icon(r.emoji, 40) });
  // expansión de terreno n se habilita en nivel 2 + 2n y con el rango que da ese terreno (ver economy.expansionInfo)
  const n = (level - 2) / 2;
  const landOk = (TOWN_RANKS[rank - 1]?.land ?? 1) > n;
  if (Number.isInteger(n) && n >= 0 && n < MAX_EXPANSIONS && landOk && (state?.city?.expansions ?? 0) <= n) list.push({ kind: 'Terreno', name: 'Más lugar para construir', ic: icon('map', 40) });
  for (const [kind, items] of Object.entries(CUSTOM_CATALOG)) {
    // del personaje, solo lo que le sirve a su tipo (lo demás no aparece en su Vestidor)
    const avatarPiece = ['hair', 'dress', 'crown', 'acc'].includes(kind);
    for (const it of items.filter(i => !i.free && i.unlock === level && (!avatarPiece || fitsType(i, state?.avatar?.type)))) {
      const label = kind === 'hair' && avatarType(state?.avatar?.type).animal ? 'Pelaje' : KIND[kind]?.[0] || 'Ropa';
      list.push({ kind: label, name: it.name, ic: icon(KIND[kind]?.[1] || 'dress', 40) });
    }
  }
  return list;
}
function nextUnlock(level) {
  let best = Infinity;
  for (const b of BUILDINGS) if (b.unlock > level) best = Math.min(best, b.unlock);
  for (const g of GAMES) if (g.unlock > level) best = Math.min(best, g.unlock);
  if (!isFinite(best)) return null;
  return { level: best, names: [...GAMES.filter(g => g.unlock === best), ...BUILDINGS.filter(b => b.unlock === best)].map(x => x.name).slice(0, 3) };
}

export function openLevelUp(ctx, params = {}) {
  const { ui, audio } = ctx;
  const { h, esc, costHtml } = ui;
  const level = Number(params.level) || ctx.state.player.level;
  const reward = params.reward || {};
  // si subió varios niveles de golpe, las ventanas salen de a una: el botón avisa que viene otra
  const more = ctx.state.player.level > level;
  // cofres que se ganaron por subir a este nivel (ya están en el inventario: los suma chests.js al escuchar level:up)
  let chests = [];
  try { chests = (levelUpChests(level) || []).filter(t => CHESTS[t]); } catch (e) { console.warn('levelUpChests', e); }
  const canOpen = chests.some(t => chestCount(t) > 0);
  let openNow = false;
  const actions = canOpen
    ? [{ label: 'Después', cls: 'ghost' }, { html: `${icon('gift', 20)} Abrir ahora`, cls: 'gold', onClick: () => { openNow = true; } }]
    : [{ html: more ? `${icon('sparkle', 20)} Ver nivel ${level + 1}` : `${icon('check', 20)} Seguir`, cls: 'primary' }];
  const sh = openShell(ctx, 'levelup:' + level, {
    title: 'Subiste de nivel', ic: 'star', className: 'pnl-md pnl-levelup reward-modal', closable: false, actions,
  });
  if (!sh) return;

  const wrap = h('div.pnl-lv');
  wrap.append(h('div.pnl-lv-burst', { html: `<div class="pnl-rays spin"></div><div class="pnl-lv-star">${icon('star', 120)}<b>${level}</b></div>` }));
  wrap.append(h('h2.pnl-lv-title', {}, `¡Nivel ${level}!`));
  wrap.append(h('p.pnl-lv-sub', {}, level >= 10 ? 'La ciudad se va armando.' : 'La ciudad crece.'));
  if (reward.coins || reward.gems) {
    wrap.append(h('div.pnl-lv-reward', { html: `<small>Premio</small>${costHtml(reward, 26)}` }));
  }
  if (chests.length) {
    const box = h('div.pnl-lv-chests');
    chests.forEach((t, i) => {
      box.append(h('div.pnl-lv-chest', { style: { animationDelay: (0.45 + i * 0.12) + 's' }, html: `
        <span class="pnl-lv-chest-ic ${i === 0 ? 'pnl-shake' : ''}">${chestArt(t, 48)}</span><b>${esc(CHESTS[t].name)}</b>` }));
    });
    wrap.append(h('h4.pnl-lv-h', { html: `${icon('gift', 18)} ¡${chests.length > 1 ? 'Cofres' : 'Un cofre'} de regalo!` }), box);
    if (!canOpen) wrap.append(h('p.pnl-lv-next', { html: `${icon('info', 16)}<span>Te ${chests.length > 1 ? 'esperan' : 'espera'} en <b>Cofres</b>.</span>` }));
    else if (more) wrap.append(h('p.pnl-lv-next', { html: `${icon('sparkle', 16)}<span>Después vas a ver el <b>nivel ${level + 1}</b>.</span>` }));
  }
  const items = unlocksAt(level, ctx.state);
  if (items.length) {
    wrap.append(h('h4.pnl-lv-h', { html: `${icon('lock', 18)} Se desbloqueó` }));
    const grid = h('div.pnl-unlocks');
    items.forEach((it, i) => {
      const el = h('div.pnl-unlock' + (it.hot ? '.hot' : ''), { style: { animationDelay: (0.35 + i * 0.07) + 's' }, html: `
        <span class="pnl-unlock-ic">${it.ic}</span>
        <span class="pnl-unlock-txt"><small>${esc(it.kind)}</small><b>${esc(it.name)}</b></span>` });
      if (it.building) el.dataset.building = it.building;
      grid.append(el);
    });
    wrap.append(grid);
    loadThumbs(grid);
  }
  const nx = nextUnlock(level);
  if (!items.length) {
    wrap.append(h('div.pnl-lv-empty', { html: `${icon('castle', 40)}<span>${nx ? 'Cada nivel trae más premios.' : 'Ya desbloqueaste todos los edificios. Queda mejorar y decorar.'}</span>` }));
  }
  if (nx) wrap.append(h('p.pnl-lv-next', { html: `${icon('sparkle', 16)}<span>Próximamente, en el <b>nivel ${nx.level}</b>: ${nx.names.map(esc).join(', ')}</span>` }));
  sh.body.append(wrap);

  async function loadThumbs(grid) {
    const els = [...grid.querySelectorAll('[data-building]')];
    if (!els.length) return;
    try {
      const mod = await import('../city/models.js');
      if (typeof mod.thumbnail !== 'function') return;
      for (const el of els) {
        if (sh.closed) return;
        try {
          const url = await Promise.race([mod.thumbnail(el.dataset.building, 1), new Promise(r => setTimeout(() => r(null), 4000))]);
          if (url && !sh.closed) {
            const box = el.querySelector('.pnl-unlock-ic');
            box.innerHTML = `<img class="pi pnl-thumb" src="${url}" width="48" height="48" alt="">`;
          }
        } catch (e) { console.warn('thumbnail', e); }
      }
    } catch (e) { console.warn('models', e); }
  }

  audio.sfx('star');
  sh.escAction = () => sh.close();
  // Enter = botón principal (el último: "Abrir ahora" o "¡Genial!")
  sh.keyHandler = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const btns = sh.el.querySelectorAll('.modal-foot .btn');
    if (btns.length) btns[btns.length - 1].click(); else sh.close();
  };
  // "Abrir ahora": al cerrar la ventana se abren los cofres de este nivel de a uno (la promesa espera a que terminen,
  // así la siguiente subida de nivel no aparece encima de la animación)
  return sh.done.then(async (res) => {
    if (!openNow) return res;
    try {
      const ui = await import('../chests/chests-ui.js');
      for (const t of chests) {
        if (chestCount(t) <= 0) continue;
        await ui.openChestFlow(ctx, t);
      }
    } catch (e) {
      console.warn('openChestFlow', e);
      ctx.ui.toast('Tus cofres te esperan en Cofres', { icon: 'gift' });
    }
    return res;
  });
}
