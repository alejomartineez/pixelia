// Estilos de las pantallas sociales (.soc-*). Se inyectan con useSocialStyle() (social-common.js).
export const SOCIAL_CSS = `
/* ===== Social: base ===== */
.modal.soc { --a: var(--second); --ad: var(--second-d); --al: var(--second-l); isolation: isolate; }
.modal.soc .modal-head { background: linear-gradient(var(--a), var(--ad)); }
.modal.soc .modal-body { background-color: var(--panel); background-image: radial-gradient(color-mix(in srgb, var(--a) 20%, transparent) 1.6px, transparent 2px); background-size: 20px 20px; }
.modal.soc.sheet .modal-body { flex: 1; padding-top: 10px; }
.modal.soc.sheet { width: min(760px, 100%); height: min(86vh, 760px); height: min(86dvh, 760px); }
@media (max-width: 600px) { .modal.soc.sheet { height: 90vh; height: 90dvh; } }
.soc-wrap { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; padding-bottom: 10px; }
.soc p { margin: 0; }
.soc-sec { display: flex; flex-direction: column; gap: 8px; }
.soc-sec > h4, .soc-h { margin: 4px 2px 0; font-size: 17px; display: flex; align-items: center; gap: 6px; color: var(--ink); }
.soc-h small, .soc-sec > h4 small { margin-left: auto; font-size: 13px; color: var(--ink-l); font-weight: 700; }
.soc-card { background: #fff; border: var(--line) solid var(--ink); border-radius: 14px; box-shadow: 0 3px 0 var(--ink); padding: 10px 12px; position: relative; }
.soc-card.tint { background: var(--al); }
.soc-card.gold { background: var(--gold-l); }
.soc-card.mint { background: var(--mint-l); }
.soc-card.sky { background: var(--sky-l); }
.soc-card.primary { background: var(--primary-l); }
.soc-muted { color: var(--ink-l); font-size: 14px; line-height: 1.25; }
.soc-row { display: flex; align-items: center; gap: 8px; }
.soc-row.wrap { flex-wrap: wrap; }
.soc-grow { flex: 1; min-width: 0; }
.soc-ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.soc .btn.small { min-height: 38px; }
.soc .btn .pi { flex: none; }
.soc-busy { position: relative; pointer-events: none; }
.soc-busy::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 6px, transparent 6px 12px); animation: socBusy .5s steps(4) infinite; }
@keyframes socBusy { to { background-position: 24px 0; } }

/* pestañas fijas debajo del título */
.soc-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 10px 12px 10px; background: var(--al); border-bottom: var(--line) solid var(--ink); scrollbar-width: none; touch-action: pan-x; flex: none; }
.soc-tabs::-webkit-scrollbar { display: none; }
.soc-tab { position: relative; flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border: var(--line) solid var(--ink); border-radius: 10px; background: #fff; font-size: 16px; font-weight: 700; box-shadow: 0 3px 0 var(--ink); }
.soc-tab:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ink); }
.soc-tab.on { background: var(--ad); color: #fff; text-shadow: 0 2px 0 rgba(61,47,42,.35); }
.soc-tab i.soc-dot { position: absolute; top: -9px; right: -7px; min-width: 22px; height: 22px; padding: 0 5px; border-radius: 11px; border: 2px solid var(--ink); background: var(--coral); color: #fff; font-style: normal; font-size: 13px; display: grid; place-items: center; line-height: 1; text-shadow: none; }
@media (min-width: 700px) { .soc-tabs { justify-content: center; } }

/* chip de cuenta en el título */
.soc-acc { display: inline-flex; align-items: center; gap: 5px; height: 34px; padding: 0 10px 0 4px; border: 2px solid var(--ink); border-radius: 99px; background: #fff; color: var(--ink); font-size: 14px; font-weight: 700; max-width: 150px; text-shadow: none; box-shadow: 0 2px 0 var(--ink); }
.soc-acc .soc-av { --sz: 26px !important; border-width: 2px; }
.soc-acc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.soc-acc b.st { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--ink); background: var(--mint); flex: none; }
.soc-acc b.st.off { background: #ddd5c8; }
.soc-acc b.st.warn { background: var(--gold); }

/* avatar */
.soc-av { --sz: 48px; width: var(--sz); height: var(--sz); flex: none; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 12px; background: linear-gradient(#fff, var(--primary-l)); box-shadow: inset 0 -4px 0 rgba(61,47,42,.08); position: relative; overflow: hidden; }
.soc-av img { width: calc(var(--sz) - 8px); height: calc(var(--sz) - 8px); }
.soc-av.me { background: linear-gradient(#fff, var(--gold-l)); }
.soc-on { position: absolute; right: -3px; bottom: -3px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--ink); background: var(--mint); }

/* estado vacío / carga / desconectada */
.soc-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 26px 10px; color: var(--ink-l); font-size: 17px; }
.soc-dots { display: inline-flex; gap: 4px; }
.soc-dots i { width: 8px; height: 8px; background: var(--ad); animation: socDot .9s steps(2) infinite; }
.soc-dots i:nth-child(2) { animation-delay: .3s; } .soc-dots i:nth-child(3) { animation-delay: .6s; }
@keyframes socDot { 50% { transform: translateY(-5px); opacity: .5; } }
.soc-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 18px 12px; color: var(--ink-l); }
.soc-empty b { color: var(--ink); font-size: 18px; }
.soc-empty p { font-size: 15px; max-width: 34ch; }
.soc-connect { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 18px 14px; }
.soc-connect h3 { font-size: 22px; }
.soc-connect p { max-width: 36ch; color: var(--ink-l); font-size: 16px; line-height: 1.3; }
.soc-connect .soc-pals { display: flex; gap: 4px; margin-bottom: 4px; }
.soc-connect .soc-pals .soc-av:nth-child(2) { transform: translateY(-8px); }

/* chips de premios */
.soc-chips { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.soc-chip { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px 1px 4px; border: 2px solid var(--ink); border-radius: 99px; background: #fff; font-size: 14px; font-weight: 700; white-space: nowrap; }
.soc-chip em { font-style: normal; font-weight: 400; color: var(--ink-l); max-width: 14ch; overflow: hidden; text-overflow: ellipsis; }
.soc-plus { color: var(--mint-d); font-weight: 700; }

/* ===== Amigas ===== */
.soc-me { display: grid; grid-template-columns: auto 1fr; gap: 10px 12px; align-items: center; background: linear-gradient(160deg, var(--second-l), #fff 70%); }
.soc-me h3 { font-size: 19px; }
.soc-code { display: flex; gap: 4px; margin-top: 2px; }
.soc-code b { width: 32px; height: 40px; display: grid; place-items: center; font-size: 28px; border: var(--line) solid var(--ink); border-radius: 8px; background: #fff; box-shadow: inset 0 -4px 0 var(--second-l), 0 2px 0 var(--ink); color: var(--ad); }
.soc-me-btns { grid-column: 1 / -1; display: flex; gap: 8px; }
.soc-me-btns .btn { flex: 1; }
.soc-add { display: flex; gap: 8px; }
.soc-add input { flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: 4px; font-size: 22px; padding: 6px 10px; text-align: center; border: var(--line) solid var(--ink); border-radius: 10px; background: #fff; color: var(--ink); outline: none; }
.soc-add input::placeholder { letter-spacing: 1px; font-size: 17px; color: var(--ink-ll); text-transform: none; }
.soc-add input:focus { border-color: var(--ad); box-shadow: 0 0 0 3px var(--al); }
.soc-req { display: flex; align-items: center; gap: 10px; }
.soc-req .soc-grow b { display: block; font-size: 17px; }
.soc-friend { display: grid; grid-template-columns: auto 1fr; gap: 8px 10px; align-items: center; }
.soc-friend .soc-name { display: flex; align-items: center; gap: 6px; min-width: 0; }
.soc-friend .soc-name b { font-size: 19px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.soc-lv { flex: none; display: inline-flex; align-items: center; gap: 2px; padding: 0 7px 0 3px; border: 2px solid var(--ink); border-radius: 99px; background: var(--gold-l); font-size: 13px; font-weight: 700; }
.soc-lv.soc-rk { background: var(--second-l); white-space: nowrap; }
.soc-seen { font-size: 13px; color: var(--ink-l); }
.soc-seen.on { color: var(--mint-d); font-weight: 700; }
.soc-acts { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.soc-acts .btn { padding: 4px 6px; font-size: 15px; gap: 4px; min-height: 40px; }
.soc-acts .btn.done { --bg: var(--mint-l); --bg-d: var(--mint); color: var(--ink); text-shadow: none; filter: none; opacity: 1; }
.soc-x { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; border: 2px solid transparent; border-radius: 8px; background: none; display: grid; place-items: center; opacity: .5; }
.soc-x:hover { opacity: 1; border-color: var(--ink); background: #fff; }
.soc-fl { margin-top: 2px; }
.soc-fl-top { display: flex; align-items: center; gap: 6px; font-size: 14px; }
.soc-fl-top small { margin-left: auto; color: var(--ink-l); font-size: 13px; }
.soc-fl-bar { height: 10px; margin-top: 3px; border: 2px solid var(--ink); border-radius: 6px; background: #f6f0e8; overflow: hidden; }
.soc-fl-bar i { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--primary) 0 6px, var(--primary-d) 6px 8px); transition: width .4s steps(6); }
.soc-fl.lv2 .soc-fl-bar i { background: repeating-linear-gradient(90deg, var(--second) 0 6px, var(--second-d) 6px 8px); }
.soc-fl.lv3 .soc-fl-bar i, .soc-fl.lv4 .soc-fl-bar i { background: repeating-linear-gradient(90deg, var(--gold) 0 6px, var(--gold-d) 6px 8px); }
.soc-hearts { display: inline-flex; gap: 2px; }
.soc-hearts i { width: 10px; height: 9px; background: #eae4dc; clip-path: polygon(0 20%, 20% 0, 40% 0, 50% 20%, 60% 0, 80% 0, 100% 20%, 100% 50%, 50% 100%, 0 50%); }
.soc-hearts i.on { background: var(--primary-d); }

/* ===== Pedidos ===== */
.soc-need { display: grid; grid-template-columns: auto 1fr; gap: 8px 10px; align-items: center; }
.soc-need-ic { width: 56px; height: 56px; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 12px; background: var(--sky-l); }
.soc-need-ic .soc-stk { width: 46px; }
.soc-need .soc-acts { grid-template-columns: 1fr auto; align-items: center; }
.soc-need .soc-acts .soc-chips { justify-content: flex-start; }
.soc-tag { display: inline-flex; align-items: center; gap: 3px; padding: 0 7px; border-radius: 99px; border: 2px solid var(--ink); font-size: 13px; font-weight: 700; background: #fff; }
.soc-tag.ok { background: var(--mint-l); } .soc-tag.wait { background: var(--sky-l); } .soc-tag.old { background: #f0ece6; color: var(--ink-l); }
.soc-slots { display: inline-flex; gap: 4px; }
.soc-slots i { width: 14px; height: 14px; border: 2px solid var(--ink); border-radius: 4px; background: var(--primary); }
.soc-slots i.used { background: #f0e8dc; }
.soc-mine { display: flex; align-items: center; gap: 10px; }
@media (max-width: 520px) {
  .soc-mine, .soc-claimall { flex-wrap: wrap; }
  .soc-mine > .soc-grow, .soc-claimall > .soc-grow { flex: 1 1 0; min-width: 60%; }
  .soc-mine > .btn, .soc-claimall > .btn { flex: 1 1 100%; }
}

/* ===== Buzón ===== */
.soc-claimall { display: flex; align-items: center; gap: 10px; background: linear-gradient(160deg, var(--gold-l), #fff 75%); }
.soc-claimall .btn { flex: none; }
.soc-mail { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; }
.soc-mail-ic { width: 46px; height: 46px; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 12px; background: var(--primary-l); }
.soc-mail-ic.k-help { background: var(--sky-l); } .soc-mail-ic.k-trade { background: var(--second-l); } .soc-mail-ic.k-like { background: #ffd6de; } .soc-mail-ic.k-request_fill { background: var(--mint-l); } .soc-mail-ic.k-sticker { background: var(--gold-l); }
.soc-mail b { font-size: 16px; }
.soc-mail .soc-chips { margin-top: 3px; }
.soc-trade { display: flex; flex-direction: column; gap: 8px; }
.soc-sides { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; align-items: stretch; }
.soc-side { border: 2px dashed var(--ink-ll); border-radius: 10px; padding: 6px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; background: #fefdfb; min-width: 0; }
.soc-side small { font-size: 12px; color: var(--ink-l); font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
.soc-side .soc-stk { width: 64px; }
.soc-swap { align-self: center; font-size: 22px; }
.soc-note { position: relative; margin-top: 4px; padding: 6px 10px; background: #fff; border: 2px solid var(--ink); border-radius: 10px; font-size: 15px; }
.soc-note::before { content: ''; position: absolute; left: 14px; top: -8px; width: 10px; height: 10px; background: #fff; border-left: 2px solid var(--ink); border-top: 2px solid var(--ink); transform: rotate(45deg); }
.soc-visit { display: flex; gap: 10px; align-items: flex-start; }

/* ===== Ranking ===== */
.soc-cats { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 2px 2px 6px; }
.soc-cats::-webkit-scrollbar { display: none; }
.soc-cat { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border: 2px solid var(--ink); border-radius: 99px; background: #fff; font-size: 15px; font-weight: 700; box-shadow: 0 2px 0 var(--ink); }
.soc-cat.on { background: var(--gold); }
.soc-podium { display: grid; grid-template-columns: 1fr 1.1fr 1fr; align-items: end; gap: 6px; padding: 28px 6px 0; border: var(--line) solid var(--ink); border-radius: 14px; box-shadow: 0 3px 0 var(--ink); overflow: hidden;
  background: linear-gradient(#cdeeff, #fdfaf6 70%); position: relative; }
.soc-podium::before { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .7; background-image: radial-gradient(circle at 15% 20%, #fff 0 2px, transparent 3px), radial-gradient(circle at 82% 26%, #fff 0 3px, transparent 4px), radial-gradient(circle at 50% 10%, #fff 0 2px, transparent 3px); }
.soc-pod { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; position: relative; }
.soc-pod .soc-pn { font-size: 15px; font-weight: 700; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.soc-pod .soc-pv { font-size: 14px; display: inline-flex; align-items: center; gap: 2px; }
.soc-pod .soc-block { width: 100%; display: grid; place-items: start center; padding-top: 4px; border: var(--line) solid var(--ink); border-bottom: 0; border-radius: 8px 8px 0 0; font-size: 30px; color: #fff;
  text-shadow: 2px 0 var(--ink), -2px 0 var(--ink), 0 2px var(--ink), 0 -2px var(--ink); box-shadow: inset 0 6px 0 rgba(255,255,255,.35), inset -6px 0 0 rgba(61,47,42,.12); }
.soc-pod.p1 .soc-block { height: 86px; background: var(--gold); }
.soc-pod.p2 .soc-block { height: 62px; background: #c9d6ea; }
.soc-pod.p3 .soc-block { height: 46px; background: #e2b48e; }
.soc-pod .soc-crown { position: absolute; top: -18px; animation: socBob 1.4s steps(2) infinite; }
.soc-pod.empty .soc-av { opacity: .35; }
@keyframes socBob { 50% { transform: translateY(-3px); } }
.soc-rank { display: flex; flex-direction: column; gap: 6px; }
.soc-rrow { display: grid; grid-template-columns: 30px auto 1fr auto; gap: 8px; align-items: center; padding: 6px 10px; }
.soc-rrow.me { background: var(--gold-l); }
.soc-rrow .soc-pos { font-size: 20px; text-align: center; color: var(--ink-l); }
.soc-rrow b.v { font-size: 18px; display: inline-flex; align-items: center; gap: 3px; }
.soc-pb { display: inline-flex; align-items: center; gap: 3px; margin-top: 2px; padding: 0 6px; border: 2px solid var(--ink); border-radius: 6px; background: var(--primary); color: #fff; font-size: 12px; font-weight: 700; text-shadow: 0 1px 0 rgba(61,47,42,.4); animation: socPb 1.6s steps(2) infinite; }
@keyframes socPb { 50% { background: var(--second); } }
.soc-prize { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; }
.soc-prize .btn { grid-column: 1 / -1; }
/* Fase 7b: amenaza de un contacto (cuadrilla) y Expedición del día */
.soc-threat { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 1px 8px; border: 2px solid var(--ink); border-radius: 8px; background: var(--sky-l); font-size: 13px; font-weight: 700; }
.soc-acts .soc-crew { grid-column: 1 / -1; }
.soc-daily { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; align-items: center; }
.soc-daily > .btn, .soc-daily > .soc-dlist { grid-column: 1 / -1; }
.soc-dlist { display: grid; gap: 4px; }
.soc-drow { display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: center; padding: 4px 8px; border: 2px solid var(--ink); border-radius: 8px; background: #fff; font-size: 15px; }
.soc-drow.me { background: var(--gold-l); }
.soc-drow b.v { display: inline-flex; align-items: center; gap: 3px; }

/* ===== Equipo ===== */
.soc-coop-hero { display: grid; grid-template-columns: auto 1fr; gap: 10px 12px; align-items: center; background: linear-gradient(160deg, #ffe3c8, #fff7ee 70%); }
.soc-coop-hero h3 { font-size: 21px; }
.soc-site { width: 82px; height: 82px; border: var(--line) solid var(--ink); border-radius: 14px; background: linear-gradient(#bfe9ff 60%, #9ee06a 60%); display: grid; place-items: end center; padding-bottom: 6px; position: relative; overflow: hidden; }
.soc-site .pi { filter: drop-shadow(0 3px 0 rgba(61,47,42,.25)); }
.soc-track { position: relative; margin: 26px 22px 34px 8px; }
.soc-track-bar { height: 20px; border: var(--line) solid var(--ink); border-radius: 10px; background: #f6f0e8; overflow: hidden; box-shadow: 0 3px 0 var(--ink); }
.soc-track-bar i { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--gold) 0 8px, var(--gold-d) 8px 11px); transition: width .5s steps(8); }
.soc-step { position: absolute; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; }
.soc-step .soc-node { width: 40px; height: 40px; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 50%; background: #fff; box-shadow: 0 2px 0 var(--ink); }
.soc-step.reached .soc-node { background: var(--gold-l); }
.soc-step.claimable .soc-node { background: var(--gold); animation: socGlow 1s steps(2) infinite; }
.soc-step.claimed .soc-node { background: var(--mint-l); }
.soc-step small { position: absolute; top: 44px; white-space: nowrap; font-size: 12px; font-weight: 700; color: var(--ink-l); }
@keyframes socGlow { 50% { box-shadow: 0 0 0 4px #fff, 0 0 0 7px var(--gold-d); } }
.soc-tiers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.soc-tier { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border: var(--line) solid var(--ink); border-radius: 12px; background: #fff; box-shadow: 0 3px 0 var(--ink); text-align: center; min-width: 0; }
.soc-tier.claimable { background: var(--gold-l); }
.soc-tier.claimed { background: var(--mint-l); }
.soc-tier.locked { background: #f7f3ee; }
.soc-tier .soc-chips { justify-content: center; }
.soc-tier .soc-chip em { display: none; }
.soc-tier .btn { width: 100%; padding: 2px 4px; font-size: 14px; min-height: 32px; }
.soc-tier small { font-size: 12px; color: var(--ink-l); font-weight: 700; }
@media (max-width: 520px) { .soc-tiers { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; } .soc-tier { padding: 6px 2px; } .soc-tier .soc-chip { padding: 0 4px 0 2px; font-size: 12px; } }
.soc-mem { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; }
.soc-mem .soc-mbar { height: 10px; margin-top: 3px; border: 2px solid var(--ink); border-radius: 6px; background: #f6f0e8; overflow: hidden; }
.soc-mem .soc-mbar i { display: block; height: 100%; background: repeating-linear-gradient(90deg, var(--sky) 0 6px, var(--sky-d) 6px 8px); }
.soc-mem.me .soc-mbar i { background: repeating-linear-gradient(90deg, var(--primary) 0 6px, var(--primary-d) 6px 8px); }
.soc-how { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.soc-how div { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border: 2px solid var(--ink); border-radius: 10px; background: #fff; font-size: 14px; }
.soc-how b { margin-left: auto; color: var(--mint-d); }

/* ===== Editor de intercambio / pedidos (modales chicos) ===== */
.modal.soc-ed .modal-head { background: linear-gradient(var(--second), var(--second-d)); }
.modal.soc-ed { width: min(560px, 100%); }
.modal.soc-ed .modal-body { display: flex; flex-direction: column; gap: 10px; }
.soc-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: var(--line) solid var(--ink); border-radius: 12px; overflow: hidden; box-shadow: 0 3px 0 var(--ink); flex: none; }
.soc-seg button { border: 0; padding: 8px 6px; font-size: 16px; font-weight: 700; background: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 5px; }
.soc-seg button + button { border-left: var(--line) solid var(--ink); }
.soc-seg button.on { background: var(--second); color: #fff; text-shadow: 0 2px 0 rgba(61,47,42,.35); }
.soc-pickgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; max-height: 236px; overflow-y: auto; padding: 4px 2px 6px; touch-action: pan-y; overscroll-behavior: contain; }
.soc-pick { position: relative; padding: 0; border: 0; background: none; border-radius: 10px; }
.soc-pick .soc-stk { width: 100%; }
.soc-pick.on { outline: 4px solid var(--gold-d); outline-offset: 2px; }
.soc-pick.off { opacity: .35; filter: grayscale(.6); }
.soc-pick .soc-has { position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%); padding: 0 5px; border: 2px solid var(--ink); border-radius: 6px; background: var(--mint); font-size: 11px; font-weight: 700; white-space: nowrap; z-index: 2; }
.soc-pick .soc-cnt { position: absolute; right: -4px; top: -6px; padding: 0 5px; border: 2px solid var(--ink); border-radius: 6px; background: #fff; font-size: 12px; font-weight: 700; z-index: 2; }
.soc-pane-box { border: var(--line) solid var(--ink); border-radius: 14px; background: #fff; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 3px 0 var(--ink); }
.soc-pane-box.give { background: #fdfbf8; }
.soc-pane-box.get { background: #f4fbff; }
.soc-pane-box h5 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 6px; }
.soc-pane-box h5 small { margin-left: auto; font-size: 13px; color: var(--ink-l); }
.soc-step-row { display: grid; grid-template-columns: auto 1fr auto auto auto; gap: 6px; align-items: center; }
.soc-step-row > span:first-child { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; }
.soc-step-row b { min-width: 52px; text-align: center; font-size: 18px; }
.soc-step-row button { width: 34px; height: 34px; padding: 0; border: 2px solid var(--ink); border-radius: 8px; background: #fff; font-size: 20px; font-weight: 700; box-shadow: 0 2px 0 var(--ink); }
.soc-step-row button:disabled { opacity: .35; }
.soc-items { display: flex; flex-wrap: wrap; gap: 6px; }
.soc-item { position: relative; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px 3px 4px; border: 2px solid var(--ink); border-radius: 10px; background: #fff; font-size: 14px; font-weight: 700; box-shadow: 0 2px 0 var(--ink); }
.soc-item.on { background: var(--gold-l); outline: 3px solid var(--gold-d); }
.soc-item small { color: var(--ink-l); }
.soc-item:disabled { opacity: .4; }
.soc-rules { font-size: 13px; color: var(--ink-l); display: flex; flex-wrap: wrap; gap: 4px 10px; }
.soc-err { min-height: 18px; font-size: 14px; color: var(--primary-d); font-weight: 700; text-align: center; }
.soc-kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.soc-kind { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border: var(--line) solid var(--ink); border-radius: 12px; background: #fff; box-shadow: 0 3px 0 var(--ink); font-size: 15px; font-weight: 700; }
.soc-kind.on { background: var(--sky-l); outline: 3px solid var(--sky-d); }
.soc-kind:disabled { opacity: .45; }
.soc-kind small { font-weight: 400; color: var(--ink-l); font-size: 12px; }
.soc-fpick { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; touch-action: pan-y; }
.soc-fpick button { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border: var(--line) solid var(--ink); border-radius: 12px; background: #fff; box-shadow: 0 2px 0 var(--ink); text-align: left; font-size: 17px; }
.soc-fpick button small { display: block; font-size: 13px; color: var(--ink-l); }
.soc-fpick button .soc-tag { margin-left: auto; }

/* ===== Cuenta ===== */
.modal.soc-account { width: min(460px, 100%); }
.modal.soc-account .modal-head { background: linear-gradient(var(--sky), var(--sky-d)); color: var(--ink); }
.modal.soc-account .modal-head h2 { text-shadow: 0 2px 0 rgba(255,255,255,.5); }
.soc-form { display: flex; flex-direction: column; gap: 8px; }
.soc-form label { display: flex; flex-direction: column; gap: 3px; font-size: 15px; font-weight: 700; }
.soc-form input { width: 100%; padding: 9px 12px; font-size: 18px; border: var(--line) solid var(--ink); border-radius: 10px; background: #fff; color: var(--ink); outline: none; font-family: inherit; -webkit-user-select: text; user-select: text; }
.soc-form input:focus { border-color: var(--sky-d); box-shadow: 0 0 0 3px var(--sky-l); }
.soc-sync { display: flex; align-items: center; gap: 10px; }
.soc-sync .soc-cloud { width: 52px; height: 52px; display: grid; place-items: center; border: var(--line) solid var(--ink); border-radius: 50%; background: var(--sky-l); flex: none; }
.soc-sync.off .soc-cloud { background: #f0ece6; }
.soc-mock { display: inline-flex; align-items: center; gap: 4px; align-self: center; padding: 1px 8px; border: 2px dashed var(--ink); border-radius: 8px; background: var(--gold-l); font-size: 13px; font-weight: 700; }
.soc-off-art { display: flex; justify-content: center; gap: 6px; margin: 4px 0; }
.soc-off-art .pi { animation: socBob 1.6s steps(2) infinite; }
.soc-off-art .pi:nth-child(2) { animation-delay: .4s; } .soc-off-art .pi:nth-child(3) { animation-delay: .8s; }
.soc-cf { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.soc-cf .soc-card { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 10px 6px; }
.soc-cf .soc-card.rec { background: var(--gold-l); }
.soc-cf .soc-big { font-size: 34px; line-height: 1; }
.soc-cf dl { display: grid; grid-template-columns: auto auto; gap: 2px 6px; margin: 2px 0 6px; font-size: 15px; }
.soc-cf dt { display: inline-flex; align-items: center; gap: 3px; color: var(--ink-l); }
.soc-cf dd { margin: 0; font-weight: 700; text-align: left; }
.soc-cf .btn { width: 100%; white-space: normal; padding: 6px 8px; }
@media (prefers-reduced-motion: reduce) {
  html:not(.motion-full) :is(.soc-dots i, .soc-pod .soc-crown, .soc-pb, .soc-step.claimable .soc-node, .soc-off-art .pi) { animation: none !important; }
  html:not(.motion-full) .soc-busy::after { animation: none !important; }
}
`;
