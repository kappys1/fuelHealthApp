import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hay un lockfile en el directorio padre; fijamos la raíz a este proyecto
  // (los comandos de Next se ejecutan desde la raíz) para que el tracing de
  // ficheros y Turbopack usen el root correcto.
  turbopack: { root: process.cwd() },
  // sharp usa binarios nativos (conversión HEIC→JPEG en /api/ai/photo y
  // /api/photos): se externaliza para que no lo empaquete el bundler del server.
  // sharp (HEIC→JPEG) y esbuild (compilación del SW de Serwist en build time) usan
  // binarios nativos: se externalizan para que no los empaquete el bundler.
  serverExternalPackages: ["sharp", "esbuild"],
  // Dev: permitir que el móvil (misma wifi) cargue los recursos del dev server
  // por la IP de red. Sin esto, Next 16 bloquea las peticiones cross-origin de
  // dev y la página NO hidrata en el móvil (se ve pero los botones no responden).
  // Solo afecta a `next dev`; en producción (Vercel) es irrelevante.
  allowedDevOrigins: ["192.168.0.13"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // CSP mínima y no disruptiva (anti-clickjacking). La CSP completa se
          // endurecerá en fases posteriores (nonces para scripts).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
        ],
      },
    ];
  },
};

// Serwist con Turbopack (Next 16): el SW se compila en build time como archivo
// estático servido desde /serwist/[path] (route.ts), sin acoplar webpack. Registro
// con SerwistProvider (layout). Ver src/app/sw.ts y src/app/serwist/[path]/route.ts.
export default withSerwist(nextConfig);
