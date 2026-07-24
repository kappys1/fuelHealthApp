# F06 · Gramos como dato de primera clase (editar cantidad → recalcula macros)
**Estado**: implementada (Fases 1 y 2; AC de flujo 🖐 pendientes en HANDOFF) ·
**Tamaño**: feature (migración + prompt) · 2 fases
**Fecha**: 2026-07-15 · **Origen**: HANDOFF §B3 (idea Alex, 15-jul) + caso real en conversación con el product-partner.

## Motivación (caso real)
Alex registra "Pan · 25 g" (por foto, plan o describir) y luego se da cuenta de que comió
más o menos. **Hoy no puede cambiar la cantidad y que las macros se reajusten**: el editor de
Hoy solo deja tocar kcal/P/C/F a mano (steppers independientes), y "Describir" muestra los
items en solo-lectura. Su flujo real acaba siendo **borrar la entrada y volver a crearla**, o
—en Describir— **reescribir la descripción** para forzar otra cantidad. El "· 25 g" que ve en
el nombre es texto pegado, no un dato: la entrada solo guarda kcal/P/C/F absolutos, así que la
app no tiene referencia para escalar. Alex lo resume: «los gramos al final es lo que bastante
ayuda y luego ya calcula macros y kcals» — la cantidad es la palanca; las macros derivan.

Dolor declarado: **4/5** en el punto 1 (editar algo ya registrado). La foto y el plan **ya**
escalan por gramos (`scaleMacros`, patrón `base`+stepper); esta feature lleva ese mismo modelo
al editor de Hoy y a Describir.

## Alcance
**Fase 1 — los gramos existen de verdad:**
- La entrada del día (`meal_entries`) guarda, además de las macros actuales: **cantidad
  actual** (`grams`) y su **referencia base inmutable** (`baseG` + macros base). Ver §Datos.
- Editor de Hoy (`meal-row.tsx` · `EditForm`): cuando la entrada tiene base escalable, aparece
  un **stepper de cantidad** que **reescala kcal/P/C/F en vivo desde la base inmutable** (no
  desde los valores ya mostrados). Reusa `scaleMacros(base, grams, baseG)` de `src/lib/macros.ts`.
- Las macros siguen **editables a mano** (decisión 2): el stepper reescala desde base; un toque
  manual sobreescribe ese macro concreto.
- Foto y plan (que ya calculan por gramos) **persisten** base + cantidad al crear la entrada.
- "Añadir comida" manual acepta una cantidad opcional (rellena base = valores tecleados).
- **Backfill** (decisión 1): la migración parsea `· NN g` / `· NN ml` del nombre de las
  entradas existentes → `grams = baseG = NN`, base = macros actuales. Así lo ya registrado
  también pasa a ser escalable. Lo no parseable queda fijo (base null).

**Fase 2 — Describir a la altura de la foto:**
- Los items interpretados por la IA (F-IA-4 / `day-dump`) pasan a ser **editables** + con
  **stepper de gramos por item** (reescala desde la base que devuelve la IA) + **modos "añadir
  por separado / añadir como una"** (mismo control que ya tiene la foto en `add-sheet.tsx`).
- El schema de `day-dump` añade `gramos` **nullable**: los items sin cantidad estimable
  ("un puñado de nueces", "sopa") vuelven `gramos: null` y quedan fijos (decisión 3 / adición c);
  la IA **nunca inventa gramos** por rellenar el schema.

## NO-alcance
- **No** cambia el modelo de "sin cantidad = fijo" (decisión 3): café con leche, "4 huevos",
  300 ml sin base → sin stepper, edición a mano, igual que el plan cuando `baseG` es null.
- **No** introduce base de datos de alimentos ni densidad real por alimento: el escalado es
  **lineal** sobre la base (misma asunción que foto/plan hoy; principio 2, consistencia).
- **No** toca el resto de prompts de IA (solo `day-dump`, y solo en Fase 2).
- **No** añade unidades nuevas ni conversión g↔ml: la "cantidad" es un número; la unidad vive
  en el texto (como hoy).
- **No** añade ninguna tarjeta permanente a Hoy (09 §6): todo vive en sheets/editor existentes.

## Momento de uso (09 §1)
Registro diario, "corregir lo que acabo de/ya registré". Alta frecuencia (varias veces al día
en días de comida libre). Editor de Hoy = corrección post-registro; Describir = registro rápido
por texto. Ningún momento de uso nuevo: se pulen dos existentes.

## Datos
- **Migración aditiva** sobre `meal_entries` (nº siguiente en `drizzle/`; 0 pérdidas, principio 7).
  Campos nuevos (nullable), como **columnas explícitas** (decisión cerrada: queryabilidad y
  simetría con `plan_options`, no jsonb) para persistir la **base inmutable + cantidad actual**:
  - `grams` — cantidad actual (int, null = sin cantidad / fijo).
  - `baseG` — gramos base de referencia (int, null = fijo).
  - `baseKcal` (int), `baseProt`, `baseCarb`, `baseFat` (real) — macros base inmutables.
- **Regla de reescalado (adición a)**: todo escalado se calcula **siempre desde la base
  inmutable** con `scaleMacros(base, grams, baseG)`; **nunca** sobre valores ya reescalados
  → evita la deriva de redondeo al editar la cantidad varias veces. Es el mismo patrón
  `base`/`scaleMacros` que ya usa la foto (`PhotoLayer` en `add-sheet.tsx`). **Exigido
  explícitamente**: los componentes guardan la base y reescalan desde ella, no leen el valor
  mostrado para volver a escalar.
- **Backfill** en la propia migración (o seed idempotente): parseo de `· NN g|ml` del nombre.
- **Export/restore y `migrate:poc`**: incluir los campos nuevos (round-trip completo, sin
  pérdida). AC explícito abajo.
- El nombre deja de llevar `· NN g` pegado (decisión 1): la cantidad se **pinta desde `grams`**
  cuando existe. Entradas backfilleadas: quitar el sufijo del nombre al parsearlo para no
  duplicar "· 25 g · 25 g".

## Flujo (09)
- **Editor de Hoy**: bottom-sheet/inline de `EditForm` (ya existe). Se añade el stepper de
  cantidad arriba de los steppers de macros; si `baseG` es null, no aparece (solo macros a mano).
- **Describir** (Fase 2): sheet `DescribeLayer` pasa a reusar el patrón de `PhotoLayer`
  (items con stepper de gramos, editables, toggle junto/separado). Máx. una decisión por sheet
  (09 §6): la decisión sigue siendo "qué añado y en qué cantidad".
- **Foto**: sin cambio de flujo; solo persiste base+cantidad al crear (ya las calcula).

## IA (solo Fase 2)
- Feature afectada: **F-IA-4 (volcado del día / `day-dump`)**. Cambio de **prompt congelado**
  → sincronizar redacción a `04-IA.md` y **re-validar AC de F-IA-4** (regla CLAUDE.md), incluido
  el **test de consistencia del café ×3** si se toca la estimación (DECISIONS #65).
- **Schema de salida**: `dayDumpItemZ` añade `gramos: number | null`. Instrucción explícita en
  el prompt: *estimar gramos solo cuando sea razonable; si el item no tiene cantidad estimable
  (p. ej. "un puñado de X", "sopa"), devolver `gramos: null` — NUNCA inventar una cifra por
  rellenar el campo* (adición c).
- Manejo de error: igual que hoy (1 reintento si el JSON no parsea; error visible). `temperature: 0`.
- Coste: nulo adicional (misma llamada, un campo más en la respuesta).

## Impacto en Coach/Chat/Visita (adición b)
El contexto de IA lee los **totales/detalle de `meal_entries`** (kcal/P/C/F por item y por día).
Como al editar la cantidad se **persisten los valores recalculados**, el contexto los recoge
automáticamente — pero se **verifica, no se asume**: tras editar los gramos de una entrada y
refrescar (cuidado con el Router Cache, cf. commit `cec959d`), el Coach/Chat deben ver los
**totales nuevos**, no los previos. Es un AC 🖐.

## AC
1. En una entrada con base escalable, cambiar la cantidad en el editor de Hoy reescala
   kcal/P/C/F en vivo y guarda los valores nuevos. 🖐
2. El reescalado se calcula **desde la base inmutable**: editar la cantidad ida y vuelta
   (p. ej. 25→40→25) devuelve **exactamente** las macros originales (sin deriva). *(test unitario
   además de 🖐)*
3. Editar un macro a mano sobreescribe solo ese macro **hasta el siguiente cambio de cantidad**:
   los gramos mandan → un cambio posterior de cantidad reescala desde la base y **pisa el
   override manual** (semántica confirmada conscientemente por Alex). *(test unitario + 🖐)*
4. Entrada sin cantidad (`baseG` null): no aparece stepper; edición de macros a mano como hoy. 🖐
5. Backfill: una entrada antigua "Pan · 25 g" queda escalable (grams/baseG=25, base=sus macros)
   y su nombre ya no duplica el "· 25 g". *(test del parser + 🖐)*
6. Export → restore de una entrada con base+cantidad conserva todos los campos (round-trip). *(test)*
7. `migrate:poc` no rompe y las entradas quedan con base null (o backfilleada) sin perder macros. *(test)*
8. **Fase 2**: en Describir, cada item es editable, tiene stepper de gramos (cuando la IA dio
   cantidad) y se puede "añadir por separado" o "como una". 🖐
9. **Fase 2**: item sin cantidad estimable → la IA devuelve `gramos: null` y el item queda fijo;
   el prompt no fuerza cifras inventadas. *(test del schema/parseo + 🖐)*
10. **Coherencia IA (adición b)**: tras editar la cantidad de una entrada, el contexto de
    Coach/Chat refleja los totales recalculados (verificado en el contexto que se envía). 🖐
11. `pnpm typecheck && pnpm test` en verde; contraste AA intacto; sin CLS nuevo en el editor.

## Riesgos / decisiones discutibles
- **Prompt congelado de `day-dump`** (Fase 2): el añadido de `gramos` nullable es el único punto
  con riesgo de regresión de calidad → aislado en Fase 2 y con re-validación de AC. Por eso el
  orden: Fase 1 (sin IA) primero.
- **Migración con backfill**: el parseo de `· NN g|ml` debe ser conservador (solo patrón claro
  al final del nombre); ante duda, dejar fijo (base null) — nunca inventar una base.
- **Doble representación de cantidad** (nombre vs campo): se resuelve pintando desde `grams` y
  limpiando el sufijo del nombre en el backfill; entradas nuevas nacen con nombre limpio.

## Fases
- **Fase 1** (sin IA, mata el punto 1): migración + base inmutable + backfill + stepper en el
  editor de Hoy + foto/plan/manual persisten base + export/restore/migrate:poc. Tests de lógica
  (escalado desde base, parser de backfill, round-trip) **antes** que la UI. Desplegar: devuelve
  la fiabilidad ya.
- **Fase 2** (Describir a la altura de la foto): schema `day-dump` con `gramos` nullable +
  prompt sincronizado a `04-IA.md` + re-validación de AC F-IA-4 + UI de Describir reusando el
  patrón de la foto (editable, stepper, junto/separado).
