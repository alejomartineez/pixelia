// UI del Pase de Temporada (camino vertical con los 30 niveles) y del regalo de bienvenida.
import { h, esc, modal, toast, rewardModal, flyCurrency, confetti } from '../core/ui.js';
import { icon, iconUrl } from '../core/icons.js';
import { audio } from '../core/audio.js';
import { bus } from '../core/bus.js';
import { fmtNum } from '../core/economy.js';
import {
  seasonInfo, claimTier, claimAllTiers, claimSeasonBonus, ackSeasonEnd, welcomeBackStatus, claimWelcomeBack, toMs, MAX_TIER,
} from './season.js';
import { POINT_SOURCES, THEMES, BONUS_EVERY } from './season-data.js';
import { useStyle, setTheme, partIcon, partLabel, partChip, chestIcon } from './season-ui-common.js';

const fly = (el, parts) => {
  const r = el?.getBoundingClientRect?.();
  const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2;
  for (const p of parts) if (p.kind === 'coins' || p.kind === 'gems') flyCurrency(x, y, p.kind, p.kind === 'coins' ? 8 : 5);
};
function storageToast(parts) {
  const where = parts.filter(p => p.kind !== 'coins' && p.kind !== 'gems');
  if (!where.length) return;
  const p = where[0];
  const dest = p.kind === 'chest' ? 'a tus cofres' : p.kind === 'item' ? 'a tu mochila' : p.kind === 'stickers' ? 'para tu álbum' : 'a tu vestidor';
  toast(`¡${partLabel(p)} ${dest}!`, { icon: p.kind === 'cosmetic' ? 'dress' : p.kind === 'stickers' ? '🃏' : 'gift', type: 'good' });
}
const partsLine = (parts, size = 22) => `<span class="ssn-parts">${parts.map(p => partChip(p, size)).join('')}</span>`;

// ---------- Pase ----------
export function openSeasonPass(ctx, now) {
  const fixed = now != null;
  const T = () => (fixed ? toMs(now) : Date.now());
  const release = useStyle();
  const wrap = h('div.ssn-wrap');
  let info = seasonInfo(T());
  let raf = 0;
  const offs = [];
  const m = modal({
    title: 'Pase de Temporada', icon: 'sparkle', content: wrap, className: 'sheet ssn ssn-pass',
    onClose: () => { clearInterval(timer); cancelAnimationFrame(raf); offs.forEach(f => f()); release(); },
  });
  m.body.style.position = 'relative';
  setTheme(m.el, info.theme);

  function heroHtml() {
    const t = info.theme;
    return `<div class="ssn-hero">
      <div class="ssn-hero-ic">${icon(t.emoji, 52)}</div>
      <div class="ssn-hero-txt"><small>Temporada ${info.id} · día ${info.day} de 28</small>
        <h3>${esc(t.name)}</h3><p>${esc(t.phrase)}</p>
        <div class="ssn-hero-row"><span class="ssn-clock">${icon('clock', 18)} Termina en <b data-clock>${info.endsIn}</b></span>
        <button class="ssn-howbtn" data-how>${icon('sparkle', 16)} ¿Cómo gano chispas?</button></div></div></div>`;
  }
  function statusHtml() {
    const maxed = info.level >= MAX_TIER;
    const n = info.claimable.length + info.bonus.claimable;
    const left = info.need - info.into;
    return `<div class="ssn-status">
      <div class="ssn-lvl"><small>Nivel</small><b>${info.level}</b></div>
      <div class="ssn-st-mid">
        <div class="row"><span>${maxed ? 'Próximo cofre extra' : `Hacia el nivel ${info.level + 1}`}</span><b>${icon('sparkle', 16)}${fmtNum(info.into)}/${fmtNum(info.need)}</b></div>
        <div class="ssn-bar"><i style="width:${(info.pct * 100).toFixed(1)}%"></i></div>
        <span class="ssn-hint">${maxed && !info.bonus.unlocked ? '' : `Faltan <b>${fmtNum(left)}</b> chispas`}</span>
      </div>
      <button class="btn gold${n ? ' ssn-glowbtn' : ''}" data-all ${n ? '' : 'disabled'}>${icon('gift', 22)}<span>Cobrar todo</span>${n ? `<small>(${n})</small>` : ''}</button>
    </div>`;
  }
  function endHtml() {
    const e = info.lastEnd;
    if (!e || e.seen) return '';
    const th = THEMES.find(x => x.id === e.themeId) || info.theme;
    return `<div class="ssn-end">${chestIcon('real', 56)}
      <h4>Cofre de fin de temporada</h4>
      <p>Terminó <b>${esc(th.name)}</b> ${icon(th.emoji, 18)} y llegaste al <b>nivel ${e.level}</b>. ${e.parts.length ? 'Todo lo que no habías cobrado ya está en tu cuenta:' : '¡Habías cobrado todo! Sos una estrella.'}</p>
      ${e.parts.length ? partsLine(e.parts) : ''}
      <button class="btn primary small" data-ack>¡Gracias!</button></div>`;
  }
  function railFill(n) {
    const L = info.level, pct = info.level >= MAX_TIER ? 1 : info.pct;
    if (n === 1) return L >= 2 ? 100 : L === 1 ? pct * 100 : 0;
    if (n < L) return 100;
    if (n === L) return L >= MAX_TIER ? 50 : 50 + 50 * pct;
    if (n === L + 1) return 50 * pct;
    return 0;
  }
  function rowHtml(r) {
    const side = r.n % 2 ? 'left' : 'right';
    const reached = r.n <= info.level;
    const [main, ...rest] = r.parts;
    let foot = '';
    if (r.state === 'claimable') foot = `<button class="btn gold small" data-claim="${r.n}">Cobrar</button>`;
    else if (r.state === 'claimed') foot = `<small>${icon('check', 14)} ¡Cobrado!</small>`;
    else if (r.state === 'next') foot = `<small>Faltan ${fmtNum(r.at - info.points)} ${icon('sparkle', 12)}</small>`;
    else foot = `<small>${fmtNum(r.at)} ${icon('sparkle', 12)}</small>`;
    const sub = main.kind === 'cosmetic' ? '<small>Prenda premium gratis</small>' : main.kind === 'item' ? '<small>Potenciador</small>' : main.note ? `<small>${esc(main.note)}</small>` : '';
    return `<div class="ssn-row ${side} ${r.state}${reached ? ' reached' : ''}${r.special ? ' special' : ''}" data-row="${r.n}">
      <div class="ssn-rail"><i style="height:${railFill(r.n)}%"></i></div>
      <div class="ssn-node">${r.n}${r.state === 'claimed' ? `<span class="ssn-ok">${icon('check', 20)}</span>` : ''}</div>
      <div class="ssn-card">
        <div class="ssn-card-ic">${partIcon(main, r.special ? 46 : 40)}${r.state === 'locked' || r.state === 'next' ? `<span class="ssn-lock">${icon('lock', 18)}</span>` : ''}</div>
        <div class="ssn-card-txt"><b>${esc(partLabel(main))}</b>${sub}
          ${rest.length ? `<span class="ssn-mini">${rest.map(p => partChip(p, 16)).join('')}</span>` : ''}${foot}</div>
      </div>
      <div class="ssn-side">${r.special ? '<span>Premio</span><span>especial</span>' : icon(info.theme.emoji, 26, 'ssn-deco')}</div>
    </div>`;
  }
  function bonusHtml() {
    const b = info.bonus;
    return `<div class="ssn-bonus">${chestIcon('madera', 44)}
      <div class="col"><b>Después del nivel 30</b>
        <span class="ssn-hint">${b.unlocked ? `Un Cofre de Madera cada ${BONUS_EVERY} chispas. Llevás ${b.progress}/${BONUS_EVERY}.` : `Seguí juntando chispas: cada ${BONUS_EVERY} te ganás un Cofre de Madera extra.`}</span>
        ${b.unlocked ? `<div class="ssn-bar"><i style="width:${(b.progress / BONUS_EVERY * 100).toFixed(1)}%"></i></div>` : ''}</div>
      ${b.claimable ? `<button class="btn gold small" data-bonus>Cobrar ×${b.claimable}</button>` : ''}</div>`;
  }
  function howHtml() {
    return `<div class="ssn-how" data-howbox><h4>${icon('sparkle', 22)} ¿Cómo gano chispas?</h4>
      <ul>${POINT_SOURCES.map(s => `<li>${icon(s.ic, 22)}<span>${esc(s.text)}</span><b>+${s.pts}</b></li>`).join('')}</ul>
      <p>Cada nivel cuesta unas 120 chispas: jugando un ratito por día llegás al 30 antes de que termine la temporada. Y si no llegás a cobrar algo, se guarda solo en un cofre de fin de temporada: <b>no se pierde nada</b>.</p></div>`;
  }

  function render() {
    info = seasonInfo(T());
    setTheme(m.el, info.theme);
    const st = m.body.scrollTop;
    wrap.innerHTML = heroHtml() + statusHtml() + endHtml()
      + `<div class="ssn-track">${info.rewards.map(rowHtml).join('')}</div>` + bonusHtml() + howHtml();
    m.body.scrollTop = st;
  }
  const rerender = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); };

  function doClaim(n, btn) {
    const card = btn.closest('.ssn-card');
    const r = claimTier(n, T());
    if (!r) return;
    audio.sfx(r.special ? 'levelup' : 'buy');
    fly(card, r.parts);
    card?.classList.add('ssn-pop');
    if (r.special) {
      confetti();
      rewardModal({ title: '¡Premio especial!', subtitle: `Nivel ${n} del Pase`, lines: [partsLine(r.parts, 28)], buttons: [{ label: '¡Me encanta!', value: 'ok', cls: 'gold' }] });
    } else storageToast(r.parts);
    setTimeout(render, 380);
  }
  function doAll(btn) {
    const res = claimAllTiers(T());
    if (!res.tiers.length && !res.bonus) return;
    audio.sfx('win');
    fly(btn, res.parts);
    confetti();
    const k = res.tiers.length;
    rewardModal({ title: '¡Cobraste todo!', subtitle: k ? `${k} nivel${k > 1 ? 'es' : ''} del Pase` : 'Cofres extra', lines: [partsLine(res.parts, 24)], buttons: [{ label: '¡Genial!', value: 'ok', cls: 'gold' }] });
    render();
  }

  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.claim) doClaim(Number(b.dataset.claim), b);
    else if ('all' in b.dataset) doAll(b);
    else if ('how' in b.dataset) {
      audio.sfx('tap');
      const box = wrap.querySelector('[data-howbox]');
      const y = box.getBoundingClientRect().top - m.body.getBoundingClientRect().top + m.body.scrollTop;
      m.body.scrollTo({ top: y - 110, behavior: 'smooth' });
    }
    else if ('bonus' in b.dataset) { const n = claimSeasonBonus(T()); if (n) { audio.sfx('buy'); toast(`¡${n} Cofre${n > 1 ? 's' : ''} de Madera a tus cofres!`, { icon: 'gift', type: 'good' }); render(); } }
    else if ('ack' in b.dataset) { audio.sfx('tap'); ackSeasonEnd(); render(); }
  });

  render();
  // centrar el nivel interesante (primer cobrable o el próximo)
  requestAnimationFrame(() => {
    const target = wrap.querySelector('.ssn-row.claimable') || wrap.querySelector('.ssn-row.next') || wrap.querySelector('.ssn-row:last-child');
    if (target && info.level > 0) {
      const y = target.getBoundingClientRect().top - m.body.getBoundingClientRect().top + m.body.scrollTop;
      m.body.scrollTop = Math.max(0, y - m.body.clientHeight * 0.38);
    }
  });
  offs.push(bus.on('season:changed', rerender));
  const timer = setInterval(() => {
    const el = wrap.querySelector('[data-clock]');
    if (el) el.textContent = seasonInfo(T()).endsIn;
  }, 20e3);
  return m;
}

// ---------- Bienvenida de vuelta ----------
/** Muestra el regalo "¡Te extrañamos!" si corresponde. Promise<status cobrado | null>. */
export function openWelcomeBack(ctx, now) {
  const st = welcomeBackStatus(now);
  if (!st) return Promise.resolve(null);
  const release = useStyle();
  return new Promise((resolve) => {
    let claimed = null;
    const theme = seasonInfo(now).theme;
    const items = [];
    if (st.reward.coins) items.push(`<div class="ssn-wb-item" data-coins>${icon('coin', 36)}${fmtNum(st.reward.coins)}<small>monedas</small></div>`);
    if (st.reward.gems) items.push(`<div class="ssn-wb-item">${icon('gem', 36)}${st.reward.gems}<small>gemas</small></div>`);
    items.push(`<div class="ssn-wb-item">${chestIcon(st.chestType, 40)}${st.chests > 1 ? '×' + st.chests : '×1'}<small>Cofre de Madera</small></div>`);
    const hearts = [12, 30, 62, 80, 46].map((x, i) => `<img class="pi" data-pi="heart" src="${iconUrl('heart', 24)}" style="left:${x}%;bottom:8px;animation-delay:${i * 0.5}s" width="24" height="24" alt="">`).join('');
    const content = h('div.ssn-wb', { html: `
      <div class="ssn-wb-stage"><div class="ssn-rays"></div><div class="ssn-wb-hearts">${hearts}</div>${icon('gift', 88)}</div>
      <p>${esc(st.message)}</p>
      <p class="ssn-away">${icon('calendar', 16)} Estuviste ${st.days} días afuera</p>
      <div class="ssn-wb-items">${items.join('')}</div>` });
    const m = modal({
      title: st.title, icon: 'heart', content, closable: false, className: 'ssn ssn-welcome',
      onClose: () => { release(); resolve(claimed); },
      actions: [{
        html: `${icon('gift', 22)} ¡Abrir regalo!`, cls: 'gold',
        onClick: () => {
          claimed = claimWelcomeBack(now);
          if (claimed) {
            audio.sfx('win');
            fly(content.querySelector('[data-coins]'), [{ kind: 'coins' }, ...(claimed.reward.gems ? [{ kind: 'gems' }] : [])]);
            confetti();
            toast(`¡${claimed.chests > 1 ? claimed.chests + ' Cofres' : 'Cofre'} de Madera a tus cofres!`, { icon: 'gift', type: 'good' });
          }
        },
      }],
    });
    setTheme(m.el, theme);
  });
}
