"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import type { MeasureType } from "@/lib/marks";
import type { MarkDTO, MarkEntryDTO } from "@/server/db/queries/marks";

/*
  Estado optimista de marcas (F03), compartido por el bloque de Plan·Entrenos y el
  carril del Historial. La BD es la fuente de verdad, pero mutamos local para
  respuesta instantánea (07 §2): editar = optimista; borrar entrada = optimista con
  undo; borrar marca = confirmación (en el sheet) + optimista con revert si falla.
*/
type Entry = { value: number; recordedOn: string; note: string | null };

const byName = (a: MarkDTO, b: MarkDTO) =>
  a.name.localeCompare(b.name, "es") || a.id - b.id;

export function useMarks(initialMarks: MarkDTO[]) {
  const [marks, setMarks] = useState<MarkDTO[]>(initialMarks);

  const createMark = async (
    mark: { name: string; measureType: MeasureType; unit: string },
    entry: Entry,
  ) => {
    const { id } = await api.createMark(mark);
    const { entry: created } = await api.addMarkEntry(id, entry);
    setMarks((prev) =>
      [...prev, { id, ...mark, entries: [created] }].sort(byName),
    );
  };

  const addEntry = async (markId: number, entry: Entry) => {
    const { entry: created } = await api.addMarkEntry(markId, entry);
    setMarks((prev) =>
      prev.map((m) =>
        m.id === markId ? { ...m, entries: [...m.entries, created] } : m,
      ),
    );
  };

  const updateEntry = async (markId: number, entryId: number, patch: Entry) => {
    const snapshot = marks;
    // Optimista: aplica el cambio ya.
    setMarks((prev) =>
      prev.map((m) =>
        m.id === markId
          ? {
              ...m,
              entries: m.entries.map((e) =>
                e.id === entryId ? { ...e, ...patch } : e,
              ),
            }
          : m,
      ),
    );
    try {
      await api.updateMarkEntry(entryId, patch);
    } catch (err) {
      setMarks(snapshot); // revert
      throw err;
    }
  };

  // Re-inserta una entrada borrada (undo). Optimista con feedback: reaparece al
  // instante con su id antiguo y, cuando la API confirma, se sustituye por la fila
  // real (id nuevo); si la API falla, se quita y se avisa (con red inestable el
  // undo no puede quedarse en silencio — bug real reportado 2026-07-14).
  const restoreEntry = (markId: number, entry: MarkEntryDTO) => {
    setMarks((prev) =>
      prev.map((m) =>
        m.id === markId ? { ...m, entries: [...m.entries, entry] } : m,
      ),
    );
    api
      .addMarkEntry(markId, {
        value: entry.value,
        recordedOn: entry.recordedOn,
        note: entry.note,
      })
      .then(({ entry: created }) => {
        setMarks((prev) =>
          prev.map((m) =>
            m.id === markId
              ? {
                  ...m,
                  entries: m.entries.map((e) =>
                    e.id === entry.id ? created : e,
                  ),
                }
              : m,
          ),
        );
      })
      .catch((err) => {
        setMarks((prev) =>
          prev.map((m) =>
            m.id === markId
              ? { ...m, entries: m.entries.filter((e) => e.id !== entry.id) }
              : m,
          ),
        );
        toast.error(err instanceof Error ? err.message : "No se pudo deshacer.");
      });
  };

  // Sin toast de undo: el borrado ocurre DENTRO del sheet (Radix Dialog modal), y un
  // toast de Sonner se renderiza fuera → react-remove-scroll lo deja sin clics. El
  // «Deshacer» vive inline en el sheet y llama a restoreEntry (bug real 2026-07-14).
  const deleteEntry = (markId: number, entry: MarkEntryDTO) => {
    const snapshot = marks;
    setMarks((prev) =>
      prev.map((m) =>
        m.id === markId
          ? { ...m, entries: m.entries.filter((e) => e.id !== entry.id) }
          : m,
      ),
    );
    api.deleteMarkEntry(entry.id).catch((err) => {
      setMarks(snapshot);
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    });
  };

  const deleteMark = async (markId: number) => {
    const snapshot = marks;
    setMarks((prev) => prev.filter((m) => m.id !== markId));
    try {
      await api.deleteMark(markId);
    } catch (err) {
      setMarks(snapshot); // revert
      throw err;
    }
  };

  return {
    marks,
    createMark,
    addEntry,
    updateEntry,
    deleteEntry,
    restoreEntry,
    deleteMark,
  };
}
