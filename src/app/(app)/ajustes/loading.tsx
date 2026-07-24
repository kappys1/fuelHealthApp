import { Skeleton } from "@/components/ui/skeleton";

export default function AjustesLoading() {
  return (
    <div className="space-y-8 pb-10" aria-label="Cargando ajustes">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <div className="wellness-card p-5 ring-1 ring-line">
            <div className="flex gap-3">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
            <Skeleton className="mt-5 h-11 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
