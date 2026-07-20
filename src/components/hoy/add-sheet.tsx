"use client";

import {
  Camera,
  ChevronLeft,
  ClipboardList,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { api, type EntryInput, type ProductInput } from "@/lib/client-api";
import { processImage, type ProcessedImage } from "@/lib/image";
import { useOnline } from "@/lib/use-online";
import {
  displayMacro,
  entryBaseFields,
  type GrpKey,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  GRP_ORDER,
  productToEntryFields,
  roundKcal,
  roundMacroStore,
  scaleMacros,
  scaledForStore,
  sumMacros,
} from "@/lib/macros";
import { cn } from "@/lib/utils";
import type { PhotoResult } from "@/server/ai/schemas";
import type { ProductDTO, RecentDTO } from "@/server/db/queries/lookups";
import type { PlanOptionDTO } from "@/server/db/queries/plan";

interface Corpus {
  optionsByMeal: Record<string, PlanOptionDTO[]>;
  products: ProductDTO[];
  recents: RecentDTO[];
}

/** Handlers de CRUD del catálogo de productos (F07), inyectados desde useToday. */
export interface ProductActions {
  create: (input: ProductInput) => void;
  update: (id: number, patch: Partial<ProductInput>) => void;
  remove: (product: ProductDTO) => void;
  togglePin: (id: number) => void;
}

type Layer = "home" | "plan" | "photo" | "describe" | "product" | "products" | "editor";

export function AddSheet({
  open,
  onOpenChange,
  meal,
  setMeal,
  corpus,
  products,
  targetKcal,
  currentKcal,
  date,
  onAdd,
  initialFile,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meal: MealKey;
  setMeal: (m: MealKey) => void;
  corpus: Corpus;
  products: ProductActions;
  targetKcal: number;
  currentKcal: number;
  date: string;
  onAdd: (entries: EntryInput[]) => void;
  /** Imagen compartida al sistema (share target): abre directo en la capa de foto. */
  initialFile?: File | null;
}) {
  const [layer, setLayer] = useState<Layer>("home");
  // Producto seleccionado para el stepper (capa "product") y en edición (capa
  // "editor"; null = producto nuevo). `editorFrom` = a dónde vuelve el editor.
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null);
  // `editorFrom` solo se lee en el handler `back()`, nunca en el render → useRef
  // (react-doctor/rerender-state-only-in-handlers).
  const editorFromRef = useRef<Layer>("products");

  // Share target: al abrir con una imagen compartida, saltar a la capa de foto.
  // Diferido para no encadenar renders síncronos dentro del efecto.
  useEffect(() => {
    if (open && initialFile) queueMicrotask(() => setLayer("photo"));
  }, [open, initialFile]);
  const [search, setSearch] = useState("");
  const [justAdded, setJustAdded] = useState<{ delta: number; total: number } | null>(
    null,
  );

  const allOptions = useMemo(
    () => Object.values(corpus.optionsByMeal).flat(),
    [corpus.optionsByMeal],
  );

  // Búsqueda universal local: productos + opciones del plan + últimas entradas.
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const hits: ResultRow[] = [];
    for (const p of corpus.products)
      if (p.name.toLowerCase().includes(q))
        hits.push({
          key: `prod${p.id}`,
          name: p.name,
          kcal: p.baseKcal,
          prot: p.baseProt,
          carb: p.baseCarb,
          fat: p.baseFat,
          source: "fav",
          baseG: p.baseG,
        });
    for (const o of allOptions)
      if (o.name.toLowerCase().includes(q))
        hits.push({ key: `p${o.id}`, ...o, source: "plan", baseG: o.baseG });
    for (const r of corpus.recents)
      if (r.name.toLowerCase().includes(q))
        hits.push({ key: `r${r.name}`, ...r, source: "manual", baseG: null });
    return hits.slice(0, 8);
  }, [search, corpus.products, corpus.recents, allOptions]);

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
      setSelectedProduct(null);
      setEditingProduct(null);
    }
    onOpenChange(v);
  };

  // Añadir un producto al día: con baseG → capa stepper; fijo → 1 toque directo.
  const addProduct = (p: ProductDTO) => {
    if (p.baseG != null && p.baseG !== 0) {
      setSelectedProduct(p);
      setLayer("product");
      return;
    }
    const f = productToEntryFields(p, 0);
    commit([{ meal, name: p.name, ...f, source: "fav" }]);
  };

  const openEditor = (p: ProductDTO | null, from: Layer) => {
    setEditingProduct(p);
    editorFromRef.current = from;
    setLayer("editor");
  };

  const back = () => {
    if (layer === "editor") {
      setLayer(editorFromRef.current);
      return;
    }
    setLayer("home");
  };

  const headerLabel: Record<Layer, string> = {
    home: "Añadir",
    plan: "Del plan",
    photo: "Foto",
    describe: "Describir",
    product: selectedProduct?.name ?? "Producto",
    products: "Mis productos",
    editor: editingProduct ? "Editar producto" : "Nuevo producto",
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="bottom" className="max-h-[90dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="card-title text-muted-foreground">
            {layer !== "home" ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex min-h-11 items-center gap-1 pr-3 text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden /> {headerLabel[layer]}
              </button>
            ) : (
              "Añadir"
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Selector de comida (preseleccionada) */}
        <div className="px-4">
          <Select value={meal} onValueChange={(v) => setMeal(v as MealKey)}>
            <SelectTrigger className="h-11 w-full">
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
              {justAdded.total.toLocaleString("es-ES")}
              {targetKcal > 0 ? ` / ${targetKcal.toLocaleString("es-ES")}` : ""} kcal ·{" "}
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
            products={corpus.products}
            onGoLayer={setLayer}
            onAddProduct={addProduct}
            onOpenCatalog={() => setLayer("products")}
            onNewProduct={() => openEditor(null, "home")}
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
        ) : layer === "plan" ? (
          <PlanLayer
            meal={meal}
            options={corpus.optionsByMeal[meal] ?? []}
            onAdd={commit}
          />
        ) : layer === "product" && selectedProduct ? (
          <ProductStepperLayer
            product={selectedProduct}
            meal={meal}
            onAdd={(e) => {
              commit(e);
              setLayer("home");
              setSelectedProduct(null);
            }}
          />
        ) : layer === "products" ? (
          <ProductsLayer
            products={corpus.products}
            actions={products}
            onEdit={(p) => openEditor(p, "products")}
            onNew={() => openEditor(null, "products")}
          />
        ) : layer === "editor" ? (
          <ProductEditorLayer
            product={editingProduct}
            actions={products}
            onDone={back}
          />
        ) : layer === "photo" ? (
          <PhotoLayer meal={meal} date={date} onCommit={commit} initialFile={initialFile} />
        ) : (
          <DescribeLayer meal={meal} date={date} onCommit={commit} />
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
  products,
  onGoLayer,
  onAddProduct,
  onOpenCatalog,
  onNewProduct,
  onAddResult,
  onAddScaled,
}: {
  meal: MealKey;
  search: string;
  setSearch: (v: string) => void;
  results: ResultRow[];
  products: ProductDTO[];
  onGoLayer: (l: Layer) => void;
  onAddProduct: (p: ProductDTO) => void;
  onOpenCatalog: () => void;
  onNewProduct: () => void;
  onAddResult: (r: ResultRow) => void;
  onAddScaled: (e: EntryInput[]) => void;
}) {
  // Chips = productos fijados (agnósticos de comida), los más recientes primero.
  const pinned = products.filter((p) => p.pinned).slice(0, 6);
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
          placeholder="Buscar en productos, plan y recientes…"
          className="h-11 w-full rounded-lg border border-input bg-surface-2 pl-8 pr-2.5 text-base outline-none focus-visible:border-ring"
          aria-label="Buscar comida"
        />
      </div>

      {search.trim() ? (
        <div className="space-y-1">
          {results.length === 0 ? (
            <EstimateFallback meal={meal} text={search.trim()} onAdd={onAddScaled} />
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

      {/* Mis productos: chips de los fijados (agnósticos de comida). Tocar → stepper
          (si escala) o añadir directo (si es fijo). Pulsación larga → catálogo. */}
      {pinned.length > 0 ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[12px] text-muted-foreground">Mis productos</h3>
            <button
              type="button"
              onClick={onOpenCatalog}
              className="text-[12px] text-primary"
            >
              Ver todos →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {pinned.map((p) => (
              <ProductChip
                key={p.id}
                product={p}
                onTap={() => onAddProduct(p)}
                onLongPress={onOpenCatalog}
              />
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenCatalog}
          className="w-full rounded-lg border border-dashed border-line py-3 text-[13px] text-muted-foreground"
        >
          Aún no tienes productos fijados · Ver catálogo →
        </button>
      )}

      {/* Tres accesos grandes: Foto · Del plan · Describir (IA) */}
      <div className="grid grid-cols-3 gap-2">
        <BigAccess
          icon={<Camera className="size-5" aria-hidden />}
          label="Foto"
          onClick={() => onGoLayer("photo")}
        />
        <BigAccess
          icon={<ClipboardList className="size-5" aria-hidden />}
          label="Del plan"
          onClick={() => onGoLayer("plan")}
        />
        <BigAccess
          icon={<PenLine className="size-5" aria-hidden />}
          label="Describir"
          onClick={() => onGoLayer("describe")}
        />
      </div>

      {/* Nuevo producto (a mano en Fase 1; foto de etiqueta en Fase 2) */}
      <button
        type="button"
        onClick={onNewProduct}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-[13px] font-medium text-primary"
      >
        <Plus className="size-4" aria-hidden /> Nuevo producto
      </button>
    </div>
  );
}

/** Etiqueta corta de la base de un producto: "100 g · 310 kcal" o "310 kcal" (fijo). */
function productBaseLabel(p: ProductDTO): string {
  return p.baseG != null && p.baseG !== 0
    ? `${p.baseG} g · ${p.baseKcal} kcal`
    : `${p.baseKcal} kcal`;
}

/** Icono de origen del producto (📷 etiqueta · ✎ manual · nada para legacy). */
function ProductSourceIcon({ source }: { source: ProductDTO["source"] }) {
  if (source === "etiqueta")
    return <Camera className="size-3.5 text-protein" aria-label="De etiqueta" />;
  if (source === "manual")
    return <PenLine className="size-3.5 text-muted-foreground" aria-label="Manual" />;
  return null;
}

/** Chip de producto (2 columnas). Pulsación larga (~500 ms) → catálogo (AC7). */
function ProductChip({
  product,
  onTap,
  onLongPress,
}: {
  product: ProductDTO;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const start = () => {
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      onLongPress();
    }, 500);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onClick={() => {
        if (longFired.current) return; // fue pulsación larga: no añadir
        onTap();
      }}
      className="relative flex flex-col gap-0.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left"
    >
      <span className="absolute top-2 right-2.5">
        <ProductSourceIcon source={product.source} />
      </span>
      <span className="truncate pr-5 text-[13.5px] font-semibold">{product.name}</span>
      <span className="num text-[11px] text-muted-foreground">
        {productBaseLabel(product)}
      </span>
    </button>
  );
}

/** Fallback de la búsqueda universal sin match local → F-IA-2 (09 §4). */
function EstimateFallback({
  meal,
  text,
  onAdd,
}: {
  meal: MealKey;
  text: string;
  onAdd: (e: EntryInput[]) => void;
}) {
  const online = useOnline();
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState<{ kcal: string; prot: string; carb: string; fat: string } | null>(
    null,
  );

  const estimate = async () => {
    setBusy(true);
    try {
      const r = await api.estimateText(text);
      setEst({
        kcal: String(roundKcal(r.kcal)),
        prot: String(displayMacro(r.proteina_g)),
        carb: String(displayMacro(r.carbohidratos_g)),
        fat: String(displayMacro(r.grasa_g)),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo estimar.");
    } finally {
      setBusy(false);
    }
  };

  const num = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));

  if (est) {
    return (
      <div className="rounded-lg border border-line bg-surface-2/50 p-3">
        <div className="text-[14px]">{text}</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <MiniField label="kcal" value={est.kcal} onChange={(v) => setEst({ ...est, kcal: v })} />
          <MiniField label="Prot" value={est.prot} onChange={(v) => setEst({ ...est, prot: v })} />
          <MiniField label="Hidr" value={est.carb} onChange={(v) => setEst({ ...est, carb: v })} />
          <MiniField label="Grasa" value={est.fat} onChange={(v) => setEst({ ...est, fat: v })} />
        </div>
        <button
          type="button"
          onClick={() =>
            onAdd([
              {
                meal,
                name: text,
                kcal: Math.round(num(est.kcal)),
                prot: num(est.prot),
                carb: num(est.carb),
                fat: num(est.fat),
                source: "ia",
              },
            ])
          }
          className="mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground"
        >
          Añadir
        </button>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Estimación de IA. Revisa y corrige antes de añadir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-2">
      <p className="px-1 text-[13px] text-muted-foreground">
        Sin coincidencias locales.
      </p>
      <button
        type="button"
        onClick={estimate}
        disabled={busy || !online}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 py-2.5 text-[14px] font-medium disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4 text-primary" aria-hidden />
        )}
        Estimar «{text}» con IA
      </button>
      {!online ? (
        <p className="px-1 text-[12px] text-muted-foreground">
          Sin conexión: la estimación por IA no está disponible.
        </p>
      ) : null}
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
            onAdd([
              {
                meal,
                // Nombre limpio: la cantidad se pinta desde grams (F06), no pegada.
                name: row.name,
                ...scaled,
                source: "plan",
                ...entryBaseFields(row, grams, row.baseG),
              },
            ])
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
  // Variante elegida (F08): default = la primera (los campos planos ya la reflejan).
  // Solo con variantes; sin ellas el comportamiento es idéntico al de hoy.
  const [vIdx, setVIdx] = useState(0);
  const grams = g === "" ? 0 : Number(g.replace(",", "."));
  const fixed = option.baseG == null;

  const variant = option.variants[vIdx];
  // Base de macros efectiva: la variante elegida, o los campos planos de la opción.
  const base = variant
    ? { kcal: variant.kcal, prot: variant.prot, carb: variant.carb, fat: variant.fat }
    : option;
  // Nombre de la entrada = SOLO la variante ("Arroz hervido", "Pollo"), no el hueco:
  // el nombre del hueco de la pauta es largo ("Arroz / Quinoa / Pasta…"); en Hoy
  // interesa lo que comiste. Sin variante, el nombre (limpio) de la opción.
  const name = variant ? variant.nombre : option.name;
  const scaled = scaledForStore(base, grams, option.baseG);

  return (
    <div className="rounded-lg px-1 py-2">
      <div className="text-[14px]">{option.name}</div>
      {option.variants.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Fuente">
          {option.variants.map((v, i) => (
            <button
              key={v.nombre}
              type="button"
              aria-pressed={i === vIdx}
              onClick={() => setVIdx(i)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12px]",
                i === vIdx
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-line bg-surface-2 text-muted-foreground",
              )}
            >
              {v.nombre}
            </button>
          ))}
        </div>
      ) : null}
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
                // Nombre: "hueco · Variante" si hay variante; si no, limpio (la
                // cantidad se pinta desde grams — F06 —, no pegada al nombre).
                name,
                // scaledForStore no escala cuando baseG es null → macros de la base
                // tal cual (opción fija o variante por unidad).
                ...scaled,
                source: "plan",
                ...entryBaseFields(base, grams, option.baseG),
              },
            ])
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

// ── Capa Foto (F-IA-1) ──

interface PhotoItemState {
  nombre: string;
  base: { gramos: number; kcal: number; prot: number; carb: number; fat: number };
  grams: string; // string controlado: no se desmonta al vaciarlo
}

function PhotoLayer({
  meal,
  date,
  onCommit,
  initialFile,
}: {
  meal: MealKey;
  date: string;
  onCommit: (e: EntryInput[]) => void;
  initialFile?: File | null;
}) {
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ProcessedImage | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [items, setItems] = useState<PhotoItemState[]>([]);
  const [adding, setAdding] = useState(false);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const processed = await processImage(file);
      setImage(processed);
      setPreview(`data:${processed.mediaType};base64,${processed.base64}`);
      setResult(null);
      setItems([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la foto.");
    }
  };

  // Share target: procesar la imagen compartida al montar la capa de foto.
  const sharedRef = useRef(false);
  useEffect(() => {
    if (initialFile && !sharedRef.current) {
      sharedRef.current = true;
      void pickFile(initialFile);
    }
  }, [initialFile]);

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    try {
      const r = await api.analyzePhoto({
        imageBase64: image.base64,
        mediaType: image.mediaType,
        meal,
        note: note.trim() || null,
        date,
      });
      setResult(r);
      setItems(
        r.items.map((it) => ({
          nombre: it.nombre,
          base: {
            gramos: it.gramos,
            kcal: it.kcal,
            prot: it.proteina_g,
            carb: it.carbohidratos_g,
            fat: it.grasa_g,
          },
          grams: String(it.gramos),
        })),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo analizar la foto.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Recálculo proporcional en vivo (factor = g/baseG), SIN llamar a la IA.
  const rows = items.map((it) => {
    const grams = it.grams === "" ? 0 : Number(it.grams.replace(",", "."));
    return {
      it,
      grams,
      macros: scaleMacros(it.base, grams, it.base.gramos || null),
    };
  });
  const total = sumMacros(rows.map((r) => r.macros));

  const entryFromRow = (r: (typeof rows)[number], photoUrl: string | null): EntryInput => ({
    meal,
    // Nombre limpio: la cantidad se pinta desde grams (F06), no pegada al nombre.
    name: r.it.nombre,
    kcal: roundKcal(r.macros.kcal),
    prot: roundMacroStore(r.macros.prot),
    carb: roundMacroStore(r.macros.carb),
    fat: roundMacroStore(r.macros.fat),
    source: "foto",
    photoUrl,
    // Base inmutable de la IA (macros a `gramos`) → editable con stepper luego.
    ...entryBaseFields(
      { kcal: r.it.base.kcal, prot: r.it.base.prot, carb: r.it.base.carb, fat: r.it.base.fat },
      r.grams,
      r.it.base.gramos || null,
    ),
  });

  const reset = () => {
    setImage(null);
    setPreview(null);
    setNote("");
    setResult(null);
    setItems([]);
  };

  const add = async (mode: "separado" | "junto") => {
    if (!image || rows.length === 0) return;
    setAdding(true);
    // Blob SOLO al añadir (02 §3.2): si se descarta el análisis, no se sube nada.
    // La foto es SECUNDARIA: si la subida falla (p. ej. Blob sin configurar), se
    // registra igualmente la comida sin miniatura (principios 3 y 7).
    let url: string | null = null;
    try {
      url = (await api.uploadPhoto(image.base64, image.mediaType)).url;
    } catch {
      toast.warning("No se pudo guardar la miniatura; añado la comida sin foto.");
    }
    const entries: EntryInput[] =
      mode === "separado"
        ? rows.map((r) => entryFromRow(r, url))
        : [
            {
              meal,
              name: rows.map((r) => r.it.nombre).join(" + "),
              kcal: roundKcal(total.kcal),
              prot: roundMacroStore(total.prot),
              carb: roundMacroStore(total.carb),
              fat: roundMacroStore(total.fat),
              source: "foto",
              photoUrl: url,
            },
          ];
    onCommit(entries);
    reset();
    setAdding(false);
  };

  return (
    <div className="space-y-4 px-4 py-3">
      {/* Cámara / galería: label nativo envolviendo el input (05 §PhotoAnalyzer).
          SIN `capture`: en móvil, `capture` FUERZA la cámara y oculta la galería;
          sin él, iOS/Android ofrecen el selector nativo (Cámara · Fototeca ·
          Archivos), que es lo que piden 09 §4 y F2.8 («cámara/galería»). */}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 py-6 text-[14px] text-muted-foreground">
        <Camera className="size-5 text-primary" aria-hidden />
        {image ? "Cambiar foto" : "Hacer o elegir foto"}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </label>

      {preview ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={preview} alt="Foto de la comida" className="max-h-52 w-full rounded-lg object-cover" />
      ) : null}

      {image ? (
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">
            Aclaraciones (prevalecen sobre la foto)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="p. ej. «el pan es integral», «es jamón serrano»"
            className="w-full rounded-lg border border-input bg-surface-2 px-2.5 py-2 text-base outline-none focus-visible:border-ring"
          />
        </label>
      ) : null}

      {image ? (
        <>
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing || !online}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-[14px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {analyzing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : result ? (
              <RefreshCw className="size-4" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {analyzing
              ? "Analizando…"
              : result
                ? "Reanalizar la foto con las aclaraciones"
                : "Analizar foto"}
          </button>
          {!online ? (
            <p className="text-center text-[12px] text-muted-foreground">
              Sin conexión: el análisis por IA no está disponible.
            </p>
          ) : null}
        </>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {rows.map((row, i) => (
              <PhotoItemRow
                key={i}
                item={row.it}
                scaled={row.macros}
                onGrams={(v) =>
                  setItems((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, grams: v } : p)),
                  )
                }
              />
            ))}
          </div>

          {/* Total + veredicto */}
          <div
            className={cn(
              "rounded-lg px-3 py-2",
              result.encaja_plan == null
                ? "bg-surface-2"
                : result.encaja_plan
                  ? "bg-protein/10"
                  : "bg-fat/10",
            )}
          >
            <div className="num text-[14px] font-semibold text-foreground">
              Total: {roundKcal(total.kcal)} kcal · {displayMacro(total.prot)}P/
              {displayMacro(total.carb)}C/{displayMacro(total.fat)}F
            </div>
            <div className="mt-0.5 text-[13px]">
              <span
                className={
                  result.encaja_plan == null
                    ? "text-muted-foreground"
                    : result.encaja_plan
                      ? "text-protein"
                      : "text-fat"
                }
              >
                {result.encaja_plan == null
                  ? "Sin pauta para comparar"
                  : result.encaja_plan
                    ? "✓ encaja"
                    : "✗ fuera de plan"}
              </span>{" "}
              <span className="text-muted-foreground">— {result.comentario}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => add("separado")}
              disabled={adding}
              className="rounded-lg border border-line bg-surface-2 py-2.5 text-[14px] font-medium disabled:opacity-60"
            >
              Añadir por separado
            </button>
            <button
              type="button"
              onClick={() => add("junto")}
              disabled={adding}
              className="rounded-lg bg-primary py-2.5 text-[14px] font-medium text-primary-foreground disabled:opacity-60"
            >
              {adding ? "Añadiendo…" : "Añadir como una"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhotoItemRow({
  item,
  scaled,
  onGrams,
}: {
  item: PhotoItemState;
  scaled: { kcal: number; prot: number; carb: number; fat: number };
  onGrams: (v: string) => void;
}) {
  const hasGrams = item.base.gramos > 0;
  return (
    <div className="rounded-lg border border-line px-2.5 py-2">
      <div className="text-[14px]">{item.nombre}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {hasGrams ? (
          <Stepper value={item.grams} onChange={onGrams} step={10} suffix="g" ariaLabel="Gramos" />
        ) : null}
        <span className="num ml-auto text-[12px] text-muted-foreground">
          {roundKcal(scaled.kcal)} kcal · {displayMacro(scaled.prot)}P/
          {displayMacro(scaled.carb)}C/{displayMacro(scaled.fat)}F
        </span>
      </div>
    </div>
  );
}

// ── Capa Describir (F-IA-4: una comida o el día entero) ──
// F06 Fase 2: a la altura de la foto — items editables con stepper de gramos
// (cuando la IA da cantidad) y añadir por separado / como una.

interface DumpItemState {
  nombre: string;
  base: { gramos: number; kcal: number; prot: number; carb: number; fat: number };
  grams: string; // string controlado: no se desmonta al vaciarlo
}

function DescribeLayer({
  meal,
  date,
  onCommit,
}: {
  meal: MealKey;
  date: string;
  onCommit: (e: EntryInput[]) => void;
}) {
  const online = useOnline();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [items, setItems] = useState<DumpItemState[]>([]);

  const analyze = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.dayDump(text.trim(), date);
      setItems(
        r.items.map((it) => ({
          // La comida que asigna la IA (it.comida) se IGNORA: manda el selector de
          // arriba (paridad con la foto). Alex la fijaba a mano cada vez si no.
          nombre: it.nombre,
          base: {
            gramos: it.gramos ?? 0,
            kcal: it.kcal,
            prot: it.proteina_g,
            carb: it.carbohidratos_g,
            fat: it.grasa_g,
          },
          grams: it.gramos != null ? String(it.gramos) : "",
        })),
      );
      setAnalyzed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo interpretar.");
    } finally {
      setBusy(false);
    }
  };

  // Recálculo proporcional en vivo (factor = g/baseG), SIN llamar a la IA. Igual
  // que la foto: reescala SIEMPRE desde la base inmutable que devolvió la IA.
  const rows = items.map((it) => {
    const grams = it.grams === "" ? 0 : Number(it.grams.replace(",", "."));
    return {
      it,
      grams,
      macros: scaleMacros(it.base, grams, it.base.gramos || null),
    };
  });
  const total = sumMacros(rows.map((r) => r.macros));

  const entryFromRow = (r: (typeof rows)[number]): EntryInput => ({
    meal,
    name: r.it.nombre,
    kcal: roundKcal(r.macros.kcal),
    prot: roundMacroStore(r.macros.prot),
    carb: roundMacroStore(r.macros.carb),
    fat: roundMacroStore(r.macros.fat),
    source: "ia",
    ...entryBaseFields(
      { kcal: r.it.base.kcal, prot: r.it.base.prot, carb: r.it.base.carb, fat: r.it.base.fat },
      r.grams,
      r.it.base.gramos || null,
    ),
  });

  const add = (mode: "separado" | "junto") => {
    if (rows.length === 0) return;
    const entries: EntryInput[] =
      mode === "separado"
        ? rows.map(entryFromRow)
        : [
            {
              // "Como una" cae en la comida seleccionada arriba (los items pueden
              // abarcar varias comidas; la combinada es una entrada fija, sin base).
              meal,
              name: rows.map((r) => r.it.nombre).join(" + "),
              kcal: roundKcal(total.kcal),
              prot: roundMacroStore(total.prot),
              carb: roundMacroStore(total.carb),
              fat: roundMacroStore(total.fat),
              source: "ia",
            },
          ];
    onCommit(entries);
    setText("");
    setItems([]);
    setAnalyzed(false);
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <label className="block">
        <span className="mb-1 block text-[12px] text-muted-foreground">
          Describe una comida o el día entero
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="p. ej. «tortilla de 2 huevos con pan, un café con leche y un plátano»"
          className="w-full rounded-lg border border-input bg-surface-2 px-2.5 py-2 text-base outline-none focus-visible:border-ring"
        />
      </label>
      <button
        type="button"
        onClick={analyze}
        disabled={busy || !text.trim() || !online}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-[14px] font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : analyzed ? (
          <RefreshCw className="size-4" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {busy ? "Interpretando…" : analyzed ? "Reinterpretar" : "Interpretar con IA"}
      </button>
      {!online ? (
        <p className="text-[12px] text-muted-foreground">
          Sin conexión: la interpretación por IA no está disponible. Puedes añadir
          desde el plan o buscar.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {rows.map((row, i) => (
              <DumpItemRow
                key={i}
                item={row.it}
                scaled={row.macros}
                onGrams={(v) =>
                  setItems((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, grams: v } : p)),
                  )
                }
              />
            ))}
          </div>

          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <div className="num text-[14px] font-semibold text-foreground">
              Total: {roundKcal(total.kcal)} kcal · {displayMacro(total.prot)}P/
              {displayMacro(total.carb)}C/{displayMacro(total.fat)}F
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => add("separado")}
              className="rounded-lg border border-line bg-surface-2 py-2.5 text-[14px] font-medium"
            >
              Añadir por separado
            </button>
            <button
              type="button"
              onClick={() => add("junto")}
              className="rounded-lg bg-primary py-2.5 text-[14px] font-medium text-primary-foreground"
            >
              Añadir como una
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DumpItemRow({
  item,
  scaled,
  onGrams,
}: {
  item: DumpItemState;
  scaled: { kcal: number; prot: number; carb: number; fat: number };
  onGrams: (v: string) => void;
}) {
  const hasGrams = item.base.gramos > 0;
  return (
    <div className="rounded-lg border border-line px-2.5 py-2">
      <div className="text-[14px]">{item.nombre}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {hasGrams ? (
          <Stepper value={item.grams} onChange={onGrams} step={10} suffix="g" ariaLabel="Gramos" />
        ) : null}
        <span className="num ml-auto text-[12px] text-muted-foreground">
          {roundKcal(scaled.kcal)} kcal · {displayMacro(scaled.prot)}P/
          {displayMacro(scaled.carb)}C/{displayMacro(scaled.fat)}F
        </span>
      </div>
    </div>
  );
}

// ── Capa producto: stepper de gramos (patrón F06) → añadir a la comida en curso ──
function ProductStepperLayer({
  product,
  meal,
  onAdd,
}: {
  product: ProductDTO;
  meal: MealKey;
  onAdd: (e: EntryInput[]) => void;
}) {
  const [g, setG] = useState(String(product.baseG ?? 0));
  const grams = g === "" ? 0 : Number(g.replace(",", "."));
  const f = productToEntryFields(product, grams);

  return (
    <div className="space-y-4 px-4 py-3">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="text-[12px] text-muted-foreground">
          Etiqueta · {product.baseG} g =
        </div>
        <div className="num mt-0.5 text-[20px] font-bold">{product.baseKcal} kcal</div>
        <div className="num text-[13px] text-muted-foreground">
          {displayMacro(product.baseProt)} P · {displayMacro(product.baseCarb)} C ·{" "}
          {displayMacro(product.baseFat)} F
        </div>

        <div className="mt-4 mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          Cantidad
        </div>
        <div className="flex justify-center">
          <Stepper
            value={g}
            onChange={setG}
            step={10}
            suffix="g"
            ariaLabel="Cantidad en gramos"
          />
        </div>

        <div className="mt-4 text-center">
          <div className="num text-[20px] font-bold">{f.kcal} kcal</div>
          <div className="num text-[13px] text-muted-foreground">
            {displayMacro(f.prot)} P · {displayMacro(f.carb)} C · {displayMacro(f.fat)} F
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onAdd([{ meal, name: product.name, ...f, source: "fav" }])}
        className="w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground"
      >
        Añadir a {MEAL_LABELS[meal]}
      </button>
    </div>
  );
}

// ── Capa catálogo: lista editable de productos (buscar · ⭐ · ✎ · 🗑 · ＋ Nuevo) ──
function ProductsLayer({
  products,
  actions,
  onEdit,
  onNew,
}: {
  products: ProductDTO[];
  actions: ProductActions;
  onEdit: (p: ProductDTO) => void;
  onNew: () => void;
}) {
  const [q, setQ] = useState("");
  // Undo INLINE (dentro del sheet): el toast de Sonner se renderiza fuera del sheet
  // modal y no recibe clics (DECISIONS #42/#64). Sin auto-desaparición: se mantiene
  // hasta deshacer o descartar (×).
  const [justDeleted, setJustDeleted] = useState<ProductDTO | null>(null);
  const query = q.trim().toLowerCase();
  const filtered = query
    ? products.filter((p) => p.name.toLowerCase().includes(query))
    : products;

  const handleDelete = (p: ProductDTO) => {
    actions.remove(p);
    setJustDeleted(p);
  };
  const handleUndo = () => {
    if (!justDeleted) return;
    const input: ProductInput = {
      name: justDeleted.name,
      baseG: justDeleted.baseG,
      baseKcal: justDeleted.baseKcal,
      baseProt: justDeleted.baseProt,
      baseCarb: justDeleted.baseCarb,
      baseFat: justDeleted.baseFat,
      grupo: justDeleted.grupo,
      source: justDeleted.source,
      pinned: justDeleted.pinned,
    };
    actions.create(input);
    setJustDeleted(null);
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <button
        type="button"
        onClick={onNew}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground"
      >
        <Plus className="size-4" aria-hidden /> Nuevo producto
      </button>

      {justDeleted ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 py-1.5 pl-3 pr-1.5">
          <span className="text-[13px] text-muted-foreground">Producto eliminado</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-[14px] font-semibold text-primary-foreground"
            >
              <RotateCcw className="size-4" aria-hidden /> Deshacer
            </button>
            <button
              type="button"
              onClick={() => setJustDeleted(null)}
              aria-label="Descartar"
              className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar producto…"
          className="h-11 w-full rounded-lg border border-input bg-surface-2 pl-8 pr-2.5 text-base outline-none focus-visible:border-ring"
          aria-label="Buscar producto"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          {products.length === 0
            ? "Aún no tienes productos. Crea el primero con ＋ Nuevo."
            : "Sin coincidencias."}
        </p>
      ) : (
        <div>
          {filtered.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onTogglePin={() => actions.togglePin(p.id)}
              onEdit={() => onEdit(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const SOURCE_BADGE: Record<ProductDTO["source"], { label: string; cls: string }> = {
  etiqueta: { label: "etiqueta", cls: "text-protein border-protein/40" },
  manual: { label: "manual", cls: "text-muted-foreground border-line" },
  legacy: { label: "antiguo", cls: "text-carb border-carb/40" },
};

function ProductRow({
  product,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  product: ProductDTO;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badge = SOURCE_BADGE[product.source];
  return (
    <div className="flex items-start gap-2.5 border-b border-dashed border-line py-2.5 last:border-b-0">
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={product.pinned ? "Quitar de acceso rápido" : "Fijar como acceso rápido"}
        aria-pressed={product.pinned}
        className="shrink-0 pt-0.5 text-muted-foreground"
      >
        <Star
          className={cn("size-4", product.pinned && "fill-carb text-carb")}
          aria-hidden
        />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-foreground">{product.name}</div>
        <div className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted-foreground">
          <span>
            {productBaseLabel(product)} · {displayMacro(product.baseProt)}P/
            {displayMacro(product.baseCarb)}C/{displayMacro(product.baseFat)}F
          </span>
          <span className={cn("rounded border px-1.5 py-px text-[10px]", badge.cls)}>
            {badge.label}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Editar"
        className="shrink-0 pt-0.5 text-muted-foreground"
      >
        <PenLine className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Borrar"
        className="shrink-0 pt-0.5 text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}

// ── Capa editor: crear/editar un producto a mano (foto de etiqueta = Fase 2) ──
const GRUPO_NONE = "—";
const PRODUCT_GROUPS: GrpKey[] = ["Hidratos", "Proteína", "Verdura", "Grasa", "Otros"];

function ProductEditorLayer({
  product,
  actions,
  onDone,
}: {
  product: ProductDTO | null;
  actions: ProductActions;
  onDone: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [baseG, setBaseG] = useState(product?.baseG != null ? String(product.baseG) : "");
  const [kcal, setKcal] = useState(product ? String(product.baseKcal) : "");
  const [prot, setProt] = useState(product ? String(product.baseProt) : "");
  const [carb, setCarb] = useState(product ? String(product.baseCarb) : "");
  const [fat, setFat] = useState(product ? String(product.baseFat) : "");
  const [grupo, setGrupo] = useState<string>(product?.grupo ?? GRUPO_NONE);
  const [pinned, setPinned] = useState(product?.pinned ?? true);
  // Origen: al leer la etiqueta pasa a 'etiqueta'; si no, conserva el del producto
  // (o 'manual' para uno nuevo). F-IA-11 (Fase 2). Solo se lee en `save()`, nunca en
  // el render (el aviso lo dispara `aiFilled`) → useRef (rerender-state-only-in-handlers).
  const sourceRef = useRef<ProductInput["source"]>(product?.source ?? "manual");
  const [aiFilled, setAiFilled] = useState(false);
  const [reading, setReading] = useState(false);
  const online = useOnline();

  // Foto de la etiqueta → F-IA-11 rellena el formulario (LECTURA, no estimación).
  // Alex confirma/edita antes de guardar (el aviso «se fijan» sigue vigente).
  const pickLabel = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const img = await processImage(file);
      const r = await api.readLabel([
        { base64: img.base64, mediaType: img.mediaType },
      ]);
      setName(r.nombre || name);
      setBaseG(r.base_g != null ? String(r.base_g) : "");
      setKcal(r.kcal != null ? String(r.kcal) : "");
      setProt(r.proteina_g != null ? String(r.proteina_g) : "");
      setCarb(r.carbohidratos_g != null ? String(r.carbohidratos_g) : "");
      setFat(r.grasa_g != null ? String(r.grasa_g) : "");
      setGrupo(
        (PRODUCT_GROUPS as string[]).includes(r.grupo) ? r.grupo : GRUPO_NONE,
      );
      sourceRef.current = "etiqueta";
      setAiFilled(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo leer la etiqueta.",
      );
    } finally {
      setReading(false);
    }
  };

  const num = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));
  const canSave = name.trim() !== "" && kcal.trim() !== "";

  const save = () => {
    if (!canSave) return;
    const g = baseG.trim() === "" ? null : Math.round(num(baseG));
    const input: ProductInput = {
      name: name.trim(),
      baseG: g && g > 0 ? g : null,
      baseKcal: Math.round(num(kcal)),
      baseProt: num(prot),
      baseCarb: num(carb),
      baseFat: num(fat),
      grupo: grupo === GRUPO_NONE ? null : (grupo as GrpKey),
      // 'etiqueta' si se leyó la foto; si no, el origen del producto (o 'manual').
      source: sourceRef.current,
      pinned,
    };
    if (product) actions.update(product.id, input);
    else actions.create(input);
    onDone();
  };

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Foto de la etiqueta (F-IA-11): la IA LEE la tabla nutricional y rellena el
          formulario; Alex confirma/edita. SIN `capture` (selector nativo cámara/galería). */}
      <label
        className={cn(
          "relative flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-5 text-[13px]",
          online && !reading
            ? "cursor-pointer text-primary"
            : "text-muted-foreground opacity-60",
        )}
      >
        {reading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <Camera className="size-5" aria-hidden />
        )}
        {reading ? "Leyendo etiqueta…" : "Foto de la etiqueta"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!online || reading}
          onChange={(e) => pickLabel(e.target.files?.[0])}
        />
      </label>
      {!online ? (
        <p className="text-center text-[11px] text-muted-foreground">
          Sin conexión: leer la etiqueta con IA no está disponible.
        </p>
      ) : null}
      {aiFilled ? (
        <div className="flex items-center justify-center gap-1.5 text-[12px] text-protein">
          <Sparkles className="size-3.5" aria-hidden /> La IA leyó la etiqueta ·
          confírmalo
        </div>
      ) : null}
      <div className="text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        — o rellénalo a mano —
      </div>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted-foreground">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="p. ej. Tortitas integrales Hacendado"
          className="w-full rounded-lg border border-input bg-surface-2 px-2.5 py-2 text-base outline-none focus-visible:border-ring"
          aria-label="Nombre"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted-foreground">
          Base en gramos (vacío = fijo por unidad)
        </span>
        <input
          value={baseG}
          onChange={(e) => setBaseG(e.target.value)}
          inputMode="numeric"
          placeholder="100"
          className="num w-full rounded-lg border border-input bg-surface-2 px-2.5 py-2 text-base outline-none focus-visible:border-ring"
          aria-label="Base en gramos"
        />
      </label>

      <div>
        <span className="mb-1 block text-[12px] text-muted-foreground">
          kcal · P · C · G {baseG.trim() ? `(por ${baseG} g)` : "(por unidad)"}
        </span>
        <div className="grid grid-cols-4 gap-2">
          <MiniField label="kcal" value={kcal} onChange={setKcal} />
          <MiniField label="Prot" value={prot} onChange={setProt} />
          <MiniField label="Hidr" value={carb} onChange={setCarb} />
          <MiniField label="Grasa" value={fat} onChange={setFat} />
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[12px] text-muted-foreground">Grupo</span>
        <Select value={grupo} onValueChange={setGrupo}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GRUPO_NONE}>Sin grupo</SelectItem>
            {PRODUCT_GROUPS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <button
        type="button"
        onClick={() => setPinned((v) => !v)}
        aria-pressed={pinned}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[14px]"
      >
        <span>Acceso rápido (chip)</span>
        <Star className={cn("size-4", pinned ? "fill-carb text-carb" : "text-muted-foreground")} aria-hidden />
      </button>

      <div className="rounded-lg border border-carb/35 bg-carb/10 px-3 py-2 text-[12px] text-carb">
        ⚠️ Estos números se fijan y no se vuelven a estimar. Revísalos con la etiqueta.
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        Guardar producto
      </button>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="num h-9 w-full rounded-lg border border-input bg-surface px-2 text-base outline-none focus-visible:border-ring"
        aria-label={label}
      />
    </label>
  );
}

function BigAccess({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-20 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface-2 text-[13px]"
    >
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
