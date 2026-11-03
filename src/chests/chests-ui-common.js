// Utilidades compartidas de la UI de cofres: estilos inyectados (.chx-*), miniaturas de cofres
// (un solo WebGLRenderer offscreen, cacheadas como dataURL) y textos/HTML de premios.
import * as THREE from 'three';
import { addLights, disposeObject } from '../core/voxel.js';
import { icon } from '../core/icons.js';
import { fmtNum } from '../core/economy.js';
import { GAME_BY_ID } from '../core/data.js';
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
  return `--cc:${c.color};--ccd:${mix(c.color, '#3b2340', 0.35)};--ccl:${mix(c.color, '#ffffff', 0.7)};--ct:${c.trim};`;
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
  return `<span>x${d.amount || 1}</span>`;
}
export function dropNote(d) {
  if (d.converted) return 'Ya tenías todo: ¡te damos gemas!';
  const it = ITEMS[d.item];
  switch (d.kind) {
    case 'coins': return 'Monedas para tu ciudad';
    case 'gems': return '¡Gemas brillantes!';
    case 'xp': return 'Experiencia para subir de nivel';
    case 'item': return it?.use === 'game' ? `A tu mochila · para ${GAME_BY_ID[it.game]?.name || 'un juego'}` : 'Guardado en tu mochila';
    case 'cosmetic': return CAR_KINDS.has(d.cosmeticKind) ? 'Pieza nueva · estrenala en el Taller' : 'Prenda nueva · estrenala en el Vestidor';
    case 'build': return 'Construcción gratis · colocala desde Construir';
    case 'stickers': return d.fresh ? `¡${d.fresh === 1 ? 'Una nueva' : d.fresh + ' nuevas'} para tu Álbum!` : 'Repetidas · cambialas por brillitos';
    default: return '';
  }
}
/** Subtítulo corto del tipo de premio (arriba del nombre en la carta). */
export function dropKindLabel(d) {
  if (d.kind === 'cosmetic' || d.kind === 'build') return ITEMS[d.item]?.name || '';
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
  const url = thumbUrl(type);
  return `<img class="${cls}" data-thumb="${type}" src="${url || TRANSPARENT}" alt="" draggable="false">`;
}
const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
export function fillThumbs(root) {
  chestThumbs().then(urls => {
    for (const img of root.querySelectorAll('img[data-thumb]')) {
      const u = urls[img.dataset.thumb];
      if (u && img.src !== u) img.src = u;
    }
  });
}

function renderThumbs() {
  const N = 60; // px de render (se muestran agrandados con image-rendering: pixelated)
  let renderer = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true });
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
      thumbUrls[type] = outlined(cv);
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

/** Copia el render a un canvas 2D y le pone contorno tinta de 1px (look pixel art). */
function outlined(src) {
  const w = src.width, hgt = src.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = hgt;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, w, hgt), d = img.data;
  const solid = new Uint8Array(w * hgt);
  for (let i = 0; i < w * hgt; i++) {
    if (d[i * 4 + 3] > 90) {
      solid[i] = 1;
      d[i * 4 + 3] = 255;
    } else d[i * 4 + 3] = 0;
  }
  for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (solid[i]) continue;
    if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < hgt - 1 && solid[i + w])) {
      d[i * 4] = 59; d[i * 4 + 1] = 35; d[i * 4 + 2] = 64; d[i * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv.toDataURL();
}
