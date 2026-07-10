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
| 2026-07-10 | **Bug de contraste corregido**: `--muted-foreground` resolvía a `--surface-2` (fondo) por reasignar `--muted` tras `var(--muted)`. Ahora `--muted-foreground` = color de texto atenuado directo (#5D6862 / #93A099) | Las CSS vars se resuelven en uso, no en declaración; la colisión de nombre shadcn(`--muted`=fondo) vs spec(`--muted`=texto) dejaba los textos atenuados casi invisibles en ambos temas. |
| 2026-07-10 | **Errores en naranja legible**: `--destructive` = #B8480C (claro) / #F2894C (oscuro), distinto del relleno de macro `--fat` (#E8590C) | #E8590C como TEXTO sobre blanco da 3.3:1 (<4.5 AA). El naranja de macro se mantiene para barras/gráficos; el de texto de error cumple AA. |
| 2026-07-10 | **Ámbar «hidratos» claro** #B8860B → **#B0800A** | El original daba 2.94:1 sobre `--bg` (<3:1 WCAG 1.4.11 para rellenos). Oscurecido lo mínimo para pasar; sigue ámbar. |
| 2026-07-10 | **Auditoría de contraste automatizada** (`src/lib/contrast.ts` + test + `pnpm audit:contrast`) enganchada a `pnpm test` | Los tokens son los cimientos; un contraste roto debe romper el build. Texto ≥4.5:1, rellenos ≥3:1; bordes sutiles por diseño (no bloqueantes). |
| 2026-07-10 | `turbopack.root` = `process.cwd()` (no `import.meta.dirname`) | En el config de Next `import.meta.dirname` resolvía mal (apuntaba a `src/app`) y rompía Turbopack; los comandos de Next corren desde la raíz. |
| 2026-07-10 | Borrado `pnpm-workspace.yaml` autogenerado (placeholders de `allowBuilds`) | pnpm lo crea por la config global `min-release-age`/aprobación de builds; con placeholders inválidos rompe `pnpm run` en pnpm 9. No es un workspace; deps nativas ya compiladas. |
| 2026-07-10 | Login: input con fondo `--surface-2` y altura 44px; botón 44px | Distinguir input de la tarjeta y cumplir target táctil ≥44px (05-DISENO §4). |
