# F20 · Franja mañana/tarde: gasolina de sesión en el sitio correcto
**Estado**: implementada · validación 🖐 pendiente · **Tamaño**: feature
**Fecha**: 2026-07-26 · **Origen**: Alex revisando Ajustes «Sesión por día de la semana»
(2026-07-26): «esto de aquí no tiene sentido, ¿no?». Deriva en el bug de la gasolina de
sesión los sábados. Captura en `docs/HANDOFF-features.md` §B3.

**Aprobada por Alex el 2026-07-26. Enmendada tras revisión técnica el 2026-07-26, sin
cambiar la decisión de producto: patrón habitual mañana/tarde + override por sesión.**

## Motivación (caso real)

Tras F17, la sesión canónica de cada fecha vive en `training_sessions` (importada de The
Progrm o manual). La pantalla de Ajustes «Sesión por día de la semana» quedó como un mapeo
fijo día→**etiqueta de contenido** (`Lunes = T1 · Halterofilia + WOD`…) que:

- **Es ficción**: la semana de Alex cambia cada semana y el contenido real viene del import,
  no del patrón. Las etiquetas no coinciden nunca con la realidad.
- Solo entra ya como **fallback** cuando un día no tiene sesión registrada (`checkins.tsx`,
  `context.ts`, `coach/route.ts`). Es decir, casi nunca.

El daño real está en el fueling. El Coach conoce hoy una franja horaria global —
`athleteProfile.franjaEntreno = "19:30-21:30"`— tanto en `athleteContext` como en el cálculo
determinista de cierre del día (`coach/route.ts` → `trainingTiming`). Alex entrena L–V de
tarde y **sábados por la mañana**. Cuando le pide al Coach «ayúdame a preparar qué comer
para tener gasolina» un sábado, el sistema coloca el hidrato pre-entreno en
comida/merienda, cuando la sesión ya fue por la mañana. **Optimiza el fueling para la franja
equivocada la mitad de los findes.**

Decisión de Alex: la franja se modela en **mañana/tarde** (basta para decidir dónde va la
gasolina), con un **patrón habitual** por día (estable: L–V tarde, S mañana) y **override por
sesión** para los días que se mueven (verano/fiestas: «yo lo haría si no es mucho»).

## Alcance

### A · Patrón habitual por día (reforma la pantalla de Ajustes)

- La setting antigua `sessionByWeekday: Record<día, etiqueta-contenido>` se sustituye por la
  nueva y única `trainingByWeekday: Record<día, "mañana" | "tarde" | "descanso">`.
- La pantalla de Ajustes deja de listar 7 desplegables de contenido y pasa a 7 filas
  `mañana / tarde / descanso` (un control por día).
- `trainingDaysPerWeek` deriva días/semana como nº de valores ≠ `descanso`; la setting nueva
  es la única fuente habitual para esa cifra de IA.
- La migración deja `trainingByWeekdayReviewed = false`. Ajustes muestra «Revisa tus
  franjas, sobre todo el sábado» hasta que Alex guarda el patrón una vez; ese PATCH guarda
  también `trainingByWeekdayReviewed = true` y el aviso desaparece. No se hardcodea que el
  sábado sea mañana: Alex confirma su dato vigente (principio 9).

### B · Franja por sesión (Entrenos)

- `training_sessions.franja` guarda `"mañana" | "tarde" | null`.
- En la asignación de una importación, cada sesión asignada a fecha muestra un selector
  **mañana/tarde** junto a la fecha:
  - Sin fecha: selector deshabilitado y sin valor.
  - Fecha cuyo patrón es mañana/tarde: se precarga ese valor.
  - Fecha cuyo patrón es descanso: no se inventa; queda sin seleccionar y exige elegir
    mañana/tarde antes de guardar.
  - Si cambia la fecha mientras el valor sigue siendo automático, se recalcula desde el
    nuevo día. Si Alex ya lo tocó, se conserva su override visible.
- La creación manual/WOD y el sheet de editar o reasignar una sesión muestran el mismo
  selector. En una sesión ya guardada se conserva su franja al moverla salvo que Alex la
  cambie; una sesión histórica con `franja = null` precarga el patrón del nuevo día o exige
  elegir si ese día es descanso.
- Confirmar una importación o edición con sesión asignada persiste siempre mañana/tarde. El
  `null` queda reservado para sesiones históricas y compatibilidad con exports anteriores.
- La ficha legible de F17 (Plan · Entrenos y Hoy · «Ver sesión») muestra `· mañana/tarde`
  junto a la clave/duración cuando la sesión tiene franja explícita. No muestra una franja
  habitual como si fuese dato guardado de la sesión.

### C · Check-in sin contenido ficticio

- Día con sesión importada/canónica → precarga la sesión real (F17, sin cambios).
- Día sin sesión canónica → ofrece las sesiones genéricas + texto libre, sin preseleccionar
  la antigua etiqueta semanal ficticia.
- El patrón mañana/tarde viaja como contexto de ese día, no como nombre de sesión.
- Si Alex elige manualmente una sesión en un día cuyo patrón es descanso y no existe una
  franja explícita, el sistema sabe que hay entreno pero declara la franja desconocida; nunca
  vuelve a llamarlo descanso.

### D · Una resolución central de franja

Una función pura y compartida resuelve el dato para todos los consumidores. A estos efectos,
«hay sesión» significa `training_session` canónica **o** `days.sessionLabel` manual distinto
de Descanso; así un check-in manual también prevalece sobre un patrón habitual de descanso:

1. Hay sesión con `training_sessions.franja` → esa franja.
2. Hay sesión sin franja + patrón mañana/tarde → patrón, marcado como fallback habitual.
3. Hay sesión sin franja + patrón descanso → `sin_dato` (hay sesión: no puede ser descanso).
4. No hay sesión → patrón del weekday (`mañana | tarde | descanso`).

La resolución devuelve por separado **valor** y **origen**
(`sesion | patron | sin_dato`), para que UI/contexto no presenten una inferencia histórica
como dato explícito. Weekday y claves de fecha usan `lib/dates`/Europe-Madrid.

## NO-alcance

- **Hora exacta**: se descarta a favor de mañana/tarde; no se introducen campos de hora ni
  rangos configurables.
- **Matar el selector de sesión del check-in matinal**: es otra feature. Queda aparcada en
  HANDOFF §B3.
- **Backfill de franja en sesiones históricas**: no se inventan valores ni se reanaliza el
  contenido. Se usa el resolver de §D; si el patrón dice descanso, queda `sin_dato`.
- **Doble franja por día / dobles sesiones**: sigue habiendo una sesión canónica por fecha
  (F17); una franja por sesión.
- **Tocar estimaciones de kcal/duración o la salida de F-IA-10**: la IA de importación sigue
  extrayendo la sesión igual. La franja se decide en la asignación determinista posterior.

## Momento de uso

- **Preguntar al Coach/Chat por el fueling del día** (09 §3 · Hoy, y Chat): el valor de la
  feature. Frecuencia alta, puntual.
- **Configurar el patrón** (Ajustes): una vez y retoques raros. 09 §5.
- **Confirmar/cambiar la franja al importar la semana** (Plan · Entrenos): semanal, dentro
  del flujo existente; coste normal = cero toques extra porque el valor viene propuesto.
- **Editar/reasignar una excepción** (Plan · Entrenos): raro; el control vive en el mismo
  sheet de la sesión, no abre un camino nuevo.

## Datos

### Setting y migración

- Nueva setting canónica `trainingByWeekday`.
- Nueva setting de transición `trainingByWeekdayReviewed: boolean`.
- Instalación sin settings previas: L–S `tarde`, D `descanso`,
  `trainingByWeekdayReviewed = false`; la app pide revisar en vez de hardcodear el sábado
  personal de Alex.
- Migración idempotente desde `sessionByWeekday`:
  - etiqueta distinta de descanso/vacío → `tarde`;
  - descanso/vacío → `descanso`;
  - conserva los siete días y el nº de días de entreno;
  - crea `trainingByWeekdayReviewed = false`;
  - una ejecución repetida no pisa una `trainingByWeekday` ya válida ni vuelve a abrir una
    revisión ya guardada.
- Tras el cutover se deja de escribir/leer `sessionByWeekday`; la clave antigua solo es
  entrada de compatibilidad en restore/`migrate:poc`.

### Sesiones y perfil

- Nueva columna `training_sessions.franja` (`text`, nullable) con constraint
  `franja is null or franja in ('mañana','tarde')`. Migración Drizzle versionada.
- `null` significa «sin franja explícita», no descanso.
- Se retira `athleteProfile.franjaEntreno`: migración idempotente del JSON, tipo, schema/API
  y editor. También se sustituye su uso real en `coach/route.ts`/`dayClosure`; no basta con
  quitar la interpolación de `prompts.ts`.

### Boundaries y consultas

- Zod define `trainingSlotZ` (patrón, admite descanso) y `sessionFranjaZ` (sesión, solo
  mañana/tarde).
- La franja de asignación entra en `trainingPlanCreateZ`/`assignments` y en los endpoints de
  crear, editar y reasignar sesión. **No** se añade al schema de respuesta de F-IA-10.
- `DaySessionInfo`, DTOs de Entrenos y la consulta de contexto transportan `franja`.
- `getTrendData`/su DTO incorporan la franja de la sesión real necesaria para Chat/Visita;
  no aplican el patrón actual a días históricos sin una sesión real.

### Export/restore y `migrate:poc`

Compatibilidad obligatoria en ambas direcciones de lectura:

- **Export anterior a F20**: perfil con `franjaEntreno`, `sessionByWeekday` con etiquetas y
  sesiones sin columna `franja` → se acepta, normaliza al patrón nuevo, marca revisión
  pendiente y restaura las sesiones con `franja = null`.
- **Export F20**: perfil sin `franjaEntreno`, `trainingByWeekday` +
  `trainingByWeekdayReviewed` y sesiones con `franja` → round-trip sin pérdidas.
- `migrate:poc` acepta ambos formatos. La normalización de setting es pura, compartida por
  restore/PoC y testeada; un segundo import no degrada el patrón ya normalizado.

## Flujo

### Ajustes (09 §5)

`Ajustes → Entrenamiento → «Días de entreno»`: siete filas
`mañana / tarde / descanso`. Si procede de migración y aún no se ha guardado, aparece el
aviso de revisión. Guardar persiste patrón + `trainingByWeekdayReviewed = true`.

### Plan · Entrenos — importar/asignar

`Entrenos → importar semana → asignación`: cada sesión muestra fecha + franja. La fecha
gobierna el default automático según §B; una excepción tocada por Alex no se sobrescribe
silenciosamente. «Crear semana» se deshabilita si una sesión asignada carece de franja.

### Plan · Entrenos — manual/editar/reasignar

El mismo sheet de F17 incluye franja. Crear o mover a un día de descanso habitual exige
elegirla; editar una sesión con valor explícito lo conserva.

### Hoy · check-in matinal

Día con sesión canónica → precarga la real. Día sin sesión → genéricas + texto libre, sin
default de contenido. Mantiene el presupuesto de ≤15 s de 09 §7: no añade un paso nuevo.

## IA

La jerarquía es **dato determinista → contexto → prompt**. Se cambia `prompts.ts` solo para
la cláusula de colocación del Coach; el resto se resuelve antes. Actualizar
`prompts.test.ts`, sincronizar `04-IA.md` (doctrina de timing/contexto) y re-validar los AC
afectados. No toca estimación numérica → no requiere consistencia ×3.

### `athleteContext`

- Eliminar `entrena ${p.franjaEntreno}`. El contexto global conserva deporte, programa y
  `${trainingDays} días/semana`, pero no finge que existe una hora global.
- La franja se añade al contexto del día/sesión, nunca de nuevo al perfil global.

### Coach — dato del `targetDate`

- Resuelve la franja del `targetDate` con §D y la incluye en `dayContext`.
- El cálculo determinista de cierre deja de parsear una hora exacta y de afirmar
  `faltan ~N h`, `durante` o `ya has entrenado` cuando solo conoce mañana/tarde. En su lugar
  produce una directriz de **colocación**:
  - mañana → gasolina en desayuno/antes; no trasladarla por defecto a merienda;
  - tarde → gasolina en comida/merienda;
  - descanso → sin urgencia de timing;
  - `sin_dato` → no afirmar timing ni colocación.
- La directriz conserva la doctrina actual: gasolina de sesión ≠ rellenar macros; solo
  cambia **dónde** colocar un hidrato que ya proceda.

Añadir al prompt congelado del Coach una sola cláusula:

> Si la sesión del día es por la mañana, coloca cualquier hidrato pre-entreno que proceda
> en el desayuno o antes de entrenar; si es por la tarde, en la comida o la merienda.
> La franja solo decide dónde va la gasolina, no aumenta la cantidad ni obliga a rellenar.

### Chat

- No existe un `targetDate` estructurado por turno. `dayLines` incluye la franja resuelta
  junto a cada **sesión real** y, para hoy sin sesión, el patrón habitual.
- Así «¿qué como hoy para la sesión?» ve la franja de hoy. Una pregunta sobre otro día usa
  la línea fechada correspondiente; si no hay dato, el Chat lo declara.
- No se añade una cláusula global nueva: el Chat ya contiene la doctrina
  gasolina-de-sesión ≠ rellenar.

### Preparar visita

- No tiene un único día objetivo: las filas del rango incluyen la franja solo cuando existe
  una sesión real y el resolver puede dar mañana/tarde.
- No recibe una franja global ni una instrucción nueva; es contexto descriptivo.

### Coste

Cero llamadas nuevas. Coste **prácticamente neutro**, con un aumento pequeño de tokens en
las líneas que incluyan franja y una lectura/join de datos de sesión ya existentes.

## Impacto en Coach/Chat/Visita

- Coach: dato resuelto del `targetDate` + directriz determinista de colocación + una cláusula
  congelada.
- Chat: franja por línea fechada; hoy usa patrón solo si falta sesión real.
- Visita: franja descriptiva por sesión dentro del rango, nunca un valor global.
- WOD/otros consumidores de `athleteContext`: pierden la franja global, que no necesitan;
  sus tests confirman que no queda ninguna referencia huérfana.

## AC

1. 🖐 Ajustes muestra siete filas mañana/tarde/descanso y ninguna etiqueta de contenido;
   guardar persiste/recarga y retira el aviso de revisión.
2. La migración conserva los días/semana, crea `trainingByWeekdayReviewed = false`, es
   idempotente y no pisa un patrón ya revisado. (test puro + `profile.test`.)
3. `training_sessions.franja` existe con constraint y nullable; `null` nunca significa
   descanso.
4. El resolver puro cumple las cuatro precedencias de §D, incluido sesión real + patrón
   descanso → `sin_dato`, usando weekday Europe/Madrid.
5. En import: sin fecha no hay selector activo; fecha habitual lo precarga; fecha de
   descanso exige selección; cambio de fecha recalcula solo valores automáticos.
6. 🖐 Cambiar una sesión a mañana la guarda; editar/reasignar conserva el override y las
   fichas de Plan/Hoy muestran `· mañana` solo cuando es explícita.
7. Crear una semana no puede persistir una sesión asignada sin mañana/tarde. La franja viaja
   por `trainingPlanCreateZ`/asignaciones; la respuesta IA de F-IA-10 permanece intacta.
8. Check-in sin sesión canónica ofrece genéricas + texto libre sin default ficticio; con
   sesión canónica precarga la real y el flujo completo sigue en ≤15 s. 🖐
9. El contexto del Coach usa sesión explícita → patrón → `sin_dato`, elimina
   `franjaEntreno` global y no afirma una hora ni `~N h` con mañana/tarde.
10. Los tests deterministas de cierre verifican: mañana → desayuno/antes; tarde →
    comida/merienda; descanso → sin urgencia; `sin_dato` → sin afirmación temporal.
11. `prompts.test` cubre que el Coach recibe franja + cláusula y que esta interactúa con
    «gasolina ≠ rellenar». No se confunde este test de contrato con la salida del modelo.
12. 🖐 **Caso canónico sábado mañana**: pedir al Coach preparar el día coloca el hidrato
    pre-entreno en desayuno/antes, no en merienda.
13. 🖐 **Caso simétrico martes tarde**: coloca el hidrato que proceda en comida/merienda sin
    aumentar la cantidad para rellenar.
14. Chat ve la franja de hoy y Visita la ve por sesión fechada; ninguno recibe una franja
    global ni aplica el patrón actual indiscriminadamente al histórico.
15. Export F20 hace round-trip; restore y `migrate:poc` aceptan fixtures anterior/posterior
    a F20 sin perder días ni sesiones y restauran `franja = null` cuando faltaba.
16. No queda ninguna referencia a `athleteProfile.franjaEntreno`; perfil/editor/API, Coach,
    WOD, Chat, Visita, export/restore y tests siguen funcionando.
17. Se sincronizan `03-DATOS.md` (setting/columna), `04-IA.md` (contexto/timing),
    `09-FLUJOS-UX.md` §5 (default del check-in), HANDOFF, DECISIONS y CHANGELOG al cierre.

## Riesgos / decisiones discutibles

1. **Perder pre/durante/post exacto al retirar la hora.** Es deliberado: mañana/tarde basta
   para colocar gasolina, pero no para calcular horas restantes. Inventar precisión
   contradiría P2. La directriz determinista se limita a colocación y `sin_dato`.
2. **Migración conservadora a tarde.** Conserva el comportamiento de L–V pero deja el sábado
   incorrecto hasta una revisión. Se mitiga con un aviso persistente que desaparece solo
   tras guardar el patrón; no se hardcodea el calendario personal.
3. **Presupuesto del prompt del Coach.** Solo entra una cláusula y declara su interacción
   con «gasolina ≠ rellenar». Los tests de contrato y los dos casos 🖐 evitan el péndulo.

## Fases

Cada fase termina desplegable; no se deja ningún consumidor leyendo una forma incompatible.

- **Fase 0 · Fundación aditiva y retrocompatible.** Columna nullable + constraint; tipos y
  resolver puro; DTOs/queries capaces de transportar franja; normalizadores de
  setting/export anterior y backup round-trip. Se mantienen temporalmente
  `sessionByWeekday` y `franjaEntreno` como fuentes activas: el comportamiento visible no
  cambia. Tests de migración/resolver/backup antes que UI. (AC 3, 4, 15.)
- **Fase 1 · Cutover atómico: patrón + contexto + flujo vigente.** Crear/migrar
  `trainingByWeekday` y review flag; reformar Ajustes; adaptar en el mismo deploy todos los
  consumidores (check-in, `trainingDaysPerWeek`, `dayContext`/`dayLines`, Coach/Chat/Visita,
  `dayClosure`); retirar `franjaEntreno` y la clave antigua; cláusula del Coach; sync
  `03-DATOS`, `04-IA` y `09-FLUJOS-UX`. Fase 1 ya corrige el horario estable después de que
  Alex revise/guarde el sábado. (AC 1, 2, 8–14, 16.)
- **Fase 2 · Override por sesión.** Selector y estado auto/manual en import; crear,
  editar/reasignar; persistencia en boundaries; ficha legible; compatibilidad histórica.
  (AC 5–7.) Al final: validación 🖐, DECISIONS, CHANGELOG y HANDOFF.

## Prompt de arranque para la implementación

> Implementa `docs/specs/features/20-franja-manana-tarde-por-sesion.md` con la skill
> `fuelboard-implementer`, fase a fase y sin mezclarla con F19. Anclaje: `03-DATOS` para
> setting/schema/backup, `04-IA` para contexto y cierre del Coach, `09-FLUJOS-UX` §5/§7 para
> check-in, F17 para sesión canónica, y el código real de `profile.ts`,
> `server/analytics/dayClosure.ts`, `server/ai/context.ts`, rutas Coach/Chat/Visita,
> training import/edit y backup/`migrate:poc`. Reglas: fechas solo por `lib/dates`; Fase 0
> debe ser aditiva y desplegable; tests de resolver/migración/backup antes que UI; prompts
> congelados → `prompts.test` + sync `04-IA` y revalidar AC, sin café ×3 porque no cambia
> estimación; `typecheck && test` en verde por fase. Deja pendientes de mi pulgar los AC
> 1, 6, 8, 12 y 13.
