import sharp from "sharp";
import type { AiImage } from "./client";

/*
  Normalización de imagen en servidor (02-ARQUITECTURA §3.2):
  - El cliente ya reduce a ≤1024 px / JPEG 0.8 en el caso normal (iOS da JPEG).
  - HEIC/HEIF (Safari desktop no lo decodifica) llega ORIGINAL y aquí se convierte
    con sharp a JPEG ≤1024 px.
  - Límite de subida 8 MB.
*/

const MAX_BYTES = 8 * 1024 * 1024;

function isHeic(mediaType: string): boolean {
  const m = mediaType.toLowerCase();
  return m.includes("heic") || m.includes("heif");
}

function base64Bytes(base64: string): number {
  // Aproximación exacta del tamaño decodificado desde la longitud base64.
  const len = base64.length;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/** Devuelve una imagen lista para la IA (JPEG si venía en HEIC). Lanza si excede 8 MB. */
export async function normalizeImage(img: AiImage): Promise<AiImage> {
  if (base64Bytes(img.base64) > MAX_BYTES) {
    throw new Error("La imagen supera el límite de 8 MB.");
  }
  if (!isHeic(img.mediaType)) return img;

  const input = Buffer.from(img.base64, "base64");
  const jpeg = await sharp(input)
    .rotate() // respeta la orientación EXIF
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { base64: jpeg.toString("base64"), mediaType: "image/jpeg" };
}
