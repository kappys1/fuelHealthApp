"use client";

import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { api, type EntryInput } from "@/lib/client-api";
import type { DayPatch } from "@/server/db/queries/mutations";

/*
  Cola offline (07 §2 / Fase 4 PWA). Cuando no hay red, las mutaciones de registro
  (entradas de comida y campos del día) se encolan en IndexedDB y se reproducen al
  reconectar (replay en orden). La UI ya se actualizó optimistamente; la cola solo
  garantiza que el servidor acabe cuadrando. 0 pérdidas (principio 7).
*/
export interface QueuedOp {
  id?: number;
  kind: "addEntries" | "patchDay";
  date: string;
  entries?: EntryInput[];
  patch?: DayPatch;
  ts: number;
}

interface FuelboardDB extends DBSchema {
  queue: { key: number; value: QueuedOp };
}

const DB_NAME = "fuelboard-offline";
const STORE = "queue";

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
  await db.add(STORE, op as QueuedOp);
}

export async function queueSize(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

/**
 * Reproduce las operaciones en el orden en que se encolaron (la clave
 * auto-incremental preserva el orden). Para en el primer fallo: lo que quede se
 * reintenta en la siguiente reconexión. Devuelve cuántas se aplicaron.
 */
export async function flushQueue(): Promise<number> {
  const db = await getDb();
  const ops = await db.getAll(STORE);
  let done = 0;
  for (const op of ops) {
    try {
      if (op.kind === "addEntries" && op.entries) {
        await api.addEntries(op.date, op.entries);
      } else if (op.kind === "patchDay" && op.patch) {
        await api.patchDay(op.date, op.patch);
      }
      if (op.id != null) await db.delete(STORE, op.id);
      done++;
    } catch {
      break; // sin red aún o error transitorio: conservar el resto
    }
  }
  return done;
}
