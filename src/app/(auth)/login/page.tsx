"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/hoy");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? `Error ${res.status}`);
    } catch {
      setError("No se pudo conectar. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-[360px]">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-foreground font-display text-2xl font-bold leading-none text-background">
            F
          </span>
          <div className="text-left">
            <h1 className="font-display text-xl font-semibold text-foreground">Fuelboard</h1>
            <p className="text-[13px] text-muted-foreground">Tu salud, en contexto</p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="wellness-card p-5"
        >
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold text-foreground">
              Bienvenido, Alex
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Accede a tu panel personal.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[12px] text-muted-foreground">
              Contraseña
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              inputMode="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surface text-base"
              aria-invalid={error ? true : undefined}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 text-[13px] font-medium text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || password.length === 0}
            className="mt-5 w-full rounded-md text-[15px]"
          >
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
