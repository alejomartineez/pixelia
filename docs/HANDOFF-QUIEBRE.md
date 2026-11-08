# Handoff · El Quiebre (Pixelia para PC, historia, combate, logo Dezings)

Plan completo y aprobado: [PLAN-QUIEBRE.md](PLAN-QUIEBRE.md). Este archivo dice **dónde quedó**; se actualiza al cerrar
cada paso.

## Reglas de trabajo (vienen del usuario)
- **Autonomía total.** No hace falta pedir permiso: instalar Rust y las Build Tools, commit y push a `master`, tags,
  releases y secrets con `gh`. Siguen valiendo las reglas de CLAUDE.md: no tocar el otro proyecto de Supabase, nunca usar
  `service_role`, y `npm run bump` antes de cada commit que cambie archivos del juego.
- **Contexto.**
  - Al pasar el 40–45 % de contexto: terminar la unidad en curso, hacer commit, actualizar este archivo y seguir en una
    **sesión nueva fresh** (no un fork).
  - El brief de esa sesión es: "leé `docs/PLAN-QUIEBRE.md` y `docs/HANDOFF-QUIEBRE.md`, seguí desde el paso N y aplicá
    esta misma regla".
- **Calidad.**
  - Guiar lo esencial, no todo.
  - Las mecánicas tienen que ser creativas, enganchantes y balanceadas: sección I del plan.
  - Ajustes completos: sección G.
- En la raíz hay una carpeta sin seguimiento, `pixelia/`: es una copia vieja. No sumarla a los commits.

## Estado
| Paso | Qué | Estado | Commit |
|---|---|---|---|
| — | Plan y handoff en `docs/` | hecho | (este commit) |
| 1 | 0: cáscara Tauri, `desktop:dev`, instalador `.exe`, Actions Win+Mac | hecho | a1f502e (v25) |
| 2a | A: logo Dezings | hecho | (commit v26) |
| 2b | E8: textos viejos, "Tocá" → "Hacé clic", pistas de misiones (`hintFor`, que adelanta E2) | hecho | (commit v26) |
| 2c | G: Ajustes completos, más el ajuste de la ventana al monitor | **siguiente** | |
| 3 | D + E1–E4 + E7 + H: motor de historia, Bitácora con el Manual, prólogo, tutorial, primeros contactos | pendiente | |
| 4 | B: cinemática "El Quiebre" | pendiente | |
| 5 | C: combate táctico (motor y tests, escena e interfaz, casilla `enemigo`) | pendiente | |
| 6 | Acto 1 completo + E5–E6 | pendiente | |
| 7 | Balance (`sim-combat`, `sim:economy`), telemetría y primer release | pendiente | |

## Decisiones tomadas
- Plataforma:
  - Tauri v2 para Windows y macOS.
  - Los instaladores se compilan en GitHub Actions, porque el usuario no tiene Mac.
  - Sin firma por ahora.
  - Se distribuye por GitHub Releases con el actualizador.
  - La web de Pages queda sin mantenimiento.
  - Supabase sigue.
- Historia:
  - La columna vertebral es el misterio de la isla, con momentos épicos.
  - La ciudad sigue cozy.
  - El canon borrador está en el plan, y el usuario lo puede ajustar.
- Combate: táctico por turnos, en grilla de 8×8.
- Intro: cinemática 3D en vóxel.

## Lo que quedó hecho, para no rehacerlo
**Paso 1: escritorio**
- `desktop/` usa Tauri v2.
- `desktop/stage.mjs` copia el juego a `desktop/dist` y toca `lib.rs`, porque si no cargo no vuelve a embeber los archivos.
- `src/core/desktop.js`:
  - `isDesktop` / `ctx.desktop`, que también se prende con `?desktop`;
  - F11, y Ctrl+Cmd+F en Mac;
  - `setFullscreen()` / `isFullscreen()`, que esperan los Ajustes;
  - busca actualizaciones 8 s después de arrancar.
- En escritorio no hay service worker ni tarjeta de instalar.
- **Clave del actualizador:**
  - privada en `~/.tauri/pixelia-updater.key`, sin contraseña;
  - pública en `tauri.conf.json`;
  - secret del repo: `TAURI_SIGNING_PRIVATE_KEY`.
- **CI** (`.github/workflows/desktop.yml`):
  - Con tag `v*`, arma un borrador de release para Windows y Mac (universal).
  - El modo manual (`gh workflow run desktop.yml`) hace `win-check` (artefacto `windows-setup`) y `mac-smoke` (artefacto
    `mac-smoke` con capturas).
  - La corrida 42521705177 quedó en verde en las dos plataformas, y Mac abre y renderiza el juego.
- `tools/test-desktop.mjs` abre el `.exe` compilado con CDP (puerto 9333) y verifica:
  - el origen `http://tauri.localhost`;
  - `__TAURI__.updater`;
  - que no haya service worker;
  - `localStorage`;
  - que el clic arranque el onboarding;
  - que Supabase responda 200.
- `npm run bump` sincroniza `desktop/` (`pixelia-vN` pasa a `0.N.0`), y `npm run release` crea el tag.
- **Pasar la partida.** Ya existía Exportar/Importar en Ajustes, con un código. Faltaría ofrecerlo también como archivo
  `.json` en el paso 2c.

**Paso 2a: logo**
- `tools/make-logo.mjs` genera `studioHtml()`: un cubo vóxel isométrico y DEZINGS letra por letra. Los colores salen de
  variables CSS.
- Se inyecta con `node tools/make-logo.mjs --inject`, entre `<!--logo-studio-->` en `index.html`.
- La capa `#studio` va antes del splash:
  - dura 1,5 s la primera vez y 0,84 s después (flag `pixelia.studio` en `localStorage`);
  - se saltea con un clic o una tecla (la tecla no llega al juego);
  - con `?nosplash` o `?scene=` no aparece;
  - `?studio=<variante>` y `?studiohold` sirven para las capturas.
- **Variante elegida: `st-dez`**, el azul de Dezings (`#3d55b8`) con blanco, porque el usuario mandó ese color. Las demás
  (`st-brasa`, `st-cefiro`, `st-veta`) quedan en el CSS. Las capturas están en `shots/logo/`, que no se sube al repo.
- **Sonido.** Un golpe al caer el cubo y un brillo, sintetizados en el script inline. Suenan solo si el `AudioContext`
  arranca en `running` (en la app de PC sí) y respetan `settings.sfx === false` y `settings.volSfx` (0..1).
  **El paso 2c tiene que crear `volSfx`.**
- "Un juego de Dezings" va al pie del splash. Ajustes todavía no lo muestra: va en el paso 2c.

**Paso 2b: textos**
- "Tocá…" pasa a "Hacé clic…" en los textos del juego.
- Se dejaron como estaban:
  - las instrucciones de iPhone;
  - la rama `touch ?` de `city-place.js`;
  - el dicho "se mira, no se toca".
- Meta y manifest sin minijuegos.
- Consejos de carga sin diminutivos.
- Lema nuevo del splash: "Reconstruí lo que quedó".
- `hintFor` cubre todos los tipos de objetivo.
- **Falta:** el "Cómo jugar" viejo (`openHelp`) sigue con diminutivos; se reemplaza por el Manual en el paso 3 (H).

## Pendiente o frágil
- **Ventana en monitores chicos.** Mide 1280×800 y en una pantalla de 1024×768 se sale. Hay que ajustarla al monitor al
  abrir, en `lib.rs` (`setup`: `current_monitor` y escalar) o desde JS. Va en el paso 2c, junto con "Pantalla".
- **Paso 2c**, puntos para recordar:
  - la API del renderer (`createPixelRenderer` en `src/core/voxel.js`: `setMaxFps`, `setOutline`, `lowQuality`) y cómo
    aplicar los cambios a las escenas montadas (eventos del bus, por ejemplo `settings:changed`);
  - las ganancias separadas de `src/core/audio.js`;
  - que hoy `?quality` y `?outline` solo existen como atajos de URL.
- `desktop:dev` todavía no se probó en ventana; sí se probó el `.exe` de release con `test-desktop.mjs`.
- No hay release publicado. El primero va en el paso 7.
