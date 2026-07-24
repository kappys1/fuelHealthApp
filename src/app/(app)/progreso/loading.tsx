import { Skeleton } from "@/components/ui/skeleton";

export default function ProgresoLoading() {
  return (
    <section className="space-y-6 pb-8" aria-label="Cargando progreso">
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-8 w-32" />
      </div>
      <Skeleton className="h-13 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-13 w-full rounded-xl" />
      </div>
      <Skeleton className="h-58 w-full rounded-[22px]" />
      <Skeleton className="h-72 w-full rounded-[22px]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-36 rounded-[22px]" />
        <Skeleton className="h-36 rounded-[22px]" />
      </div>
      <div className="wellness-card p-5">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-4 h-56 w-full rounded-xl" />
      </div>
      <div className="wellness-card p-5">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-4 h-56 w-full rounded-xl" />
      </div>
    </section>
  );
}
