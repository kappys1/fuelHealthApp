# E2E (Playwright) — flujos críticos de Fase 5

4 specs: `register-day`, `photo` (IA mockeada), `checkin-morning`, `import-csv`.

## Reglas de seguridad

- Los 3 primeros **escriben en BD** → protegidos por `E2E_ALLOW_WRITES`. **Nunca** los
  corras contra la Neon de producción. Usa una **rama de test de Neon** (aislada, COW).
- `import-csv` solo llega a la vista previa (no escribe) → corre siempre.
- Auth: `global-setup.ts` sella una cookie iron-session con `AUTH_SECRET` de `.env.local`
  (sin password en claro; DECISIONS #54).

## Correr los 4 flujos (recomendado: build de prod + rama de test)

El dev server (Turbopack) es flaky para e2e (HMR `ChunkLoadError`, compilación por-ruta).
Corre contra un **build de producción**, que además desactiva el SW vía `serviceWorkers: "block"`.

```bash
# 1) rama de test de Neon (requiere NEON_API_KEY scoped al proyecto)
NEON_API_KEY=napi_… corepack pnpm@11.9.0 dlx neonctl branches create \
  --project-id <project-id> --name e2e-test --output json   # copia COW de main (datos+seed)

# 2) build + server de prod apuntando a la rama
corepack pnpm@11.9.0 build
DATABASE_URL="<connection_uri de la rama>" corepack pnpm@11.9.0 start &

# 3) specs contra ese server (reusa el server vía E2E_BASE_URL)
E2E_BASE_URL=http://localhost:3000 E2E_ALLOW_WRITES=1 \
  corepack pnpm@11.9.0 exec playwright test

# 4) limpieza
NEON_API_KEY=napi_… corepack pnpm@11.9.0 dlx neonctl branches delete e2e-test --project-id <project-id>
```

Sin `E2E_BASE_URL`, la config arranca `next dev` sola (válido para `import-csv`; los de
escritura pueden ser flaky en dev).
