// Vida de la ciudad: vecinas que pasean, el personaje del jugador, el esquife amarrado y mariposas.
import * as THREE from 'three';
import { Voxels, disposeObject } from '../core/voxel.js';
import { avatarModel, randomLook } from '../avatar/avatar.js';
import { heldGear } from '../core/gear.js';
import { skiffModel } from '../avatar/skiff.js';
import { themeOf } from '../city/themes.js';
import { footprint, def, isConstructing, landBounds } from '../core/economy.js';
import { MAP, HALF, ROAD_H, angleDelta, mulberry } from './city-common.js';

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NPC_SCALE = 0.55, PLAYER_SCALE = 0.7, CAR_SCALE = 0.62;

/** Grilla de ocupación para caminar. */
export function buildGrid(state) {
  const occ = new Int32Array(MAP * MAP);
  const road = new Uint8Array(MAP * MAP);
  for (const b of state.city.buildings) {
    const [w, d] = footprint(b.id, b.rot);
    const isRoad = def(b).cat === 'camino' && !isConstructing(b);
    for (let x = b.x; x < b.x + w; x++) for (let z = b.z; z < b.z + d; z++) {
      if (x < 0 || z < 0 || x >= MAP || z >= MAP) continue;
      occ[x * MAP + z] = b.uid;
      if (isRoad) road[x * MAP + z] = 1;
    }
  }
  return { occ, road, land: landBounds(state), roads: road.reduce((a, v) => a + v, 0) };
}

export function createLife(r, ctx) {
  const group = new THREE.Group();
  group.name = 'life';
  r.scene.add(group);
  let grid = buildGrid(ctx.state);
  const rnd = mulberry(Date.now() & 0xffff);
  const inLand = (x, z) => x >= grid.land.min && x < grid.land.max && z >= grid.land.min && z < grid.land.max;
  const isRoad = (x, z) => inLand(x, z) && grid.road[x * MAP + z] === 1;
  const walkable = (x, z) => inLand(x, z) && (grid.occ[x * MAP + z] === 0 || grid.road[x * MAP + z] === 1);
  const center = (x) => x + 0.5 - HALF;

  // ---------- Caminantes ----------
  function makeWalker(obj, o = {}) {
    const w = { obj, fx: 0, fz: 0, tx: 0, tz: 0, px: -1, pz: -1, t: 0, speed: o.speed || 0.8, idle: rnd() * 2, region: o.region || null, roadOnly: !!o.roadOnly,
      lane: o.lane || [(rnd() - 0.5) * 0.36, (rnd() - 0.5) * 0.36], moving: false, heading: rnd() * 6.28, turnRate: o.turnRate || 9, appear: 0, kind: o.kind || 'npc' };
    return w;
  }
  const ok = (w, x, z) => (w.roadOnly ? isRoad(x, z) : walkable(x, z)) && (!w.region || w.region(x, z));
  function place(w, x, z) {
    w.fx = w.tx = x; w.fz = w.tz = z; w.px = w.pz = -1; w.t = 1;
    w.obj.position.set(center(x) + w.lane[0], isRoad(x, z) ? ROAD_H : 0, center(z) + w.lane[1]);
  }
  function randomTile(filter, tries = 300) {
    const { min, max } = grid.land;
    for (let i = 0; i < tries; i++) {
      const x = min + Math.floor(rnd() * (max - min)), z = min + Math.floor(rnd() * (max - min));
      if (filter(x, z)) return [x, z];
    }
    return null;
  }
  function chooseNext(w) {
    let opts = NB.map(([dx, dz]) => [w.fx + dx, w.fz + dz]).filter(([x, z]) => ok(w, x, z));
    if (!opts.length) return null;
    const noBack = opts.filter(([x, z]) => !(x === w.px && z === w.pz));
    if (noBack.length && (w.roadOnly || rnd() < 0.85)) opts = noBack;
    if (!w.roadOnly) {
      const roads = opts.filter(([x, z]) => isRoad(x, z));
      const onRoad = isRoad(w.fx, w.fz);
      if (roads.length && rnd() < (onRoad ? 0.9 : 0.6)) opts = roads;
    }
    // preferir seguir derecho
    const sx = w.fx - w.px, sz = w.fz - w.pz;
    const straight = opts.find(([x, z]) => x - w.fx === sx && z - w.fz === sz);
    if (straight && rnd() < (w.roadOnly ? 0.6 : 0.45)) return straight;
    return opts[Math.floor(rnd() * opts.length)];
  }
  function stepWalker(w, dt) {
    if (w.idle > 0) {
      w.idle -= dt;
      w.moving = false;
    } else {
      w.t += dt * w.speed;
      if (w.t >= 1) {
        w.px = w.fx; w.pz = w.fz; w.fx = w.tx; w.fz = w.tz;
        if (!ok(w, w.fx, w.fz) && !(w.kind === 'car')) {
          const t = w.region ? randomTile((x, z) => ok(w, x, z)) : randomTile((x, z) => walkable(x, z));
          if (t) { place(w, t[0], t[1]); w.appear = 0; }
        }
        const nx = (w.kind === 'npc' && rnd() < 0.07) || (w.kind === 'player' && rnd() < 0.18) ? null : chooseNext(w);
        if (nx) { w.tx = nx[0]; w.tz = nx[1]; w.t = 0; }
        else { w.tx = w.fx; w.tz = w.fz; w.t = 1; w.idle = w.kind === 'car' ? 2 : 1.2 + rnd() * 3; }
      }
      w.moving = w.t < 1 && (w.tx !== w.fx || w.tz !== w.fz);
    }
    const t = Math.min(1, w.t);
    const ax = center(w.fx), az = center(w.fz), bx = center(w.tx), bz = center(w.tz);
    const x = ax + (bx - ax) * t + w.lane[0], z = az + (bz - az) * t + w.lane[1];
    const ya = isRoad(w.fx, w.fz) ? ROAD_H : 0, yb = isRoad(w.tx, w.tz) ? ROAD_H : 0;
    w.obj.position.set(x, ya + (yb - ya) * t, z);
    if (w.moving) w.heading = Math.atan2(bx - ax, bz - az);
    else if (w.kind !== 'car' && w.idle > 0 && w.idle < 0.6) w.heading = camFacing;
    w.obj.rotation.y += angleDelta(w.obj.rotation.y, w.heading) * Math.min(1, dt * w.turnRate);
    if (w.appear < 1) { w.appear = Math.min(1, w.appear + dt * 3); const s = w.baseScale * (0.3 + 0.7 * w.appear); w.obj.scale.setScalar(s); }
  }
  let camFacing = Math.PI / 4;

  // ---------- Vecinas ----------
  /** Solo las piezas grandes (vestido, cabeza) proyectan sombra: misma silueta, muchas menos pasadas de sombra. */
  function lightShadows(obj, keep = 2) {
    const ms = [];
    obj.traverse(o => { if (o.isMesh && o.castShadow) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); ms.push(o); } });
    ms.sort((a, b) => (b.geometry.boundingSphere?.radius || 0) - (a.geometry.boundingSphere?.radius || 0));
    for (const o of ms.slice(keep)) o.castShadow = false;
  }
  const npcs = [];
  let lookSeed = 1;
  function targetNpcCount() { return Math.min(16, Math.floor(ctx.economy.population() / 5)); }
  function spawnNpc() {
    const obj = avatarModel(randomLook(lookSeed * 7919 + 17), { npc: true });
    lightShadows(obj);
    lookSeed++;
    const w = makeWalker(obj, { speed: 0.65 + rnd() * 0.35 });
    w.baseScale = NPC_SCALE;
    obj.scale.setScalar(0.01);
    // aparecer en la puerta de una casa si se puede
    let spot = null;
    const houses = ctx.state.city.buildings.filter(b => def(b).cat === 'casa' && !isConstructing(b));
    if (houses.length) {
      const h = houses[Math.floor(rnd() * houses.length)];
      const [hw, hd] = footprint(h.id, h.rot);
      const cand = [];
      for (let x = h.x - 1; x <= h.x + hw; x++) for (let z = h.z - 1; z <= h.z + hd; z++) if (walkable(x, z) && !grid.occ[x * MAP + z]) cand.push([x, z]);
      for (let x = h.x - 1; x <= h.x + hw; x++) for (let z = h.z - 1; z <= h.z + hd; z++) if (isRoad(x, z)) cand.push([x, z]);
      if (cand.length) spot = cand[Math.floor(rnd() * cand.length)];
    }
    spot = spot || randomTile((x, z) => isRoad(x, z)) || randomTile(walkable);
    if (!spot) { disposeObject(obj); return false; }
    place(w, spot[0], spot[1]);
    w.idle = 0.3 + rnd();
    group.add(obj);
    npcs.push(w);
    return true;
  }
  function syncNpcs() {
    const n = targetNpcCount();
    let guard = 0;
    while (npcs.length < n && guard++ < 20) if (!spawnNpc()) break;
    while (npcs.length > n) { const w = npcs.pop(); group.remove(w.obj); disposeObject(w.obj); }
  }

  // ---------- Personaje del jugador ----------
  let player = null;
  function castleRegion() {
    const c = ctx.state.city.buildings.find(b => b.id === 'castillo');
    if (!c) return null;
    const [w, d] = footprint(c.id, c.rot);
    return (x, z) => {
      const dx = x < c.x ? c.x - x : x >= c.x + w ? x - (c.x + w - 1) : 0;
      const dz = z < c.z ? c.z - z : z >= c.z + d ? z - (c.z + d - 1) : 0;
      const m = Math.max(dx, dz);
      return m >= 1 && m <= 2;
    };
  }
  function buildPlayer() {
    let prevPos = null;
    if (player) { prevPos = [player.fx, player.fz]; group.remove(player.obj); disposeObject(player.obj); }
    // con el arma o la herramienta de su clase en la mano (paso 5b, tercera parte); la ropa es la del Equipaje
    // y el arma equipada del Arsenal (paso 2a), si tiene una: manda sobre la de su clase
    const obj = avatarModel(ctx.state.avatar, { player: true, clsGear: ctx.state.classes?.leader?.cls || null, gear: heldGear('lider', ctx.state) || undefined });
    // aro de luz bajo los pies: en los temas oscuros el personaje no se pierde contra el piso
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.62, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.012; glow.renderOrder = -1;
    glow.visible = !!themeOf(ctx.state.city?.theme).dark;
    obj.add(glow); obj.userData.glow = glow;
    const w = makeWalker(obj, { speed: 0.55, region: castleRegion(), lane: [0, 0], turnRate: 7 });
    w.kind = 'player';
    w.baseScale = PLAYER_SCALE;
    obj.scale.setScalar(prevPos ? PLAYER_SCALE : 0.01);
    w.appear = prevPos ? 1 : 0;
    const spot = (prevPos && ok(w, prevPos[0], prevPos[1]) && prevPos) || randomTile((x, z) => ok(w, x, z)) || randomTile(walkable);
    if (spot) place(w, spot[0], spot[1]);
    group.add(obj);
    player = w;
  }

  // ---------- El esquife (plan §M5) ----------
  // Vive amarrado al muelle del Establo (un poste con la soga y dos tablas en el borde de la parcela): flota y se mece.
  // Cada tanto suelta amarras, da una vuelta alrededor de la isla por fuera del borde, a la altura de los techos, y
  // vuelve a amarrar. No anda por las calles.
  let car = null;
  const SKIFF_Y = 0.12, LAP_Y = 1.6;
  function dockSpot(garage) {
    const [gw, gd] = footprint(garage.id, garage.rot);
    const cand = [];
    for (let x = garage.x - 1; x <= garage.x + gw; x++) for (let z = garage.z - 1; z <= garage.z + gd; z++) {
      const inside = x >= garage.x && x < garage.x + gw && z >= garage.z && z < garage.z + gd;
      if (!inside && inLand(x, z) && grid.occ[x * MAP + z] === 0) cand.push([x, z]);
    }
    // mejor del lado de adelante (z más grande) y lejos de los caminos
    cand.sort((a, b) => (b[1] === garage.z + gd) - (a[1] === garage.z + gd) || isRoad(a[0], a[1]) - isRoad(b[0], b[1]));
    return cand[0] || null;
  }
  function makeDock() {
    const v = new Voxels();
    v.box(0, 0, 0, 2, 14, 2, (x, y) => (y === 13 ? '#6a5434' : y % 5 === 0 ? '#4a4e56' : '#3e2e20'));   // poste
    v.box(-1, 10, -1, 4, 1, 4, '#9a8460');   // soga enrollada
    v.box(-4, 0, 3, 10, 1, 3, (x) => ((x + 9) % 3 === 0 ? '#3e2e20' : '#5a4430'));   // dos tablas de muelle
    return new THREE.Mesh(v.toGeometry({ scale: 1 / 24, jitter: 0 }), new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
  function syncCar() {
    const garage = ctx.state.city.buildings.find(b => b.id === 'establo' && !isConstructing(b));   // el esquife amarra en el muelle del Establo
    const spot = garage && dockSpot(garage);
    if (!spot) { if (car) { group.remove(car.obj, car.dock); disposeObject(car.obj); disposeObject(car.dock); car = null; } return; }
    if (!car) {
      const obj = skiffModel(ctx.state.car, { city: true });
      obj.scale.setScalar(CAR_SCALE);
      const dock = makeDock();
      dock.castShadow = true; dock.receiveShadow = true;
      car = { obj, dock, kind: 'car', baseScale: CAR_SCALE, state: 'moored', t: 0, wait: 25 + rnd() * 20, heading: 0, speed: 0, path: null };
      group.add(obj, dock);
    }
    car.home = [center(spot[0]), center(spot[1])];
    car.dock.position.set(car.home[0], 0, car.home[1] - 0.5);   // el poste queda al costado del casco
    if (car.state === 'moored') { car.obj.position.set(car.home[0], SKIFF_Y, car.home[1]); car.obj.rotation.y = Math.PI / 2; car.heading = Math.PI / 2; }
  }
  function rebuildCar() { if (car) { group.remove(car.obj, car.dock); disposeObject(car.obj); disposeObject(car.dock); car = null; } syncCar(); }
  /** Vuelta a la isla: sube, sale al borde más cercano, rodea la parcela por fuera y vuelve al muelle. */
  function lapPath() {
    const m = 1.6, a = grid.land.min - HALF - m, b = grid.land.max - HALF + m;
    const corners = [[a, a], [b, a], [b, b], [a, b]];
    const [hx, hz] = car.home;
    let k = 0, best = Infinity;
    corners.forEach(([x, z], i) => { const d = Math.hypot(x - hx, z - hz); if (d < best) { best = d; k = i; } });
    const pts = [[hx, LAP_Y, hz]];
    for (let i = 0; i <= 4; i++) { const [x, z] = corners[(k + i) % 4]; pts.push([x, LAP_Y, z]); }
    pts.push([hx, LAP_Y, hz], [hx, SKIFF_Y, hz]);
    return pts;
  }
  function stepSkiff(dt) {
    const c = car;
    c.t += dt;
    if (c.state === 'moored') {
      c.speed = 0;
      if ((c.wait -= dt) <= 0) { c.state = 'lap'; c.path = lapPath(); c.seg = -1; }   // el primer tramo es subir
    } else {
      const [x, y, z] = c.path[c.seg + 1], p = c.obj.position;
      const dx = x - p.x, dy = y - p.y, dz = z - p.z, d = Math.hypot(dx, dy, dz);
      const v = (Math.abs(dx) + Math.abs(dz) < 0.01 ? 0.5 : 1.8);
      if (d < 0.05) {
        c.seg++;
        if (c.seg >= c.path.length - 1) { c.state = 'moored'; c.wait = 40 + rnd() * 40; c.obj.position.set(c.home[0], SKIFF_Y, c.home[1]); }
      } else {
        const s = Math.min(d, v * dt);
        p.x += dx / d * s; p.y += dy / d * s; p.z += dz / d * s;
        if (Math.abs(dx) + Math.abs(dz) > 0.01) c.heading = Math.atan2(dx, dz);
      }
      c.speed = v;
    }
    // al amarrar vuelve a quedar de costado al muelle
    const want = c.state === 'moored' ? Math.PI / 2 : c.heading;
    const turn = angleDelta(c.obj.rotation.y, want);
    c.obj.rotation.y += turn * Math.min(1, dt * 2);
    c.obj.userData.update?.(dt, c.speed, Math.max(-1, Math.min(1, turn * 2)));
  }

  // ---------- Mariposas ----------
  const butterflies = [];
  const wingGeos = [];
  {
    const COLS = [['#f1a181', '#ffffff'], ['#c3d1f1', '#fff0c2'], ['#ffd166', '#ffffff'], ['#8fd3ff', '#ffffff'], ['#ffb38a', '#ffffff']];
    const bodyV = new Voxels(); bodyV.box(0, 0, 0, 1, 1, 3, '#3d2f2a');
    const bodyGeo = bodyV.toGeometry({ scale: 1 / 14, center: 'xyz', jitter: 0 });
    wingGeos.push(bodyGeo);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const geos = COLS.map(([a, b]) => {
      const v = new Voxels();
      v.box(0, 0, 0, 3, 1, 3, a); v.box(0, 0, 3, 2, 1, 1, a); v.set(1, 0, 1, b);
      const g = v.toGeometry({ scale: 1 / 14, jitter: 0 });
      g.translate(0, 0, -2 / 14);
      wingGeos.push(g);
      return g;
    });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const geo = geos[i % geos.length];
      const body = new THREE.Mesh(bodyGeo, mat);
      const L = new THREE.Group(), R = new THREE.Group();
      const wl = new THREE.Mesh(geo, mat), wr = new THREE.Mesh(geo, mat);
      wl.position.x = 0.02; wr.scale.x = -1; wr.position.x = -0.02;
      L.add(wl); R.add(wr);
      g.add(body, L, R);
      g.userData = { L, R, phase: rnd() * 10, cx: 0, cz: 0, rad: 0.8 + rnd() * 1.2, t: rnd() * 20, retarget: 0 };
      group.add(g);
      butterflies.push(g);
    }
    wingGeos.mat = mat;
  }
  function retargetButterfly(b) {
    const land = grid.land;
    const span = land.max - land.min + 6;
    b.userData.cx = (land.min - 3 + rnd() * span) - HALF;
    b.userData.cz = (land.min - 3 + rnd() * span) - HALF;
    b.userData.retarget = 8 + rnd() * 10;
  }
  butterflies.forEach(retargetButterfly);
  const prev = new THREE.Vector3();

  function update(dt, t) {
    for (const w of npcs) { stepWalker(w, dt); w.obj.userData.update?.(dt, w.moving); }
    if (player) {
      stepWalker(player, dt); player.obj.userData.update?.(dt, player.moving);
      const glow = player.obj.userData.glow;
      if (glow) glow.visible = !!themeOf(ctx.state.city?.theme).dark; // el tema cambia en vivo
    }
    if (car) stepSkiff(dt);
    for (const b of butterflies) {
      const u = b.userData;
      u.t += dt;
      u.retarget -= dt;
      if (u.retarget <= 0) retargetButterfly(b);
      prev.copy(b.position);
      const tx = u.cx + Math.sin(u.t * 0.7 + u.phase) * u.rad, tz = u.cz + Math.cos(u.t * 0.9 + u.phase) * u.rad;
      b.position.x += (tx - b.position.x) * Math.min(1, dt * 1.5);
      b.position.z += (tz - b.position.z) * Math.min(1, dt * 1.5);
      b.position.y = 0.55 + Math.sin(u.t * 2.3 + u.phase) * 0.18 + Math.sin(u.t * 9) * 0.03;
      const dx = b.position.x - prev.x, dz = b.position.z - prev.z;
      if (dx * dx + dz * dz > 1e-6) b.rotation.y += angleDelta(b.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      const flap = Math.sin(u.t * 22 + u.phase) * 1.0;
      u.L.rotation.z = flap; u.R.rotation.z = -flap;
    }
  }

  function refreshGrid() {
    grid = buildGrid(ctx.state);
    if (player) player.region = castleRegion();
    for (const w of npcs) if (!walkable(w.fx, w.fz) || (w.tx !== w.fx || w.tz !== w.fz) && !walkable(w.tx, w.tz)) {
      const s = randomTile((x, z) => isRoad(x, z)) || randomTile(walkable);
      if (s) { place(w, s[0], s[1]); w.appear = 0; }
    }
    if (player && (!ok(player, player.fx, player.fz))) {
      const s = randomTile((x, z) => ok(player, x, z)) || randomTile(walkable);
      if (s) { place(player, s[0], s[1]); player.appear = 0; }
    }
    syncCar();
    syncNpcs();
  }

  buildPlayer();
  syncNpcs();
  syncCar();
  // repartir a las vecinas iniciales con pasos aleatorios
  for (const w of npcs) { w.appear = 1; w.obj.scale.setScalar(NPC_SCALE); }

  return {
    group,
    update,
    refreshGrid,
    syncNpcs,
    rebuildPlayer: buildPlayer,
    rebuildCar,
    setCamAngle(a) { camFacing = a; },
    get player() { return player; },
    get npcs() { return npcs; },
    get car() { return car; },
    get grid() { return grid; },
    /** Saludo: el personaje mira a cámara y salta un poquito. */
    dispose() {
      for (const w of npcs) disposeObject(w.obj);
      if (player) disposeObject(player.obj);
      if (car) { disposeObject(car.obj); disposeObject(car.dock); }
      for (const g of wingGeos) g.dispose();
      wingGeos.mat.dispose();
      r.scene.remove(group);
    },
  };
}
