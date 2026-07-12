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

- **Base de datos de alimentos** (OpenFoodFacts/BEDCA) para recurrentes, con IA de fallback.
- **Sodio y fibra** estructurados + **correlaciones de hinchazón automáticas**
  («3 de 4 días con hinchazón ≥Moderada incluían sandía» — co-ocurrencia, observación no diagnóstico).
- **Workouts por sesión** → modelo de coste por tipo de día.
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
