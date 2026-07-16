"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { api, type EntryInput, type ProductInput } from "@/lib/client-api";
import { enqueue, isOffline } from "@/lib/offline-queue";
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
        await enqueue({ kind: "addEntries", date, entries, ts: Date.now() });
        toast("Sin conexión: se guardará al reconectar", { duration: 2500 });
        return;
      }
      try {
        await api.addEntries(date, entries);
        refetch();
      } catch (err) {
        if (isOffline()) {
          await enqueue({ kind: "addEntries", date, entries, ts: Date.now() });
          toast("Sin conexión: se guardará al reconectar", { duration: 2500 });
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
    if (Object.keys(patch).length === 0) return;
    if (isOffline()) {
      await enqueue({ kind: "patchDay", date, patch, ts: Date.now() });
      toast("Sin conexión: se guardará al reconectar", { duration: 2000 });
      return;
    }
    try {
      await api.patchDay(date, patch);
      toast.success("Guardado ✓", { duration: 1200 });
    } catch (err) {
      if (isOffline()) {
        await enqueue({ kind: "patchDay", date, patch, ts: Date.now() });
        toast("Sin conexión: se guardará al reconectar", { duration: 2000 });
        return;
      }
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      refetch();
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

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

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

  // Borrar producto: optimista + undo (07 §2, no confirmación). El undo lo recrea.
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
        return;
      }
      const { id: _id, ...input } = product;
      toast("Producto eliminado", {
        duration: 6000,
        action: { label: "Deshacer", onClick: () => void createProduct(input) },
      });
    },
    [setData, refetch, createProduct],
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

  return {
    data: query.data,
    isFetching: query.isFetching,
    addEntries,
    updateEntry,
    deleteEntry,
    patchDay,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductPin,
    copyYesterday,
    applyTemplate,
    saveTemplate,
    deleteTemplate,
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
