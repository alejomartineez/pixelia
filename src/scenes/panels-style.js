// Estilos de los paneles (se inyectan como <style id="panels-style"> mientras haya un panel abierto).
export const PANEL_CSS = `
/* ---------- Base de paneles ---------- */
.modal.pnl .modal-body {
  background-color: var(--panel);
  background-image: radial-gradient(#f9f2e8 1.6px, transparent 2px);
  background-size: 20px 20px;
}
.modal.pnl .modal-head h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* dedos: la X y los botones chicos de cobrar llegan a ~44px de alto */
.modal.pnl .modal-x { width: 42px; height: 42px; }
.modal.pnl .btn.small { min-height: 42px; }
.modal.pnl-md { width: min(520px, 100%); }
.pnl-gap { gap: 12px; }
.pnl-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.pnl-hint { display: flex; align-items: center; gap: 6px; justify-content: center; margin: 0; font-size: 14px; color: var(--ink-l); text-align: center; }
.pnl-enter { animation: pnlEnter .28s cubic-bezier(.3,1.4,.6,1) both; }
@keyframes pnlEnter { from { opacity: 0; transform: translateY(10px); } }
.pnl-bob { display: inline-block; animation: pnlBob 1.4s steps(4) infinite; }
@keyframes pnlBob { 50% { transform: translateY(-6px); } }
.pnl-glow { animation: pnlGlow 1.1s steps(2) infinite; }
@keyframes pnlGlow { 50% { box-shadow: inset 0 -5px 0 var(--bg-d), 0 4px 0 var(--ink), 0 0 0 4px rgba(255,209,102,.65); } }
.pnl-shake { animation: pnlShake 1.2s infinite; display: inline-block; }
@keyframes pnlShake { 0%, 70%, 100% { transform: none; } 75% { transform: rotate(-9deg); } 80% { transform: rotate(9deg); } 85% { transform: rotate(-6deg); } 90% { transform: rotate(5deg); } }
.pnl-shake-hard { animation: pnlShakeHard .65s steps(10); }
@keyframes pnlShakeHard { 0% { transform: scale(1); } 20% { transform: rotate(-12deg) scale(1.08); } 40% { transform: rotate(12deg) scale(1.14); } 60% { transform: rotate(-14deg) scale(1.2); } 80% { transform: rotate(14deg) scale(1.3); } 100% { transform: scale(1.5); opacity: .2; } }
.pnl-pop { animation: pnlPop .45s cubic-bezier(.3,1.8,.6,1) both; }
@keyframes pnlPop { from { transform: scale(.2); opacity: 0; } }

/* barra de progreso con etiqueta */
.pnl-prog { display: flex; align-items: center; gap: 8px; width: 100%; }
.pnl-prog .progress { flex: 1; height: 16px; }
.pnl-prog b { font-size: 15px; min-width: 44px; text-align: right; white-space: nowrap; }
.pnl-prog.sm .progress { height: 12px; }
.pnl-prog.sm b { font-size: 13px; min-width: 38px; }

/* ---------- Sheet con pestañas fijas ---------- */
.modal.pnl-flex .modal-body { display: flex; flex-direction: column; padding: 0; overflow: hidden; flex: 1 1 auto; min-height: 0; }
.pnl-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 14px 14px 12px; background: var(--panel-2); border-bottom: 3px solid var(--ink); flex: none; }
.pnl-tabs .tab { position: relative; justify-content: center; padding: 7px 4px; font-size: 16px; min-height: 42px; }
.pnl-tabs .tab .badge { top: -10px; right: -6px; }
.pnl-tabs .tab.active .pi { filter: drop-shadow(0 2px 0 rgba(61,47,42,.35)); }
.pnl-pane { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; overscroll-behavior: contain; padding: 14px 14px 20px; }

/* ---------- Misión principal ---------- */
.pnl-mq { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 30px 16px 16px; margin-top: 10px;
  background: linear-gradient(#fff 55%, #fcf9f4); overflow: visible; }
.pnl-mq.ready { background: linear-gradient(#fffbea 50%, var(--gold-l)); }
.pnl-mq-ribbon { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); }
.pnl-mq-ribbon span { display: inline-block; padding: 4px 14px; background: var(--second); color: #fff; font-weight: 700; font-size: 14px; border: var(--line) solid var(--ink); border-radius: 10px;
  box-shadow: 0 3px 0 var(--ink); text-shadow: 0 2px 0 rgba(61,47,42,.35); white-space: nowrap; }
.pnl-mq-icon { width: 88px; height: 88px; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff, var(--sky-l) 70%); box-shadow: 0 4px 0 var(--ink); }
.pnl-mq.ready .pnl-mq-icon { background: radial-gradient(circle at 35% 30%, #fff, var(--gold) 75%); }
.pnl-mq-title { font-size: 24px; color: var(--ink); }
.pnl-mq-text { margin: 0; font-size: 16px; color: var(--ink-l); max-width: 340px; }
.pnl-mq .pnl-prog { max-width: 360px; margin-top: 4px; }
.pnl-reward { display: inline-flex; align-items: center; gap: 10px; padding: 6px 14px; background: #fff; border: 2px dashed var(--ink-ll); border-radius: 12px; font-size: 18px; flex-wrap: wrap; justify-content: center; }
.pnl-reward-lbl { font-size: 13px; text-transform: uppercase; letter-spacing: .6px; color: var(--ink-l); font-weight: 700; }
.pnl-mq-foot { width: 100%; max-width: 360px; margin-top: 4px; }
.pnl-mq.claimed > :not(.pnl-stamp) { opacity: .45; transition: opacity .3s; }
.pnl-stamp { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-10deg); font-size: 34px; font-weight: 700; color: #fff;
  padding: 6px 18px; background: var(--mint); border: 4px solid var(--ink); border-radius: 14px; box-shadow: 0 5px 0 var(--ink);
  text-shadow: 0 3px 0 var(--mint-d); animation: pnlStamp .4s cubic-bezier(.3,1.8,.6,1) both; white-space: nowrap; }
@keyframes pnlStamp { from { transform: translate(-50%, -50%) rotate(-10deg) scale(2.4); opacity: 0; } }
.pnl-allDone { padding-top: 18px; }

.pnl-main { display: flex; flex-direction: column; gap: 14px; }
@media (min-width: 700px) {
  .pnl-main { display: grid; grid-template-columns: minmax(0, 1fr) 280px; align-items: start; gap: 18px; }
  .pnl-main .pnl-path { padding-top: 10px; }
  .pnl-main .pnl-path-head { flex-direction: column; align-items: flex-start; }
}
/* camino de próximas misiones */
.pnl-path { display: flex; flex-direction: column; gap: 0; padding: 4px 2px 0; }
.pnl-path-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; font-size: 17px; }
.pnl-path-head > span:first-child { display: inline-flex; align-items: center; gap: 6px; }
.pnl-path-bar { margin: 8px 0 6px; }
.pnl-step { display: flex; align-items: center; gap: 10px; position: relative; padding: 10px 0 10px 4px; }
.pnl-step::before { content: ''; position: absolute; left: 21px; top: -6px; height: 18px; border-left: 4px dotted var(--ink-ll); }
.pnl-step-dot { flex: none; width: 38px; height: 38px; display: grid; place-items: center; background: #f3eee6; border: var(--line) solid var(--ink); border-radius: 50%; position: relative; z-index: 1; }
.pnl-step-body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,.85); border: 2px solid var(--ink-ll); border-radius: 12px; }
.pnl-step-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pnl-step-body small { font-size: 12px; color: var(--ink-l); font-weight: 700; }
.pnl-step-body b { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pnl-blur { filter: blur(4px); user-select: none; }
.pnl-step-rew { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 14px; }
.pnl-step.last .pnl-step-dot { background: var(--gold-l); }

/* ---------- Filas de misiones / logros ---------- */
.pnl-timer { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; background: var(--sky-l); border: 2px solid var(--ink); border-radius: 12px; font-size: 16px; }
.pnl-timer.second { background: var(--second-l); }
.pnl-timer b { font-size: 18px; }
.pnl-q { display: flex; align-items: center; gap: 10px; padding: 10px; }
.pnl-q.ready { background: var(--gold-l); }
.pnl-q.claimed { background: var(--mint-l); }
.pnl-q.claimed .pnl-q-main { opacity: .7; }
.pnl-q.maxed { background: linear-gradient(90deg, var(--gold-l), #fff); }
.pnl-q-ic { flex: none; width: 52px; height: 52px; display: grid; place-items: center; background: var(--panel-2); border: 2px solid var(--ink); border-radius: 12px; }
.pnl-q.ready .pnl-q-ic { background: #fff; }
.pnl-q-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.pnl-q-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pnl-q-title { font-size: 16px; line-height: 1.15; }
.pnl-q-desc { font-size: 13px; color: var(--ink-l); line-height: 1.15; }
.pnl-q-rew { display: flex; gap: 8px; font-size: 14px; flex-wrap: wrap; }
.pnl-q-side { flex: none; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.pnl-q-side .btn.small { min-width: 78px; }
.pnl-done { display: grid; place-items: center; width: 44px; height: 44px; }
.pnl-stars { display: inline-flex; gap: 1px; }
.pnl-gemrew { font-size: 15px; }
.pnl-chest { display: flex; align-items: center; gap: 12px; padding: 12px; background: linear-gradient(135deg, #fff, var(--second-l)); margin-top: 4px; }
.pnl-chest.ready { background: linear-gradient(135deg, var(--gold-l), var(--primary-l)); }
.pnl-chest.claimed { background: var(--mint-l); }
.pnl-chest-ic { flex: none; width: 64px; height: 64px; display: grid; place-items: center; }
.pnl-pips { display: flex; gap: 6px; margin: 2px 0; }
.pnl-pips i { width: 22px; height: 12px; border: 2px solid var(--ink); border-radius: 4px; background: #fff; }
.pnl-pips i.on { background: var(--mint); }

/* ---------- Minijuegos ---------- */
.pnl-games-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.pnl-games-head p { margin: 0; font-size: 15px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; flex: 1; min-width: 200px; }
.pnl-games-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.pnl-game { display: grid; grid-template-columns: 104px minmax(0, 1fr); grid-template-rows: 1fr auto; padding: 0; overflow: hidden; min-height: 168px; }
.pnl-game-art { grid-row: 1 / 3; position: relative; display: grid; place-items: center; border-right: var(--line) solid var(--ink);
  background-color: var(--gc); background-image: radial-gradient(rgba(255,255,255,.45) 2px, transparent 2.5px), linear-gradient(rgba(255,255,255,.25), rgba(61,47,42,.08));
  background-size: 14px 14px, 100% 100%; }
.pnl-game-art .pi { width: 68px; height: 68px; filter: drop-shadow(0 4px 0 rgba(61,47,42,.3)); }
.pnl-game.locked .pnl-game-art { filter: grayscale(.85) brightness(1.05); }
.pnl-game.locked .pnl-game-art > span:first-child { opacity: .45; }
.pnl-game-lock { position: absolute; inset: 0; display: grid; place-items: center; }
.pnl-game-lock .pi { width: 40px; height: 40px; }
.pnl-game-body { display: flex; flex-direction: column; gap: 5px; padding: 10px 12px 2px; text-align: left; min-width: 0; }
.pnl-game-body .pnl-chips { justify-content: flex-start; }
.pnl-game-name { font-size: 19px; line-height: 1.1; }
.pnl-game-desc { margin: 0; font-size: 14px; color: var(--ink-l); line-height: 1.2; }
.pnl-game-foot { padding: 6px 12px 12px; }
.pnl-game-foot .btn { font-size: 17px; padding: 6px 10px; white-space: normal; line-height: 1.05; min-height: 48px; }
.pnl-btn2 { display: flex; flex-direction: column; align-items: flex-start; text-align: left; min-width: 0; }
.pnl-btn2 small { font-size: 12px; font-weight: 400; opacity: .85; line-height: 1.1; }
.pnl-lockmsg { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 48px; padding: 4px 8px; text-align: center; font-size: 15px;
  border: 2px dashed var(--ink-ll); border-radius: 10px; color: var(--ink-l); background: rgba(255,255,255,.6); }
.pnl-lockmsg.building { color: var(--ink); background: var(--gold-l); border-color: var(--gold-d); }
.pnl-game.locked { background: #f8f4ef; }
@media (min-width: 700px) {
  .pnl-games-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .pnl-game { grid-template-columns: 128px minmax(0, 1fr); min-height: 190px; }
  .pnl-game-art .pi { width: 84px; height: 84px; }
  .pnl-game-name { font-size: 20px; }
}

/* ---------- Ajustes ---------- */
.pnl-sec { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.pnl-sec-title { display: flex; align-items: center; gap: 8px; font-size: 18px; padding-bottom: 8px; border-bottom: 2px dashed #f0e4d2; }
.pnl-toggles { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
@media (min-width: 480px) { .pnl-toggles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.pnl-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px;
  box-shadow: 0 3px 0 var(--ink); font-size: 16px; min-height: 52px; }
.pnl-toggle:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
.pnl-toggle-lbl { display: flex; align-items: center; gap: 6px; min-width: 0; }
.pnl-switch { flex: none; width: 46px; height: 26px; border: var(--line) solid var(--ink); border-radius: 8px; background: #eee7dc; position: relative; transition: background .15s; }
.pnl-switch i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #fff; border: 2px solid var(--ink); border-radius: 4px; transition: transform .15s steps(3); }
.pnl-toggle.on { background: var(--mint-l); }
.pnl-toggle.on .pnl-switch { background: var(--mint); }
.pnl-toggle.on .pnl-switch i { transform: translateX(20px); }
.pnl-field { display: flex; flex-direction: column; gap: 4px; }
.pnl-field-lbl { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: var(--ink-l); }
.pnl-flag-row { display: flex; align-items: center; gap: 12px; }
.pnl-flag-prev { flex: none; width: 72px; height: 72px; display: grid; place-items: center; background: var(--sky-l); border: 2px solid var(--ink); border-radius: 12px; transform-origin: 20% 90%; }
.pnl-flag-prev.pnl-wave { animation: pnlWave .5s steps(5); }
@keyframes pnlWave { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
.pnl-swatches { flex: 1; gap: 7px; }
.pnl-swatches .swatch { width: 34px; height: 34px; }
.pnl-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.pnl-stepc { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 4px 8px; background: var(--sky-l); border: 2px solid var(--ink); border-radius: 12px; text-align: center; font-size: 13px; line-height: 1.15; }
.pnl-stepc i { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); width: 22px; height: 22px; display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 13px;
  background: var(--primary); color: #fff; border: 2px solid var(--ink); border-radius: 50%; }
.pnl-appicon { border-radius: 9px; border: 2px solid var(--ink); }
.pnl-note { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 8px 10px; font-size: 14px; background: var(--gold-l); border: 2px solid var(--ink); border-radius: 10px; line-height: 1.25; }
.pnl-note.good { background: var(--mint-l); align-items: center; }
.pnl-code { width: 100%; resize: none; padding: 8px 10px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 16px; line-height: 1.25; color: var(--ink);
  background: #fff; border: var(--line) solid var(--ink); border-radius: 10px; outline: none; touch-action: pan-y; word-break: break-all; }
.pnl-code::placeholder { font-family: var(--font); color: var(--ink-ll); }
.pnl-code:focus { border-color: var(--primary-d); }
.pnl-code[readonly] { background: #fdfbf7; }
.pnl-sep { height: 0; border-top: 2px dashed #f0e4d2; margin: 2px 0; }
.pnl-helpbtn { margin-top: 2px; }
.pnl-credits { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 16px 12px; background: linear-gradient(#fff, var(--primary-l)); }
.pnl-credits-title { font-size: 19px; }
.pnl-credits p { margin: 2px 0; }
.pnl-danger { --bg: var(--coral); --bg-d: #d94a57; }
.pnl-install-sub { display: flex; align-items: center; gap: 6px; font-size: 15px; margin: 2px 0 4px; }
.modal.pnl-confirm { width: min(400px, 100%); }
.pnl-confirm-txt { margin: 4px 0 2px; text-align: center; font-size: 18px; line-height: 1.25; }
.pnl-dangerzone { padding: 8px 0 6px; }

/* ---------- Ayuda ---------- */
.pnl-help-list { display: grid; grid-template-columns: 1fr; gap: 8px; }
.pnl-help-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; }
.pnl-help-item > span:last-child { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pnl-help-item > span > b { font-size: 16px; }
.pnl-help-item small b { font-size: inherit; }
.pnl-help-item small { font-size: 13px; color: var(--ink-l); line-height: 1.2; }
.pnl-help-ic { flex: none; width: 48px; height: 48px; display: grid; place-items: center; background: var(--panel-2); border: 2px solid var(--ink); border-radius: 12px; }
.pnl-help-item:nth-child(4n+2) .pnl-help-ic { background: var(--sky-l); }
.pnl-help-item:nth-child(4n+3) .pnl-help-ic { background: var(--mint-l); }
.pnl-help-item:nth-child(4n) .pnl-help-ic { background: var(--gold-l); }
.pnl-help-pc { margin-top: 12px; padding: 10px 12px; background: var(--second-l); border: 2px solid var(--ink); border-radius: 12px; font-size: 14px; }
.pnl-help-pc > b { display: flex; align-items: center; gap: 6px; font-size: 16px; }
.pnl-help-pc ul { margin: 6px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
.pnl-help-pc kbd { font-family: inherit; font-size: 12px; font-weight: 700; padding: 1px 5px; background: #fff; border: 2px solid var(--ink); border-radius: 5px; box-shadow: 0 2px 0 var(--ink); margin: 0 1px; }
@media (min-width: 700px) {
  .modal.pnl-help { width: min(720px, 100%); }
  .pnl-help-list { grid-template-columns: 1fr 1fr; }
}

/* ---------- Rayos de luz (login / nivel) ---------- */
.pnl-rays { position: absolute; left: 50%; top: 50%; width: 230px; height: 230px; margin: -115px 0 0 -115px; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(rgba(255,209,102,.55) 0 12deg, transparent 12deg 30deg);
  -webkit-mask: radial-gradient(circle, #000 30%, transparent 70%); mask: radial-gradient(circle, #000 30%, transparent 70%); }
.pnl-rays.spin { animation: pnlSpin 9s linear infinite; }
@keyframes pnlSpin { to { transform: rotate(360deg); } }

/* ---------- Premio diario ---------- */
.pnl-login .modal-foot .btn { font-size: 20px; min-height: 54px; }
.pnl-login-wrap { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.pnl-streak { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0; font-size: 17px; text-align: center; }
.pnl-stage { position: relative; width: 100%; height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; overflow: hidden;
  border: var(--line) solid var(--ink); border-radius: 14px; background: radial-gradient(circle at 50% 45%, #fff 0, var(--primary-l) 70%); }
.pnl-stage.open { background: radial-gradient(circle at 50% 45%, #fff 0, var(--gold-l) 60%, var(--gold) 100%); }
.pnl-stage-ic, .pnl-stage-reward { position: relative; }
.pnl-stage-reward { display: flex; gap: 14px; font-size: 32px; padding: 6px 16px; background: #fff; border: var(--line) solid var(--ink); border-radius: 14px; box-shadow: 0 4px 0 var(--ink); }
.pnl-stage-txt { position: relative; margin: 0; display: flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 700; padding: 2px 10px; background: rgba(255,255,255,.85); border-radius: 10px; }
.pnl-days { width: 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.pnl-day { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 2px; padding: 6px 2px 6px; min-height: 92px;
  background: #fff; border: var(--line) solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 var(--ink); text-align: center; }
.pnl-day small { font-size: 13px; font-weight: 700; color: var(--ink-l); }
.pnl-day-ic { flex: 1; display: grid; place-items: center; }
.pnl-day-rw { font-size: 12px; display: flex; flex-wrap: wrap; gap: 2px 6px; justify-content: center; }
.pnl-day-rw .cost img { width: 12px; height: 12px; }
.pnl-day.big { grid-column: span 2; background: linear-gradient(135deg, var(--second-l), var(--primary-l)); }
.pnl-day-check { position: absolute; inset: 0; display: none; place-items: center; background: rgba(196,247,232,.55); border-radius: 9px; }
.pnl-day.past { background: var(--mint-l); }
.pnl-day.past .pnl-day-ic, .pnl-day.past .pnl-day-rw { opacity: .55; }
.pnl-day.past .pnl-day-check { display: grid; }
.pnl-day.today { background: var(--gold-l); outline: 4px solid var(--gold); outline-offset: 1px; transform: translateY(-3px); }
.pnl-day.today:not(.past) { animation: pnlToday 1s steps(2) infinite; }
.pnl-day.today small { color: var(--ink); }
@keyframes pnlToday { 50% { outline-color: #fff; } }
.pnl-day.future { opacity: .9; }

/* ---------- Subida de nivel ---------- */
.pnl-levelup .modal-foot .btn { font-size: 20px; min-height: 54px; }
.pnl-lv { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.pnl-lv-burst { position: relative; width: 100%; height: 150px; display: grid; place-items: center; }
.pnl-lv-star { position: relative; display: grid; place-items: center; animation: pnlStarIn .7s cubic-bezier(.3,1.7,.6,1) both; }
.pnl-lv-star .pi { filter: drop-shadow(0 6px 0 rgba(61,47,42,.25)); animation: pnlBob 1.6s steps(4) .7s infinite; }
.pnl-lv-star b { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -38%); font-size: 40px; color: #fff; pointer-events: none;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink); }
@keyframes pnlStarIn { from { transform: scale(0) rotate(-180deg); opacity: 0; } }
.pnl-lv-title { font-size: 40px; color: #fff; letter-spacing: 1px; margin-top: 2px;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 7px 0 var(--primary-d);
  animation: pnlPop .5s .25s cubic-bezier(.3,1.8,.6,1) both; }
.pnl-lv-sub { margin: 4px 0 0; font-size: 17px; font-weight: 700; color: var(--ink-l); }
.pnl-lv-reward { display: flex; align-items: center; gap: 12px; font-size: 24px; margin: 6px 0 2px; padding: 6px 16px; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 var(--ink); animation: pnlPop .45s .4s both; }
.pnl-lv-reward small { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: var(--ink-l); font-weight: 700; }
.pnl-lv-h { display: flex; align-items: center; gap: 6px; margin: 10px 0 2px; font-size: 18px; }
.pnl-unlocks { width: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.pnl-unlock { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; box-shadow: 0 2px 0 var(--ink); text-align: left;
  animation: pnlEnter .35s both; }
.pnl-unlock.hot { background: var(--gold-l); }
.pnl-unlock-ic { flex: none; width: 52px; height: 52px; display: grid; place-items: center; background: var(--sky-l); border: 2px solid var(--ink); border-radius: 10px; overflow: hidden; }
.pnl-unlock.hot .pnl-unlock-ic { background: #fff; }
.pnl-unlock-txt { display: flex; flex-direction: column; min-width: 0; }
.pnl-unlock-txt small { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--ink-l); font-weight: 700; }
.pnl-unlock-txt b { font-size: 15px; line-height: 1.1; }
.pnl-thumb { width: 48px; height: 48px; }
.pnl-lv-empty { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 10px 12px; text-align: left; font-size: 15px; background: var(--mint-l); border: 2px solid var(--ink); border-radius: 12px; }
.pnl-lv-next { display: flex; align-items: center; gap: 6px; justify-content: center; flex-wrap: wrap; margin: 10px 0 0; font-size: 14px; color: var(--ink-l); }

/* ---------- Rango de la ciudad ("Tu ciudad") ---------- */
.modal.pnl-rank.sheet { width: min(560px, 100%); }
.pnl-rk { display: flex; flex-direction: column; gap: 10px; }
.pnl-rk-head { display: flex; align-items: center; gap: 12px; padding: 12px; background: linear-gradient(135deg, #fff 40%, var(--sky-l)); }
.pnl-rk-emblem { position: relative; flex: none; display: grid; place-items: center; }
.pnl-rk-badge { position: relative; display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; border: var(--line) solid var(--ink);
  background: radial-gradient(circle at 35% 30%, #fff, var(--gold-l) 70%); box-shadow: 0 4px 0 var(--ink); }
.pnl-rk-emblem em { position: absolute; right: -4px; bottom: -4px; min-width: 26px; height: 26px; padding: 0 5px; display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 15px;
  color: #fff; background: var(--second); border: 2px solid var(--ink); border-radius: 13px; box-shadow: 0 2px 0 var(--ink); }
.pnl-rk-emblem.big .pnl-rk-badge { width: 124px; height: 124px; animation: pnlStarIn .7s cubic-bezier(.3,1.7,.6,1) both; }
.pnl-rk-emblem.big em { min-width: 36px; height: 36px; font-size: 20px; border-radius: 18px; right: 0; bottom: 0; }
.pnl-rk-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pnl-rk-meta small { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--ink-l); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pnl-rk-name { font-size: 26px; line-height: 1.05; }
.pnl-rk-charm { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 15px; }
.pnl-rk-stars { display: inline-flex; }
.pnl-rk-bonus { display: flex; align-items: center; flex-wrap: wrap; gap: 3px; font-size: 13px; color: var(--ink-l); }
.pnl-rk-tip { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 13px; color: var(--ink-l); line-height: 1.25; }
.pnl-rk-tip .pi { flex: none; margin-top: 1px; }
.pnl-rk-file { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.pnl-rk-h { display: flex; align-items: center; gap: 6px; margin: 0 0 2px; font-size: 17px; }
.pnl-rk-h b { display: inline-flex; align-items: center; gap: 3px; }
.pnl-rk-req { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; }
.pnl-rk-req.ok { background: var(--mint-l); }
.pnl-rk-req-ic { flex: none; display: grid; place-items: center; }
.pnl-rk-req-body { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pnl-rk-req-top { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; }
.pnl-rk-req-top span { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pnl-rk-req .progress { height: 11px; }
.pnl-rk-req-check { flex: none; display: grid; place-items: center; width: 30px; }
.pnl-rk-req:not(.ok) .pnl-rk-req-check { opacity: .45; }
.pnl-rk-reward { align-self: center; font-size: 16px; }
.pnl-rk-up { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.pnl-rk-up .btn { font-size: 18px; min-height: 50px; }
.pnl-rk-cost { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 18px; }
.pnl-rk-cost .muted { font-size: 14px; display: inline-flex; align-items: center; gap: 3px; }
.pnl-rk-msg { color: var(--coral); font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 4px; }
.pnl-rk-busy { display: flex; align-items: center; gap: 8px; font-size: 16px; }
.pnl-rk-busy [data-rk-left] { font-variant-numeric: tabular-nums; }
.pnl-rk-party .pnl-lv-burst { height: 170px; }
.pnl-rk-party .pnl-rays { width: 260px; height: 260px; margin: -130px 0 0 -130px; }
.pnl-rk-foot { display: flex; gap: 8px; width: 100%; margin-top: 12px; }
.pnl-rk-foot .btn { flex: 1; font-size: 18px; min-height: 52px; }
@media (max-width: 420px) {
  .pnl-rk-badge { width: 60px; height: 60px; }
  .pnl-rk-badge .pi { width: 42px; height: 42px; }
  .pnl-rk-name { font-size: 22px; }
}

/* ---------- Premios con cofres / figuritas / objetos ---------- */
.pnl-rw { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.pnl-rw > span { font-size: inherit; }
.pnl-q-rew .pnl-rw > span:not(:first-child), .pnl-reward .pnl-rw > span { font-weight: 700; }
.pnl-newchip { font-size: 11px; padding: 0 6px; }
.pnl-gemrew { display: flex; flex-direction: column; align-items: center; gap: 2px; }

/* ---------- Escudo de racha (premio diario) ---------- */
.pnl-shield { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 12px; text-align: left;
  background: linear-gradient(135deg, var(--sky-l), var(--mint-l)); border: var(--line) solid var(--ink); border-radius: 14px; box-shadow: 0 3px 0 var(--ink); }
.pnl-shield-ic { flex: none; display: grid; place-items: center; width: 52px; height: 52px; background: #fff; border: 2px solid var(--ink); border-radius: 50%; }
.pnl-shield > span:last-child { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pnl-shield b { font-size: 18px; color: var(--ink); }
.pnl-shield small { font-size: 13px; color: var(--ink-l); line-height: 1.2; }
.pnl-day.chest.big { background: linear-gradient(135deg, #eef3fb, var(--sky-l)); }
.pnl-day.big .pnl-day-rw { font-size: 13px; }
.pnl-stage-reward { align-items: center; }
.pnl-stage-chest { display: grid; place-items: center; }

/* ---------- Cofres al subir de nivel ---------- */
.pnl-lv-chests { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; width: 100%; }
.pnl-lv-chest { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 104px; padding: 8px 10px 6px; background: linear-gradient(#fff, var(--gold-l));
  border: 2px solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 var(--ink); animation: pnlPop .45s cubic-bezier(.3,1.8,.6,1) both; }
.pnl-lv-chest b { font-size: 14px; line-height: 1.1; }
.pnl-lv-chest-ic { display: grid; place-items: center; width: 56px; height: 56px; }
.pnl-levelup .modal-foot .btn.ghost { flex: 0 0 auto; min-width: 110px; }

/* ---------- Minijuegos: eventos y mochila ---------- */
.pnl-evstrip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.pnl-evcard { flex: 1 1 220px; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 6px 10px; text-align: left; cursor: pointer; font: inherit; color: var(--ink);
  background: linear-gradient(135deg, #fff, var(--ec, var(--gold))); border: var(--line) solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 var(--ink); }
.pnl-evcard:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
.pnl-evcard-ic { flex: none; display: grid; place-items: center; width: 40px; height: 40px; background: #fff; border: 2px solid var(--ink); border-radius: 10px; }
.pnl-evcard-txt { display: flex; flex-direction: column; min-width: 0; }
.pnl-evcard-txt b { font-size: 16px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pnl-evcard-txt small { display: flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 700; color: var(--ink-l); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pnl-evchip { background: color-mix(in srgb, var(--ec, var(--gold)) 45%, #fff); }
.pnl-bag { padding: 0; margin-bottom: 12px; overflow: hidden; }
.pnl-bag-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 12px; text-align: left; font: inherit; color: var(--ink); background: linear-gradient(135deg, #fff, var(--second-l)); border: 0; cursor: pointer; min-height: 56px; }
.pnl-bag-ic { flex: none; display: grid; place-items: center; width: 42px; height: 42px; background: #fff; border: 2px solid var(--ink); border-radius: 10px; }
.pnl-bag-txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.pnl-bag-txt b { font-size: 17px; line-height: 1.1; }
.pnl-bag-txt small { font-size: 13px; color: var(--ink-l); }
.pnl-bag-txt small b { font-size: inherit; color: var(--ink); }
.pnl-bag-arrow { flex: none; display: grid; place-items: center; width: 32px; height: 32px; }
.pnl-bag-body { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; border-top: 2px dashed var(--ink-ll); }
.pnl-bag-row { display: flex; flex-direction: column; gap: 6px; }
.pnl-bag-game { display: flex; align-items: center; gap: 6px; font-size: 15px; }
.pnl-bag-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.pnl-bag-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; background: #fff; border: 2px solid var(--ink); border-radius: 10px; }
.pnl-bag-item > span { display: flex; flex-direction: column; min-width: 0; line-height: 1.1; }
.pnl-bag-item b { font-size: 13px; }
.pnl-bag-item small { font-size: 13px; font-weight: 700; color: var(--primary-d); }
.pnl-bag-item.none { opacity: .5; background: #f8f4ef; }
.pnl-bag-item.none small { color: var(--ink-l); }

/* ---------- Ajustes: cuenta y amigas ---------- */
.pnl-acc { gap: 10px; }
.pnl-acc-status { display: flex; flex-direction: column; gap: 6px; }
.pnl-acc-status .pnl-chips { justify-content: flex-start; }
.pnl-acc-status p { margin: 0; line-height: 1.25; word-break: break-word; }
.pnl-acc-btns { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
@media (min-width: 480px) { .pnl-acc-btns:has(> :nth-child(2)) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.pnl-friendcode { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; background: linear-gradient(135deg, var(--primary-l), var(--second-l));
  border: var(--line) solid var(--ink); border-radius: 12px; }
.pnl-friendcode-l { display: flex; flex-direction: column; min-width: 0; }
.pnl-friendcode small { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; font-weight: 700; color: var(--ink-l); }
.pnl-friendcode-txt { font-size: 30px; letter-spacing: 6px; line-height: 1.05; color: var(--ink); font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 700; }

/* ---------- Ayuda en grupos ---------- */
.pnl-help-groups { display: flex; flex-direction: column; gap: 14px; }
.pnl-help-h { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 18px; padding-bottom: 6px; border-bottom: 2px dashed #f0e4d2; }

@media (max-width: 380px) {
  .pnl-tabs { gap: 6px; padding: 12px 10px 10px; }
  .pnl-tabs .tab { font-size: 14px; gap: 3px; }
  .pnl-tabs .tab .pi { width: 16px; height: 16px; }
  .pnl-hide-xs { display: none; }
  .pnl-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 14px; }
  .pnl-mq-title { font-size: 22px; }
}
@media (max-width: 420px) {
  .pnl-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .pnl-bob, .pnl-glow, .pnl-shake, .pnl-rays.spin, .pnl-day.today, .pnl-lv-star .pi { animation: none !important; }
}
`;
