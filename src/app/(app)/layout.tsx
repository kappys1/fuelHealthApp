import { Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { getSession } from "@/lib/session";

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
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
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

      <main className="flex-1 px-4 pt-4 pb-24">{children}</main>

      <BottomNav />
      <Toaster />
    </div>
  );
}
