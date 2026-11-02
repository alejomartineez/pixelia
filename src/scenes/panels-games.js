// Panel de Minijuegos: 4 tarjetas con estado (jugar / bloqueado / falta construir).
import { icon } from '../core/icons.js';
import { GAMES, BUILDING_BY_ID } from '../core/data.js';
import { openShell, art, GAME_ART } from './panels-common.js';

const sumStars = (obj = {}) => Object.values(obj).reduce((s, v) => s + (Number(v) || 0), 0);

export function openGames(ctx) {
  const sh = openShell(ctx, 'games', { title: 'Minijuegos', ic: 'games', sheet: true, className: 'pnl-games' });
  if (!sh) return;
  const { ui, audio, economy } = ctx;
  const { h, esc } = ui;
  const fmt = economy.fmtNum;

  function statsFor(g) {
    const gs = ctx.state.games[g.id] || {};
    const chips = [];
    if (g.id === 'match3' || g.id === 'parking') {
      chips.push(`<span class="chip">${icon('flower', 14)} Nivel ${fmt(gs.level || 1)}</span>`);
      chips.push(`<span class="chip gold">${icon('star', 14)} ${fmt(sumStars(gs.stars))}</span>`);
    } else {
      const best = gs.best || 0;
      chips.push(`<span class="chip gold">${icon('trophy', 14)} ${best ? 'Récord ' + fmt(best) : 'Sin récord'}</span>`);
    }
    return chips.join('');
  }

  function render() {
    if (sh.closed) return;
    sh.body.innerHTML = '';
    const totalStars = sumStars(ctx.state.games.match3?.stars) + sumStars(ctx.state.games.parking?.stars);
    sh.body.append(h('div.pnl-games-head', { html: `
      <p>¡Jugá y ganá ${icon('coin', 18)} monedas, ${icon('gem', 18)} gemas y ${icon('xp', 18)} experiencia!</p>
      <span class="chip gold">${icon('star', 16)} ${fmt(totalStars)} estrellas</span>` }));
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
        foot.append(h('button.btn.pink.block', { html: `${icon('play', 20)} Jugar`, onclick: () => { audio.sfx('tap'); sh.close(); ctx.router.openGame(g.id); } }));
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
  }

  // cuenta regresiva de obras + refrescar cuando termina algo
  sh.every(1000, () => {
    for (const el of sh.body.querySelectorAll('[data-left]')) {
      const b = ctx.state.city.buildings.find(o => o.uid === Number(el.dataset.left));
      if (!b || !economy.isConstructing(b)) { render(); return; }
      el.textContent = economy.fmtTime(economy.remainingMs(b) / 1000);
    }
  });
  for (const ev of ['building:built', 'building:placed', 'level:up']) sh.on(ctx.bus, ev, () => requestAnimationFrame(render));

  render();
  return sh.done;
}
