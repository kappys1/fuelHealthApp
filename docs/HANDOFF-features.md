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
- 📝 **Coach fiable + puente al Chat** (2026-07-13) — **APROBADA**, pendiente de implementar:
  [`docs/specs/features/01-coach-fiable-y-puente-chat.md`](./specs/features/01-coach-fiable-y-puente-chat.md).
  Bug de fecha (el Chat alucinaba «hoy 18-jul» siendo 13) + bug de la crema de arroz (el Coach
  recomendaba comida fuera de la dieta) + botón «Seguir en el chat →» para repreguntar sobre el
  contexto del Coach (opción A1).
- 🐞 **BUG · «Copiar» no funciona** (2026-07-13) — en el sheet del Coach (y a verificar en las
  burbujas del Chat) el botón de copiar no copia. Sospecha: `navigator.clipboard` en la PWA de
  iOS (contexto seguro / gesto perdido). Pendiente de reproducir y diagnosticar (bug puro, no
  entra en la spec F01).
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
