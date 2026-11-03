// CSS de la UI de cofres (panel + apertura). Se inyecta una vez como <style id="chests-style">.
const OUT2 = '2px 0 var(--ink), -2px 0 var(--ink), 0 2px var(--ink), 0 -2px var(--ink), 2px 2px var(--ink), -2px 2px var(--ink), 2px -2px var(--ink), -2px -2px var(--ink)';
const OUT3 = '3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink)';

export const CHX_CSS = `
/* =================== Panel =================== */
.modal.chx-sheet { isolation: isolate; } /* el z-index de las pestañas no debe tapar modales hijos */
.modal.chx-sheet .modal-body { padding-top: 0; }
.chx-top { position: sticky; top: 0; z-index: 3; display: flex; align-items: center; gap: 8px; margin: 0 -16px 4px; padding: 10px 14px 0 16px;
  background: var(--panel); border-bottom: 2px dashed #f0cfe2; }
.chx-top .tabs { flex: 1; min-width: 0; padding: 6px 4px 10px 2px; }
.chx-top .tab { position: relative; font-size: 16px; padding: 6px 12px; }
.chx-top .tab .badge { top: -10px; right: -10px; min-width: 22px; height: 22px; font-size: 12px; }
.chx-gems { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px 2px 5px; background: #fff; color: var(--ink); text-shadow: none;
  border: var(--line) solid var(--ink); border-radius: 99px; box-shadow: 0 3px 0 var(--ink); font-size: 17px; font-weight: 700; }
.chx-pane { padding-bottom: 6px; }
.chx-sec { display: flex; align-items: center; gap: 6px; margin: 14px 2px 8px; font-size: 14px; color: var(--ink-l); text-transform: uppercase; letter-spacing: .08em; }
.chx-sec::after { content: ''; flex: 1; height: 0; border-top: 2px dotted var(--ink-ll); opacity: .5; }
.chx-list { display: grid; gap: 12px; grid-template-columns: 1fr; }
@media (min-width: 640px) { .chx-list.two { grid-template-columns: 1fr 1fr; } }
.chx-tip { margin: 14px 4px 2px; font-size: 13px; color: var(--ink-l); text-align: center; }

.chx-thumbbox { position: relative; flex: none; width: 86px; height: 86px; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 14px;
  background: radial-gradient(circle at 50% 62%, #fff 0 22%, var(--ccl, #ffe9f4) 64%, var(--cc, #ffc2dc) 140%); box-shadow: inset 0 -5px 0 rgba(59,35,64,.12); }
.chx-thumb { width: 80px; height: 80px; image-rendering: pixelated; image-rendering: crisp-edges; pointer-events: none; }
.chx-thumbbox .chx-count { position: absolute; right: -10px; bottom: -10px; min-width: 32px; height: 28px; padding: 0 6px; display: grid; place-items: center;
  background: var(--mint); border: var(--line) solid var(--ink); border-radius: 10px; font-size: 17px; font-weight: 700; box-shadow: 0 2px 0 var(--ink); }

/* Cofre gratis */
.chx-free { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 12px 14px; padding: 12px; background: linear-gradient(135deg, #fff6d8, #ffe3f1); }
.chx-free > .btn { grid-column: 1 / -1; }
.chx-free.ready { background: linear-gradient(135deg, #fff0b8, #ffd3ea); animation: chx-readyglow 1.1s steps(2) infinite; }
.chx-free .chx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.chx-free h3 { font-size: 21px; }
.chx-free .chx-ribbon { position: absolute; top: -8px; left: -6px; padding: 1px 8px; background: var(--coral); color: #fff; border: 2px solid var(--ink); border-radius: 7px;
  font-size: 13px; font-weight: 700; transform: rotate(-8deg); text-shadow: 0 1px 0 rgba(59,35,64,.4); }
.chx-timer { font-size: 15px; color: var(--ink-l); }
.chx-timer b { color: var(--ink); font-size: 17px; }
@keyframes chx-readyglow { 50% { box-shadow: 0 3px 0 var(--ink), 0 0 0 4px var(--gold); } }

/* Tarjeta de cofre (inventario y tienda) */
.chx-chest { display: grid; grid-template-columns: auto 1fr; gap: 12px 14px; align-items: center; padding: 12px; background: linear-gradient(135deg, #fff 40%, var(--ccl)); }
.chx-chest .chx-info { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.chx-chest h3 { font-size: 21px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.chx-chest .chx-actions { grid-column: 1 / -1; display: flex; gap: 8px; }
.chx-chest .chx-actions .btn { flex: 1; }
.chx-chest.empty { background: #fbf6fb; }
.chx-chest.empty .chx-thumb { filter: grayscale(.5) opacity(.6); }
.chx-chest.empty h3 { color: var(--ink-l); }
.chx-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chx-rchip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border: 2px solid var(--ink); border-radius: 99px; background: var(--rcl); font-size: 13px; font-weight: 700; }
.chx-rchip i { width: 9px; height: 9px; border: 2px solid var(--ink); border-radius: 3px; background: var(--rc); }

/* Probabilidades */
.chx-odds { display: flex; height: 14px; border: 2px solid var(--ink); border-radius: 8px; overflow: hidden; background: #fff; }
.chx-odds i { display: block; height: 100%; min-width: 4px; }
.chx-odds i + i { border-left: 2px solid var(--ink); }
.chx-oddleg { display: flex; flex-wrap: wrap; gap: 2px 10px; font-size: 13px; color: var(--ink-l); }
.chx-oddleg span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.chx-oddleg b { color: var(--ink); }
.chx-oddleg span i { width: 10px; height: 10px; border: 2px solid var(--ink); border-radius: 3px; display: inline-block; }
.chx-what { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border: 2px solid var(--ink); border-radius: 99px; background: #fff;
  font-size: 13px; font-weight: 700; box-shadow: 0 2px 0 var(--ink); }
.chx-what:active { transform: translateY(2px); box-shadow: none; }

/* Mochila */
.chx-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(152px, 1fr)); gap: 12px; }
.chx-item { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; padding: 10px 8px 10px;
  border: var(--line) solid var(--ink); border-radius: 14px; background: linear-gradient(var(--rcl), #fff 72%); box-shadow: inset 0 0 0 3px var(--rc), 0 3px 0 var(--ink); }
.chx-item .chx-rar { position: absolute; top: 7px; left: 7px; padding: 0 6px; border: 2px solid var(--ink); border-radius: 6px; background: var(--rc); color: #fff;
  font-size: 12px; font-weight: 700; text-shadow: 0 1px 0 rgba(59,35,64,.45); }
.chx-item .chx-qty { position: absolute; top: 3px; right: 9px; font-size: 22px; font-weight: 700; color: #fff; text-shadow: ${OUT2}; }
.chx-item .chx-ic { position: relative; width: 72px; height: 72px; margin-top: 14px; display: grid; place-items: center; }
.chx-item .chx-ic::before { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, #fff 0 42%, transparent 70%); }
.chx-item .chx-ic img { position: relative; }
.chx-item b { font-size: 17px; line-height: 1.05; }
.chx-item p { margin: 0; flex: 1; font-size: 13px; line-height: 1.15; color: var(--ink-l); }
.chx-item .btn { width: 100%; margin-top: 4px; }
.chx-ingame { width: 100%; margin-top: 4px; padding: 4px 6px; background: rgba(255,255,255,.8); border: 2px dashed var(--ink-ll); border-radius: 9px; font-size: 13px; line-height: 1.1; }
.chx-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
.chx-row .chx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.chx-row b { font-size: 18px; }
.chx-row small { font-size: 13px; color: var(--ink-l); line-height: 1.15; }
.chx-boost { background: linear-gradient(90deg, var(--gold-l), #fff 80%); }
.chx-boost .chx-left { font-size: 18px; font-weight: 700; color: var(--ink); white-space: nowrap; }
.chx-build { background: linear-gradient(90deg, var(--lilac-l), #fff 80%); }
.chx-build .chx-bthumb { width: 56px; height: 56px; flex: none; display: grid; place-items: center; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px; }
.chx-build .chx-bthumb img { width: 48px; height: 48px; image-rendering: pixelated; }
.chx-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 12px; text-align: center; color: var(--ink-l); }
.chx-empty img { animation: bob 1.6s steps(4) infinite; }
.chx-empty b { color: var(--ink); font-size: 19px; }

/* Tienda */
.chx-shophead + .chx-list { margin-top: 14px; }
.chx-shophead { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: linear-gradient(135deg, var(--sky-l), #fff); }
.chx-shophead p { margin: 0; flex: 1; font-size: 15px; line-height: 1.2; }
.chx-shop .chx-thumbbox { width: 96px; height: 96px; }
.chx-shop .chx-thumb { width: 90px; height: 90px; }
.chx-shop .btn.gold { min-width: 120px; }
.btn.chx-cant { filter: grayscale(.45) opacity(.8); }
.chx-best { position: absolute; top: -10px; right: 10px; padding: 1px 9px; border: 2px solid var(--ink); border-radius: 8px; background: var(--pink); color: #fff;
  font-size: 13px; font-weight: 700; transform: rotate(4deg); text-shadow: 0 1px 0 rgba(59,35,64,.4); }

/* "¿Qué puede salir?" */
.chx-whatlist { display: flex; flex-direction: column; gap: 8px; }
.chx-wrow { padding: 8px 10px; border: var(--line) solid var(--ink); border-radius: 12px; background: linear-gradient(var(--rcl), #fff); box-shadow: inset 0 0 0 2px var(--rc); }
.chx-wrow header { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 17px; }
.chx-wrow header em { font-style: normal; font-size: 20px; }
.chx-witems { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.chx-witems span { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px 2px 4px; background: #fff; border: 2px solid var(--ink); border-radius: 9px; font-size: 13px; }

/* Selector de obra (martillo) */
.chx-picklist { display: flex; flex-direction: column; gap: 8px; }
.chx-pick { display: flex; align-items: center; gap: 10px; padding: 8px 10px; }
.chx-pick .chx-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.chx-pick b { font-size: 17px; }
.chx-pick small { color: var(--ink-l); font-size: 13px; }

/* =================== Apertura =================== */
.chx-open { position: absolute; inset: 0; z-index: 75; overflow: hidden; background: #150b1e; touch-action: none; cursor: pointer; color: #fff; font-family: var(--font);
  --cx: 50%; --cy: 55%; --glow: 0; animation: chx-fadein .25s ease-out both; -webkit-user-select: none; user-select: none; }
.chx-open.closing { animation: chx-fadeout .32s ease-in forwards; pointer-events: none; }
.chx-shake { position: absolute; inset: 0; }
.chx-open.quake .chx-shake { animation: chx-quake .55s linear; }
.chx-bg { position: absolute; inset: 0; background: radial-gradient(circle at var(--cx) var(--cy), #8a55a8 0, #4a2a63 30%, #261536 64%, #150b1e 100%); }
.chx-stars { position: absolute; inset: 0; opacity: .55; animation: twinkle 2.4s steps(2) infinite;
  background-image: radial-gradient(#fff 0 1.5px, transparent 2px), radial-gradient(#ffd3ea 0 1.5px, transparent 2px), radial-gradient(#d4efff 0 1px, transparent 1.5px);
  background-size: 97px 113px, 151px 89px, 61px 71px; background-position: 13px 21px, 70px 44px, 30px 5px; }
.chx-rays { position: absolute; left: var(--cx); top: var(--cy); width: 240vmax; height: 240vmax; margin: -120vmax 0 0 -120vmax; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, var(--ray, rgba(255,255,255,.7)) 0deg 8deg, transparent 8deg 20deg);
  -webkit-mask: radial-gradient(circle closest-side, #000 0, rgba(0,0,0,.55) 10%, transparent 30%); mask: radial-gradient(circle closest-side, #000 0, rgba(0,0,0,.55) 10%, transparent 30%);
  opacity: calc(.12 + var(--glow) * .25); animation: chx-spin 26s linear infinite; transition: opacity .4s; }
.chx-open.lit .chx-rays { --ray: var(--rc); opacity: .75; animation-duration: 14s; }
.chx-halo { position: absolute; left: var(--cx); top: var(--cy); width: 80vmin; height: 80vmin; margin: -40vmin 0 0 -40vmin; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, var(--rc) 0, transparent 62%); opacity: calc(var(--glow) * .8); transition: opacity .25s; }
.chx-open.lit .chx-halo { opacity: .85; animation: chx-pulse 1.4s ease-in-out infinite alternate; }
.chx-stage { position: absolute; inset: 0; }
.chx-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at var(--cx) var(--cy), #fff 0, var(--rcl) 35%, rgba(255,255,255,0) 80%); }
.chx-flash.go { animation: chx-flash .8s ease-out; }

.chx-head { position: absolute; left: 0; right: 0; top: calc(var(--safe-t) + 70px); display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; pointer-events: none;
  transition: opacity .3s, transform .3s; animation: chx-drop .5s cubic-bezier(.3,1.5,.6,1) both .1s; }
.chx-head h2 { font-size: clamp(38px, 10vw, 56px); color: #fff; letter-spacing: 1px; text-shadow: ${OUT3}, 0 8px 0 var(--ccd); }
.chx-head .chx-sub { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border: 2px solid rgba(255,255,255,.55); border-radius: 99px; background: rgba(255,255,255,.12); font-size: 17px; }
.chx-open.cards .chx-head, .chx-open.summary .chx-head { opacity: 0; transform: translateY(-30px); }

.chx-hint { position: absolute; left: 0; right: 0; bottom: calc(var(--safe-b) + 7vh); display: flex; flex-direction: column; align-items: center; gap: 12px; pointer-events: none;
  transition: opacity .25s; opacity: 0; }
.chx-open.idle .chx-hint { opacity: 1; }
.chx-hint span { font-size: 30px; text-shadow: ${OUT3}; animation: chx-bob .9s ease-in-out infinite alternate; }
.chx-pips { display: flex; gap: 16px; }
.chx-pips i { width: 16px; height: 16px; border: 3px solid #fff; border-radius: 3px; transform: rotate(45deg); box-shadow: 0 0 0 2px var(--ink); transition: background .15s, transform .15s; }
.chx-pips i.on { background: var(--rc); transform: rotate(45deg) scale(1.25); box-shadow: 0 0 0 2px var(--ink), 0 0 14px 3px var(--rc); }

.chx-skip { position: absolute; z-index: 6; top: calc(var(--safe-t) + 12px); right: calc(var(--safe-r) + 12px); }
.chx-open.summary .chx-skip { display: none; }

.chx-got { position: absolute; left: calc(var(--safe-l) + 12px); right: calc(var(--safe-r) + 118px); top: calc(var(--safe-t) + 14px); display: flex; flex-wrap: wrap; gap: 6px; pointer-events: none; }
@media (min-width: 700px) { .chx-got { left: 130px; right: 130px; justify-content: center; } }
.chx-got span { width: 38px; height: 38px; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 10px; background: var(--rcl);
  box-shadow: inset 0 0 0 2px var(--rc), 0 3px 0 var(--ink); animation: chx-pop .35s cubic-bezier(.3,1.8,.6,1) both; }
.chx-open.summary .chx-got { opacity: 0; }

.chx-deck { position: absolute; left: calc(var(--safe-l) + 16px); bottom: calc(var(--safe-b) + 18px); display: flex; align-items: center; gap: 10px; pointer-events: none; opacity: 0; transition: opacity .3s; }
.chx-open.cards .chx-deck { opacity: 1; }
.chx-deck .chx-stack { position: relative; width: 38px; height: 50px; }
.chx-deck .chx-stack i { position: absolute; inset: 0; border: 3px solid var(--ink); border-radius: 7px; background: repeating-linear-gradient(45deg, var(--pink) 0 6px, var(--pink-d) 6px 12px); }
.chx-deck .chx-stack i:nth-child(1) { transform: translate(6px, -6px) rotate(6deg); }
.chx-deck .chx-stack i:nth-child(2) { transform: translate(3px, -3px) rotate(3deg); }
.chx-deck b { font-size: 26px; text-shadow: ${OUT2}; }
.chx-deck small { display: block; font-size: 15px; opacity: .85; }
.chx-tapnext { position: absolute; right: calc(var(--safe-r) + 16px); bottom: calc(var(--safe-b) + 22px); font-size: 20px; pointer-events: none; text-shadow: ${OUT2};
  opacity: 0; transition: opacity .3s; }
.chx-open.cards.revealed .chx-tapnext { opacity: 1; animation: chx-blink 1.1s steps(2) infinite; }

/* Cartas */
.chx-cardzone { position: absolute; left: 0; right: 0; top: 0; height: var(--zoneh, 76%); display: grid; place-items: center; pointer-events: none; perspective: 1000px; padding-top: calc(var(--safe-t) + 40px); }
.chx-card { grid-area: 1 / 1; position: relative; width: min(62vw, 300px, 38vh); aspect-ratio: 5 / 7; animation: chx-cardin .55s cubic-bezier(.2,1.25,.5,1) both; }
.chx-card.out { animation: chx-cardout .3s ease-in forwards; }
.chx-cardglow { position: absolute; inset: -32%; border-radius: 50%; background: radial-gradient(circle, var(--rc) 0, transparent 64%); opacity: .55; transition: opacity .3s; }
.chx-card.flip .chx-cardglow { opacity: .95; animation: chx-pulse .9s ease-in-out infinite alternate; }
.chx-card.r3 .chx-cardglow { inset: -55%; }
.chx-flipper { position: absolute; inset: 0; transform-style: preserve-3d; transform: rotateY(180deg); transition: transform .55s cubic-bezier(.3,1.35,.5,1); }
.chx-card.flip .chx-flipper { transform: rotateY(0deg); }
.chx-card.suspense:not(.flip) .chx-flipper { animation: chx-wiggle .13s linear infinite; }
.chx-face { position: absolute; inset: 0; -webkit-backface-visibility: hidden; backface-visibility: hidden; border: 4px solid var(--ink); border-radius: 16px; overflow: hidden; }
.chx-back { transform: rotateY(180deg); display: grid; place-items: center; box-shadow: 0 7px 0 var(--ink);
  background: conic-gradient(from 45deg at 50% 50%, var(--rc) 0 25%, var(--rcd) 0 50%, var(--rc) 0 75%, var(--rcd) 0) 0 0 / 28px 28px; }
.chx-back::before { content: ''; position: absolute; inset: 9px; border: 3px solid rgba(255,255,255,.85); border-radius: 10px; box-shadow: 0 0 0 3px var(--ink), inset 0 0 0 3px var(--ink); }
.chx-back img { position: relative; filter: drop-shadow(0 5px 0 rgba(59,35,64,.35)); }
.chx-back b { position: absolute; bottom: 22px; left: 0; right: 0; text-align: center; font-size: 46px; color: #fff; text-shadow: ${OUT3}; }
.chx-front { display: flex; flex-direction: column; align-items: center; color: var(--ink); background: linear-gradient(var(--rcl), #fff 58%);
  box-shadow: inset 0 0 0 4px var(--rc), 0 7px 0 var(--ink); }
.chx-banner { width: 100%; padding: 7px 0 5px; background: var(--rc); border-bottom: 4px solid var(--ink); text-align: center; font-size: 21px; letter-spacing: .14em;
  text-transform: uppercase; color: #fff; text-shadow: ${OUT2}; }
.chx-icwrap { position: relative; flex: 1; width: 100%; display: grid; place-items: center; }
.chx-icwrap::before { content: ''; position: absolute; left: 50%; top: 50%; width: 170px; height: 170px; margin: -85px 0 0 -85px;
  background: repeating-conic-gradient(var(--rc) 0 9deg, transparent 9deg 24deg); -webkit-mask: radial-gradient(circle closest-side, #000 30%, transparent 100%);
  mask: radial-gradient(circle closest-side, #000 30%, transparent 100%); opacity: .6; animation: chx-spin 9s linear infinite; }
.chx-icwrap img { position: relative; width: min(96px, 26vw); height: auto; filter: drop-shadow(0 5px 0 rgba(59,35,64,.25)); animation: chx-bob 1s ease-in-out infinite alternate; }
.chx-klabel { font-size: 14px; color: var(--rcd); text-transform: uppercase; letter-spacing: .06em; min-height: 16px; }
.chx-cname { padding: 0 10px; font-size: 24px; font-weight: 700; line-height: 1.05; text-align: center; }
.chx-amt { display: flex; align-items: center; gap: 6px; margin: 4px 0 2px; font-size: 36px; line-height: 1; font-weight: 700; color: #fff; text-shadow: ${OUT3}; }
.chx-amt img { filter: drop-shadow(0 3px 0 rgba(59,35,64,.3)); }
.chx-note { margin: 2px 10px 12px; font-size: 14px; line-height: 1.1; text-align: center; color: var(--ink-l); }
.chx-card.r3 .chx-front { box-shadow: inset 0 0 0 4px var(--rc), 0 7px 0 var(--ink), 0 0 36px 8px rgba(255,209,102,.75); }
.chx-sparkle { position: absolute; width: 6px; height: 6px; background: #fff; box-shadow: 6px 0 #fff, -6px 0 #fff, 0 6px #fff, 0 -6px #fff; animation: chx-twinkle .8s steps(2) infinite; }

/* Resumen */
.chx-sum { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; padding: calc(var(--safe-t) + 16px) 14px calc(var(--safe-b) + 16px); cursor: default;
  background: rgba(21,11,30,.35); }
.chx-sumbox { width: min(540px, 100%); max-height: 100%; display: flex; flex-direction: column; color: var(--ink); background: var(--panel); border: var(--line) solid var(--ink);
  border-radius: 18px; box-shadow: 0 6px 0 var(--ink), 0 20px 60px rgba(0,0,0,.45); overflow: hidden; animation: chx-pop .4s cubic-bezier(.3,1.6,.6,1) both; }
.chx-sumhead { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 16px 10px; background: linear-gradient(var(--gold), var(--gold-d)); border-bottom: var(--line) solid var(--ink); }
.chx-sumhead h2 { font-size: 30px; color: #fff; text-shadow: ${OUT2}, 0 4px 0 var(--ink); }
.chx-sumgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(98px, 1fr)); gap: 10px; padding: 16px 14px 8px; overflow-y: auto; touch-action: pan-y; }
.chx-mini { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px 7px; text-align: center; border: var(--line) solid var(--ink); border-radius: 12px;
  background: linear-gradient(var(--rcl), #fff 78%); box-shadow: inset 0 0 0 2px var(--rc), 0 3px 0 var(--ink); animation: chx-pop .4s cubic-bezier(.3,1.7,.6,1) both; }
.chx-mini small { font-size: 11px; font-weight: 700; color: var(--rcd); text-transform: uppercase; letter-spacing: .08em; }
.chx-mini b { font-size: 14px; line-height: 1; min-height: 28px; display: grid; place-items: center; }
.chx-mini em { display: flex; align-items: center; gap: 3px; font-style: normal; font-size: 18px; font-weight: 700; }
.chx-sumfoot { padding: 6px 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.chx-sumfoot p { margin: 0; text-align: center; font-size: 14px; color: var(--ink-l); }
.chx-confetti { position: absolute; inset: 0; z-index: 5; width: 100%; height: 100%; image-rendering: pixelated; pointer-events: none; }

@keyframes chx-spin { to { transform: rotate(360deg); } }
@keyframes chx-fadein { from { opacity: 0; } }
@keyframes chx-fadeout { to { opacity: 0; } }
@keyframes chx-quake { 0%,100% { transform: none; } 10% { transform: translate(-9px, 5px); } 20% { transform: translate(8px, -7px); } 30% { transform: translate(-7px, -4px); }
  40% { transform: translate(6px, 6px); } 50% { transform: translate(-5px, 3px); } 60% { transform: translate(4px, -4px); } 75% { transform: translate(-2px, 2px); } }
@keyframes chx-flash { 0% { opacity: 0; } 12% { opacity: 1; } 100% { opacity: 0; } }
@keyframes chx-bob { from { transform: translateY(0); } to { transform: translateY(-7px); } }
@keyframes chx-blink { 50% { opacity: .35; } }
@keyframes chx-pop { from { transform: scale(.3); opacity: 0; } }
@keyframes chx-drop { from { transform: translateY(-40px); opacity: 0; } }
@keyframes chx-pulse { from { transform: scale(.92); } to { transform: scale(1.06); } }
@keyframes chx-twinkle { 50% { opacity: 0; transform: scale(.5); } }
@keyframes chx-cardin { from { transform: translateY(var(--from, 40vh)) scale(.12) rotate(-14deg); opacity: 0; } 35% { opacity: 1; } }
@keyframes chx-cardout { to { transform: translate(var(--tox, 0), var(--toy, -40vh)) scale(.15) rotate(10deg); opacity: 0; } }
@keyframes chx-wiggle { 0%,100% { transform: rotateY(180deg) rotate(-3deg) scale(1.02); } 50% { transform: rotateY(180deg) rotate(3deg) scale(1.05); } }
@media (prefers-reduced-motion: reduce) {
  .chx-rays, .chx-icwrap::before { animation: none; }
  .chx-open.quake .chx-shake { animation: none; }
}
`;
