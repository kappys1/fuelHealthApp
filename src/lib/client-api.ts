import type { MealKey } from "@/lib/macros";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { TodayPayload } from "@/server/db/queries/today";

/*
  Fetchers tipados del cliente. Los errores del servidor (mensaje + status) se
  propagan como Error para que la UI los muestre (nunca fallo silencioso, 07 §4).
*/

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = `${body.error} (${res.status})`;
    } catch {
      /* respuesta no-JSON */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface EntryInput {
  meal: MealKey;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  source: string;
  photoUrl?: string | null;
}

export const api = {
  getDay: (date: string) =>
    req<TodayPayload>(`/api/day?date=${encodeURIComponent(date)}`),

  patchDay: (date: string, patch: DayPatch) =>
    req<{ ok: true }>("/api/day", {
      method: "PATCH",
      body: JSON.stringify({ date, patch }),
    }),

  addEntries: (date: string, entries: EntryInput[]) =>
    req<{ entries: { id: number }[] }>("/api/entries", {
      method: "POST",
      body: JSON.stringify({ date, entries }),
    }),

  updateEntry: (
    id: number,
    patch: Partial<Omit<EntryInput, "source" | "photoUrl">>,
  ) =>
    req<{ entry: unknown }>(`/api/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteEntry: (id: number) =>
    req<{ entry: unknown }>(`/api/entries/${id}`, { method: "DELETE" }),

  copyYesterday: (date: string) =>
    req<{ copied: number; from: string }>("/api/entries/copy-yesterday", {
      method: "POST",
      body: JSON.stringify({ date }),
    }),

  toggleFavorite: (fav: {
    meal: MealKey;
    name: string;
    kcal: number;
    prot: number;
    carb: number;
    fat: number;
  }) =>
    req<{ favorited: boolean }>("/api/favorites", {
      method: "POST",
      body: JSON.stringify(fav),
    }),

  saveTemplate: (name: string, date: string) =>
    req<{ template: unknown }>("/api/templates", {
      method: "POST",
      body: JSON.stringify({ name, date }),
    }),

  applyTemplate: (id: number, date: string) =>
    req<{ added: number }>(`/api/templates/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ date }),
    }),

  deleteTemplate: (id: number) =>
    req<{ ok: true }>(`/api/templates/${id}`, { method: "DELETE" }),

  // Plan
  patchTargets: (t: {
    kcal: number;
    prot: number;
    carb: number | null;
    fat: number | null;
  }) =>
    req<{ version: unknown }>("/api/plan/targets", {
      method: "PATCH",
      body: JSON.stringify(t),
    }),

  addOption: (opt: unknown) =>
    req<{ option: unknown }>("/api/plan/options", {
      method: "POST",
      body: JSON.stringify(opt),
    }),

  updateOption: (id: number, patch: unknown) =>
    req<{ option: unknown }>(`/api/plan/options/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteOption: (id: number) =>
    req<{ ok: true }>(`/api/plan/options/${id}`, { method: "DELETE" }),

  // Settings
  saveSessionMap: (map: Record<string, string>) =>
    req<{ map: Record<string, string> }>("/api/settings/session-map", {
      method: "PATCH",
      body: JSON.stringify({ map }),
    }),
};
