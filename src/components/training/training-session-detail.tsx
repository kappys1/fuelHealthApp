import { Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import {
  splitTrainingContent,
  TRAINING_TIPO_LABELS,
  type TrainingTipo,
} from "@/lib/training";
import { cn } from "@/lib/utils";
import type { SessionFranja } from "@/lib/training-slot";

export interface TrainingSessionDetailData {
  key: string;
  nombre: string;
  tipo: TrainingTipo;
  contenido: string;
  kcalMin: number | null;
  kcalMax: number | null;
  duracionMin: number | null;
  franja?: SessionFranja | null;
}

export interface TrainingSessionPlanMeta {
  programa: string;
  etiqueta: string;
  source: "pdf" | "foto" | "texto";
  importRequestId?: string | null;
}

function originLabel(plan: TrainingSessionPlanMeta): string {
  if (!plan.importRequestId) return "creado manualmente";
  if (plan.source === "pdf") return "importado desde PDF";
  if (plan.source === "foto") return "importado desde foto";
  return "importado desde texto";
}

export function TrainingSessionDetail({
  session,
  plan,
  actions,
  className,
}: {
  session: TrainingSessionDetailData;
  plan?: TrainingSessionPlanMeta | null;
  actions?: ReactNode;
  className?: string;
}) {
  const blocks = splitTrainingContent(session.contenido);

  return (
    <article className={cn("wellness-card overflow-hidden p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="num text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {session.key}
          {session.duracionMin != null ? ` · ${session.duracionMin} min` : ""}
          {session.franja ? ` · ${session.franja}` : ""}
        </p>
        <span className="rounded-full bg-protein/10 px-2.5 py-1 text-[10px] font-semibold text-protein">
          {TRAINING_TIPO_LABELS[session.tipo]}
        </span>
      </div>

      <h2 className="mt-2 font-display text-[24px] font-semibold leading-tight text-foreground">
        {session.nombre}
      </h2>

      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
        {plan
          ? `${plan.programa} · ${plan.etiqueta} · ${originLabel(plan)}`
          : TRAINING_TIPO_LABELS[session.tipo]}
      </p>

      {session.kcalMin != null || session.kcalMax != null ? (
        <p className="num mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden />
          {session.kcalMin ?? "?"}–{session.kcalMax ?? "?"} kcal · contexto ±25 %
        </p>
      ) : null}

      {blocks.length > 0 ? (
        <ol className="mt-5 divide-y divide-line" aria-label="Bloques de la sesión">
          {blocks.map((block, index) => (
            <li key={`${index}-${block.length}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-[15px] font-semibold text-primary">
                {index + 1}
              </span>
              <p className="min-w-0 whitespace-pre-wrap pt-1 text-[13px] font-medium leading-relaxed text-foreground">
                {block}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-[12px] text-muted-foreground">
          Sin contenido detallado.
        </p>
      )}

      {actions ? <div className="mt-5 grid grid-cols-2 gap-2">{actions}</div> : null}
    </article>
  );
}
