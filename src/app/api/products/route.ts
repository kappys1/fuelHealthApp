import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { productCreateZ } from "@/lib/schemas";
import { listProducts } from "@/server/db/queries/lookups";
import { createProduct } from "@/server/db/queries/mutations";

// GET /api/products → catálogo completo (F07). El sheet filtra `pinned` para chips.
export async function GET() {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  try {
    return Response.json({ products: await listProducts() });
  } catch (err) {
    return serverError(err);
  }
}

// POST /api/products → crear un producto (manual en Fase 1; etiqueta en Fase 2).
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, productCreateZ);
  if ("error" in parsed) return parsed.error;

  try {
    const { id } = await retry(() => createProduct(parsed.data));
    return Response.json({ id });
  } catch (err) {
    return serverError(err);
  }
}
