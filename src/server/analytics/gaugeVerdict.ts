/*
  Veredicto del día = ÚNICA fuente de verdad del FuelGauge y del coach (F-IA-6).
  Antes cada uno decidía por su cuenta si el día estaba «cubierto» → la UI decía
  «Objetivos cubiertos ✓» y el coach lo llamaba «fallo» el MISMO día (bug de
  coherencia del 14-jul). Ahora el gauge renderiza esto y el coach lo recibe como
  dato; el prompt solo gobierna el tono, no vuelve a juzgar.

  Función pura (sin IA ni BD). El redondeo de kcal se hace aquí con roundKcal para
  cuadrar con la cifra crono que muestra el gauge.
*/
import { isSpecialPhase, type Macros, type PhaseKey, roundKcal } from "@/lib/macros";

/** Fracción sobre objetivo a partir de la cual un macro se considera «notablemente
 *  pasado» y merece un aviso con calma (matiz de Alex: «cubierto» no puede tapar
 *  que la grasa se fue). 0,25 = 25 % por encima del objetivo. */
export const MACRO_NOTABLE_OVER = 0.25;

export type PhaseVerdict = "competicion" | "special" | "normal";

export interface MacroVerdict {
  value: number;
  target: number;
  /** Lo que falta para el objetivo (0 si ya se cubrió). */
  remaining: number;
  /** Lo que se pasó del objetivo (0 si no se pasó). */
  over: number;
  met: boolean;
  /** Se pasó por encima de MACRO_NOTABLE_OVER del objetivo. */
  notablyOver: boolean;
}

export interface GaugeVerdict {
  phase: PhaseVerdict;
  consumed: number;
  targetKcal: number;
  kcalRemaining: number;
  kcalOver: number;
  over: boolean;
  /** kcal + los tres macros cubiertos (equivale al `allCovered` del gauge). */
  covered: boolean;
  prot: MacroVerdict;
  carb: MacroVerdict;
  fat: MacroVerdict;
  /** Macros notablemente pasados (para el aviso proporcionado). */
  notablyOver: ("prot" | "carb" | "fat")[];
}

interface Targets {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

function macroVerdict(value: number, target: number): MacroVerdict {
  const remaining = Math.max(0, target - value);
  const over = Math.max(0, value - target);
  return {
    value,
    target,
    remaining,
    over,
    met: remaining === 0,
    notablyOver: target > 0 && over > target * MACRO_NOTABLE_OVER,
  };
}

export function gaugeVerdict(
  targets: Targets,
  totals: Macros,
  phase: PhaseKey | null,
): GaugeVerdict {
  const consumed = roundKcal(totals.kcal);
  const kcalRemaining = Math.max(0, targets.kcal - consumed);
  const kcalOver = Math.max(0, consumed - targets.kcal);

  const prot = macroVerdict(totals.prot, targets.prot);
  const carb = macroVerdict(totals.carb, targets.carb);
  const fat = macroVerdict(totals.fat, targets.fat);

  const phaseVerdict: PhaseVerdict =
    phase === "competicion"
      ? "competicion"
      : isSpecialPhase(phase)
        ? "special"
        : "normal";

  const notablyOver: ("prot" | "carb" | "fat")[] = [];
  if (prot.notablyOver) notablyOver.push("prot");
  if (carb.notablyOver) notablyOver.push("carb");
  if (fat.notablyOver) notablyOver.push("fat");

  return {
    phase: phaseVerdict,
    consumed,
    targetKcal: targets.kcal,
    kcalRemaining,
    kcalOver,
    over: consumed > targets.kcal,
    covered: kcalRemaining === 0 && prot.met && carb.met && fat.met,
    prot,
    carb,
    fat,
    notablyOver,
  };
}
