/*
  Normalización de archivos (imagen/PDF) al formato que esperan las rutas de IA:
  { base64, mediaType }. Cliente-only (usa FileReader/Image/canvas). Compartido por
  F-IA-9 (importar dieta) y F-IA-10 (importar semana de entreno).
*/

const MAX_DIM = 2000;

/** Lee un archivo al formato de la route; PDF/HEIC van tal cual, resto se reescala. */
export async function fileToAiFile(
  file: File,
): Promise<{ base64: string; mediaType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const base64 = dataUrl.split(",")[1] ?? "";
  const mediaType = file.type || "application/octet-stream";
  const isHeic = /heic|heif/i.test(mediaType) || /\.hei[cf]$/i.test(file.name);

  // PDF y HEIC: se envían tal cual (Gemini lee el PDF nativo; el servidor convierte
  // HEIC con sharp). El resto de imágenes se reescalan a ≤2000 px para legibilidad
  // del documento sin pasarse del límite de 8 MB.
  if (mediaType === "application/pdf" || isHeic || !mediaType.startsWith("image/")) {
    return { base64, mediaType };
  }
  try {
    const downscaled = await downscale(dataUrl);
    return { base64: downscaled, mediaType: "image/jpeg" };
  } catch {
    return { base64, mediaType };
  }
}

function downscale(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "");
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
