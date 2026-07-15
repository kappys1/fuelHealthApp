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
 * `true` mientras el teclado en pantalla está realmente abierto sobre un campo
 * de texto.
 *
 * Señal robusta = (hay un campo de texto enfocado) **Y** (el viewport se ha
 * encogido respecto a su altura sin teclado). Con `interactiveWidget:
 * "resizes-content"` el teclado encoge `visualViewport.height`; al cerrarlo el
 * viewport vuelve a crecer y lo detectamos al instante.
 *
 * Por qué NO basta con `focusin`/`focusout`: en iOS puedes cerrar el teclado con
 * el botón "Done"/swipe **sin quitar el foco** del input → no dispara `focusout`
 * y la señal se quedaba pegada en `true` (la nav no volvía). El viewport, en
 * cambio, sí crece de vuelta y no miente.
 *
 * El gate de foco evita falsos positivos de la barra de URL (que también encoge
 * el viewport pero sin campo enfocado); la base se revisa al alza cuando no hay
 * foco, absorbiendo barra de URL y chrome del navegador.
 *
 * Se usa para retirar la nav inferior mientras se escribe (en `resizes-content`
 * un `fixed; bottom:0` flotaría sobre el teclado) y para anclar el composer del
 * chat justo encima del teclado.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Solo en dispositivos táctiles: en escritorio, enfocar un input no abre
    // teclado en pantalla, así que nunca hay nada que esconder.
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const vv = window.visualViewport;
    const vh = () => vv?.height ?? window.innerHeight;
    // Altura del viewport SIN teclado. Se mide al montar (teclado cerrado) y solo
    // sube: así un valor transitorio a media animación de cierre no la corrompe.
    let baseline = vh();
    const focused = () => isTextEntry(document.activeElement);

    const recompute = () => {
      const h = vh();
      if (!focused()) {
        // Sin campo enfocado no puede haber teclado: la altura actual es "base".
        baseline = Math.max(baseline, h);
        setOpen(false);
        return;
      }
      // Con foco: teclado abierto si el viewport se encogió de forma notable
      // (umbral > barra de URL ~60-90px, < teclado ~250-350px).
      setOpen(baseline - h > 120);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isTextEntry(e.target)) recompute();
    };
    // En `focusout`, `document.activeElement` aún no refleja el foco nuevo: un
    // frame después ya está asentado (y evita parpadeo al saltar entre campos).
    const onFocusOut = () => requestAnimationFrame(recompute);

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    vv?.addEventListener("resize", recompute);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      vv?.removeEventListener("resize", recompute);
    };
  }, []);
  return open;
}
