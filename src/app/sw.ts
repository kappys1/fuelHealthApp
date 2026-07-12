import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

/*
  Service worker (Serwist · Fase 4 PWA). Precachea el app-shell (para abrir la app
  sin red), runtime caching por defecto y fallback offline para navegaciones.
  Además intercepta el share target (compartir una foto desde la galería → se abre
  el análisis de foto en Hoy). Excluido del typecheck del proyecto (tsconfig): usa
  tipos de WebWorker; Serwist lo compila aparte.
*/
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Share Target (07 §3): la app se registra como destino de compartir imágenes.
// El POST del sistema a /share-target se intercepta aquí, se guarda la imagen en
// Cache Storage y se redirige a /hoy?share=1, donde el cliente la recoge y abre la
// capa de foto. Registrado ANTES que Serwist para tener prioridad en el fetch.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const file = form.get("image");
          if (file && file instanceof File) {
            const cache = await caches.open("fuelboard-shared");
            await cache.put(
              "/shared-image",
              new Response(file, {
                headers: { "Content-Type": file.type || "image/jpeg" },
              }),
            );
          }
        } catch {
          /* si algo falla, seguimos: la app abre sin imagen (degrada sin romper) */
        }
        return Response.redirect("/hoy?share=1", 303);
      })(),
    );
  }
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
