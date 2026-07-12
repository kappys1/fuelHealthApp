"use client";

import { useEffect, useState } from "react";

/*
  Estado de conexión (07 §4: degradación elegante de IA). Los botones de IA se
  deshabilitan sin red con motivo visible; el resto de la app sigue funcionando.
  SSR-safe: arranca en `true` (optimista) y se corrige en el cliente al montar.
*/
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
