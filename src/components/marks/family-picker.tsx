"use client";

/*
  Selector de familia (F11 · Alcance C): input de texto libre + fila de chips
  tocables con las familias existentes. Tocar un chip la rellena (toca el
  seleccionado → la vacía); escribir crea una nueva. Sustituye al <datalist> nativo,
  invisible en Safari iOS. La canonización de grafía ("snatch"→"Snatch") la hace
  canonicalizeFamily EN EL GUARDADO (lib/marks), no aquí: aquí capturamos el texto.
  Reusado por el sheet de crear y por el editor del detalle.
*/
export function FamilyPicker({
  value,
  onChange,
  families,
  inputId,
}: {
  value: string;
  onChange: (v: string) => void;
  families: readonly string[];
  inputId?: string;
}) {
  const active = value.trim().toLowerCase();
  return (
    <div className="space-y-2">
      <input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Snatch, Squat, Carrera…"
        className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
        aria-label="Familia"
      />
      {families.length ? (
        <div className="flex flex-wrap gap-1.5">
          {families.map((f) => {
            const selected = f.trim().toLowerCase() === active;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onChange(selected ? "" : f)}
                aria-pressed={selected}
                className={`min-h-9 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  selected
                    ? "border-primary bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-primary"
                    : "border-line bg-surface-2 text-muted-foreground"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
