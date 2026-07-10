"use client";

import { Camera, ChevronLeft, ClipboardList, PenLine, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import type { EntryInput } from "@/lib/client-api";
import {
  displayMacro,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  GRP_ORDER,
  scaledForStore,
} from "@/lib/macros";
import { cn } from "@/lib/utils";
import type { FavoriteDTO, RecentDTO } from "@/server/db/queries/lookups";
import type { PlanOptionDTO } from "@/server/db/queries/plan";

interface Corpus {
  optionsByMeal: Record<string, PlanOptionDTO[]>;
  favorites: FavoriteDTO[];
  recents: RecentDTO[];
}

export function AddSheet({
  open,
  onOpenChange,
  meal,
  setMeal,
  corpus,
  targetKcal,
  currentKcal,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meal: MealKey;
  setMeal: (m: MealKey) => void;
  corpus: Corpus;
  targetKcal: number;
  currentKcal: number;
  onAdd: (entries: EntryInput[]) => void;
}) {
  const [layer, setLayer] = useState<"home" | "plan">("home");
  const [search, setSearch] = useState("");
  const [justAdded, setJustAdded] = useState<{ delta: number; total: number } | null>(
    null,
  );

  const allOptions = useMemo(
    () => Object.values(corpus.optionsByMeal).flat(),
    [corpus.optionsByMeal],
  );

  // Búsqueda universal local: favoritos + opciones del plan + últimas entradas.
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const hits: {
      key: string;
      name: string;
      kcal: number;
      prot: number;
      carb: number;
      fat: number;
      source: string;
      baseG: number | null;
    }[] = [];
    for (const f of corpus.favorites)
      if (f.name.toLowerCase().includes(q))
        hits.push({ key: `f${f.id}`, ...f, source: "fav", baseG: null });
    for (const o of allOptions)
      if (o.name.toLowerCase().includes(q))
        hits.push({ key: `p${o.id}`, ...o, source: "plan", baseG: o.baseG });
    for (const r of corpus.recents)
      if (r.name.toLowerCase().includes(q))
        hits.push({ key: `r${r.name}`, ...r, source: "manual", baseG: null });
    return hits.slice(0, 8);
  }, [search, corpus.favorites, corpus.recents, allOptions]);

  const commit = (entries: EntryInput[]) => {
    const delta = entries.reduce((a, e) => a + e.kcal, 0);
    onAdd(entries);
    setJustAdded({ delta, total: currentKcal + delta });
    setSearch("");
  };

  const handleOpen = (v: boolean) => {
    if (!v) {
      setLayer("home");
      setSearch("");
      setJustAdded(null);
    }
    onOpenChange(v);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="card-title text-muted-foreground">
            {layer === "plan" ? (
              <button
                type="button"
                onClick={() => setLayer("home")}
                className="inline-flex items-center gap-1 text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden /> Del plan
              </button>
            ) : (
              "Añadir"
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Selector de comida (preseleccionada) */}
        <div className="px-4">
          <Select value={meal} onValueChange={(v) => setMeal(v as MealKey)}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEAL_ORDER.map((m) => (
                <SelectItem key={m} value={m}>
                  {MEAL_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {justAdded ? (
          <div className="mx-4 mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
            <span className="num text-[14px] text-foreground">
              {justAdded.total.toLocaleString("es-ES")} / {targetKcal.toLocaleString("es-ES")} ·{" "}
              <span className="text-protein">+{justAdded.delta}</span>
            </span>
            <button
              type="button"
              onClick={() => setJustAdded(null)}
              className="text-[13px] font-medium text-primary"
            >
              Añadir otra
            </button>
          </div>
        ) : null}

        {layer === "home" ? (
          <HomeLayer
            meal={meal}
            search={search}
            setSearch={setSearch}
            results={results}
            favorites={corpus.favorites}
            onGoPlan={() => setLayer("plan")}
            onAddResult={(r) => {
              if (r.baseG != null) return; // se maneja con stepper inline abajo
              commit([
                {
                  meal,
                  name: r.name,
                  kcal: r.kcal,
                  prot: r.prot,
                  carb: r.carb,
                  fat: r.fat,
                  source: r.source,
                },
              ]);
            }}
            onAddScaled={commit}
          />
        ) : (
          <PlanLayer
            meal={meal}
            options={corpus.optionsByMeal[meal] ?? []}
            onAdd={commit}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type ResultRow = {
  key: string;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  source: string;
  baseG: number | null;
};

function HomeLayer({
  meal,
  search,
  setSearch,
  results,
  favorites,
  onGoPlan,
  onAddResult,
  onAddScaled,
}: {
  meal: MealKey;
  search: string;
  setSearch: (v: string) => void;
  results: ResultRow[];
  favorites: FavoriteDTO[];
  onGoPlan: () => void;
  onAddResult: (r: ResultRow) => void;
  onAddScaled: (e: EntryInput[]) => void;
}) {
  return (
    <div className="space-y-4 px-4 py-3">
      {/* Búsqueda universal */}
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        {/* biome-ignore lint/a11y/noAutofocus: la capa 1 se abre con teclado (09 §4) */}
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en favoritos, plan y recientes…"
          className="h-11 w-full rounded-lg border border-input bg-surface-2 pl-8 pr-2.5 text-base outline-none focus-visible:border-ring"
          aria-label="Buscar comida"
        />
      </div>

      {search.trim() ? (
        <div className="space-y-1">
          {results.length === 0 ? (
            <p className="px-1 py-2 text-[13px] text-muted-foreground">
              Sin coincidencias locales. La estimación con IA llega en la Fase 2.
            </p>
          ) : (
            results.map((r) =>
              r.baseG != null ? (
                <ScalableResult key={r.key} row={r} meal={meal} onAdd={onAddScaled} />
              ) : (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => onAddResult(r)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1 truncate text-[14px]">{r.name}</span>
                  <span className="num ml-2 shrink-0 text-[12px] text-muted-foreground">
                    {r.kcal} kcal
                  </span>
                </button>
              ),
            )
          )}
        </div>
      ) : null}

      {/* Chips de favoritos (6 más usados) */}
      {favorites.length > 0 ? (
        <div>
          <h3 className="mb-1.5 text-[12px] text-muted-foreground">Favoritos</h3>
          <div className="flex flex-wrap gap-2">
            {favorites.slice(0, 6).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  onAddScaled([
                    {
                      meal,
                      name: f.name,
                      kcal: f.kcal,
                      prot: f.prot,
                      carb: f.carb,
                      fat: f.fat,
                      source: "fav",
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px]"
              >
                <span className="max-w-[160px] truncate">{f.name}</span>
                <span className="num text-muted-foreground">{f.kcal}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Tres accesos grandes: Foto (F2) · Del plan · Describir (F2) */}
      <div className="grid grid-cols-3 gap-2">
        <BigAccess
          icon={<Camera className="size-5" aria-hidden />}
          label="Foto"
          badge="Fase 2"
          disabled
          onClick={() => toast("El análisis por foto llega en la Fase 2.")}
        />
        <BigAccess
          icon={<ClipboardList className="size-5" aria-hidden />}
          label="Del plan"
          onClick={onGoPlan}
        />
        <BigAccess
          icon={<PenLine className="size-5" aria-hidden />}
          label="Describir"
          badge="Fase 2"
          disabled
          onClick={() => toast("La descripción con IA llega en la Fase 2.")}
        />
      </div>
    </div>
  );
}

function ScalableResult({
  row,
  meal,
  onAdd,
}: {
  row: ResultRow;
  meal: MealKey;
  onAdd: (e: EntryInput[]) => void;
}) {
  const [g, setG] = useState(String(row.baseG ?? 0));
  const grams = g === "" ? 0 : Number(g.replace(",", "."));
  const scaled = scaledForStore(row, grams, row.baseG);
  return (
    <div className="rounded-lg px-2 py-2 hover:bg-surface-2">
      <div className="text-[14px]">{row.name}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <Stepper value={g} onChange={setG} step={10} suffix="g" ariaLabel="Gramos" />
        <button
          type="button"
          onClick={() =>
            onAdd([{ meal, name: `${row.name} · ${grams} g`, ...scaled, source: "plan" }])
          }
          className="ml-auto shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Añadir
        </button>
      </div>
      <div className="num mt-1.5 text-[12px] text-muted-foreground">
        {scaled.kcal} kcal · {displayMacro(scaled.prot)}P/{displayMacro(scaled.carb)}C/
        {displayMacro(scaled.fat)}F
      </div>
    </div>
  );
}

function PlanLayer({
  meal,
  options,
  onAdd,
}: {
  meal: MealKey;
  options: PlanOptionDTO[];
  onAdd: (e: EntryInput[]) => void;
}) {
  const grouped = GRP_ORDER.map((g) => ({
    grp: g,
    opts: options.filter((o) => o.grp === g),
  })).filter((x) => x.opts.length > 0);

  if (options.length === 0) {
    return (
      <p className="px-4 py-6 text-[13px] text-muted-foreground">
        Esta comida no tiene opciones en el plan vigente.
      </p>
    );
  }

  return (
    <div className="space-y-4 px-4 py-3">
      {grouped.map(({ grp, opts }) => (
        <div key={grp}>
          <h3 className="mb-1 text-[12px] text-muted-foreground">{grp}</h3>
          <div className="space-y-1">
            {opts.map((o) => (
              <PlanOptionRow key={o.id} option={o} meal={meal} onAdd={onAdd} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanOptionRow({
  option,
  meal,
  onAdd,
}: {
  option: PlanOptionDTO;
  meal: MealKey;
  onAdd: (e: EntryInput[]) => void;
}) {
  const [g, setG] = useState(String(option.baseG ?? 0));
  const grams = g === "" ? 0 : Number(g.replace(",", "."));
  const scaled = scaledForStore(option, grams, option.baseG);
  const fixed = option.baseG == null;

  return (
    <div className="rounded-lg px-1 py-2">
      <div className="text-[14px]">{option.name}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {!fixed ? (
          <Stepper value={g} onChange={setG} step={10} suffix="g" ariaLabel="Gramos" />
        ) : null}
        <button
          type="button"
          onClick={() =>
            onAdd([
              {
                meal,
                name: fixed ? option.name : `${option.name} · ${grams} g`,
                kcal: fixed ? option.kcal : scaled.kcal,
                prot: fixed ? option.prot : scaled.prot,
                carb: fixed ? option.carb : scaled.carb,
                fat: fixed ? option.fat : scaled.fat,
                source: "plan",
              },
            ])
          }
          className="ml-auto shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Añadir
        </button>
      </div>
      <div className="num mt-1.5 text-[12px] text-muted-foreground">
        {fixed ? option.kcal : scaled.kcal} kcal ·{" "}
        {displayMacro(fixed ? option.prot : scaled.prot)}P/
        {displayMacro(fixed ? option.carb : scaled.carb)}C/
        {displayMacro(fixed ? option.fat : scaled.fat)}F
      </div>
    </div>
  );
}

function BigAccess({
  icon,
  label,
  badge,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-20 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-2 text-[13px]",
        disabled && "opacity-60",
      )}
    >
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
      {badge ? (
        <span className="absolute top-1 right-1 rounded-full bg-line px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
