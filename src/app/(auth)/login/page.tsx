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
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-[360px]">
        <div className="mb-8 text-center">
          <h1
            className="font-display text-4xl font-bold tracking-tight text-primary"
            style={{ fontFamily: "var(--font-condensed)" }}
          >
            FUELBOARD
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Panel de combustible · Alex
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-line bg-surface p-5"
        >
          <div className="space-y-2">
            <Label htmlFor="password" className="card-title text-muted-foreground">
              Contraseña
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              inputMode="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-secondary text-base dark:bg-secondary"
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
            className="mt-5 h-11 w-full text-[15px]"
          >
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
