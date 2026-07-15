import { Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { OfflineSync } from "@/components/offline-sync";
import { Toaster } from "@/components/ui/sonner";
import { getSession } from "@/lib/session";

// La función corría por defecto en iad1 (Washington) → cada query a Neon
// (eu-central-1, Frankfurt) cruzaba el Atlántico. La fijamos en fra1 para
// co-localizarla con la BD. Medido: /hoy ~0,45 s (iad1) → ver DECISIONS.
export const preferredRegion = "fra1";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verificación AUTORITATIVA de sesión (el proxy solo hace la optimista).
  const session = await getSession();
  if (!session.authenticated) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      {/* pt con safe-area: en PWA standalone (status bar translúcida) el contenido
          fluye bajo el reloj/notch; sin esto el wordmark lo pisa.
          `sticky top-0`: se queda arriba al scrollear el documento (más seguro en
          iOS que `fixed`); bg para que el contenido no se transparente por detrás. */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-background px-4 pb-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <Link
          href="/hoy"
          className="text-lg font-bold tracking-tight text-primary"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          FUELBOARD
        </Link>
        {/* Ajustes: icono en el header (no es pestaña) — 09-FLUJOS-UX §2 */}
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-surface text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Settings className="size-4" aria-hidden />
        </Link>
      </header>

      {/* Scroll de documento (modelo original, fiable en iOS): el wrapper crece con
          el contenido y la nav queda `fixed` sobre el viewport. El hilo de Chat se
          resuelve aparte con un panel fijo propio (ver chat-client.tsx), sin forzar
          a toda la app a un scroller anidado (rompía la nav fija en iOS). */}
      <main className="flex flex-1 flex-col px-4 pt-4 pb-24">{children}</main>

      <BottomNav />
      <Toaster />
      <OfflineSync />
    </div>
  );
}
