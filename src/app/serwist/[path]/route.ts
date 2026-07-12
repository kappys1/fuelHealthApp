import { createSerwistRoute } from "@serwist/turbopack";

/*
  Sirve el service worker compilado por Serwist (Turbopack) como archivo ESTÁTICO
  generado en build time desde src/app/sw.ts. Disponible en /serwist/sw.js; lo
  registra SerwistProvider en el layout. La página /offline se precachea para el
  fallback de navegación sin red.
*/
export const { GET, dynamic, dynamicParams, revalidate, generateStaticParams } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    // esbuild nativo (ya es dependencia de @serwist/turbopack); el default en
    // macOS es esbuild-wasm, que no está instalado.
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: "/offline", revision: "v1" }],
  });
