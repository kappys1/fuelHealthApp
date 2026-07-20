"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="wellness-card mt-4 p-5" role="alert">
      <span className="grid size-11 place-items-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 font-display text-lg font-semibold text-foreground">
        No hemos podido cargar esta pantalla
      </h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Tus datos no se han modificado. Comprueba la conexión y vuelve a intentarlo.
      </p>
      <Button type="button" onClick={reset} className="mt-5">
        <RefreshCw className="size-4" aria-hidden />
        Reintentar
      </Button>
    </section>
  );
}
