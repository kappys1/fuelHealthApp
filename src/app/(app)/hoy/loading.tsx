import { Skeleton } from "@/components/ui/skeleton";

// Skeleton con la forma real de Hoy (07 §2): reserva los altos de cada tarjeta
// para que no haya layout shift cuando entra el contenido real.
export default function HoyLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando Hoy">
      <span className="sr-only">Cargando Hoy…</span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-12 w-40 rounded-xl" />
        <Skeleton className="h-11 w-20 rounded-full" />
      </div>

      <div className="wellness-card p-[18px]">
        <div className="flex gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="size-11 rounded-xl" />
        </div>
      </div>

      <div className="wellness-card p-[18px]">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-44" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-[1.38fr_.86fr_.86fr] items-center gap-2">
          <Skeleton className="aspect-square w-full rounded-full" />
          <Skeleton className="aspect-square w-full rounded-full" />
          <Skeleton className="aspect-square w-full rounded-full" />
        </div>
        <Skeleton className="mt-4 h-2 w-full rounded-full" />
        <Skeleton className="mt-4 h-12 w-full rounded-xl" />
      </div>

      <div>
        <Skeleton className="mb-3 h-6 w-24" />
        <div className="wellness-card overflow-hidden">
        <div className="divide-y divide-line">
          {["almuerzo", "comida", "merienda", "cena"].map((m) => (
            <div key={m} className="flex min-h-[74px] items-center gap-3 px-[18px] py-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="wellness-card p-[18px]">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-4 h-11 w-full rounded-xl" />
        <Skeleton className="mt-3 h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
