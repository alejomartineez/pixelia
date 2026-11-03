// Joyas Reales — estilos propios (se inyectan al montar y se quitan al desmontar).
const OUT = (c, w = 3) => `${w}px 0 ${c}, -${w}px 0 ${c}, 0 ${w}px ${c}, 0 -${w}px ${c}, ${w}px ${w}px ${c}, -${w}px ${w}px ${c}, ${w}px -${w}px ${c}, -${w}px -${w}px ${c}`;

export const M3_CSS = `
.scene-match3 { overflow: hidden; }
.scene-match3 .m3-glow { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 70% 55% at 50% 58%, rgba(255,255,255,.7), rgba(255,255,255,0) 70%); }
.scene-match3 .hidden { display: none !important; }
.scene-match3 .m3-deco { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.scene-match3 .m3-float { position: absolute; opacity: .5; animation: m3float 6s ease-in-out infinite; filter: drop-shadow(0 3px 0 rgba(59,35,64,.12)); }
@keyframes m3float { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-14px) rotate(6deg); } }

/* ---------- barra superior ---------- */
.scene-match3 .m3-bar { left: 50%; right: auto; transform: translateX(-50%); width: min(660px, calc(100% - 16px - var(--safe-l) - var(--safe-r))); }
.scene-match3 .m3-bar.play { display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "back goals moves" "score score score"; gap: 8px; align-items: stretch; }
.scene-match3 .m3-back { grid-area: back; align-self: center; }
.scene-match3 .m3-goals { grid-area: goals; flex-direction: row; justify-content: space-evenly; align-items: center; gap: 8px; padding: 4px 8px; min-width: 0; }
.scene-match3 .m3-goal { display: flex; align-items: center; gap: 5px; }
.scene-match3 .m3-goal b { font-size: 22px; min-width: 22px; display: inline-flex; align-items: center; }
.scene-match3 .m3-goal.done { animation: m3pop .45s cubic-bezier(.3,1.8,.6,1); }
.scene-match3 .m3-goal .m3-gi, .scene-match3 .m3-goal > img { filter: drop-shadow(0 2px 0 rgba(59,35,64,.18)); }
.scene-match3 .m3-moves { grid-area: moves; justify-content: center; min-width: 74px; }
.scene-match3 .m3-moves b { font-size: 28px; line-height: 1; }
.scene-match3 .m3-moves.low { background: #ffe1e6; }
.scene-match3 .m3-moves.low b { color: #d63a5c; animation: pulse .8s steps(2) infinite; }
.scene-match3 .m3-score { grid-area: score; display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 8px; padding: 3px 12px; }
.scene-match3 .m3-score b { min-width: 64px; text-align: left; font-size: 20px; }
.scene-match3 .m3-starbar { position: relative; height: 14px; border: 2px solid var(--ink); border-radius: 8px; background: #f2e3ee; margin: 4px 10px 4px 0; }
.scene-match3 .m3-starbar i { display: block; height: 100%; width: 0; border-radius: 5px 0 0 5px;
  background: repeating-linear-gradient(90deg, var(--gold) 0 6px, var(--gold-d) 6px 8px); transition: width .12s; }
.scene-match3 .m3-starbar span { position: absolute; top: 50%; width: 18px; height: 18px; margin-top: -10px; line-height: 0; }
.scene-match3 .m3-starbar span.on { animation: m3pop .45s cubic-bezier(.3,1.8,.6,1); }
.scene-match3 .m3-total b { display: inline-flex; align-items: center; gap: 4px; }
@media (min-width: 760px) {
  .scene-match3 .m3-bar.play { grid-template-columns: auto 1fr auto 230px; grid-template-areas: "back goals moves score"; }
  .scene-match3 .m3-score { grid-template-columns: auto 1fr; grid-template-rows: auto auto; gap: 0 8px; padding: 2px 12px; }
  .scene-match3 .m3-score small { grid-column: 1; }
  .scene-match3 .m3-score b { grid-column: 2; text-align: right; }
  .scene-match3 .m3-starbar { grid-column: 1 / -1; margin: 4px 10px 6px 0; }
}

/* ---------- tablero ---------- */
.scene-match3 .m3-stage { position: absolute; left: var(--safe-l); right: var(--safe-r); bottom: calc(var(--safe-b) + 8px);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.scene-match3 .m3-plaque { flex: none; }
.scene-match3 .m3-pl-in { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px 6px 10px; background: #fff; border: 3px solid var(--ink); border-radius: 14px;
  box-shadow: inset 0 -5px 0 #f6e0ee, 0 4px 0 var(--ink); }
.scene-match3 .m3-pl-in b { font-size: 24px; color: var(--pink-d); text-shadow: 0 2px 0 var(--pink-l); }
.scene-match3 .m3-pl-st { display: inline-flex; gap: 1px; margin-left: 2px; }
.scene-match3 .m3-board { position: relative; flex: none; filter: drop-shadow(0 7px 0 rgba(59,35,64,.16)); }
.scene-match3 .m3-canvas { width: 100%; height: 100%; cursor: pointer; }
.scene-match3 .m3-fx { position: absolute; inset: 0; pointer-events: none; }
.scene-match3 .m3-foot { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 40px; flex-wrap: wrap; padding: 0 12px; }
.scene-match3 .m3-foot .chip { font-size: 15px; padding: 4px 10px; box-shadow: 0 2px 0 var(--ink); }
.scene-match3 .m3-helptext { font-size: 15px; background: rgba(255,255,255,.92); border: 2px solid var(--ink); border-radius: 10px; padding: 5px 10px; text-align: center;
  animation: m3breathe 1.6s ease-in-out infinite; }

.scene-match3 .m3-combo { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); white-space: nowrap; pointer-events: none;
  font-size: clamp(32px, 10vw, 56px); font-weight: 700; color: #fff; letter-spacing: 1px;
  text-shadow: ${OUT('var(--ink)')}, 0 8px 0 var(--pink-d); animation: m3combo 1s forwards; }
.scene-match3 .m3-combo.c3 { text-shadow: ${OUT('var(--ink)')}, 0 8px 0 var(--lilac-d); color: #fbf7ff; }
.scene-match3 .m3-combo.c4 { text-shadow: ${OUT('var(--ink)')}, 0 8px 0 var(--gold-d); color: #fff4c2; font-size: clamp(36px, 11vw, 62px); }
.scene-match3 .m3-banner { position: absolute; left: 50%; top: 50%; white-space: nowrap; pointer-events: none;
  font-size: clamp(26px, 8vw, 40px); font-weight: 700; color: #fff; padding: 8px 26px 10px; border: 3px solid var(--ink); border-radius: 14px;
  background: linear-gradient(var(--pink), var(--pink-d)); box-shadow: 0 5px 0 var(--ink), 0 14px 30px rgba(59,35,64,.3);
  text-shadow: 0 3px 0 rgba(59,35,64,.45); animation: m3banner 1.3s cubic-bezier(.3,1.5,.6,1) forwards; }
.scene-match3 .m3-banner.gold { background: linear-gradient(var(--gold), var(--gold-d)); color: var(--ink); text-shadow: 0 2px 0 rgba(255,255,255,.6); }
.scene-match3 .m3-banner.lilac { background: linear-gradient(var(--lilac), var(--lilac-d)); }
@keyframes m3combo {
  0% { transform: translate(-50%, -50%) scale(.2) rotate(-10deg); opacity: 0; }
  18% { transform: translate(-50%, -50%) scale(1.18) rotate(3deg); opacity: 1; }
  30% { transform: translate(-50%, -50%) scale(1) rotate(0); }
  72% { transform: translate(-50%, -62%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -90%) scale(.9); opacity: 0; } }
@keyframes m3banner {
  0% { transform: translate(-50%, -50%) scale(.3); opacity: 0; }
  20% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
  30% { transform: translate(-50%, -50%) scale(1); }
  82% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(.85); opacity: 0; } }
@keyframes m3pop { 0% { transform: scale(.4); } 60% { transform: scale(1.25); } 100% { transform: scale(1); } }
@keyframes m3breathe { 50% { transform: scale(1.04); } }
@keyframes m3in { from { transform: scale(.85) translateY(16px); opacity: 0; } }

/* ---------- pantalla previa ---------- */
.scene-match3 .m3-pre { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  padding: calc(var(--safe-t) + 74px) calc(var(--safe-r) + 12px) calc(var(--safe-b) + 14px) calc(var(--safe-l) + 12px); overflow-y: auto; }
.scene-match3 .m3-card { position: relative; width: min(420px, 100%); text-align: center; display: flex; flex-direction: column; gap: 12px;
  background: var(--panel); border: 3px solid var(--ink); border-radius: 18px; padding: 44px 16px 16px;
  box-shadow: 0 6px 0 var(--ink), 0 18px 40px rgba(59,35,64,.25); animation: m3in .35s cubic-bezier(.3,1.6,.6,1); flex: none; }
.scene-match3 .m3-ribbon { position: absolute; top: -28px; left: 50%; transform: translateX(-50%); }
.scene-match3 .m3-ribbon span { position: relative; z-index: 1; display: block; white-space: nowrap; font-size: 30px; font-weight: 700; color: #fff; padding: 6px 30px 8px;
  background: linear-gradient(var(--pink), var(--pink-d)); border: 3px solid var(--ink); border-radius: 12px; box-shadow: 0 4px 0 var(--ink); text-shadow: 0 2px 0 rgba(59,35,64,.4); }
.scene-match3 .m3-ribbon::before, .scene-match3 .m3-ribbon::after { content: ''; position: absolute; top: 14px; width: 26px; height: 30px; background: var(--pink-d); border: 3px solid var(--ink); }
.scene-match3 .m3-ribbon::before { left: -16px; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 40% 50%); border-right: 0; }
.scene-match3 .m3-ribbon::after { right: -16px; clip-path: polygon(0 0, 100% 0, 60% 50%, 100% 100%, 0 100%); border-left: 0; }
.scene-match3 .m3-prestars { display: flex; justify-content: center; align-items: flex-end; gap: 4px; margin-top: 2px; }
.scene-match3 .m3-prestars img:nth-child(2) { transform: translateY(-6px); }
.scene-match3 .m3-pregoals { display: flex; flex-direction: column; gap: 8px; }
.scene-match3 .m3-pregoal { display: flex; align-items: center; gap: 12px; text-align: left; font-size: 18px; line-height: 1.2;
  background: #fff; border: 3px solid var(--ink); border-radius: 12px; padding: 7px 12px 7px 7px; box-shadow: 0 3px 0 var(--ink); }
.scene-match3 .m3-pregoal small { color: var(--ink-l); font-size: 13px; }
.scene-match3 .m3-pgi { flex: none; width: 54px; height: 54px; display: grid; place-items: center; border-radius: 10px; background: var(--pink-l);
  box-shadow: inset 0 -4px 0 rgba(224,82,143,.25); }
.scene-match3 .m3-meta { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.scene-match3 .m3-meta .chip { font-size: 14px; padding: 3px 10px; }
.scene-match3 .m3-tip { display: flex; gap: 8px; align-items: flex-start; text-align: left; margin: 0; font-size: 14px; line-height: 1.3; color: var(--ink-l);
  background: var(--gold-l); border: 2px dashed var(--gold-d); border-radius: 10px; padding: 8px 10px; }
.scene-match3 .m3-tip img { margin-top: 1px; }
.scene-match3 .m3-play { font-size: 22px; min-height: 56px; animation: m3breathe 1.5s ease-in-out infinite; }
.scene-match3 .m3-map { width: min(640px, 100%); flex: none; background: rgba(255,255,255,.88); border: 3px solid var(--ink); border-radius: 16px; box-shadow: 0 4px 0 var(--ink); padding: 8px 0 4px; }
.scene-match3 .m3-map-title { display: flex; align-items: center; gap: 6px; padding: 0 14px; font-size: 15px; font-weight: 700; }
.scene-match3 .m3-map-scroll { display: flex; align-items: center; overflow-x: auto; overflow-y: hidden; padding: 10px 16px 12px; touch-action: pan-x;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: var(--pink) transparent; cursor: grab; }
.scene-match3 .m3-node { flex: none; width: 54px; height: 60px; padding: 0; border: 3px solid var(--ink); border-radius: 14px; background: #fff; color: var(--ink);
  box-shadow: inset 0 -5px 0 #eadcf0, 0 3px 0 var(--ink); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  transition: transform .12s; }
.scene-match3 .m3-node b { font-size: 21px; line-height: 1; display: grid; place-items: center; min-height: 21px; }
.scene-match3 .m3-nstars { display: flex; gap: 0; line-height: 0; }
.scene-match3 .m3-node.cur { background: var(--gold-l); box-shadow: inset 0 -5px 0 #f3d58c, 0 3px 0 var(--ink); }
.scene-match3 .m3-node.sel { background: var(--pink); color: #fff; box-shadow: inset 0 -5px 0 var(--pink-d), 0 3px 0 var(--ink); transform: translateY(-4px);
  text-shadow: 0 2px 0 rgba(59,35,64,.35); }
.scene-match3 .m3-node.locked { background: #efe6f2; color: var(--ink-ll); box-shadow: inset 0 -5px 0 #dccfe2, 0 3px 0 var(--ink); }
.scene-match3 .m3-node.locked .m3-nstars { opacity: .35; }
.scene-match3 .m3-path { flex: none; width: 14px; height: 6px; background: repeating-linear-gradient(90deg, var(--gold-d) 0 4px, transparent 4px 7px); }
.scene-match3 .m3-path.locked { opacity: .35; }
/* Jersey es condensada: los rótulos chiquitos necesitan un poco más de tamaño para leerse bien */
.scene-match3 .game-stat small { font-size: 13px; }
@media (min-width: 760px) {
  .scene-match3 .m3-card { width: min(460px, 100%); }
  .scene-match3 .m3-pregoal { font-size: 21px; }
  .scene-match3 .m3-pregoal small { font-size: 15px; }
  .scene-match3 .m3-tip { font-size: 16px; }
  .scene-match3 .m3-meta .chip { font-size: 16px; }
  .scene-match3 .m3-map-title { font-size: 17px; }
  .scene-match3 .m3-foot .chip, .scene-match3 .m3-helptext, .scene-match3 .m3-hintbtn { font-size: 17px; }
}
@media (max-height: 700px) {
  .scene-match3 .m3-pre { justify-content: flex-start; gap: 18px; padding-top: calc(var(--safe-t) + 84px); }
  .scene-match3 .m3-tip { display: none; }
}
.float-text.m3-pts { font-size: 20px; color: #fff4c2; }
`;
