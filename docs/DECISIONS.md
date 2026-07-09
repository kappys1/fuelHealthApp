# DECISIONS.md — Registro de decisiones

Cada decisión no cubierta por las specs se resuelve con **lo más simple** y se
anota aquí. Fuente de verdad ante ambigüedad: el PRD (`01-PRD.md`).

Formato: **fecha · decisión · motivo**.

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-07-10 | **Auth: iron-session** (no Auth.js) | Usuario único con password en env; lo más simple. Cookie httpOnly cifrada + argon2. |
| 2026-07-10 | **Proxy** (`src/proxy.ts`) en vez de `middleware.ts` | Next 16 renombró middleware→proxy (runtime nodejs). Chequeo optimista de cookie en el proxy + verificación autoritativa (`getSession`) en el layout de `(app)`. |
| 2026-07-10 | **Driver DB: `@neondatabase/serverless` (neon-http)** | Suficiente para usuario único y funciona en Vercel; el seed lo reutiliza. Optimización futura documentada: `pg` + pool + `attachDatabasePool` con Vercel Fluid compute (recomendado por Neon para más carga). |
| 2026-07-10 | `phase` enum incluye `'normal'` y la columna es **nullable** (null = normal) | Reconcilia §1 (enum con normal) y §2 (Normal = null en BD). |
| 2026-07-10 | Merienda «conjunto»: `grp` asignado por tipo de alimento (Pan→Hidratos, Crema cacahuete→Grasa, Mermelada→Otros) | No existe valor de enum `conjunto`; la derivación de merienda suma por `meal`, así que `grp` no interfiere. |
| 2026-07-10 | `favorites` sin `base_g`: gramos/ml en el nombre; `meal` por defecto `almuerzo` | El esquema §1 de favorites no tiene base_g; los 4 favoritos son snacks de mañana. |
| 2026-07-10 | `diet_versions` semilla: `effective_from = '2025-01-01'`, `carb/fat target = null` | Baseline que cubre todas las fechas; §5 solo da kcal (1800) y prot (110); carb/fat se derivan del plan en Fase 1. |
| 2026-07-10 | `.env.local` escapa los `$` del hash argon2 (`\$`); en Vercel el hash va **crudo** | Next carga `.env*` con dotenv-expand (expande `$VAR`); Vercel inyecta el env directamente sin expansión. |
| 2026-07-10 | shadcn init con base **radix** + preset **nova**; colores **sobrescritos** por los tokens de `05-DISENO §2` | Radix = primitivas del spec; el preset solo aporta scaffolding, el tema es nuestro (si parece shadcn de fábrica, está mal). |
| 2026-07-10 | Password de Alex **temporal** generado en Fase 0 | Desbloquea la verificación de login; cambiar con `pnpm hash-password '<nuevo>'` y actualizar `AUTH_PASSWORD_HASH` (local y Vercel). |
| 2026-07-10 | `create-next-app --agents-md` creó `AGENTS.md` (nota Next 16) e importó `@AGENTS.md` al inicio de `CLAUDE.md` | El scaffold sobrescribió el CLAUDE.md original; restaurado íntegro conservando el import útil. |
| 2026-07-10 | Proyecto Vercel **`fuelboard`** (dir `myHealthPlanner` tiene mayúsculas, inválido como nombre) | Nombres de proyecto Vercel deben ir en minúsculas. |
