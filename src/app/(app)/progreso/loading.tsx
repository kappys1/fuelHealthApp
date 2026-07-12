import { Skeleton } from "@/components/ui/skeleton";

// Skeleton con la forma real de Progreso · Tendencia (07 §6): control de segmento,
// TrendCard invertida, adherencia, DOS gráficos y la tabla "Últimos días" — así no
// hay layout shift al entrar el contenido real.
export default function ProgresoLoading() {
  return (
    <div className="space-y-4">
      {/* Segmento Tendencia | MED + selector de rango */}
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-8 w-56 rounded-lg" />

      {/* TrendCard invertida (jerarquía máxima, 05 §5) */}
      <Skeleton className="h-40 w-full rounded-xl" />

      {/* Adherencia */}
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* Gráfico de peso + ma7 */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-56 w-full rounded-lg" />
      </div>

      {/* Gráfico de ingesta */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-56 w-full rounded-lg" />
      </div>

      {/* Tabla "Últimos días" */}
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
