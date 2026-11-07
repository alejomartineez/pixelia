# Fase 1 — Expedición: traspaso

Rama `claude/fase1-expedicion-f4320a` (sin push). Contrato y números: DESIGN-CORE.md §2 y §8 (actualizados en este commit).

## Hecho
- `src/expedition/exp-data.js`, `exp-gen.js`, `exp-rules.js`: datos, generador con semilla y motor puro (sin DOM ni
  three.js, determinista, `run` es JSON y se guarda en `state.expedition.active`), según §2.11.
- `exp-scene.js` + `exp-ui.js`: escena `expedition` jugable (`?scene=expedition`, `&short=1`, `&region=sierras&zone=3`,
  `&new=1`, `&seed=N`). Diorama vóxel (terrenos, manto de niebla que se levanta, zona dorada del objetivo, río con vado,
  props por casilla + íconos), grupo (tu personaje + 3, con aro), rótulos de costo en las vecinas ("sin vuelta" en rojo),
  tarjeta de decisión con %, costos, "si sale mal" y la línea de detalle; la cámara sube el diorama cuando se abre;
  barra de provisiones/ánimo/carga, objetivo, Volver siempre visible (confirma si es fracaso), menú con Esc, resultado
  con estrellas y botín en palabras. Toques, clic, flechas/WASD (la flecha queda en cola durante la animación), 1–4 en
  la tarjeta. Festejo (confeti + 'win') solo al cumplir el objetivo. Música 'expedition' si existe, si no 'calm'.
  Emite `expedition:started/decision/finished` con `prototype: true`.
- `tools/sim-expedition.mjs` (`npm run sim:expedition`; `--only proto`, `--kind corta`, `--n`, `--trace i --bot medio`).
- `tools/test-expedition.mjs` (en `npm test`) y la escena en `tools/test-stress.mjs`.
- DESIGN-CORE.md: cambios de calibración (barrera con vado, imprevistos, "+10 con cuidado", carga llena, ánimo 8/10,
  cansancio cada 5, provMax 18–30, corta 12 con mochila chica, fallos que cuestan provisiones, mirador en cuadrado…).

## Resultado actual
- Simulador, prototipo (Bosque z1, Exploración+Ingeniería+Sanidad nv1, 24 prov, carga 15, 1000 salidas por bot): todo ✔
  con las metas efectivas. Prudente fracasa 0%, objetivo 82%; medio 3★ 36%; codicioso fracasa 15%; 14,8 pasos
  (p10–p90 11–20); 12,2 materiales, 0,44 planos, 1,34 hallazgos; "seguir" > "volver" en 38%. Corta: prudente objetivo
  87%, medio 3★ 22%, 8 pasos. Sin roles 3★ 9%, con los 3 roles 40%.
- Tests: `test-expedition.mjs` 30/30 en iPhone y en PC. `test-stress.mjs`: vuelta 1 limpia con la expedición incluida
  (22/22 escenas, 198/198 paneles); **no llegué a ver las 3 vueltas ni `npm test` completo** (los corté por el traspaso).

## Falta (pasos concretos)
1. `cd tools && npm test` completo y confirmar verde (sobre todo las 3 vueltas de fugas de `test-stress.mjs`).
2. Si algo falla en estrés: revisar `unmount` de `exp-scene.js` (texturas de íconos en `texCache`, `hlMats`, `hintMat`,
   `ringGeo/ringMat`; listeners de `keydown`/`resize`).
3. Commit final con el resumen; la coordinadora suma los 5 .js nuevos al precache (`npm run bump`).
4. (Opcional) Jugar 2–3 salidas más tras los últimos cambios (garantía de material en "juntar", cola de flechas).

## Problemas conocidos
- Dos metas de §8 se aceptaron corridas (explicado en §8): prudente objetivo 82% (no 85) y codicioso fracasa 15% (no
  30–50) porque el regreso siempre está a la vista; con menos ayudas (sin Sanidad, tier 3+) sube a 35–55%.
- El codicioso rinde ~10% más que el medio: apurar paga, con varianza.
- El nivel de rol (+3 por nivel) casi no mueve los números: la Fase 2 podría subirlo a +5.
- "Carga llena" se queda seguido en 14/15: es el "casi" que empuja a otra salida, pero vigilarlo.
- En headless a 1366×800 los cuadros son lentos y las animaciones tardan (las tweens dependen de dt con tope 0,05).
- Algunas salidas fáciles (3★ en 10 pasos con 8 provisiones de sobra) cuando el objetivo queda cerca de la zona marcada.

## ¿Está la diversión?
Jugué 10 salidas a mano (7 normales Bosque/Sierras, 2 cortas, 1 fracaso a propósito): 4 × 3★, 4 × 2★, 1 × 1★, 1 fracaso.
Sí: las mejores salidas tuvieron decisiones con peso (cruzar al 75% o ir al vado, revisar una ruina con el ánimo justo,
usar el campamento para salvar la estrella, la tormenta al 47% para completar la carga con la vuelta justa). Se entiende
sin explicación: número de costo en cada vecina, "sin vuelta" en rojo, % grande con de dónde sale. Lo flojo: rachas de
fallos al 75–85% frustran (mitigado con "+10 con cuidado"), y algunos mapas salen fáciles. Recomiendo seguir a la Fase 2.
