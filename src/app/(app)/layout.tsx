import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { getSession } from "@/lib/session";

// Server Action: cerrar sesión y volver a /login.
async function logout() {
  "use server";
  const session = await getSession();
  session.destroy();
  redirect("/login");
}

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
        <span
          className="text-lg font-bold tracking-tight text-primary"
          style={{ fontFamily: "var(--font-condensed)" }}
        >
          FUELBOARD
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={logout}>
            <button
              type="submit"
              className="h-9 rounded-md border border-line bg-surface px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">{children}</main>

      <BottomNav />
      <Toaster />
    </div>
  );
}
