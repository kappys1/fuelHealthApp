import { unsealData } from "iron-session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  sessionOptions,
  type SessionData,
} from "@/lib/session";

/**
 * Proxy (antes «middleware» — renombrado en Next 16).
 * Comprobación AUTORITATIVA de sesión: descifra la cookie con la MISMA config
 * que getSession() (`sessionOptions`) y solo la da por válida si descifra y está
 * `authenticated`. Una cookie ausente, caducada (el sello de iron-session caduca
 * a los 14 días por defecto aunque el cookie viva 30), corrupta o sellada con
 * otro AUTH_SECRET cuenta como «sin sesión».
 *
 * Antes esto solo miraba si la cookie EXISTÍA (`cookies.has`); una cookie muerta
 * hacía que /hoy rebotara a /login (el layout la rechaza al descifrar) y /login
 * rebotara a /hoy (el proxy la veía «presente») → bucle ERR_TOO_MANY_REDIRECTS.
 * Ver docs/DECISIONS.md.
 *
 * Exento de sesión: /login, /api/auth/*, /api/health/ingest (token propio), y los
 * artefactos PWA (el SW y la página offline deben servirse sin sesión para que el
 * precache y el arranque offline funcionen).
 */
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health/ingest",
  "/serwist",
  "/offline",
];

/**
 * true solo si la cookie de sesión descifra y está autenticada. Cualquier fallo
 * de descifrado (caducidad, corrupción, secreto rotado) se trata como false.
 */
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return false;
  try {
    const data = await unsealData<SessionData>(raw, {
      password: sessionOptions.password as string,
      ttl: sessionOptions.ttl,
    });
    return data.authenticated === true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const authed = await hasValidSession(request);

  if (!isPublic && !authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const res = NextResponse.redirect(url);
    // Auto-sana: si había una cookie muerta, bórrala para no re-descifrarla en
    // cada navegación (y para cerrar del todo el antiguo bucle).
    if (request.cookies.has(SESSION_COOKIE_NAME)) {
      res.cookies.delete({ name: SESSION_COOKIE_NAME, path: "/" });
    }
    return res;
  }

  if (pathname === "/login" && authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/hoy";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Corre en todo salvo assets estáticos e internos de Next.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
  ],
};
