// Ambiente de la expedición (PLAN-QUIEBRE §J1, J3–J5): la hora avanza con cada paso, de noche se ve menos (el Farol
// alumbra), el frente de clima se ve antes de llegar, y cuanto más lejos, más niebla y menos color. Además, polvo y
// huellas al caminar. Las reglas (visión, costo) viven en exp-rules.js (conditions); acá solo se dibuja y se avisa.
import * as THREE from 'three';
import { createAmbience } from '../core/ambience-fx.js';
import { expPlace, expEchoSpots, WEATHER } from '../core/ambience.js';
import { createParticles } from '../scenes/city-fx.js';
import { ringOf } from './exp-data.js';
import * as R from './exp-rules.js';

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
// ?hour= y ?weather= para las capturas (solo el dibujo: las reglas siguen la salida)
const Q_HOUR = qs.has('hour') ? Number(qs.get('hour')) : null;
const Q_WEATHER = qs.get('weather') && WEATHER[qs.get('weather')] ? qs.get('weather') : null;
const DAY_SKY = [['#9fb8c4', 0], ['#bccfd2', 40], ['#d3ddd6', 75], ['#d9e4dc', 100]];

export function createExpAmbience({ ctx, r, lights, world, cellPos, cellTop }) {
  const amb = createAmbience(r, { lights, sky: null, place: 'exp:cerca', fog: { near: 55, far: 67 },
    base: { sky: DAY_SKY, stars: 0, hemiSky: '#ffffff', hemiGround: '#a5b9ea', hemiI: 1.5, sun: '#fff3e6', sunI: 2.0 },
    onThunder: () => setTimeout(() => ctx.bus.emit('ambience:thunder', { place: 'exp' }), 300 + Math.random() * 900) });
  const fx = createParticles(r.scene);
  // el Farol: una luz cálida que sigue al grupo de noche (siempre en la escena, así los materiales no se recompilan)
  const lamp = new THREE.PointLight(0xffc46a, 0, 3.2, 1.6);
  r.scene.add(lamp);
  const prints = [];
  const printGeo = new THREE.PlaneGeometry(0.07, 0.11);
  const printMat = new THREE.MeshBasicMaterial({ color: 0x3a2e24, transparent: true, opacity: 0.35, depthWrite: false });
  let last = null, area = { x: 5, z: 6 };

  function sync(run) {
    if (!run) return null;
    const c = R.conditions(run);
    const here = run.cells[run.pos[1] * run.w + run.pos[0]];
    amb.set({ hour: Q_HOUR ?? c.hour, weather: Q_WEATHER ?? c.weather, place: expPlace(ringOf(here?.depth || 0)), region: run.region, light: ctx.state.world?.light ?? 1 },
      { now: !last });
    area = { x: run.w / 2 + 2, z: run.h / 2 + 2 };
    amb.setArea(area.x, area.z, 6);
    // avisos de lo que cambia (una vez por cambio)
    let say = null;
    if (last) {
      if (c.night && !last.night) say = c.farol ? 'Se hizo de noche. El Farol alumbra el camino.' : 'Se hizo de noche: visión −1. Con el Farol del Taller se ve igual que de día.';
      else if (c.weather !== last.weather && c.weather !== 'despejado') say = `${WEATHER[c.weather].name}. ${WEATHER[c.weather].exp?.text || 'No cambia nada del camino.'}`;
      else if (c.weather === 'despejado' && last.weather !== 'despejado') say = `Pasó la ${WEATHER[last.weather].name.toLowerCase()}.`;
      else if (c.forecast?.in === 2 && last.forecast?.in !== 2) say = `En 2 pasos llega ${art(c.forecast.kind)}.`;
    }
    last = c;
    return say;
  }
  const art = (k) => { const n = WEATHER[k].name.toLowerCase(); return (k === 'nieve' || k === 'niebla' || k === 'ceniza' || k === 'lluvia' || k === 'tormenta' ? 'la ' : 'el ') + n; };

  /** Polvo al pisar y huellas en la casilla que se deja (J5). */
  function step(from, to) {
    const a = cellPos(from[0], from[1]), b = cellPos(to[0], to[1]);
    const ya = cellTop(from[0], from[1]);
    fx.dust(b.x, cellTop(to[0], to[1]) + 0.05, b.z, 0.25);
    const dx = b.x - a.x, dz = b.z - a.z, ang = Math.atan2(dx, dz);
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(printGeo, printMat);
      m.rotation.set(-Math.PI / 2, 0, -ang);
      const side = i ? 0.07 : -0.07, fwd = i ? 0.12 : -0.08;
      m.position.set(a.x + Math.cos(ang) * side + Math.sin(ang) * fwd, ya + 0.012, a.z - Math.sin(ang) * side + Math.cos(ang) * fwd);
      m.renderOrder = 4;
      world.add(m); prints.push(m);
    }
    while (prints.length > 48) world.remove(prints.shift());
  }

  return {
    amb, sync, step,
    get conditions() { return last; },
    update(dt, partyPos) {
      fx.update(dt);
      const look = amb.look;
      const wantLamp = !!(last?.night && last?.farol) || (Q_HOUR != null && look?.night);
      lamp.intensity += ((wantLamp ? 2.4 : 0) - lamp.intensity) * Math.min(1, dt * 2);
      if (partyPos) lamp.position.set(partyPos.x, partyPos.y + 0.9, partyPos.z + 0.2);
      amb.update(dt, { x: 0, z: 0 });
    },
    /** Ruinas pisadas donde puede aparecer un eco de noche (L6, los hace el paso 6). */
    echoSpots(run) { return last?.night ? expEchoSpots(run) : []; },
    reset() { last = null; prints.length = 0; },
    dispose() { fx.dispose(); r.scene.remove(lamp); printGeo.dispose(); printMat.dispose(); amb.dispose(); },
  };
}
