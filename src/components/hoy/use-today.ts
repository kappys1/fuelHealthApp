"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { api, type EntryInput } from "@/lib/client-api";
import type { MealKey } from "@/lib/macros";
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
        createdAt: new Date().toISOString(),
      }));
      setData((p) => ({
        ...p,
        view: { ...p.view, entries: [...p.view.entries, ...optimistic] },
      }));
      try {
        await api.addEntries(date, entries);
        refetch();
      } catch (err) {
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
    try {
      await api.patchDay(date, patch);
      toast.success("Guardado ✓", { duration: 1200 });
    } catch (err) {
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

  // ── Favorito (optimista sobre la lista de favoritos) ──
  const toggleFavorite = useMutation({
    mutationFn: (fav: {
      meal: MealKey;
      name: string;
      kcal: number;
      prot: number;
      carb: number;
      fat: number;
    }) => api.toggleFavorite(fav),
    onSuccess: (res, fav) => {
      toast(res.favorited ? "Añadido a favoritos ★" : "Quitado de favoritos");
      setData((p) => {
        const exists = p.favorites.some(
          (f) => f.meal === fav.meal && f.name === fav.name,
        );
        const favorites = res.favorited
          ? exists
            ? p.favorites
            : [{ id: tempId--, ...fav }, ...p.favorites]
          : p.favorites.filter((f) => !(f.meal === fav.meal && f.name === fav.name));
        return { ...p, favorites };
      });
      refetch();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "No se pudo."),
  });

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
    toggleFavorite: (f: Parameters<typeof toggleFavorite.mutate>[0]) =>
      toggleFavorite.mutate(f),
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
    phase: null,
    bloat: null,
    notes: null,
  };
}
