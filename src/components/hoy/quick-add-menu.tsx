"use client";

import { CopyPlus, MoreHorizontal, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TemplateDTO } from "@/server/db/queries/lookups";

/** Menú «⋯» del timeline (09 §4): copiar ayer, guardar/aplicar/borrar plantilla. */
export function QuickAddMenu({
  templates,
  onCopyYesterday,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
}: {
  templates: TemplateDTO[];
  onCopyYesterday: () => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (id: number) => void;
  onDeleteTemplate: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");

  const saveTemplate = () => {
    const trimmed = name.trim();
    if (trimmed) onSaveTemplate(trimmed);
    setName("");
    setNameOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Más acciones"
          className="inline-flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-muted-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <button
          type="button"
          onClick={() => {
            onCopyYesterday();
            setOpen(false);
          }}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[14px] hover:bg-surface-2"
        >
          <CopyPlus className="size-4 text-muted-foreground" aria-hidden />
          Copiar ayer
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
            setNameOpen(true);
          }}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[14px] hover:bg-surface-2"
        >
          <Save className="size-4 text-muted-foreground" aria-hidden />
          Guardar día como plantilla
        </button>

        {templates.length > 0 ? (
          <div className="mt-1 border-t border-line pt-1">
            <p className="px-2 py-1 text-[11px] text-muted-foreground">Plantillas</p>
            {templates.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onApplyTemplate(t.id);
                    setOpen(false);
                  }}
                  className="min-h-11 min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-[14px] hover:bg-surface-2"
                >
                  {t.name}
                </button>
                <button
                  type="button"
                  aria-label={`Borrar plantilla ${t.name}`}
                  onClick={() => {
                    if (window.confirm(`¿Borrar la plantilla «${t.name}»?`))
                      onDeleteTemplate(t.id);
                  }}
                  className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </PopoverContent>

      {/* Nombrar plantilla en sheet propio (09 §6: crear/editar = bottom-sheet). */}
      <Sheet open={nameOpen} onOpenChange={setNameOpen}>
        <SheetContent side="bottom" className="gap-0">
          <SheetHeader>
            <SheetTitle className="card-title text-muted-foreground">
              Guardar día como plantilla
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTemplate();
              }}
              autoFocus
              placeholder="Nombre de la plantilla"
              aria-label="Nombre de la plantilla"
              className="w-full rounded-lg border border-input bg-surface-2 px-3 py-2.5 text-base outline-none focus-visible:border-ring"
            />
            <button
              type="button"
              onClick={saveTemplate}
              disabled={!name.trim()}
              className="w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </Popover>
  );
}
