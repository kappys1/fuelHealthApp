import { get } from "@vercel/blob";
import { ensureAuth, badRequest, serverError } from "@/lib/api";

/*
  Servido de fotos de comida desde la store PRIVADA de Blob (02-ARQUITECTURA
  §3.2: "acceso solo con sesión"). Requiere sesión; hace `get(pathname, private)`
  con el token del servidor y transmite el stream. La URL cruda del blob nunca
  llega al cliente.
*/
export async function GET(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const pathname = new URL(request.url).searchParams.get("p");
  if (!pathname) return badRequest("Falta el parámetro de foto.");

  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return Response.json({ error: "Foto no encontrada." }, { status: 404 });
    }
    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "image/jpeg",
        // Privada, cacheable en el navegador (mismo origen, con sesión).
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    return serverError(err);
  }
}
