// Juego de PC (Tauri, docs/PLAN-QUIEBRE.md §0). En el navegador todo esto queda apagado.
//   isDesktop        → true dentro del .exe/.app (o con ?desktop para probar el comportamiento en el navegador)
//   initDesktop(ctx) → pantalla completa con F11 (Ctrl+Cmd+F en Mac) y búsqueda de actualizaciones al arrancar
//   setFullscreen(on), isFullscreen() → los usa Ajustes
// La API de Tauri llega como window.__TAURI__ (withGlobalTauri en desktop/src-tauri/tauri.conf.json).
const T = () => window.__TAURI__ || null;
const params = new URLSearchParams(location.search);

export const isDesktop = !!(window.__TAURI__ || window.__TAURI_INTERNALS__) || params.has('desktop');
export const isMac = /Mac/.test(navigator.platform || navigator.userAgent);

const win = () => { try { return T()?.window?.getCurrentWindow?.() || null; } catch { return null; } };

export async function isFullscreen() {
  const w = win();
  if (w) { try { return await w.isFullscreen(); } catch {} }
  return !!document.fullscreenElement;
}

export async function setFullscreen(on) {
  const w = win();
  if (w) { try { await w.setFullscreen(!!on); return; } catch (e) { console.warn('[desktop] fullscreen', e); } }
  try { if (on) await document.documentElement.requestFullscreen(); else if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
}

async function toggleFullscreen() { await setFullscreen(!(await isFullscreen())); }

/** Busca una versión nueva en GitHub Releases; si hay, ofrece instalarla y reiniciar. */
async function checkUpdate(ctx) {
  const up = T()?.updater;
  if (!up?.check) return;
  let update = null;
  try { update = await up.check(); } catch (e) { console.warn('[desktop] update', e); return; }
  if (!update) return;
  const ok = await ctx.ui.confirm('Hay una versión nueva', `Pixelia ${update.version} ya está lista. Se baja, se instala y el juego se vuelve a abrir. Tu partida queda como está.`, 'Actualizar', 'Más tarde');
  if (!ok) return;
  ctx.ui.toast('Bajando la actualización…');
  try {
    ctx.store?.save?.();
    await update.downloadAndInstall();
    await T()?.process?.relaunch?.();
  } catch (e) {
    console.warn('[desktop] install', e);
    ctx.ui.toast('No se pudo actualizar. Probá de nuevo más tarde.');
  }
}

export function initDesktop(ctx) {
  if (!isDesktop) return;
  document.documentElement.classList.add('desktop');
  addEventListener('keydown', (e) => {
    const macFs = isMac && e.metaKey && e.ctrlKey && e.key.toLowerCase() === 'f';
    if (e.key === 'F11' || macFs) { e.preventDefault(); toggleFullscreen(); }
  });
  if (T()) setTimeout(() => checkUpdate(ctx), 8000);
}
