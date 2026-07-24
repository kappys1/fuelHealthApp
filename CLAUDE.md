@AGENTS.md

# CLAUDE.md — Fuelboard

App personal (**usuario único: Alex**) de nutrición y rendimiento: recomposición
corporal (perder grasa manteniendo/ganando músculo), rendimiento en CrossFit y
control de hinchazón/retención. Integra dieta pautada por Regenera, entrenamiento
(The Progrm), Apple Health/Watch, báscula Xiaomi y análisis con IA.

Es la **reconstrucción "bien hecha" de un PoC ya validado** en Claude Artifacts:
todo lo especificado existe ya o fue una decisión razonada durante el PoC. No es
lista de deseos.

## Specs (fuente de verdad) — `docs/specs/` (00–09)

Léelos antes de tocar su área:
- `00-README` (índice) · `01-PRD` (visión, principios, requisitos F1-F8) ·
  `02-ARQUITECTURA` (stack/estructura/seguridad/env) · `03-DATOS` (schema, fórmulas,
  ingesta HAE, migración PoC) · `04-IA` (features IA, prompts exactos) ·
  `05-DISENO` (tokens, tipografía, componentes) · `06-PLAN-IMPLEMENTACION` (fases) ·
  `07-REFINAMIENTOS-PRO` (comportamiento pro por fase) · `08-PROMPTS-CLAUDE-CODE`
  (prompts por sesión) · `09-FLUJOS-UX` (arquitectura de interacción).

**Jerarquía:** `09-FLUJOS-UX.md` **manda sobre la organización de pantallas** implícita
en el PRD (los requisitos F1-F8 siguen todos vigentes; el 09 define cómo se organizan
y se usan: por *momentos de uso*, no por features). Ante ambigüedad de contenido, el PRD.

## Estado actual

- **Desarrollo activo: `feat/wellness-premium-v2` (release candidate en uso real,
  todavía no integrado en `main`).**
  La matriz de paridad quedó congelada en `965e992`; después se añadieron F10, F11
  y el fix de ingesta `363fa61`. El Gate 4 automatizado está verde sobre el HEAD
  actual y Alex aprobó el Gate 5 el 2026-07-24 tras dos días de uso real sin
  incidencias. Neon ya tiene aplicadas `0000–0015`. Solo queda Gate 6:
  sincronización con `main`, verificación final, merge y observación en producción.
  Fuente operativa: `docs/REDESIGN-MIGRATION-WORKFLOW.md`.
- **Fases 0–5 completas, desplegadas y en uso** (Vercel `fuelboard`, región `fra1`) —
  **v1 completa** (resumen en `docs/CHANGELOG-v1.md`):
  - **F0**: Next 16 + Tailwind4/shadcn tematizado (tokens 05 §2, AA verificado),
    Drizzle+Neon con schema+seed, auth iron-session, nav 4 pestañas + Ajustes.
  - **F1**: Hoy (FuelGauge, timeline, Mi día, sheet de añadir, check-ins, exprés),
    Plan (objetivos versionados, derivar, CRUD), migración PoC idempotente.
  - **F2**: IA agnóstica (`server/ai/`, Vercel AI SDK v7 + Gemini, `Output.object`,
    1 reintento, errores visibles); F-IA-1 foto (Blob privado + miniaturas), F-IA-2
    estimar, F-IA-3 opción de plan, F-IA-4 volcado del día, F-IA-5 WOD.
  - **F3**: parsers HAE (`server/ingest/` CSV+JSON, tabla EXACTA 03 §4.2, kJ→kcal,
    mL→L, colisión peso/paso, tests), endpoint `/api/health/ingest` (Bearer,
    tolerante, upsert por fecha), analítica pura (`server/analytics/` ma7/déficit/
    adherencia, exclusión fases especiales), pantalla **Progreso · Tendencia**
    (TrendCard invertida, adherencia, gráficos peso+ma7 e ingesta, popovers F6.6,
    rango 14/30/90/todo, Últimos días; segmento MED en Fase 4) y **Ajustes**
    (import CSV con vista previa, estado de sync, export/import-restore).
  - **F4** (completa, desplegada y en uso en el iPhone de Alex):
    segmento **MED** en Progreso (CRUD retroactivo, difs `actual−anterior` con color
    semántico, gráfico doble eje, `analytics/medDeltas` testeado), **Coach** (F-IA-6)
    tras el ✨ del FuelGauge en sheet, **Chat** (F-IA-8: hilos, streaming, chips,
    contexto fresco, resumen cacheado, guardarraíles), **Preparar visita** (F-IA-7),
    **Importar dieta foto/PDF** (F-IA-9, PDF nativo a Gemini, vista previa editable),
    **PWA** (Serwist/Turbopack, manifest+shortcuts+share target, cola offline `idb`
    con replay, botones IA offline). Infra IA reusable en `server/ai/context.ts`.
  - **Requisitos de deploy de F4**: (1) `AI_MODEL_COACH` en `.env.local` y Vercel
    (coach/chat/visita); (2) `pnpm db:migrate` (migración 0002: `chat_threads.summary`
    /`summary_msg_count`); (3) `pnpm install` respeta `pnpm.ignoredBuiltDependencies`.
  - **F5** (pulido y validación): auditoría de diseño (título de documento dinámico,
    inputs a 16px sin zoom iOS, loadings sin CLS, `prefers-reduced-motion`) y de flujos
    (fase post-especial auto-sugerida, peso exprés cableado al shortcut, hueco horario
    del aviso de peso, plantilla en bottom-sheet); **Playwright** de los 4 flujos
    críticos (registrar día, foto con IA mockeada, check-in matinal, import CSV) en
    verde contra rama de test de Neon (`serviceWorkers:"block"`, auth por cookie
    sellada; ver `e2e/README.md`); **región de función fijada a `fra1`** (verificado en
    vivo; antes se ignoraba en Hobby → `iad1`); **LCP real ~0,5 s** (el 4,2 s de
    Lighthouse es lab, slow-4G simulado, documentado); **coste IA ~€1,6–1,9/mes** (< 5 €;
    `AI_MODEL_COACH` = Gemini 3.5 Flash).
- **v1 completa.** Siguiente: cerrar y publicar Wellness v2; después, **uso real**
  hasta la MED de agosto (validar la predicción de Tendencia contra los pliegues
  del nutri) y backlog (`docs/HANDOFF-features.md`).
- Se trabaja **fase a fase**. **Nunca adelantar trabajo de fases futuras.** Cada
  fase termina con sus tests de aceptación en verde y deploy a Vercel funcionando.

## Stack

| Capa | Elección | Notas |
|---|---|---|
| Framework | **Next.js 16** (App Router, TS estricto) | React 19.2, Node ≥20, Turbopack por defecto. `middleware`→**`proxy.ts`**; `cookies()/headers()/params` son async. Server Components por defecto; Client solo con interacción. |
| Hosting | **Vercel** | Proyecto `fuelboard` (cuenta kappys1). |
| BD | **Postgres gestionado (Neon)** | Solo Postgres; nada propietario. |
| ORM | **Drizzle** (`drizzle-kit`) | Migraciones versionadas en repo. |
| Auth | **iron-session** | Usuario único; password argon2 en env; cookie httpOnly; proxy protege todo salvo `/login`, `/api/auth/*` y `/api/health/ingest`. |
| IA | **Vercel AI SDK (`ai`)**, SOLO en servidor | Agnóstica de proveedor por `AI_PROVIDER` (proveedor real cableado hoy: **Google/Gemini `@ai-sdk/google`**). Keys en env, nunca al cliente. |
| Estado cliente | **TanStack Query** + estado local | La BD es la fuente de verdad. |
| Estilos | **Tailwind CSS 4 + CSS variables** (tokens de `05-DISENO`) | |
| UI | **shadcn/ui** (Radix) tematizado con NUESTROS tokens | Componentes firma (FuelGauge, MealRow, PhotoAnalyzer) custom. **Bottom-sheets para TODO flujo de creación/edición**; páginas solo para las 4 pestañas (09 §6). |
| Fotos | **Vercel Blob** | Acceso solo con sesión vía redirect firmado. |
| Gráficos | **Recharts** | |
| PWA | **Serwist** | Manifest + SW; cola offline (IndexedDB `idb`). |
| Validación | **Zod** en todos los boundaries | |
| Fechas | **date-fns + date-fns-tz** | "Día" = `Europe/Madrid` vía `lib/dates.ts`. PROHIBIDO `toISOString().slice(0,10)` para claves de día. |
| Tests | **Vitest** (fórmulas, parsers, contraste) + **Playwright** (flujos críticos) | |

## Navegación (09-FLUJOS-UX §2)

**4 pestañas** (nav inferior): **Hoy · Plan · Progreso · Chat** + **Ajustes** (icono en el header).
- **Progreso** fusiona *Tendencia | MED* (segmentos); "Preparar visita" vive en MED;
  "Últimos días" al final de Tendencia.
- **Ajustes**: tema, import CSV, estado del endpoint de Salud, export/restore, mapeo
  sesión↔día. (Salud deja de ser pestaña.)
- **Chat**: destino conversacional de "pregúntale a tus datos".

## Comandos

```bash
pnpm dev              # servidor de desarrollo (Turbopack)
pnpm build            # build de producción
pnpm typecheck        # tsc --noEmit (TS estricto)
pnpm test             # Vitest (analytics + parsers + contraste de tokens)
pnpm test:e2e         # Playwright (flujos críticos)
pnpm lint             # ESLint
pnpm audit:contrast   # auditoría WCAG de los tokens (ambos temas)
pnpm db:generate      # drizzle-kit: generar migración desde el schema
pnpm db:migrate       # drizzle-kit: aplicar migraciones
pnpm db:seed          # sembrar el plan Regenera (idempotente)
pnpm hash-password '<pw>'     # hash argon2 para AUTH_PASSWORD_HASH
pnpm migrate:poc <archivo>    # importar fuelboard-export-*.json del PoC (Fase 1)
```

## Convenciones del repo

- **Estructura por momentos de uso (09 manda).** Bottom-sheets para crear/editar;
  máximo una decisión por pantalla de sheet; defaults inteligentes en todo (comida
  por hora, gramos = baseG, fecha = hoy). Nunca añadir otra tarjeta permanente a Hoy.
- **Prompts de IA congelados. Fuente de verdad de la REDACCIÓN: `server/ai/prompts.ts`**
  (funciones congeladas, con comentarios de decisión, cubiertas por `prompts.test.ts`); se
  usan **TAL CUAL** (solo interpolando variables) y no se "mejoran" sin re-probar. `04-IA.md`
  **no** reproduce el texto literal: conserva modelos, esquemas de salida, costes, AC y
  doctrina, y apunta a la función de `prompts.ts` de cada feature. Cambiar redacción = editar
  `prompts.ts` + re-validar los AC de esa feature (+ café ×3 si toca estimación, DECISIONS
  #65) + sync a 04-IA SOLO si cambió esquema/modelo/coste/AC/doctrina. (DECISIONS #70.)
- **`temperature: 0`** en toda llamada IA (excepción documentada: chat F-IA-8 usa `0.3`).
- **Toda llamada a la IA pasa por API routes propias** (`server/ai/`) vía el Vercel AI
  SDK: el servidor construye el prompt, valida con Zod (1 reintento si el JSON no parsea)
  y devuelve tipado. La API key nunca llega al cliente.
- **Errores de IA siempre visibles** (mensaje del proveedor + HTTP status). Nunca silencio.
- **Analítica en `server/analytics/` como funciones puras y testeadas.** Ni una fórmula
  en componentes. Igual para parsers de ingesta en `server/ingest/`.
- **Fechas siempre en `Europe/Madrid`** vía `lib/dates.ts`.
- **Macros SIN decimales en UI** (guardar con 1 decimal está bien); los totales cuadran
  con la suma visible (redondear al final, no por item).
- **Contraste AA obligatorio en ambos temas** (`pnpm audit:contrast`, gate en tests).
- **Optimista + undo + autosave** (07): mutaciones instantáneas con TanStack Query;
  borrar entrada = toast "Deshacer", no confirmación (excepto plan/plantilla/MED/restore).
- **Migraciones de datos siempre versionadas.** Los datos son sagrados: 0 pérdidas.
- **shadcn tematizado con los tokens de `05-DISENO`**: si una pantalla parece la demo de
  shadcn, está mal tematizada.
- **Commits pequeños.** `pnpm typecheck && pnpm test` en verde antes de cada commit.
- **Ambigüedad:** fuente de verdad = 09 (estructura) / PRD (contenido); si callan,
  decide **lo más simple** y anótalo en `docs/DECISIONS.md`.
- **Skills del repo** (`.claude/skills/`): pensar/refinar ideas o quejas de uso →
  `fuelboard-product-partner` · ejecutar specs aprobadas, fases y quick-fixes →
  `fuelboard-implementer` · conversaciones de la IA de la app que fueron mal / afinar
  prompts-contexto-modelos → `fuelboard-ai-tuner` · leer MED/Tendencia/preparar visitas →
  `fuelboard-analyst`. Ante duda de cuál: el partner.

## Principios de producto (NO negociables — copiados íntegros de `01-PRD.md` §3)

1. **La báscula es la fuente de verdad del gasto.** El déficit/TDEE real sale de la pendiente del peso (media móvil 7 días). Las kcal del Apple Watch (error 15-30% en fuerza/CrossFit) y las estimaciones de sesión son SOLO contexto y se presentan visualmente subordinadas. Una sola cifra manda.
2. **Consistencia > exactitud.** Un sesgo constante en las estimaciones lo absorbe la calibración por peso; el ruido aleatorio no. Por eso: `temperature: 0` en toda llamada IA, instrucción de asumir "la variante más común en España" ante ambigüedad, y macros SIN decimales en UI (teatro de precisión prohibido).
3. **La fricción mata el sistema.** Registrar un día completo debe costar <2 minutos. Todo camino de entrada rápida es prioritario: favoritos 1 toque, copiar ayer, plantillas, volcado de día por texto, foto.
4. **Fase ≠ sesión.** Qué entrenó (sesión) y el contexto nutricional del día (fase: Normal/Carga/Competición/Recuperación) son dimensiones independientes. Las fases especiales cambian el comportamiento: pasarse de kcal no es desviación, y esos días se excluyen de adherencia e ingesta media.
5. **Cada fuente se compara consigo misma.** Báscula propia vs báscula propia (mañana, ayunas); MED del nutricionista vs MED. Nunca cruzar valores absolutos entre fuentes.
6. **Datos reales > manuales.** Al importar de Apple Health, si hay valor para una fecha, machaca el manual; si no viene, se conserva el manual.
7. **Los datos son sagrados.** Export completo en 1 clic, import/restore, backups automáticos, migraciones versionadas. En el PoC el recordatorio salta a los 7 días sin export; en la app real el backup es automático (BD gestionada) pero el export sigue existiendo.
8. **El sistema informa, el nutricionista decide.** La IA nunca prescribe cambios de dieta; señala datos y genera preguntas para la consulta. Ajustes de kcal/proteína son conversaciones con Regenera, con la app como evidencia.
9. **La IA habla con el atleta de hoy.** Ningún dato personal, deportivo ni de objetivos va hardcodeado en prompts o código: todo sale del perfil vigente (`athleteProfile`) y del calendario real. El objetivo es un estado con fecha, no una constante — y su historial es parte de los datos. (doc 10 · Fase A)
