"use client";

import { useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import {
  BLOAT_LABELS,
  type BloatKey,
  displayMacro,
  roundKcal,
  SESSIONS,
} from "@/lib/macros";
import type { Lesion, LesionReview } from "@/lib/profile";
import { orderedSessionOptions, sessionPatchFor } from "@/lib/training";
import { cn } from "@/lib/utils";
import { dayTotals } from "@/server/analytics/dayTotals";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { TodayPayload } from "@/server/db/queries/today";

const BLOATS: BloatKey[] = ["ninguna", "leve", "moderada", "alta"];

/**
 * Check-in matinal: peso → hinchazón → [lesión] → sesión. ≤15 s, un pulgar
 * (09 §5). El paso de lesión SOLO aparece el día que toca revisarla (F26 AC3):
 * es un paso condicional de un flujo que ya existe, no una tarjeta en Hoy.
 */
export function CheckinMatinal({
  open,
  onOpenChange,
  data,
  onPatch,
  onBloat,
  onLesionReview,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TodayPayload;
  onPatch: (patch: DayPatch) => void;
  onBloat: (severity: BloatKey) => Promise<void>;
  onLesionReview: (input: {
    id: string;
    review: LesionReview;
    capacidad?: string;
  }) => Promise<boolean>;
}) {
  const [step, setStep] = useState(0);
  const [savingBloat, setSavingBloat] = useState(false);
  const [freeSession, setFreeSession] = useState("");
  const [weight, setWeight] = useState(
    String(data.view.day?.weight ?? data.lastWeight ?? ""),
  );

  const lesion = data.lesionPorRevisar;
  const steps = lesion
    ? (["peso", "hinchazon", "lesion", "sesion"] as const)
    : (["peso", "hinchazon", "sesion"] as const);
  const current = steps[step];

  const close = () => {
    setStep(0);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) setStep(0);
        onOpenChange(v);
      }}
    >
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle className="card-title text-muted-foreground">
            Check-in matinal · {step + 1}/{steps.length}
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4">
          {current === "peso" ? (
            <div className="space-y-4">
              <p className="text-[15px] text-foreground">¿Cuánto pesas hoy? (ayunas)</p>
              <div className="flex justify-center">
                <Stepper
                  value={weight}
                  onChange={setWeight}
                  step={0.1}
                  suffix="kg"
                  ariaLabel="Peso"
                />
              </div>
              <BigNext
                onClick={() => {
                  onPatch({
                    weight: weight === "" ? null : Number(weight.replace(",", ".")),
                  });
                  setStep(1);
                }}
              />
              <SkipLink onClick={() => setStep(1)} />
            </div>
          ) : null}

          {current === "hinchazon" ? (
            <div className="space-y-4">
              <p className="text-[15px] text-foreground">¿Cómo amaneces?</p>
              <div className="grid grid-cols-2 gap-2">
                {BLOATS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    disabled={savingBloat}
                    onClick={async () => {
                      setSavingBloat(true);
                      try {
                        await onBloat(b);
                        setStep(2);
                      } finally {
                        setSavingBloat(false);
                      }
                    }}
                    className={cn(
                      "rounded-xl border py-4 text-[15px]",
                      data.view.day?.bloat === b
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-line bg-surface-2",
                    )}
                  >
                    {BLOAT_LABELS[b]}
                  </button>
                ))}
              </div>
              <SkipLink onClick={() => setStep(2)} />
            </div>
          ) : null}

          {current === "lesion" && lesion ? (
            <LesionReviewStep
              lesion={lesion}
              onReview={onLesionReview}
              onDone={() => setStep(step + 1)}
            />
          ) : null}

          {current === "sesion" ? (
            <div className="space-y-3">
              <p className="text-[15px] text-foreground">
                Sesión de hoy{" "}
                <span className="text-muted-foreground">
                  {sessionSuggestion(data)}
                </span>
              </p>
              <div className="max-h-[40dvh] space-y-1.5 overflow-y-auto">
                {sessionChoices(data).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      onPatch(sessionPatchFor(s, data.trainingSessions));
                      close();
                    }}
                    className={cn(
                      "w-full rounded-lg border px-3 py-3 text-left text-[14px]",
                      data.view.day?.sessionLabel === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-line bg-surface-2",
                    )}
                  >
                    {s}
                  </button>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    value={freeSession}
                    onChange={(event) => setFreeSession(event.target.value)}
                    placeholder="Otra sesión…"
                    aria-label="Nombre de otra sesión"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-base text-foreground"
                  />
                  <button
                    type="button"
                    disabled={!freeSession.trim()}
                    onClick={() => {
                      onPatch(sessionPatchFor(freeSession.trim(), data.trainingSessions));
                      close();
                    }}
                    className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Guardar
                  </button>
                </div>
              </div>
              <SkipLink label="Terminar" onClick={close} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/*
  Revisión de una lesión vencida (F26 Fase 1, AC3). Tres salidas y una sola
  pregunta: sigue igual (+14 d) · va mejor (reescribe la capacidad, +14 d) · ya
  está (cierra con hoy, marcado aproximado — nunca borra). Se pregunta el día que
  toca y no vuelve a aparecer hasta la siguiente revisión.
*/
function LesionReviewStep({
  lesion,
  onReview,
  onDone,
}: {
  lesion: Lesion;
  onReview: (input: {
    id: string;
    review: LesionReview;
    capacidad?: string;
  }) => Promise<boolean>;
  onDone: () => void;
}) {
  const [mejor, setMejor] = useState(false);
  const [capacidad, setCapacidad] = useState(lesion.capacidad);
  const [saving, setSaving] = useState(false);

  const send = async (review: LesionReview, nueva?: string) => {
    setSaving(true);
    try {
      if (await onReview({ id: lesion.id, review, capacidad: nueva })) onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-foreground">
        ¿Cómo va <b>{lesion.zona}</b>?{" "}
        {lesion.desde ? (
          <span className="num text-muted-foreground">desde {lesion.desde}</span>
        ) : null}
      </p>
      {mejor ? (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            Ajusta qué puedes y qué no. Es lo que lee el coach.
          </p>
          <textarea
            value={capacidad}
            onChange={(e) => setCapacidad(e.target.value)}
            rows={4}
            placeholder="NO: nada por encima de cabeza. SÍ: tirón horizontal, pierna."
            className="w-full rounded-lg border border-input bg-surface-2 px-3 py-2 text-base outline-none focus-visible:border-ring"
          />
          <BigNext
            label={saving ? "Guardando…" : "Guardar y seguir"}
            disabled={saving}
            onClick={() => send("mejor", capacidad)}
          />
          <SkipLink label="Volver" onClick={() => setMejor(false)} />
        </div>
      ) : (
        <div className="space-y-2">
          {lesion.capacidad.trim() ? (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted-foreground">
              {lesion.capacidad}
            </p>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => send("igual")}
            className="min-h-11 w-full rounded-xl border border-line bg-surface-2 py-3 text-[15px] disabled:opacity-60"
          >
            Sigue igual
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setMejor(true)}
            className="min-h-11 w-full rounded-xl border border-line bg-surface-2 py-3 text-[15px] disabled:opacity-60"
          >
            Va mejor
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => send("cerrada")}
            className="min-h-11 w-full rounded-xl border border-primary bg-primary/10 py-3 text-[15px] font-semibold text-primary disabled:opacity-60"
          >
            Ya está
          </button>
          <SkipLink label="Ahora no" onClick={onDone} />
        </div>
      )}
    </div>
  );
}

/** Cierre del día: ¿falta comida? → notas → confirmación con racha (09 §5). */
export function CheckinCierre({
  open,
  onOpenChange,
  data,
  onPatch,
  onAddMeal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TodayPayload;
  onPatch: (patch: DayPatch) => void;
  onAddMeal: () => void;
}) {
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState(data.view.day?.notes ?? "");
  const totals = dayTotals(data.view.entries);

  const close = () => {
    setStep(0);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) setStep(0);
        onOpenChange(v);
      }}
    >
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle className="card-title text-muted-foreground">
            Cerrar el día · {step + 1}/3
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4">
          {step === 0 ? (
            <div className="space-y-4">
              <p className="text-[15px] text-foreground">¿Falta alguna comida?</p>
              <button
                type="button"
                onClick={() => {
                  onAddMeal();
                  onOpenChange(false);
                }}
                className="w-full rounded-xl border border-line bg-surface-2 py-4 text-[15px]"
              >
                + Añadir una comida
              </button>
              <BigNext label="No, todo registrado" onClick={() => setStep(1)} />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-[15px] text-foreground">Notas del día</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="¿Cómo fue el WOD? ¿Digestión? ¿Energía? (puedes dictar con el micro del teclado)"
                className="w-full rounded-lg border border-input bg-surface-2 px-3 py-2 text-base outline-none focus-visible:border-ring"
              />
              <BigNext
                onClick={() => {
                  onPatch({ notes });
                  setStep(2);
                }}
              />
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4 text-center">
              <p className="num text-[15px] text-foreground">
                {roundKcal(totals.kcal).toLocaleString("es-ES")}
                {data.targets.kcal > 0
                  ? ` / ${data.targets.kcal.toLocaleString("es-ES")}`
                  : ""} kcal ·{" "}
                {displayMacro(totals.prot)} g prot
              </p>
              <p className="text-[15px]">
                Racha de registro:{" "}
                <span className="num font-semibold text-primary">
                  {data.streak} {data.streak === 1 ? "día" : "días"}
                </span>{" "}
                🔥
              </p>
              <BigNext label="Hecho" onClick={close} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Peso exprés (09 §5b): SOLO peso + hinchazón opcional. 10 s. */
export function WeightExpressSheet({
  open,
  onOpenChange,
  data,
  onPatch,
  onBloat,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TodayPayload;
  onPatch: (patch: DayPatch) => Promise<boolean>;
  onBloat: (severity: BloatKey) => Promise<void>;
}) {
  const [weight, setWeight] = useState(
    String(data.view.day?.weight ?? data.lastWeight ?? ""),
  );
  const [bloat, setBloat] = useState<BloatKey | null>(data.view.day?.bloat ?? null);
  const bloatDirty = useRef(false);
  const [saving, setSaving] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle className="card-title text-muted-foreground">Peso de hoy</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 py-4">
          <div className="flex justify-center">
            <Stepper
              value={weight}
              onChange={setWeight}
              step={0.1}
              suffix="kg"
              className="w-48"
              ariaLabel="Peso"
            />
          </div>
          <div>
            <span className="mb-1 block text-[12px] text-muted-foreground">
              Hinchazón (opcional)
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {BLOATS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setBloat(b);
                    bloatDirty.current = true;
                  }}
                  className={cn(
                    "min-h-11 rounded-lg border px-1 text-[12px]",
                    bloat === b
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line bg-surface-2",
                  )}
                >
                  {BLOAT_LABELS[b]}
                </button>
              ))}
            </div>
          </div>
          <BigNext
            label={saving ? "Guardando…" : "Guardar"}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const [saved] = await Promise.all([
                  onPatch({
                    weight: weight === "" ? null : Number(weight.replace(",", ".")),
                  }),
                  !bloatDirty.current || bloat == null
                    ? Promise.resolve()
                    : onBloat(bloat),
                ]);
                if (saved) onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** La sesión canónica real, si existe, seguida de las genéricas. */
function sessionChoices(data: TodayPayload): string[] {
  const current = data.view.session?.nombre;
  return orderedSessionOptions(current ? [current, ...SESSIONS] : [...SESSIONS]);
}

function sessionSuggestion(data: TodayPayload): string {
  return data.view.session
    ? "(según tu sesión guardada)"
    : `(franja habitual: ${data.defaultTrainingSlot})`;
}

function BigNext({
  label = "Siguiente",
  onClick,
  disabled = false,
}: {
  label?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 w-full rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
    >
      {label}
    </button>
  );
}

function SkipLink({ label = "Saltar", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto block min-h-11 px-4 text-[13px] text-muted-foreground"
    >
      {label}
    </button>
  );
}
