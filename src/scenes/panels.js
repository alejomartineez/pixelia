// Paneles de la ciudad: misiones, Bitácora (historia, diario y Manual), ajustes, premio diario, subida de nivel, rango de la ciudad, obras,
// expedición (mapa de región y preparar la salida) y Taller.
// API: openPanel(ctx, name, params) -> Promise que resuelve cuando el panel se cierra.
import { openQuests } from './panels-quests.js';
import { openSettings } from './panels-settings.js';
import { openStory } from './panels-story.js';
import { openLogin, openLevelUp } from './panels-rewards.js';
import { openRank } from './panels-rank.js';
import { openWorks } from './panels-works.js';
import { openExpedition } from './panels-expedition.js';
import { openWorkshop } from './panels-workshop.js';
import { getOpen } from './panels-common.js';

const PANELS = {
  quests: openQuests,
  settings: openSettings,
  story: openStory,
  // "Cómo jugar" de antes: ahora es la pestaña Manual de la Bitácora
  help: (ctx, p) => openStory(ctx, { ...p, tab: 'manual' }),
  login: openLogin,
  levelup: openLevelUp,
  rank: openRank,
  works: openWorks,
  expedition: openExpedition,
  workshop: openWorkshop,
};

export async function openPanel(ctx, name, params = {}) {
  const fn = PANELS[name];
  ctx.bus.emit('panel:open', { name });
  if (!fn) { console.warn('[panels] panel desconocido:', name); ctx.ui.toast('Ese panel no existe'); return; }
  // las subidas de nivel se muestran de a una, en orden (aunque lleguen varias juntas)
  if (name === 'levelup') {
    const run = levelChain.then(() => fn(ctx, params || {}));
    levelChain = run.catch(() => {});
    return run;
  }
  // si ya está abierto, no se duplica: devolvemos la promesa del que está abierto
  const already = getOpen(name);
  if (already) return already.done;
  return fn(ctx, params || {});
}
let levelChain = Promise.resolve();
