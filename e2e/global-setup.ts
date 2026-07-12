import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { sealData } from "iron-session";

/*
  Autentica los tests sellando una cookie iron-session idéntica a la que emite
  /api/auth/login, sin necesitar el password en claro (no disponible; DECISIONS #54).
  Se usa la misma forma de sesión (SessionData) y el mismo AUTH_SECRET que la app.
*/

const SESSION_COOKIE_NAME = "fuelboard_session";

export default async function globalSetup() {
  // Carga .env.local igual que Next (global-setup corre fuera del runtime de la app).
  loadEnvConfig(process.cwd());

  const password = process.env.AUTH_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente o <32 chars: define AUTH_SECRET en .env.local para sellar la sesión de test.",
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
