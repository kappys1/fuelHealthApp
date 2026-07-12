"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { useEffect } from "react";

/*
  Registro del service worker (Fase 4 PWA). SOLO en producción: en `next dev`
  (Turbopack) un SW activo intercepta los chunks de dev y provoca ChunkLoadError.
  Por eso, en desarrollo, además de NO registrar, DESREGISTRAMOS cualquier SW que
  hubiera quedado de una sesión de producción probada en localhost, y limpiamos sus
  caches — si no, seguiría rompiendo el dev tras cambiar de `next start` a `pnpm dev`.
*/
const isProd = process.env.NODE_ENV === "production";

export function PwaRegister({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (isProd) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {});
    }
    if (typeof caches !== "undefined") {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => void caches.delete(k)))
        .catch(() => {});
    }
  }, []);

  if (!isProd) return <>{children}</>;

  return (
    <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
      {children}
    </SerwistProvider>
  );
}
