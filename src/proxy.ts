import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Proxy (antes «middleware» — renombrado en Next 16). Runtime nodejs.
 * Comprobación OPTIMISTA de sesión: si no hay cookie de sesión, redirige a
 * /login. La verificación autoritativa (descifrar la sesión) la hace el layout
 * de (app) vía getSession(); aquí solo evitamos pintar pantallas protegidas.
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession) {
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
