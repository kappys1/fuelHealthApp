"use client";

import { useEffect, useState } from "react";

// ¿El elemento con foco abre el teclado en pantalla? (texto, textarea, editable).
// Excluye inputs sin teclado (checkbox, radio, botones, sliders…).
function isTextEntry(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["button", "submit", "reset", "checkbox", "radio", "range", "file", "color", "image"].includes(
      type,
    );
  }
  return false;
}

/**
 * `true` mientras un campo de texto tiene el foco (teclado en pantalla abierto).
 * Detección por foco (no por `visualViewport`): con `interactiveWidget:
 * "resizes-content"` el viewport se encoge y el truco de comparar alturas falla,
 * pero focusin/focusout es fiable. Sirve para retirar la nav inferior mientras se
 * escribe (que en iOS quedaría flotando sobre el teclado).
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      if (isTextEntry(e.target)) setOpen(true);
    };
    const onOut = (e: FocusEvent) => {
      // Si el foco pasa a otro campo de texto, sigue abierto (evita parpadeo).
      if (!isTextEntry((e as FocusEvent & { relatedTarget: EventTarget | null }).relatedTarget)) {
        setOpen(false);
      }
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return open;
}
