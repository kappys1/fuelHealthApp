# Fuelboard

App personal de nutrición y rendimiento para Alex (usuario único). Reconstrucción
del PoC validado en Claude Artifacts. Specs (fuente de verdad) en `docs/specs/`;
decisiones en `docs/DECISIONS.md`; convenciones y principios en `CLAUDE.md`.

Stack: Next.js 16 (App Router, TS estricto, Turbopack) · Tailwind 4 + shadcn/ui
tematizado con los tokens de `05-DISENO` · Drizzle + Neon (Postgres) · iron-session
· TanStack Query · Vercel.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local        # y rellena (ver abajo)
pnpm db:migrate                   # aplica migraciones a Neon
pnpm db:seed                      # siembra el plan Regenera (idempotente)
pnpm dev                          # http://localhost:3000
```

### Variables de entorno

Ver `.env.example`. Claves de Fase 0:

- `DATABASE_URL` — Neon (provisionado vía Vercel Marketplace; `vercel env pull .env.local`).
- `AUTH_SECRET` — ≥32 caracteres, cifra la cookie de sesión.
- `AUTH_PASSWORD_HASH` — hash argon2 del password de Alex.
- `HEALTH_INGEST_TOKEN` — bearer para `/api/health/ingest` (Fase 3).

> En `.env.local` los `$` del hash argon2 van escapados como `\$` (Next usa
> dotenv-expand). En Vercel el hash se guarda **crudo** (inyección directa).

### Cambiar el password

```bash
pnpm hash-password 'tu-nuevo-password'
# copia el hash a AUTH_PASSWORD_HASH (.env.local) y a Vercel:
#   printf '%s' '<hash-crudo>' | vercel env add AUTH_PASSWORD_HASH production
```

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` / `build` / `start` | Next (Turbopack) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` / `test:e2e` | Vitest / Playwright |
| `pnpm db:generate` / `db:migrate` / `db:push` | Drizzle Kit |
| `pnpm db:seed` | Seed del plan Regenera |
| `pnpm hash-password '<pw>'` | Hash argon2 para `AUTH_PASSWORD_HASH` |

## Estado

La **v1 está completa y desplegada**. El desarrollo activo está en
`feat/wellness-premium-v2`: rediseño Wellness v2 con paridad funcional documentada,
F10 y F11 implementadas, Gate 4 automatizado verde y Gate 5 aprobado por Alex tras
dos días de uso real. Las migraciones `0000–0015` ya están aplicadas; queda integrar
la rama en `main` y observar el despliegue de producción.

Estado operativo: `docs/REDESIGN-MIGRATION-WORKFLOW.md`. Backlog vigente:
`docs/HANDOFF-features.md`.
