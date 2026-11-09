// Combate táctico: constantes y tablas (DESIGN-COMBAT.md). Todo número de balance vive acá; lo calibra
// tools/sim-combat.mjs contra las metas de DESIGN-COMBAT.md §8. Puro: sin DOM ni three.js (se importa desde Node).
//
// Unidades del grupo (el líder y los roles de la expedición), habilidades con recarga, habilidades de elemento del
// líder, consumibles del Taller, enemigos del Acto 1 y encuentros (mapas de 8×8, objetivos y desafíos).

export const COMBAT = {
  w: 8, h: 8,
  intentsBase: 3,                 // intenciones a la vista sin Catalejo (las de los jefes se ven siempre)
  climb: [3, 2, 2, 1, 1, 1],      // movimiento que cuesta subir a lo alto, por nivel de Cuerda (0..5)
  waterCost: 2,                   // pisar agua baja
  floodExtra: 1,                  // una casilla inundada cuesta 1 más
  floodTurns: 2,                  // cuántas fases enemigas dura una inundación
  floodDmg: [1, 2],               // el agua tira: daño por fase en casilla inundada (fase 1 / fase 2 de la bestia)
  stuckMv: 1,                     // trabado: quien arranca al lado de un enemigo se mueve 1 (la guía no se traba)
  highDmg: 1,                     // pegar desde lo alto a alguien de abajo
  highRange: 1,                   // alcance extra de los ataques a distancia desde lo alto
  markBonus: 3,                   // daño extra del golpe a un enemigo marcado (y se gasta la marca)
  collideDmg: 2,                  // empujado contra algo (al otro, si es una unidad, 1 menos)
  explodeDmg: 2,                  // un bicho de veta que revienta lastima a los de al lado
  guard: [0, 1, 1, 1, 2, 2],      // Farol de guardia: daño menos para quien está al lado del líder
  trapBonus: [0, 1, 1, 2, 2, 3],  // Martillo: daño extra de las trampas de ingeniería
  healBonus: [0, 1, 1, 2, 2, 3],  // Botiquín (herramienta de Olga): la sanidad cura más
  catalejo: [0, 1, 2, 3, 4, 9],   // Catalejo: intenciones de más enemigos a la vista
  leader: {
    hp: (lv) => Math.floor((lv - 1) / 2),      // vida extra del líder por nivel (1..30)
    atk: (lv) => Math.floor((lv + 2) / 6),     // ataque extra (nivel 4: +1, 10: +2, …)
    slots: [1, 5, 12],                         // niveles que abren espacios de habilidad de elemento
  },
  roleLevel: { hp: 1, atkEvery: 2 },           // por nivel de rol sobre 1: +1 de vida; +1 de ataque cada 2 niveles
  revancha: { hp: 5, bossHp: 0.2, max: 2 },    // por intento fallido contra un jefe: +5 de vida al grupo, −20 % al jefe
  maxTurns: { comun: 12, jefe: 16 },           // si se llega, se hace de noche y hay que replegarse (derrota)
  quick: { loot: 0.75 },                       // resolución rápida: botín reducido, sin estrellas extra
  morale: { lose: -3, retreat: -1 },           // lo que cuesta en el ánimo de la expedición
  lootByStars: [0, 0.8, 1, 1.2],
};

// Casillas. block: no se puede pisar; low: se puede inundar.
export const TILES = {
  llano: { id: 'llano', name: 'Llano', cost: 1, low: true },
  agua: { id: 'agua', name: 'Agua baja', cost: 2, low: true },
  alto: { id: 'alto', name: 'Lo alto', cost: 0, high: true },          // el costo sale de COMBAT.climb
  arbol: { id: 'arbol', name: 'Árbol', block: true },
  roca: { id: 'roca', name: 'Roca', block: true, breakable: true },
  pasarela: { id: 'pasarela', name: 'Pasarela', cost: 1 },
  salida: { id: 'salida', name: 'Salida', cost: 1, low: true },
  vacio: { id: 'vacio', name: 'Vacío', block: true },                  // la pasarela cortada
};
// Letras de los mapas. L: líder; a: el resto del grupo; e: enemigos (en el orden del encuentro); w: llegan refuerzos;
// c: alguien para rescatar. Esas cinco van sobre llano.
export const MAP_CHARS = { '.': 'llano', '~': 'agua', A: 'alto', T: 'arbol', R: 'roca', P: 'pasarela', S: 'salida' };

// Habilidades. range: [mín, máx] en pasos (Manhattan) desde quien la usa. cd: turnos propios de recarga.
// kind: attack | mark | trap | wall | heal | healArea | disarm | push | swap | root | free | dazzle | cover | rope
export const ABILITIES = {
  golpe: { id: 'golpe', name: 'Golpe', kind: 'attack', range: [1, 1], dmg: 'atk', cd: 0, text: 'Pega al lado.' },
  tiro: { id: 'tiro', name: 'Tiro', kind: 'attack', range: [2, 3], dmg: 'atk', cd: 0, ranged: true, text: 'Pega de lejos (2 a 3; 4 desde lo alto). Trabado no puede apuntar.' },
  marcar: { id: 'marcar', name: 'Marcar', kind: 'mark', range: [1, 5], dmg: 0, cd: 2, ranged: true,
    text: 'Marca a un enemigo: el próximo golpe que reciba hace +3.' },
  trampa: { id: 'trampa', name: 'Trampa', kind: 'trap', range: [1, 2], dmg: 3, root: 1, cd: 2,
    text: 'Deja una trampa: el enemigo que la pisa o cae en ella recibe 3 y queda frenado.' },
  barrera: { id: 'barrera', name: 'Barrera', kind: 'wall', range: [1, 2], turns: 3, cd: 3,
    text: 'Levanta una barrera por 3 turnos: corta el paso y para los tiros.' },
  curar: { id: 'curar', name: 'Curar', kind: 'heal', range: [0, 2], heal: 4, cd: 1, text: 'Cura 4 a alguien cerca.' },
  aliento: { id: 'aliento', name: 'Aliento', kind: 'healArea', range: [0, 0], radius: 2, heal: 2, cd: 4,
    text: 'Cura 2 a todo el grupo que esté a 2 o menos.' },
  romper: { id: 'romper', name: 'Romper', kind: 'attack', range: [1, 1], dmg: 'atk', plus: 2, pierce: true, breaks: true, cd: 2,
    text: 'Golpe que atraviesa corazas, rompe la coraza para siempre, parte rocas y pega doble a la pasarela.' },
  robar: { id: 'robar', name: 'Robar', kind: 'disarm', range: [1, 1], dmg: 1, cd: 3,
    text: 'Le saca lo que tiene en la mano: pierde el golpe marcado y suma botín.' },
  empujar: { id: 'empujar', name: 'Empujar', kind: 'push', range: [1, 1], dmg: 1, cd: 1,
    text: 'Empuja una casilla. Si choca recibe 2; si cae en una trampa, la pisa. Su golpe se corre con él.' },
  relevo: { id: 'relevo', name: 'Relevo', kind: 'swap', range: [1, 3], cd: 3, text: 'Cambia de lugar con alguien del grupo.' },
  liberar: { id: 'liberar', name: 'Liberar', kind: 'free', range: [1, 1], cd: 0, text: 'Desata a quien hay que rescatar.' },
  // Elemento Raíz (líder)
  enredar: { id: 'enredar', name: 'Enredar', kind: 'root', range: [1, 3], dmg: 1, root: 1, wallTurns: 2, cd: 3, element: 'raiz',
    text: 'Las raíces lo frenan: pierde el golpe marcado, no se mueve el próximo turno y sale una pared de raíz a su lado.' },
  muro_raiz: { id: 'muro_raiz', name: 'Muro de raíz', kind: 'wall', range: [1, 3], turns: 3, cd: 2, element: 'raiz',
    text: 'Levanta una pared de raíz por 3 turnos.' },
};

// Elementos: cada uno suma habilidades al líder, en el orden en que se abren los espacios (COMBAT.leader.slots).
export const ELEMENTS = {
  raiz: { id: 'raiz', name: 'Raíz', abilities: ['enredar', 'muro_raiz'] },
  // marea, brasa y céfiro llegan en los actos 2 a 4
};

// Consumibles del Taller (EQUIPMENT de src/expedition/exp-data.js): un uso por pelea cada uno.
export const ITEMS = {
  botiquin: { id: 'botiquin', name: 'Botiquín', kind: 'heal', range: [0, 1], heal: 5, text: 'Cura 5 a quien lo usa o a alguien al lado.' },
  farol: { id: 'farol', name: 'Farol', kind: 'dazzle', range: [0, 0], radius: 2, text: 'Encandila: los enemigos a 2 o menos pierden su golpe marcado.' },
  pala: { id: 'pala', name: 'Pala', kind: 'trap', range: [1, 1], dmg: 2, root: 1, text: 'Cava una zanja: es una trampa de 2.' },
  lona: { id: 'lona', name: 'Lona', kind: 'cover', range: [0, 0], cover: 2, text: 'Se cubren: quien la usa y los de al lado reciben 2 menos en el próximo turno enemigo.' },
  cuerda: { id: 'cuerda', name: 'Cuerda', kind: 'rope', range: [0, 0], text: 'Se tiende una cuerda: subir a lo alto cuesta 1 en toda la pelea.' },
};
export const ITEM_IDS = ['botiquin', 'farol', 'pala', 'lona', 'cuerda'];

// Unidades del grupo. El rol define el kit (plan §C).
export const UNITS = {
  lider: { id: 'lider', name: 'Líder', hp: 12, mv: 3, atk: 3, abilities: ['golpe'], text: 'Si cae, el grupo se repliega.' },
  exploracion: { id: 'exploracion', name: 'Exploración', hp: 8, mv: 3, atk: 2, abilities: ['tiro', 'marcar'], text: 'A distancia.' },
  ingenieria: { id: 'ingenieria', name: 'Ingeniería', hp: 10, mv: 3, atk: 3, abilities: ['golpe', 'trampa', 'barrera'], text: 'Barreras y trampas.' },
  sanidad: { id: 'sanidad', name: 'Sanidad', hp: 9, mv: 3, atk: 1, abilities: ['golpe', 'curar', 'aliento'], text: 'Curar.' },
  recoleccion: { id: 'recoleccion', name: 'Recolección', hp: 10, mv: 3, atk: 2, abilities: ['golpe', 'romper', 'robar'], text: 'Robar o romper.' },
  guia: { id: 'guia', name: 'Guía', hp: 10, mv: 4, atk: 3, abilities: ['golpe', 'empujar', 'relevo'], text: 'Movimiento y empujar.' },
  cautivo: { id: 'cautivo', name: 'Minero atrapado', hp: 12, mv: 3, atk: 0, abilities: [],
    text: 'Atado y escondido: los bichos no lo ven. Cuando lo desatás, van por él. Hay que llevarlo a la salida.' },
};
export const ROLE_IDS = ['exploracion', 'ingenieria', 'sanidad', 'recoleccion', 'guia'];

// Ataques enemigos. pattern (relativo a quien ataca y a dónde mira):
//   ring: las 4 de al lado · ring8: las 8 de alrededor · arc: la de enfrente y sus dos costados
//   line2 / line3: 2 o 3 en línea · shot: un tiro en línea de hasta `len` que pega en lo primero que encuentra
export const ENEMIES = {
  lobo: { id: 'lobo', name: 'Lobo de ojos brillantes', hp: 10, mv: 4, prefers: 'weak', nip: 1,
    attacks: [{ id: 'mordida', name: 'Mordida en rueda', pattern: 'ring', dmg: 3 }],
    text: 'Rodea y muerde a todo lo que tenga al lado. Va por el más débil. Acosa: al llegar muerde 1.' },
  lobo_viejo: { id: 'lobo_viejo', name: 'Lobo viejo', hp: 15, mv: 3, prefers: 'weak', nip: 1,
    attacks: [{ id: 'zarpazo', name: 'Zarpazo', pattern: 'arc', dmg: 4 }],
    text: 'Más lento y más fuerte: barre tres casillas de frente. Acosa: al llegar muerde 1.' },
  bicho: { id: 'bicho', name: 'Bicho de veta', hp: 7, mv: 2, armor: 1, explode: true, prefers: 'captive',
    attacks: [{ id: 'chispazo', name: 'Chispazo', pattern: 'line2', dmg: 2 }],
    text: 'Coraza de mineral (−1 a cada golpe). Al morir revienta y lastima a los de al lado.' },
  grumete: { id: 'grumete', name: 'Grumete pirata', hp: 12, mv: 3, prefers: 'near', nip: 1,
    attacks: [{ id: 'sable', name: 'Sablazo', pattern: 'arc', dmg: 3 }], text: 'Barre de frente con el sable. Acosa: al llegar pega 1.' },
  tirador: { id: 'tirador', name: 'Tirador pirata', hp: 9, mv: 2, prefers: 'line', keepAway: true,
    attacks: [{ id: 'trabuco', name: 'Trabuco', pattern: 'shot', len: 4, dmg: 3 }],
    text: 'Tira en línea y pega en lo primero que encuentra: una barrera lo para.' },
  bestia: { id: 'bestia', name: 'Bestia del Bañado', hp: 30, mv: 2, heavy: true, boss: true, swims: true, prefers: 'near',
    phases: [
      { from: 1, attacks: [{ id: 'coletazo', name: 'Coletazo', pattern: 'line3', dmg: 4 }], floodRows: 2, text: 'El agua sube por franjas.' },
      { from: 0.5, attacks: [{ id: 'remolino', name: 'Remolino', pattern: 'ring8', dmg: 4 }], floodRows: 3, text: 'Marejada: el agua sube más y tira más fuerte.' },
    ],
    text: 'Inunda casillas por turnos: hay que pelear en alto. No se la puede empujar ni frenar su golpe.' },
  capitana: { id: 'capitana', name: 'La capitana', hp: 34, mv: 3, heavy: true, boss: true, prefers: 'leader',
    phases: [
      { from: 1, attacks: [{ id: 'pistola', name: 'Pistola', pattern: 'shot', len: 5, dmg: 4 }, { id: 'sable_c', name: 'Sable', pattern: 'arc', dmg: 4, near: true }],
        bridgeEvery: 2, text: 'Llama refuerzos por la pasarela cada dos turnos.' },
      { from: 0.5, attacks: [{ id: 'abordaje', name: 'Abordaje', pattern: 'arc', dmg: 5 }], bridgeEvery: 1,
        text: 'Abordaje: llama refuerzos todos los turnos.' },
    ],
    text: 'Llama refuerzos por la pasarela del dirigible. La pasarela se puede cortar.' },
};

// Desafíos opcionales: cada uno cumplido suma una estrella (máximo 3 con la victoria).
export const CHALLENGES = {
  sinBajas: { id: 'sinBajas', name: 'Nadie cae', text: (c) => 'Ganar sin perder a nadie del grupo' },
  turnos: { id: 'turnos', name: 'Rápido', text: (c) => `Ganar en ${c.n} turnos o menos` },
  combo: { id: 'combo', name: 'Juego en equipo', text: (c) => `Hacer ${c.n} combos o más` },
  pasarela: { id: 'pasarela', name: 'Sin refuerzos', text: () => 'Cortar la pasarela' },
  rescateLimpio: { id: 'rescateLimpio', name: 'Rescate limpio', text: () => 'Que a quien rescatás no lo lastimen' },
  liderIntacto: { id: 'liderIntacto', name: 'Al frente y entero', text: () => 'Que al líder no lo lastimen' },
};

// Combos que se descubren y se anotan en el manual.
export const COMBOS = {
  marca: { id: 'marca', name: 'Marcar y pegar', text: 'Exploración marca y el siguiente golpe hace +3.' },
  empuje_trampa: { id: 'empuje_trampa', name: 'A la trampa', text: 'Empujar a un enemigo a una trampa de ingeniería.' },
  empuje_choque: { id: 'empuje_choque', name: 'Contra la pared', text: 'Empujar a un enemigo contra algo: recibe 2.' },
  fuego_amigo: { id: 'fuego_amigo', name: 'Entre ellos', text: 'Correr a un enemigo para que el golpe de otro le caiga a él.' },
  reventon: { id: 'reventon', name: 'Reventón', text: 'Un bicho de veta que revienta lastima a otro enemigo.' },
  desde_alto: { id: 'desde_alto', name: 'Desde arriba', text: 'Pegar desde lo alto hace +1.' },
  sin_coraza: { id: 'sin_coraza', name: 'Sin coraza', text: 'Romper la coraza de un bicho de veta.' },
};

// Encuentros del Acto 1. kind: comun | jefe. objective: defeat | survive (turns) | rescue.
// expected: el grupo que se espera en ese punto del acto (lo usa el simulador). reward: lo que da ganar.
export const ENCOUNTERS = {
  bosque_claro: {
    id: 'bosque_claro', name: 'Ojos en el monte', region: 'bosque', kind: 'comun', tutorial: true,
    text: 'Dos lobos de ojos brillantes cortan el sendero.',
    map: [
      'w.T..e.w',
      '.T....T.',
      'e...T...',
      '......T.',
      '.T.T....',
      '........',
      '..a.L.a.',
      'T...a..T',
    ],
    enemies: ['lobo', 'lobo'],
    waves: [{ turn: 4, kinds: ['lobo'] }],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 6 }],
    expected: { level: 1, size: 3 },
    reward: { xp: 20, mats: { madera: 2, hierbas: 1 } },
  },
  bosque_manada: {
    id: 'bosque_manada', name: 'La manada', region: 'bosque', kind: 'comun',
    text: 'La manada entera, con el lobo viejo adelante.',
    map: [
      '.e..T.e.',
      '...T....',
      'T..e....',
      '.....T..',
      '..T...e.',
      '.T......',
      '...aL.a.',
      '..T.a...',
    ],
    enemies: ['lobo', 'lobo', 'lobo_viejo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'combo', n: 2 }],
    expected: { level: 2, size: 3 },
    reward: { xp: 30, mats: { madera: 3, hierbas: 2 } },
  },
  cerro_veta: {
    id: 'cerro_veta', name: 'La veta despierta', region: 'cerro', kind: 'comun',
    text: 'En la mina vieja, los bichos de veta salen de la roca.',
    map: [
      'R.e..e.R',
      '..R...R.',
      '.e..R..e',
      '...R....',
      'R.....R.',
      '..R.e...',
      '...aL.a.',
      'R..a...R',
    ],
    enemies: ['bicho', 'bicho', 'bicho', 'bicho', 'bicho', 'bicho'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'turnos', n: 6 }, { id: 'combo', n: 2 }],
    expected: { level: 3, size: 3 },
    reward: { xp: 35, mats: { mineral: 3, piedra: 2 } },
  },
  cerro_rescate: {
    id: 'cerro_rescate', name: 'El minero atrapado', region: 'cerro', kind: 'comun',
    text: 'Un minero quedó atado en el socavón. Hay que desatarlo y sacarlo por abajo.',
    map: [
      'Rw..c.wR',
      '.R....R.',
      '..R.e.R.',
      'R.e.....',
      '..R...R.',
      '.e.....R',
      'R..aLa..',
      'S...a..S',
    ],
    enemies: ['bicho', 'bicho', 'bicho'],
    waves: [{ turn: 3, kinds: ['bicho'] }, { turn: 5, kinds: ['bicho', 'bicho'] }],
    maxTurns: 14,
    objective: { type: 'rescue' },
    challenges: [{ id: 'rescateLimpio' }, { id: 'sinBajas' }],
    expected: { level: 3, size: 3 },
    reward: { xp: 35, mats: { mineral: 2, piedra: 2 } },
  },
  banado_juncal: {
    id: 'banado_juncal', name: 'Aguantar en el juncal', region: 'banado', kind: 'comun',
    text: 'Los lobos bajan al agua de a uno. Hay que aguantar 5 turnos hasta que pase la balsa.',
    map: [
      'w..~~..w',
      '..~~T...',
      '.e.~..e.',
      '~~..A..~',
      '.T~...~~',
      '..~.A...',
      '..aL.a~.',
      'w...a..w',
    ],
    enemies: ['lobo', 'lobo'],
    waves: [{ turn: 2, kinds: ['lobo'] }, { turn: 3, kinds: ['lobo'] }, { turn: 4, kinds: ['lobo_viejo'] }],
    objective: { type: 'survive', turns: 5 },
    challenges: [{ id: 'sinBajas' }, { id: 'liderIntacto' }],
    expected: { level: 4, size: 3, element: 'raiz' },
    reward: { xp: 40, mats: { hierbas: 3, madera: 2 } },
  },
  banado_bestia: {
    id: 'banado_bestia', name: 'La bestia del Bañado', region: 'banado', kind: 'jefe',
    text: 'La Marea suelta despertó algo grande. El agua sube: hay que pelear en alto.',
    map: [
      '~~~~~~~~',
      '~A~~e~A~',
      '~~~~~~~~',
      '.A..~.A.',
      '..~..~..',
      'A...A..A',
      '...aL.a.',
      '..T.a.T.',
    ],
    enemies: ['bestia'],
    objective: { type: 'defeat', boss: true },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 8 }],
    expected: { level: 5, size: 3, element: 'raiz' },
    reward: { xp: 80, mats: { hierbas: 4, madera: 3 }, page: 'p3', flag: 'bestia_vencida' },
    noMirrorJitter: true,
  },
  costa_muelle: {
    id: 'costa_muelle', name: 'Saqueo en el muelle', region: 'costa', kind: 'comun',
    text: 'Un bote de piratas del cielo bajó a saquear la aduana.',
    map: [
      'w.e..e.w',
      '.R....R.',
      '...e....',
      'R..R..e.',
      '......R.',
      '.R.A....',
      '...aL.a.',
      'R...a..R',
    ],
    enemies: ['grumete', 'grumete', 'tirador', 'tirador'],
    waves: [{ turn: 3, kinds: ['grumete'] }],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 6 }],
    expected: { level: 6, size: 3, element: 'raiz' },
    reward: { xp: 45, mats: { madera: 2, mineral: 2, piedra: 2 } },
  },
  costa_capitana: {
    id: 'costa_capitana', name: 'El abordaje', region: 'costa', kind: 'jefe',
    text: 'La capitana baja del dirigible. Por la pasarela vienen más: se puede cortar.',
    map: [
      '..R..R..',
      '....e...',
      'P..e...R',
      'P.....e.',
      '..R..R..',
      '.A.....A',
      '...aL.a.',
      'R...a..R',
    ],
    enemies: ['capitana', 'grumete', 'tirador'],
    bridge: { hp: 10, kinds: ['grumete', 'tirador'] },
    objective: { type: 'defeat', boss: true },
    challenges: [{ id: 'pasarela' }, { id: 'sinBajas' }],
    expected: { level: 7, size: 3, element: 'raiz' },
    reward: { xp: 100, mats: { mineral: 3, madera: 3, piedra: 2 }, page: 'p8', flag: 'capitana_vencida' },
    noMirrorJitter: true,
  },
};
export const ENCOUNTER_IDS = Object.keys(ENCOUNTERS);
// Orden del Acto 1 (plan, "Actos"): Bosque → Cerro (Núcleo de Raíz) → Bañado → Costa.
export const ACT1 = ['bosque_claro', 'bosque_manada', 'cerro_veta', 'cerro_rescate', 'banado_juncal', 'banado_bestia', 'costa_muelle', 'costa_capitana'];
// El grupo del tutorial: el líder y los tres roles del prototipo de expedición, nivel 1, sin herramientas ni elemento.
export const TUTORIAL_PARTY = ['exploracion', 'ingenieria', 'sanidad'];
