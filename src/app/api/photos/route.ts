import { put } from "@vercel/blob";
import { z } from "zod";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { normalizeImage } from "@/server/ai/image";

const bodyZ = z.object({
  imageBase64: z.string().min(1),
  mediaType: z.string().min(1).max(80),
});

/*
  Subida de la foto a Vercel Blob — SOLO al añadir la entrada (02-ARQUITECTURA
  §3.2): si el usuario descarta el análisis, no se crea ningún blob. La store es
  PRIVADA: el blob no es accesible por URL pública; se guarda su `pathname` y se
  sirve por /api/photos/view (con sesión). HEIC se convierte a JPEG antes.
*/
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  let image;
  try {
    image = await normalizeImage({
      base64: parsed.data.imageBase64,
      mediaType: parsed.data.mediaType,
    });
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Imagen inválida.");
  }

  try {
    const buffer = Buffer.from(image.base64, "base64");
    const ext = image.mediaType.includes("png") ? "png" : "jpg";
    const blob = await put(`meals/meal.${ext}`, buffer, {
      access: "private", // store privada; se sirve con sesión (02 §3.2)
      contentType: image.mediaType,
      addRandomSuffix: true, // pathname no adivinable
    });
    // photo_url = ruta autenticada propia, no la URL cruda del blob privado.
    return Response.json({
      url: `/api/photos/view?p=${encodeURIComponent(blob.pathname)}`,
    });
  } catch (err) {
    return serverError(err);
  }
}
