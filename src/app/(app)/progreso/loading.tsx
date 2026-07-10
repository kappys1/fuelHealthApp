import { Skeleton } from "@/components/ui/skeleton";

export default function ProgresoLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      {/* Tarjeta invertida de tendencia (jerarquía máxima, 05 §5) */}
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
