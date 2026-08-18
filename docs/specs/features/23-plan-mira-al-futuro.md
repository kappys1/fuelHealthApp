# F23 · Plan mira al futuro (vista previa de pautas y días especiales)

**Estado**: **aprobada**, pendiente de implementar · **Tamaño**: pequeña (2 fases)
**Fecha**: 2026-08-09 · **Origen**: sesión de grilling del 2026-08-09 sobre la competición
del 11-13-sep. La feature que Alex pedía («modo competición») resultó estar construida al
80 %; lo que falta es que el Plan pueda mirar más allá de hoy.

## Motivación (dos casos reales, con fecha)

**1 · Una pauta que no puedes revisar hasta que ya rige.** Regenera pauta 2.000 kcal desde
el **21-ago** y una pauta de noche previa de 2.200 para el **10-sep**. Ambas se pueden crear
hoy: `dietVersionCreateZ.effectiveFrom` no tiene tope superior y `getVersionForDate` usa
`lte(effective_from, date)`, así que una versión futura duerme hasta su día. Pero
**`plan/page.tsx:29` llama a `getPlanContext(today)`**, así que el Plan siempre muestra la
versión vigente hoy. Importas el día 10 con F-IA-9 y **no puedes comprobar que la IA leyó
bien la foto hasta el 21**. Si leyó mal un número, te enteras el día que entra en vigor.

**2 · Una fase que no puedes marcar hasta que ya es tarde.** La competición es el 11, 12 y
13-sep. `phase='competicion'` ya tiene comportamiento real (gauge neutro, chips de
repostaje, exclusión de adherencia e ingesta media, protección de `ma7` del día y los 2
siguientes, línea de contexto para la IA). Pero la fase se marca desde `today-context.tsx:418`,
dentro de Hoy, y **Hoy tiene un tope duro en el presente**:

```js
// hoy-client.tsx:150-151
const next = shiftDayKey(date, delta);
if (next > today) return;
```

No puedes marcar el 11-sep como competición hasta que sea 11-sep — el día en que ya no te
sirve haberlo planificado.

## Lo que YA existe (verificado, no hay que construirlo)

| Pieza | Estado |
|---|---|
| `getPlanContext(date)` | ya recibe fecha (`plan.ts:89`) |
| `addPlanOption(date, opt)` | resuelve versión por fecha (`mutations.ts:276-278`) |
| `POST /api/plan/options` | acepta `date` opcional en el body |
| `PATCH`/`DELETE /api/plan/options/:id` | por id, agnósticos de versión |
| `POST /api/plan/version` | `effective_from` libre, sin tope |
| `PATCH /api/day` | acepta `phase` en cualquier `dateZ`, sin tope |
| `listAllDietVersions()` | ya existe para Historial (`plan.ts:70`) |
| Navegación a semanas futuras | ya existe en Plan · Entrenos desde F17 (`299ce76`) |

**El servidor ya soporta todo.** Lo que falta es pantalla.

## Alcance

### Fase 1 · Vista previa solo-lectura de versiones futuras (Plan · Dieta)

En el segmento **Dieta**, cuando exista al menos una `diet_version` con
`effective_from > today`, mostrar un bloque que liste esas versiones con su fecha de entrada
en vigor y permita **abrir cada una en solo-lectura**: objetivos (kcal/P/C/G) y sus opciones
por comida, exactamente como se ven las de la versión vigente pero sin afordances de edición.

- **Solo-lectura, decidido**: cubre el riesgo real —cazar un error de lectura de F-IA-9 antes
  de que rija— con la mitad de trabajo. Si hay un error: borrar la versión y reimportar.
- La versión **vigente** sigue siendo la que manda en la pantalla; la futura es un anexo
  claramente subordinado, nunca el contenido principal.
- Debe declarar la fecha: «Entra en vigor el 21-ago», no un chip ambiguo.

### Fase 2 · Bloque «Días especiales» (Plan · Dieta)

Bloque en el segmento **Dieta** que lista los días con fase marcada de hoy en adelante y
permite **marcar/desmarcar la fase de un día futuro** (carga · competición · recuperación).

- **Va en Dieta, no en Entrenamientos**, aunque la rejilla de días viva allí: una fase es una
  dimensión **nutricional** y `plan-screen.tsx:15-16` declara que los segmentos existen para
  *«separar lo que como de lo que entreno»*. Poner el chip en Entrenamientos porque es donde
  hay una rejilla es la decisión que dentro de seis meses nadie entiende.
- Escribe por `PATCH /api/day` con la fecha futura; crea la fila de `days` si no existe.
- La secuencia sugerida `PHASE_NEXT` (`macros.ts:471-472`) sigue aplicando en Hoy; este
  bloque no la duplica.

## No-alcance (deliberado)

- **Editor de versiones futuras.** Solo-lectura primero; editor solo si muerde en uso real.
- **Navegación al futuro en Hoy.** Hoy es la pantalla del ahora (09 §6). El tope de
  `hoy-client.tsx:150` **se queda**.
- **Chip de fase en el segmento Entrenamientos** (ver arriba).
- **Concepto de «pauta de un día».** `diet_versions` es una función escalón y así se queda:
  una pauta de un día se modela como versión + versión de restauración al día siguiente
  (ver DECISIONS #90). Reabrir solo con evidencia de que el patrón se repite.

## Radio de impacto (verificado)

Crear una fila de `days` con fecha futura **no envenena la analítica**. Comprobado uno por uno:

- `computeAdherence` — doble acotado y exige registro: `r.logged && r.date >= lo && r.date <= today` (`adherence.ts:39-41`).
- `computeLoggingStreak` — camina hacia atrás desde hoy y exige `logged` (`progressSummary.ts:126-133`).
- `eligibleWeightSeries` — exige `weight != null` (`ma7.ts:31-34`).
- `computeDeficit` — ventana explícita, la decide quien llama.

Un día futuro con solo `phase` tiene `logged: false` y sin peso: es invisible para las cuatro.

**Riesgo abierto, a verificar al implementar**: `allDates` en `trend.ts:129-133` se construye
como unión de `days` ∪ `health` ∪ `entries` **sin tope superior**. El gráfico de **ingesta**
podría pintar un 0 en una fecha futura marcada. El de peso está cubierto desde F22 (`02fecff`).

## Criterios de aceptación

1. 🖐 Con una versión de dieta creada con `effective_from` futuro, Plan · Dieta la lista con su
   fecha y permite abrirla en solo-lectura, sin afordances de edición.
2. 🖐 La versión vigente sigue mandando en la pantalla; la futura no la sustituye ni la tapa.
3. Sin versiones futuras, el segmento Dieta es **idéntico** a hoy (sin bloque vacío).
4. 🖐 Desde «Días especiales» se marca el 11, 12 y 13-sep como competición estando en agosto,
   y al llegar el día Hoy muestra el modo competición sin intervención adicional.
5. Marcar una fase futura no altera adherencia, racha, ingesta media, TDEE ni el gráfico de
   peso (test de regresión con un día futuro en los `records`).
6. El gráfico de ingesta no pinta un punto en una fecha futura sin entradas.
7. Hoy sigue sin navegar al futuro.
