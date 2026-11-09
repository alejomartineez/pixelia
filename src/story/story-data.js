// Datos de la historia "El Quiebre" (DESIGN-STORY.md): personajes con retrato, actos y capítulos, escenas, páginas del
// diario, elementos, líneas de la cartógrafa al cumplir el tutorial (t1–t20) y el Manual de la Bitácora.
// Texto: rioplatense y sin diminutivos. La ciudad, cálida y sobria; el prólogo y las revelaciones, épicos sin
// grandilocuencia. Cada escena tiene de 1 a 4 líneas, se puede saltear y nunca bloquea el juego (salvo las épicas, que
// van a pantalla completa y igual se saltean con Esc).
// En las líneas, {name} es el nombre del personaje y {city} el de la ciudad.

// ---------- Personajes ----------
// Retratos (plan §M1): un busto del modelo vóxel de cada personaje (look, del mismo estilo que la gente del juego),
// serio, sobre fondo oscuro. Si no hay WebGL se usa el dibujo de 16×16 (portrait: una letra por pixel, con su paleta).
// Los de L5 (Brígida, Nahuel, Olga y Ramiro) ya tienen cara; sus escenas llegan en el paso 5b.
export const CHARACTERS = {
  cartografa: {
    id: 'cartografa', name: 'Vera', title: 'la cartógrafa', people: 'humano',
    look: { type: 'humano', build: 'esbelto', skin: 2, hair: 'rodete', hairColor: 'gris', face: 'cicatriz', dress: 'capa_viaje', dressColor: 'verde', crown: 'ninguna', acc: 'catalejo' },
    pal: { k: '#120f0d', h: '#4a3a32', H: '#8d8376', s: '#c99a78', S: '#a87a5a', e: '#1c1714', m: '#8a4b3c', y: '#d9a94e', Y: '#a27a2f', c: '#3f6b5e', C: '#2c4c43' },
    portrait: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhHHhhhk...',
      '..khhhhhhhhhhk..',
      '..khhsssssshhk..',
      '..khsssssssshk..',
      '..khssessesshk..',
      '..khsssSSssshk..',
      '..khSssmmssShk..',
      '...khSssssShk...',
      '...kkyyyyyykk...',
      '..kcyyYYyyyck...',
      '.kccccyYycccck..',
      '.kcCccyYyccCck..',
      '.kcccCcccccCck..',
    ],
  },
  herrera: {
    id: 'herrera', name: 'Brígida', title: 'la herrera', people: 'enano',
    look: { type: 'enano', build: 'esbelto', skin: 2, hair: 'trenzas', hairColor: 'pelirrojo', face: 'cicatriz', dress: 'delantal', dressColor: 'durazno', crown: 'vincha', acc: 'martillo' },
  },
  nahuel: {
    id: 'nahuel', name: 'Nahuel', title: 'el que subió del Bajo Mundo', people: 'humano',
    look: { type: 'humano', build: 'recio', skin: 4, hair: 'despeinado', hairColor: 'negro', face: 'barba_corta', dress: 'minero', dressColor: 'negro', crown: 'ninguna', acc: 'ninguno' },
  },
  curandera: {
    id: 'curandera', name: 'Olga', title: 'la curandera', people: 'humano',
    look: { type: 'humano', build: 'esbelto', skin: 1, hair: 'largo', hairColor: 'blanco', face: 'ninguna', dress: 'habito', dressColor: 'durazno', crown: 'capucha', acc: 'bolso' },
  },
  guardia: {
    id: 'guardia', name: 'Ramiro Ochoa', title: 'ex guardia de las Casas', people: 'humano',
    look: { type: 'humano', build: 'recio', skin: 3, hair: 'cortito', hairColor: 'gris', face: 'cicatriz_ojo', dress: 'tabardo', dressColor: 'azul', crown: 'ninguna', acc: 'ninguno' },
  },
  // la voz que cuenta el prólogo y los momentos grandes (sin retrato)
  narrador: { id: 'narrador', name: '', title: '' },
};

// ---------- Actos y capítulos ----------
// when(s): el capítulo arranca cuando se cumple (story.js toma el último que se cumple). goal: el "Qué sigue" de la
// historia, que la Bitácora muestra junto con la misión actual.
const rankOf = (s) => {
  const c = s.city?.buildings?.find(b => b.id === 'castillo');
  return c ? c.level || 1 : 1;
};
export const ACTS = [
  {
    id: 1, name: 'Tu fragmento', text: 'Un pedazo de tierra que quedó flotando después del Quiebre. Lo que se levante acá depende de vos.',
    chapters: [
      { id: 'prologo', name: 'Lo que quedó', goal: 'Levantá las primeras casas y armá la base para salir a explorar.', when: () => true },
      { id: 'bosque', name: 'El Bosque del Arroyo', goal: 'Explorá el Bosque del Arroyo y traé lo que la ciudad necesita.', when: (s) => !!s.quests?.done?.t4 },
      { id: 'sierras', name: 'Las Sierras Bajas', goal: 'Subí a las Sierras Bajas: desde ahí se ve el borde de la isla.', when: (s) => rankOf(s) >= 2 },
      { id: 'banado', name: 'El agua que respira', goal: 'Algo despertó en el Bañado de los Juncos. Averiguá qué.', when: (s) => rankOf(s) >= 3 },
      { id: 'cerro', name: 'La mina sellada', goal: 'Bajá a la mina vieja del Cerro del Hierro.', when: (s) => rankOf(s) >= 5 },
      { id: 'costa', name: 'Los faros apagados', goal: 'Reencendé un faro de la Costa de los Faros.', when: (s) => rankOf(s) >= 6 },
      { id: 'abordaje', name: 'Velas en el cielo', goal: 'Resistí el primer abordaje.', when: (s) => !!s.story?.flags?.faro },
    ],
  },
  { id: 2, name: 'Las islas vecinas', text: 'Otros pedazos, otras ciudades. No todas te van a recibir bien.', chapters: [] },
  { id: 3, name: 'El Bajo Mundo', text: 'Lo que quedó abajo cuando la tierra se partió.', chapters: [] },
  { id: 4, name: 'Los reyes', text: 'Las Casas siguen mandando. Alguien cerca tuyo también.', chapters: [] },
];

// ---------- Escenas ----------
// trigger: claves que dispara story.js (ver TRIGGERS ahí). who: id de CHARACTERS. epic: pantalla completa.
// contact: es uno de los 7 primeros contactos (H) y lleva art (íconos para la lámina). grant: premio al verla
// (page/element pasan por store.grant). action: botón extra al final ({label, run: 'prologue'}).
export const SCENES = [
  // --- Prólogo (entre el nombre y el estilo de la ciudad; también se vuelve a ver desde la Bitácora) ---
  {
    id: 'prologo_1', who: 'narrador', epic: true, chapter: 'prologo', title: 'El Quiebre',
    lines: [
      'Antes, la tierra era una sola. Por dentro le corrían cuatro vetas: Raíz, Marea, Brasa y Céfiro.',
      'Las Casas poderosas cavaron para tener más. Los de abajo les robaban lo que quedaba para comer. Nadie paró.',
      'La tierra se vació por dentro y se partió. Lo que tenía Céfiro subió al cielo. Lo demás quedó abajo, a oscuras.',
      'A eso le dicen el Quiebre. Tu isla es uno de los pedazos que subieron.',
    ],
  },
  {
    id: 'prologo_2', who: 'cartografa', epic: true, chapter: 'prologo', title: 'La cartógrafa', grant: { page: 'p1' },
    lines: [
      '{name}. Te esperaba hace rato. Soy Vera: hago los mapas de este pedazo de tierra.',
      'Cuando la isla se vació, me quedé. Tengo algo que arreglar, y alguien tenía que anotar lo que sigue en pie.',
      '{city} va a ser tu ciudad, si la levantás. Lo que la isla esconde no te lo puedo contar: hay que salir a buscarlo.',
      'Tomá. Es una página del diario del último intendente. La encontré en la Municipalidad, abajo de una piedra.',
    ],
  },
  // partidas que ya venían jugando: un aviso corto que lleva al prólogo (sin pantalla completa de golpe)
  {
    id: 'veterano', who: 'cartografa', trigger: ['story:veteran'], title: 'La cartógrafa',
    lines: ['{name}, hay algo de esta isla que nunca te conté. Lo dejé anotado en la Bitácora, junto con el Manual.'],
    action: { label: 'Leer el prólogo', run: 'prologue' }, grant: { page: 'p1' },
  },

  // --- Primeros contactos (H): la primera vez que aparece cada sistema central ---
  {
    id: 'c_ciudad', contact: 'ciudad', who: 'cartografa', trigger: ['story:city'], title: 'La ciudad', art: ['hammer', 'home', 'coin'],
    lines: [
      'Primero, la ciudad. Lo que construís produce solo: cuando aparezca algo arriba de un edificio, hacé clic y cobrá.',
      'Con eso pagás lo que sigue. La misión de la izquierda dice qué conviene ahora; la Bitácora (J), qué viene después.',
    ],
  },
  {
    id: 'c_expedicion', contact: 'expedicion', who: 'cartografa', trigger: ['unlock:expedicion', 'built:casa_exp'], title: 'La expedición', art: ['🧭', 'map', '🍞'],
    lines: [
      'La Casa de Expediciones está lista. Cada paso afuera gasta provisiones, y el grupo se cansa: mirá el ánimo.',
      'La niebla tapa lo que todavía no conocés. Lo que traés solo cuenta si volvés: no te quedes sin provisiones para el regreso.',
    ],
  },
  {
    id: 'c_taller', contact: 'taller', who: 'cartografa', trigger: ['built:taller'], title: 'El Taller', art: ['hammer', '🪢', '🔦'],
    lines: [
      'Con el Taller fabricás equipo para las salidas: cuerda, pala, lona, farol. Cada pieza sirve una vez por salida.',
      'Más adelante también hace reservas para aguantar las amenazas. Lo que falta, se fabrica.',
    ],
  },
  {
    id: 'c_rango', contact: 'rango', who: 'cartografa', trigger: ['quest:t13', 'rank:2'], title: 'Rango y Épocas', art: ['castle', 'sparkle', 'up'],
    lines: [
      'La Municipalidad marca el rango de la ciudad. Para subir, cumplí el expediente: gente, felicidad, negocios y Encanto.',
      'Cada tanto el rango cambia de Época: de madera a piedra, y después ladrillo, hierro y vidrio. Lo viejo se renueva.',
    ],
  },
  {
    id: 'c_amenazas', contact: 'amenazas', who: 'cartografa', trigger: ['unlock:amenazas', 'threat:announced'], title: 'Las amenazas', art: ['bolt', '🌊', '🔥'],
    lines: [
      'Desde el Quiebre los elementos andan sueltos, y cada tanto se desbordan: crecidas, incendios, tormentas.',
      'La isla avisa con tiempo. Prepará defensas y reservas antes; si no estás, la ciudad se defiende sola con lo que tenga.',
    ],
  },
  {
    id: 'c_combate', contact: 'combate', who: 'cartografa', trigger: ['combat:first'], title: 'El combate', art: ['⚔️', 'bolt', 'people'],
    lines: [
      'Afuera no todo se deja pasar. Se pelea por turnos: primero mueve tu grupo, después ellos.',
      'Las casillas marcadas son las que van a atacar. Salí de ahí o hacé que les cueste.',
      'Cada integrante tiene habilidades según su rol. Combinadas rinden el doble.',
    ],
  },
  {
    id: 'c_elementos', contact: 'elementos', who: 'cartografa', trigger: ['element:first'], title: 'Los elementos', art: ['sparkle', 'diamond', 'heart'],
    lines: [
      'Esto es veta viva. Desde el Quiebre los elementos andan sueltos: por eso la isla se desborda.',
      'Atado a la ciudad, un elemento la protege. Atado a vos, te da algo que no tenías.',
    ],
  },

  // --- Capítulos del Acto 1 (al empezar cada uno; el Acto 1 completo llega en el paso 6) ---
  { id: 'cap_bosque', who: 'cartografa', trigger: ['chapter:bosque'], title: 'El Bosque del Arroyo', lines: ['El Bosque del Arroyo es lo único que conozco bien. Igual, desde el Quiebre los lobos andan raros: llevá provisiones de más.'] },
  { id: 'cap_sierras', who: 'cartografa', trigger: ['chapter:sierras'], title: 'Las Sierras Bajas', lines: ['Desde las Sierras Bajas se ve el borde de la isla. Abajo no hay fondo: hay nubes, y algo que brilla entre las nubes.'] },
  { id: 'cap_banado', who: 'cartografa', trigger: ['chapter:banado'], title: 'El agua que respira', lines: ['En el Bañado de los Juncos el agua sube aunque no llueva. Eso es Marea suelta. Y algo se mueve abajo.'] },
  { id: 'cap_cerro', who: 'cartografa', trigger: ['chapter:cerro'], title: 'La mina sellada', lines: ['En el Cerro del Hierro hay una mina vieja de las Casas. Cavaron hasta el fondo, y algo quedó ahí abajo. Late.'] },
  { id: 'cap_costa', who: 'cartografa', trigger: ['chapter:costa'], title: 'Los faros apagados', lines: ['Los faros de la costa están apagados desde el Quiebre. Si encendemos uno, nos van a ver. No sé si eso es bueno.'] },
];
export const SCENE_BY_ID = Object.fromEntries(SCENES.map(s => [s.id, s]));
export const PROLOGUE = ['prologo_1', 'prologo_2'];
export const CONTACT_IDS = ['ciudad', 'expedicion', 'combate', 'amenazas', 'elementos', 'rango', 'taller'];

// ---------- La cartógrafa al cumplir el tutorial (cobro automático de t1–t20) ----------
export const AUTO_CLAIM = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't19', 't20'];
export const QUEST_LINES = {
  t1: 'Una casa con la luz prendida. De lejos, eso ya parece un pueblo.',
  t2: 'Sin comida no se sale a ningún lado. La Huerta es lo primero que levantó todo el que se quedó.',
  t3: 'Cuatro provisiones. Alcanza para una salida corta y para no pasar hambre esta noche.',
  t4: 'Ahí van a vivir mis mapas. Están incompletos: para eso estás vos.',
  t5: 'Volviste con madera y con barro hasta las rodillas. Así se empieza.',
  t6: 'Con un Taller dejamos de juntar lo que hay y empezamos a hacer lo que falta.',
  t7: 'Una cuerda buena vale más que un mapa bueno. Te lo dice alguien que dibuja mapas.',
  t8: 'Quince personas. Ya hay quien discute por el agua: buena señal.',
  t9: 'Pan a la mañana. La gente se queda donde huele a pan.',
  t10: 'Más lejos que la última vez. El bosque se termina en algún lado y quiero saber dónde.',
  t11: 'Esa zona ya está en el mapa. Fijate el borde: hay huellas que no son de lobo.',
  t12: 'La isla es más grande de lo que parece. Lo que no se ve se gana caminando.',
  t13: 'Con animales de carga traés el doble. Y ellos conocen caminos que nosotros no.',
  t14: 'Caserío. Ya no somos los que quedaron: somos los que volvieron.',
  t15: 'El arroyo crece todos los años. Esta vez lo vamos a esperar.',
  t16: 'Arena en bolsas. Poco épico, muy útil.',
  t17: 'La primera crecida y seguimos acá. La isla avisa antes de golpear: aprendé a escucharla.',
  t18: 'Todos de vuelta, la carga llena y el objetivo cumplido. Así da gusto dibujar.',
  t19: 'Desde las sierras se ve el borde. Abajo hay luces. Alguien vive ahí abajo.',
  t20: 'Piedra. Lo que se construye en piedra es para quedarse.',
};

// ---------- Páginas del diario del último intendente (coleccionable) ----------
// trigger: cuándo aparece (story.js); las que no tienen llegan con el Acto 1 completo (paso 6).
export const PAGES = [
  { id: 'p1', title: 'El día después', text: 'Escribo para que alguien sepa. Las Casas siguieron cavando hasta el último día, y nosotros robándoles hasta el último día. Cuando la tierra crujió, nadie soltó lo que tenía en la mano.' },
  { id: 'p2', title: 'Los lobos del arroyo', trigger: 'zone:bosque', text: 'Los lobos del arroyo no atacan por hambre. Les brillan los ojos como brillaba la veta. Algo los cambió, y no fue el miedo.' },
  { id: 'p3', title: 'El bote de abajo', trigger: 'rank:2', text: 'Hoy subió un bote desde abajo. Traía gente que no debería estar viva. Dicen que en el Bajo Mundo hay aldeas enteras, y que no nos perdonan.' },
  { id: 'p4', title: 'Los permisos', text: 'La Cofradía de la Veta pagaba bien por cada piedra de Raíz. Yo firmé los permisos. Que conste.' },
  // p5–p8 siembran la culpa de Vera (L2, pista falsa) y el giro final (L4) sin revelarlos
  { id: 'p5', title: 'El Bañado', text: 'El agua del Bañado sube de noche y baja de día. No es la luna: algo respira debajo. Los mapas del archivo ya lo marcaban, con una letra prolija que no era la mía.' },
  { id: 'p6', title: 'La galería honda', text: 'Las Casas no cavaban donde había más Raíz. Seguían una línea que solo ellas entendían, siempre debajo de sus tierras. Sellamos la galería honda por vergüenza, no por miedo.' },
  { id: 'p7', title: 'El faro', text: 'Si alguien enciende el faro, que sepa que los barcos del cielo también lo ven. Y que no todos los que subieron lo hicieron por suerte.' },
  { id: 'p8', title: 'La llave', text: 'Alguien sabe por qué subimos nosotros y no los de abajo. Vive entre la gente, sonríe y no lo dice. Le dejé la llave del archivo; ojalá me equivoque.' },
];
export const PAGE_BY_ID = Object.fromEntries(PAGES.map(p => [p.id, p]));

// ---------- Elementos (se descubren en la historia; cada uno da algo a la isla y algo al personaje) ----------
// Los efectos se aplican en el Acto 1 completo (Raíz, paso 6) y en los actos que siguen.
export const ELEMENTS = [
  { id: 'raiz', name: 'Raíz', ic: '🌱', where: 'la mina del Cerro del Hierro', isle: 'Más resistencia a la sequía y la helada, y un edificio nuevo: el Invernadero de Raíz.', leader: 'Enredar: frena a un enemigo y levanta una pared en el campo.' },
  { id: 'marea', name: 'Marea', ic: '🌊', where: 'el Bajo Mundo', isle: 'Menos daño por crecidas y el agua de la isla se ordena.', leader: 'Ola: empuja y apaga el fuego.' },
  { id: 'brasa', name: 'Brasa', ic: '🔥', where: 'los volcanes del Bajo Mundo', isle: 'Hornos más rápidos y menos daño por incendios.', leader: 'Ascua: quema el terreno por unos turnos.' },
  { id: 'cefiro', name: 'Céfiro', ic: '🌬️', where: 'lo sabe alguien que no lo dice', isle: 'La isla sube y se ve más lejos.', leader: 'Ráfaga: mueve a todo el grupo.' },
];
export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map(e => [e.id, e]));

// ---------- Manual (pestaña de la Bitácora; reemplaza el "Cómo jugar" viejo) ----------
// Capítulos que se abren al llegar a cada sistema. open(s, X): X trae isOpen de unlocks.js y lo visto de la historia.
// items: [ícono, título, texto (html simple)].
export const MANUAL = [
  {
    id: 'ciudad', name: 'La ciudad', ic: 'castle', open: () => true,
    items: [
      ['coin', 'Cobrar', 'Los edificios producen solos. Cuando aparece algo arriba de uno, hacé clic para cobrarlo. Si se llena, deja de producir hasta que cobres.'],
      ['hammer', 'Construir', 'Abrí <b>Construir</b> (B), elegí algo y ubicalo en el pasto. Se puede girar (R) y mover cuando quieras.'],
      ['people', 'Población', 'Las casas traen gente. Muchos negocios piden un mínimo de población para abrir.'],
      ['smile', 'Felicidad', 'Árboles, plantas y deco hacen feliz a la ciudad, y todo produce hasta un 50 % más.'],
      ['👷', 'Constructoras', 'Cada obra ocupa una constructora un rato. Si faltan menos de 5 segundos, se termina gratis.'],
      ['palette', 'Estilo y personaje', 'El botón de la paleta (T) cambia el estilo de la ciudad. El <b>Equipaje</b> cambia tu personaje y su ropa: lo comprado queda guardado.'],
    ],
  },
  {
    id: 'misiones', name: 'Misiones y Bitácora', ic: 'quest', open: () => true,
    items: [
      ['quest', 'Misión principal', 'La tarjeta de la izquierda dice qué conviene hacer ahora. Las primeras veinte se cobran solas al cumplirlas.'],
      ['📖', 'Bitácora', 'Con <b>J</b> o el botón del costado: el capítulo de la historia, qué sigue, las páginas del diario y este Manual.'],
      ['calendar', 'Diarias', 'Tres misiones por día. Si cumplís las tres se abre el cofre del día.'],
      ['trophy', 'Logros', 'Metas largas con estrellas: dan gemas a medida que avanzás.'],
    ],
  },
  {
    id: 'expedicion', name: 'La expedición', ic: '🧭', open: (s, X) => X.isOpen('expedicion'),
    items: [
      ['🍞', 'Provisiones', 'Cada paso gasta provisiones. Salen de la Huerta y se guardan en el depósito, que tiene tope. Hay una salida corta gratis por día.'],
      ['heart', 'Ánimo', 'Baja con los peligros. Si llega a cero, el grupo vuelve antes y con la mitad de la carga. Descansar en un campamento lo sube.'],
      ['map', 'Niebla', 'Lo que no se ve está tapado. Moverte despeja las casillas vecinas; los miradores despejan más.'],
      ['home', 'Volver', 'Lo que traés cuenta recién al volver a la ciudad. Si las provisiones no alcanzan para el regreso, se llega con la mitad de la carga.'],
      ['star', 'Estrellas', 'Una por cumplir el objetivo, otra por volver con la carga llena y otra por volver con buen ánimo.'],
      ['people', 'Grupo y roles', 'Cada edificio del ciclo suma un rol: exploración, ingeniería, guía, sanidad y recolección. Cada rol resuelve peligros distintos.'],
      ['🌙', 'Día y noche', 'Se sale al alba y cada paso es una hora. Desde las 20 es de noche: se ve una casilla menos, salvo que lleves el Farol.'],
      ['⛈️', 'Clima', 'En la barra de arriba están la hora, el clima y lo que viene. La tormenta y la niebla tapan; con tormenta o nieve, colinas, bañados y rocas cuestan una provisión más, salvo con la Lona.'],
    ],
  },
  {
    id: 'taller', name: 'El Taller', ic: 'hammer', open: (s) => s.city.buildings.some(b => b.id === 'taller'),
    items: [
      ['🪢', 'Equipo', 'Cuerda, pala, lona, farol: cada pieza se usa una vez por salida y se elige al prepararla.'],
      ['🧱', 'Reservas', 'Desde el rango Caserío, el Taller fabrica reservas para las amenazas (bolsas de arena, baldes…).'],
    ],
  },
  {
    id: 'rango', name: 'Rango y Épocas', ic: 'castle', open: (s) => rankOf(s) >= 2 || !!s.quests?.done?.t13,
    items: [
      ['castle', 'Rango', 'Mejorá la <b>Municipalidad</b> para subir de rango, de Aldea a Capital. Cada rango pide un expediente: el cartel de arriba a la izquierda dice qué falta.'],
      ['sparkle', 'Encanto', 'Deco variada y edificios mejorados suman Encanto: lo pide el expediente de los rangos altos.'],
      ['up', 'Épocas', 'Madera, Piedra, Ladrillo, Hierro, Vidrio y acero. Al cambiar de Época, los edificios viejos se pueden renovar con planos.'],
      ['map', 'Terreno', 'La ciudad crece desde los carteles del borde. El terreno se gana explorando zonas.'],
    ],
  },
  {
    id: 'amenazas', name: 'Las amenazas', ic: 'bolt', open: (s, X) => X.isOpen('amenazas'),
    items: [
      ['bolt', 'Aviso', 'Cada amenaza se anuncia con tiempo: el chip de la izquierda dice cuál viene y cuándo.'],
      ['🧱', 'Preparación', 'Las defensas cubren un radio y las reservas del Taller suman. Mirá el porcentaje de preparación.'],
      ['clock', 'Si no estás', 'Se resuelve sola con lo que tengas. Lo dañado se repara pagando o, con el tiempo, lo arregla la vecindad.'],
    ],
  },
  {
    id: 'obras', name: 'Obras y monumentos', ic: 'monument', open: (s, X) => X.isOpen('obras'),
    items: [
      ['monument', 'Monumentos', 'Se construyen por etapas con los materiales de la expedición: madera, piedra, mineral y hierbas. Cada uno terminado da un bonus para siempre.'],
    ],
  },
  {
    id: 'premios', name: 'Premios y colección', ic: 'gift', open: (s, X) => X.isOpen('cofres') || X.isOpen('hallazgos') || X.isOpen('pase'),
    items: [
      ['fire', 'Racha', 'Entrar cada día da un premio. Un escudo por semana cuida la racha si faltás un día.'],
      ['gift', 'Cofres', 'Salen en las salidas de 3 estrellas, las amenazas, el Pase y algunas misiones. Lo que traen va a la mochila.'],
      ['album', 'Hallazgos', 'Lo que se encuentra explorando, en colecciones por región. Completar una página da un premio grande; los repetidos se cambian por recortes.'],
      ['sparkle', 'Temporada', 'Cuatro semanas por temporada: todo lo que hacés suma chispas, y cada nivel del Pase trae premios.'],
    ],
  },
  {
    id: 'contactos', name: 'Contactos', ic: 'people', open: (s, X) => X.isOpen('contactos'),
    items: [
      ['people', 'Contactos', 'Sumá gente con tu código. Podés visitar sus ciudades, mandar regalos y pedir una mano.'],
      ['rotate', 'Intercambios', 'Cambiá hallazgos repetidos, monedas u objetos: del otro lado aceptan o rechazan.'],
    ],
  },
  {
    id: 'combate', name: 'El combate', ic: '⚔️', open: (s, X) => X.seen('c_combate'),
    items: [
      ['⚔️', 'Turnos', 'Primero mueve tu grupo y después los enemigos. Cada integrante se mueve y actúa una vez por turno.'],
      ['bolt', 'Casillas marcadas', 'Antes de atacar, el enemigo marca dónde va a pegar. Salí de ahí o bloquealo.'],
    ],
  },
  {
    id: 'elementos', name: 'Los elementos', ic: 'sparkle', open: (s) => (s.story?.elements || []).length > 0,
    items: [
      ['sparkle', 'Elementos', 'Raíz, Marea, Brasa y Céfiro. Cada uno da un efecto permanente a la isla y una habilidad a quien lidera.'],
    ],
  },
];
