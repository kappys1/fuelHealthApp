@AGENTS.md

# CLAUDE.md — Fuelboard

App personal (**usuario único: Alex**) de nutrición y rendimiento: recomposición
corporal (perder grasa manteniendo/ganando músculo), rendimiento en CrossFit y
control de hinchazón/retención. Integra dieta pautada por Regenera, entrenamiento
(The Progrm), Apple Health/Watch, báscula Xiaomi y análisis con IA (Claude API).

Es la **reconstrucción "bien hecha" de un PoC ya validado** en Claude Artifacts:
todo lo especificado existe ya o fue una decisión razonada durante el PoC. No es
lista de deseos.

**Specs (fuente de verdad):** `docs/specs/` — documentos `00`–`07`.
Léelos antes de tocar su área: `01-PRD` (todo), `02-ARQUITECTURA` (código),
`03-DATOS` (schema/fórmulas), `04-IA` (features IA), `05-DISENO` (UI),
`06-PLAN-IMPLEMENTACION` (empezar), `07-REFINAMIENTOS-PRO` (cada fase).

## Estado actual

- Repo **sin scaffold todavía**: por ahora solo existen los docs. El siguiente
  paso es la **Fase 0** de `06-PLAN-IMPLEMENTACION.md`.
- Se trabaja **fase a fase**. **Nunca adelantar trabajo de fases futuras.** Cada
  fase termina con sus tests de aceptación en verde y deploy a Vercel funcionando.

## Stack

| Capa | Elección | Notas |
|---|---|---|
| Framework | **Next.js 16** (App Router, TS estricto) | React 19.2, Node ≥20, Turbopack por defecto; Cache Components es opt-in (no asumir caching implícito de Next 14/15). Server Components por defecto; Client solo donde hay interacción. |
| Hosting | **Vercel** | |
| BD | **Postgres gestionado** (Neon o Supabase) | Solo Postgres; nada de features propietarias. |
| ORM | **Drizzle** (`drizzle-kit`) | Migraciones versionadas en repo. |
| Auth | **Auth.js (credentials) o iron-session** | Usuario único; password argon2 en env; cookie httpOnly; middleware protege todo salvo `/login` y `/api/health/ingest`. |
| IA | **Vercel AI SDK (`ai`)** con adaptador de proveedor, SOLO en servidor | Capa agnóstica: hoy `@ai-sdk/anthropic`, mañana otro proveedor cambiando env vars (`AI_PROVIDER`, `AI_API_KEY`) sin tocar features. Requisitos del modelo: visión multimodal, JSON fiable y streaming (chat). API keys en env, nunca al cliente. |
| Estado cliente | **TanStack Query** + estado local | Nada de Redux; la BD es la fuente de verdad. |
| Estilos | **Tailwind CSS 4 + CSS variables** (tokens de `05-DISENO`) | |
| UI | **shadcn/ui** (Radix) tematizado con NUESTROS tokens | Componentes firma (FuelGauge, MealRow, PhotoAnalyzer) son custom. |
| Fotos | **Vercel Blob** | Acceso solo con sesión vía redirect firmado. |
| Gráficos | **Recharts** | |
| PWA | **Serwist** | Manifest + SW; cola offline con IndexedDB (`idb`). |
| Validación | **Zod** en todos los boundaries | API routes, respuestas IA, ingest. |
| Fechas | **date-fns + date-fns-tz** | "Día" = `Europe/Madrid`. PROHIBIDO `new Date().toISOString().slice(0,10)` para claves de día. |
| Tests | **Vitest** (unidad: fórmulas, parsers) + **Playwright** (flujos críticos) | |

## Comandos

> El repo aún no está scaffoldeado; estos son los scripts previstos y se fijan
> definitivamente en Fase 0. **`pnpm typecheck && pnpm test` en verde antes de
> cada commit.**

```bash
pnpm dev              # servidor de desarrollo (Turbopack)
pnpm build            # build de producción
pnpm typecheck        # tsc --noEmit (TS estricto)
pnpm test             # Vitest (unidad: analytics + parsers)
pnpm test:e2e         # Playwright (flujos críticos)
pnpm lint             # ESLint
pnpm db:generate      # drizzle-kit: generar migración desde el schema
pnpm db:migrate       # drizzle-kit: aplicar migraciones
pnpm migrate:poc <archivo>   # importar fuelboard-export-*.json del PoC (idempotente)
```

## Convenciones del repo

- **Prompts de IA congelados.** Los prompts de `04-IA.md` están probados en
  producción; se usan **TAL CUAL** (solo interpolando variables). No "mejorarlos"
  sin re-probar.
- **`temperature: 0`** en toda llamada IA (excepción documentada: chat F-IA-8 usa
  `0.3`). Misma entrada → misma salida.
- **Toda llamada a la IA pasa por API routes propias** (`server/ai/`) vía el
  Vercel AI SDK con el adaptador del proveedor configurado (`AI_PROVIDER`):
  el servidor construye el prompt, valida la respuesta con Zod (1 reintento si el
  JSON no parsea) y devuelve tipado. La API key nunca llega al cliente.
- **Errores de IA siempre visibles** (mensaje del proveedor + HTTP status). Nunca
  fallo silencioso.
- **Analítica en `server/analytics/` como funciones puras y testeadas.** Ni una
  fórmula en componentes. Igual para parsers de ingesta en `server/ingest/`.
- **Fechas siempre en `Europe/Madrid`** vía utilidades de `lib/dates.ts`.
- **Macros SIN decimales en UI** (guardar con 1 decimal está bien); los totales
  cuadran con la suma visible (redondear al final, no por item).
- **Migraciones de datos siempre versionadas.** Los datos son sagrados: 0 pérdidas.
- **shadcn tematizado con los tokens de `05-DISENO`**: si una pantalla parece la
  demo de shadcn, está mal tematizada.
- **Commits pequeños.** `pnpm typecheck && pnpm test` en verde antes de cada commit.
- **Ambigüedad:** fuente de verdad = el PRD; si el PRD calla, decide **lo más
  simple** y anótalo en `docs/DECISIONS.md`.

## Principios de producto (NO negociables — copiados íntegros de `01-PRD.md` §3)

1. **La báscula es la fuente de verdad del gasto.** El déficit/TDEE real sale de la pendiente del peso (media móvil 7 días). Las kcal del Apple Watch (error 15-30% en fuerza/CrossFit) y las estimaciones de sesión son SOLO contexto y se presentan visualmente subordinadas. Una sola cifra manda.
2. **Consistencia > exactitud.** Un sesgo constante en las estimaciones lo absorbe la calibración por peso; el ruido aleatorio no. Por eso: `temperature: 0` en toda llamada IA, instrucción de asumir "la variante más común en España" ante ambigüedad, y macros SIN decimales en UI (teatro de precisión prohibido).
3. **La fricción mata el sistema.** Registrar un día completo debe costar <2 minutos. Todo camino de entrada rápida es prioritario: favoritos 1 toque, copiar ayer, plantillas, volcado de día por texto, foto.
4. **Fase ≠ sesión.** Qué entrenó (sesión) y el contexto nutricional del día (fase: Normal/Carga/Competición/Recuperación) son dimensiones independientes. Las fases especiales cambian el comportamiento: pasarse de kcal no es desviación, y esos días se excluyen de adherencia e ingesta media.
5. **Cada fuente se compara consigo misma.** Báscula propia vs báscula propia (mañana, ayunas); MED del nutricionista vs MED. Nunca cruzar valores absolutos entre fuentes.
6. **Datos reales > manuales.** Al importar de Apple Health, si hay valor para una fecha, machaca el manual; si no viene, se conserva el manual.
7. **Los datos son sagrados.** Export completo en 1 clic, import/restore, backups automáticos, migraciones versionadas. En el PoC el recordatorio salta a los 7 días sin export; en la app real el backup es automático (BD gestionada) pero el export sigue existiendo.
8. **El sistema informa, el nutricionista decide.** La IA nunca prescribe cambios de dieta; señala datos y genera preguntas para la consulta. Ajustes de kcal/proteína son conversaciones con Regenera, con la app como evidencia.
