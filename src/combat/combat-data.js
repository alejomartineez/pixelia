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
  stuckMv: 1,                     // trabado: quien arranca al lado de un enemigo se mueve 1 (el monje no se traba)
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
  classLevel: { hpEvery: 2, atkEvery: 4 },     // nivel de clase (1..10): +1 de vida cada 2 niveles y +1 de ataque cada 4
  revancha: { hp: 5, bossHp: 0.25, max: 2 },   // por intento fallido contra un jefe: +5 de vida al grupo, −25 % al jefe (paso 7: antes −20 %)
  maxTurns: { comun: 12, jefe: 16, farm: 8 },  // si se llega, se hace de noche y hay que replegarse (derrota)
  quick: { loot: 0.75 },                       // resolución rápida: botín reducido, sin estrellas extra
  morale: { lose: -3, retreat: -1 },           // lo que cuesta en el ánimo de la expedición
  lootByStars: [0, 0.8, 1, 1.2],
  // --- paso A2 (PLAN-FOTO): terreno, elementos y Marea ---
  coverDmg: 1,                    // matorral: 1 menos de los tiros (para quien esté parado ahí, de cualquier bando)
  wardDmg: 1,                     // al lado de un guardián de corteza, los demás enemigos reciben 1 menos
  fireDmg: 2, fireTurns: 3,       // casilla en llamas: quema a quien esté ahí cuando pasa la fase enemiga
  burnDmg: 1, burnTurns: 2,       // quemado: 1 por fase
  wetTurns: 2,                    // mojado (quien está en el agua está mojado siempre)
  steamTurns: 2,                  // vapor: no se puede apuntar de lejos hacia adentro ni desde adentro, y para los tiros
  shockDmg: 2, chainDmg: 2,       // descarga: Céfiro sobre mojado, y salta a los mojados de al lado
  igniteDmg: 2,                   // incendio: Brasa sobre alguien enredado
  crashDmg: 2,                    // el jabalí que carga y se estrella
  // Marea del Quiebre I a III (la porción vertical): vida y golpe de los enemigos, uno más en la III, y mejor botín
  // expected: el grupo con el que se calibra cada Marea en sim-farm.mjs (nivel del líder y nivel de clase)
  marea: [null,
    { hp: 1, dmg: 0, extra: 0, loot: 1, xp: 1, expected: { level: 3, classLevel: 2 } },
    { hp: 1.3, dmg: 1, extra: 0, loot: 1.5, xp: 1.3, expected: { level: 6, classLevel: 4 } },
    { hp: 1.4, dmg: 1, extra: 1, loot: 2, xp: 1.6, expected: { level: 9, classLevel: 6 } }],
};

// Casillas. block: no se puede pisar; low: se puede inundar.
export const TILES = {
  llano: { id: 'llano', name: 'Llano', cost: 1, low: true },
  agua: { id: 'agua', name: 'Agua baja', cost: 2, low: true, water: true },
  // paso A2: matorral (cobertura; arde) y corriente (agua que arrastra una casilla a quien quede ahí)
  mata: { id: 'mata', name: 'Matorral', cost: 1, low: true, cover: true, burns: true },
  corr_n: { id: 'corr_n', name: 'Corriente', cost: 2, low: true, water: true, flow: [0, -1] },
  corr_e: { id: 'corr_e', name: 'Corriente', cost: 2, low: true, water: true, flow: [1, 0] },
  corr_s: { id: 'corr_s', name: 'Corriente', cost: 2, low: true, water: true, flow: [0, 1] },
  corr_o: { id: 'corr_o', name: 'Corriente', cost: 2, low: true, water: true, flow: [-1, 0] },
  alto: { id: 'alto', name: 'Lo alto', cost: 0, high: true },          // el costo sale de COMBAT.climb
  arbol: { id: 'arbol', name: 'Árbol', block: true },
  roca: { id: 'roca', name: 'Roca', block: true, breakable: true },
  pasarela: { id: 'pasarela', name: 'Pasarela', cost: 1 },
  salida: { id: 'salida', name: 'Salida', cost: 1, low: true },
  vacio: { id: 'vacio', name: 'Vacío', block: true },                  // la pasarela cortada
};
// Letras de los mapas. L: líder; a: el resto del grupo; e: enemigos (en el orden del encuentro); w: llegan refuerzos;
// c: alguien para rescatar. Esas cinco van sobre llano.
// paso A2: M matorral · ^ > v < corriente · F fogata (llano que arde toda la pelea)
export const MAP_CHARS = { '.': 'llano', '~': 'agua', A: 'alto', T: 'arbol', R: 'roca', P: 'pasarela', S: 'salida',
  M: 'mata', '^': 'corr_n', '>': 'corr_e', v: 'corr_s', '<': 'corr_o', F: 'llano' };

// Habilidades. range: [mín, máx] en pasos (Manhattan) desde quien la usa. cd: turnos propios de recarga.
// kind: attack | mark | trap | wall | heal | healArea | disarm | push | swap | root | free | dazzle | cover | rope | leap
// Opcionales (clases, paso 5b): cleave (pega también a los costados del blanco), rootHit (frena al blanco N turnos),
// lootKill (si lo liquida, suma 1 de botín), noCancel y wallTurns: 0 (raíz sin pared y sin sacarle el golpe), radius en
// cover (0: solo quien la usa), self (heal: solo a sí mismo), leaveWall (leap: deja una pared donde estaba).
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
  // Guerrero (paso 5b)
  tajo: { id: 'tajo', name: 'Tajo', kind: 'attack', range: [1, 1], dmg: 'atk', cleave: true, cd: 2,
    text: 'Golpe ancho: pega al de enfrente y a los que estén a sus costados.' },
  guardia: { id: 'guardia', name: 'Guardia', kind: 'cover', range: [0, 0], radius: 1, cover: 2, cd: 3,
    text: 'Se planta: él y los de al lado reciben 2 menos en el próximo turno enemigo.' },
  embestida: { id: 'embestida', name: 'Embestida', kind: 'push', range: [1, 1], dmg: 2, cd: 3,
    text: 'Empuja con el cuerpo: 2 de daño y lo corre una casilla (si choca, recibe 2 más).' },
  aguante: { id: 'aguante', name: 'Aguante', kind: 'heal', range: [0, 0], self: true, heal: 4, cd: 3, text: 'Respira hondo: se cura 4.' },
  // Cazador
  tiro_pie: { id: 'tiro_pie', name: 'Tiro al pie', kind: 'root', range: [2, 3], dmg: 1, root: 1, wallTurns: 0, noCancel: true, cd: 3, ranged: true,
    text: 'Lo clava al piso: no se mueve el próximo turno (su golpe sigue marcado).' },
  certero: { id: 'certero', name: 'Tiro certero', kind: 'attack', range: [2, 4], dmg: 'atk', plus: 2, cd: 2, ranged: true,
    text: 'Apunta con calma: +2 de daño y llega a 4 (5 desde lo alto).' },
  lazo: { id: 'lazo', name: 'Lazo', kind: 'trap', range: [1, 3], dmg: 2, root: 1, cd: 3, text: 'Deja un lazo más lejos: 2 de daño y lo frena.' },
  // Forjador
  remache: { id: 'remache', name: 'Remache', kind: 'attack', range: [1, 1], dmg: 'atk', plus: 1, pierce: true, cd: 2,
    text: 'Golpe de martillo: +1 y atraviesa la coraza (sin romperla).' },
  cepo: { id: 'cepo', name: 'Cepo', kind: 'trap', range: [1, 2], dmg: 4, root: 2, cd: 3, text: 'Trampa de hierro: 4 de daño y lo frena 2 turnos.' },
  // Curandero
  vendaje: { id: 'vendaje', name: 'Vendaje', kind: 'heal', range: [0, 1], heal: 6, cd: 3, text: 'Venda fuerte: cura 6 a quien está al lado (o a sí mismo).' },
  resguardo: { id: 'resguardo', name: 'Resguardo', kind: 'cover', range: [0, 0], radius: 1, cover: 1, cd: 3,
    text: 'Junta al grupo: él y los de al lado reciben 1 menos en el próximo turno enemigo.' },
  // Monje
  esquivar: { id: 'esquivar', name: 'Esquivar', kind: 'cover', range: [0, 0], radius: 0, cover: 3, cd: 2,
    text: 'Se pone en guardia: recibe 3 menos en el próximo turno enemigo.' },
  salto: { id: 'salto', name: 'Salto', kind: 'leap', range: [2, 3], cd: 2, text: 'Salta a una casilla libre a 2 o 3, por encima de todo.' },
  // Saqueador
  rapina: { id: 'rapina', name: 'Rapiña', kind: 'attack', range: [1, 1], dmg: 'atk', plus: 1, lootKill: true, cd: 2,
    text: 'Golpe con mañas: +1, y si lo liquida suma 1 de botín.' },
  humo: { id: 'humo', name: 'Humo', kind: 'dazzle', range: [0, 0], radius: 1, cd: 4, text: 'Bomba de humo: los enemigos de al lado pierden su golpe marcado.' },
  // Elemento Raíz (líder)
  enredar: { id: 'enredar', name: 'Enredar', kind: 'root', range: [1, 3], dmg: 1, root: 1, wallTurns: 2, cd: 3, element: 'raiz',
    text: 'Las raíces lo frenan: pierde el golpe marcado, no se mueve el próximo turno y sale una pared de raíz a su lado.' },
  muro_raiz: { id: 'muro_raiz', name: 'Muro de raíz', kind: 'wall', range: [1, 3], turns: 3, cd: 2, element: 'raiz',
    text: 'Levanta una pared de raíz por 3 turnos.' },
  // Subclases de Raíz del líder (SUBCLASSES en src/combat/classes.js)
  abrazo_raiz: { id: 'abrazo_raiz', name: 'Abrazo de raíz', kind: 'root', range: [1, 1], dmg: 2, root: 1, wallTurns: 2, cd: 3, element: 'raiz',
    text: 'Lo agarra de cerca: 2 de daño, pierde el golpe marcado, no se mueve y sale una pared de raíz a su lado.' },
  espina: { id: 'espina', name: 'Espina', kind: 'attack', range: [2, 4], dmg: 'atk', rootHit: 1, cd: 2, ranged: true, element: 'raiz',
    text: 'Tiro de espina: llega a 4 y lo frena un turno.' },
  zarza: { id: 'zarza', name: 'Zarza', kind: 'trap', range: [1, 3], dmg: 3, root: 2, cd: 2, element: 'raiz',
    text: 'Hace crecer una zarza: 3 de daño y lo frena 2 turnos.' },
  savia: { id: 'savia', name: 'Savia', kind: 'healArea', range: [0, 0], radius: 2, heal: 3, cd: 3, element: 'raiz',
    text: 'La savia cierra heridas: cura 3 a todo el grupo que esté a 2 o menos.' },
  brote: { id: 'brote', name: 'Brote', kind: 'leap', range: [1, 3], leaveWall: 2, cd: 2, element: 'raiz',
    text: 'Salta a una casilla libre a 3 o menos y deja una pared de raíz donde estaba.' },
  zarpa_raiz: { id: 'zarpa_raiz', name: 'Zarpa de raíz', kind: 'disarm', range: [1, 1], dmg: 2, rootHit: 1, cd: 3, element: 'raiz',
    text: 'Le arranca lo que tiene en la mano: 2 de daño, pierde el golpe, lo frena y suma botín.' },
  // Fragmentos de veta (paso A2): una habilidad prestada de otro elemento, lo que dura la salida
  oleada: { id: 'oleada', name: 'Oleada', kind: 'push', range: [1, 3], line: true, dmg: 1, cd: 2, ranged: true, element: 'marea',
    text: 'Un golpe de agua en línea: 1 de daño, lo moja y lo corre una casilla. Apaga el fuego y levanta vapor.' },
  ascua: { id: 'ascua', name: 'Ascua', kind: 'attack', range: [1, 3], dmg: 2, cd: 2, ranged: true, element: 'brasa', ground: true,
    text: 'Tira una brasa: 2 de daño y lo deja quemado. En una casilla vacía prende fuego; el matorral y las raíces arden.' },
  rafaga: { id: 'rafaga', name: 'Ráfaga', kind: 'push', range: [1, 3], line: true, dmg: 1, pushN: 2, cd: 2, ranged: true, element: 'cefiro',
    text: 'Viento en línea: 1 de daño y lo corre dos casillas. A un mojado le cae una descarga; al fuego lo hace saltar.' },
};

// Fragmentos de veta: newBattle({ fragments: ['brasa'] }) le suma al líder la habilidad de ese elemento por esa pelea.
export const FRAGMENTS = { marea: 'oleada', brasa: 'ascua', cefiro: 'rafaga' };
export const ELEMENT_NAMES = { raiz: 'Raíz', marea: 'Marea', brasa: 'Brasa', cefiro: 'Céfiro' };

// Elementos: cada uno suma habilidades al líder, en el orden en que se abren los espacios (COMBAT.leader.slots).
export const ELEMENTS = {
  raiz: { id: 'raiz', name: 'Raíz', abilities: ['enredar', 'muro_raiz'] },   // el nombre en pantalla: element.raiz (arsenal.js)
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

// Unidades del grupo: el líder y las 6 clases (paso 5b; reemplazan a los roles). Lo de cada clase (grupo de 4
// habilidades, pasivas, subclases y curvas) vive en src/combat/classes.js; acá van la vida, el movimiento, el ataque y
// el kit por defecto: el ataque básico y las 2 primeras habilidades del grupo.
export const UNITS = {
  lider: { id: 'lider', name: 'Líder', hp: 12, mv: 3, atk: 3, abilities: ['golpe'], text: 'Si cae, el grupo se repliega.' },
  guerrero: { id: 'guerrero', name: 'Guerrero', hp: 13, mv: 3, atk: 3, abilities: ['golpe', 'tajo', 'guardia'], text: 'Primera línea: aguanta y protege.' },
  cazador: { id: 'cazador', name: 'Cazador', hp: 8, mv: 3, atk: 2, abilities: ['tiro', 'marcar', 'tiro_pie'], text: 'A distancia y marcar.' },
  forjador: { id: 'forjador', name: 'Forjador', hp: 10, mv: 3, atk: 3, abilities: ['golpe', 'trampa', 'barrera'], text: 'Barreras y trampas.' },
  curandero: { id: 'curandero', name: 'Curandero', hp: 9, mv: 3, atk: 1, abilities: ['golpe', 'curar', 'aliento'], text: 'Curar y proteger.' },
  monje: { id: 'monje', name: 'Monje', hp: 10, mv: 4, atk: 3, abilities: ['golpe', 'empujar', 'relevo'], text: 'Movimiento, empujar y esquivar.' },
  saqueador: { id: 'saqueador', name: 'Saqueador', hp: 10, mv: 3, atk: 2, abilities: ['golpe', 'romper', 'robar'], text: 'Robar y romper.' },
  cautivo: { id: 'cautivo', name: 'Minero atrapado', hp: 12, mv: 3, atk: 0, abilities: [],
    text: 'Atado y escondido: los bichos no lo ven. Cuando lo desatás, van por él. Hay que llevarlo a la salida.' },
};
export const CLASS_IDS = ['guerrero', 'cazador', 'forjador', 'curandero', 'monje', 'saqueador'];
/** @deprecated los roles pasaron a clases (paso 5b). Queda el nombre para quien todavía lo importa. */
export const ROLE_IDS = CLASS_IDS;

// Ataques enemigos. pattern (relativo a quien ataca y a dónde mira):
//   ring: las 4 de al lado · ring8: las 8 de alrededor · arc: la de enfrente y sus dos costados
//   line2 / line3: 2 o 3 en línea · shot: un tiro en línea de hasta `len` que pega en lo primero que encuentra
export const ENEMIES = {
  lobo: { id: 'lobo', name: 'Lobo de ojos brillantes', hp: 10, farmHp: 7, mv: 4, prefers: 'weak', nip: 1,
    attacks: [{ id: 'mordida', name: 'Mordida en rueda', pattern: 'ring', dmg: 3 }],
    text: 'Rodea y muerde a todo lo que tenga al lado. Va por el más débil. Acosa: al llegar muerde 1.' },
  lobo_viejo: { id: 'lobo_viejo', name: 'Lobo viejo', hp: 15, farmHp: 10, mv: 3, prefers: 'weak', nip: 1,
    attacks: [{ id: 'zarpazo', name: 'Zarpazo', pattern: 'arc', dmg: 4 }],
    text: 'Más lento y más fuerte: barre tres casillas de frente. Acosa: al llegar muerde 1.' },
  bicho: { id: 'bicho', name: 'Bicho de veta', hp: 7, farmHp: 5, mv: 2, armor: 1, explode: true, prefers: 'captive',
    attacks: [{ id: 'chispazo', name: 'Chispazo', pattern: 'line2', dmg: 2 }],
    text: 'Coraza de mineral (−1 a cada golpe). Al morir revienta y lastima a los de al lado.' },
  grumete: { id: 'grumete', name: 'Grumete pirata', hp: 14, mv: 3, prefers: 'near', nip: 1,
    attacks: [{ id: 'sable', name: 'Sablazo', pattern: 'arc', dmg: 3 }], text: 'Barre de frente con el sable. Acosa: al llegar pega 1.' },
  tirador: { id: 'tirador', name: 'Tirador pirata', hp: 10, mv: 2, prefers: 'line', keepAway: true,
    attacks: [{ id: 'trabuco', name: 'Trabuco', pattern: 'shot', len: 4, dmg: 3 }],
    text: 'Tira en línea y pega en lo primero que encuentra: una barrera lo para.' },
  // --- paso A2: los comunes del farmeo. ai: cómo se mueve y qué busca (planEnemy en combat-rules.js) ---
  hondero: { id: 'hondero', name: 'Hondero del monte', hp: 6, mv: 3, prefers: 'weak', ai: 'kite',
    attacks: [{ id: 'piedra', name: 'Pedrada', pattern: 'shot', len: 4, dmg: 2 }],
    text: 'Tira de lejos y se aleja cuando te acercás. Acorralalo o tapale el tiro.' },
  guardian: { id: 'guardian', name: 'Guardián de corteza', hp: 10, mv: 2, prefers: 'near', ai: 'guard', ward: true,
    attacks: [{ id: 'ramazo', name: 'Ramazo', pattern: 'arc', dmg: 3 }],
    text: 'Se planta al lado de otro y lo cubre: los enemigos pegados a él reciben 1 menos. Sacalo del medio primero o corrélo.' },
  nido: { id: 'nido', name: 'Nido de larvas', hp: 8, mv: 1, prefers: 'near', ai: 'summon', summon: { kind: 'larva', every: 2, max: 3 }, attacks: [],
    text: 'No pega: cada dos turnos saca una larva al lado (se ve un turno antes). Mientras siga en pie, siguen saliendo.' },
  larva: { id: 'larva', name: 'Larva', hp: 3, mv: 3, prefers: 'near',
    attacks: [{ id: 'mordisco', name: 'Mordisco', pattern: 'front', dmg: 2 }], text: 'Chica y rápida. Sale del nido.' },
  jabali: { id: 'jabali', name: 'Jabalí de colmillo', hp: 9, mv: 2, prefers: 'near', ai: 'charge',
    attacks: [{ id: 'carga', name: 'Carga', pattern: 'charge', len: 5, dmg: 4, push: 1 }],
    text: 'Carga en línea recta hasta chocar: pega 4 y empuja. Si esquivás y se estrella contra algo, recibe 2 y queda aturdido.' },
  hongo: { id: 'hongo', name: 'Hongo hinchado', hp: 5, mv: 3, prefers: 'near', explode: true, explodeDmg: 3, explodeRing8: true,
    attacks: [{ id: 'cabezazo', name: 'Cabezazo', pattern: 'front', dmg: 2 }],
    text: 'Corre hacia el grupo. Al morir revienta: 3 a todo lo que tenga alrededor, también a los suyos. Matalo de lejos o entre ellos.' },
  musgo: { id: 'musgo', name: 'Musgo viejo', hp: 7, mv: 2, prefers: 'near', ai: 'heal', heal: { amount: 4, range: 3 },
    attacks: [{ id: 'latigo', name: 'Latigazo', pattern: 'front', dmg: 2 }],
    text: 'Cura 4 al enemigo más lastimado que tenga cerca (se ve a quién). Si le cortás el golpe, no cura.' },
  ascua_errante: { id: 'ascua_errante', name: 'Ascua errante', hp: 7, mv: 3, prefers: 'near', fireproof: true, element: 'brasa',
    attacks: [{ id: 'llamarada', name: 'Llamarada', pattern: 'line2', dmg: 2, element: 'brasa' }],
    text: 'Su llamarada quema y deja el piso en llamas. El agua la apaga: mojada recibe 2 más.' },
  sapo: { id: 'sapo', name: 'Sapo de marea', hp: 8, mv: 2, swims: true, prefers: 'near', element: 'marea',
    attacks: [{ id: 'escupida', name: 'Chorro', pattern: 'shot', len: 3, dmg: 2, element: 'marea', push: 1 }],
    text: 'Nada sin frenarse. Su chorro moja y empuja una casilla: ojo con el fuego, la corriente y las trampas propias.' },
  cuervo: { id: 'cuervo', name: 'Cuervo de céfiro', hp: 5, mv: 5, flies: true, prefers: 'wet', element: 'cefiro',
    attacks: [{ id: 'picotazo', name: 'Picotazo', pattern: 'front', dmg: 2, element: 'cefiro' }],
    text: 'Vuela por encima de todo y busca a quien esté mojado: su picotazo le suelta una descarga que salta a los mojados de al lado.' },
  bestia: { id: 'bestia', name: 'Bestia del Bañado', hp: 32, mv: 2, heavy: true, boss: true, swims: true, prefers: 'near',
    phases: [
      { from: 1, attacks: [{ id: 'coletazo', name: 'Coletazo', pattern: 'line3', dmg: 4 }], floodRows: 2, text: 'El agua sube por franjas.' },
      { from: 0.5, attacks: [{ id: 'remolino', name: 'Remolino', pattern: 'ring8', dmg: 4 }], floodRows: 3, text: 'Marejada: el agua sube más y tira más fuerte.' },
    ],
    text: 'Inunda casillas por turnos: hay que pelear en alto. No se la puede empujar ni frenar su golpe.' },
  capitana: { id: 'capitana', name: 'La capitana', hp: 42, mv: 3, heavy: true, boss: true, prefers: 'leader',
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
  reaccion: { id: 'reaccion', name: 'Con la veta', text: () => 'Provocar una reacción de elementos' },
  turnos: { id: 'turnos', name: 'Rápido', text: (c) => `Ganar en ${c.n} turnos o menos` },
  combo: { id: 'combo', name: 'Juego en equipo', text: (c) => `Hacer ${c.n} combos o más` },
  pasarela: { id: 'pasarela', name: 'Sin refuerzos', text: () => 'Cortar la pasarela' },
  rescateLimpio: { id: 'rescateLimpio', name: 'Rescate limpio', text: () => 'Que a quien rescatás no lo lastimen' },
  liderIntacto: { id: 'liderIntacto', name: 'Al frente y entero', text: () => 'Que al líder no lo lastimen' },
};

// Combos que se descubren y se anotan en el manual.
export const COMBOS = {
  marca: { id: 'marca', name: 'Marcar y pegar', text: 'El cazador marca y el siguiente golpe hace +3.' },
  empuje_trampa: { id: 'empuje_trampa', name: 'A la trampa', text: 'Empujar a un enemigo a una trampa.' },
  empuje_choque: { id: 'empuje_choque', name: 'Contra la pared', text: 'Empujar a un enemigo contra algo: recibe 2.' },
  fuego_amigo: { id: 'fuego_amigo', name: 'Entre ellos', text: 'Correr a un enemigo para que el golpe de otro le caiga a él.' },
  reventon: { id: 'reventon', name: 'Reventón', text: 'Un bicho de veta que revienta lastima a otro enemigo.' },
  desde_alto: { id: 'desde_alto', name: 'Desde arriba', text: 'Pegar desde lo alto hace +1.' },
  sin_coraza: { id: 'sin_coraza', name: 'Sin coraza', text: 'Romper la coraza de un bicho de veta.' },
  // paso A2: reacciones de elementos y terreno
  vapor: { id: 'vapor', name: 'Vapor', text: 'Marea y Brasa se juntan: sale vapor que tapa la vista y para los tiros.', react: true },
  descarga: { id: 'descarga', name: 'Descarga', text: 'Céfiro sobre alguien mojado: 2 de daño, y salta a los mojados de al lado.', react: true },
  incendio: { id: 'incendio', name: 'Incendio', text: 'Brasa sobre raíces, matorral o un enredado: arde y se corre a lo que tenga pegado.', react: true },
  fuego_salta: { id: 'fuego_salta', name: 'Fuego que salta', text: 'Céfiro sobre el fuego: las llamas saltan dos casillas en esa dirección.', react: true },
  brote: { id: 'brote', name: 'Brote', text: 'Raíz sobre alguien mojado: las raíces crecen y lo frenan un turno más.', react: true },
  despeje: { id: 'despeje', name: 'Despeje', text: 'Céfiro se lleva el vapor.', react: true },
  estrellado: { id: 'estrellado', name: 'Se estrelló', text: 'Esquivar la carga del jabalí para que choque contra algo.' },
  a_las_brasas: { id: 'a_las_brasas', name: 'A las brasas', text: 'Empujar a un enemigo al fuego.' },
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
    expected: { level: 1, size: 3, classLevel: 1 },
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
    expected: { level: 2, size: 3, classLevel: 1 },
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
    expected: { level: 3, size: 3, classLevel: 2 },
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
    expected: { level: 3, size: 3, classLevel: 2 },
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
    expected: { level: 4, size: 3, element: 'raiz', classLevel: 3 },
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
    expected: { level: 5, size: 3, element: 'raiz', classLevel: 3 },
    reward: { xp: 80, mats: { hierbas: 4, madera: 3 }, page: 'p9', flag: 'bestia_vencida' },
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
    // paso 5b, cuarta parte: el grupo esperado es el de la ciudad al llegar a la Costa (sim:economy, rango 6: líder 6,
    // clases 5/4/3 y las herramientas de ese momento). Con eso salía 99 %: foeHp lo deja en la meta (DESIGN-COMBAT §8).
    expected: { level: 6, size: 3, element: 'raiz', classLevel: [5, 4, 3], tools: { catalejo: 4, martillo: 2, cuerda: 4, botiquin: 5, farol: 1 } },
    foeHp: 1.35,
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
    // se pelea en el abordaje (src/story/act1.js), con la gente de la ciudad: el grupo esperado es el que da sim:economy en
    // el rango 6 (líder 7, clases 5/4/3 con la curva del paso 5b cuarta parte, herramientas y dos consumibles del
    // depósito). city: no lo pelea el grupo del tutorial. foeHp, bossHp y foeDmg lo ponen a la altura de ese grupo
    // (paso 7, DESIGN-COMBAT §8; con las clases 10/10/9 de antes iba 1,35 / 1,45 / +3).
    expected: { level: 6, size: 3, element: 'raiz', classLevel: [5, 4, 3], tools: { catalejo: 4, martillo: 5, cuerda: 5, botiquin: 5, farol: 1 }, equip: ['botiquin', 'farol'], city: true },
    foeHp: 0.9, bossHp: 1.35, foeDmg: 2,
    reward: { xp: 100, mats: { mineral: 3, madera: 3, piedra: 2 }, page: 'p8', flag: 'capitana_vencida' },
    noMirrorJitter: true,
  },
};

// ---------- paso A2 (PLAN-FOTO): los encuentros del farmeo, isla del Bosque del Arroyo ----------
// Tablero de 6×6, peleas de 3 a 5 turnos. farm: usan la vida de farmeo (farmHp) y el tope corto de turnos. Se juegan en
// Marea I a III (newBattle({ marea })): COMBAT.marea sube vida, golpe y botín, y en la III se suma un enemigo (extra).
// Los combos de la isla se arman con FARM.arroyo o pickEncounter() de combat-rules.js.
const FARM_EXPECTED = { level: 3, size: 3, element: 'raiz', classLevel: 2 };
const FARM_ENCOUNTERS = {
  arroyo_lobos: {
    id: 'arroyo_lobos', name: 'Lobos en el sendero', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Tres lobos de ojos brillantes cierran el paso.',
    map: ['e.T..e', '...e..', '.M..T.', '......', '.a.La.', 'T..a..'],
    enemies: ['lobo', 'lobo', 'lobo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_honderos: {
    id: 'arroyo_honderos', name: 'Piedras desde la loma', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Dos honderos tiran desde lejos mientras un lobo te busca.',
    map: ['e.A..e', '..e...', '.T..M.', '.M...T', '..aL.a', '...a..'],
    enemies: ['hondero', 'hondero', 'lobo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_guardian: {
    id: 'arroyo_guardian', name: 'El que cubre', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Un guardián de corteza tapa a dos honderos.',
    map: ['.e.e..', '..e..T', 'T.....', '..M.M.', '.a.La.', '..a...'],
    enemies: ['hondero', 'hondero', 'guardian'], extra: ['lobo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_nido: {
    id: 'arroyo_nido', name: 'El nido', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Un nido de larvas late entre los árboles. Mientras siga en pie, salen más.',
    map: ['..e.eT', '.e..e.', '...T..', '.M....', '.aL.a.', 'T..a..'],
    enemies: ['nido', 'lobo', 'larva', 'larva'], extra: ['larva'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_jabalies: {
    id: 'arroyo_jabalies', name: 'Colmillos', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Dos jabalíes toman carrera. Los árboles están de tu lado.',
    map: ['e..T.e', '......', '.T.e..', '....T.', 'a.L..a', '.T.a..'],
    enemies: ['jabali', 'jabali', 'hongo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'combo', n: 1 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_hongos: {
    id: 'arroyo_hongos', name: 'Esporas', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Tres hongos hinchados vienen corriendo detrás de un guardián.',
    map: ['.e..e.', '..ee..', 'T....T', '..M...', '.a.La.', '...a..'],
    enemies: ['hongo', 'hongo', 'guardian', 'hongo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'combo', n: 1 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_musgo: {
    id: 'arroyo_musgo', name: 'Musgo viejo', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Un musgo viejo cura a los lobos por detrás.',
    map: ['..e..T', 'T..e.e', '......', '.M..A.', '.aL..a', '..a...'],
    enemies: ['musgo', 'lobo_viejo', 'lobo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_brasas: {
    id: 'arroyo_brasas', name: 'Claro quemado', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Dos ascuas errantes rondan un claro seco. El matorral arde fácil.',
    map: ['e..M.e', '.M.e..', '..F..M', '.M....', '.a.La.', '..a..T'],
    enemies: ['ascua_errante', 'ascua_errante', 'hondero'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'reaccion' }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_vado: {
    id: 'arroyo_vado', name: 'El vado', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Sapos de marea en el arroyo. La corriente arrastra a quien se quede en ella.',
    map: ['e.~~.e', '..>>v.', '.e.~v.', '~~..~~', '.aL.a.', '..a...'],
    enemies: ['sapo', 'sapo', 'lobo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_cuervos: {
    id: 'arroyo_cuervos', name: 'Alas sobre el agua', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Cuervos de céfiro buscan a quien esté mojado. Un sapo se encarga de mojarlo.',
    map: ['e..e.e', '.~~...', '..~~e.', '.....~', '.a.La.', 'T.a...'],
    enemies: ['cuervo', 'cuervo', 'cuervo', 'sapo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'liderIntacto' }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_emboscada: {
    id: 'arroyo_emboscada', name: 'Emboscada', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Dos lobos adelante. Los honderos llegan después.',
    map: ['w.T..w', '......', 'e..T.e', '.M....', '.aL.a.', '..a..T'],
    enemies: ['lobo', 'lobo'],
    waves: [{ turn: 2, kinds: ['hondero', 'hondero'] }],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 5 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_carga: {
    id: 'arroyo_carga', name: 'La carga', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Un jabalí carga, un guardián lo cubre y un musgo los cura.',
    map: ['.e.e..', 'T.e...', '.....T', '.T....', 'a.L.a.', '..a..T'],
    enemies: ['musgo', 'jabali', 'guardian'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_enjambre: {
    id: 'arroyo_enjambre', name: 'Enjambre', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Dos nidos y un hongo. Cada turno que pasa hay más larvas.',
    map: ['e....e', '..T...', '...e..', '.M..M.', '.a.La.', '..a...'],
    enemies: ['nido', 'nido', 'hongo'], extra: ['larva'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 4 }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_aguante: {
    id: 'arroyo_aguante', name: 'Aguantar el claro', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Vienen de todos lados. Hay que aguantar 4 turnos.',
    map: ['w..e.w', '.T....', 'e...T.', '..A...', '.aL.a.', 'w.a..w'],
    enemies: ['lobo', 'lobo'],
    waves: [{ turn: 2, kinds: ['hongo'] }, { turn: 3, kinds: ['jabali'] }],
    objective: { type: 'survive', turns: 4 },
    challenges: [{ id: 'sinBajas' }, { id: 'liderIntacto' }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_matorral: {
    id: 'arroyo_matorral', name: 'Matorral seco', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Un ascua errante entre el matorral, con cuervos encima.',
    map: ['e.M..e', '.MM.e.', '..e.M.', 'M.....', '.aL.a.', '..a.M.'],
    enemies: ['ascua_errante', 'cuervo', 'cuervo', 'lobo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'reaccion' }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_tormenta: {
    id: 'arroyo_tormenta', name: 'Tormenta chica', region: 'arroyo', kind: 'comun', farm: true,
    text: 'Agua, brasa y viento en el mismo claro. Todo reacciona con todo.',
    map: ['e.~..e', '.~~e..', '..~.e.', '.M..~.', '.aL.a.', '..a...'],
    enemies: ['sapo', 'ascua_errante', 'cuervo', 'cuervo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'reaccion' }],
    expected: FARM_EXPECTED, reward: { xp: 15, mats: { madera: 2, hierbas: 1 } },
  },
  arroyo_elite_manada: {
    id: 'arroyo_elite_manada', name: 'La manada del lobo viejo', region: 'arroyo', kind: 'comun', farm: true, elite: true, maxTurns: 10,
    text: 'Élite: el lobo viejo con los suyos, un guardián y un musgo que los cura.',
    map: ['.e.e..', 'e..e.T', '..e...', '.T..M.', '.aL.a.', '..a...'],
    enemies: ['musgo', 'guardian', 'lobo', 'lobo', 'lobo_viejo'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 5 }],
    expected: FARM_EXPECTED, reward: { xp: 30, mats: { madera: 3, hierbas: 2 } },
  },
  arroyo_elite_colmena: {
    id: 'arroyo_elite_colmena', name: 'La colmena', region: 'arroyo', kind: 'comun', farm: true, elite: true, maxTurns: 10,
    text: 'Élite: un nido bien cuidado, hongos adelante y dos jabalíes tomando carrera.',
    map: ['e.e..e', '..T...', '.e..e.', '....T.', '.aL.a.', 'T.a...'],
    enemies: ['nido', 'hongo', 'hongo', 'jabali', 'jabali'],
    objective: { type: 'defeat' },
    challenges: [{ id: 'sinBajas' }, { id: 'turnos', n: 5 }],
    expected: FARM_EXPECTED, reward: { xp: 30, mats: { madera: 3, hierbas: 2 } },
  },
};
Object.assign(ENCOUNTERS, FARM_ENCOUNTERS);
/** Por isla: los comunes y los élite del farmeo. */
export const FARM = {
  arroyo: {
    comunes: Object.keys(FARM_ENCOUNTERS).filter(id => !FARM_ENCOUNTERS[id].elite),
    elites: Object.keys(FARM_ENCOUNTERS).filter(id => FARM_ENCOUNTERS[id].elite),
    jefe: 'banado_bestia',
  },
};
export const MAREA_MAX = COMBAT.marea.length - 1;
export const ENCOUNTER_IDS = Object.keys(ENCOUNTERS);
// Orden del Acto 1 (plan, "Actos"): Bosque → Cerro (Núcleo de Raíz) → Bañado → Costa.
export const ACT1 = ['bosque_claro', 'bosque_manada', 'cerro_veta', 'cerro_rescate', 'banado_juncal', 'banado_bestia', 'costa_muelle', 'costa_capitana'];
// El grupo del tutorial: el líder y las tres clases del prototipo de expedición, nivel 1, sin herramientas ni elemento.
export const TUTORIAL_PARTY = ['cazador', 'forjador', 'curandero'];
