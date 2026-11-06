// Panel de Minijuegos: 4 tarjetas con estado (jugar / bloqueado / falta construir), récords,
// chips de eventos activos por juego y los potenciadores que hay en la mochila.
import { icon } from '../core/icons.js';
import { GAMES, BUILDING_BY_ID } from '../core/data.js';
import { ITEMS, itemCount } from '../chests/chests.js';
import { openShell, art, GAME_ART, chestArt } from './panels-common.js';

const sumStars = (obj = {}) => Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);
const fmtMult = (x) => '×' + String(Math.round(x * 100) / 100).replace('.', ',');
/** Potenciadores (objetos de mochila que se usan en un minijuego), por juego. */
const BOOSTERS = Object.fromEntries(GAMES.map(g => [g.id, Object.entries(ITEMS).filter(([, it]) => it.use === 'game' && it.game === g.id).map(([id, it]) => ({ id, ...it }))]));
function boostersOf(gameId) {
  return (BOOSTERS[gameId] || []).map(it => ({ ...it, count: itemCount(it.id) })).filter(it => it.count > 0);
}

export function openGames(ctx) {
  const sh = openShell(ctx, 'games', { title: 'Minijuegos', ic: 'games', sheet: true, className: 'pnl-games' });
  if (!sh) return;
  const { ui, audio, economy } = ctx;
  const { h, esc } = ui;
  const fmt = economy.fmtNum;

  // eventos: módulo de temporada con carga diferida (si falla, el panel anda igual sin chips)
  let EV = null;
  import('../season/events.js').then(m => { EV = m; if (!sh.closed) render(); }).catch(e => console.warn('[games] events', e));
  const events = () => { try { return EV?.activeEvents() || []; } catch (e) { console.warn(e); return []; } };
  const openEvents = () => { audio.sfx('tap'); EV?.openEventsPanel(ctx)?.catch?.(e => console.warn(e)); };

  let bagOpen = false;

  function statsFor(g) {
    const gs = ctx.state.games[g.id] || {};
    const chips = [];
    if (g.id === 'match3' || g.id === 'parking') {
      chips.push(`<span class="chip">${icon('flower', 14)} Nivel ${fmt(gs.level || 1)}</span>`);
      chips.push(`<span class="chip gold">${icon('star', 14)} ${fmt(sumStars(gs.stars))}</span>`);
    } else {
      const best = gs.best || 0;
      const unit = g.id === 'driving' ? ' m' : '';
      chips.push(`<span class="chip gold">${icon('trophy', 14)} ${best ? 'Récord ' + fmt(best) + unit : 'Sin récord'}</span>`);
    }
    // evento que mejora los premios de este juego
    const key = g.id + 'Rewards';
    const evs = events().filter(e => (e.mult?.[key] || 1) !== 1);
    if (evs.length) {
      const mult = evs.reduce((m, e) => m * e.mult[key], 1);
      chips.push(`<span class="chip pnl-evchip" style="--ec:${evs[0].color}" title="${esc(evs.map(e => e.title).join(' + '))}">${icon(evs[0].emoji, 14)} Premios ${fmtMult(mult)}</span>`);
    }
    // potenciadores en la mochila para este juego
    const bs = boostersOf(g.id);
    if (bs.length) chips.push(`<span class="chip second" title="Potenciadores en tu mochila">${bs.map(b => `${icon(b.icon, 14)}${b.count}`).join(' ')}</span>`);
    return chips.join('');
  }

  // eventos que valen para todos los juegos (cofres, figuritas, carrera de estrellas)
  function eventStrip() {
    const list = events().filter(e => e.progress || (e.mult?.chestDrop || 1) !== 1 || (e.mult?.stickers || 1) !== 1
      || GAMES.some(g => (e.mult?.[g.id + 'Rewards'] || 1) !== 1));
    if (!list.length) return null;
    const strip = h('div.pnl-evstrip');
    for (const e of list) {
      const btn = h('button.pnl-evcard', { style: `--ec:${e.color};--ecd:${e.dark}`, 'aria-label': `${e.title}: ${e.short}. Termina en ${e.endsIn}` });
      btn.innerHTML = `<span class="pnl-evcard-ic">${icon(e.emoji, 28)}</span>
        <span class="pnl-evcard-txt"><b>${esc(e.title)}</b><small>${esc(e.short)} · ${icon('clock', 12)} ${esc(e.endsIn)}</small></span>`;
      btn.onclick = openEvents;
      strip.append(btn);
    }
    return strip;
  }

  // "Potenciadores en tu mochila": cuántos hay por juego
  function bagCard() {
    const per = GAMES.map(g => ({ g, list: boostersOf(g.id) }));
    const total = per.reduce((s, p) => s + p.list.reduce((a, b) => a + b.count, 0), 0);
    const card = h('div.card.pnl-bag' + (bagOpen ? '.open' : ''));
    const head = h('button.pnl-bag-head', { 'aria-expanded': bagOpen ? 'true' : 'false' });
    head.innerHTML = `<span class="pnl-bag-ic">${icon('bag', 28)}</span>
      <span class="pnl-bag-txt"><b>Potenciadores en tu mochila</b><small>${total ? `Tenés <b>${fmt(total)}</b> · se eligen antes de jugar` : 'Salen en los cofres: ¡ayudan un montón!'}</small></span>
      <span class="pnl-bag-arrow">${icon(bagOpen ? 'up' : 'plus', 18)}</span>`;
    head.onclick = () => { audio.sfx('select'); bagOpen = !bagOpen; render(); };
    card.append(head);
    if (bagOpen) {
      const body = h('div.pnl-bag-body');
      for (const { g, list } of per) {
        const all = (BOOSTERS[g.id] || []);
        if (!all.length) continue;
        const row = h('div.pnl-bag-row');
        row.innerHTML = `<span class="pnl-bag-game">${art(GAME_ART[g.id], 32)}<b>${esc(g.name)}</b></span>
          <span class="pnl-bag-items">${all.map(it => {
            const n = list.find(x => x.id === it.id)?.count || 0;
            return `<span class="pnl-bag-item${n ? '' : ' none'}" title="${esc(it.desc || it.name)}">${icon(it.icon, 22)}<span><b>${esc(it.name)}</b><small>×${n}</small></span></span>`;
          }).join('')}</span>`;
        body.append(row);
      }
      const go = h('button.btn.second.block', { html: total ? `${icon('bag', 20)} Ver mi mochila` : `${chestArt('madera', 22)} Ir a Cofres` });
      go.onclick = async () => {
        audio.sfx('tap');
        sh.close();
        try { const m = await import('../chests/chests-ui.js'); await m.openChestsPanel(ctx, { tab: total ? 'mochila' : 'cofres' }); }
        catch (e) { console.warn(e); ui.toast('No se pudo abrir la mochila', { icon: 'info' }); }
      };
      body.append(go);
      card.append(body);
    }
    return card;
  }

  const eventsKey = () => events().map(e => e.key + (e.progress ? ':' + e.progress.cur : '')).join('|');
  let evKey = '';
  function render() {
    if (sh.closed) return;
    evKey = eventsKey();
    const top = sh.body.scrollTop;
    sh.body.innerHTML = '';
    const totalStars = sumStars(ctx.state.games.match3?.stars) + sumStars(ctx.state.games.parking?.stars);
    sh.body.append(h('div.pnl-games-head', { html: `
      <p>¡Jugá y ganá ${icon('coin', 18)} monedas, ${icon('gem', 18)} gemas, cofres y figuritas!</p>
      <span class="chip gold">${icon('star', 16)} ${fmt(totalStars)} estrellas</span>` }));
    const strip = eventStrip();
    if (strip) sh.body.append(strip);
    sh.body.append(bagCard());
    const grid = h('div.pnl-games-grid');
    for (const g of GAMES) {
      const st = ctx.gameStatus(g.id);
      const bdef = BUILDING_BY_ID[g.building];
      const placed = ctx.state.city.buildings.find(b => b.id === g.building);
      const card = h('div.card.pnl-game' + (st.locked ? '.locked' : ''));
      card.style.setProperty('--gc', g.color);
      card.innerHTML = `
        <div class="pnl-game-art"><span class="${st.ok ? 'pnl-bob' : ''}">${art(GAME_ART[g.id], 72)}</span>${st.locked ? `<span class="pnl-game-lock">${icon('lock', 34)}</span>` : ''}</div>
        <div class="pnl-game-body">
          <b class="pnl-game-name">${esc(g.name)}</b>
          <p class="pnl-game-desc">${esc(g.desc)}</p>
          ${st.locked ? '' : `<div class="pnl-chips">${statsFor(g)}</div>`}
        </div>`;
      const foot = h('div.pnl-game-foot');
      if (st.ok) {
        foot.append(h('button.btn.primary.block', { html: `${icon('play', 20)} Jugar`, onclick: () => { audio.sfx('tap'); sh.close(); ctx.router.openGame(g.id); } }));
      } else if (st.locked) {
        foot.append(h('div.pnl-lockmsg', { html: `${icon('lock', 18)}<span>Llegá al <b>nivel ${g.unlock}</b></span>` }));
      } else if (st.needsBuilding && placed && economy.isConstructing(placed)) {
        foot.append(h('div.pnl-lockmsg.building', { html: `${icon('clock', 18)}<span>En obra: <b data-left="${placed.uid}">${economy.fmtTime(economy.remainingMs(placed) / 1000)}</b></span>` }));
      } else if (st.needsBuilding) {
        foot.append(h('button.btn.mint.block', {
          html: `${icon('hammer', 22)}<span class="pnl-btn2"><span>Construir</span><small>${esc(bdef?.name || '')}</small></span>`,
          onclick: () => { audio.sfx('tap'); sh.close(); ctx.bus.emit('hud:build', { focus: st.needsBuilding }); },
        }));
      }
      card.append(foot);
      grid.append(card);
    }
    sh.body.append(grid);
    sh.body.scrollTop = top;
  }

  // cuenta regresiva de obras + refrescar cuando termina algo
  sh.every(1000, () => {
    for (const el of sh.body.querySelectorAll('[data-left]')) {
      const b = ctx.state.city.buildings.find(o => o.uid === Number(el.dataset.left));
      if (!b || !economy.isConstructing(b)) { render(); return; }
      el.textContent = economy.fmtTime(economy.remainingMs(b) / 1000);
    }
    // si empieza o termina un evento con el panel abierto, se actualizan los chips
    if (EV && eventsKey() !== evKey) render();
  });
  for (const ev of ['building:built', 'building:placed', 'level:up', 'chests:changed']) sh.on(ctx.bus, ev, () => requestAnimationFrame(render));

  render();
  return sh.done;
}
