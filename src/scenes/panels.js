// Paneles de la ciudad: misiones, minijuegos, ajustes, ayuda, premio diario y subida de nivel.
// API: openPanel(ctx, name, params) -> Promise que resuelve cuando el panel se cierra.
import { openQuests } from './panels-quests.js';
import { openGames } from './panels-games.js';
import { openSettings, openHelp } from './panels-settings.js';
import { openLogin, openLevelUp } from './panels-rewards.js';
import { getOpen } from './panels-common.js';

const PANELS = {
  quests: openQuests,
  games: openGames,
  settings: openSettings,
  help: openHelp,
  login: openLogin,
  levelup: openLevelUp,
};

export async function openPanel(ctx, name, params = {}) {
  const fn = PANELS[name];
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
