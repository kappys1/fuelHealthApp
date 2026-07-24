"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { api, type EntryInput, type ProductInput } from "@/lib/client-api";
import type { BloatKey } from "@/lib/macros";
import type { CoachReading } from "@/server/ai/coach-reading";
import {
  cancelQueuedBloatUpsert,
  enqueue,
  isOffline,
  updateQueuedBloatUpsert,
} from "@/lib/offline-queue";
import { isRetriableRequestError } from "@/lib/request-errors";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { EntryDTO } from "@/server/db/queries/day";
import type { TodayPayload } from "@/server/db/queries/today";

let tempId = -1;

export function useToday(date: string, initial: TodayPayload) {
  const qc = useQueryClient();
  const key = useMemo(() => ["today", date] as const, [date]);

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.getDay(date),
    initialData: initial,
    staleTime: 15_000,
  });

  const setData = useCallback(
    (fn: (prev: TodayPayload) => TodayPayload) => {
      qc.setQueryData<TodayPayload>(key, (prev) => (prev ? fn(prev) : prev));
    },
    [qc, key],
  );

  const refetch = useCallback(() => {
    qc.invalidateQueries({ queryKey: key });
  }, [qc, key]);

  // ── Añadir entradas (optimista) ──
  const addEntries = useCallback(
    async (entries: EntryInput[]) => {
      const clientMutationId = crypto.randomUUID();
      const optimistic: EntryDTO[] = entries.map((e) => ({
        id: tempId--,
        meal: e.meal,
        name: e.name,
        kcal: e.kcal,
        prot: e.prot,
        carb: e.carb,
        fat: e.fat,
        source: e.source,
        photoUrl: e.photoUrl ?? null,
        grams: e.grams ?? null,
        baseG: e.baseG ?? null,
        baseKcal: e.baseKcal ?? null,
        baseProt: e.baseProt ?? null,
        baseCarb: e.baseCarb ?? null,
        baseFat: e.baseFat ?? null,
        createdAt: new Date().toISOString(),
      }));
      setData((p) => ({
        ...p,
        view: { ...p.view, entries: [...p.view.entries, ...optimistic] },
      }));
      // Sin conexión: encolar y conservar el optimista (07 §2 / cola offline).
      if (isOffline()) {
        await enqueue({
          kind: "addEntries",
          date,
          entries,
          ts: Date.now(),
          clientMutationId,
        });
        toast("Sin conexión: se guardará al reconectar", { duration: 2500 });
        return;
      }
      try {
        await api.addEntries(date, entries, clientMutationId);
        refetch();
      } catch (err) {
        if (isOffline() || isRetriableRequestError(err)) {
          await enqueue({
            kind: "addEntries",
            date,
            entries,
            ts: Date.now(),
            clientMutationId,
          });
          toast(
            isOffline()
              ? "Sin conexión: se guardará al reconectar"
              : "Conexión interrumpida: pendiente de sincronizar",
            { duration: 2500 },
          );
          return;
        }
        toast.error(err instanceof Error ? err.message : "No se pudo añadir.");
        refetch();
      }
    },
    [date, setData, refetch],
  );

  // ── Editar entrada (optimista) ──
  const updateEntry = useCallback(
    async (id: number, patch: Partial<Omit<EntryInput, "source" | "photoUrl">>) => {
      setData((p) => ({
        ...p,
        view: {
          ...p.view,
          entries: p.view.entries.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        },
      }));
      try {
        await api.updateEntry(id, patch);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
        refetch();
      }
    },
    [setData, refetch],
  );

  // ── Borrar entrada (optimista + undo, sin confirmación — 07 §2) ──
  const deleteEntry = useCallback(
    async (entry: EntryDTO) => {
      setData((p) => ({
        ...p,
        view: { ...p.view, entries: p.view.entries.filter((e) => e.id !== entry.id) },
      }));
      try {
        await api.deleteEntry(entry.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
        refetch();
        return;
      }
      toast("Eliminada", {
        duration: 6000,
        action: {
          label: "Deshacer",
          onClick: () => {
            void addEntries([
              {
                meal: entry.meal,
                name: entry.name,
                kcal: entry.kcal,
                prot: entry.prot,
                carb: entry.carb,
                fat: entry.fat,
                source: entry.source,
                photoUrl: entry.photoUrl,
                // Deshacer conserva la base inmutable (F06): la entrada restaurada
                // sigue siendo escalable.
                grams: entry.grams,
                baseG: entry.baseG,
                baseKcal: entry.baseKcal,
                baseProt: entry.baseProt,
                baseCarb: entry.baseCarb,
                baseFat: entry.baseFat,
              },
            ]);
          },
        },
      });
    },
    [setData, refetch, addEntries],
  );

  // ── Autosave de campos del día (optimista + debounce 600 ms — 07 §1) ──
  const pending = useRef<DayPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return true;
    if (isOffline()) {
      await enqueue({ kind: "patchDay", date, patch, ts: Date.now() });
      toast("Sin conexión: se guardará al reconectar", { duration: 2000 });
      return true;
    }
    try {
      await api.patchDay(date, patch);
      toast.success("Guardado ✓", { duration: 1200 });
      return true;
    } catch (err) {
      if (isOffline() || isRetriableRequestError(err)) {
        await enqueue({ kind: "patchDay", date, patch, ts: Date.now() });
        toast(
          isOffline()
            ? "Sin conexión: se guardará al reconectar"
            : "Conexión interrumpida: pendiente de sincronizar",
          { duration: 2000 },
        );
        return true;
      }
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      refetch();
      return false;
    }
  }, [date, refetch]);

  const patchDay = useCallback(
    (patch: DayPatch) => {
      setData((p) => ({
        ...p,
        view: {
          ...p.view,
          day: { ...(p.view.day ?? emptyDay(date)), ...patch },
        },
      }));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 600);
    },
    [date, setData, flush],
  );

  const patchDayNow = useCallback(
    async (patch: DayPatch) => {
      setData((p) => ({
        ...p,
        view: {
          ...p.view,
          day: { ...(p.view.day ?? emptyDay(date)), ...patch },
        },
      }));
      pending.current = { ...pending.current, ...patch };
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      return flush();
    },
    [date, setData, flush],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  // ── Productos (F07 · catálogo, optimista sobre data.products) ──
  const createProduct = useCallback(
    async (input: ProductInput) => {
      setData((p) => ({
        ...p,
        products: [{ id: tempId--, ...input }, ...p.products],
      }));
      try {
        await api.createProduct(input);
        toast.success("Producto creado");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear.");
        refetch();
      }
    },
    [setData, refetch],
  );

  const updateProduct = useCallback(
    async (id: number, patch: Partial<ProductInput>) => {
      setData((p) => ({
        ...p,
        products: p.products.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      }));
      try {
        await api.updateProduct(id, patch);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
        refetch();
      }
    },
    [setData, refetch],
  );

  const toggleProductPin = useCallback(
    async (id: number) => {
      setData((p) => ({
        ...p,
        products: p.products.map((x) =>
          x.id === id ? { ...x, pinned: !x.pinned } : x,
        ),
      }));
      try {
        await api.toggleProductPin(id);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo.");
        refetch();
      }
    },
    [setData, refetch],
  );

  // Borrar producto: optimista (07 §2, no confirmación). El «Deshacer» es un banner
  // INLINE dentro del sheet (lo gestiona AddSheet), NO un toast de Sonner: el toast
  // se renderiza fuera del sheet modal y no recibe clics (DECISIONS #42/#64).
  const deleteProduct = useCallback(
    async (product: TodayPayload["products"][number]) => {
      setData((p) => ({
        ...p,
        products: p.products.filter((x) => x.id !== product.id),
      }));
      try {
        await api.deleteProduct(product.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
        refetch();
      }
    },
    [setData, refetch],
  );

  const copyYesterday = useCallback(async () => {
    try {
      const res = await api.copyYesterday(date);
      toast.success(
        res.copied > 0
          ? `Copiadas ${res.copied} entradas de ayer`
          : "Ayer no tiene entradas",
      );
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo copiar.");
    }
  }, [date, refetch]);

  const applyTemplate = useCallback(
    async (id: number) => {
      try {
        const res = await api.applyTemplate(id, date);
        toast.success(`Añadidas ${res.added} entradas de la plantilla`);
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo aplicar.");
      }
    },
    [date, refetch],
  );

  const saveTemplate = useCallback(
    async (name: string) => {
      try {
        await api.saveTemplate(name, date);
        toast.success("Plantilla guardada");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    },
    [date, refetch],
  );

  const deleteTemplate = useCallback(
    async (id: number) => {
      try {
        await api.deleteTemplate(id);
        toast.success("Plantilla borrada");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
      }
    },
    [refetch],
  );

  const setCoachReading = useCallback((reading: CoachReading) => {
    setData((p) => ({
      ...p,
      coachReading:
        reading.mode === "hoy" ? { ...reading, stale: false } : p.coachReading,
      coachReadings: {
        ...p.coachReadings,
        [reading.mode]: { ...reading, stale: false },
      },
    }));
  }, [setData]);

  const refreshCoach = useCallback(async () => {
    const reading = await api.coach(date, "hoy");
    setCoachReading(reading);
  }, [date, setCoachReading]);

  const createBloatEvent = useCallback(
    async (severity: BloatKey, occurredAt: string) => {
      try {
        const { event } = await api.createBloatEvent({ date, severity, occurredAt });
        setData((p) => {
          const events = [...p.bloatEvents, event].sort((a, b) =>
            a.occurredAt.localeCompare(b.occurredAt),
          );
          return {
            ...p,
            bloatEvents: events,
            view: {
              ...p.view,
              day: {
                ...(p.view.day ?? emptyDay(date)),
                bloat: events.at(-1)?.severity ?? null,
              },
            },
          };
        });
        toast.success("Marcador guardado");
      } catch (err) {
        if (isOffline() || isRetriableRequestError(err)) {
          await enqueue({
            kind: "upsertBloat",
            date,
            severity,
            occurredAt,
            ts: Date.now(),
          });
          setData((p) => {
            const existing = p.bloatEvents.find(
              (item) => item.occurredAt.slice(0, 5) === occurredAt.slice(0, 5),
            );
            const optimistic = {
              id: existing?.id ?? tempId--,
              date,
              severity,
              occurredAt: occurredAt.length === 5 ? `${occurredAt}:00` : occurredAt,
              createdAt: existing?.createdAt ?? new Date().toISOString(),
            };
            const events = existing
              ? p.bloatEvents.map((item) => (item.id === existing.id ? optimistic : item))
              : [...p.bloatEvents, optimistic];
            return {
              ...p,
              bloatEvents: events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
              view: {
                ...p.view,
                day: { ...(p.view.day ?? emptyDay(date)), bloat: severity },
              },
            };
          });
          toast(
            isOffline()
              ? "Sin conexión: marcador pendiente"
              : "Conexión interrumpida: marcador pendiente",
          );
          return;
        }
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
        throw err;
      }
    },
    [date, setData],
  );

  const updateBloatEvent = useCallback(
    async (
      id: number,
      patch: { severity?: BloatKey; occurredAt?: string },
    ) => {
      const localEvent = query.data.bloatEvents.find((item) => item.id === id);
      if (id < 0 && localEvent) {
        const severity = patch.severity ?? localEvent.severity;
        const occurredAt = patch.occurredAt ?? localEvent.occurredAt;
        if (
          !(await updateQueuedBloatUpsert(
            date,
            localEvent.occurredAt,
            severity,
            occurredAt,
          ))
        ) {
          throw new Error("No se encontró el marcador pendiente.");
        }
        setData((p) => ({
          ...p,
          bloatEvents: p.bloatEvents
            .map((item) => (item.id === id ? { ...item, severity, occurredAt } : item))
            .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
        }));
        toast("Marcador pendiente actualizado");
        return;
      }
      try {
        const { event } = await api.updateBloatEvent(id, patch);
        setData((p) => {
          const events = p.bloatEvents
            .map((item) => (item.id === id ? event : item))
            .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
          const latest = events.at(-1);
          return {
            ...p,
            bloatEvents: events,
            view: {
              ...p.view,
              day: {
                ...(p.view.day ?? emptyDay(date)),
                bloat: latest?.severity ?? null,
              },
            },
          };
        });
        toast.success("Marcador actualizado");
      } catch (err) {
        if (isOffline() || isRetriableRequestError(err)) {
          await enqueue({
            kind: "updateBloat",
            date,
            eventId: id,
            bloatPatch: patch,
            ts: Date.now(),
          });
          setData((p) => {
            const events = p.bloatEvents
              .map((item) => (item.id === id ? { ...item, ...patch } : item))
              .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
            const latest = events.at(-1);
            return {
              ...p,
              bloatEvents: events,
              view: {
                ...p.view,
                day: {
                  ...(p.view.day ?? emptyDay(date)),
                  bloat: latest?.severity ?? null,
                },
              },
            };
          });
          toast(
            isOffline()
              ? "Sin conexión: cambio pendiente"
              : "Conexión interrumpida: cambio pendiente",
          );
          return;
        }
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
        refetch();
        throw err;
      }
    },
    [date, query.data.bloatEvents, setData, refetch],
  );

  const deleteBloatEvent = useCallback(
    async (id: number) => {
      const localEvent = query.data.bloatEvents.find((item) => item.id === id);
      if (id < 0 && localEvent) {
        await cancelQueuedBloatUpsert(date, localEvent.occurredAt);
        setData((p) => {
          const events = p.bloatEvents.filter((item) => item.id !== id);
          const latest = events.at(-1);
          return {
            ...p,
            bloatEvents: events,
            view: {
              ...p.view,
              day: {
                ...(p.view.day ?? emptyDay(date)),
                bloat: latest?.severity ?? null,
              },
            },
          };
        });
        toast("Marcador pendiente eliminado");
        return;
      }
      try {
        await api.deleteBloatEvent(id);
        setData((p) => {
          const events = p.bloatEvents.filter((item) => item.id !== id);
          const latest = events.at(-1);
          return {
            ...p,
            bloatEvents: events,
            view: {
              ...p.view,
              day: {
                ...(p.view.day ?? emptyDay(date)),
                bloat: latest?.severity ?? null,
              },
            },
          };
        });
        toast("Marcador eliminado");
      } catch (err) {
        if (isOffline() || isRetriableRequestError(err)) {
          await enqueue({
            kind: "deleteBloat",
            date,
            eventId: id,
            ts: Date.now(),
          });
          setData((p) => {
            const events = p.bloatEvents.filter((item) => item.id !== id);
            const latest = events.at(-1);
            return {
              ...p,
              bloatEvents: events,
              view: {
                ...p.view,
                day: {
                  ...(p.view.day ?? emptyDay(date)),
                  bloat: latest?.severity ?? null,
                },
              },
            };
          });
          toast(
            isOffline()
              ? "Sin conexión: eliminación pendiente"
              : "Conexión interrumpida: eliminación pendiente",
          );
          return;
        }
        toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
        refetch();
        throw err;
      }
    },
    [date, query.data.bloatEvents, setData, refetch],
  );

  return {
    data: query.data,
    isFetching: query.isFetching,
    addEntries,
    updateEntry,
    deleteEntry,
    patchDay,
    patchDayNow,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductPin,
    copyYesterday,
    applyTemplate,
    saveTemplate,
    deleteTemplate,
    refreshCoach,
    setCoachReading,
    createBloatEvent,
    updateBloatEvent,
    deleteBloatEvent,
  };
}

function emptyDay(date: string) {
  return {
    date,
    weight: null,
    waterL: null,
    bodyFatPct: null,
    sessionLabel: null,
    sessionKcal: null,
    sessionRef: null,
    phase: null,
    bloat: null,
    notes: null,
  };
}
