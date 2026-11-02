// Estilos de los paneles (se inyectan como <style id="panels-style"> mientras haya un panel abierto).
export const PANEL_CSS = `
/* ---------- Base de paneles ---------- */
.modal.pnl .modal-body {
  background-color: var(--panel);
  background-image: radial-gradient(#ffe2f0 1.6px, transparent 2px);
  background-size: 20px 20px;
}
.modal.pnl .modal-head h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.pnl-tabs .tab.active .pi { filter: drop-shadow(0 2px 0 rgba(59,35,64,.35)); }
.pnl-pane { flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; touch-action: pan-y; overscroll-behavior: contain; padding: 14px 14px 20px; }

/* ---------- Misión principal ---------- */
.pnl-mq { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 30px 16px 16px; margin-top: 10px;
  background: linear-gradient(#fff 55%, #fff1f8); overflow: visible; }
.pnl-mq.ready { background: linear-gradient(#fffbea 50%, var(--gold-l)); }
.pnl-mq-ribbon { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); }
.pnl-mq-ribbon span { display: inline-block; padding: 4px 14px; background: var(--lilac); color: #fff; font-weight: 700; font-size: 14px; border: var(--line) solid var(--ink); border-radius: 10px;
  box-shadow: 0 3px 0 var(--ink); text-shadow: 0 2px 0 rgba(59,35,64,.35); white-space: nowrap; }
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
.pnl-step-dot { flex: none; width: 38px; height: 38px; display: grid; place-items: center; background: #efe6f3; border: var(--line) solid var(--ink); border-radius: 50%; position: relative; z-index: 1; }
.pnl-step-body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,.85); border: 2px solid var(--ink-ll); border-radius: 12px; }
.pnl-step-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pnl-step-body small { font-size: 12px; color: var(--ink-l); font-weight: 700; }
.pnl-step-body b { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pnl-blur { filter: blur(4px); user-select: none; }
.pnl-step-rew { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 14px; }
.pnl-step.last .pnl-step-dot { background: var(--gold-l); }

/* ---------- Filas de misiones / logros ---------- */
.pnl-timer { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; background: var(--sky-l); border: 2px solid var(--ink); border-radius: 12px; font-size: 16px; }
.pnl-timer.lilac { background: var(--lilac-l); }
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
.pnl-chest { display: flex; align-items: center; gap: 12px; padding: 12px; background: linear-gradient(135deg, #fff, var(--lilac-l)); margin-top: 4px; }
.pnl-chest.ready { background: linear-gradient(135deg, var(--gold-l), var(--pink-l)); }
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
  background-color: var(--gc); background-image: radial-gradient(rgba(255,255,255,.45) 2px, transparent 2.5px), linear-gradient(rgba(255,255,255,.25), rgba(59,35,64,.08));
  background-size: 14px 14px, 100% 100%; }
.pnl-game-art .pi { width: 68px; height: 68px; filter: drop-shadow(0 4px 0 rgba(59,35,64,.3)); }
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
.pnl-game.locked { background: #f6eff8; }
@media (min-width: 700px) {
  .pnl-games-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .pnl-game { grid-template-columns: 128px minmax(0, 1fr); min-height: 190px; }
  .pnl-game-art .pi { width: 84px; height: 84px; }
  .pnl-game-name { font-size: 20px; }
}

/* ---------- Ajustes ---------- */
.pnl-sec { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.pnl-sec-title { display: flex; align-items: center; gap: 8px; font-size: 18px; padding-bottom: 8px; border-bottom: 2px dashed #f0d2e2; }
.pnl-toggles { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
@media (min-width: 480px) { .pnl-toggles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.pnl-toggle { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px;
  box-shadow: 0 3px 0 var(--ink); font-size: 16px; min-height: 52px; }
.pnl-toggle:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
.pnl-toggle-lbl { display: flex; align-items: center; gap: 6px; min-width: 0; }
.pnl-switch { flex: none; width: 46px; height: 26px; border: var(--line) solid var(--ink); border-radius: 8px; background: #e9dcee; position: relative; transition: background .15s; }
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
  background: var(--pink); color: #fff; border: 2px solid var(--ink); border-radius: 50%; }
.pnl-appicon { border-radius: 9px; border: 2px solid var(--ink); }
.pnl-note { display: flex; align-items: flex-start; gap: 8px; margin: 0; padding: 8px 10px; font-size: 14px; background: var(--gold-l); border: 2px solid var(--ink); border-radius: 10px; line-height: 1.25; }
.pnl-note.good { background: var(--mint-l); align-items: center; }
.pnl-code { width: 100%; resize: none; padding: 8px 10px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 14px; line-height: 1.25; color: var(--ink);
  background: #fff; border: var(--line) solid var(--ink); border-radius: 10px; outline: none; touch-action: pan-y; word-break: break-all; }
.pnl-code::placeholder { font-family: var(--font); color: var(--ink-ll); }
.pnl-code:focus { border-color: var(--pink-d); }
.pnl-code[readonly] { background: #fbf5ff; }
.pnl-sep { height: 0; border-top: 2px dashed #f0d2e2; margin: 2px 0; }
.pnl-helpbtn { margin-top: 2px; }
.pnl-credits { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 16px 12px; background: linear-gradient(#fff, var(--pink-l)); }
.pnl-credits-title { font-size: 19px; }
.pnl-credits p { margin: 2px 0; }
.pnl-danger { --bg: var(--coral); --bg-d: #d94a57; }
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
.pnl-help-pc { margin-top: 12px; padding: 10px 12px; background: var(--lilac-l); border: 2px solid var(--ink); border-radius: 12px; font-size: 14px; }
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
  border: var(--line) solid var(--ink); border-radius: 14px; background: radial-gradient(circle at 50% 45%, #fff 0, var(--pink-l) 70%); }
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
.pnl-day.big { grid-column: span 2; background: linear-gradient(135deg, var(--lilac-l), var(--pink-l)); }
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
.pnl-lv-star .pi { filter: drop-shadow(0 6px 0 rgba(59,35,64,.25)); animation: pnlBob 1.6s steps(4) .7s infinite; }
.pnl-lv-star b { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -38%); font-size: 40px; color: #fff; pointer-events: none;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink); }
@keyframes pnlStarIn { from { transform: scale(0) rotate(-180deg); opacity: 0; } }
.pnl-lv-title { font-size: 40px; color: #fff; letter-spacing: 1px; margin-top: 2px;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 7px 0 var(--pink-d);
  animation: pnlPop .5s .25s cubic-bezier(.3,1.8,.6,1) both; }
.pnl-lv-sub { margin: 4px 0 0; font-size: 17px; font-weight: 700; color: var(--ink-l); }
.pnl-lv-reward { display: flex; align-items: center; gap: 12px; font-size: 24px; margin: 6px 0 2px; padding: 6px 16px; background: #fff; border: var(--line) solid var(--ink); border-radius: 12px; box-shadow: 0 3px 0 var(--ink); animation: pnlPop .45s .4s both; }
.pnl-lv-reward small { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: var(--ink-l); font-weight: 700; }
.pnl-lv-h { display: flex; align-items: center; gap: 6px; margin: 10px 0 2px; font-size: 18px; }
.pnl-unlocks { width: 100%; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.pnl-unlock { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: #fff; border: 2px solid var(--ink); border-radius: 12px; box-shadow: 0 2px 0 var(--ink); text-align: left;
  animation: pnlEnter .35s both; }
.pnl-unlock.hot { background: var(--gold-l); }
.pnl-unlock-ic { flex: none; width: 50px; height: 50px; display: grid; place-items: center; background: var(--sky-l); border: 2px solid var(--ink); border-radius: 10px; overflow: hidden; }
.pnl-unlock.hot .pnl-unlock-ic { background: #fff; }
.pnl-unlock-txt { display: flex; flex-direction: column; min-width: 0; }
.pnl-unlock-txt small { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--ink-l); font-weight: 700; }
.pnl-unlock-txt b { font-size: 15px; line-height: 1.1; }
.pnl-thumb { width: 48px; height: 48px; }
.pnl-lv-empty { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 10px 12px; text-align: left; font-size: 15px; background: var(--mint-l); border: 2px solid var(--ink); border-radius: 12px; }
.pnl-lv-next { display: flex; align-items: center; gap: 6px; justify-content: center; flex-wrap: wrap; margin: 10px 0 0; font-size: 14px; color: var(--ink-l); }

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
