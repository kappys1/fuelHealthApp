import type { MetadataRoute } from "next";

/*
  Manifest PWA (Fase 4). Instalable en iOS (+ apple-touch-icon en el layout).
  Shortcuts (long-press del icono): «Añadir comida» → sheet de añadir; «Peso de
  hoy» → check-in matinal. Share target: compartir una foto abre el análisis.
*/
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fuelboard",
    short_name: "Fuelboard",
    description:
      "Telemetría personal de combustible: nutrición y rendimiento para recomposición y CrossFit.",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es",
    background_color: "#0F1613",
    theme_color: "#0F1613",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Añadir comida",
        short_name: "Añadir",
        url: "/hoy?add=1",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Peso de hoy",
        short_name: "Peso",
        url: "/hoy?checkin=weight",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    // share_target no está en el tipo MetadataRoute.Manifest de Next; es válido en
    // el manifest y lo añadimos vía spread tipado.
    ...({
      share_target: {
        action: "/share-target",
        method: "POST",
        enctype: "multipart/form-data",
        params: {
          files: [{ name: "image", accept: ["image/*"] }],
        },
      },
    } as object),
  };
}
