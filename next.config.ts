import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hay un lockfile en el directorio padre; fijamos la raíz a este proyecto
  // (los comandos de Next se ejecutan desde la raíz) para que el tracing de
  // ficheros y Turbopack usen el root correcto.
  turbopack: { root: process.cwd() },
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

export default nextConfig;
