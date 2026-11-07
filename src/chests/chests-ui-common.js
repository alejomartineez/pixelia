// Utilidades compartidas de la UI de cofres: estilos inyectados (.chx-*), miniaturas de cofres
// (un solo WebGLRenderer offscreen, registradas como íconos nítidos) y textos/HTML de premios.
import * as THREE from 'three';
import { addLights, disposeObject, outlineCanvas } from '../core/voxel.js';
import { icon, iconUrl, registerIcon, watchIcon } from '../core/icons.js';
import { fmtNum } from '../core/economy.js';
import { CHESTS, RARITIES, ITEMS } from './chests.js';
import { chestModel } from './chest-model.js';
import { CHX_CSS } from './chests-ui-style.js';

// ---------- Estilos ----------
export function injectStyle() {
  if (document.getElementById('chests-style')) return;
  const st = document.createElement('style');
  st.id = 'chests-style';
  st.textContent = CHX_CSS;
  document.head.append(st);
}

// ---------- Colores ----------
const toRgb = (hex) => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function mix(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
/** Variables CSS de una rareza: --rc (color), --rcd (oscuro), --rcl (claro) */
export function rarityVars(rid) {
  const r = RARITIES[rid] || RARITIES.comun;
  return `--rc:${r.color};--rcd:${r.dark};--rcl:${mix(r.color, '#ffffff', 0.72)};`;
}
/** Variables CSS de un tipo de cofre: --cc, --ccd, --ccl */
export function chestVars(type) {
  const c = CHESTS[type] || CHESTS.madera;
  return `--cc:${c.color};--ccd:${mix(c.color, '#3d2f2a', 0.35)};--ccl:${mix(c.color, '#ffffff', 0.7)};--ct:${c.trim};`;
}
export function bestRarity(drops) {
  let best = 'comun';
  for (const d of drops) if ((RARITIES[d.rarity]?.order ?? 0) > RARITIES[best].order) best = d.rarity;
  return best;
}

// ---------- Textos de premios ----------
const CAR_KINDS = new Set(['body', 'wheels', 'topper']);
export function dropAmountHtml(d, size = 28) {
  if (d.kind === 'coins') return `${icon('coin', size)}<span>+${fmtNum(d.amount)}</span>`;
  if (d.kind === 'gems') return `${icon('gem', size)}<span>+${fmtNum(d.amount)}</span>`;
  if (d.kind === 'xp') return `${icon('xp', size)}<span>+${fmtNum(d.amount)}</span>`;
  if (d.kind === 'cosmetic') return `<span>¡Nueva!</span>`;
  if (d.kind === 'material') return `${icon(d.icon, size)}<span>+${fmtNum(d.amount)}</span>`;
  return `<span>x${d.amount || 1}</span>`;
}
export function dropNote(d) {
  if (d.converted) return 'Ya tenías todo: va en gemas';
  const it = ITEMS[d.item];
  switch (d.kind) {
    case 'coins': return 'Monedas para tu ciudad';
    case 'gems': return 'Gemas';
    case 'xp': return 'Experiencia para subir de nivel';
    case 'item': return 'Guardado en tu mochila';
    case 'equip': return 'Equipo para tus expediciones · se elige al salir';
    case 'cosmetic': return CAR_KINDS.has(d.cosmeticKind) ? 'Pieza nueva · estrenala en el Vestidor' : 'Prenda nueva · estrenala en el Vestidor';
    case 'build': return 'Construcción gratis · colocala desde Construir';
    case 'material': return 'Material de región · para tus obras y el Taller';
    case 'furniture': return 'Para tu casa · ponelo desde Decorar';
    case 'stickers': return d.fresh ? `¡${d.fresh === 1 ? 'Uno nuevo' : d.fresh + ' nuevos'} para tus Hallazgos!` : 'Repetidos · se cambian en Hallazgos';
    default: return '';
  }
}
/** Subtítulo corto del tipo de premio (arriba del nombre en la carta). */
export function dropKindLabel(d) {
  if (d.kind === 'cosmetic' || d.kind === 'build' || d.kind === 'furniture') return ITEMS[d.item]?.name || '';
  return '';
}

// ---------- Miniaturas de cofres ----------
const thumbUrls = {};
let thumbJob = null;
/** dataURL ya cacheado (o null si todavía no se renderizó). */
export const thumbUrl = (type) => thumbUrls[type] || null;
/** Renderiza (una sola vez) las miniaturas de todos los cofres. Promise<{type: dataURL}> */
export function chestThumbs() {
  if (!thumbJob) thumbJob = new Promise(res => setTimeout(() => res(renderThumbs()), 0));
  return thumbJob;
}
/** Img de un cofre: si la miniatura no está lista, se completa sola cuando termine. */
export function thumbImg(type, cls = 'chx-thumb') {
  // lista: <img data-pi> que icons.js ajusta a sus pixeles físicos exactos (sin deformar los pixeles)
  if (thumbUrl(type)) return `<img class="${cls}" data-pi="${THUMB_ICON + type}" src="${iconUrl(THUMB_ICON + type, 96)}" alt="" draggable="false">`;
  return `<img class="${cls}" data-thumb="${type}" src="${TRANSPARENT}" alt="" draggable="false">`;
}
const THUMB_ICON = 'chest3d-';
const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
export function fillThumbs(root) {
  chestThumbs().then(urls => {
    for (const img of root.querySelectorAll('img[data-thumb]')) {
      const type = img.dataset.thumb;
      if (!urls[type]) continue;
      img.removeAttribute('data-thumb');
      img.dataset.pi = THUMB_ICON + type;
      img.src = iconUrl(THUMB_ICON + type, img.clientWidth || 96);
      watchIcon(img);
    }
  });
}

function renderThumbs() {
  const N = 216; // px de render (icons.js lo achica suavizando al tamaño real de pantalla)
  let renderer = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(N, N, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    addLights(scene);
    const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 60);
    for (const type of Object.keys(CHESTS)) {
      const g = chestModel(type);
      g.rotation.y = -0.5;
      g.userData.update?.(0, 0.75);
      const hgt = g.userData.height;
      const cy = hgt * 0.5 - 0.04;
      const dist = 3.7 + (hgt - 0.8) * 1.6;
      cam.position.set(0, cy + dist * 0.38, dist * 0.93);
      cam.lookAt(0, cy, 0);
      scene.add(g);
      renderer.render(scene, cam);
      registerIcon(THUMB_ICON + type, outlineCanvas(cv, 5));
      thumbUrls[type] = THUMB_ICON + type;
      scene.remove(g);
      disposeObject(g);
    }
  } catch (e) {
    console.warn('[chests] miniaturas', e);
  } finally {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss?.(); }
  }
  return thumbUrls;
}

