# CHANGELOG v1 — Fuelboard

Reconstrucción "bien hecha" del PoC validado en Claude Artifacts. App personal
(usuario único: Alex) de nutrición y rendimiento. **v1 completa** (Fases 0–5),
desplegada en Vercel (`fuelboard`, región `fra1`) y en uso en el iPhone de Alex.

Fecha de cierre v1: **2026-07-12**. Fuente de verdad de las decisiones: `docs/DECISIONS.md`
(este documento las resume y agrupa). Specs: `docs/specs/00-09`.

---

## 1. Resumen por fases

### Fase 0 · Esqueleto
Next.js 16 (App Router, TS estricto, Turbopack) + Tailwind 4 + shadcn tematizado con los
tokens de `05-DISENO` (claro/oscuro, contraste AA verificado por test). Drizzle + Neon con
el schema completo de `03-DATOS §1` y seed del plan Regenera (~34 opciones, 4 macros). Auth
usuario único (iron-session, argon2). Nav inferior de 4 pestañas (Hoy · Plan · Progreso ·
Chat) + Ajustes en el header. Deploy en Vercel.

### Fase 1 · Núcleo de registro (sin IA)
Pantalla **Hoy** task-first (FuelGauge con barras por comida y comportamiento por fase,
timeline por comida, tarjeta «Mi día» colapsable, sheet único de añadir, check-ins guiados,
flujos exprés). Pantalla **Plan** (objetivos versionados en `diet_versions`, derivar del
plan, CRUD de opciones). Defaults inteligentes (sesión por día de semana, comida por hora,
gramos = baseG, agua por chips). Optimista + undo + autosave. **Migración del PoC**
idempotente (0 pérdidas). Tests de escalado por gramos y derivados del plan.

### Fase 2 · IA
Infra `server/ai/` agnóstica de proveedor (Vercel AI SDK v7 + Gemini), salida estructurada
nativa (`Output.object`), 1 reintento, errores siempre visibles. Features: F-IA-1 **foto**
(pipeline de imagen en cliente + HEIC, desglose con gramos editables anclados, reanalizar,
Blob privado al añadir + miniaturas), F-IA-2 estimar texto, F-IA-3 opción de plan, F-IA-4
volcado del día, F-IA-5 analizar WOD. `temperature: 0` en toda llamada.

### Fase 3 · Salud + Tendencia
Parsers HAE (`server/ingest/`, CSV + JSON, tabla EXACTA `03 §4.2`, kJ→kcal, mL→L, colisión
peso/paso, tests). Endpoint `/api/health/ingest` (Bearer, tolerante, upsert por fecha).
Precedencia importado > manual. Analítica pura y testeada (`server/analytics/`: ma7 con
exclusión de fases especiales + 2 días post-competición, déficit/TDEE, adherencia). Pantalla
**Progreso · Tendencia** (TrendCard invertida, adherencia, gráficos peso+ma7 e ingesta,
popovers «cómo se calcula», rango 14/30/90/todo, Últimos días). Operaciones en **Ajustes**
(import CSV con vista previa, estado de sync, export + import/restore con backup pre-restore).

### Fase 4 · MED + Coach + Chat + PWA
Segmento **MED** en Progreso (CRUD retroactivo, difs `actual−anterior` con color semántico,
gráfico doble eje). **Coach** (F-IA-6) tras el ✨ del FuelGauge. **Chat sobre tus datos**
(F-IA-8: hilos, streaming, chips, contexto fresco, resumen cacheado, guardarraíles).
**Preparar visita** (F-IA-7). **Importar dieta foto/PDF** (F-IA-9, PDF nativo a Gemini,
vista previa editable → nueva versión). **PWA** (Serwist/Turbopack, manifest + shortcuts +
share target, cola offline `idb` con replay, botones IA deshabilitados offline).

### Fase 5 · Pulido y validación
- **Diseño**: título de documento dinámico (`1.240 / 1.800 · Fuelboard`), inputs numéricos
  a 16px (sin zoom iOS), `chat/loading` y `progreso/loading` con la forma real (sin CLS),
  `prefers-reduced-motion` global, cifras tabulares consistentes.
- **Flujos**: fase post-especial **auto-sugerida** (Carga→Competición→Recuperación→Normal),
  **peso exprés** cableado al shortcut «Peso de hoy», cerrado el hueco horario 11–12 del
  aviso de peso, nombrar plantilla en bottom-sheet (no `window.prompt`), paso de peso saltable.
- **Calidad**: **Playwright** de los 4 flujos críticos (registrar día, foto con IA mockeada,
  check-in matinal, import CSV) en verde contra una rama de test de Neon; auth por cookie
  iron-session sellada; SW bloqueado en test (`e2e/README.md`).
- **Rendimiento**: **región de función fijada a `fra1`** (antes se ignoraba en Hobby → `iad1`,
  cruzando el Atlántico contra Neon). TTFB `/hoy` caliente ~0,15 s. **LCP real ~0,5 s**
  (cumple <2 s); el 4,2 s de Lighthouse es lab (slow-4G simulado). CLS 0, TBT 30 ms, Perf 85.
- **Coste IA**: **~€1,6–1,9/mes** (objetivo < 5 €), driver Chat/Coach (`AI_MODEL_COACH` =
  Gemini 3.5 Flash).

### v1.1 · Perfil de atleta + IA consciente (doc 10 · Fase A)
Principio 9 («la IA habla con el atleta de hoy»): nada personal a fuego en prompts.
- **Perfil de atleta** editable en Ajustes (setting `athleteProfile`, jsonb, sin migración):
  deporte/nivel/programa/franja, altura, fecha de nacimiento (edad derivada), suplementos y
  lesiones (chips), nota clínica e **historial de objetivos** (vigente + cambiar + plegado).
  `diasEntrenoSemana` se deriva del mapeo de sesiones.
- **`ATHLETE_CONTEXT` dinámico** desde el perfil (plantilla congelada, valores interpolados):
  completo en coach/WOD/visita/chat; **compacto + cláusula anti-sesgo** en todas las
  estimaciones (F-IA-1/2/3/4/9), con excepción de escala en foto.
- **Guardarraíles del Coach** (anti-suplementación + anti-entreno-fantasma) y **Coach/Chat/
  Visita miran el calendario** (`sessionByWeekday`): arregla el bug del domingo/descanso.
- Café ×3 estable (kcal idéntica); Ajustes reorganizado en grupos (Atleta/App/Cuenta) e
  inputs a 44px.

### v1.2 · Plan de entrenamiento importable + Historial (doc 10 · Fase B)
- **Migración 0003** (aditiva): `training_plans`, `training_sessions` (tipo genérico,
  agnóstico de deporte), `days.session_ref`. Export/restore actualizado (0 pérdidas).
- **F-IA-10 · Importar semana** (PDF/foto/texto) en Plan: vista previa editable → asignar
  cada sesión a un día → crea el plan y rellena los días. Verificado con `TP1_Week_29.pdf`
  (6 sesiones) y un plan de running en texto (agnosticismo).
- **Integración**: el dropdown de sesión (Mi día/check-in) usa las **sesiones reales** de la
  semana; el Coach/Chat/Visita citan la sesión real (nombre, tipo, gasto).
- **Plan en segmentos `Dieta | Entrenos`**: la pestaña Entrenos gestiona la semana vigente
  (ver/editar con **kcal editable**, reasignar día, borrar).
- **Historial** (3er segmento de Progreso): timeline de solo lectura, inmutable, que mezcla
  objetivos + dietas + entrenos + MEDs; rango + filtros; detalle inline (MED/objetivo) o en
  sheet (dieta/entreno) con «ir al actual».

### v1.3 · Coach fiable + puente al Chat (F01)
- **Fase 0 · Fecha en el prompt**: Chat, Coach y Preparar-visita empiezan por «HOY es
  {fecha} ({día})» desde `dayKey()` (Europe/Madrid). Arregla la alucinación del Chat (bug
  13-jul: «hoy 18-jul» + días inexistentes) que envenenaba cada «¿cómo voy hoy?».
- **Fase 1 · El Coach conoce el plan**: el Coach recibe las opciones pautadas de las comidas
  que aún le quedan al día (`pendingPlanOptions`); prioriza el plan y marca «fuera de tu
  pauta» si sale de él. Arregla la «crema de arroz» inventada fuera de la dieta.
- **Fase 2 · Puente Coach → Chat (A1)**: botón «Seguir en el chat» en el sheet del Coach que
  siembra un hilo (pregunta + texto del coach) y lo abre con el input enfocado, sin llamada
  IA propia. Plantillas F-IA-6/7/8 sincronizadas a `04-IA.md`.

### v1.4 · El Chat conoce lo que has comido (F02)
- **Guardarraíl anti-invención** (`chatSystemPrompt`, F-IA-8): si le falta un dato, lo dice y
  pide a Alex que se lo proporcione; no inventa comidas, cantidades ni un «día pautado
  estándar». Arregla el fallo real (13-jul): el Chat se inventaba una cena estándar y restaba.
- **Detalle por item de los últimos 7 días** (rolling): el Chat ve QUÉ comió en cada comida
  (mismo grano que el Coach vía `recentMealsDetail`), no solo los totales por día. Una query
  de rango (`mealEntriesInRange`); días 8-30 siguen en totales. Sin schema ni migración.

### v1.5 · Marcas (PRs / rendimiento) — base (F03) + escala (F04)
- **F03 · Marcas** (base): registro agnóstico de deporte (nombre libre; `measure_type`
  peso/tiempo/reps/distancia fija dirección de «mejor» y unidad; tiempo en segundos ↔ mm:ss),
  «última»/«mejor»/«¿mejora?» derivadas en lectura (`lib/marks.ts`, puro y testeado), sheet de
  detalle único (gráfica + entradas con undo inline + calculadora de %), bloque en Plan·Entrenos
  y carril en Historial, marcas en el contexto de Chat/Visita con guardarraíl anti-sobreatribución.
  Migración 0004; export/restore de ambas tablas.
- **F04 · Marcas a escala** (para 20-40 marcas), en una sesión de 4 fases:
  - **Calculadora doble** (`doubleReference`, puro + test): el % se muestra sobre la **última**
    (vigente, primaria) y sobre el **récord** cuando difieren; una sola línea si coinciden. La
    última manda (protege contra programar sobre un récord viejo).
  - **Buscador en vivo** en Plan·Entrenos: filtro por nombre en cliente (<50 ms) sobre lo cargado.
  - **Familia opcional** (`performance_marks.family`, migración **0005 aditiva**): etiqueta libre
    con autocompletado al crear una marca. Se **captura** ahora; el filtro por familia queda para
    el futuro. Export ya la vuelca; restore la mapea. `migrate:poc` sigue no-op.
  - **Historial recientes** (`marksByRecency`, puro + test): el carril muestra ~5 marcas por fecha
    de su última entrada + «ver todas →» a `/plan?tab=entrenos` (patrón «ir al actual»); deja de
    intentar mostrar todas en la tira.

### v1.6 · Gramos como dato de primera clase — Fase 1 (F06, sin IA)
- **Base inmutable en `meal_entries`** (migración **0006** aditiva: `grams` + `base_g` +
  `base_kcal/prot/carb/fat`, todas nullable): cada entrada guarda su referencia de escalado.
- **Stepper de cantidad en el editor de Hoy** (`meal-row.tsx`): reescala kcal/macros **en vivo
  desde la base inmutable** con `scaledForStore` (nunca sobre lo mostrado → sin deriva); se
  oculta si la entrada es fija (`baseG` null). Un override manual de macro lo pisa el siguiente
  cambio de cantidad (los gramos mandan). Mata el punto de dolor nº 1 (editar cantidad sin
  borrar/rehacer).
- **Foto, plan, resultado escalable y «copiar ayer» persisten base+cantidad** con **nombre
  limpio** (la cantidad se pinta desde `grams`, no pegada al nombre).
- **Backfill** de las entradas viejas «· NN g/ml» → escalables (`pnpm backfill:grams`,
  idempotente; parser `parseGramsSuffix`/`backfillEntryGrams` puro y testeado); también dentro
  de `migrate:poc`. Export/restore con round-trip completo de los campos nuevos.
- Tests: reversibilidad 25→40→25 exacta (AC2), override pisado (AC3), parser (AC5), round-trip
  export/restore (AC6), backfill/migrate (AC7).
- **Fase 2 · Describir a la altura de la foto**: el schema de `day-dump` (`dayDumpItemZ`) añade
  `gramos: number|null`; el **prompt congelado** de F-IA-4 pide estimar la ración solo cuando es
  razonable y devolver `null` si no lo es (nunca inventa cifras) — sincronizado a `04-IA.md`. La
  capa **Describir** (`add-sheet.tsx`) pasa a reusar el patrón de la foto: items con **stepper de
  gramos** (cuando la IA dio cantidad, reescala desde la base que devolvió la IA), **«añadir por
  separado / como una»**, y persisten base+cantidad → re-editables luego en el editor de Hoy.
  Test del schema (AC9). **Re-validación del prompt hecha** (day-dump ×3 en producción,
  DECISIONS #59: `temperature: 0` mantiene el determinismo, ruido ~6% aceptable); AC de flujo
  8/9 validados con el pulgar de Alex.

### v1.7 · Chat inteligente — reconstrucción del prompt (F05 Fase 0, sin infra)
- **Reconstrucción desde principios del prompt congelado F-IA-8** (contrato C1-C9 de F05),
  acabando el parche-treadmill #54→#56→#61. Arregla el chat del día a día sin depender de la
  infra web/foto de las Fases 1-2 (que quedan pendientes).
- **Guardarraíles compartidos `sharedGuardrails()` coach↔chat** (DECISIONS #62): fuente única
  (no-diagnóstico, pseudociencia, anti-sobreatribución PR, entreno-fantasma). Resuelve la causa
  raíz de F05 — el chat **no heredaba** los del coach → fugaba «grasa abdominal» y daba timing
  pre-entreno en día de descanso. El coach queda equivalente (sus AC verdes).
- **Criterio realista, no clavar**: el objetivo es cuadrar el día con criterio, no clavar el
  número; el **techo de kcal manda** sobre cerrar macros; quedarse algo corto en definición es
  correcto («vas bien, no toques nada»); una palanca de verdad (no encadenar añadidos);
  opciones de una comida como ALTERNATIVAS (fin del apilado arroz+boniato+pan).
- **Equivalencias declarando la asunción** (macarrones ≈ su arroz, a la primera; #61 absorbido)
  y **asesor de solo lectura** (nunca reclama borrar/guardar el registro — principio 7).
- Sincronizado a `04-IA.md`; **45 tests del builder** (169 suite verde). Validado en dev contra
  la batería de casos canónicos: nº1 (reparto), nº2 (equivalencia), nº3 (realista/techo-kcal),
  nº4 (comer fuera sin web) con el pulgar de Alex; nº5 (guardarraíl de descanso) cubierto por el
  guardarraíl + test, pendiente de thumbear en vivo. Iterado 3 veces en dev (realista →
  techo-kcal → read-only), cada vuelta cazando un eje distinto.
- **Pendiente**: Fase 1 (grounding web `googleSearch` solo en el Chat, citando fuente) y Fase 2
  (foto en el chat), sobre este prompt reconstruido.

### v1.8 · Chat con búsqueda web — comer fuera / productos de marca (F05 Fase 1)
- **`googleSearch` de Gemini en la route del chat** (provider-executed, disparo automático):
  el chat funda la respuesta en la web para cartas de restaurante y productos de marca,
  **citando la fuente en el texto** (no chips de `groundingMetadata` → el streaming y el
  cliente no cambian). `webSearchTools()` en `server/ai/provider.ts`, solo Google.
- **Interruptor global `chatWebSearch` en Ajustes** (default ON, tabla `settings`, sin
  migración): freno de **coste**, no toggle por mensaje (P3). ON → tool + párrafo web;
  OFF → sin tool ni párrafo (comportamiento byte-idéntico a la Fase 0). Ambos atados al
  mismo flag; Switch tematizado + ruta `PATCH /api/settings/chat-web-search`.
- **Párrafo web añadido por interpolación** al prompt reconstruido (no se reescribe el
  congelado): buscar primero + dar el dato con fuente antes que la equivalencia + prohibir
  macros confiados de fuera sin citar/estimar + fuentes colaborativas (Open Food Facts)
  como orientativas + honestidad si falta la variante exacta.
- **Frontera dura P2**: la web vive SOLO en el chat — coach, preparar-visita y estimador
  (F-IA-1/2/4) nunca la reciben. Sincronizado a `04-IA.md`; DECISIONS #63.
- Validado en dev en 2 rondas (un log temporal de `sources` **confirmó que `googleSearch`
  dispara** — `sources≥1`; el residuo de imprecisión es de la fuente web, no del código,
  y para cuadrar el día es ruido según P2). AC de flujo (🖐 1, 2, 3, 5b, 7 deploy) a
  validar en producción. **Pendiente**: Fase 2 (foto en el chat), tras rodar la Fase 1.

### v1.9 · Mis productos — favoritos que reescalan (F07)
- **«Favorito» → «producto», un solo concepto** (editable, agnóstico de comida, con
  `baseG` que **reescala** al añadir; reusa `scaleMacros`/`entryBaseFields` de F06). Tabla
  `products` (migración **0007** aditiva: enum `product_source` etiqueta|manual|legacy) +
  **migración de favoritos** `pnpm migrate:products` (0 pérdidas, dedupe de colisión de
  nombre logueada); `favorites` queda deprecada. Export/restore, seed y `migrate:poc`
  pueblan `products`.
- **Sheet de Añadir → «Mis productos»**: chips de los `pinned` (agnósticos); tocar → capa
  **stepper** (baseG, reescala) o **1 toque** si es fijo (legacy). `Ver todos →` /
  pulsación larga → **catálogo editable** (buscar · ⭐ pin · ✎ · 🗑 · ＋Nuevo); undo del
  borrado = **banner inline** dentro del sheet (el toast no recibe clics en un sheet modal,
  DECISIONS #42/#64). Editor manual + entrada a mano. Búsqueda universal incluye productos.
- Se retira el **★ por-entrada** del timeline (escribía en `favorites`); el ⭐ pasa a ser
  el pin del producto. DECISIONS #64.
- **F-IA-11 · leer etiqueta** (`POST /api/ai/label-read`, visión, reusa `AI_MODEL_VISION`):
  foto de la tabla nutricional → rellena el editor (LECTURA, no estimación: null donde no
  figura); Alex confirma → `source:'etiqueta'`. Prompt CONGELADO en `04-IA.md` §F-IA-11.
- Editar un producto **no** reescribe entradas ya registradas (AC5). AC1/AC2 (reescalado)
  y AC3/AC4 (migración + round-trip) con test. **AC 6/7/8/9 validados por Alex 🖐 (17-jul)**:
  foto de etiqueta rellena el editor y la lectura ×3 es consistente (null donde no figura).
  El café ×3 (DECISIONS #65) NO aplica (F-IA-11 es lectura, no estimación).

---

### v1.10 · Variantes de opción del plan — Fase 1 (F08)
- **Precisión al registrar, no en el plan**: una opción de la pauta que agrupa alimentos
  intercambiables («Carne magra: pollo/pavo/ternera/cerdo») sigue siendo **una** fila
  (espejo de la pauta, principio 8); al **registrarla** eliges la fuente con chips y se
  guardan SUS macros, no las medias. El swing pollo↔cerdo (~80 kcal a 210 g) es ruido
  aleatorio que la báscula no absorbe → se hornea en la entrada (motivación de la feature).
- **Datos**: `plan_options.variants` jsonb `not null default '[]'` (migración **0008**
  aditiva; [] = opción normal, sin regresión). Los campos planos de la opción valen los de
  la **1ª variante** (default). export/restore (mapa puro `planOptionImportRow`),
  `createVersionWithTargets` (copia las variantes) y `migrate:poc` ([]) las transportan.
- **Importador (F-IA-9)**: prompt CONGELADO **reescrito** (detecta intercambiables con
  macros distintas; NO genera variantes para formas de cocinado ni macros ≈ iguales) —
  sincronizado a `04-IA.md`, `temperature:0`. La vista previa carga las variantes (solo
  lectura en Fase 1) y las persiste. Zod + 1 reintento.
- **Registrar**: chips de fuente encima del stepper en `PlanOptionRow` (default = 1ª); al
  elegir, swap de macros + escala por gramos (F06) desde la variante; entrada guardada como
  «hueco · Variante». Sin fórmula nueva (`variantToEntryFields` reusa F06).
- Tests: parseo del importador con variantes, escalado desde variante (ida/vuelta sin
  deriva), round-trip export→restore. `typecheck+test+build` en verde. **AC1** (import real
  reconstruye «carne magra» con 4 variantes; «verdura vapor/plancha» sin) y **AC3**
  (registrar día real, swing pollo↔cerdo cuadra) 🖐 **pendientes del pulgar de Alex**.
  **Fase 2** (editar variantes a mano en el editor del plan) aplazada. DECISIONS #66.

---

## 2. Decisiones clave por tema (resumen de `DECISIONS.md`)

### Arquitectura, toolchain y build
- Next 16: `middleware`→`proxy.ts` (runtime nodejs); chequeo optimista de cookie en el
  proxy + verificación autoritativa en el layout de `(app)`.
- PWA con `@serwist/turbopack` (no `@serwist/next`, webpack-only); SW compilado en build a
  archivo estático; `esbuild` nativo como devDep + `serverExternalPackages`.
- `pnpm.ignoredBuiltDependencies: ["@swc/core"]`; toolchain vía `corepack pnpm@11.9.0`
  (la store v11 no casa con la pnpm local); `turbopack.root = process.cwd()`;
  `allowedDevOrigins` para el móvil en dev; borrado `pnpm-workspace.yaml` autogenerado.
- e2e excluidos del `tsconfig` de la app (los compila Playwright; `@next/env` es transitiva
  y no resuelve en el build de la app con pnpm).

### IA
- Stack `ai@7` + `@ai-sdk/google@4`; salida estructurada NATIVA (`Output.object`, no parseo
  manual) — corrige el "JSON inválido" de visión; prompts de `04-IA` literales.
- `temperature: 0` también en Google (su default 1.0 rompía el principio 2: mismo WOD daba
  cifras dispares); thinking por tarea (visión `medium` + `mediaResolution:HIGH`, estimación
  `low`, coach/chat/visita `medium`); los tokens de thinking salen de `maxOutputTokens`.
- Seam agnóstico real pero mínimo (solo Google cableado); separación error-BD vs error-IA
  con 1 reintento para el arranque en frío de Neon; F-IA-9 PDF nativo a Gemini.
- Chat (F-IA-8): streaming `streamText().toTextStreamResponse()` + `X-Thread-Id`; resumen
  cacheado por lotes (`chat_threads.summary`, migración 0002); `temperature 0.3` (única
  excepción). `AI_MODEL_COACH` (Gemini 3.5 Flash) para coach/chat/visita — error visible si falta.

### Datos y BD (los datos son sagrados)
- Driver `@neondatabase/serverless` (neon-http); `phase` enum con `normal` = columna nullable.
- Migración del PoC idempotente por tabla (delete-claves+insert vs upsert vs insert-si-no-existe),
  0 pérdidas verificadas; `created_at` derivado del id del PoC (preserva orden en el timeline).
- Restore = delete-all + insert con remapeo de ids (neon-http sin transacciones); **backup
  automático pre-restore** (descarga el estado actual antes de tocar nada).
- Precedencia importado > manual; `applyHealthDays` = upsert con FUSIÓN por campo (no borra
  campos ausentes). CSV HAE: delimitador autodetectado (`;` en ES), detección de columnas
  tolerante a acentos (NFD). Analítica pura importable en cliente (recálculo sin red).

### Diseño y contraste
- shadcn base radix + preset nova, colores **sobrescritos** por los tokens de `05 §2`.
- Auditoría de contraste automatizada (`pnpm audit:contrast`, gate en tests): fix del
  `--muted-foreground` (colisión de nombres shadcn/spec), errores en naranja legible (AA),
  ámbar «hidratos» oscurecido a AA.
- FuelGauge segmentado por comida; fase especial → variante info (azul, nunca rojo).
- Nav a 4 pestañas + Ajustes en el header (09 §2 sustituye la organización del PRD).

### Auth y seguridad
- iron-session (usuario único, argon2, cookie httpOnly cifrada); proxy protege todo salvo
  `/login`, `/api/auth/*`, `/api/health/ingest` y artefactos PWA.
- Foto → Blob **privado** servido con sesión (redirect firmado); HEIC→JPEG en cliente
  (fallback sharp en servidor); input de foto SIN `capture` (para permitir galería).
- CSV real de HAE y export del PoC gitignored (datos de salud personales).
- e2e: cookie de sesión **sellada** con `AUTH_SECRET` (sin password en claro).

### Rendimiento y deploy
- `preferredRegion="fra1"` en el layout de `(app)` + `loading.tsx` con skeletons (0 CLS) +
  `prefetch` en la nav; **región de función fijada a `fra1` en el dashboard** (en Hobby el
  `preferredRegion` del código se ignoraba → corría en `iad1`).
- LCP real ~0,5 s aceptado; el 4,2 s de Lighthouse (slow-4G simulado) se documenta como lab.

### UX / flujos (Fase 5)
- Input de búsqueda universal **dentro del sheet** (09 §4 prevalece sobre 07 §3, por la
  jerarquía "09 manda en organización de pantallas").
- Shortcut «Peso de hoy» → sheet exprés de peso; línea de estado matinal → check-in de 3 pasos.
- Fase post-especial auto-sugerida (valor propuesto visible, 1 toque para aplicar).

---

## 3. Backlog v1.1 (NO hecho en v1 — de `06` y `07`)

- ✅ **Coach consciente del contexto** (perfil + día de entreno/descanso) — **HECHO en v1.1/
  v1.2** (doc 10, ver secciones arriba). Nivel 1 (perfil + calendario + guardarraíles) = Fase A;
  Nivel 2 (F-IA-10 importar semana + sesión real por día + Historial unificado) = Fase B.
  **Absorbe el ítem «Workouts por sesión» de abajo.**
- **Base de datos de alimentos** (OpenFoodFacts/BEDCA) para recurrentes, con IA de fallback.
- **Sodio y fibra** estructurados + **correlaciones de hinchazón automáticas**
  («3 de 4 días con hinchazón ≥Moderada incluían sandía» — co-ocurrencia, observación no diagnóstico).
- **Workouts por sesión** → modelo de coste por tipo de día. _(Lo absorbe el Nivel 2 del
  brief del Coach, arriba.)_
- **Import del XML nativo** de Apple Salud.
- **Passkeys**.
- **Recordatorio de pesaje** (notificación local PWA).
- **Cierre semanal** (domingo, en Tendencia): tarjeta local con adherencia, delta de ma7,
  mejor/peor día y racha, con botón opcional «Análisis del coach» (07 §5).

## 4. Validación final pendiente (uso real)

La validación definitiva de v1 es empírica: **comparar la predicción de Tendencia (gasto/
déficit desde la pendiente del peso) con los pliegues de la MED del nutricionista de agosto**
(principio 1: la báscula es la fuente de verdad del gasto).

## 5. Validación de agosto — protocolo

Cierre empírico de v1 con las features que **ya existen** (Preparar visita, MED, Tendencia) —
sin código nuevo. Criterio de éxito: `01-PRD §6 · Métricas de éxito`.

1. **El día antes de la visita** — ejecutar **Preparar visita** (F-IA-7) y anotar la
   **predicción de la Tendencia** (TrendCard «Tu gasto y déficit reales · desde el peso»,
   F6.2): **kg/semana** (pendiente ma7), **déficit kcal/día** (`−kgSemana × 7700 ÷ 7`) y
   **TDEE real**. Requiere ≥8 pesajes en ≥7 días; excluye días de fase especial.
2. **Tras la consulta** — registrar la **MED nueva** en Progreso · MED (F5.1): grasa kg,
   músculo kg, peso, con su fecha.
3. **Contrastar predicción vs pliegues** — comparar la pérdida de grasa / déficit predicho
   por Tendencia con el cambio real de la MED (`actual − anterior`, F5.2).
   **Criterio de éxito (`01-PRD §6`): la predicción de déficit cae dentro de ±30% de la MED.**

Notas: cada fuente se compara consigo misma (principio 5: báscula vs báscula, MED vs MED;
nunca cruzar valores absolutos entre fuentes). Una MED cerca de carga/competición tiene ruido
de hidratación/glucógeno (F5.4) → no es tendencia. Si el resultado cae fuera de ±30%, es
**input para la visita/ajuste con Regenera**, no un fallo de la app (principio 8: el sistema
informa, el nutricionista decide).
