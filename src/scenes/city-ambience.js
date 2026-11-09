// Ambiente de la ciudad (PLAN-QUIEBRE §J): día y noche (20 min por día), clima del día, las amenazas que se ven,
// la luz como progreso y lo que responde a lo que hacés (J5): humo de chimeneas, casas nuevas que prenden la luz,
// cosechas que se mecen, reparaciones que limpian.
// api = { ctx, r, lights, container, fx, cam, entries, getTheme(), threatWeather() }
import { createAmbience } from '../core/ambience-fx.js';
import { cityHour, cityWeather, isNightHour, hourText, WEATHER, cityEchoSpots } from '../core/ambience.js';

const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
// ?hour=21 y ?weather=tormenta para las capturas y las pruebas (mandan sobre el reloj y el clima)
const Q_HOUR = qs.has('hour') ? Number(qs.get('hour')) : null;
const Q_WEATHER = qs.get('weather') && WEATHER[qs.get('weather')] ? qs.get('weather') : null;
const SMOKY = new Set(['casa', 'mi_casa']);

export function createCityAmbience(api) {
  const { ctx, r, lights, container, fx, entries } = api;
  const { bus } = ctx;
  let override = { hour: Q_HOUR, weather: Q_WEATHER };
  let acc = 1, smokeAcc = 0, wasNight = null;
  const amb = createAmbience(r, {
    lights, sky: container, place: 'city', fog: { near: 46, far: 86 },
    onThunder: () => setTimeout(() => bus.emit('ambience:thunder', { place: 'city' }), 300 + Math.random() * 900),
  });
  setBase(api.getTheme());

  function setBase(T) {
    const L = T.lights;
    amb.setBase({ sky: T.sky, stars: T.stars, hemiSky: L.sky, hemiGround: L.ground, hemiI: L.hemi, sun: L.sun, sunI: L.sunI });
  }
  const hour = () => override.hour != null ? override.hour : ctx.state.settings?.dayNight === false ? 12 : cityHour();
  function weather() {
    if (override.weather) return override.weather;
    const th = api.threatWeather?.();
    if (th) return th;
    return cityWeather(Date.now(), { snowy: !!api.getTheme().snow });
  }
  function want() {
    const h = hour();
    return { hour: h, weather: weather(), light: ctx.state.world?.light ?? 1, place: 'city' };
  }
  amb.set(want(), { now: true });

  // ---------- J5: lo que hace el jugador cambia el entorno ----------
  const topOf = (e) => ({ x: e.root.position.x, y: (e.height || 1), z: e.root.position.z });
  const smoke = (p, n = 3, big = 1) => fx.burst(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.05, p.z + (Math.random() - 0.5) * 0.3,
    { n, colors: ['#a9a39b', '#c4beb5', '#8f8a83'], speed: 0.12, up: 0.55 * big, gravity: -0.18, size: 0.13 * big, life: 2.6, spread: 0.18, drag: 1.2 });
  const offs = [
    bus.on('building:built', ({ b } = {}) => {
      const e = b && entries.get(b.uid);
      if (!e) return;
      const d = ctx.economy.def(b);
      if (!SMOKY.has(d?.cat) && !SMOKY.has(d?.id)) return;
      // la casa nueva prende la luz y la chimenea
      setTimeout(() => { if (entries.get(b.uid) === e) { smoke(topOf(e), 5, 1.2); fx.sparkle(e.root.position.x, e.height * 0.55, e.root.position.z, ['#ffd77a', '#ffe9b0', '#ffc46a']); } }, 700);
    }),
    bus.on('building:repaired', ({ b } = {}) => {
      const e = b && entries.get(b.uid);
      if (!e) return;
      const c = e.root.position;
      fx.dust(c.x, 0.08, c.z, 0.6);
      setTimeout(() => entries.get(b.uid) === e && fx.sparkle(c.x, e.height * 0.6, c.z, ['#ffffff', '#c4f7e8', '#ffd166']), 250);
    }),
    bus.on('production:collected', ({ b, currency } = {}) => {
      if (currency !== 'prov') return;
      const e = b && entries.get(b.uid);
      if (!e) return;
      // la cosecha: el cultivo se mece (el salto lo pone city.js) y vuelan unas hojas
      const c = e.root.position;
      fx.burst(c.x, 0.35, c.z, { n: 8, colors: ['#7fb46a', '#9ccf7a', '#c8d98a'], speed: 0.9, up: 1.4, gravity: 2.2, size: 0.07, life: 1.1, spread: 0.8, drag: 1.4 });
    }),
  ];

  function chimneys(dt, look) {
    // humo de chimeneas: siempre un poco; al atardecer, de noche y con frío, más
    const cold = look.weather === 'helada' || look.weather === 'nieve' ? 1 : 0;
    const rate = 0.25 + look.glow * 0.9 + cold * 0.6;
    smokeAcc += dt * rate;
    if (smokeAcc < 1) return;
    smokeAcc = 0;
    const list = [];
    for (const e of entries.values()) {
      const d = ctx.economy.def(e.b);
      if (e.root.visible && (SMOKY.has(d?.cat) || SMOKY.has(d?.id)) && !ctx.economy.isConstructing?.(e.b)) list.push(e);
    }
    if (!list.length) return;
    const e = list[(Math.random() * list.length) | 0];
    const p = topOf(e);
    smoke({ x: p.x + 0.22, y: p.y - 0.1, z: p.z - 0.18 }, 2);
  }

  const res = {
    amb,
    setTheme(T) { setBase(T); acc = 1; },
    update(dt) {
      acc += dt;
      if (acc >= 1) {
        acc = 0;
        amb.set(want());
        const n = isNightHour(hour());
        if (n !== wasNight) {
          if (wasNight !== null) bus.emit('ambience:night', { place: 'city', night: n });
          wasNight = n;
        }
      }
      const st = api.cam?.st;
      if (st) amb.setArea(Math.max(8, (st.u || 14) * 0.9), Math.max(8, (st.u || 14) * 0.9), 9);
      amb.update(dt, st ? { x: st.x, z: st.z } : { x: 0, z: 0 });
      const look = amb.look;
      if (look && !api.hidden?.()) chimneys(dt, look);
    },
    /** Para las capturas y las pruebas: fija la hora y el clima (null = lo normal). */
    debug(o = {}) { override = { ...override, ...o }; amb.set(want(), { now: !!o.now }); },
    get hour() { return hour(); },
    get hourText() { return hourText(hour()); },
    get night() { return isNightHour(hour()); },
    /** Lugares para los ecos de noche (L6, los usa el paso 6). */
    echoSpots() { return cityEchoSpots(ctx.economy.landBounds().side); },
    dispose() { offs.forEach(f => f()); amb.dispose(); },
  };
  return res;
}
