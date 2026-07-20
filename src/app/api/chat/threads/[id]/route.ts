import { badRequest, ensureAuth, serverError } from "@/lib/api";
import { retry } from "@/lib/retry";
import { deleteThread, getThread } from "@/server/db/queries/chat";

function parseId(param: string): number | null {
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");
  try {
    const thread = await retry(() => getThread(id));
    if (!thread) return badRequest("Hilo no encontrado.");
    return Response.json({
      id: thread.id,
      title: thread.title,
      updatedAt: thread.updatedAt,
      messages: thread.messages,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id == null) return badRequest("Id inválido.");
  try {
    await retry(() => deleteThread(id));
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
