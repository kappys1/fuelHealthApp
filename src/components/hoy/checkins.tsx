"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";
import { dayTotals } from "@/server/analytics/dayTotals";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { TodayPayload } from "@/server/db/queries/today";

const BLOATS: BloatKey[] = ["ninguna", "leve", "moderada", "alta"];

/** Check-in matinal: peso → hinchazón → sesión. ≤15 s, un pulgar (09 §5). */
export function CheckinMatinal({
  open,
  onOpenChange,
  data,
  onPatch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TodayPayload;
  onPatch: (patch: DayPatch) => void;
}) {
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState(
    String(data.view.day?.weight ?? data.lastWeight ?? ""),
  );

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
            Check-in matinal · {step + 1}/3
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-4">
          {step === 0 ? (
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
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-[15px] text-foreground">¿Cómo amaneces?</p>
              <div className="grid grid-cols-2 gap-2">
                {BLOATS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      onPatch({ bloat: b });
                      setStep(2);
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

          {step === 2 ? (
            <div className="space-y-3">
              <p className="text-[15px] text-foreground">
                Sesión de hoy{" "}
                <span className="text-muted-foreground">
                  (sugerida: {data.defaultSession})
                </span>
              </p>
              <div className="max-h-[40dvh] space-y-1.5 overflow-y-auto">
                {[data.defaultSession, ...SESSIONS.filter((s) => s !== data.defaultSession)].map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        onPatch({ sessionLabel: s });
                        close();
                      }}
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left text-[14px]",
                        (data.view.day?.sessionLabel ?? data.defaultSession) === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-line bg-surface-2",
                      )}
                    >
                      {s}
                    </button>
                  ),
                )}
              </div>
              <SkipLink label="Terminar" onClick={close} />
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
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
                {roundKcal(totals.kcal).toLocaleString("es-ES")} /{" "}
                {data.targets.kcal.toLocaleString("es-ES")} kcal ·{" "}
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TodayPayload;
  onPatch: (patch: DayPatch) => void;
}) {
  const [weight, setWeight] = useState(
    String(data.view.day?.weight ?? data.lastWeight ?? ""),
  );

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
                  onClick={() => onPatch({ bloat: b })}
                  className={cn(
                    "rounded-lg border py-2 text-[12px]",
                    data.view.day?.bloat === b
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
            label="Guardar"
            onClick={() => {
              onPatch({
                weight: weight === "" ? null : Number(weight.replace(",", ".")),
              });
              onOpenChange(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BigNext({ label = "Siguiente", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground"
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
      className="mx-auto block text-[13px] text-muted-foreground"
    >
      {label}
    </button>
  );
}
