/*
  Pipeline de imagen en cliente (02-ARQUITECTURA §3.2, 04-IA F-IA-1):
  - Se INTENTA SIEMPRE la reducción por canvas (Image → canvas máx 1024 px →
    JPEG 0.8 → base64), incluido HEIC: iOS Safari SÍ decodifica HEIC en <img>/
    canvas, así que el móvil (el caso real de esta app) produce un JPEG pequeño
    sin depender de sharp ni rozar el límite de cuerpo de Vercel.
  - Solo si el navegador NO puede decodificar (p. ej. HEIC en Safari de
    escritorio) se envía el ORIGINAL y lo convierte sharp en el servidor.
  - Menos bytes = menos coste/latencia en la IA. NUNCA blob-URLs (lección PoC).
  - Límite de subida 8 MB. El resultado se guarda en cliente para REANALIZAR.
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

  // Camino preferente: decodificar + reducir por canvas → JPEG. Se decodifica
  // desde un object URL TRANSITORIO (más fiable para HEIC en iOS que un data:
  // URL) que se revoca al instante — no se persiste (la lección PoC era no
  // GUARDAR blob-URLs, no usarlas para decodificar). En iOS esto convierte el
  // HEIC del carrete a JPEG sin depender de sharp ni rozar el límite de Vercel.
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d no disponible");
    ctx.drawImage(img, 0, 0, w, h);

    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    if (!jpegDataUrl.startsWith("data:image/jpeg") || jpegDataUrl.length <= 64) {
      throw new Error("canvas no produjo JPEG");
    }
    return {
      base64: stripDataUrl(jpegDataUrl),
      mediaType: "image/jpeg",
      isHeic: false,
    };
  } catch {
    // El navegador no pudo decodificar (p. ej. HEIC en Safari de escritorio):
    // enviar el ORIGINAL y que el servidor lo convierta con sharp.
    const dataUrl = await readAsDataURL(file);
    return {
      base64: stripDataUrl(dataUrl),
      mediaType: file.type || (isHeic(file) ? "image/heic" : "application/octet-stream"),
      isHeic: isHeic(file),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
