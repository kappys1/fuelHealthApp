import { Skeleton } from "@/components/ui/skeleton";

// Skeleton con la forma real de Hoy (07 §2): reserva los altos de cada tarjeta
// para que no haya layout shift cuando entra el contenido real.
export default function HoyLoading() {
  return (
    <div className="space-y-3">
      {/* Cabecera: fecha navegable + racha */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-6 w-10" />
      </div>

      {/* FuelGauge */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-11 w-40" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
        <Skeleton className="mt-3 h-3.5 w-full rounded-full" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-2.5 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
        <Skeleton className="mt-3 h-9 w-full rounded-lg" />
      </div>

      {/* Timeline de comidas */}
      <div className="rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="divide-y divide-line">
          {["almuerzo", "comida", "merienda", "cena"].map((m) => (
            <div key={m} className="flex items-center justify-between px-4 py-3.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      {/* Mi día colapsada */}
      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
    </div>
  );
}
