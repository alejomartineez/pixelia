// Estacionamiento Real — estilos propios (se inyectan en mount y se quitan en unmount).
export const PARKING_CSS = `
.scene-parking .pk-ui { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.scene-parking .pk-ui .game-bar { z-index: 6; }
.scene-parking .pk-title { min-width: 0; white-space: nowrap; }
.scene-parking .game-stat { transition: background .2s; }
.scene-parking .game-stat.pk-warn { background: #ffe1e6; }
.scene-parking .game-stat.pk-warn b { color: #e0435a; }

.scene-parking .pk-goal {
  position: absolute; top: calc(var(--safe-t) + 66px); left: 50%; transform: translate(-50%, -6px);
  max-width: min(92vw, 560px); width: max-content;
  background: rgba(255,255,255,.93); border: 2px solid var(--ink); border-radius: 10px; box-shadow: 0 3px 0 var(--ink);
  padding: 4px 12px; font-size: 14px; font-weight: 700; text-align: center; line-height: 1.2;
  opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none;
}
.scene-parking .pk-goal.show { opacity: 1; transform: translate(-50%, 0); }

.scene-parking .pk-hint {
  position: absolute; top: calc(var(--safe-t) + 104px); left: 50%; transform: translate(-50%, 0) scale(.6);
  display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 210px; width: max-content; max-width: 92vw;
  background: #fff; border: var(--line) solid var(--ink); border-radius: 14px; box-shadow: var(--shadow);
  padding: 6px 14px; font-size: 17px; font-weight: 700; text-align: center; opacity: 0; pointer-events: none;
  transition: opacity .15s, transform .2s cubic-bezier(.3,1.7,.6,1);
}
.scene-parking .pk-hint.show { opacity: 1; transform: translate(-50%, 0) scale(1); }
.scene-parking .pk-hint.low { top: auto; bottom: calc(var(--safe-b) + 150px); }
@media (min-width: 900px) and (min-height: 600px) { .scene-parking .pk-hint.low { bottom: calc(var(--safe-b) + 64px); } }
.scene-parking .pk-hint.good { background: var(--mint-l); }
.scene-parking .pk-hint.warn { background: #ffe1e6; }
.scene-parking .pk-hint .progress { width: 100%; height: 10px; display: none; }
.scene-parking .pk-hint.with-bar .progress { display: block; }
.scene-parking .pk-hint .progress i { transition: none; }

/* ---------- Controles ---------- */
.scene-parking .pk-controls {
  position: absolute; left: calc(var(--safe-l) + 12px); right: calc(var(--safe-r) + 12px); bottom: calc(var(--safe-b) + 14px);
  display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none;
}
.scene-parking .pk-steer, .scene-parking .pk-pedals { display: flex; gap: 12px; align-items: flex-end; pointer-events: auto; }
.scene-parking .pk-btn {
  touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0;
  border: var(--line) solid var(--ink); border-radius: 20px; background: #fff; color: var(--ink);
  box-shadow: inset 0 -7px 0 #eadcf0, 0 5px 0 var(--ink); font-size: 14px; font-weight: 700;
  transition: transform .05s, box-shadow .05s, filter .1s;
}
.scene-parking .pk-btn svg { image-rendering: pixelated; pointer-events: none; }
.scene-parking .pk-btn span { pointer-events: none; }
.scene-parking .pk-btn.on { transform: translateY(4px); box-shadow: inset 0 -3px 0 #eadcf0, 0 1px 0 var(--ink); filter: brightness(.94); }
.scene-parking .pk-left, .scene-parking .pk-right { width: 78px; height: 78px; color: var(--lilac-d); }
.scene-parking .pk-gas {
  width: 88px; height: 118px; background: var(--pink); color: #fff; text-shadow: 0 2px 0 rgba(59,35,64,.35);
  box-shadow: inset 0 -8px 0 var(--pink-d), 0 5px 0 var(--ink);
}
.scene-parking .pk-gas.on { box-shadow: inset 0 -3px 0 var(--pink-d), 0 1px 0 var(--ink); }
.scene-parking .pk-rev { width: 78px; height: 86px; background: var(--sky); box-shadow: inset 0 -7px 0 var(--sky-d), 0 5px 0 var(--ink); }
.scene-parking .pk-rev.on { box-shadow: inset 0 -3px 0 var(--sky-d), 0 1px 0 var(--ink); }
.scene-parking .pk-gas svg { filter: drop-shadow(0 2px 0 rgba(59,35,64,.35)); }
@media (max-width: 360px) {
  .scene-parking .pk-left, .scene-parking .pk-right { width: 68px; height: 68px; }
  .scene-parking .pk-gas { width: 78px; }
  .scene-parking .pk-rev { width: 70px; }
}
@media (min-width: 900px) and (min-height: 600px) {
  .scene-parking .pk-controls { left: calc(var(--safe-l) + 24px); right: calc(var(--safe-r) + 24px); bottom: calc(var(--safe-b) + 22px); }
}

.scene-parking .pk-keys { display: none; pointer-events: none; font-size: 15px; z-index: 6; }
.scene-parking .pk-keys b { background: var(--lilac-l); border: 2px solid var(--ink); border-radius: 6px; padding: 0 5px; font-size: 13px; }
@media (hover: hover) and (pointer: fine) {
  .scene-parking .pk-keys { display: block; }
}
@media (hover: hover) and (pointer: fine) and (max-width: 980px) {
  .scene-parking .pk-keys { bottom: calc(var(--safe-b) + 150px); white-space: normal; text-align: center; width: max-content; max-width: 90vw; }
}
@media (hover: hover) and (pointer: fine) and (max-width: 980px) {
  .scene-parking .pk-hint.low { bottom: calc(var(--safe-b) + 200px); }
}

/* ---------- Indicador del lugar fuera de pantalla ---------- */
.scene-parking .pk-pointer { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; pointer-events: none; z-index: 4; }
.scene-parking .pk-pointer[hidden] { display: none; }
.scene-parking .pk-pointer b { position: absolute; inset: 4px; display: grid; place-items: center; border-radius: 50%; background: var(--gold); border: var(--line) solid var(--ink);
  font-size: 20px; color: var(--ink); box-shadow: 0 3px 0 var(--ink); animation: pk-pulse .8s steps(2) infinite; }
.scene-parking .pk-pointer i { position: absolute; inset: 0; }
.scene-parking .pk-pointer i::after { content: ''; position: absolute; right: -12px; top: 50%; margin-top: -9px; border: 9px solid transparent; border-left: 12px solid var(--ink); border-right: 0; }
@keyframes pk-pulse { 50% { transform: scale(1.12); } }

/* ---------- Tarjeta de inicio ---------- */
.scene-parking .pk-intro {
  position: absolute; left: 0; right: 0; top: calc(var(--safe-t) + 58px); bottom: calc(var(--safe-b) + 150px);
  display: grid; place-items: center; padding: 8px 14px; pointer-events: none; opacity: 0; transition: opacity .2s;
}
.scene-parking .pk-intro.show { opacity: 1; }
.scene-parking .pk-intro.show .pk-card { pointer-events: auto; transform: none; }
.scene-parking .pk-card {
  width: min(360px, 100%); max-height: 100%; overflow-y: auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: rgba(255,247,251,.97); transform: scale(.9); transition: transform .25s cubic-bezier(.3,1.6,.6,1); padding: 14px 16px 12px;
}
.scene-parking .pk-card-top { display: flex; justify-content: space-between; width: 100%; gap: 6px; }
.scene-parking .pk-card h2 { font-size: 34px; color: #fff; letter-spacing: 1px; margin-top: 2px;
  text-shadow: 3px 0 var(--ink), -3px 0 var(--ink), 0 3px var(--ink), 0 -3px var(--ink), 3px 3px var(--ink), -3px 3px var(--ink), 3px -3px var(--ink), -3px -3px var(--ink), 0 6px 0 var(--pink-d); }
.scene-parking .pk-card h3 { font-size: 20px; color: var(--pink-d); }
.scene-parking .pk-card-stars { display: flex; gap: 4px; }
.scene-parking .pk-card-goal { font-size: 17px; font-weight: 700; margin: 2px 0; }
.scene-parking .pk-card-tip { display: flex; align-items: flex-start; gap: 6px; text-align: left; font-size: 14px; color: var(--ink-l);
  background: var(--gold-l); border: 2px solid var(--ink); border-radius: 10px; padding: 6px 8px; margin: 0; width: 100%; }
.scene-parking .pk-card-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; font-size: 13px; font-weight: 700; color: var(--ink-l); }
.scene-parking .pk-card-meta span { display: inline-flex; align-items: center; gap: 3px; }
.scene-parking .pk-card-btns { display: flex; gap: 10px; width: 100%; margin-top: 4px; }
.scene-parking .pk-card-btns .btn { flex: 1; }
.scene-parking .pk-card-btns .pk-play { flex: 1.4; font-size: 20px; }
.scene-parking .pk-card-keys { display: none; font-size: 12px; color: var(--ink-l); }
@media (hover: hover) and (pointer: fine) { .scene-parking .pk-card-keys { display: block; } }
@media (max-height: 700px) and (orientation: landscape) {
  .scene-parking .pk-intro { bottom: calc(var(--safe-b) + 10px); }
}

/* ---------- Selector de niveles (modal fuera de la escena) ---------- */
.pk-levels-modal .pk-lv-total { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 18px; margin: 0 0 10px; }
.pk-levels-modal .pk-lvgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 8px; }
.pk-levels-modal .pk-lv {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 66px; padding: 4px 2px;
  border: var(--line) solid var(--ink); border-radius: 12px; background: #fff; box-shadow: inset 0 -4px 0 #eadcf0, 0 3px 0 var(--ink);
}
.pk-levels-modal .pk-lv b { font-size: 22px; line-height: 1; }
.pk-levels-modal .pk-lv:active { transform: translateY(2px); }
.pk-levels-modal .pk-lv.current { background: var(--gold-l); outline: 3px solid var(--gold); outline-offset: -1px; }
.pk-levels-modal .pk-lv.locked { background: #f1e9f3; color: var(--ink-ll); }
.pk-levels-modal .pk-lv-stars { display: flex; }

/* ---------- Textos flotantes ---------- */
.float-text.pk-toc { color: #ffd1d8; font-size: 24px; }
.float-text.pk-go { color: var(--mint-l); font-size: 26px; }
.float-text.pk-perfect { color: var(--gold); font-size: 34px; animation-duration: 1.4s; }
`;
