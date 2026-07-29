# Fuelboard — Traspaso: implementado + backlog de features

> Documento único para pasar al agente que construyó la app. Resume **qué hay ya en
> producción** y **qué features quedan pendientes** (backlog). Los detalles de arquitectura,
> principios y convenciones están en `CLAUDE.md` y `docs/specs/` (00–09); las decisiones
> técnicas en `docs/DECISIONS.md`. App de **usuario único (Alex)**. Actualizado: 2026-07-25.

---

## Parte A · Lo que YA está implementado (v1 completa, desplegado y en uso)

Detalle largo en `docs/CHANGELOG-v1.md`. Resumen por fases:

- **F0 · Base**: Next 16 (App Router, TS estricto) + Tailwind 4/shadcn tematizado con los
  tokens de `05-DISENO` (contraste AA verificado en ambos temas), Drizzle + Neon (schema +
  seed), auth iron-session (usuario único, argon2), navegación **4 pestañas
  (Hoy · Plan · Progreso · Chat) + Ajustes**.
- **F1 · Registro y plan**: pantalla **Hoy** (FuelGauge, timeline, «Mi día», bottom-sheet de
  añadir, check-ins, entrada exprés), **Plan** (objetivos versionados, derivar macros, CRUD),
  migración idempotente del PoC.
- **F2 · IA (agnóstica de proveedor, solo en servidor)**: F-IA-1 análisis de **foto** de
  comida (Blob privado + miniaturas), F-IA-2 **estimar** macros desde texto, F-IA-3 estimar
  **opción de plan**, F-IA-4 **volcado del día** por texto, F-IA-5 analizar **WOD** pegado.
- **F3 · Salud y tendencia**: parsers HAE (CSV+JSON), endpoint `/api/health/ingest` (Bearer,
  upsert por fecha), analítica pura (ma7, déficit/TDEE real desde el peso, adherencia),
  pantalla **Progreso · Tendencia** (gráficos peso+ma7 e ingesta, rangos 14/30/90/todo) y
  **Ajustes** (import CSV con vista previa, estado de sync, export/restore).
- **F4 · Coach y visita**: segmento **MED** en Progreso (CRUD retroactivo de pliegues del
  nutri, difs con color semántico), **Coach** diario (F-IA-6, tras el ✨ del FuelGauge),
  **Chat** sobre tus datos (F-IA-8: hilos, streaming, contexto fresco, guardarraíles),
  **Preparar visita** (F-IA-7), **Importar dieta foto/PDF** (F-IA-9, PDF nativo a Gemini,
  vista previa editable), **PWA** (Serwist, manifest+shortcuts+share target, cola offline).
- **F5 · Pulido y validación**: auditoría de diseño (título dinámico, inputs a 16px sin zoom
  iOS, loadings sin CLS, `prefers-reduced-motion`), **Playwright** de los 4 flujos críticos
  en verde, región de función fijada a `fra1`, LCP real ~0,5 s, coste IA ~€1,6–1,9/mes.

**Datos/infra ya disponibles y reutilizables para el backlog:**
- Tabla `settings` clave/valor jsonb (`schema.ts:233`) + `getSetting`/`setSetting`
  (`lookups.ts:85`) → añadir configuración nueva **sin migración**.
- Versionado de dieta: `diet_versions` con `effective_from` (`schema.ts:70`) → base de un
  **histórico de dietas**.
- Sesiones: lista fija `SESSIONS` (`macros.ts:123`) + mapeo `sessionByWeekday` editable en
  Ajustes (`session-map-editor.tsx`); se elige en check-in/«Mi día»
  (`hoy/checkins.tsx`, `hoy/mi-dia-card.tsx`).
- IA reusable: `server/ai/` (client/provider/prompts/context/errors); import PDF→Gemini
  (F-IA-9) y estimación de gasto de sesión (F-IA-5) como patrones a copiar.

### Estado de release · Wellness v2

- `main` conserva la v1 de producción. El desarrollo activo es
  `feat/wellness-premium-v2`.
- La matriz de paridad quedó congelada en `965e992`; F10, F11 y el fix de ingesta
  `363fa61` son posteriores. Sus filas `PASS` son evidencia histórica, no la
  aprobación final del HEAD actual.
- Gate 4 automatizado verde sobre el HEAD actual: lint, tipos, 247 tests,
  contraste, Drizzle y build. Alex aprobó Gate 5 el 2026-07-24 tras dos días de
  uso real sin incidencias.
- Neon ya tiene aplicadas `0000–0015`. Antes de producción solo queda sincronizar
  `main`, verificación final sin escrituras, merge revisado y observación de Gate 6.
- Los requisitos de deploy antiguos incrustados en las entradas F04/F06/F08 se
  consideran históricos; el checklist vigente es
  `docs/REDESIGN-MIGRATION-WORKFLOW.md`.

---

## Parte B · Backlog de features

### B1 · ✅ HECHO (v1.1 + v1.2) — Coach consciente del contexto (perfil + entreno + historial)

**Implementado según [`docs/specs/10-PERFIL-ENTRENO-HISTORICO.md`](./specs/10-PERFIL-ENTRENO-HISTORICO.md)** (brief original en
[`BACKLOG-coach-perfil-entreno.md`](./BACKLOG-coach-perfil-entreno.md)). Resumen de lo entregado:

- ✅ **Perfil de atleta editable** (`athleteProfile`, tarjeta en Ajustes) — `ATHLETE_CONTEXT`
  dinámico en TODOS los prompts (principio 9), con guardarraíles del Coach. **(Fase A)**
- ✅ **Coach/Chat/Visita usan el calendario** (día de descanso ya no asume entreno). **(Fase A)**
- ✅ **F-IA-10 «Importar semana»** (PDF/foto/texto, agnóstico de deporte) → asignar a días;
  el **dropdown** de sesión usa las sesiones reales; **Plan · pestaña Entrenos** gestiona la
  semana; **Historial** unificado (entrenos + dietas + objetivos + MEDs) en Progreso. **(Fase B)**
- Absorbe el ítem antiguo «Workouts por sesión → modelo de coste por tipo de día».

### B2 · Backlog v1.1 previo (de specs 06/07, ya listado en `CHANGELOG-v1.md`)

- **Base de datos de alimentos** (OpenFoodFacts/BEDCA) para recurrentes, con IA de fallback.
- **Sodio y fibra** estructurados + **correlaciones de hinchazón automáticas**
  (co-ocurrencia, observación — no diagnóstico).
- **Import del XML nativo** de Apple Salud (hoy: CSV/JSON de Health Auto Export).
- **Passkeys** (hoy: password argon2 en env).
- **Recordatorio de pesaje** (notificación local PWA).
- **Cierre semanal** (domingo, en Tendencia): adherencia, delta de ma7, mejor/peor día,
  racha, con botón opcional «Análisis del coach» (07 §5).

### B3 · Ideas nuevas de Alex (sin especificar aún — pendientes de refinar)

> Espacio para que Alex vaya añadiendo. Candidatas mencionadas hasta ahora:

- ✅ **Histórico unificado** de entrenos + dietas + objetivos + MEDs — **HECHO** (v1.2, segmento
  Historial en Progreso).
- ✅ **Coach fiable + puente al Chat** (2026-07-13) — **HECHO** (v1.3), desplegado; pendiente
  de validación con el pulgar de Alex en producción (AC 🖐):
  [`docs/specs/features/01-coach-fiable-y-puente-chat.md`](./specs/features/01-coach-fiable-y-puente-chat.md).
  Fase 0 (fecha en el prompt: se acabó el «hoy 18-jul»), Fase 1 (el Coach conoce el plan: se
  acabó la crema de arroz fuera de dieta) y Fase 2 (botón «Seguir en el chat», opción A1).
- ✅ **El Chat conoce lo que has comido** (2026-07-13) — **HECHO** (v1.4), desplegado; AC 🖐
  pendientes: [`docs/specs/features/02-chat-detalle-comidas-antiinvencion.md`](./specs/features/02-chat-detalle-comidas-antiinvencion.md).
  Guardarraíl anti-invención (no se inventa un «día pautado estándar») + detalle por item de
  los últimos 7 días en el contexto del Chat. Surgió del uso real de F01 (puente Coach→Chat).
- ✅ **BUG · «Copiar»** (2026-07-13) — RESUELTO: funciona sobre HTTPS/PWA (era contexto no
  seguro en local). Confirmado por Alex en producción.
- ✅ **BUG · Chat: input tapado por la nav + sin multilínea** (2026-07-13) — RESUELTO: la vista
  de hilo usaba una altura fija mágica (`100dvh−9.5rem`) que ignoraba el `safe-area-inset-top`
  del iPhone → el composer caía bajo la bottom-nav. Ahora `main` es flex-col y el hilo usa
  `flex-1 min-h-0` (respeta el `pb-24` de la nav, sin números mágicos). Y `Enter` pasa a ser
  salto de línea (multilínea); se envía solo con el botón.
- ✅ **Marcas (PRs / registros de rendimiento)** (2026-07-13) — **IMPLEMENTADA (F03)**:
  [`docs/specs/features/03-marcas-registros-rendimiento.md`](./specs/features/03-marcas-registros-rendimiento.md).
  Registro agnóstico de deporte + calculadora de %, sheet de detalle con gráfica e histórico,
  carril en el Historial, y marcas en el contexto de Chat/Visita (progresión bajo demanda, sin
  veredicto automático). Migración 0004; export/restore de ambas tablas.
- ✅ **Marcas a escala + calculadora doble + familia** (2026-07-14) — **IMPLEMENTADA (F04)**:
  [`docs/specs/features/04-marcas-escala-calculadora.md`](./specs/features/04-marcas-escala-calculadora.md).
  Calculadora doble (% sobre última **y** récord), buscador en vivo en Plan·Entrenos, familia
  opcional (migración **0005** aditiva) y Historial con marcas
  recientes + «ver todas →». AC de flujo (🖐 1, 2, 4) pendientes de validación con el pulgar.
- ✅ **Editar marca (nombre + familia) + selector de familia visible** (uso real Alex, 21-jul) —
  **IMPLEMENTADA (F11)**, spec [`docs/specs/features/11-marcas-editar-y-familia.md`](./specs/features/11-marcas-editar-y-familia.md).
  Lápiz junto al título del detalle → edición inline de nombre + familia (optimista con revert);
  chip de familia bajo el título (solo si hay); `FamilyPicker` de **chips tocables** sustituye al
  `<datalist>` (invisible en Safari iOS) en crear y editar; `canonicalizeFamily` mata el split
  «Snatch/snatch» al guardar. **NO** edita tipo/unidad (invalidaría entradas — decisión firme).
  **Sin migración** (la columna `family` ya viajaba); export/restore y contexto IA sin cambios.
  **Validada por Alex 🖐 (AC 1/3/5, 21-jul)**: editar nombre persiste, editar/vaciar familia +
  chip, chips tocables en crear y editar. **Nota UX pendiente**: la ubicación del editor inline
  (bajo el título, tras el lápiz) es funcional pero no convence del todo a Alex → posible
  refinamiento de dónde/cómo aparece (a pensar con el product-partner, sin urgencia).
- ✅ **Registro más rápido — añadir por momento + acciones de la entrada** (3 observaciones de
  uso real Alex, 25-jul) — **IMPLEMENTADA (F13, v1.15)**, spec
  [`docs/specs/features/13-registro-rapido-momento-y-acciones-entrada.md`](./specs/features/13-registro-rapido-momento-y-acciones-entrada.md).
  **VALIDADA por Alex 🖐 en dev (AC 1/2/4/5/6, 25-jul).** **Fase 1 (Añadir por momento)**: la
  sección expandida de cada comida gana la acción de añadir (CTA en momento vacío; pie «＋ Añadir
  a {Comida}» con entradas); el gesto de la fila-cabecera no cambia. **Fase 2 (Duplicar + Guardar
  en Mis productos)**: duplicar idéntico (conserva base/gramos/foto, «Duplicar a hoy» desde día
  pasado) y promover una entrada al catálogo desde el día (con base → reescala, sin base → fijo,
  dedup por nombre; toast con «Editar» → catálogo). Derivación pura testeada (`lib/entry-actions.ts`). **Fix de robustez
  colateral** (DECISIONS #77): `randomUUID` con fallback para contexto no seguro (crash real al
  añadir desde el iPhone por LAN). **Sin migración** (productos de C = productos F07 normales).
- ✅ **Gramos editables tras registrar + la foto detecta etiqueta → producto** (uso real Alex,
  25-jul: fotografió una etiqueta con la puerta «Foto» y luego no podía tocar los gramos) —
  **IMPLEMENTADA (F14, v1.16)**, spec
  [`docs/specs/features/14-gramos-editables-tras-registro-y-etiqueta-a-producto.md`](./specs/features/14-gramos-editables-tras-registro-y-etiqueta-a-producto.md).
  **Fase 1 (Parte A · gramos editables)**: «base efectiva» (`macros.ts:effectiveBase`, pura y
  testeada) hace escalable también una entrada con gramos pero sin base (caso 2), derivando la
  base de las macros actuales y persistiéndola al guardar («sanado» → caso 1 nativo); el PATCH de
  entrada acepta ahora `baseG/base*` para ello (DECISIONS 25-jul). Caso 3 (sin gramos) fuera de
  alcance por decisión de Alex. **A1-A4 ✅ validados por Alex (25-jul).** **Fase 2 (Parte B · la
  foto LEE la etiqueta — enmienda 25-jul, «una lectura, dos destinos»)**: F-IA-1 gana `es_etiqueta`
  + bloque `producto` (por 100 g); la etiqueta se **lee** (ración en `items`, por-100 g en
  `producto`) → se añade como comida directamente (escalable por la Parte A) y una afordance
  «Guardar producto» abre Nuevo producto **prerelleno sin 2ª llamada a la IA**. (La 1ª impl.
  ocultaba las filas y re-leía; Alex pidió leer una vez y reusar; se retiró el escape hatch.)
  **Sin migración** (`grams/baseG/base*` ya existían). Sync a `04-IA.md`. **A1-A4 y B1-B4 ✅
  validados por Alex en dev (25-jul)**; A5/B6 (regresión: 349 tests) verdes.
- ✅ **Chat inteligente + comer fuera** (idea Alex, 15-jul; reencuadrada 16-jul) — **Fases 0–2
  IMPLEMENTADAS**, spec [`docs/specs/features/05-busqueda-web-y-foto-chat.md`](./specs/features/05-busqueda-web-y-foto-chat.md).
  **Fase 0** (reconstrucción del prompt congelado F-IA-8, sin infra): reescritura desde principios
  (contrato C1-C9), fin del parche-treadmill #54→#56→#61; **guardarraíles compartidos
  `sharedGuardrails()`** coach↔chat (el chat ya no fuga pseudociencia ni da timing en descanso);
  criterio realista (no clavar, el techo de kcal manda, quedarse corto en definición es correcto);
  equivalencias declarando la asunción; asesor de solo lectura (no reclama borrar/guardar el
  registro). Sincronizado a `04-IA.md` (DECISIONS #62); 45 tests del builder. Validado en dev
  contra la batería de casos canónicos (nº1/2/3/4 con el pulgar de Alex; nº5-descanso cubierto por
  el guardarraíl + test, no thumbeado en vivo).
  **Fase 1** (grounding web, DECISIONS #63): tool `googleSearch` de Gemini en la route (disparo
  automático, provider-executed) + **interruptor global `chatWebSearch` en Ajustes** (default ON,
  sin migración) que gobierna a la vez la tool y el párrafo web del prompt (OFF = Fase 0); **cita
  en el texto** (no chips) → streaming/cliente intactos; **solo en el Chat** (frontera dura P2:
  nunca en coach/visita/estimador); asesor, sin puente al registro. 2 rondas de validación en dev:
  se confirmó con un log temporal que `googleSearch` dispara (`sources≥1`); el residuo de error es
  de la fuente web (Open Food Facts) → nudge de honestidad. AC 🖐 1/2/3/5b/7 a validar en producción.
  **Fase 2 (foto en el chat) IMPLEMENTADA y VALIDADA en móvil (AC 8–13, 25-jul)** (DECISIONS #74):
  selector nativo sin `capture`, una foto, preview/quitar/cambiar y pregunta opcional;
  carta/plato/etiqueta; imagen efímera (sin BD/Blob/export/logs) y retry exacto en memoria con
  el mismo `turnId`. Solo persisten «📷 Foto adjunta», pregunta y respuesta. El plato devuelve
  rangos e incertidumbre; es asesoramiento puro y **no registra ni modifica comidas**.
- ✅ **Gramos como dato de primera clase** (idea Alex, 15-jul) — **Fases 1 y 2 IMPLEMENTADAS**,
  spec [`docs/specs/features/06-gramos-dato-primera-clase.md`](./specs/features/06-gramos-dato-primera-clase.md).
  **Fase 1**: base inmutable en `meal_entries` (migración **0006** aditiva) + stepper de cantidad
  en el editor de Hoy que reescala kcal/macros desde base + foto/plan/copiar-ayer persisten base +
  export/restore/`migrate:poc` con los campos nuevos + backfill de los "· NN g/ml" viejos
  (`pnpm backfill:grams`). **Fase 2**: `day-dump` con `gramos` nullable (prompt sincronizado a
  `04-IA.md`) + Describir a la altura de la foto (items con stepper, «separado/como una»). AC de
  flujo (🖐 1, 3, 4, 5, 8, 9, 10 y el 2 en su parte de pulgar) pendientes de validación en
  producción, + re-validación en vivo de F-IA-4 y café ×3 (se tocó el prompt congelado).
  El modelo de day-dump (`AI_MODEL_VISION`) ya está configurado. El estado de
  migraciones/deploy se gobierna por el checklist de release de Wellness.
- 💡 **Registrar en el día los eventos que cuentas en el chat** (idea Alex, 15-jul — a refinar con el
  product-partner): cuando le dices algo al Chat que cambia el día («hoy no entreno, me han puesto
  implantes», «hoy ando solo»), esa info **muere en el hilo**: el Coach de mañana no la conoce. Debería
  poder capturarse en el día (nota / sesión = Descanso / fase) desde el propio chat, para que el
  contexto del Coach y de la Tendencia la recojan. Caso real del 15-jul (implantes → sin entreno).
- ✅ **El Chat lee y adapta tu entreno alrededor de una limitación** (F21; caso real Alex, 28/29-jul) —
  **IMPLEMENTADO** (Fases 1+2), spec [`docs/specs/features/21-chat-adapta-entreno-lesion.md`](./specs/features/21-chat-adapta-entreno-lesion.md),
  CHANGELOG v1.23, DECISIONS #88. Arreglo de DATO (el contexto descartaba
  `training_sessions.contenido`) + detección de intención (`detectTrainingAdaptationIntent`, pura y
  testeada) que, solo bajo intención, inyecta el contenido real de las sesiones de la **semana del
  plan** (`getTrainingWeekView`) + un bloque de comportamiento en el prompt congelado (sustituciones,
  movilidad, antagonistas, escalados, **equilibrio entre sesiones**, coach conversacional, solo
  lectura, seguridad). Sin intención = prompt/coste byte-idénticos a hoy. Sin migración. Ventana =
  semana del plan (lun-dom), ajustada en validación en vivo para poder leer «la de ayer».
  **✅ AC 1-5 validados por Alex en producción (2026-07-29); F21 cerrada.** Sin campo de perfil (la
  limitación vive en el hilo → conecta con la idea 💡 de «capturar el cambio del día desde el Chat»,
  B3 arriba, fast-follow natural).
- ✅ **Mis productos (favoritos con etiqueta que reescalan)** (caso real Alex, 16-jul) — **IMPLEMENTADA (F07, v1.9)**,
  desplegada y **validada por Alex 🖐 (AC 6/7/8/9, 17-jul)**:
  [`docs/specs/features/07-mis-productos.md`](./specs/features/07-mis-productos.md).
  «Favorito» → «producto» (un solo concepto, editable, agnóstico de comida, `baseG` que reescala).
  Tabla `products` (migración 0007) + migración de favoritos (`pnpm migrate:products`, 0 pérdidas) +
  export/restore/seed/migrate:poc. Sheet «Mis productos» (chips→stepper/1-toque, catálogo editable
  con undo inline) y **F-IA-11** (foto de etiqueta → editor prerrellenado, lectura no estimación).
  El ★ por-entrada se retira (DECISIONS #64). Fases 0·1·2 desplegadas. Mockup: `docs/mockups/mis-productos.html`.
- 💡 **Escáner de código de barras** (derivada de F07, 16-jul — a MEDIR antes): entrada rápida vía
  OpenFoodFacts que *prerrellena* el formulario de producto (nunca como fuente de verdad; la etiqueta
  manda). Decidir **tras usar la foto de etiqueta** y ver si enfocar la tabla molesta (anti-optimización-
  sin-medición). Descartadas como fuente de estimación: USDA/BEDCA (genéricos) y OFF (colaborativo → ruido).
- ✅ **Variantes de opción del plan** (idea Alex, 16-jul) — **IMPLEMENTADAS Fases 1 y 2
  (F08, v1.10)**, **validada por Alex 🖐 (AC1 import + AC3 registrar día real, 17-jul)**:
  [`docs/specs/features/08-variantes-opcion-plan.md`](./specs/features/08-variantes-opcion-plan.md).
  «Carne magra (pollo/pavo/ternera/cerdo)» sigue siendo **un** hueco; al **registrar** eliges
  la fuente con chips → macros correctas (swing pollo↔cerdo ~80 kcal a 210 g, ruido que la
  báscula no absorbe). `plan_options.variants` jsonb (migración **0008** aditiva); importador
  F-IA-9 con prompt reescrito que detecta y rellena las variantes; escalado por gramos reusa
  F06. export/restore/migrate:poc las transportan. **Fase 2** (editar variantes
  a mano en el editor del plan, sin reimportar) está hecha; quedan sus AC de edición
  manual marcados 🖐 en la spec. DECISIONS #66/#67.
- ✅ **Describir que conoce tus productos** (idea Alex, 16-jul; caso real que la disparó, 26-jul) —
  **IMPLEMENTADA (F18, `docs/specs/features/18-describir-consulta-mis-productos.md`)**, **AC1 🖐
  pendiente del pulgar de Alex** (+ café ×3). Caso real 26-jul: «cafe con leche de almendra 0%
  lidl» estimaba 24 kcal genéricas e ignoraba *Bebida de almendras Lidl 0%* (250 g = 40 kcal).
  Solución: `day-dump` inyecta el catálogo en el prompt (`productsContext`, como F12) y el modelo
  identifica por nombre EXACTO (`producto: string|null`); el servidor recalcula con la función
  pura `applyProductMatches` desde la base guardada (diseño B, P2). Sin migración (match efímero).
  `estimate` (F-IA-2) queda **fuera** por diseño (macros sin gramos → reescalado ambiguo).
  DECISIONS #82. Descartado ya: creador de combo «foto de una etiqueta + describe el
  resto + buscar» (contamina F-IA-11, que es lector puro) y búsqueda en BD externas (NO-alcance
  de F07: OFF/USDA/BEDCA = ruido, principio 2).
- ✅ **Estimar macros de una variante con IA** (idea Alex, 17-jul, tras validar F08 Fase 2) —
  **IMPLEMENTADA (F09, quick-fix)**, **AC1 validado por Alex 🖐 (17-jul)**:
  [`docs/specs/features/09-estimar-variante-ia.md`](./specs/features/09-estimar-variante-ia.md).
  Botón **✨ por variante** en el `VariantsEditor` compartido: rellena kcal/P/C/F reusando
  **F-IA-3** (`estimatePlanOption`) sin tocar el prompt (solo nombre + `baseG`); se ignora el
  grupo (es del hueco). Aparece en los dos consumidores (import y editor del plan). DECISIONS #68.
  Junto salió el **fix #69** (BUG): la estimación IA (F-IA-2/3/5) devolvía **500** con
  `gemini-3.5-flash` porque el *thinking* agotaba `maxOutputTokens` (500/800 heredados de
  flash-lite) → subidos a 2048; y `client.ts` no capturaba `NoOutputGeneratedError` → 500 mudo
  en vez de 502 visible. Sin migración; nada nuevo en export/restore.
- ✅ **Mis productos II — crear como en el día + añadir desde el catálogo** (idea Alex, 21-jul,
  sobre `feat/wellness-premium-v2`) — **IMPLEMENTADA (F10)**, **AC1/AC2/AC5/AC6 validados por
  Alex 🖐 (21–22-jul)**: [`docs/specs/features/10-mis-productos-ii.md`](./specs/features/10-mis-productos-ii.md).
  Editor de producto con selector **Foto · Describir · Manual** (Describir + ✨ inline reusan
  **F-IA-3** sin tocar prompt); origen **`estimado`** (✨) como 4º valor del enum (migración
  **0014**); **unidad `g|ml|ud`** solo-etiqueta (columna `products.unit`, migración **0015**,
  escala 1:1, F06 intacto); **tap en la fila del catálogo añade** el producto (Alcance D).
  export/restore/migrate:poc/seed transportan `unit`+`estimado`. DECISIONS #72.
  - **Requisito de deploy**: `pnpm db:migrate` (aplica **0014**+**0015**) antes/junto al deploy.
  - **Aparcadas (Etapa 0, sin construir)**: (a) método **Describir en las opciones del plan**
    (hoy el plan estima variantes con ✨ F09, pero no tiene el textarea «describe la opción y
    estima» — extensión pequeña, reusa F-IA-3); (b) **variantes en productos** como en el plan
    (choca con «producto = una cosa por base» — medir necesidad antes). Alex: «lo dejo así y ya
    veremos» (22-jul). **Reabierto 26-jul → spec F19** (ver abajo): el item (a) se **descarta**
    (redundante con el ✨ que ahora conocerá los productos); (b) sigue aparcado.
- ✅ **El editor de opciones del Plan, homogéneo con el resto** (caso real 26-jul, continuación
  de F18) — **SPEC APROBADA `docs/specs/features/19-plan-opciones-homogeneas.md`; Fase 1
  y Fase 2 IMPLEMENTADAS y VALIDADAS por Alex 🖐 (26-jul).** El ✨ del Plan (F-IA-3)
  ya consulta «Mis productos»; el editor incorpora unidad y copia desde catálogo,
  mientras el editor de productos ya tiene Foto·Describir·Manual+unidad (#72). Alex quiere dejar las
  opciones recurrentes (café, merienda) **puestas una vez** en el Plan (su menú operativo, P3), sin
  re-estimar con IA ni copiar-pegar del día. **Fase 1 cerrada** (sin migración): patrón F18,
  modelo reconoce + servidor calcula; caso real 250 g → 40 kcal · 2P/0C/4F y café ×3 estable
  (DECISIONS #84). **Fase 2 técnica cerrada**: `plan_options.unit` (`0019`, default
  `g`) recorre CRUD/copia/import/backup/PoC/seed y Plan/Hoy/Historial/contexto IA;
  la enmienda `0020` conserva además la unidad en la fila diaria tras el caso real
  `stepper 250 ml → fila 250 g`; «Mis productos» siembra la opción normal como
  copia, nunca vínculo. Fuera: Foto
  por-opción (la cubre el import F-IA-9), Describir por-opción (redundante con ✨), variante-desde-producto
  (aparcada), escalado por nº de unidades (NO-alcance F06 #57). Variantes F08 intactas.
- ✅ **Franja mañana/tarde: gasolina de sesión en el sitio correcto** (caso real Alex,
  26-jul, al revisar el mapeo ficticio «Sesión por día de la semana») — **IMPLEMENTADA (F20)
  [`docs/specs/features/20-franja-manana-tarde-por-sesion.md`](./specs/features/20-franja-manana-tarde-por-sesion.md),
  3 fases; validación 🖐 pendiente.** Sustituye el patrón día→contenido por
  día→mañana/tarde/descanso, retira la franja horaria global y resuelve la franja del día
  desde la sesión explícita o el patrón. Corrige el caso real L–V tarde / sábado mañana sin
  inventar horas: el servidor decide colocación de gasolina, no `~N h`/pre-durante-post.
  Migraciones `0017`+`0018`, export/restore/`migrate:poc`, Ajustes, check-in,
  Coach/Chat/Visita y override al importar/editar/reasignar quedan cableados. Gate:
  418 tests + typecheck. Pendientes del pulgar de Alex: Ajustes, import/override/ficha,
  check-in ≤15 s y casos canónicos sábado-mañana/martes-tarde.
- 💡 **Unidades / ml / l como cantidad de primera clase** (observación Alex, 17-jul — caso: fajitas)
  — **PARCIALMENTE cubierto: F10 añadió la UNIDAD como rótulo** (`g|ml|ud`, la etiqueta ya no
  miente). Lo que sigue **PARKED** es el **escalado real por nº de unidades** (2 fajitas = 2 ×
  equivalencia en gramos; NO-alcance F06 #57). Medir antes de reabrir. El «gramos base» y el ✨ son gram-céntricos, pero
  el caso está cubierto sin código: por unidades = nombra «2 fajitas» + gramos base vacío (fijo, el
  ✨ estima igual); por gramos = «Fajitas» + baseG≈120 (escala con stepper). Los líquidos de la pauta
  tienen densidad ≈1 (200 g = 200 ml); solo la **etiqueta** `g` es imprecisa (cosmético). Meter unidad
  real + escalado por unidad reabriría el NO-alcance deliberado de F06 (#57: «la cantidad es un número,
  la unidad vive en el texto») para un caso puntual → anti-optimización-sin-medición (doc 11). Reabrir
  solo si en 2 semanas de uso real muerde a menudo.
- ✅ **Chat afinado con 11 días de uso real** (export real de 39 hilos, 24-jul) —
  **IMPLEMENTADA y VALIDADA (F12, v1.14)**, spec [`docs/specs/features/12-chat-11-dias-uso-real.md`](./specs/features/12-chat-11-dias-uso-real.md).
  Cinco ajustes: (1) producto de marca → consulta «Mis productos» primero, si no está
  marca estimación + pide etiqueta; (2) integridad del registro (modo hipotético, nunca
  «borro tu cena»); (3) outlier del reloj = probable artefacto (en `sharedGuardrails()`,
  heredado por el Coach); (4) título IA (Flash-Lite, 1/hilo, fallback determinista) +
  5 intents reales + «Continuar última conversación»; (5) guardado de producto
  confirmado (única escritura del chat, determinista en servidor) y dedup del doble
  envío (AC9). Sin schema ni migración. DECISIONS #75.
  - **Requisito de deploy**: nueva env `AI_MODEL_TITLE=gemini-3.5-flash-lite` (`.env.local`
    y Vercel). Backfill opcional de títulos existentes: `pnpm backfill:chat-titles`
    (dry por defecto; `--write` aplica). Sin `db:migrate`.
  - **AC 🖐 validados por Alex en móvil (25-jul)**: AC1 (Lidl: consulta catálogo, no da
    otra variante como exacta, pide etiqueta), AC3 (HRV 194 → artefacto, nunca
    «recuperación extrema»), AC5 (confirmación → crea/actualiza el producto exacto como
    `etiqueta` sin tocar nada más). Resto de AC cubiertos por la suite (297 tests) + build.
- ✅ **Comidas flexibles: contexto, adherencia e impacto** (idea Alex, 26-jul —
  **F16 implementada y validada por Alex el 26-jul**:
  [`docs/specs/features/16-comidas-flexibles-y-impacto.md`](./specs/features/16-comidas-flexibles-y-impacto.md)):
  no forma parte explícita de la pauta de Regenera ni tiene condiciones
  prescritas; es el acuerdo personal de dejar flexibles normalmente la cena del sábado y
  desayuno, comida y merienda del domingo, aunque alguna (p. ej. la merienda) puede acabar
  encajando en el plan. Alex intenta adecuarlas todo lo posible. Planteamiento literal:
  *«las calorías no cuentan igual… ¿cómo lo harías?»*. F16 separa el efecto fisiológico real
  del tratamiento de producto (adherencia, incertidumbre de la estimación, FuelGauge,
  Tendencia y contexto de Coach/Chat) sin presentarlo falsamente como pauta del nutricionista.
  **Caso real 25-jul**: cena flexible con pizza; antes de cenar, el Coach —sin conocer esa
  intención— vio 992 kcal/55 P/103 C pendientes y recomendó hidratos en la merienda
  pre-T6 + 210 g de pollo/pavo en la cena. Debe conservar el consejo de repostaje que aporte,
  pero no intentar cerrar con opciones de una cena normal cuando ese momento ya esté marcado
  como flexible. Tras registrarla, el Gauge mostró honestamente 2.440/1.800 (+640), 119 P,
  273 C y 94 F; el dato flexible debe contextualizar, no borrar esas cifras.
  **Lectura actualizada del Coach**: trató el balance como adecuado para el rendimiento y
  reconoció la proteína cubierta (conservar), pero presentó la pizza como algo a monitorizar
  con el nutricionista por su efecto sobre un peso puntual de 91,4 kg y cerró con «prioriza
  proteína magra y carbohidratos complejos para equilibrar la semana» (evitar: causalidad de
  una sola comida/pesada + compensación suave). Con marcador flexible, debe contextualizarla,
  mirar patrón/tendencia si existe y volver a la pauta normal sin compensar.
  **Reglas refinadas tras revisión cruzada**: (1) el marcador vive por `fecha + momento`,
  pero un día con ≥1 momento marcado que contenga ≥1 entrada queda fuera del denominador de
  adherencia de **kcal** pero su proteína sigue contando; aparece contado explícitamente
  como flexible; marcar una comida vacía solo crea `Flexible prevista` y NO excluye el día;
  (2) flexible es un dato separado, NUNCA una fase: el día entero conserva todas sus kcal en
  ingesta media/TDEE, Tendencia y peso/ma7; el Gauge conserva cifras pero usa tono
  neutro-informativo; (3) las fases especiales tienen precedencia y no ofrecen el marcado;
  (4) sin contador, cuota ni límite semanal; (5) `prevista` entra en v1 porque resuelve el
  consejo previo a la cena; (6) fecha siempre Europe/Madrid vía `lib/dates`; (7) Coach y
  Chat ven previstas+reales del día en curso; en
  histórico, Chat/Preparar visita y la analítica reciben solo flexibles realmente
  registradas; el hash de lectura del Coach incluye el marcador; (8) `Últimos días` muestra
  chip Flexible; copiar/plantilla/duplicar/F-IA-4 nunca copian el marcador.
  **KPI propuesto (26-jul)**: para que excluir de adherencia no vuelva invisibles esas kcal,
  Progreso muestra `Impacto flexible · 28 d` tras la primera flexible real: nº de
  momentos/días, kcal medias de días flexibles vs regulares, porcentaje de sus objetivos
  históricos y diferencia aproximada kcal/%. Sirve como evidencia para decidir con Regenera
  la programación futura; no prescribe cambios. Siempre con `≈` y tamaños de muestra; hasta
  ≥3 días flexibles + ≥7 regulares muestra conteos pero no comparación. Full-width bajo
  Consistencia, no otra tarjeta en Hoy. NO atribuir peso/HRV/hinchazón a flexibles con pocos
  datos; futuros desgloses por momento solo tras uso real.
  **Implementación 26-jul**: migración aditiva `0016`; commits `c958fe6` (dato/ciclo de
  vida), `327a7c9` (analítica/UI) y `10824d1` (IA). Migración aplicada y lectura real de
  Neon confirmada tras resolver el error inicial de tabla ausente. `typecheck` + 373 tests
  + React Doctor 100/100 verdes; prompts congelados intactos. Alex aprobó los AC
  1/2/3/4/6/11/14/15/16/17 y decidió mantener el KPI F/R como está para observarlo con más
  uso real. El caso AC17 reforzó por dato la valoración flexible también en modo `ayer`
  (DECISIONS #79), sin llamadas ni coste nuevos.
- ✅ **Entrenos legibles + WOD analizado integrado** (uso real Alex, 26-jul — **F17
  completada y aprobada por Alex el 26-jul**, AC 🖐 1–5 aprobados:
  [`docs/specs/features/17-sesion-unica-entrenos-y-wod.md`](./specs/features/17-sesion-unica-entrenos-y-wod.md)):
  ficha legible y detalle reutilizable en Plan/Hoy/Historial; gestión en sheets; creación
  Manual o WOD desde un día; comando canónico transaccional con semana manual fallback,
  sustitución + undo y sincronización del contexto. F-IA-5 conserva el texto original y
  añade tipo; F-IA-10 conserva bloques completos. Commits `d48af9f`, `94f7cc4` y el commit
  IA/documental posterior; quick-fixes `299ce76` (semanas futuras) y `2d3854b` (bloques
  por párrafo). Consistencia ×3 pasa para WOD y running; Alex acepta el cierre de AC9 con
  Week 31 real, sin afirmar el ×3 de `TP1_Week_29.pdf` ausente. Sin migración, env ni
  backfill.
- _(añadir aquí las que surjan)_

---

## Notas para el agente

- **Prompts de IA congelados** (`CLAUDE.md`): cualquier cambio de redacción en `server/ai/
  prompts.ts` debe sincronizarse con `docs/specs/04-IA.md` y **re-validar** los AC de la fase
  correspondiente (la calidad de visión/estimación y la disciplina JSON varían al tocar el
  prompt). Hacer perfil→prompts dinámico sigue siendo «interpolar variables» (permitido).
- **Fase a fase**: no adelantar trabajo de fases futuras; cada entrega con sus tests de
  aceptación en verde (`pnpm typecheck && pnpm test`) y deploy funcionando. Commits pequeños.
- **Datos sagrados** (principio 7): toda migración de datos versionada, 0 pérdidas.
- **Decisiones** no cubiertas por specs → resolver con lo más simple y anotar en
  `docs/DECISIONS.md` (formato `fecha · decisión · motivo`).
- **`TP1_Week_29.pdf`** (raíz del repo) es el ejemplo real para diseñar/probar F-IA-10.
  Decidir si se versiona o se gitignora (copyright de The Progrm; mismo criterio que el CSV
  real de HAE, `DECISIONS.md` 2026-07-11).
