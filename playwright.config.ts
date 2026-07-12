import { defineConfig, devices } from "@playwright/test";

/*
  Playwright · Fase 5 (06 §Fase 5). Flujos críticos en viewport móvil (iPhone),
  autenticados vía cookie iron-session sellada en global-setup (sin password en
  claro; ver DECISIONS #54).

  BD: los flujos que ESCRIBEN (registrar día, foto, check-in) van protegidos por
  `E2E_ALLOW_WRITES`. NO los actives contra la Neon de producción de Alex — usa una
  rama de test de Neon (`DATABASE_URL` apuntando a la rama) y define E2E_ALLOW_WRITES=1.
  El flujo de import CSV solo llega a la VISTA PREVIA (no escribe) → corre siempre.

  Ejecutar:
    corepack pnpm@11.9.0 exec playwright test           # con webServer local (next dev)
    E2E_BASE_URL=https://… corepack pnpm@11.9.0 exec playwright test   # contra un deploy
*/

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    storageState: "e2e/.auth/state.json",
    trace: "on-first-retry",
    // Bloquea el Service Worker (Serwist, solo prod): así page.route intercepta de
    // forma fiable las llamadas de IA (el SW proxyaría el fetch y las evadiría).
    serviceWorkers: "block",
    ...devices["iPhone 13"],
  },
  projects: [{ name: "mobile-safari", use: { ...devices["iPhone 13"] } }],
  // Sin E2E_BASE_URL arranca el servidor local. next dev compila por ruta (lento la
  // 1ª vez); para medir en serio usar un deploy vía E2E_BASE_URL.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "corepack pnpm@11.9.0 dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
