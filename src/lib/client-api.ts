import type { MealKey } from "@/lib/macros";
import type { MeasureType } from "@/lib/marks";
import type { AthleteProfile } from "@/lib/profile";
import type { MarkEntryDTO } from "@/server/db/queries/marks";
import type {
  DayDumpResult,
  DietImportResult,
  EstimateResult,
  PhotoResult,
  PlanOptionAiResult,
  TrainingImportResult,
  WodResult,
} from "@/server/ai/schemas";
import type { TrainingTipo } from "@/lib/training";
import type { MedWithDelta } from "@/server/analytics/medDeltas";
import type { MessageDTO, ThreadDTO } from "@/server/db/queries/chat";
import type { DayPatch, MedInput } from "@/server/db/queries/mutations";
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

  // Plan · importar dieta (F-IA-9)
  importDiet: (files: { base64: string; mediaType: string }[]) =>
    req<DietImportResult>("/api/ai/diet-import", {
      method: "POST",
      body: JSON.stringify({ files }),
    }),

  createDietVersion: (payload: {
    effectiveFrom: string;
    kcal: number;
    prot: number;
    carb: number | null;
    fat: number | null;
    options: {
      meal: MealKey;
      grp: string;
      name: string;
      baseG: number | null;
      kcal: number;
      prot: number;
      carb: number;
      fat: number;
    }[];
  }) =>
    req<{ version: unknown }>("/api/plan/version", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Entreno · importar semana (F-IA-10)
  importTraining: (payload: {
    files?: { base64: string; mediaType: string }[];
    texto?: string;
  }) =>
    req<TrainingImportResult>("/api/ai/training-import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createTrainingPlan: (payload: {
    programa: string;
    etiqueta: string;
    source: "pdf" | "foto" | "texto";
    sessions: {
      key: string;
      nombre: string;
      tipo: TrainingTipo;
      contenido: string;
      kcalMin: number | null;
      kcalMax: number | null;
      duracionMin: number | null;
    }[];
    assignments: { sessionIndex: number; date: string }[];
  }) =>
    req<{ ok: true; assigned: number; skipped: number }>("/api/training/plan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTrainingSession: (
    id: number,
    patch: {
      nombre?: string;
      tipo?: TrainingTipo;
      contenido?: string;
      kcalMin?: number | null;
      kcalMax?: number | null;
      duracionMin?: number | null;
    },
  ) =>
    req<{ ok: true }>(`/api/training/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  reassignTrainingSession: (id: number, date: string | null) =>
    req<{ ok: true }>(`/api/training/sessions/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ date }),
    }),

  deleteTrainingPlan: (id: number) =>
    req<{ ok: true }>(`/api/training/plan/${id}`, { method: "DELETE" }),

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

  // Marcas / registros de rendimiento (F03)
  createMark: (mark: { name: string; measureType: MeasureType; unit: string }) =>
    req<{ id: number }>("/api/marks", {
      method: "POST",
      body: JSON.stringify(mark),
    }),

  deleteMark: (id: number) =>
    req<{ ok: true }>(`/api/marks/${id}`, { method: "DELETE" }),

  addMarkEntry: (
    markId: number,
    entry: { value: number; recordedOn: string; note?: string | null },
  ) =>
    req<{ entry: MarkEntryDTO }>(`/api/marks/${markId}/entries`, {
      method: "POST",
      body: JSON.stringify(entry),
    }),

  updateMarkEntry: (
    id: number,
    patch: { value?: number; recordedOn?: string; note?: string | null },
  ) =>
    req<{ ok: true }>(`/api/marks/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteMarkEntry: (id: number) =>
    req<{ ok: true }>(`/api/marks/entries/${id}`, { method: "DELETE" }),

  // MED (F5.1)
  addMed: (m: MedInput) =>
    req<{ med: MedWithDelta }>("/api/med", {
      method: "POST",
      body: JSON.stringify(m),
    }),

  updateMed: (id: number, patch: Partial<MedInput>) =>
    req<{ med: MedWithDelta }>(`/api/med/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteMed: (id: number) =>
    req<{ ok: true }>(`/api/med/${id}`, { method: "DELETE" }),

  listMed: () => req<{ med: MedWithDelta[] }>("/api/med"),

  // Settings
  saveSessionMap: (map: Record<string, string>) =>
    req<{ map: Record<string, string> }>("/api/settings/session-map", {
      method: "PATCH",
      body: JSON.stringify({ map }),
    }),

  saveAthleteProfile: (profile: AthleteProfile) =>
    req<{ profile: AthleteProfile }>("/api/settings/athlete-profile", {
      method: "PATCH",
      body: JSON.stringify({ profile }),
    }),

  // ── IA (Fase 2) — errores del proveedor + status propagados por req() ──
  estimateText: (descripcion: string) =>
    req<EstimateResult>("/api/ai/estimate", {
      method: "POST",
      body: JSON.stringify({ descripcion }),
    }),

  estimatePlanOption: (nombre: string, gramos?: number | null) =>
    req<PlanOptionAiResult>("/api/ai/plan-option", {
      method: "POST",
      body: JSON.stringify({ nombre, gramos: gramos ?? null }),
    }),

  dayDump: (texto: string, date: string) =>
    req<DayDumpResult>("/api/ai/day-dump", {
      method: "POST",
      body: JSON.stringify({ texto, date }),
    }),

  analyzePhoto: (input: {
    imageBase64: string;
    mediaType: string;
    meal: MealKey;
    note?: string | null;
    date: string;
  }) =>
    req<PhotoResult>("/api/ai/photo", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  analyzeWod: (texto: string, date?: string) =>
    req<WodResult>("/api/ai/wod", {
      method: "POST",
      body: JSON.stringify({ texto, date }),
    }),

  prepareVisit: () =>
    req<{ text: string }>("/api/ai/prepare-visit", {
      method: "POST",
      body: "{}",
    }),

  coach: (date: string, mode: "hoy" | "ayer") =>
    req<{ text: string }>("/api/ai/coach", {
      method: "POST",
      body: JSON.stringify({ date, mode }),
    }),

  // Chat (F-IA-8) — el envío de mensajes va por streaming (ver components/chat).
  listThreads: () => req<{ threads: ThreadDTO[] }>("/api/chat/threads"),

  // Puente Coach → Chat (F01 Fase 2): siembra un hilo (user + assistant) sin IA.
  seedChatThread: (userMessage: string, assistantMessage: string) =>
    req<{ threadId: number }>("/api/chat/threads", {
      method: "POST",
      body: JSON.stringify({ userMessage, assistantMessage }),
    }),

  getThread: (id: number) =>
    req<{ id: number; title: string; messages: MessageDTO[] }>(
      `/api/chat/threads/${id}`,
    ),

  deleteThread: (id: number) =>
    req<{ ok: true }>(`/api/chat/threads/${id}`, { method: "DELETE" }),

  uploadPhoto: (imageBase64: string, mediaType: string) =>
    req<{ url: string }>("/api/photos", {
      method: "POST",
      body: JSON.stringify({ imageBase64, mediaType }),
    }),

  // ── Salud / datos (Fase 3) ──
  importHealthCsv: (csv: string, apply: boolean) =>
    req<HealthImportResult>("/api/health/import", {
      method: "POST",
      body: JSON.stringify({ csv, apply }),
    }),

  restore: (data: unknown, apply: boolean) =>
    req<RestoreResult>("/api/import", {
      method: "POST",
      body: JSON.stringify({ data, apply }),
    }),
};

export interface HealthImportResult {
  preview: boolean;
  rows: number;
  days: number;
  metrics: number;
  fields: string[];
  hadKj: boolean;
  hadMl: boolean;
  overwriteManual: number;
  imported?: number;
}

export interface RestoreResult {
  preview: boolean;
  incoming?: Record<string, number>;
  current?: Record<string, number>;
  restored?: Record<string, number>;
}
