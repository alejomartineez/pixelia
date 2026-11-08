// Juego de PC (Tauri, docs/PLAN-QUIEBRE.md §0). En el navegador todo esto queda apagado.
//   isDesktop        → true dentro del .exe/.app (o con ?desktop para probar el comportamiento en el navegador)
//   initDesktop(ctx) → pantalla completa con F11 (Ctrl+Cmd+F en Mac) y búsqueda de actualizaciones al arrancar
//   setFullscreen(on), isFullscreen() → los usa Ajustes
//   applyWindow(settings) → ventana / pantalla completa / sin bordes y resolución (Ajustes → Pantalla)
//   monitorInfo()   → tamaño lógico del monitor (para no ofrecer resoluciones que no entran)
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

const dpi = () => T()?.dpi || T()?.window || {};

/** { w, h, scale, x, y } del monitor donde está la ventana (w y h lógicos), o null fuera del juego de PC. */
export async function monitorInfo() {
  const cm = T()?.window?.currentMonitor;
  if (!cm) return null;
  try {
    const m = await cm();
    if (!m) return null;
    const sc = m.scaleFactor || 1;
    const area = m.workArea || { size: m.size, position: m.position };
    return { w: Math.round(m.size.width / sc), h: Math.round(m.size.height / sc), scale: sc, x: m.position.x, y: m.position.y,
      pw: m.size.width, ph: m.size.height, aw: Math.round(area.size.width / sc), ah: Math.round(area.size.height / sc) };
  } catch (e) { console.warn('[desktop] monitor', e); return null; }
}

let lastMode = null;
/** Ventana del tamaño pedido (lógico) sin pasarse del área útil del monitor, centrada. */
async function sizeWindow(w, W, H) {
  const m = await monitorInfo();
  const { LogicalSize } = dpi();
  if (!LogicalSize) return;
  if (m) { W = Math.min(W, Math.floor(m.aw * 0.94)); H = Math.min(H, Math.floor((m.ah - 34) * 0.96)); }
  await w.setSize(new LogicalSize(W, H));
  await w.center();
}

/** Aplica settings.winMode ('window' | 'fullscreen' | 'borderless') y settings.winRes ('auto' | '1600x900'…). */
export async function applyWindow(s) {
  const w = win();
  if (!w) {
    // navegador: solo pantalla completa (la pide un clic en Ajustes; sin gesto el navegador la rechaza)
    try {
      if (s.winMode === 'window') { if (document.fullscreenElement) await document.exitFullscreen(); }
      else if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {}
    return;
  }
  try {
    const mode = s.winMode;
    if (mode === 'fullscreen') {
      await w.setDecorations(true);
      await w.setFullscreen(true);
    } else if (mode === 'borderless') {
      if (await w.isFullscreen()) await w.setFullscreen(false);
      await w.setDecorations(false);
      const m = await monitorInfo();
      const { PhysicalSize, PhysicalPosition } = dpi();
      if (m && PhysicalSize && PhysicalPosition) {
        await w.setPosition(new PhysicalPosition(m.x, m.y));
        await w.setSize(new PhysicalSize(m.pw, m.ph));
      } else await w.maximize?.();
    } else {
      if (await w.isFullscreen()) await w.setFullscreen(false);
      await w.setDecorations(true);
      const [W, H] = /^\d+x\d+$/.test(s.winRes || '') ? s.winRes.split('x').map(Number) : [1280, 800];
      // al volver de sin bordes, o con una resolución elegida, se acomoda; en 'auto' se respeta lo que estiró el jugador
      if (s.winRes !== 'auto' || lastMode === 'borderless') await sizeWindow(w, W, H);
    }
    lastMode = mode;
  } catch (e) { console.warn('[desktop] ventana', e); }
}

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
  const s = ctx.state.settings;
  // lo que quedó elegido en Ajustes → Pantalla se recupera al abrir (la ventana arranca ya ajustada al monitor, lib.rs)
  if (win() && (s.winMode !== 'window' || s.winRes !== 'auto')) applyWindow(s);
  lastMode = s.winMode;
  const remember = (mode) => { if (ctx.state.settings.winMode !== mode) ctx.setSetting?.({ winMode: mode }, { fromWindow: true }); };
  addEventListener('keydown', async (e) => {
    const macFs = isMac && e.metaKey && e.ctrlKey && e.key.toLowerCase() === 'f';
    if (e.key === 'F11' || macFs) {
      e.preventDefault();
      const on = !(await isFullscreen());
      await setFullscreen(on);
      remember(on ? 'fullscreen' : (lastMode === 'borderless' ? 'borderless' : 'window'));
      if (!on && lastMode === 'borderless') applyWindow(ctx.state.settings);
      else lastMode = on ? 'fullscreen' : 'window';
    }
  });
  // el botón verde de la Mac (o salir de pantalla completa por el sistema) también queda recordado
  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(async () => {
      const fs = await isFullscreen(), mode = ctx.state.settings.winMode;
      if (fs && mode !== 'fullscreen') { lastMode = 'fullscreen'; remember('fullscreen'); }
      else if (!fs && mode === 'fullscreen') { lastMode = 'window'; remember('window'); }
    }, 400);
  });
  if (T()) setTimeout(() => checkUpdate(ctx), 8000);
}
