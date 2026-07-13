# Backlog · Coach consciente del contexto (perfil editable + día de entreno/descanso)

> Brief autocontenido para el agente que implemente esto. No requiere la conversación
> original. Respeta las convenciones de `CLAUDE.md` (prompts congelados → sincronizar
> `04-IA.md` + anotar en `DECISIONS.md`; fase a fase; specs = fuente de verdad).

## Motivación (caso real, 2026-07-12, domingo)

Alex pidió al Coach «¿Cómo voy hoy?» (F-IA-6, modo `hoy`) un **domingo, su día libre**, y
sin tomar proteína en polvo. El Coach respondió:

> **Sugerencia:** … Toma **1 scoop de proteína de suero (whey isolate)** con agua **antes
> del entreno** (o 100g de pechuga de pollo)…

Dos errores, ambos reales:

1. **Asume que va a entrenar** («antes del entreno») cuando hoy es descanso.
2. **Recomienda un suplemento que no toma** (whey), violando además el principio 8
   (el sistema no prescribe suplementación).

## Diagnóstico (causa raíz, con `archivo:línea`)

### Error 1 — el Coach no sabe si hoy se entrena

- El Coach solo «ve» la sesión si `day.sessionLabel` está **guardado en BD**:
  `src/server/ai/context.ts` → `dayContext()` (~L135) solo emite la línea de sesión si
  `day.sessionLabel` existe.
- El mapeo por día de la semana (**D→`Descanso`**) existe pero es solo el **default del
  check-in matinal**; NO se persiste hasta que Alex confirma el check-in:
  `src/server/db/queries/today.ts:76` → `const defaultSession = sessionByWeekday[wd] ?? "Descanso"`.
- El route del Coach (`src/app/api/ai/coach/route.ts`) **no lee ni pasa** `sessionByWeekday`.
- Resultado: un domingo sin check-in confirmado, `sessionLabel = null` → el contexto no
  menciona sesión. Y como `athleteContext()` dice *«Entrena 19:30-21:30, 6 días/semana»*
  (`src/server/ai/prompts.ts:12`) y el propio prompt del Coach menciona *«hidrato lejos del
  entreno»* (`src/server/ai/prompts.ts:81`), el modelo **rellena el hueco asumiendo entreno**.

### Error 2 — recomienda suplementos que no toma

- `athleteContext()` lista lo que SÍ toma: *«creatina, beta-alanina y citrulina»*
  (`src/server/ai/prompts.ts:12`). Whey **no está** → el modelo debería inferir que no lo
  usa, pero no lo respeta.
- El prompt del Coach (F-IA-6, `prompts.ts:68-84`) **carece del guardarraíl
  anti-suplementación** que sí tiene el Chat (F-IA-8):
  `src/server/ai/prompts.ts:107` → *«NO prescribes cambios de dieta ni suplementación»*.
- El principio 8 (`CLAUDE.md`) exige que ni Coach ni Preparar-visita prescriban.

### Contexto que YA existe (facilita el arreglo)

- Tabla `settings` clave/valor jsonb: `src/server/db/schema.ts:233` → **cero migración**
  para guardar un perfil nuevo.
- Helpers `getSetting`/`setSetting`: `src/server/db/queries/lookups.ts:85-97`.
- Mapeo de sesiones ya editable en Ajustes: `src/components/ajustes/session-map-editor.tsx`
  (setting `sessionByWeekday`, `lookups.ts:100`).
- Infra de import PDF→Gemini con vista previa editable: **F-IA-9** (importar dieta),
  `src/server/ai/prompts.ts:127` (`dietImportPrompt`) + su route. Reutilizable para Nivel 2.
- Estimador de gasto de sesión desde texto pegado: **F-IA-5** (`wodPrompt`, `prompts.ts:59`).

---

## Nivel 1 — Arreglo (v1.1, barato, SIN migración)

Resuelve los dos errores esta misma semana.

### 1A · Perfil de atleta editable, referenciado en TODOS los prompts de IA

- **Alcance elegido por Alex: perfil COMPLETO** — que nada quede a fuego en el contexto de IA.
- Nuevo setting `athleteProfile` (jsonb) vía `getSetting`/`setSetting`. Campos:
  `alturaCm`, `edad`, `deporteNivel` (texto, ej. «CrossFit avanzado»), `franjaEntreno`
  (ej. «19:30-21:30»), `diasEntrenoSemana` (deriva del mapeo, ver 1B), `objetivo` (texto),
  `suplementos` (lista de strings; hoy: creatina, beta-alanina, citrulina),
  `notaClinica` (ej. «le cuesta la grasa abdominal baja» — hoy en `athleteContextExtended`),
  y un campo **`programa`** (ej. «The Progrm 1») para dejar el perfil listo a **adaptar la
  app a distintas programaciones/sesiones en el futuro** (requisito de Alex).
- **Precargar defaults** con los valores actuales hardcodeados para no perder nada.
- Nueva tarjeta **«Perfil del atleta»** en **Ajustes** (junto a `session-map-editor`).
  Suplementos como chips editables (añadir/quitar).
- `athleteContext(peso)` y `athleteContextExtended(peso)` (`prompts.ts:11,64`) pasan a
  **construirse desde el perfil** en vez de la constante. `pesoReciente` sigue como está.
  - Los campos que hoy son fijos pasan a variables interpoladas → **sigue respetando el
    contrato de prompts congelados** (interpolas variables, no reescribes el prompt).
- **Referenciar el perfil en TODOS los prompts de IA, no solo en los conversacionales**
  (requisito de Alex: «que la IA sepa todos mis datos siempre»). Hoy `athleteContext` solo
  se usa en Coach (F-IA-6), WOD (F-IA-5), Preparar-visita (F-IA-7) y Chat (F-IA-8). Falta en
  **F-IA-1 foto, F-IA-2 estimar, F-IA-3 opción de plan, F-IA-4 volcado del día, F-IA-9
  importar dieta** (`prompts.ts:28,43,48,54,127`). Añadir una **versión compacta** del perfil
  (peso, altura, deporte/nivel, objetivo; suplementos solo donde aporte) al inicio de esos
  prompts, respetando el protocolo de prompts congelados (ver abajo) y re-validando los AC de
  cada feature (la calidad de estimación/visión puede variar al cambiar el prompt).
- **Guardarraíl anti-suplementos** en el prompt del Coach (F-IA-6): añadir la cláusula del
  Chat — *«Observas y explicas; NO prescribes suplementación. Sugiere solo suplementos que
  YA toma (los de su perfil); si algo no está en su lista, no lo recomiendes. Prioriza
  comida real / las comidas del plan que le quedan.»*

### 1B · El Coach usa el calendario para saber si hoy es descanso

- El route del Coach (`src/app/api/ai/coach/route.ts`) debe leer `getSessionByWeekday()` y
  pasarlo a `dayContext`/`coachPrompt`.
- En `dayContext()` (`context.ts`), cuando **no hay `sessionLabel` registrado**, emitir una
  línea explícita del calendario: p. ej.
  `Sesión: sin registrar (según tu calendario semanal, hoy toca: {Descanso|Tx}).`
- **Guardarraíl de entreno** en el prompt del Coach: *«Si la sesión de hoy es Descanso o no
  hay sesión, NO asumas que va a entrenar ni des consejos de timing pre/post-entreno.»*
- Esto **habría arreglado el bug de hoy**: el mapeo ya tiene D→Descanso; solo faltaba que
  el Coach lo mirara.

### Protocolo obligatorio del Nivel 1

1. Editar `src/server/ai/prompts.ts` (athleteContext dinámico + guardarraíles del Coach) y
   `src/server/ai/context.ts` + `src/app/api/ai/coach/route.ts` (calendario).
2. **Sincronizar `docs/specs/04-IA.md`**: reflejar que `{ATHLETE_CONTEXT}` se construye desde
   el perfil, y añadir los dos guardarraíles al prompt F-IA-6. (Los prompts están congelados:
   cualquier cambio de redacción invalida los AC de Fase 2 → **re-validar el Coach**.)
3. Reflejar el perfil editable en `05-DISENO.md`/`09-FLUJOS-UX.md` (Ajustes) si procede.
4. Anotar las decisiones en `docs/DECISIONS.md` (formato `fecha · decisión · motivo`).
5. `pnpm typecheck && pnpm test` en verde antes de commit. Commits pequeños.

### Criterios de aceptación (Nivel 1)

- Editar suplementos en Ajustes se refleja en la respuesta del Coach (quitar whey del
  imaginario del modelo: nunca recomienda suplementos fuera de la lista del perfil).
- Coach en un día mapeado como `Descanso` (sin sesión registrada) **no** asume entreno ni da
  timing pre/post-entreno.
- Coach en un día de entreno (sesión registrada) sigue dando su sugerencia con timing.
- `athleteContext` no contiene ya ningún dato personal hardcodeado.

---

## Nivel 2 — Solución de verdad (feature, backlog v1.2 — requiere su propio plan/fase)

**Problema de fondo:** el mapeo `sessionByWeekday` es una aproximación estática. La realidad
de Alex: cada semana recibe un PDF **«The Progrm 1 · Week N»** con **Training 1–6** que **no
están atados a días de la semana** (los reparte él), su **día libre se mueve**, y
**Training 4 es literalmente «Aerobic Base Development or Rest»**. El contenido cambia cada
semana (una semana T1 es snatch; otra, otra cosa). Ejemplo real analizado: `TP1_Week_29.pdf`.

**Feature propuesta — F-IA-10 «Importar semana de The Progrm»:**

- Subir el PDF de la semana → IA extrae las 6 sesiones (T1–T6) con su contenido/tipo,
  **reutilizando la infra de F-IA-9** (PDF nativo a Gemini, `maxOutputTokens` alto,
  vista previa editable, Zod + 1 reintento).
- Estructura esperada por training: nombre/tipo (Weightlifting, Gymnastics, Conditioning,
  CrossFit, Mash, Aerobic/Rest), bloques, y estimación de gasto (apoyarse en F-IA-5).
- El usuario **asigna cada training a una fecha** de esa semana y marca los **descansos**
  explícitos. Se persiste por día (candidato: `days.sessionLabel` + `days.sessionKcal`,
  `schema.ts:103-104`; **requiere tabla/estructura propia de programación semanal** para el
  histórico, ver abajo).
- Con esto el Coach (y Chat/Preparar-visita) conoce la **sesión real de cada día**, no una
  plantilla → el problema del descanso desaparece de raíz y las estimaciones de gasto
  (contexto, principio 1) son de la sesión real.

**Requisitos que pidió Alex explícitamente:**
- **Alimentar el dropdown de «qué entreno he hecho hoy»**: hoy ese selector usa la lista
  FIJA `SESSIONS` (`src/lib/macros.ts:123`, T1–T6 + Competición + Descanso), elegida en el
  check-in/Mi día (`src/components/hoy/checkins.tsx`, `mi-dia-card.tsx`). Tras importar la
  semana, las **sesiones reales de esa semana** deben aparecer en ese dropdown (con su
  contenido), no solo las etiquetas genéricas.
- **Histórico de entrenos** (y, unificado, de dietas): guardar cada semana importada para
  poder consultarla después. Nota: el **histórico de dietas ya existe parcialmente** vía
  `diet_versions` (`schema.ts:70`, `effective_from`) — extender el concepto a un histórico
  unificado (entrenos + dietas) consultable.

**Notas de diseño:**
- Bottom-sheet para el flujo de import/asignación (09 §6: sheets para crear/editar).
- Convive con el mapeo estático (`sessionByWeekday`) y con la lista `SESSIONS` como fallback
  cuando no se ha importado la semana.
- Especificar en `04-IA.md` (nuevo F-IA-10, prompt congelado) y `09-FLUJOS-UX.md`.
- Sustituye/absorbe el ítem de backlog **«Workouts por sesión → modelo de coste por tipo de
  día»** (§3 de `CHANGELOG-v1.md`).

### Criterios de aceptación (Nivel 2)

- Importar `TP1_Week_29.pdf` extrae 6 trainings con tipo y estimación de gasto.
- Asignar T4 como descanso un día → el Coach ese día no asume entreno.
- El Coach de un día con T1 asignado referencia la sesión real (halterofilia/CrossFit).
