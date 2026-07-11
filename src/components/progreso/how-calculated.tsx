"use client";

import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/*
  Popover «cómo se calcula» (F6.6): en toda métrica derivada, un icono de info que
  explica QUÉ es, la fórmula en lenguaje llano y QUÉ hacer con ella. El tono
  respeta el principio 8: la app informa, el nutricionista decide.
*/
export function HowCalculated({
  title,
  what,
  formula,
  action,
  invert,
}: {
  title: string;
  what: string;
  formula: string;
  action: string;
  /** En tarjetas invertidas (TrendCard) el icono va claro. */
  invert?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Cómo se calcula: ${title}`}
          className={
            invert
              ? "inline-flex size-5 items-center justify-center rounded-full text-background/70 hover:text-background focus-visible:ring-2 focus-visible:ring-background/50 focus-visible:outline-none"
              : "inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          }
        >
          <Info className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-[13px]">
        <p className="card-title text-muted-foreground">{title}</p>
        <p className="mt-2 text-foreground">{what}</p>
        <p className="mt-2 rounded-md bg-surface-2 px-2 py-1.5 text-[12px] text-muted-foreground">
          {formula}
        </p>
        <p className="mt-2 text-foreground">{action}</p>
      </PopoverContent>
    </Popover>
  );
}
