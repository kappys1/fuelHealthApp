# Fuelboard — Traspaso: implementado + backlog de features

> Documento único para pasar al agente que construyó la app. Resume **qué hay ya en
> producción** y **qué features quedan pendientes** (backlog). Los detalles de arquitectura,
> principios y convenciones están en `CLAUDE.md` y `docs/specs/` (00–09); las decisiones
> técnicas en `docs/DECISIONS.md`. App de **usuario único (Alex)**. Fecha: 2026-07-12.

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
  opcional (migración **0005 aditiva, pendiente de aplicar a la BD**) y Historial con marcas
  recientes + «ver todas →». AC de flujo (🖐 1, 2, 4) pendientes de validación con el pulgar.
- ✅ **Chat inteligente + comer fuera** (idea Alex, 15-jul; reencuadrada 16-jul) — **Fases 0 y 1
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
  **Fase 2 (foto en el chat) pendiente**, se monta sobre este prompt — tras rodar la Fase 1 en uso.
- ✅ **Gramos como dato de primera clase** (idea Alex, 15-jul) — **Fases 1 y 2 IMPLEMENTADAS**,
  spec [`docs/specs/features/06-gramos-dato-primera-clase.md`](./specs/features/06-gramos-dato-primera-clase.md).
  **Fase 1**: base inmutable en `meal_entries` (migración **0006** aditiva) + stepper de cantidad
  en el editor de Hoy que reescala kcal/macros desde base + foto/plan/copiar-ayer persisten base +
  export/restore/`migrate:poc` con los campos nuevos + backfill de los "· NN g/ml" viejos
  (`pnpm backfill:grams`). **Fase 2**: `day-dump` con `gramos` nullable (prompt sincronizado a
  `04-IA.md`) + Describir a la altura de la foto (items con stepper, «separado/como una»). AC de
  flujo (🖐 1, 3, 4, 5, 8, 9, 10 y el 2 en su parte de pulgar) pendientes de validación en
  producción, + re-validación en vivo de F-IA-4 y café ×3 (se tocó el prompt congelado).
  **Deploy**: `pnpm db:migrate` (aplica 0005 pendiente + 0006) → `pnpm backfill:grams`; el modelo
  de day-dump (`AI_MODEL_VISION`) ya está configurado.
- 💡 **Registrar en el día los eventos que cuentas en el chat** (idea Alex, 15-jul — a refinar con el
  product-partner): cuando le dices algo al Chat que cambia el día («hoy no entreno, me han puesto
  implantes», «hoy ando solo»), esa info **muere en el hilo**: el Coach de mañana no la conoce. Debería
  poder capturarse en el día (nota / sesión = Descanso / fase) desde el propio chat, para que el
  contexto del Coach y de la Tendencia la recojan. Caso real del 15-jul (implantes → sin entreno).
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
- ✅ **Variantes de opción del plan** (idea Alex, 16-jul) — **IMPLEMENTADA Fase 1 (F08, v1.10)**,
  **pendiente de validación de Alex 🖐 (AC1 import real · AC3 registrar día real)** y deploy:
  [`docs/specs/features/08-variantes-opcion-plan.md`](./specs/features/08-variantes-opcion-plan.md).
  «Carne magra (pollo/pavo/ternera/cerdo)» sigue siendo **un** hueco; al **registrar** eliges
  la fuente con chips → macros correctas (swing pollo↔cerdo ~80 kcal a 210 g, ruido que la
  báscula no absorbe). `plan_options.variants` jsonb (migración **0008** aditiva); importador
  F-IA-9 con prompt reescrito que detecta y rellena las variantes; escalado por gramos reusa
  F06. export/restore/migrate:poc las transportan. DECISIONS #65. **Fase 2** (editar variantes
  a mano en el editor del plan, sin reimportar) **aplazada**.
  - **Requisito de deploy**: `pnpm db:migrate` (aplica **0008**) antes/junto al deploy en Vercel.
- 💡 **Describir que conoce tus productos** (idea Alex, 16-jul, durante la validación de F07) —
  **backlog, medir primero.** Caso real: los combos legacy tipo «Pan bimbo 1 reb. + mermelada
  s/a» no encajan en el modelo de producto (una combinación no reescala ni ajusta proporción;
  es la «foto congelada» que F07 retira). El caso «varios alimentos, no sé cuánto de cada uno»
  **ya lo cubre Describir (F-IA-4)** (parte en ítems con stepper por ítem). La idea nueva:
  que **Describir empareje el texto con tus productos guardados** → usa las macros EXACTAS del
  producto para lo conocido («pan bimbo») y solo **estima** lo desconocido («mermelada»).
  Toca el prompt congelado de F-IA-4 (re-validar AC + café ×3) + catálogo en el contexto del
  day-dump + lógica de matching. **Prerrequisito: F07 Fase 2** (crea el catálogo de productos
  reales que emparejar). **Decidir tras 2 semanas de uso real** del flujo «2 productos fijados
  + tap-tap / Describir» (regla anti-optimización-sin-medición, doc 11): si el tap-tap no
  molesta, no se hace. Descartado ya: creador de combo «foto de una etiqueta + describe el
  resto + buscar» (contamina F-IA-11, que es lector puro) y búsqueda en BD externas (NO-alcance
  de F07: OFF/USDA/BEDCA = ruido, principio 2).
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
