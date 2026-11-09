// Piezas, motivos y stingers del compositor (PLAN-QUIEBRE §K3, DESIGN-AUDIO.md). Solo datos.
//
// Pieza: root (MIDI de la tónica, octava del bajo + 12), mode, meter (pulsos por compás), bpm, form + sections (un
// acorde por compás: grado 1–7 de la escala, con sufijo opcional 7 = séptima, s4 = suspendido, s2), base (intensidad de
// partida), gain (ganancia de la pieza), motifs (leitmotivs que puede citar) y motifP (probabilidad por frase), rest (probabilidad de un respiro
// después de una frase), reverb del lugar, y layers.
// Capa: role (pad | drone | bass | arp | melody | perc | choir), inst (piano | flute | pizz | timp | choir: muestras;
// pad | sub | brush: síntesis), at (intensidad mínima para sonar), vol, oct (semitonos sobre root), pat (patrón en
// corcheas: índice del tono del acorde, o velocidad en perc; null = silencio), epic (solo en modo épico),
// night (true = solo de noche, false = solo de día).

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11], locrian: [0, 1, 3, 5, 6, 8, 10],
};

/** Leitmotivs: [grado desde la tónica (0 = tónica, 7 = octava), pulsos, alteración en semitonos]. */
export const MOTIFS = {
  // la isla: sube a la quinta, se mece y vuelve a casa
  isla: [[4, 1], [2, 0.5], [4, 0.5], [5, 1], [4, 1], [2, 1], [1, 1], [0, 2]],
  // la cartógrafa: pregunta que sube con puntillo, mira lejos y baja a la tercera
  cartografa: [[0, 0.5], [2, 0.5], [4, 1], [5, 0.75], [4, 0.25], [6, 1], [4, 1], [3, 1], [2, 2]],
  // El Quiebre: quinta, sexta menor, y la caída a la segunda bemol antes de la tónica
  quiebre: [[0, 1.5], [4, 0.5], [5, 1], [4, 1], [1, 1.5, -1], [0, 2.5]],
};

const E = null;
export const PIECES = {
  // Ciudad: refugio. Sol mayor en 3/4, vals lento y cálido; de noche, flauta sola y piano bajito.
  city: {
    root: 55, mode: 'ionian', meter: 3, bpm: 72, base: 0.45, motifs: ['isla'], motifP: 0.3, rest: 0.4, reverb: 'open',
    form: ['A', 'A2', 'B', 'A2'], sections: { A: ['1', '6', '4', '5'], A2: ['1', '3', '4', '5s4'], B: ['6', '4', '1', '5'] },
    layers: [
      { role: 'pad', inst: 'pad', at: 0, vol: 0.55, oct: 0 },
      { role: 'bass', inst: 'piano', at: 0.1, vol: 0.55, oct: -12, pat: [0, E, E, E, 2, E] },
      { role: 'arp', inst: 'pizz', at: 0.35, vol: 0.4, oct: 12, pat: [E, E, 1, E, 2, E], night: false },
      { role: 'arp', inst: 'piano', at: 0.25, vol: 0.32, oct: 12, pat: [E, E, 2, 1, 3, E] },
      { role: 'melody', inst: 'piano', at: 0.3, vol: 0.5, oct: 12, night: false },
      { role: 'melody', inst: 'flute', at: 0.3, vol: 0.42, oct: 12, night: true },
      { role: 'perc', inst: 'brush', at: 0.7, vol: 0.5, pat: [E, E, 0.6, E, 0.4, E], night: false },
    ],
    night: { bpm: 62, base: -0.15, rest: 0.55 },
  },
  // Pantallas tranquilas: Fa mayor, lento, piano y colchón.
  calm: {
    gain: 1.1, root: 53, mode: 'ionian', meter: 4, bpm: 60, base: 0.4, motifs: ['isla'], motifP: 0.2, rest: 0.5, reverb: 'interior',
    form: ['A', 'B'], sections: { A: ['17', '67', '47', '5'], B: ['27', '47', '17', '5s4'] },
    layers: [
      { role: 'pad', inst: 'pad', at: 0, vol: 0.45, oct: 0 },
      { role: 'arp', inst: 'piano', at: 0.1, vol: 0.38, oct: 0, pat: [0, E, 2, E, 3, E, 1, E] },
      { role: 'melody', inst: 'piano', at: 0.3, vol: 0.42, oct: 12 },
    ],
  },
  // Expedición, cerca: Re dórico, curiosidad, pizzicato que camina y flauta.
  expedition: {
    gain: 1.3, root: 50, mode: 'dorian', meter: 4, bpm: 86, base: 0.45, motifs: ['cartografa', 'isla'], motifP: 0.3, rest: 0.35, reverb: 'open',
    form: ['A', 'A', 'B', 'A'], sections: { A: ['1', '4', '1', '7'], B: ['3', '4', '5s4', '1'] },
    layers: [
      { role: 'pad', inst: 'pad', at: 0, vol: 0.45, oct: 0 },
      { role: 'bass', inst: 'pizz', at: 0.1, vol: 0.55, oct: 0, pat: [0, E, E, E, 2, E, E, E] },
      { role: 'arp', inst: 'pizz', at: 0.3, vol: 0.38, oct: 12, pat: [E, 1, E, 2, E, 1, 3, E] },
      { role: 'melody', inst: 'flute', at: 0.35, vol: 0.45, oct: 12 },
      { role: 'perc', inst: 'brush', at: 0.55, vol: 0.5, pat: [E, E, 0.5, E, E, E, 0.5, 0.3] },
      { role: 'perc', inst: 'timp', at: 0.75, vol: 0.45, pat: [0.7, E, E, E, E, E, E, E] },
    ],
    night: { bpm: 74, base: -0.12, rest: 0.5 },
  },
  // Expedición, lejos: Re eólico, escaso y con niebla; dron, piano grave y flauta que aparece poco.
  expedition_far: {
    gain: 1.2, root: 50, mode: 'aeolian', meter: 4, bpm: 66, base: 0.3, motifs: ['cartografa', 'quiebre'], motifP: 0.25, rest: 0.6, reverb: 'cave',
    form: ['A', 'B'], sections: { A: ['1', '6', '1', '7'], B: ['4', '1', '6', '5'] },
    layers: [
      { role: 'drone', inst: 'pad', at: 0, vol: 0.5, oct: -12 },
      { role: 'bass', inst: 'piano', at: 0.1, vol: 0.45, oct: -12, pat: [0, E, E, E, E, E, E, E] },
      { role: 'arp', inst: 'piano', at: 0.35, vol: 0.3, oct: 12, pat: [E, E, 2, E, E, E, 1, E] },
      { role: 'melody', inst: 'flute', at: 0.25, vol: 0.38, oct: 12 },
      { role: 'choir', inst: 'choir', at: 0.7, vol: 0.35, oct: 0 },
    ],
  },
  // Amenaza: La menor armónica, tensión contenida: timbal que late y pizzicato grave.
  threat: {
    root: 45, mode: 'harmonic', meter: 4, bpm: 84, base: 0.55, motifs: [], motifP: 0, rest: 0.45, reverb: 'open',
    form: ['A', 'B'], sections: { A: ['1', '1', '6', '5'], B: ['4', '5', '1', '5'] },
    layers: [
      { role: 'pad', inst: 'pad', at: 0, vol: 0.45, oct: 0 },
      { role: 'perc', inst: 'timp', at: 0.1, vol: 0.55, pat: [0.8, E, E, E, 0.5, E, E, E] },
      { role: 'arp', inst: 'pizz', at: 0.3, vol: 0.4, oct: 12, pat: [0, 0, 2, 0, 1, 0, 2, 0] },
      { role: 'melody', inst: 'flute', at: 0.5, vol: 0.38, oct: 12 },
      { role: 'choir', inst: 'choir', at: 0.8, vol: 0.3, oct: 0 },
    ],
  },
  // La mina sellada: Do frigio, oscuro, piano grave y respiraciones del coro.
  mine: {
    root: 48, mode: 'phrygian', meter: 4, bpm: 56, base: 0.35, motifs: ['quiebre'], motifP: 0.2, rest: 0.6, reverb: 'mine',
    form: ['A'], sections: { A: ['1', '2', '1', '7'] },
    layers: [
      { role: 'drone', inst: 'pad', at: 0, vol: 0.5, oct: -12 },
      { role: 'arp', inst: 'piano', at: 0.15, vol: 0.32, oct: 0, pat: [0, E, E, E, E, E, 1, E] },
      { role: 'melody', inst: 'piano', at: 0.35, vol: 0.35, oct: 12 },
      { role: 'choir', inst: 'choir', at: 0.6, vol: 0.3, oct: 0 },
    ],
  },
  // Costa de los Faros: Mi eólico en 3/4, bruma; la flauta canta sobre el mar.
  coast: {
    root: 52, mode: 'aeolian', meter: 3, bpm: 66, base: 0.4, motifs: ['cartografa', 'isla'], motifP: 0.3, rest: 0.45, reverb: 'open',
    form: ['A', 'B'], sections: { A: ['1', '6', '3', '7'], B: ['4', '1', '7', '1'] },
    layers: [
      { role: 'pad', inst: 'pad', at: 0, vol: 0.5, oct: 0 },
      { role: 'arp', inst: 'piano', at: 0.15, vol: 0.34, oct: 0, pat: [0, E, 2, E, 3, E] },
      { role: 'melody', inst: 'flute', at: 0.3, vol: 0.45, oct: 12 },
      { role: 'bass', inst: 'pizz', at: 0.5, vol: 0.45, oct: 0, pat: [0, E, E, E, E, E] },
    ],
  },
  // El Bajo Mundo: Si frigio, grave y disonante; sin sol.
  under: {
    root: 47, mode: 'phrygian', meter: 4, bpm: 50, base: 0.4, motifs: ['quiebre'], motifP: 0.35, rest: 0.55, reverb: 'under',
    form: ['A'], sections: { A: ['1', '2', '7', '1'] },
    layers: [
      { role: 'drone', inst: 'pad', at: 0, vol: 0.55, oct: -12 },
      { role: 'choir', inst: 'choir', at: 0.1, vol: 0.35, oct: 0 },
      { role: 'perc', inst: 'timp', at: 0.3, vol: 0.5, pat: [0.8, E, E, E, E, E, E, E] },
      { role: 'arp', inst: 'piano', at: 0.4, vol: 0.3, oct: -12, pat: [0, 1, E, E, E, E, E, E] },
      { role: 'melody', inst: 'flute', at: 0.6, vol: 0.32, oct: 0 },
    ],
  },
  // Combate (paso 5): Re menor armónica, pulso y percusión que suben con el peligro (intensidad).
  battle: {
    gain: 1.4, root: 50, mode: 'harmonic', meter: 4, bpm: 108, base: 0.5, motifs: ['quiebre'], motifP: 0.15, rest: 0.25, reverb: 'open',
    form: ['A', 'A', 'B', 'A'], sections: { A: ['1', '6', '4', '5'], B: ['1', '6', '2', '5'] },
    layers: [
      { role: 'perc', inst: 'timp', at: 0, vol: 0.6, pat: [0.9, E, E, 0.4, 0.7, E, E, E] },
      { role: 'bass', inst: 'pizz', at: 0.1, vol: 0.55, oct: 0, pat: [0, 0, 0, 0, 0, 0, 2, 0] },
      { role: 'pad', inst: 'pad', at: 0.25, vol: 0.45, oct: 0 },
      { role: 'arp', inst: 'pizz', at: 0.4, vol: 0.38, oct: 12, pat: [2, 1, 2, 3, 2, 1, 2, 0] },
      { role: 'melody', inst: 'flute', at: 0.5, vol: 0.45, oct: 12 },
      { role: 'perc', inst: 'brush', at: 0.6, vol: 0.55, pat: [E, 0.4, 0.7, 0.4, E, 0.4, 0.7, 0.4] },
      { role: 'choir', inst: 'choir', at: 0.8, vol: 0.38, oct: 0 },
    ],
  },
  // Modo épico (intro, jefes, revelaciones): Re eólico, coro, timbales y el motivo de El Quiebre.
  epic: {
    root: 50, mode: 'aeolian', meter: 4, bpm: 70, base: 0.85, motifs: ['quiebre'], motifP: 0.8, rest: 0.2, reverb: 'hall', epic: true,
    form: ['A', 'B'], sections: { A: ['1', '6', '3', '7'], B: ['4', '6', '5', '1'] },
    layers: [
      { role: 'drone', inst: 'pad', at: 0, vol: 0.55, oct: -12 },
      { role: 'pad', inst: 'pad', at: 0, vol: 0.5, oct: 0 },
      { role: 'choir', inst: 'choir', at: 0.2, vol: 0.45, oct: 0 },
      { role: 'bass', inst: 'piano', at: 0.3, vol: 0.55, oct: -12, pat: [0, E, E, E, 0, E, E, E] },
      { role: 'perc', inst: 'timp', at: 0.4, vol: 0.65, pat: [1, E, E, E, 0.6, E, 0.5, 0.5] },
      { role: 'melody', inst: 'flute', at: 0.3, vol: 0.5, oct: 12 },
      { role: 'arp', inst: 'pizz', at: 0.6, vol: 0.35, oct: 12, pat: [0, 2, 3, 2, 0, 2, 3, 2] },
    ],
  },
};
// capas que el modo épico suma a cualquier pieza (si no las tiene)
export const EPIC_LAYERS = [
  { role: 'choir', inst: 'choir', at: 0, vol: 0.4, oct: 0, epic: true },
  { role: 'perc', inst: 'timp', at: 0, vol: 0.6, pat: [1, null, null, null, 0.6, null, null, null], epic: true },
  { role: 'drone', inst: 'pad', at: 0, vol: 0.45, oct: -12, epic: true },
];
// nombres viejos de pista (escenas y amenaza) → pieza
export const ALIAS = { game: 'calm', drive: 'expedition', home: 'calm', intro: 'epic', quiebre: 'epic', expedition_near: 'expedition' };

// Stingers (K3): frases cortas atadas a eventos. Notas en semitonos desde la tónica de la pieza que suena (o Do),
// en segundos; s = muestra suelta que acompaña. duck = cuánto baja la música mientras suena.
export const STINGERS = {
  hallazgo: { duck: 0.45, notes: [['pizz', 0, 0, 0.3], ['pizz', 4, 0.09, 0.3], ['pizz', 7, 0.18, 0.3], ['flute', 12, 0.27, 0.9, 0.55]], s: [['ui/glass1', 0.25, 0.5]] },
  pagina: { duck: 0.6, notes: [['piano', 7, 0.12, 0.8, 0.45], ['piano', 4, 0.42, 1.2, 0.4]], s: [['act/bookFlip1', 0, 0.7]] },
  elemento: { duck: 0.35, notes: [['choir', -5, 0, 2.2, 0.6], ['piano', 0, 0, 1.5], ['piano', 7, 0.15, 1.5], ['piano', 16, 0.3, 1.8, 0.55]], s: [['ui/glass1', 0, 0.6]] },
  rango: { duck: 0.35, notes: [['piano', 0, 0, 1.2], ['piano', 4, 0.12, 1.1], ['piano', 7, 0.24, 1.1], ['flute', 12, 0.36, 0.5], ['flute', 14, 0.6, 0.3], ['flute', 16, 0.75, 1.2]] },
  epoca: { duck: 0.25, notes: [['timp', -24, 0, 2, 0.9], ['choir', -5, 0.05, 2.8, 0.7], ['piano', -12, 0.05, 2], ['piano', 0, 0.05, 2], ['piano', 7, 0.3, 2], ['piano', 12, 0.55, 2.2], ['flute', 16, 0.8, 1.6, 0.6]] },
  amenaza: { duck: 0.4, notes: [['timp', -24, 0, 1.5, 0.85], ['timp', -24, 0.45, 1.5, 0.6], ['pizz', 1, 0.2, 0.4, 0.6], ['pizz', 0, 0.5, 0.6, 0.6]] },
  victoria: { duck: 0.3, notes: [['timp', -24, 0, 1.2, 0.7], ['pizz', 0, 0, 0.3], ['pizz', 4, 0.1, 0.3], ['pizz', 7, 0.2, 0.3], ['piano', 12, 0.3, 1.4], ['flute', 19, 0.42, 1.2, 0.55]] },
  derrota: { duck: 0.3, notes: [['piano', 7, 0, 0.8], ['piano', 3, 0.35, 0.8], ['piano', 0, 0.7, 0.9], ['piano', -5, 1.05, 1.6], ['pad', -12, 0, 2]] },
  nivel: { duck: 0.45, notes: [['pizz', 0, 0, 0.3], ['pizz', 7, 0.08, 0.3], ['flute', 12, 0.16, 0.7, 0.5]] },
  // los más chicos (los usan efectos de siempre: done, win, lose, star, gem)
  hecho: { duck: 0.7, notes: [['piano', 0, 0, 0.5, 0.5], ['piano', 4, 0.07, 0.5, 0.5], ['piano', 7, 0.14, 0.8, 0.55]], s: [['ui/confirmation1', 0, 0.35]] },
  logro: { duck: 0.6, notes: [['pizz', 0, 0, 0.3], ['pizz', 4, 0.07, 0.3], ['pizz', 7, 0.14, 0.3], ['piano', 12, 0.21, 1.1, 0.55]] },
  tropiezo: { duck: 0.7, notes: [['piano', 3, 0, 0.5, 0.45], ['piano', -2, 0.2, 0.9, 0.4]] },
  estrella: { duck: 0.8, notes: [['piano', 19, 0, 0.6, 0.45]], s: [['ui/glass1', 0, 0.35]] },
  gema: { duck: 0.75, notes: [['piano', 12, 0, 0.4, 0.4], ['piano', 16, 0.05, 0.4, 0.4], ['piano', 19, 0.1, 0.4, 0.4], ['piano', 24, 0.15, 0.8, 0.45]] },
};
