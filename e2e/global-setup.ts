import fs from "node:fs";
import path from "node:path";
import { sealData } from "iron-session";

/*
  Autentica los tests sellando una cookie iron-session idéntica a la que emite
  /api/auth/login, sin necesitar el password en claro (no disponible; DECISIONS #54).
  Se usa la misma forma de sesión (SessionData) y el mismo AUTH_SECRET que la app.
  Se lee .env.local a mano (sin @next/env) para no arrastrar deps al contexto de test.
*/

const SESSION_COOKIE_NAME = "fuelboard_session";

function readAuthSecret(): string | null {
  const envPath = path.join(process.cwd(), ".env.local");
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (!fs.existsSync(envPath)) return null;
  const m = fs.readFileSync(envPath, "utf8").match(/^AUTH_SECRET\s*=\s*(.*)$/m);
  if (!m || !m[1]) return null;
  // dotenv-expand escapa los `$` como `\$` en .env.local (DECISIONS #29).
  return m[1].trim().replace(/^["']|["']$/g, "").replace(/\\\$/g, "$");
}

export default async function globalSetup() {
  const password = readAuthSecret();
  if (!password || password.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente o <32 chars: define AUTH_SECRET en .env.local (o en el entorno) para sellar la sesión de test.",
    );
  }

  // Misma forma que SessionData ({ authenticated, loginAt }); ttl por defecto de
  // iron-session, igual que la app (no pasa ttl en sessionOptions).
  const sealed = await sealData({ authenticated: true, loginAt: Date.now() }, { password });

  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const url = new URL(baseURL);

  const storageState = {
    cookies: [
      {
        name: SESSION_COOKIE_NAME,
        value: sealed,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax" as const,
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      },
    ],
    origins: [],
  };

  const dir = path.join(process.cwd(), "e2e", ".auth");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(storageState, null, 2));
}
