"use client";

import { CopyPlus, MoreHorizontal, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Más acciones"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted-foreground"
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
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[14px] hover:bg-surface-2"
        >
          <CopyPlus className="size-4 text-muted-foreground" aria-hidden />
          Copiar ayer
        </button>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt("Nombre de la plantilla:");
            if (name?.trim()) onSaveTemplate(name.trim());
            setOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[14px] hover:bg-surface-2"
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
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-[14px] hover:bg-surface-2"
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
                  className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
