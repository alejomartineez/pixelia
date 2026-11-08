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
| 1 | 0: cáscara Tauri, `desktop:dev`, instalador `.exe`, Actions Win+Mac | **siguiente** | |
| 2 | A + E8 + G: logo Dezings, textos, "Tocá" → "Hacé clic", Ajustes completos | pendiente | |
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

## Pendiente o frágil
- (nada todavía)
