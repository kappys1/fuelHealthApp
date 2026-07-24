"use client";

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { api, type EntryInput } from "@/lib/client-api";
import { isRetriableRequestError } from "@/lib/request-errors";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { BloatKey } from "@/lib/macros";

/*
  Cola offline (07 §2 / Fase 4 PWA). Cuando no hay red, las mutaciones de registro
  (entradas de comida y campos del día) se encolan en IndexedDB y se reproducen al
  reconectar (replay en orden). La UI ya se actualizó optimistamente; la cola solo
  garantiza que el servidor acabe cuadrando. 0 pérdidas (principio 7).
*/
export interface QueuedOp {
  id?: number;
  kind: "addEntries" | "patchDay" | "upsertBloat" | "updateBloat" | "deleteBloat";
  date: string;
  entries?: EntryInput[];
  patch?: DayPatch;
  ts: number;
  // Opcional solo para leer colas creadas antes de la migración; enqueue lo asigna
  // siempre a los lotes addEntries y flush lo persiste antes del primer envío.
  clientMutationId?: string;
  eventId?: number;
  severity?: BloatKey;
  occurredAt?: string;
  bloatPatch?: { severity?: BloatKey; occurredAt?: string };
  revision?: number;
  /** Conserva la identidad local cuando un POST ya obtuvo id y queda un PATCH/DELETE. */
  createdOffline?: boolean;
}

interface FuelboardDB extends DBSchema {
  queue: { key: number; value: QueuedOp };
}

const DB_NAME = "fuelboard-offline";
const STORE = "queue";
export const OFFLINE_QUEUE_ENQUEUED_EVENT = "fuelboard:offline-queue-enqueued";

export type OfflineQueuePhase = "idle" | "offline" | "syncing" | "failed";
export interface OfflineQueueSnapshot {
  online: boolean;
  pending: number;
  phase: OfflineQueuePhase;
  failure: { id: number; message: string; retriable: boolean } | null;
}

let snapshot: OfflineQueueSnapshot = {
  online: true,
  pending: 0,
  phase: "idle",
  failure: null,
};
const subscribers = new Set<() => void>();

function publish(patch: Partial<OfflineQueueSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  subscribers.forEach((listener) => listener());
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getOfflineQueueSnapshot(): OfflineQueueSnapshot {
  return snapshot;
}

let dbPromise: Promise<IDBPDatabase<FuelboardDB>> | null = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<FuelboardDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

/** ¿Estamos sin conexión ahora mismo? */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export async function enqueue(op: Omit<QueuedOp, "id">): Promise<void> {
  const db = await getDb();
  const queued: QueuedOp =
    op.kind === "addEntries"
      ? {
          ...op,
          clientMutationId: op.clientMutationId ?? crypto.randomUUID(),
          revision: op.revision ?? 0,
        }
      : { ...op, revision: op.revision ?? 0, createdOffline: op.kind === "upsertBloat" };
  await db.add(STORE, queued);
  publish({
    online: !isOffline(),
    pending: await db.count(STORE),
    phase: isOffline() ? "offline" : "idle",
    failure: null,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_ENQUEUED_EVENT));
  }
}

export async function queueSize(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

/** Edita el upsert temporal asociado a un marcador creado todavía sin servidor. */
export async function updateQueuedBloatUpsert(
  date: string,
  previousTime: string,
  severity: BloatKey,
  occurredAt: string,
): Promise<boolean> {
  const db = await getDb();
  const ops = await db.getAll(STORE);
  const match = ops.find(
    (op) =>
      op.createdOffline === true &&
      op.date === date &&
      (op.kind === "upsertBloat" ? op.occurredAt : op.bloatPatch?.occurredAt)?.slice(
        0,
        5,
      ) === previousTime.slice(0, 5),
  );
  if (match?.id == null) return false;
  await db.put(
    STORE,
    match.kind === "upsertBloat"
      ? { ...match, severity, occurredAt, revision: (match.revision ?? 0) + 1 }
      : {
          ...match,
          bloatPatch: { severity, occurredAt },
          revision: (match.revision ?? 0) + 1,
        },
  );
  publish({ pending: await db.count(STORE), failure: null });
  return true;
}

/** Cancela una creación local que el usuario borró antes de sincronizarla. */
export async function cancelQueuedBloatUpsert(
  date: string,
  occurredAt: string,
): Promise<boolean> {
  const db = await getDb();
  const ops = await db.getAll(STORE);
  const match = ops.find(
    (op) =>
      op.createdOffline === true &&
      op.date === date &&
      (op.kind === "upsertBloat" ? op.occurredAt : op.bloatPatch?.occurredAt)?.slice(
        0,
        5,
      ) === occurredAt.slice(0, 5),
  );
  if (match?.id == null) return false;
  if (match.kind === "upsertBloat") {
    await db.delete(STORE, match.id);
  } else if (match.eventId) {
    await db.put(STORE, {
      id: match.id,
      kind: "deleteBloat",
      date: match.date,
      eventId: match.eventId,
      ts: Date.now(),
      revision: (match.revision ?? 0) + 1,
      createdOffline: true,
    });
  }
  publish({ pending: await db.count(STORE), failure: null });
  return true;
}

export async function discardFailedOperation(): Promise<boolean> {
  const id = snapshot.failure?.id;
  if (id == null) return false;
  const db = await getDb();
  await db.delete(STORE, id);
  publish({
    pending: await db.count(STORE),
    phase: isOffline() ? "offline" : "idle",
    failure: null,
  });
  return true;
}

export async function refreshOfflineQueueStatus(): Promise<OfflineQueueSnapshot> {
  const pending = await queueSize();
  const online = !isOffline();
  publish({
    online,
    pending,
    phase: online
      ? snapshot.phase === "syncing" || snapshot.phase === "failed"
        ? snapshot.phase
        : "idle"
      : "offline",
  });
  return snapshot;
}

export async function markOffline(): Promise<void> {
  publish({ online: false, phase: "offline", pending: await queueSize(), failure: null });
}

function sameRevision(current: QueuedOp | undefined, sent: QueuedOp): boolean {
  return (
    current?.id === sent.id &&
    current?.kind === sent.kind &&
    (current.revision ?? 0) === (sent.revision ?? 0)
  );
}

async function deleteIfUnchanged(
  db: IDBPDatabase<FuelboardDB>,
  sent: QueuedOp,
): Promise<boolean> {
  if (sent.id == null) return false;
  const tx = db.transaction(STORE, "readwrite");
  const current = await tx.store.get(sent.id);
  if (sameRevision(current, sent)) await tx.store.delete(sent.id);
  await tx.done;
  return sameRevision(current, sent);
}

async function settleCreatedBloat(
  db: IDBPDatabase<FuelboardDB>,
  sent: QueuedOp,
  eventId: number,
): Promise<"settled" | "compensate" | "pending"> {
  if (sent.id == null) return "compensate";
  const tx = db.transaction(STORE, "readwrite");
  const current = await tx.store.get(sent.id);
  if (!current) {
    await tx.done;
    return "compensate";
  }
  if (sameRevision(current, sent)) {
    await tx.store.delete(sent.id);
    await tx.done;
    return "settled";
  }
  if (current.kind === "upsertBloat" && current.severity && current.occurredAt) {
    await tx.store.put({
      id: current.id,
      kind: "updateBloat",
      date: current.date,
      eventId,
      bloatPatch: {
        severity: current.severity,
        occurredAt: current.occurredAt,
      },
      ts: current.ts,
      revision: current.revision,
      createdOffline: true,
    });
  }
  await tx.done;
  return "pending";
}

/**
 * Reproduce las operaciones en el orden en que se encolaron (la clave
 * auto-incremental preserva el orden). Para en el primer fallo: lo que quede se
 * reintenta en la siguiente reconexión. Devuelve cuántas se aplicaron.
 */
async function flushQueueOnce(): Promise<number> {
  const db = await getDb();
  const ops = await db.getAll(STORE);
  if (ops.length === 0) {
    publish({
      online: !isOffline(),
      pending: 0,
      phase: isOffline() ? "offline" : "idle",
      failure: null,
    });
    return 0;
  }
  publish({ online: !isOffline(), pending: ops.length, phase: "syncing", failure: null });
  let done = 0;
  let failure: OfflineQueueSnapshot["failure"] = null;
  for (const op of ops) {
    try {
      if (op.kind === "addEntries" && op.entries) {
        const clientMutationId = op.clientMutationId ?? crypto.randomUUID();
        if (!op.clientMutationId && op.id != null) {
          // Persistir ANTES del fetch: si llega a BD pero se pierde la respuesta,
          // el siguiente replay conserva la misma clave y el servidor deduplica.
          op.clientMutationId = clientMutationId;
          await db.put(STORE, op);
        }
        await api.addEntries(op.date, op.entries, clientMutationId);
      } else if (op.kind === "patchDay" && op.patch) {
        await api.patchDay(op.date, op.patch);
      } else if (op.kind === "upsertBloat" && op.severity && op.occurredAt) {
        const { event } = await api.createBloatEvent({
          date: op.date,
          severity: op.severity,
          occurredAt: op.occurredAt,
        });
        const settled = await settleCreatedBloat(db, op, event.id);
        if (settled === "compensate") await api.deleteBloatEvent(event.id);
        done++;
        continue;
      } else if (op.kind === "updateBloat" && op.eventId && op.bloatPatch) {
        await api.updateBloatEvent(op.eventId, op.bloatPatch);
      } else if (op.kind === "deleteBloat" && op.eventId) {
        await api.deleteBloatEvent(op.eventId);
      }
      await deleteIfUnchanged(db, op);
      done++;
    } catch (error) {
      failure = {
        id: op.id ?? -1,
        message: error instanceof Error ? error.message : "No se pudo sincronizar.",
        retriable: isRetriableRequestError(error),
      };
      break; // sin red aún o error transitorio: conservar el resto
    }
  }
  const pending = await db.count(STORE);
  const online = !isOffline();
  publish({
    online,
    pending,
    phase: !online ? "offline" : failure ? "failed" : "idle",
    failure,
  });
  return done;
}

let flushInFlight: Promise<number> | null = null;

/** Un único replay por pestaña; online/mount no pueden drenar la cola a la vez. */
export function flushQueue(): Promise<number> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = flushQueueOnce().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}
