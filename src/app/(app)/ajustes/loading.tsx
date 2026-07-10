import { Skeleton } from "@/components/ui/skeleton";

export default function AjustesLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-20" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-4 w-full max-w-[280px]" />
        </div>
      ))}
    </div>
  );
}
