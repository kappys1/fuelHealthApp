import { Skeleton } from "@/components/ui/skeleton";

export default function PlanLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-16" />

      {/* Objetivos */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <Skeleton className="h-4 w-32" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-1 h-3 w-20" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-3 h-9 w-52 rounded-lg" />
        <Skeleton className="mt-3 h-12 w-full rounded-xl" />
      </div>

      {/* Opciones por comida */}
      {["Almuerzo", "Comida"].map((m) => (
        <div key={m} className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-7 rounded-lg" />
          </div>
          <div className="divide-y divide-line">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="mt-1.5 h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
