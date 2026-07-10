/*
  Pipeline de imagen en cliente (02-ARQUITECTURA §3.2, 04-IA F-IA-1):
  - Caso normal (iOS da JPEG): FileReader → Image → canvas máx 1024 px lado largo
    → JPEG 0.8 → base64. Menos bytes = menos coste/latencia en la IA.
  - HEIC/HEIF (Safari desktop no decodifica): se envía el ORIGINAL al servidor,
    que lo convierte con sharp. NUNCA blob-URLs (lección del PoC).
  - Límite de subida 8 MB.
  El resultado se guarda en el estado del cliente para REANALIZAR sin resubir.
*/

export interface ProcessedImage {
  /** base64 SIN prefijo data-url. */
  base64: string;
  /** "image/jpeg" en el caso normal; el tipo original si es HEIC. */
  mediaType: string;
  /** true si va sin procesar (HEIC) y el servidor debe convertirla. */
  isHeic: boolean;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIM = 1024;

function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t.includes("heic") || t.includes("heif")) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo decodificar la imagen."));
    img.src = dataUrl;
  });
}

export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.size > MAX_BYTES) {
    throw new Error("La imagen supera el límite de 8 MB.");
  }

  // HEIC: sin procesar en cliente → el servidor lo convierte con sharp.
  if (isHeic(file)) {
    const dataUrl = await readAsDataURL(file);
    return {
      base64: stripDataUrl(dataUrl),
      mediaType: file.type || "image/heic",
      isHeic: true,
    };
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen (canvas).");
  ctx.drawImage(img, 0, 0, w, h);

  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return {
    base64: stripDataUrl(jpegDataUrl),
    mediaType: "image/jpeg",
    isHeic: false,
  };
}
